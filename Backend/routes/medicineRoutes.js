const express = require('express');
const { protect } = require('../middleware/auth');
const Medicine = require('../models/Medicine');
const Reminder = require('../models/Reminder');

const router = express.Router();

const BARCODE_CATALOG = {
  '8901030895829': {
    name: 'Paracetamol 500mg',
    dosage: '500 mg',
    form: 'tablet',
    quantity: 20,
    notes: 'Pain reliever / fever reducer',
  },
  '8901266010122': {
    name: 'Amoxicillin',
    dosage: '250 mg',
    form: 'capsule',
    quantity: 21,
    notes: 'Antibiotic — complete the full course',
  },
  '8901138504419': {
    name: 'Vitamin D3',
    dosage: '1000 IU',
    form: 'tablet',
    quantity: 30,
    notes: 'Take with food',
  },
  '8906006450071': {
    name: 'Metformin',
    dosage: '500 mg',
    form: 'tablet',
    quantity: 60,
    notes: 'Take with meals',
  },
};

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date = new Date()) {
  const d = startOfDay(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function daysUntil(expiry) {
  if (!expiry) return null;
  const expiryDay = startOfDay(new Date(expiry));
  const today = startOfDay(new Date());
  return Math.ceil((expiryDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function computeStatus({ endDate, expiresAt, status }) {
  if (status === 'inactive') return 'inactive';
  const expiry = expiresAt || endDate;
  const remaining = daysUntil(expiry);
  if (remaining != null && remaining >= 0 && remaining <= 30) {
    return 'expiring';
  }
  return 'active';
}

function formatTimeDisplay(time24) {
  if (!time24) return null;
  const [hourStr, minuteStr] = time24.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return time24;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')} ${suffix}`;
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
    nextReminderTime: reminderTimes[0] ? formatTimeDisplay(reminderTimes[0]) : null,
    takenToday: Boolean(obj.takenToday),
    status: obj.status,
    expiresAt: obj.expiresAt
      ? new Date(obj.expiresAt).toISOString().slice(0, 10)
      : undefined,
    barcode: obj.barcode || undefined,
    familyMemberId: obj.familyMemberId ? String(obj.familyMemberId) : undefined,
  };
}

async function syncTodayReminders(userId, medicine) {
  const date = toDateKey();
  const times =
    medicine.reminderTimes && medicine.reminderTimes.length > 0
      ? medicine.reminderTimes
      : [];

  await Promise.all(
    times.map(async (time) => {
      await Reminder.findOneAndUpdate(
        {
          user: userId,
          medicine: medicine._id,
          date,
          time,
        },
        {
          // Paths must not appear in both $set and $setOnInsert (Mongo conflict).
          $setOnInsert: {
            user: userId,
            medicine: medicine._id,
            time,
            date,
            status: 'pending',
          },
          $set: {
            medicineName: medicine.name,
            dosage: medicine.dosage,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }),
  );
}

function buildMedicinePayload(body, existing) {
  const quantity = Number(body.quantity ?? existing?.quantity ?? 0);
  const remainingQuantity = Number(
    body.remainingQuantity ?? existing?.remainingQuantity ?? quantity,
  );
  const totalQuantity = Number(
    body.totalQuantity ?? existing?.totalQuantity ?? quantity,
  );
  const startDate = body.startDate ? new Date(body.startDate) : existing?.startDate;
  const endDate = body.endDate
    ? new Date(body.endDate)
    : body.endDate === null
      ? undefined
      : existing?.endDate;
  const expiresAt = body.expiresAt
    ? new Date(body.expiresAt)
    : endDate || existing?.expiresAt;

  const status = computeStatus({
    endDate,
    expiresAt,
    status: body.status ?? existing?.status ?? 'active',
  });

  return {
    name: body.name?.trim() ?? existing?.name,
    dosage: body.dosage?.trim() ?? existing?.dosage,
    form: body.form ?? existing?.form ?? 'tablet',
    frequency: Number(body.frequency ?? existing?.frequency ?? 1),
    reminderTimes: Array.isArray(body.reminderTimes)
      ? body.reminderTimes
      : existing?.reminderTimes ?? [],
    startDate,
    endDate,
    expiresAt,
    quantity,
    remainingQuantity,
    totalQuantity,
    notes: body.notes?.trim?.() ?? body.notes ?? existing?.notes ?? '',
    barcode: body.barcode?.trim?.() ?? body.barcode ?? existing?.barcode ?? '',
    status,
    familyMemberId: body.familyMemberId ?? existing?.familyMemberId ?? null,
  };
}

// Static paths BEFORE /:id
router.get('/lookup', protect, async (req, res) => {
  try {
    const barcode = String(req.query.barcode || '').trim();
    if (!barcode) {
      return res.status(400).json({ message: 'barcode query param is required' });
    }

    const fromCatalog = BARCODE_CATALOG[barcode];
    if (fromCatalog) {
      return res.json({ barcode, ...fromCatalog, form: fromCatalog.form === 'capsule' ? 'tablet' : fromCatalog.form });
    }

    const existing = await Medicine.findOne({
      user: req.user._id,
      barcode,
    }).sort({ updatedAt: -1 });

    if (existing) {
      return res.json({
        barcode,
        name: existing.name,
        dosage: existing.dosage,
        form: existing.form,
        quantity: existing.quantity,
        notes: existing.notes,
      });
    }

    return res.status(404).json({ message: 'No medicine found for this barcode.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Lookup failed' });
  }
});

router.get('/expiring-soon', protect, async (req, res) => {
  try {
    const withinDays = Number(req.query.days) || 30;
    const medicines = await Medicine.find({
      user: req.user._id,
      status: { $ne: 'inactive' },
    }).sort({ expiresAt: 1, endDate: 1 });

    const filtered = medicines.filter((med) => {
      const remaining = daysUntil(med.expiresAt || med.endDate);
      return remaining != null && remaining >= 0 && remaining <= withinDays;
    });

    res.json(filtered.map(toMedicineDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load expiring medicines' });
  }
});

// Alias for the mobile app (same handler as /api/ai/check-interactions)
router.post('/check-interactions', protect, require('./aiRoutes').handleCheckInteractions);

router.get('/', protect, async (req, res) => {
  try {
    const { status, familyMemberId } = req.query;
    const filter = { user: req.user._id };

    if (status === 'active' || status === 'expiring' || status === 'inactive') {
      filter.status = status;
    }

    if (familyMemberId) {
      filter.familyMemberId = familyMemberId;
    }

    const medicines = await Medicine.find(filter).sort({ createdAt: -1 });
    res.json(medicines.map(toMedicineDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to list medicines' });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { name, dosage, startDate, quantity } = req.body;
    if (!name || !dosage || !startDate || quantity == null) {
      return res.status(400).json({
        message: 'name, dosage, startDate, and quantity are required',
      });
    }

    const payload = buildMedicinePayload(req.body);
    const medicine = await Medicine.create({
      ...payload,
      user: req.user._id,
      takenToday: false,
    });

    await syncTodayReminders(req.user._id, medicine);
    res.status(201).json(toMedicineDto(medicine));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to create medicine' });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    res.json(toMedicineDto(medicine));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load medicine' });
  }
});

router.put('/:id', protect, async (req, res) => {
  try {
    const medicine = await Medicine.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    const payload = buildMedicinePayload(req.body, medicine);
    Object.assign(medicine, payload);
    await medicine.save();
    await syncTodayReminders(req.user._id, medicine);

    res.json(toMedicineDto(medicine));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update medicine' });
  }
});

router.delete('/:id', protect, async (req, res) => {
  try {
    const medicine = await Medicine.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!medicine) {
      return res.status(404).json({ message: 'Medicine not found' });
    }

    await Reminder.deleteMany({ medicine: medicine._id, user: req.user._id });
    res.json({ message: 'Medicine deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete medicine' });
  }
});

module.exports = router;
