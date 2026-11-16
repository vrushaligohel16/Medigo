import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type {
  AddHealthRecordInput,
  DailyProgress,
  HealthHistoryRange,
  HealthMetricRecord,
  HealthMetricType,
  HealthRecord,
} from '@/types/health';

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

export const METRIC_META: Record<
  HealthMetricType,
  { title: string; unit: string }
> = {
  bp: { title: 'Blood Pressure', unit: 'mmHg' },
  sugar: { title: 'Blood Sugar', unit: 'mg/dL' },
  weight: { title: 'Weight', unit: 'kg' },
  water: { title: 'Water Intake', unit: 'ml' },
};

function normalizeRecord(raw: Record<string, unknown>): HealthMetricRecord {
  const type = String(raw.type ?? 'weight') as HealthMetricType;
  return {
    id: String(raw.id ?? raw._id ?? ''),
    type,
    systolic: raw.systolic != null ? Number(raw.systolic) : undefined,
    diastolic: raw.diastolic != null ? Number(raw.diastolic) : undefined,
    value: raw.value != null ? Number(raw.value) : undefined,
    sugarContext:
      raw.sugarContext === 'fasting' || raw.sugarContext === 'post-meal'
        ? raw.sugarContext
        : undefined,
    unit: String(raw.unit ?? METRIC_META[type]?.unit ?? ''),
    recordedAt: String(raw.recordedAt ?? new Date().toISOString()),
    notes: raw.notes ? String(raw.notes) : undefined,
    familyMemberId: raw.familyMemberId
      ? String(raw.familyMemberId)
      : raw.familyMember
        ? String(raw.familyMember)
        : undefined,
  };
}

function rangeToFromDate(range: HealthHistoryRange): string {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (range - 1));
  return from.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatMetricValue(record: HealthMetricRecord): string {
  if (record.type === 'bp') {
    return `${record.systolic ?? '—'}/${record.diastolic ?? '—'}`;
  }
  if (record.type === 'weight') {
    return (record.value ?? 0).toFixed(1);
  }
  return String(record.value ?? 0);
}

function toRecentListItem(record: HealthMetricRecord): HealthRecord {
  const meta = METRIC_META[record.type];
  return {
    id: record.id,
    title: meta.title,
    value: formatMetricValue(record),
    unit: record.unit,
    recordedAt: new Date(record.recordedAt).toLocaleString(),
    category: record.type === 'sugar' ? 'lab' : 'vitals',
  };
}

export const healthService = {
  async getAll(options?: { familyMemberId?: string }): Promise<HealthMetricRecord[]> {
    const params = new URLSearchParams();
    if (options?.familyMemberId) {
      params.set('familyMemberId', options.familyMemberId);
    }
    const query = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(`${API_BASE_URL}/api/health${query}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load health records.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { records?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.records ?? []);
    return list
      .map((item) => normalizeRecord(item))
      .filter((item) => item.id)
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
  },

  async getLatest(type: HealthMetricType): Promise<HealthMetricRecord | null> {
    const response = await fetch(
      `${API_BASE_URL}/api/health/${type}?limit=1`,
      { headers: await authHeaders() },
    );

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load latest reading.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { records?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.records ?? []);
    if (list.length === 0) {
      return null;
    }

    return normalizeRecord(list[0]);
  },

  async getRecordsByType(
    type: HealthMetricType,
    range?: HealthHistoryRange,
  ): Promise<HealthMetricRecord[]> {
    const params = new URLSearchParams();
    if (range) {
      params.set('from', rangeToFromDate(range));
      params.set('to', todayKey());
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${API_BASE_URL}/api/health/${type}${query}`, {
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to load health history.'));
    }

    const data = (await response.json()) as
      | Record<string, unknown>[]
      | { records?: Record<string, unknown>[] };

    const list = Array.isArray(data) ? data : (data.records ?? []);
    return list
      .map((item) => normalizeRecord(item))
      .filter((item) => item.id)
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
  },

  async addRecord(input: AddHealthRecordInput): Promise<HealthMetricRecord> {
    const unit = METRIC_META[input.type].unit;
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ ...input, unit }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to save health record.'));
    }

    return normalizeRecord((await response.json()) as Record<string, unknown>);
  },

  async deleteRecord(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/health/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to delete health record.'));
    }
  },

  /** Recent list items for Home / legacy callers — built from latest per type. */
  async getRecords(): Promise<HealthRecord[]> {
    const types: HealthMetricType[] = ['bp', 'sugar', 'weight', 'water'];
    const latest = await Promise.all(
      types.map(async (type) => {
        try {
          return await this.getLatest(type);
        } catch {
          return null;
        }
      }),
    );

    return latest
      .filter((item): item is HealthMetricRecord => item != null)
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      )
      .map(toRecentListItem);
  },

  /** Home water chip — today’s water total from water records. */
  async getDailyProgress(): Promise<DailyProgress> {
    let waterMl = 0;
    try {
      const waterToday = await this.getRecordsByType('water', 7);
      const key = todayKey();
      waterMl = waterToday
        .filter((item) => item.recordedAt.slice(0, 10) === key)
        .reduce((sum, item) => sum + (item.value ?? 0), 0);
    } catch {
      waterMl = 0;
    }

    return {
      medicinesTaken: 0,
      medicinesTotal: 0,
      steps: 0,
      waterMl,
      waterGoalMl: 2500,
    };
  },

  /** Used by familyService fallback — all types, last 90 days. */
  async getMetricHistory(type?: HealthMetricType): Promise<HealthMetricRecord[]> {
    if (type) {
      return this.getRecordsByType(type, 90);
    }

    const types: HealthMetricType[] = ['bp', 'sugar', 'weight', 'water'];
    const batches = await Promise.all(
      types.map((metric) => this.getRecordsByType(metric, 90)),
    );
    return batches
      .flat()
      .sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      );
  },
};
