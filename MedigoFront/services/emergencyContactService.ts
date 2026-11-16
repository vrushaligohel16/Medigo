import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type {
  CreateEmergencyContactInput,
  EmergencyContact,
  SosAlertPayload,
  SosAlertResult,
} from '@/types/emergency';

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

function normalizeContact(raw: Record<string, unknown>): EmergencyContact {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: String(raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    relation: raw.relation ? String(raw.relation) : undefined,
  };
}

export const emergencyContactService = {
  async getAll(): Promise<EmergencyContact[]> {
    const response = await fetch(`${API_BASE_URL}/api/emergency-contacts`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to load emergency contacts.'),
      );
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { contacts?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.contacts ?? []);
    return list.map((item) => normalizeContact(item)).filter((item) => item.id);
  },

  async create(input: CreateEmergencyContactInput): Promise<EmergencyContact> {
    const response = await fetch(`${API_BASE_URL}/api/emergency-contacts`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        name: input.name.trim(),
        phone: input.phone.trim(),
        relation: input.relation?.trim() || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to create emergency contact.'),
      );
    }

    return normalizeContact((await response.json()) as Record<string, unknown>);
  },

  async update(
    id: string,
    input: CreateEmergencyContactInput,
  ): Promise<EmergencyContact> {
    const response = await fetch(`${API_BASE_URL}/api/emergency-contacts/${id}`, {
      method: 'PUT',
      headers: await authHeaders(),
      body: JSON.stringify({
        name: input.name.trim(),
        phone: input.phone.trim(),
        relation: input.relation?.trim() || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to update emergency contact.'),
      );
    }

    return normalizeContact((await response.json()) as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/emergency-contacts/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to delete emergency contact.'),
      );
    }
  },

  /** @deprecated Prefer delete() */
  async remove(id: string): Promise<void> {
    return this.delete(id);
  },

  /**
   * Sends SOS with device location to the backend.
   * Backend delivers SMS via Twilio when configured; otherwise returns 503 —
   * this method surfaces that honestly and never fakes success.
   */
  async triggerSos(payload: SosAlertPayload): Promise<SosAlertResult> {
    const response = await fetch(`${API_BASE_URL}/api/emergency-contacts/alert`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as SosAlertResult & {
      message?: string;
    };

    if (response.status === 503) {
      return {
        ok: false,
        configured: false,
        message:
          data.message ??
          'SOS SMS is not configured on the server. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER to enable real SMS delivery.',
        location: payload,
      };
    }

    if (!response.ok) {
      throw new Error(data.message ?? 'Unable to send SOS alert.');
    }

    return {
      ok: Boolean(data.ok),
      configured: data.configured !== false,
      message: data.message ?? 'SOS alert sent.',
      sentCount: data.sentCount,
      results: data.results,
      location: data.location ?? payload,
    };
  },
};
