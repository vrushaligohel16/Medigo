import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, AUTH_TOKEN_KEY } from '@/constants/config';
import { normalizeStoredToken } from '@/services/authSession';
import type {
  AuthSession,
  AuthUser,
  LoginCredentials,
  SignupData,
} from '@/types/auth';

export type { AuthSession, AuthUser, LoginCredentials, SignupData };

export class AuthError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

async function parseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? fallback;
  } catch {
    return fallback;
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const token = normalizeStoredToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function normalizeUser(raw: Record<string, unknown>, fallbackEmail?: string): AuthUser {
  const avatarRaw = raw.avatar != null ? String(raw.avatar) : '';
  let avatar: string | undefined;
  if (avatarRaw) {
    if (
      avatarRaw.startsWith('http://') ||
      avatarRaw.startsWith('https://') ||
      avatarRaw.startsWith('file:')
    ) {
      avatar = avatarRaw;
    } else if (avatarRaw.startsWith('/')) {
      avatar = `${API_BASE_URL}${avatarRaw}`;
    } else {
      avatar = `${API_BASE_URL}/${avatarRaw}`;
    }
  }

  return {
    id: String(raw.id ?? raw._id ?? ''),
    fullName: String(raw.fullName ?? raw.name ?? ''),
    email: String(raw.email ?? fallbackEmail ?? ''),
    phone: raw.phone != null ? String(raw.phone) : undefined,
    avatar,
  };
}

function parseSession(
  data: {
    token?: string;
    accessToken?: string;
    jwt?: string;
    user?: Record<string, unknown>;
  },
  fallbackEmail?: string,
): AuthSession {
  const token = data.token ?? data.accessToken ?? data.jwt;
  if (!token) {
    throw new AuthError('Authentication succeeded but no token was returned.');
  }

  if (!data.user) {
    throw new AuthError('Authentication succeeded but no user was returned.');
  }

  return {
    token,
    user: normalizeUser(data.user, fallbackEmail),
  };
}

export const authService = {
  /**
   * Creates a user account. Does not write to AsyncStorage or establish a session.
   */
  async signup(data: SignupData): Promise<{ user: AuthUser }> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          password: data.password,
        }),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      throw new AuthError(
        await parseErrorMessage(response, 'Signup failed. Please try again.'),
        response.status,
      );
    }

    const body = (await response.json()) as {
      user?: Record<string, unknown>;
    };

    const user = body.user
      ? normalizeUser(body.user, data.email)
      : {
          id: '',
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
        };

    return { user };
  },

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthError('Invalid email or password', 401);
      }

      throw new AuthError(
        await parseErrorMessage(response, 'Login failed. Please try again.'),
        response.status,
      );
    }

    const body = (await response.json()) as {
      token?: string;
      accessToken?: string;
      jwt?: string;
      user?: Record<string, unknown>;
    };

    return parseSession(body, credentials.email);
  },

  async resetPassword(token: string, password: string): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ token, password }),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      throw new AuthError(
        await parseErrorMessage(response, 'Unable to reset password.'),
        response.status,
      );
    }
  },

  async forgotPassword(email: string): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      throw new AuthError(
        await parseErrorMessage(
          response,
          'Unable to send reset link. Please try again.',
        ),
        response.status,
      );
    }
  },

  async getMe(): Promise<AuthUser> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: await authHeaders(),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      throw new AuthError(
        await parseErrorMessage(response, 'Unable to load profile.'),
        response.status,
      );
    }

    const body = (await response.json()) as {
      user?: Record<string, unknown>;
    } & Record<string, unknown>;

    const raw = body.user ?? body;
    return normalizeUser(raw);
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    let response: Response;

    try {
      response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: 'PATCH',
        headers: await authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch {
      throw new AuthError('Unable to reach the server. Please try again.');
    }

    if (!response.ok) {
      throw new AuthError(
        await parseErrorMessage(response, 'Unable to change password.'),
        response.status,
      );
    }
  },

  async uploadAvatar(
    photoUri: string,
    options?: { mimeType?: string | null; fileName?: string | null },
  ): Promise<AuthUser> {
    const rawName = options?.fileName || photoUri.split('/').pop()?.split('?')[0] || 'avatar.jpg';
    const match = /\.(\w+)$/.exec(rawName);
    const ext = (match?.[1] ?? 'jpg').toLowerCase();
    const mimeType =
      options?.mimeType && options.mimeType.startsWith('image/')
        ? options.mimeType
        : ext === 'png'
          ? 'image/png'
          : 'image/jpeg';
    const filename = rawName.includes('.') ? rawName : `avatar.${ext === 'png' ? 'png' : 'jpg'}`;

    const formData = new FormData();
    try {
      const fileResponse = await fetch(photoUri);
      const blob = await fileResponse.blob();
      const typedBlob =
        blob.type && blob.type.startsWith('image/')
          ? blob
          : blob.slice(0, blob.size, mimeType);
      formData.append('avatar', typedBlob, filename);
    } catch {
      formData.append('avatar', {
        uri: photoUri,
        name: filename,
        type: mimeType,
      } as unknown as Blob);
    }

    const token = normalizeStoredToken(await AsyncStorage.getItem(AUTH_TOKEN_KEY));
    const url = `${API_BASE_URL}/api/auth/avatar`;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    let status = 0;
    let bodyText = '';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
      status = response.status;
      bodyText = await response.text();
    } catch {
      try {
        const xhrResult = await new Promise<{ status: number; bodyText: string }>(
          (resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', url);
            xhr.setRequestHeader('Accept', 'application/json');
            if (token) {
              xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.timeout = 45000;
            xhr.onload = () =>
              resolve({ status: xhr.status, bodyText: String(xhr.responseText || '') });
            xhr.onerror = () => reject(new TypeError('Network request failed'));
            xhr.ontimeout = () => reject(new TypeError('Network request failed'));
            xhr.send(formData);
          },
        );
        status = xhrResult.status;
        bodyText = xhrResult.bodyText;
      } catch {
        throw new AuthError('Unable to reach the server. Please try again.');
      }
    }

    let body: { user?: Record<string, unknown>; message?: string; error?: string } = {};
    try {
      body = JSON.parse(bodyText) as typeof body;
    } catch {
      body = {};
    }

    if (status < 200 || status >= 300) {
      throw new AuthError(
        body.message ?? body.error ?? 'Unable to upload profile photo.',
        status,
      );
    }

    if (!body.user) {
      throw new AuthError('Avatar uploaded but no user was returned.');
    }

    return normalizeUser(body.user);
  },
};
