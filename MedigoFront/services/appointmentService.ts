import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type { Appointment, CreateAppointmentInput } from '@/types/appointment';

async function authHeaders(): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

function deriveStatus(appointment: {
  status?: string;
  date?: string;
  startsAt?: string;
}): Appointment['status'] {
  if (appointment.status === 'cancelled') {
    return 'cancelled';
  }
  const when = appointment.date || appointment.startsAt || '';
  const isPast = new Date(when).getTime() < Date.now();
  return isPast ? 'past' : 'upcoming';
}

function normalizeAppointment(raw: Record<string, unknown>): Appointment {
  const dateIso = String(raw.date ?? raw.startsAt ?? new Date().toISOString());
  const clinic = String(raw.clinic ?? raw.clinicName ?? '');

  return {
    id: String(raw.id ?? raw._id ?? ''),
    doctorName: String(raw.doctorName ?? ''),
    specialty: String(raw.specialty ?? ''),
    date: dateIso,
    startsAt: dateIso,
    clinic,
    address: raw.address ? String(raw.address) : undefined,
    meetingUrl: raw.meetingUrl ? String(raw.meetingUrl) : undefined,
    status: deriveStatus({
      status: raw.status ? String(raw.status) : undefined,
      date: dateIso,
    }),
    notes: raw.notes
      ? String(raw.notes)
      : raw.reason
        ? String(raw.reason)
        : undefined,
    reminderEnabled:
      raw.reminderEnabled === undefined ? true : Boolean(raw.reminderEnabled),
    familyMemberId: raw.familyMemberId
      ? String(raw.familyMemberId)
      : raw.familyMember
        ? String(raw.familyMember)
        : undefined,
  };
}

function toApiBody(input: CreateAppointmentInput) {
  return {
    doctorName: input.doctorName,
    specialty: input.specialty,
    clinicName: input.clinic,
    clinic: input.clinic,
    date: input.startsAt,
    startsAt: input.startsAt,
    reason: input.notes,
    notes: input.notes,
    reminderEnabled: input.reminderEnabled,
    address: input.address,
    meetingUrl: input.meetingUrl,
    familyMemberId: input.familyMemberId,
  };
}

export const appointmentService = {
  async getAll(options?: { familyMemberId?: string }): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (options?.familyMemberId) {
      params.set('familyMemberId', options.familyMemberId);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/appointments${query}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load appointments.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | {
          appointments?: Record<string, unknown>[];
          upcoming?: Record<string, unknown>[];
          past?: Record<string, unknown>[];
        };

    let list: Record<string, unknown>[] = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (Array.isArray(data.appointments)) {
      list = data.appointments;
    } else {
      list = [...(data.upcoming ?? []), ...(data.past ?? [])];
    }

    return list
      .map((item) => normalizeAppointment(item))
      .filter((item) => item.id)
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      );
  },

  async getById(id: string): Promise<Appointment> {
    const response = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load appointment.'));
    }

    return normalizeAppointment((await response.json()) as Record<string, unknown>);
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    const response = await fetch(`${API_BASE_URL}/api/appointments`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(toApiBody(input)),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to create appointment.'));
    }

    return normalizeAppointment((await response.json()) as Record<string, unknown>);
  },

  async update(id: string, input: CreateAppointmentInput): Promise<Appointment> {
    const response = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(toApiBody(input)),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to update appointment.'));
    }

    return normalizeAppointment((await response.json()) as Record<string, unknown>);
  },

  async cancel(id: string): Promise<Appointment> {
    const response = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({ status: 'cancelled' }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to cancel appointment.'));
    }

    return normalizeAppointment((await response.json()) as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/appointments/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to delete appointment.'));
    }
  },
};
