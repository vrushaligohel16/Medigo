export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string;
};

export type CreateEmergencyContactInput = {
  name: string;
  phone: string;
  relation?: string;
};

export type SosAlertPayload = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type SosAlertResult = {
  ok: boolean;
  configured: boolean;
  message: string;
  sentCount?: number;
  results?: Array<{
    contactId: string;
    phone: string;
    status: string;
    error?: string;
    sid?: string;
  }>;
  location?: {
    latitude: number;
    longitude: number;
  };
};
