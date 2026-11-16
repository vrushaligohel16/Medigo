import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type {
  BloodGroup,
  CreateFamilyMemberInput,
  FamilyMember,
  FamilyRelation,
} from '@/types/family';

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

function resolvePhotoUrl(value: string | undefined | null): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return undefined;
  }
  if (
    /^https?:\/\//i.test(raw) ||
    raw.startsWith('file:') ||
    raw.startsWith('content:') ||
    raw.startsWith('ph://') ||
    raw.startsWith('assets-library:')
  ) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${API_BASE_URL}${raw}`;
  }
  return `${API_BASE_URL}/${raw}`;
}

function isLocalPhotoUri(uri: string | undefined): boolean {
  if (!uri) {
    return false;
  }
  return (
    uri.startsWith('file:') ||
    uri.startsWith('content:') ||
    uri.startsWith('ph://') ||
    uri.startsWith('assets-library:') ||
    (!uri.startsWith('http://') && !uri.startsWith('https://') && !uri.startsWith('/uploads/'))
  );
}

function normalizeMember(raw: Record<string, unknown>): FamilyMember {
  const count = Number(raw.medicineCount ?? raw.activeMedicinesCount ?? 0);
  const relation = String(raw.relation ?? 'Other') as FamilyRelation;
  const bloodGroup = raw.bloodGroup ? (String(raw.bloodGroup) as BloodGroup) : undefined;

  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: String(raw.name ?? ''),
    relation,
    avatarUrl: resolvePhotoUrl(
      String(raw.avatarUrl ?? raw.photo ?? ''),
    ),
    activeMedicinesCount: Number.isFinite(count) ? count : 0,
    medicineCount: Number.isFinite(count) ? count : 0,
    age: raw.age != null && raw.age !== '' ? Number(raw.age) : undefined,
    phone: raw.phone ? String(raw.phone) : undefined,
    bloodGroup,
    allergies: Array.isArray(raw.allergies)
      ? raw.allergies.map((item) => String(item))
      : [],
    chronicConditions: Array.isArray(raw.chronicConditions)
      ? raw.chronicConditions.map((item) => String(item))
      : [],
  };
}

function appendPhoto(formData: FormData, photoUri: string): void {
  const filename = photoUri.split('/').pop() ?? 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const ext = match?.[1]?.toLowerCase() ?? 'jpg';
  const type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

  formData.append('photo', {
    uri: photoUri,
    name: filename.includes('.') ? filename : `photo.${ext}`,
    type,
  } as unknown as Blob);
}

function buildFormData(input: CreateFamilyMemberInput): FormData {
  const formData = new FormData();
  formData.append('name', input.name);
  formData.append('relation', input.relation);
  if (input.age != null) {
    formData.append('age', String(input.age));
  }
  if (input.phone) {
    formData.append('phone', input.phone);
  }
  if (input.bloodGroup) {
    formData.append('bloodGroup', input.bloodGroup);
  }
  formData.append('allergies', JSON.stringify(input.allergies ?? []));
  formData.append('chronicConditions', JSON.stringify(input.chronicConditions ?? []));

  const photoUri = input.photoUri || input.avatarUrl;
  if (photoUri && isLocalPhotoUri(photoUri)) {
    appendPhoto(formData, photoUri);
  } else if (photoUri) {
    // Keep existing remote /uploads path without re-uploading.
    const relative = photoUri.replace(API_BASE_URL, '');
    formData.append('photo', relative.startsWith('/') ? relative : photoUri);
    formData.append('avatarUrl', relative.startsWith('/') ? relative : photoUri);
  }

  return formData;
}

export const familyService = {
  async getAll(): Promise<FamilyMember[]> {
    const response = await fetch(`${API_BASE_URL}/api/family`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load family members.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { members?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.members ?? []);
    return list.map((item) => normalizeMember(item)).filter((item) => item.id);
  },

  async getById(id: string): Promise<FamilyMember> {
    const response = await fetch(`${API_BASE_URL}/api/family/${id}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load family member.'));
    }

    return normalizeMember((await response.json()) as Record<string, unknown>);
  },

  async create(input: CreateFamilyMemberInput): Promise<FamilyMember> {
    const response = await fetch(`${API_BASE_URL}/api/family`, {
      method: 'POST',
      headers: await authHeaders(false),
      body: buildFormData(input),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to create family member.'));
    }

    return normalizeMember((await response.json()) as Record<string, unknown>);
  },

  async update(id: string, input: CreateFamilyMemberInput): Promise<FamilyMember> {
    const response = await fetch(`${API_BASE_URL}/api/family/${id}`, {
      method: 'PUT',
      headers: await authHeaders(false),
      body: buildFormData(input),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to update family member.'));
    }

    return normalizeMember((await response.json()) as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/family/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to delete family member.'));
    }
  },
};
