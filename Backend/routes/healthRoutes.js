const express = require('express');
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const HealthRecord = require('../models/HealthRecord');

const router = express.Router();

const VALID_TYPES = new Set(['bp', 'sugar', 'weight', 'water']);

const DEFAULT_UNITS = {
  bp: 'mmHg',
  sugar: 'mg/dL',
  weight: 'kg',
  water: 'ml',
};

function toRecordDto(doc) {
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

function validateTypePayload(body) {
  const { type } = body;

  if (!VALID_TYPES.has(type)) {
    return 'type must be one of: bp, sugar, weight, water';
  }

  if (type === 'bp') {
    if (body.systolic == null || body.diastolic == null) {
      return 'systolic and diastolic are required for bp records';
    }
  } else if (body.value == null) {
    return 'value is required for sugar, weight, and water records';
  }

  if (type === 'sugar' && body.sugarContext) {
    if (body.sugarContext !== 'fasting' && body.sugarContext !== 'post-meal') {
      return 'sugarContext must be fasting or post-meal';
    }
  }

  return null;
}

function parseDateBound(value, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function metricNumericValue(record) {
  if (record.type === 'bp') {
    return record.systolic ?? 0;
  }
  return record.value ?? 0;
}

function formatLatestValue(record) {
  if (record.type === 'bp') {
    return `${record.systolic ?? '—'}/${record.diastolic ?? '—'}`;
  }
  if (record.type === 'weight') {
    return Number(record.value ?? 0).toFixed(1);
  }
  return String(record.value ?? 0);
}

function computeTrend(values) {
  if (values.length < 2) return 'flat';
  const latest = values[values.length - 1];
  const previous = values[values.length - 2];
  const delta = latest - previous;
  if (Math.abs(delta) < 0.05) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

// GET /api/health/summaries — dashboard cards (kept for the mobile app)
router.get('/summaries', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    if (req.query.familyMemberId) {
      filter.familyMember = req.query.familyMemberId;
    }

    const records = await HealthRecord.find(filter).sort({
      recordedAt: 1,
    });

    const titles = {
      bp: 'Blood Pressure',
      sugar: 'Blood Sugar',
      weight: 'Weight',
      water: 'Water Intake',
    };

    const summaries = ['bp', 'sugar', 'weight', 'water'].map((type) => {
      const typed = records.filter((item) => item.type === type);
      const sparkline = typed.map(metricNumericValue);
      const latest = typed[typed.length - 1];

      return {
        type,
        title: titles[type],
        latestValue: latest ? formatLatestValue(latest) : '—',
        unit: latest?.unit ?? DEFAULT_UNITS[type],
        trend: computeTrend(sparkline),
        sparkline: sparkline.length > 0 ? sparkline : [0],
      };
    });

    res.json(summaries);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load summaries' });
  }
});

// GET /api/health — list records (optional familyMemberId / type filters)
router.get('/', protect, async (req, res) => {
  try {
    const filter = { user: req.user._id };

    if (req.query.familyMemberId) {
      filter.familyMember = req.query.familyMemberId;
    }

    if (req.query.type && VALID_TYPES.has(String(req.query.type))) {
      filter.type = String(req.query.type);
    }

    const records = await HealthRecord.find(filter).sort({ recordedAt: -1 });
    res.json(records.map(toRecordDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load health records' });
  }
});

// POST /api/health — add record
router.post('/', protect, async (req, res) => {
  try {
    const error = validateTypePayload(req.body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    const type = req.body.type;
    const record = await HealthRecord.create({
      user: req.user._id,
      type,
      systolic: type === 'bp' ? Number(req.body.systolic) : undefined,
      diastolic: type === 'bp' ? Number(req.body.diastolic) : undefined,
      value: type !== 'bp' ? Number(req.body.value) : undefined,
      sugarContext: type === 'sugar' ? req.body.sugarContext : undefined,
      unit: req.body.unit || DEFAULT_UNITS[type],
      recordedAt: req.body.recordedAt ? new Date(req.body.recordedAt) : new Date(),
      notes: req.body.notes?.trim?.() || '',
      familyMember: req.body.familyMember || req.body.familyMemberId || null,
    });

    res.status(201).json(toRecordDto(record));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to add health record' });
  }
});

// GET /api/health/:type — list by type with optional date range (?from=&to=)
router.get('/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({
        message: 'type must be one of: bp, sugar, weight, water',
      });
    }

    const filter = { user: req.user._id, type };
    const from = parseDateBound(req.query.from || req.query.start);
    const to = parseDateBound(req.query.to || req.query.end, true);

    if (from || to) {
      filter.recordedAt = {};
      if (from) filter.recordedAt.$gte = from;
      if (to) filter.recordedAt.$lte = to;
    }

    if (req.query.familyMemberId) {
      filter.familyMember = req.query.familyMemberId;
    }

    const limitRaw = Number(req.query.limit);
    const limit =
      Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(Math.floor(limitRaw), 500)
        : 0;

    let query = HealthRecord.find(filter).sort({ recordedAt: -1 });
    if (limit > 0) {
      query = query.limit(limit);
    }

    const records = await query;
    res.json(records.map(toRecordDto));
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to load health records' });
  }
});

// DELETE /api/health/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid record id' });
    }

    const record = await HealthRecord.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!record) {
      return res.status(404).json({ message: 'Health record not found' });
    }

    res.json({ message: 'Health record deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Unable to delete health record' });
  }
});

module.exports = router;
