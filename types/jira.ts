export interface JIRACredentials {
  username: string;
  token: string;
  encrypted?: string;
  fingerprint?: string;
  expiration?: number;
} 