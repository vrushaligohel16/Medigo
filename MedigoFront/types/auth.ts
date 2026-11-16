export type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string;
};

export type SignupData = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};
