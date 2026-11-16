const mongoose = require('mongoose');

const medicineSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    dosage: { type: String, required: true, trim: true },
    form: {
      type: String,
      enum: ['tablet', 'syrup', 'injection'],
      default: 'tablet',
    },
    frequency: { type: Number, default: 1, min: 1 },
    reminderTimes: { type: [String], default: [] },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    expiresAt: { type: Date },
    quantity: { type: Number, required: true, min: 0 },
    remainingQuantity: { type: Number, required: true, min: 0 },
    totalQuantity: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, default: '' },
    barcode: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['active', 'expiring', 'inactive'],
      default: 'active',
      index: true,
    },
    takenToday: { type: Boolean, default: false },
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
  },
  { timestamps: true },
);

medicineSchema.index({ user: 1, barcode: 1 });

module.exports = mongoose.model('Medicine', medicineSchema);
