const express = require('express');
const { protect } = require('../middleware/auth');
const Medicine = require('../models/Medicine');
const Reminder = require('../models/Reminder');

const router = express.Router();

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

function timeToMinutes(time) {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toReminderDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(obj._id),
    medicineId: String(obj.medicine),
    medicineName: obj.medicineName,
    dosage: obj.dosage,
    time: obj.time,
    status: obj.status,
  };
}

async function ensureTodayReminders(userId) {
  const date = toDateKey();
  const medicines = await Medicine.find({
    user: userId,
    status: { $ne: 'inactive' },
  });

  for (const medicine of medicines) {
    const times =
      medicine.reminderTimes && medicine.reminderTimes.length > 0
        ? medicine.reminderTimes
        : [];

    for (const time of times) {
      await Reminder.findOneAndUpdate(
        {
          user: userId,
          medicine: medicine._id,
          date,
          time,
        },
        {
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
    }
  }
}

// GET /api/reminders — today's reminders
router.get('/', protect, async (req, res) => {
  try {
    await ensureTodayReminders(req.user._id);

    const date = toDateKey();
    const reminders = await Reminder.find({
      user: req.user._id,
      date,
    });

    const sorted = reminders
      .map(toReminderDto)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load reminders' });
  }
});

// PATCH /api/reminders/:id — mark taken / skipped
router.patch('/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;

    if (status !== 'taken' && status !== 'skipped') {
      return res.status(400).json({
        message: 'status must be "taken" or "skipped"',
      });
    }

    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!reminder) {
      return res.status(404).json({ message: 'Reminder not found' });
    }

    const previous = reminder.status;
    reminder.status = status;
    await reminder.save();

    const medicine = await Medicine.findOne({
      _id: reminder.medicine,
      user: req.user._id,
    });

    if (medicine) {
      if (status === 'taken' && previous !== 'taken') {
        medicine.takenToday = true;
        if (medicine.remainingQuantity > 0) {
          medicine.remainingQuantity -= 1;
        }
        await medicine.save();
      }

      if (status === 'skipped' && previous === 'taken') {
        medicine.remainingQuantity += 1;
        const date = toDateKey();
        const takenCount = await Reminder.countDocuments({
          user: req.user._id,
          medicine: medicine._id,
          date,
          status: 'taken',
        });
        medicine.takenToday = takenCount > 0;
        await medicine.save();
      }
    }

    res.json(toReminderDto(reminder));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update reminder' });
  }
});

module.exports = router;
