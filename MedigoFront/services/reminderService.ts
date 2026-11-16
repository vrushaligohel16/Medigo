import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type { DoseStatus, TodayReminder } from '@/types/medicine';

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

function timeToMinutes(time: string): number {
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function normalizeTime24(value: string): string {
  const trimmed = value.trim();
  const match24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (match24) {
    return `${match24[1].padStart(2, '0')}:${match24[2]}`;
  }

  const match12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(trimmed);
  if (!match12) {
    return trimmed || '08:00';
  }

  let hour = Number(match12[1]);
  const minute = match12[2];
  const suffix = match12[3].toUpperCase();

  if (suffix === 'PM' && hour < 12) {
    hour += 12;
  }
  if (suffix === 'AM' && hour === 12) {
    hour = 0;
  }

  return `${hour.toString().padStart(2, '0')}:${minute}`;
}

function normalizeReminder(raw: Record<string, unknown>): TodayReminder {
  const statusRaw = String(raw.status ?? 'pending');
  const status: DoseStatus =
    statusRaw === 'taken' || statusRaw === 'skipped' ? statusRaw : 'pending';

  return {
    id: String(raw.id ?? raw._id ?? ''),
    medicineId: String(raw.medicineId ?? raw.medicine ?? ''),
    medicineName: String(raw.medicineName ?? ''),
    dosage: String(raw.dosage ?? ''),
    time: normalizeTime24(String(raw.time ?? '08:00')),
    status,
  };
}

export const reminderService = {
  async getToday(): Promise<TodayReminder[]> {
    const response = await fetch(`${API_BASE_URL}/api/reminders`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load reminders.'));
    }

    const data = (await response.json()) as
      | TodayReminder[]
      | { reminders?: TodayReminder[] };

    const list = Array.isArray(data) ? data : (data.reminders ?? []);

    return list
      .map((item) => normalizeReminder(item as unknown as Record<string, unknown>))
      .filter((item) => item.id)
      .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  },

  async updateStatus(
    id: string,
    status: Exclude<DoseStatus, 'pending'>,
  ): Promise<TodayReminder> {
    const response = await fetch(`${API_BASE_URL}/api/reminders/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to update reminder status.'),
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return normalizeReminder(data);
  },
};
