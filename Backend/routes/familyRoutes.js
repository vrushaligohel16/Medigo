const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { protect } = require('../middleware/auth');
const FamilyMember = require('../models/FamilyMember');
const Medicine = require('../models/Medicine');
const HealthRecord = require('../models/HealthRecord');
const Appointment = require('../models/Appointment');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'family');

function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function saveImageBuffer(file) {
  ensureUploadDir();
  const ext = path.extname(file.originalname) || '.jpg';
  const filename = `family_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  fs.writeFileSync(filepath, file.buffer);
  return `/uploads/family/${filename}`;
}

function parseStringArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return raw
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function toMemberDto(doc, activeMedicinesCount = 0) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    name: obj.name,
    relation: obj.relation,
    age: obj.age,
    photo: obj.photo || '',
    avatarUrl: obj.photo || undefined,
    bloodGroup: obj.bloodGroup || undefined,
    allergies: obj.allergies || [],
    chronicConditions: obj.chronicConditions || [],
    phone: obj.phone || undefined,
    activeMedicinesCount,
    medicineCount: activeMedicinesCount,
  };
}

function toMedicineDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const reminderTimes = obj.reminderTimes || [];
  return {
    id: String(obj._id),
    name: obj.name,
    dosage: obj.dosage,
    form: obj.form,
    frequency: obj.frequency,
    reminderTimes,
    startDate: obj.startDate ? new Date(obj.startDate).toISOString().slice(0, 10) : null,
    endDate: obj.endDate ? new Date(obj.endDate).toISOString().slice(0, 10) : undefined,
    quantity: obj.quantity,
    remainingQuantity: obj.remainingQuantity,
    totalQuantity: obj.totalQuantity,
    notes: obj.notes || undefined,
    nextReminderTime: reminderTimes[0] || null,
    takenToday: Boolean(obj.takenToday),
    status: obj.status,
    expiresAt: obj.expiresAt
      ? new Date(obj.expiresAt).toISOString().slice(0, 10)
      : undefined,
    familyMemberId: obj.familyMemberId ? String(obj.familyMemberId) : undefined,
  };
}

function toHealthDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    type: obj.type,
    systolic: obj.systolic,
    diastolic: obj.diastolic,
    value: obj.value,
    sugarContext: obj.sugarContext,
    unit: obj.unit,
    recordedAt: new Date(obj.recordedAt).toISOString(),
    notes: obj.notes || undefined,
    familyMemberId: obj.familyMember ? String(obj.familyMember) : undefined,
  };
}

function toAppointmentDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const isPast = new Date(obj.date).getTime() < Date.now();
  const status =
    obj.status === 'cancelled' ? 'cancelled' : isPast ? 'past' : 'upcoming';

  return {
    id: String(obj._id),
    doctorName: obj.doctorName,
    specialty: obj.specialty,
    clinicName: obj.clinicName,
    clinic: obj.clinicName,
    date: new Date(obj.date).toISOString(),
    startsAt: new Date(obj.date).toISOString(),
    reason: obj.reason || undefined,
    notes: obj.reason || undefined,
    status,
    reminderEnabled: Boolean(obj.reminderEnabled),
    address: obj.address || undefined,
    meetingUrl: obj.meetingUrl || undefined,
    familyMemberId: obj.familyMember ? String(obj.familyMember) : undefined,
  };
}

const RELATIONS = new Set([
  'Self',
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Other',
]);

const BLOOD_GROUPS = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

function buildMemberPayload(body, existing, uploadedPhotoPath) {
  const name = (body.name ?? existing?.name ?? '').trim();
  const relation = body.relation ?? existing?.relation ?? 'Other';
  const photoFromBody = (body.photo ?? body.avatarUrl ?? '').trim();
  const photo =
    uploadedPhotoPath ||
    photoFromBody ||
    (existing?.photo ?? '').trim();
  const bloodGroupRaw = body.bloodGroup ?? existing?.bloodGroup ?? null;
  const bloodGroup =
    bloodGroupRaw && BLOOD_GROUPS.has(bloodGroupRaw) ? bloodGroupRaw : null;

  return {
    name,
    relation: RELATIONS.has(relation) ? relation : 'Other',
    age:
      body.age !== undefined && body.age !== ''
        ? Number(body.age)
        : existing?.age,
    photo,
    bloodGroup,
    allergies:
      body.allergies !== undefined
        ? parseStringArray(body.allergies)
        : existing?.allergies ?? [],
    chronicConditions:
      body.chronicConditions !== undefined
        ? parseStringArray(body.chronicConditions)
        : existing?.chronicConditions ?? [],
    phone: (body.phone ?? existing?.phone ?? '').trim(),
  };
}

async function countActiveMedicines(userId, memberId) {
  return Medicine.countDocuments({
    user: userId,
    familyMemberId: memberId,
    status: { $ne: 'inactive' },
  });
}

// POST /api/family — create (JSON or multipart with photo)
router.post('/', protect, upload.single('photo'), async (req, res) => {
  try {
    const uploadedPhoto = req.file ? saveImageBuffer(req.file) : '';
    const payload = buildMemberPayload(req.body, null, uploadedPhoto);
    if (!payload.name) {
      return res.status(400).json({ message: 'name is required' });
    }

    const member = await FamilyMember.create({
      ...payload,
      user: req.user._id,
    });

    res.status(201).json(toMemberDto(member, 0));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to create family member' });
  }
});

// GET /api/family — list
router.get('/', protect, async (req, res) => {
  try {
    const members = await FamilyMember.find({ user: req.user._id }).sort({
      createdAt: -1,
    });

    const dtos = await Promise.all(
      members.map(async (member) => {
        const count = await countActiveMedicines(req.user._id, member._id);
        return toMemberDto(member, count);
      }),
    );

    res.json(dtos);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to list family members' });
  }
});

// GET /api/family/:id — member + medicines / health / appointments
router.get('/:id', protect, async (req, res) => {
  try {
    const member = await FamilyMember.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    const [medicines, healthRecords, appointments, activeMedicinesCount] =
      await Promise.all([
        Medicine.find({
          user: req.user._id,
          familyMemberId: member._id,
        }).sort({ createdAt: -1 }),
        HealthRecord.find({
          user: req.user._id,
          familyMember: member._id,
        }).sort({ recordedAt: -1 }),
        Appointment.find({
          user: req.user._id,
          familyMember: member._id,
        }).sort({ date: 1 }),
        countActiveMedicines(req.user._id, member._id),
      ]);

    res.json({
      ...toMemberDto(member, activeMedicinesCount),
      medicines: medicines.map(toMedicineDto),
      healthRecords: healthRecords.map(toHealthDto),
      appointments: appointments.map(toAppointmentDto),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load family member' });
  }
});

// PUT /api/family/:id
router.put('/:id', protect, upload.single('photo'), async (req, res) => {
  try {
    const member = await FamilyMember.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    const uploadedPhoto = req.file ? saveImageBuffer(req.file) : '';
    const payload = buildMemberPayload(req.body, member, uploadedPhoto);
    if (!payload.name) {
      return res.status(400).json({ message: 'name is required' });
    }

    Object.assign(member, payload);
    await member.save();

    const count = await countActiveMedicines(req.user._id, member._id);
    res.json(toMemberDto(member, count));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update family member' });
  }
});

// DELETE /api/family/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const member = await FamilyMember.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    res.json({ message: 'Family member deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete family member' });
  }
});

module.exports = router;
