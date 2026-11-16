import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import type { ChatHistoryItem, ChatResponse } from '@/types/ai';
import type { MedicineExplanation } from '@/types/medicine';

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

function normalizeExplanation(raw: Record<string, unknown>): MedicineExplanation {
  const sideEffects = Array.isArray(raw.sideEffects)
    ? raw.sideEffects.map((item) => String(item))
    : [];
  const precautions = Array.isArray(raw.precautions)
    ? raw.precautions.map((item) => String(item))
    : [];

  return {
    whatItsFor: String(raw.whatItsFor ?? ''),
    sideEffects,
    precautions,
  };
}

export const aiService = {
  /**
   * POST /api/ai/explain-medicine
   * LLM calls can take several seconds — callers should show a loading state.
   */
  async explainMedicine(
    medicineName: string,
    medicineId?: string,
  ): Promise<MedicineExplanation> {
    const response = await fetch(`${API_BASE_URL}/api/ai/explain-medicine`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        medicineName,
        name: medicineName,
        ...(medicineId ? { medicineId } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(response, 'Unable to explain this medicine.'),
      );
    }

    const data = normalizeExplanation(
      (await response.json()) as Record<string, unknown>,
    );

    if (!data.whatItsFor.trim()) {
      throw new Error('AI explanation was empty. Please try again.');
    }

    return data;
  },

  /**
   * POST /api/ai/chat
   * Sends the new user message plus prior conversation history.
   */
  async chat(message: string, history: ChatHistoryItem[]): Promise<string> {
    const trimmed = message.trim();
    if (!trimmed) {
      throw new Error('Message is required.');
    }

    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        message: trimmed,
        history: history.map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, 'Unable to reach the AI assistant.'));
    }

    const data = (await response.json()) as
      | ChatResponse
      | { message?: string; content?: string; reply?: string };

    const reply =
      ('reply' in data && data.reply) ||
      ('message' in data && data.message) ||
      ('content' in data && data.content);

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('AI assistant returned an empty reply.');
    }

    return reply.trim();
  },
};
