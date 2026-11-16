import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import { normalizeStoredToken, notifyUnauthorized } from '@/services/authSession';
import type {
  Medicine,
  MedicineInput,
  MedicineLookupResult,
  InteractionResult,
  TodayReminder,
  DoseLogPayload,
} from '@/types/medicine';

async function authHeaders(): Promise<HeadersInit> {
  const token = normalizeStoredToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(expiryDate: string): number {
  const expiry = startOfDay(new Date(expiryDate));
  const today = startOfDay(new Date());
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function filterExpiringSoon(medicines: Medicine[], withinDays = 30): Medicine[] {
  return medicines
    .filter((medicine) => {
      const expiry = medicine.expiresAt ?? medicine.endDate;
      if (!expiry) {
        return false;
      }
      const remaining = daysUntil(expiry);
      return remaining >= 0 && remaining <= withinDays;
    })
    .sort((a, b) => {
      const aTime = new Date((a.expiresAt ?? a.endDate) as string).getTime();
      const bTime = new Date((b.expiresAt ?? b.endDate) as string).getTime();
      return aTime - bTime;
    });
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
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
    return '08:00';
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

function buildTodayReminders(medicines: Medicine[]): TodayReminder[] {
  const reminders: TodayReminder[] = [];

  for (const medicine of medicines) {
    const times =
      medicine.reminderTimes.length > 0
        ? medicine.reminderTimes
        : medicine.nextReminderTime
          ? [medicine.nextReminderTime]
          : [];

    times.forEach((time, index) => {
      const normalized = normalizeTime24(time);
      reminders.push({
        id: `${medicine.id}-${normalized}-${index}`,
        medicineId: medicine.id,
        medicineName: medicine.name,
        dosage: medicine.dosage,
        time: normalized,
        status: medicine.takenToday && index === 0 ? 'taken' : 'pending',
      });
    });
  }

  return reminders.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

export function formatReminderTime(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

export function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export { timeToMinutes };

export const medicineService = {
  async getAll(options?: { familyMemberId?: string }): Promise<Medicine[]> {
    const params = new URLSearchParams();
    if (options?.familyMemberId) {
      params.set('familyMemberId', options.familyMemberId);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/medicines${query}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load medicines.'));
    }

    const data = (await response.json()) as Medicine[] | { medicines?: Medicine[] };
    return Array.isArray(data) ? data : (data.medicines ?? []);
  },

  async getById(id: string): Promise<Medicine | null> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/${id}`, {
      headers: await authHeaders(),
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load medicine.'));
    }

    return (await response.json()) as Medicine;
  },

  async lookupByBarcode(barcode: string): Promise<MedicineLookupResult> {
    const response = await fetch(
      `${API_BASE_URL}/api/medicines/lookup?barcode=${encodeURIComponent(barcode)}`,
      {
        headers: await authHeaders(),
      },
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'No medicine found for this barcode.'),
      );
    }

    const data = (await response.json()) as MedicineLookupResult;
    return {
      barcode,
      name: data.name,
      dosage: data.dosage,
      form: data.form,
      quantity: data.quantity,
      notes: data.notes,
    };
  },

  async create(input: MedicineInput): Promise<Medicine> {
    const response = await fetch(`${API_BASE_URL}/api/medicines`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });

    if (response.status === 401) {
      notifyUnauthorized();
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to create medicine.'));
    }

    return (await response.json()) as Medicine;
  },

  async update(id: string, input: MedicineInput): Promise<Medicine> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });

    if (response.status === 401) {
      notifyUnauthorized();
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to update medicine.'));
    }

    return (await response.json()) as Medicine;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to delete medicine.'));
    }
  },

  async markTaken(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/${id}/taken`, {
      method: 'POST',
      headers: await authHeaders(),
    });

    // Endpoint may not exist yet — don't block the UI
    if (!response.ok && response.status !== 404) {
      throw new Error(await readErrorMessage(response, 'Unable to mark as taken.'));
    }
  },

  async checkInteractions(medicineNames: string[]): Promise<InteractionResult[]> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/check-interactions`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ medicines: medicineNames }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to check interactions right now.'),
      );
    }

    const data = (await response.json()) as
      | InteractionResult[]
      | { interactions?: InteractionResult[] };

    if (Array.isArray(data)) {
      return data;
    }

    return data.interactions ?? [];
  },

  async getExpiringSoon(): Promise<Medicine[]> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/expiring-soon`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      // Fallback: filter from full list if dedicated route fails
      const all = await medicineService.getAll();
      return filterExpiringSoon(all);
    }

    const data = (await response.json()) as Medicine[] | { medicines?: Medicine[] };
    const list = Array.isArray(data) ? data : (data.medicines ?? []);
    return filterExpiringSoon(list);
  },

  async markAsRefilled(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/medicines/${id}/refilled`, {
      method: 'POST',
      headers: await authHeaders(),
    });

    if (response.ok || response.status === 404) {
      // If route missing, update via PUT with active status using current medicine
      if (response.status === 404) {
        const medicine = await medicineService.getById(id);
        if (!medicine) {
          throw new Error('Medicine not found.');
        }
        await medicineService.update(id, {
          name: medicine.name,
          dosage: medicine.dosage,
          form: medicine.form,
          frequency: medicine.frequency,
          reminderTimes: medicine.reminderTimes,
          startDate: medicine.startDate,
          endDate: medicine.endDate,
          quantity: medicine.totalQuantity,
          notes: medicine.notes,
        });
      }
      return;
    }

    throw new Error(await readErrorMessage(response, 'Unable to mark as refilled.'));
  },

  async getTodayReminders(): Promise<TodayReminder[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders`, {
        headers: await authHeaders(),
      });

      if (response.ok) {
        const data = (await response.json()) as
          | TodayReminder[]
          | { reminders?: TodayReminder[] };
        const list = Array.isArray(data) ? data : (data.reminders ?? []);
        return list
          .map((item) => ({
            ...item,
            time: normalizeTime24(item.time),
          }))
          .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
      }
    } catch {
      // Fall through to derived reminders from medicines.
    }

    const medicines = await medicineService.getAll();
    return buildTodayReminders(medicines);
  },

  async logDose(payload: DoseLogPayload): Promise<void> {
    // Prefer reminders PATCH when reminderId looks like a Mongo id
    const reminderResponse = await fetch(
      `${API_BASE_URL}/api/reminders/${payload.reminderId}`,
      {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ status: payload.status }),
      },
    );

    if (reminderResponse.ok) {
      return;
    }

    const response = await fetch(`${API_BASE_URL}/api/medicines/log-dose`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(await readErrorMessage(response, 'Unable to log dose.'));
    }
  },
};
