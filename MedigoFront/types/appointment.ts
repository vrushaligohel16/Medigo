export type AppointmentStatus = 'upcoming' | 'past' | 'cancelled';

export type Appointment = {
  id: string;
  doctorName: string;
  specialty: string;
  /** ISO datetime — preferred field from the API */
  date: string;
  /** Alias of date for older UI callers */
  startsAt: string;
  clinic: string;
  address?: string;
  meetingUrl?: string;
  status: AppointmentStatus;
  notes?: string;
  reminderEnabled?: boolean;
  familyMemberId?: string;
};

export type CreateAppointmentInput = {
  doctorName: string;
  specialty: string;
  startsAt: string;
  clinic: string;
  address?: string;
  meetingUrl?: string;
  notes?: string;
  reminderEnabled?: boolean;
  familyMemberId?: string;
};
