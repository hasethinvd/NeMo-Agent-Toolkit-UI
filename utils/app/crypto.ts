import { JIRACredentials } from '@/types/jira';

const S_KEY = 'chat-session-key'; // Key for session password
const C_KEY = 'jira-credentials'; // Key for credentials in sessionStorage

// Interfaces for our stored data
interface StoredEncryptedData {
  iv: string;
  salt: string;
  data: string;
  timestamp: string;
  fingerprint: string;
}

// Generate a random password for the session if it doesn't exist
const getSessionPassword = (): string => {
  let pass = sessionStorage.getItem(S_KEY);
  if (!pass) {
    pass = window.crypto.getRandomValues(new Uint8Array(32)).toString();
    sessionStorage.setItem(S_KEY, pass);
  }
  return pass;
};

// Derive a key from the session password and a salt
const getKey = async (salt: Uint8Array, secret: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
};

// Create a SHA-256 fingerprint of the token
const createFingerprint = async (token: string): Promise<string> => {
    const enc = new TextEncoder();
    const data = enc.encode(token);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Encrypt and store JIRA credentials
export const setSecureJIRACredentials = async (credentials: JIRACredentials) => {
  try {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const secret = getSessionPassword();
    const key = await getKey(salt, secret);
    const enc = new TextEncoder();

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(JSON.stringify(credentials)),
    );

    const fingerprint = await createFingerprint(credentials.token);

    const storedData: StoredEncryptedData = {
      iv: Buffer.from(iv).toString('base64'),
      salt: Buffer.from(salt).toString('base64'),
      data: Buffer.from(encryptedData).toString('base64'),
      timestamp: new Date().toISOString(),
      fingerprint: fingerprint,
    };

    sessionStorage.setItem(C_KEY, JSON.stringify(storedData));
    console.log('JIRA credentials securely stored.');
  } catch (error) {
    console.error('Error setting secure JIRA credentials:', error);
  }
};

// Retrieve and decrypt JIRA credentials
export const getSecureJIRACredentials = async (): Promise<JIRACredentials | null> => {
  try {
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return null;

    const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
    const { iv, salt, data, timestamp } = storedData;

    // Check for expiration (24 hours)
    const storedTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    if (now - storedTime > 24 * 60 * 60 * 1000) {
      console.log('JIRA credentials expired.');
      clearJIRACredentials();
      return null;
    }

    const secret = getSessionPassword();
    const key = await getKey(
      new Uint8Array(Buffer.from(salt, 'base64')),
      secret,
    );
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(Buffer.from(iv, 'base64')) },
      key,
      new Uint8Array(Buffer.from(data, 'base64')),
    );

    const dec = new TextDecoder();
    const credentials = JSON.parse(dec.decode(decryptedData));
    console.log('JIRA credentials securely retrieved.');
    return credentials;
  } catch (error) {
    console.error('Error getting secure JIRA credentials:', error);
    // Clear potentially corrupted data
    clearJIRACredentials();
    return null;
  }
};

// Clear credentials from storage
export const clearJIRACredentials = () => {
  sessionStorage.removeItem(C_KEY);
  console.log('JIRA credentials cleared.');
};

// Get stored data for UI display (expiration and fingerprint)
export const getJIRACredentialStatus = (): { expires?: Date, fingerprint?: string } | null => {
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return null;

    const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
    const { timestamp, fingerprint } = storedData;

    const storedTime = new Date(timestamp);
    const expirationTime = new Date(storedTime.getTime() + 24 * 60 * 60 * 1000);

    if (new Date() > expirationTime) {
        clearJIRACredentials();
        return null;
    }

    return { expires: expirationTime, fingerprint };
} 