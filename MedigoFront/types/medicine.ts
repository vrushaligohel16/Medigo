export type MedicineStatus = 'active' | 'expiring' | 'inactive';

export type MedicineForm = 'tablet' | 'syrup' | 'injection';

export type MedicineLookupResult = {
  barcode: string;
  name: string;
  dosage?: string;
  form?: MedicineForm;
  quantity?: number;
  notes?: string;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  form: MedicineForm;
  frequency: number;
  reminderTimes: string[];
  startDate: string;
  endDate?: string;
  quantity: number;
  remainingQuantity: number;
  totalQuantity: number;
  notes?: string;
  nextReminderTime: string | null;
  takenToday: boolean;
  status: MedicineStatus;
  expiresAt?: string;
  familyMemberId?: string;
};

export type MedicineInput = {
  name: string;
  dosage: string;
  form: MedicineForm;
  frequency: number;
  reminderTimes: string[];
  startDate: string;
  endDate?: string;
  quantity: number;
  notes?: string;
  /** When set, medicine belongs to this family member (not the signed-in user alone). */
  familyMemberId?: string;
};

export type Reminder = {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  time: string;
  taken: boolean;
};

export type DoseStatus = 'pending' | 'taken' | 'skipped';

export type TodayReminder = {
  id: string;
  medicineId: string;
  medicineName: string;
  dosage: string;
  /** 24h time string, e.g. "08:00" */
  time: string;
  status: DoseStatus;
};

export type DoseLogPayload = {
  medicineId: string;
  reminderId: string;
  time: string;
  status: 'taken' | 'skipped';
};

export type MedicineExplanation = {
  whatItsFor: string;
  sideEffects: string[];
  precautions: string[];
};

export type InteractionSeverity = 'none' | 'mild' | 'severe';

export type InteractionResult = {
  id: string;
  medicines: string[];
  severity: InteractionSeverity;
  title: string;
  explanation: string;
};
