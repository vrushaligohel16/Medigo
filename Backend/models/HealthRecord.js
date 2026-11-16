const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['bp', 'sugar', 'weight', 'water'],
      required: true,
      index: true,
    },
    // BP-specific
    systolic: { type: Number },
    diastolic: { type: Number },
    // Sugar / weight / water
    value: { type: Number },
    // Sugar-specific
    sugarContext: {
      type: String,
      enum: ['fasting', 'post-meal'],
    },
    unit: { type: String, required: true, trim: true },
    recordedAt: { type: Date, required: true, default: Date.now, index: true },
    notes: { type: String, trim: true, default: '' },
    familyMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
  },
  { timestamps: true },
);

healthRecordSchema.index({ user: 1, type: 1, recordedAt: -1 });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
