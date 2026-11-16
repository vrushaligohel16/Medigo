const express = require('express');
const { protect } = require('../middleware/auth');
const Appointment = require('../models/Appointment');

const router = express.Router();

function deriveStatus(appointment) {
  if (appointment.status === 'cancelled') {
    return 'cancelled';
  }
  const isPast = new Date(appointment.date).getTime() < Date.now();
  return isPast ? 'past' : 'upcoming';
}

function toAppointmentDto(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  const status = deriveStatus(obj);
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

function resolveDate(body) {
  const raw = body.date || body.startsAt;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

// POST /api/appointments — create
router.post('/', protect, async (req, res) => {
  try {
    const { doctorName, specialty, clinicName, clinic, reason, notes } = req.body;
    const date = resolveDate(req.body);

    const resolvedClinic = (clinicName || clinic || '').trim();
    if (!doctorName || !specialty || !resolvedClinic || !date) {
      return res.status(400).json({
        message: 'doctorName, specialty, clinicName (or clinic), and date (or startsAt) are required',
      });
    }

    const appointment = await Appointment.create({
      user: req.user._id,
      doctorName: String(doctorName).trim(),
      specialty: String(specialty).trim(),
      clinicName: resolvedClinic,
      date,
      reason: (reason || notes || '').trim(),
      status: req.body.status === 'cancelled' ? 'cancelled' : deriveStatus({ date, status: 'upcoming' }),
      reminderEnabled:
        req.body.reminderEnabled === undefined ? true : Boolean(req.body.reminderEnabled),
      address: (req.body.address || '').trim(),
      meetingUrl: (req.body.meetingUrl || '').trim(),
      familyMember: req.body.familyMember || req.body.familyMemberId || null,
    });

    res.status(201).json(toAppointmentDto(appointment));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to create appointment' });
  }
});

// GET /api/appointments — split upcoming / past
router.get('/', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.familyMemberId) {
      filter.familyMember = req.query.familyMemberId;
    }

    const appointments = await Appointment.find(filter).sort({ date: 1 });
    const dtos = appointments.map(toAppointmentDto);

    const upcoming = dtos
      .filter((item) => item.status === 'upcoming')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const past = dtos
      .filter((item) => item.status === 'past' || item.status === 'cancelled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({
      upcoming,
      past,
      // Convenience for the current mobile client
      appointments: [...upcoming, ...past],
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to list appointments' });
  }
});

// GET /api/appointments/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json(toAppointmentDto(appointment));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load appointment' });
  }
});

// PUT /api/appointments/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    if (req.body.doctorName !== undefined) {
      appointment.doctorName = String(req.body.doctorName).trim();
    }
    if (req.body.specialty !== undefined) {
      appointment.specialty = String(req.body.specialty).trim();
    }
    if (req.body.clinicName !== undefined || req.body.clinic !== undefined) {
      appointment.clinicName = String(req.body.clinicName || req.body.clinic).trim();
    }

    const nextDate = resolveDate(req.body);
    if (nextDate) {
      appointment.date = nextDate;
    }

    if (req.body.reason !== undefined || req.body.notes !== undefined) {
      appointment.reason = String(req.body.reason ?? req.body.notes ?? '').trim();
    }
    if (req.body.reminderEnabled !== undefined) {
      appointment.reminderEnabled = Boolean(req.body.reminderEnabled);
    }
    if (req.body.address !== undefined) {
      appointment.address = String(req.body.address).trim();
    }
    if (req.body.meetingUrl !== undefined) {
      appointment.meetingUrl = String(req.body.meetingUrl).trim();
    }
    if (req.body.familyMember !== undefined || req.body.familyMemberId !== undefined) {
      appointment.familyMember = req.body.familyMember || req.body.familyMemberId || null;
    }

    if (req.body.status === 'cancelled') {
      appointment.status = 'cancelled';
    } else if (appointment.status !== 'cancelled') {
      appointment.status = deriveStatus(appointment);
    }

    await appointment.save();
    res.json(toAppointmentDto(appointment));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to update appointment' });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const appointment = await Appointment.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }

    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete appointment' });
  }
});

module.exports = router;
