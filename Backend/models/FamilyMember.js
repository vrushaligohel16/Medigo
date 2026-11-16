const mongoose = require('mongoose');

const RELATIONS = [
  'Self',
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Grandparent',
  'Other',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const familyMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    relation: {
      type: String,
      enum: RELATIONS,
      required: true,
      default: 'Other',
    },
    age: { type: Number, min: 0 },
    photo: { type: String, default: '' },
    bloodGroup: {
      type: String,
      enum: [...BLOOD_GROUPS, null],
      default: null,
    },
    allergies: { type: [String], default: [] },
    chronicConditions: { type: [String], default: [] },
    phone: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
module.exports.RELATIONS = RELATIONS;
module.exports.BLOOD_GROUPS = BLOOD_GROUPS;
