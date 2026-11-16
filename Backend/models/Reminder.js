const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    medicine: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
      index: true,
    },
    medicineName: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    /** 24h time string, e.g. "08:00" */
    time: { type: String, required: true },
    /** Calendar day for this dose occurrence, YYYY-MM-DD */
    date: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'taken', 'skipped'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

reminderSchema.index({ user: 1, date: 1 });
reminderSchema.index(
  { user: 1, medicine: 1, date: 1, time: 1 },
  { unique: true },
);

module.exports = mongoose.model('Reminder', reminderSchema);
