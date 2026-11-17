import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import { normalizeStoredToken } from '@/services/authSession';
import type { ExtractedMedicine, Prescription } from '@/types/prescription';

async function authHeaders(json = true): Promise<HeadersInit> {
  const token = normalizeStoredToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
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

  const extractedText = raw.extractedText != null ? String(raw.extractedText) : '';
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
    notes: raw.notes ? String(raw.notes) : extractedText || undefined,
    extractedText: extractedText || undefined,
  };
}

function imageMeta(imageUri: string, options?: { mimeType?: string | null; fileName?: string | null }) {
  const rawName =
    options?.fileName || imageUri.split('/').pop()?.split('?')[0] || 'prescription.jpg';
  const match = /\.(\w+)$/.exec(rawName);
  const ext = (match?.[1] ?? 'jpg').toLowerCase();
  const mimeType =
    options?.mimeType && options.mimeType.startsWith('image/')
      ? options.mimeType
      : ext === 'png'
        ? 'image/png'
        : 'image/jpeg';
  const filename = rawName.includes('.')
    ? rawName
    : `prescription.${ext === 'png' ? 'png' : 'jpg'}`;
  return { filename, mimeType };
}

async function buildImageFormData(
  imageUri: string,
  options?: { mimeType?: string | null; fileName?: string | null },
): Promise<FormData> {
  const { filename, mimeType } = imageMeta(imageUri, options);
  const formData = new FormData();

  try {
    const fileResponse = await fetch(imageUri);
    const blob = await fileResponse.blob();
    const typedBlob =
      blob.type && blob.type.startsWith('image/')
        ? blob
        : blob.slice(0, blob.size, mimeType);
    formData.append('image', typedBlob, filename);
  } catch {
    formData.append('image', {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  return formData;
}

async function postMultipart(
  url: string,
  formData: FormData,
): Promise<{ status: number; bodyText: string }> {
  const token = normalizeStoredToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });
    return { status: response.status, bodyText: await response.text() };
  } catch {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Accept', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.timeout = 60000;
      xhr.onload = () =>
        resolve({ status: xhr.status, bodyText: String(xhr.responseText || '') });
      xhr.onerror = () => reject(new TypeError('Network request failed'));
      xhr.ontimeout = () => reject(new TypeError('Network request failed'));
      xhr.send(formData);
    });
  }
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
  async upload(
    imageUri: string,
    options?: { mimeType?: string | null; fileName?: string | null },
  ): Promise<Prescription> {
    const formData = await buildImageFormData(imageUri, options);
    const url = `${API_BASE_URL}/api/prescriptions/upload`;

    let status = 0;
    let bodyText = '';
    try {
      const result = await postMultipart(url, formData);
      status = result.status;
      bodyText = result.bodyText;
    } catch {
      throw new Error('Unable to reach the server. Please try again.');
    }

    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(bodyText) as Record<string, unknown>;
    } catch {
      body = {};
    }

    if (status < 200 || status >= 300) {
      throw new Error(
        String(body.message ?? body.error ?? 'Unable to upload prescription.'),
      );
    }

    return normalizePrescription(body);
  },

  async update(
    id: string,
    input: {
      doctorName?: string;
      medicines?: ExtractedMedicine[];
      extractedText?: string;
    },
  ): Promise<Prescription> {
    const response = await fetch(`${API_BASE_URL}/api/prescriptions/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({
        doctorName: input.doctorName,
        medicines: input.medicines?.map((item) => ({
          name: item.name,
          dosage: item.dosage,
        })),
        extractedText: input.extractedText,
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to update prescription.'));
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
