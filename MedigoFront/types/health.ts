export type HealthRecord = {
  id: string;
  title: string;
  value: string;
  unit?: string;
  recordedAt: string;
  category: 'vitals' | 'lab' | 'symptom' | 'other';
};

export type DailyProgress = {
  medicinesTaken: number;
  medicinesTotal: number;
  steps: number;
  waterMl: number;
  waterGoalMl: number;
};

export type HealthMetricType = 'bp' | 'sugar' | 'weight' | 'water';

export type SugarContext = 'fasting' | 'post-meal';

export type HealthMetricRecord = {
  id: string;
  type: HealthMetricType;
  systolic?: number;
  diastolic?: number;
  value?: number;
  sugarContext?: SugarContext;
  unit: string;
  recordedAt: string;
  notes?: string;
  familyMemberId?: string;
};

export type AddHealthRecordInput = {
  type: HealthMetricType;
  systolic?: number;
  diastolic?: number;
  value?: number;
  sugarContext?: SugarContext;
  recordedAt: string;
  notes?: string;
};

export type HealthTrend = 'up' | 'down' | 'flat';

export type HealthHistoryRange = 7 | 30 | 90;

export type HealthSummaryCard = {
  type: HealthMetricType;
  title: string;
  latestValue: string;
  unit: string;
  trend: HealthTrend;
  sparkline: number[];
};
