import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type { ExtractedMedicine, Prescription } from '@/types/prescription';

async function authHeaders(json = true): Promise<HeadersInit> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
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

function resolveImageUrl(value: string | undefined | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  if (/^https?:\/\//i.test(raw) || raw.startsWith('file:') || raw.startsWith('content:')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${API_BASE_URL}${raw}`;
  }
  return `${API_BASE_URL}/${raw}`;
}

function normalizeMedicine(
  raw: Record<string, unknown>,
  index: number,
): ExtractedMedicine {
  return {
    id: String(raw.id ?? raw._id ?? `med-${index}`),
    name: String(raw.name ?? ''),
    dosage: String(raw.dosage ?? ''),
  };
}

function normalizePrescription(raw: Record<string, unknown>): Prescription {
  const medicinesRaw = Array.isArray(raw.medicines)
    ? raw.medicines
    : Array.isArray(raw.extractedMedicines)
      ? raw.extractedMedicines
      : [];

  return {
    id: String(raw.id ?? raw._id ?? ''),
    imageUrl: resolveImageUrl(String(raw.imageUrl ?? '')),
    doctorName: String(raw.doctorName ?? ''),
    uploadedAt: String(
      raw.uploadedAt ?? raw.createdAt ?? raw.dateIssued ?? new Date().toISOString(),
    ),
    medicines: medicinesRaw.map((item, index) =>
      normalizeMedicine(item as Record<string, unknown>, index),
    ),
    notes: raw.notes ? String(raw.notes) : undefined,
  };
}

function appendImageToFormData(formData: FormData, imageUri: string): void {
  const filename = imageUri.split('/').pop() ?? 'prescription.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase() ?? 'jpg';
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  formData.append('image', {
    uri: imageUri,
    name: filename.includes('.') ? filename : `prescription.${ext}`,
    type,
  } as unknown as Blob);
}

export const prescriptionService = {
  async getAll(): Promise<Prescription[]> {
    const response = await fetch(`${API_BASE_URL}/api/prescriptions`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load prescriptions.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { prescriptions?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.prescriptions ?? []);
    return list
      .map((item) => normalizePrescription(item))
      .filter((item) => item.id);
  },

  async getById(id: string): Promise<Prescription> {
    const response = await fetch(`${API_BASE_URL}/api/prescriptions/${id}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load prescription.'));
    }

    return normalizePrescription((await response.json()) as Record<string, unknown>);
  },

  /**
   * Upload image to /api/prescriptions/upload — runs OCR and persists the prescription.
   */
  async upload(imageUri: string): Promise<Prescription> {
    const formData = new FormData();
    appendImageToFormData(formData, imageUri);

    const response = await fetch(`${API_BASE_URL}/api/prescriptions/upload`, {
      method: 'POST',
      headers: await authHeaders(false),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to upload prescription.'));
    }

    return normalizePrescription((await response.json()) as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/prescriptions/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to delete prescription.'));
    }
  },
};
