const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const Prescription = require('../models/Prescription');

const router = express.Router();

// Multer configured inline (memoryStorage — no separate utils file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/') || mime === 'application/octet-stream' || !mime) {
      return cb(null, true);
    }
    return cb(new Error('Only image uploads are allowed'));
  },
});

function receiveImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Unable to upload image' });
    }
    next();
  });
}

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'prescriptions');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function saveImageBuffer(file) {
  ensureUploadDir();
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `rx_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, file.buffer);
  return `/uploads/prescriptions/${filename}`;
}

const SKIP_LINE =
  /^(rx|prescription|take|as directed|sig|patient|age|sex|date|address|phone|diagnosis|advice|follow|morning|night|after|before|food|tablet|capsule|syrup|dose|qty|quantity|refill)\b/i;

function cleanMedicineName(name) {
  return String(name || '')
    .replace(/^(?:\d+[.)]\s*|[-•*]+\s*)/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseMedicinesFromText(text) {
  const medicines = [];
  const seen = new Set();
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (SKIP_LINE.test(line) || line.length < 3) {
      continue;
    }

    // e.g. "1. Metformin 500 mg" / "2 Atorvastatin 10mg" / "Paracetamol - 650mg"
    let match =
      /^(?:\d+[.)]?\s+|[-•*]+\s*)?([A-Za-z][A-Za-z0-9./-]{1,40}(?:\s+[A-Za-z][A-Za-z0-9./-]{0,20}){0,3}?)\s*[-:]?\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|IU|units?))\b/i.exec(
        line,
      );

    // e.g. "Tab. Azithromycin" / "Cap Amoxicillin"
    if (!match) {
      match =
        /^(?:Tab(?:let)?s?\.?|Cap(?:sule)?s?\.?|Syp\.?|Inj\.?)\s+([A-Za-z][A-Za-z0-9\s/-]{1,40})/i.exec(
          line,
        );
      if (match) {
        const dosageMatch =
          /(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|IU|units?))\b/i.exec(line);
        match = [match[0], match[1], dosageMatch ? dosageMatch[1] : ''];
      }
    }

    if (match) {
      const name = cleanMedicineName(match[1]);
      const dosage = String(match[2] || '').trim();
      const key = `${name.toLowerCase()}|${dosage.toLowerCase()}`;
      if (!name || seen.has(key) || name.length < 2) {
        continue;
      }
      seen.add(key);
      medicines.push({ name, dosage });
    }
  }

  return medicines;
}

function normalizePersonName(raw) {
  const cleaned = String(raw || '')
    .replace(/[^A-Za-z.\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return '';
  }
  // Reject OCR junk / old demo placeholder
  if (/^(unknown|unkown|name|doctor|dr)$/i.test(cleaned)) {
    return '';
  }
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      if (/^(md|ms|mrs|mr|dr)\.?$/i.test(part)) {
        return part.replace(/\.$/, '').toUpperCase() === 'DR' ? 'Dr.' : part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function parseDoctorName(text) {
  const raw = String(text || '').replace(/\r/g, '');
  const patterns = [
    // Dr. / DR / Doctor / Or. (common OCR misread of Dr.)
    /(?:^|\n)\s*(?:Dr|DR|Doctor|Or)\.?\s*[:.-]?\s*([A-Za-z][A-Za-z.'-]{1,30}(?:[ \t]+[A-Za-z][A-Za-z.']{1,30}){0,3})/,
    // Physician / Consultant / Prescribed by
    /(?:Physician|Consultant|Prescribed\s+by|Seen\s+by|Examined\s+by)\s*[:.-]?\s*(?:Dr\.?\s*)?([A-Za-z][A-Za-z.'-]{1,30}(?:[ \t]+[A-Za-z][A-Za-z.']{1,30}){0,3})/i,
    // "Dr Name" anywhere on a short letterhead line
    /\b(?:Dr|Doctor)\.?\s+([A-Za-z][A-Za-z.'-]{1,30}(?:[ \t]+[A-Za-z][A-Za-z.']{1,30}){0,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (!match) {
      continue;
    }
    const name = normalizePersonName(match[1]);
    if (!name) {
      continue;
    }
    return name.toLowerCase().startsWith('dr') ? name : `Dr. ${name}`;
  }

  return '';
}

function emptyOcrResult(extractedText = '') {
  return {
    extractedText,
    doctorName: parseDoctorName(extractedText),
    extractedMedicines: parseMedicinesFromText(extractedText),
  };
}

const OCR_LANG_DIR = path.join(__dirname, '..', 'ocr-data');

async function runLocalTesseract(file) {
  const { createWorker } = require('tesseract.js');
  const hasLocalLang = fs.existsSync(path.join(OCR_LANG_DIR, 'eng.traineddata'));
  const worker = await createWorker(
    'eng',
    1,
    hasLocalLang
      ? { langPath: OCR_LANG_DIR, cachePath: OCR_LANG_DIR, gzip: false }
      : undefined,
  );
  try {
    const {
      data: { text },
    } = await worker.recognize(file.buffer);
    return String(text || '').trim();
  } finally {
    await worker.terminate().catch(() => {});
  }
}

async function runOcrSpace(file, apiKey) {
  const mime = file.mimetype || 'image/jpeg';
  const base64 = `data:${mime};base64,${file.buffer.toString('base64')}`;
  const form = new FormData();
  form.append('base64Image', base64);
  form.append('language', 'eng');
  form.append('isOverlayRequired', 'false');
  form.append('OCREngine', '2');
  form.append('scale', 'true');

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OCR service error (${response.status})`);
  }

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    throw new Error(
      (Array.isArray(data.ErrorMessage) ? data.ErrorMessage[0] : data.ErrorMessage) ||
        'OCR processing failed',
    );
  }

  return (data.ParsedResults || [])
    .map((item) => item.ParsedText || '')
    .join('\n')
    .trim();
}

/**
 * Local Tesseract first (bundled eng.traineddata), then OCR.space if configured.
 * Never invent sample medicines like Paracetamol / Amoxicillin.
 */
async function runOcrOnBuffer(file) {
  let extractedText = '';
  let source = 'none';

  try {
    extractedText = await runLocalTesseract(file);
    if (extractedText) {
      source = 'tesseract';
    }
  } catch (err) {
    console.warn('Local OCR failed:', err.message);
  }

  const apiKey = process.env.OCR_API_KEY;
  if (!extractedText && apiKey) {
    try {
      extractedText = await runOcrSpace(file, apiKey);
      if (extractedText) {
        source = 'ocr.space';
      }
    } catch (err) {
      console.warn('OCR.space failed:', err.message);
    }
  }

  const result = emptyOcrResult(extractedText);
  console.log(
    `[prescription-ocr] source=${source} textChars=${extractedText.length} medicines=${result.extractedMedicines.length}`,
  );
  return result;
}

function toPrescriptionDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const uploaded = new Date(obj.createdAt || obj.dateIssued || Date.now());
  return {
    id: String(obj._id),
    imageUrl: obj.imageUrl,
    doctorName: /unknown/i.test(String(obj.doctorName || ''))
      ? ''
      : obj.doctorName || '',
    uploadedAt: uploaded.toISOString(),
    dateIssued: obj.dateIssued
      ? new Date(obj.dateIssued).toISOString().slice(0, 10)
      : undefined,
    extractedText: obj.extractedText || '',
    medicines: (obj.extractedMedicines || []).map((med, index) => ({
      id: String(med._id || `med-${index}`),
      name: med.name,
      dosage: med.dosage || '',
    })),
    familyMemberId: obj.familyMember ? String(obj.familyMember) : undefined,
  };
}

function parseMedicinesField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// GET /api/prescriptions
router.get('/', protect, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ user: req.user._id }).sort({
      createdAt: -1,
    });
    res.json(prescriptions.map(toPrescriptionDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to list prescriptions' });
  }
});

// POST /api/prescriptions/upload — multer + OCR + save
router.post('/upload', protect, receiveImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'image file is required' });
    }

    const ocr = await runOcrOnBuffer(req.file);
    const imageUrl = saveImageBuffer(req.file);

    const rawDoctor =
      (req.body.doctorName && String(req.body.doctorName).trim()) ||
      ocr.doctorName ||
      '';
    const doctorName = /unknown/i.test(rawDoctor) ? '' : rawDoctor;

    const bodyMedicines = parseMedicinesField(req.body.medicines);
    const extractedMedicines =
      bodyMedicines.length > 0
        ? bodyMedicines
            .map((item) => ({
              name: String(item.name || '').trim(),
              dosage: String(item.dosage || '').trim(),
            }))
            .filter((item) => item.name)
        : ocr.extractedMedicines;

    const prescription = await Prescription.create({
      user: req.user._id,
      familyMember: req.body.familyMember || null,
      imageUrl,
      doctorName,
      extractedText: ocr.extractedText,
      extractedMedicines,
      dateIssued: req.body.dateIssued ? new Date(req.body.dateIssued) : new Date(),
    });

    res.status(201).json({
      ...toPrescriptionDto(prescription),
      extractedText: ocr.extractedText,
      ocrNote:
        ocr.extractedMedicines.length === 0
          ? 'No medicines detected clearly. Add them manually.'
          : undefined,
    });
  } catch (err) {
    console.error('[prescription-upload]', err);
    res.status(500).json({ message: err.message || 'Upload / OCR failed' });
  }
});

// POST /api/prescriptions/ocr — OCR only (used by the mobile extract step)
router.post('/ocr', protect, receiveImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'image file is required' });
    }

    const ocr = await runOcrOnBuffer(req.file);
    res.json({
      doctorName: ocr.doctorName,
      extractedText: ocr.extractedText,
      medicines: ocr.extractedMedicines.map((item, index) => ({
        id: `ocr-${index}-${Date.now()}`,
        name: item.name,
        dosage: item.dosage,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'OCR failed' });
  }
});

// POST /api/prescriptions — save after client-side edit (image + fields)
router.post('/', protect, receiveImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'image file is required' });
    }

    const imageUrl = saveImageBuffer(req.file);
    const medicines = parseMedicinesField(req.body.medicines).map((item) => ({
      name: item.name || '',
      dosage: item.dosage || '',
    }));

    const prescription = await Prescription.create({
      user: req.user._id,
      familyMember: req.body.familyMember || null,
      imageUrl,
      doctorName: (req.body.doctorName || '').trim(),
      extractedText: req.body.extractedText || '',
      extractedMedicines: medicines,
      dateIssued: req.body.dateIssued ? new Date(req.body.dateIssued) : new Date(),
    });

    res.status(201).json(toPrescriptionDto(prescription));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to save prescription' });
  }
});

// PATCH /api/prescriptions/:id — update doctor name / medicines after OCR review
router.patch('/:id', protect, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (req.body.doctorName !== undefined) {
      const nextName = String(req.body.doctorName || '').trim();
      prescription.doctorName = /unknown/i.test(nextName) ? '' : nextName;
    }

    if (req.body.medicines !== undefined) {
      const medicines = parseMedicinesField(req.body.medicines)
        .map((item) => ({
          name: String(item.name || '').trim(),
          dosage: String(item.dosage || '').trim(),
        }))
        .filter((item) => item.name);
      prescription.extractedMedicines = medicines;
    }

    if (req.body.extractedText !== undefined) {
      prescription.extractedText = String(req.body.extractedText || '');
    }

    await prescription.save();
    res.json(toPrescriptionDto(prescription));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update prescription' });
  }
});

// GET /api/prescriptions/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const prescription = await Prescription.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    res.json(toPrescriptionDto(prescription));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load prescription' });
  }
});

// DELETE /api/prescriptions/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const prescription = await Prescription.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!prescription) {
      return res.status(404).json({ message: 'Prescription not found' });
    }

    if (prescription.imageUrl && prescription.imageUrl.startsWith('/uploads/')) {
      const filepath = path.join(__dirname, '..', prescription.imageUrl);
      fs.promises.unlink(filepath).catch(() => {});
    }

    res.json({ message: 'Prescription deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete prescription' });
  }
});

module.exports = router;
