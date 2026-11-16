const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    doctorName: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    clinicName: { type: String, required: true, trim: true },
    date: { type: Date, required: true, index: true },
    reason: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['upcoming', 'past', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    reminderEnabled: { type: Boolean, default: true },
    address: { type: String, trim: true, default: '' },
    meetingUrl: { type: String, trim: true, default: '' },
    familyMember: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FamilyMember',
      default: null,
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
