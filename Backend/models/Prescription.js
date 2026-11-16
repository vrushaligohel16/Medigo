const mongoose = require('mongoose');

const extractedMedicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dosage: { type: String, trim: true, default: '' },
  },
  { _id: true },
);

const prescriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    familyMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
    imageUrl: { type: String, required: true },
    doctorName: { type: String, trim: true, default: '' },
    extractedText: { type: String, default: '' },
    extractedMedicines: { type: [extractedMedicineSchema], default: [] },
    dateIssued: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Prescription', prescriptionSchema);
