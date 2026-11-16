import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Href, router } from 'expo-router';
import {
  AUTH_TOKEN_KEY,
  USER_EMAIL_KEY,
  USER_INFO_KEY,
  USER_NAME_KEY,
} from '@/constants/config';
import {
  AuthError,
  authService,
  type LoginCredentials,
} from '@/services/authService';
import { setUnauthorizedHandler } from '@/services/authSession';
import type { AuthUser } from '@/types/auth';

const USER_AVATAR_KEY = 'userAvatarUrl';

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateUser: (user: AuthUser) => Promise<void>;
  /** @deprecated Prefer logout() */
  clearToken: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function persistSession(token: string, user: AuthUser): Promise<void> {
  await AsyncStorage.multiSet([
    [AUTH_TOKEN_KEY, token],
    [USER_INFO_KEY, JSON.stringify(user)],
    [USER_NAME_KEY, user.fullName],
    [USER_EMAIL_KEY, user.email],
    [USER_AVATAR_KEY, user.avatar ?? ''],
  ]);
}

async function persistUser(user: AuthUser): Promise<void> {
  await AsyncStorage.multiSet([
    [USER_INFO_KEY, JSON.stringify(user)],
    [USER_NAME_KEY, user.fullName],
    [USER_EMAIL_KEY, user.email],
    [USER_AVATAR_KEY, user.avatar ?? ''],
  ]);
}

async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    USER_INFO_KEY,
    USER_NAME_KEY,
    USER_EMAIL_KEY,
    USER_AVATAR_KEY,
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const [[, storedToken], [, storedInfo]] = await AsyncStorage.multiGet([
          AUTH_TOKEN_KEY,
          USER_INFO_KEY,
        ]);

        if (!isMounted) {
          return;
        }

        let activeToken = storedToken;

        if (storedToken) {
          try {
            const me = await authService.getMe();
            if (!isMounted) {
              return;
            }
            setUser(me);
            await persistUser(me);
          } catch (error) {
            if (error instanceof AuthError && error.status === 401) {
              await clearSession();
              activeToken = null;
              if (isMounted) {
                setUser(null);
              }
            } else if (storedInfo) {
              try {
                setUser(JSON.parse(storedInfo) as AuthUser);
              } catch {
                setUser(null);
              }
            }
          }
        }

        if (isMounted) {
          setToken(activeToken);
        }
      } catch {
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await authService.login(credentials);
    await persistSession(session.token, session.user);
    setToken(session.token);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout().finally(() => {
        router.replace('/(auth)/login' as Href);
      });
    });
  }, [logout]);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const me = await authService.getMe();
      await persistUser(me);
      setUser(me);
      return me;
    } catch {
      return null;
    }
  }, []);

  const updateUser = useCallback(async (next: AuthUser) => {
    await persistUser(next);
    setUser(next);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      isAuthenticated: Boolean(token),
      login,
      logout,
      refreshUser,
      updateUser,
      clearToken: logout,
    }),
    [token, user, isLoading, login, logout, refreshUser, updateUser],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
