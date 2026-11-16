import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const AUTH_TOKEN_KEY = 'authToken';
export const USER_INFO_KEY = 'USER_INFO';
/** Legacy keys still read by Home / Profile until fully migrated */
export const USER_NAME_KEY = 'userName';
export const USER_EMAIL_KEY = 'userEmail';

const API_PORT = 5001;
const PRODUCTION_API_URL = 'https://medigo-backend-f5tx.onrender.com';

function isPrivateLanHost(host: string): boolean {
  return (
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

function hostFromUrl(url: string): string | null {
  const match = /^https?:\/\/([^/:]+)/i.exec(url);
  return match?.[1] ?? null;
}

function expoDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.linkingUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost ??
    (Constants as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (typeof hostUri !== 'string' || hostUri.length === 0) {
    return null;
  }

  // Examples: "192.168.1.12:8081", "exp://192.168.1.12:8081"
  const cleaned = hostUri.replace(/^exp:\/\//, '').replace(/^https?:\/\//, '');
  const host = cleaned.split(':')[0]?.split('/')[0];
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }
  return host;
}

/**
 * Resolve the MediGo API base URL.
 * - Prefer EXPO_PUBLIC_API_URL when set to a reachable host
 * - Otherwise default to the live Render backend URL
 */
function resolveApiBaseUrl(): string {
  const lanHost = expoDevHost();
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/$/, '');

  if (fromEnv) {
    const isLocalhost =
      /:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(fromEnv) ||
      fromEnv === 'localhost' ||
      fromEnv.startsWith('localhost:');

    // Physical device / Expo Go: localhost on the phone is NOT your computer.
    if (isLocalhost && lanHost) {
      return `http://${lanHost}:${API_PORT}`;
    }

    // Wi‑Fi DHCP can change the Mac IP. A stale private address in .env
    // (for example 192.168.1.12 while Expo is on 192.168.1.10) never reaches Express.
    const envHost = hostFromUrl(fromEnv);
    if (envHost && lanHost && envHost !== lanHost && isPrivateLanHost(envHost)) {
      return `http://${lanHost}:${API_PORT}`;
    }

    return fromEnv;
  }

  return PRODUCTION_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
