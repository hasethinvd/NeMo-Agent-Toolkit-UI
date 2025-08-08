import { JIRACredentials } from '@/types/jira';
import { 
  setupSecurityHeaders, 
  verifyBrowserIntegrity, 
  secureMemoryHandling 
} from './security-headers';
import { 
  sessionSecurity, 
  logSecurityEvent, 
  logCredentialAccess,
  validateSession 
} from './session-security';

const S_KEY = 'chat-session-key'; // Key for session password
const C_KEY = 'jira-credentials'; // Key for credentials in sessionStorage
const R_KEY = 'key-rotation-schedule'; // Key for rotation schedule

// Key rotation configuration
const KEY_ROTATION_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds  
const CREDENTIAL_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Interfaces for our stored data
interface StoredEncryptedData {
  iv: string;
  salt: string;
  data: string;
  timestamp: string;
  fingerprint: string;
  keyVersion: number; // Track which key version was used
  lastRotation: string; // When key was last rotated
  rotationSchedule: string; // When next rotation should occur
}



// Generate a random password for the session if it doesn't exist
const getSessionPassword = (keyVersion?: number): string => {
  const keyName = keyVersion ? `${S_KEY}-v${keyVersion}` : S_KEY;
  let pass = sessionStorage.getItem(keyName);
  if (!pass) {
    pass = window.crypto.getRandomValues(new Uint8Array(32)).toString();
    sessionStorage.setItem(keyName, pass);
  }
  return pass;
};

// Get current key version or create new one
const getCurrentKeyVersion = (): number => {
  const rotationData = sessionStorage.getItem(R_KEY);
  if (rotationData) {
    try {
      const { currentVersion } = JSON.parse(rotationData);
      return currentVersion || 1;
    } catch {
      // Fallback if parsing fails
    }
  }
  return 1;
};

// Check if key rotation is needed
const shouldRotateKey = (): boolean => {
  const rotationData = sessionStorage.getItem(R_KEY);
  if (!rotationData) return false;
  
  try {
    const { nextRotation } = JSON.parse(rotationData);
    return new Date() > new Date(nextRotation);
  } catch {
    return false;
  }
};

// Rotate encryption key
const rotateEncryptionKey = async (): Promise<number> => {
  const currentVersion = getCurrentKeyVersion();
  const newVersion = currentVersion + 1;
  const now = new Date();
  const nextRotation = new Date(now.getTime() + KEY_ROTATION_INTERVAL);
  
  // Generate new session key
  getSessionPassword(newVersion);
  
  // Update rotation schedule
  const rotationData = {
    currentVersion: newVersion,
    lastRotation: now.toISOString(),
    nextRotation: nextRotation.toISOString()
  };
  
  sessionStorage.setItem(R_KEY, JSON.stringify(rotationData));
  console.log(`🔄 Encryption key rotated to version ${newVersion}`);
  
  return newVersion;
};

// Re-encrypt existing credentials with new key version
const reencryptWithNewKey = async (newKeyVersion: number): Promise<void> => {
  try {
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return;

    const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
    
    // Decrypt with old key
    const oldSecret = getSessionPassword(storedData.keyVersion);
    const oldKey = await getKey(
      new Uint8Array(Buffer.from(storedData.salt, 'base64')),
      oldSecret,
    );
    
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(Buffer.from(storedData.iv, 'base64')) },
      oldKey,
      new Uint8Array(Buffer.from(storedData.data, 'base64')),
    );

    const dec = new TextDecoder();
    const credentials = JSON.parse(dec.decode(decryptedData));
    
    // Re-encrypt with new key
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const newSecret = getSessionPassword(newKeyVersion);
    const newKey = await getKey(salt, newSecret);
    const enc = new TextEncoder();

    const newEncryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      newKey,
      enc.encode(JSON.stringify(credentials)),
    );

    const rotationData = JSON.parse(sessionStorage.getItem(R_KEY) || '{}');
    const now = new Date();

    const newStoredData: StoredEncryptedData = {
      iv: Buffer.from(iv).toString('base64'),
      salt: Buffer.from(salt).toString('base64'),
      data: Buffer.from(newEncryptedData).toString('base64'),
      timestamp: storedData.timestamp, // Keep original timestamp
      fingerprint: storedData.fingerprint, // Keep original fingerprint
      keyVersion: newKeyVersion,
      lastRotation: rotationData.lastRotation || now.toISOString(),
      rotationSchedule: rotationData.nextRotation || new Date(now.getTime() + KEY_ROTATION_INTERVAL).toISOString()
    };

    sessionStorage.setItem(C_KEY, JSON.stringify(newStoredData));
    console.log(`🔄 Credentials re-encrypted with key version ${newKeyVersion}`);
    
    // Clean up old key
    sessionStorage.removeItem(`${S_KEY}-v${storedData.keyVersion}`);
  } catch (error) {
    console.error('Error re-encrypting credentials with new key:', error);
  }
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

// Encrypt and store JIRA credentials with key rotation
export const setSecureJIRACredentials = async (credentials: JIRACredentials) => {
  try {
    // Security validations
    if (!verifyBrowserIntegrity()) {
      throw new Error('Browser integrity check failed');
    }
    
    if (!validateSession()) {
      throw new Error('Session validation failed');
    }
    
    if (!logCredentialAccess('store_credentials')) {
      throw new Error('Credential access limit exceeded');
    }
    
    logSecurityEvent('credential_store_attempt', { 
      username: credentials.username.substring(0, 4) + '***' 
    }, 'medium');
    // Check if key rotation is needed or if this is first time setup
    let keyVersion = getCurrentKeyVersion();
    const now = new Date();
    
    // Initialize rotation schedule if not exists
    if (!sessionStorage.getItem(R_KEY)) {
      const rotationData = {
        currentVersion: keyVersion,
        lastRotation: now.toISOString(),
        nextRotation: new Date(now.getTime() + KEY_ROTATION_INTERVAL).toISOString()
      };
      sessionStorage.setItem(R_KEY, JSON.stringify(rotationData));
    }
    
    // Rotate key if needed
    if (shouldRotateKey()) {
      keyVersion = await rotateEncryptionKey();
      // Re-encrypt existing credentials with new key if they exist
      await reencryptWithNewKey(keyVersion);
    }

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const secret = getSessionPassword(keyVersion);
    const key = await getKey(salt, secret);
    const enc = new TextEncoder();

    const encryptedData = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      enc.encode(JSON.stringify(credentials)),
    );

    const fingerprint = await createFingerprint(credentials.token);
    const rotationData = JSON.parse(sessionStorage.getItem(R_KEY) || '{}');

    const storedData: StoredEncryptedData = {
      iv: Buffer.from(iv).toString('base64'),
      salt: Buffer.from(salt).toString('base64'),
      data: Buffer.from(encryptedData).toString('base64'),
      timestamp: new Date().toISOString(),
      fingerprint: fingerprint,
      keyVersion: keyVersion,
      lastRotation: rotationData.lastRotation || now.toISOString(),
      rotationSchedule: rotationData.nextRotation || new Date(now.getTime() + KEY_ROTATION_INTERVAL).toISOString()
    };

    sessionStorage.setItem(C_KEY, JSON.stringify(storedData));
    console.log(`🔐 JIRA credentials securely stored with key version ${keyVersion}`);
  } catch (error) {
    console.error('Error setting secure JIRA credentials:', error);
  }
};

// Retrieve and decrypt JIRA credentials with rotation support
export const getSecureJIRACredentials = async (): Promise<JIRACredentials | null> => {
  try {
    // Security validations
    if (!verifyBrowserIntegrity()) {
      logSecurityEvent('browser_integrity_failure', {}, 'critical');
      return null;
    }
    
    if (!validateSession()) {
      logSecurityEvent('session_validation_failure', {}, 'high');
      return null;
    }
    
    if (!logCredentialAccess('retrieve_credentials')) {
      logSecurityEvent('credential_access_limit_exceeded', {}, 'high');
      return null;
    }
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return null;

    const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
    const { iv, salt, data, timestamp, keyVersion = 1 } = storedData;

    // Check for expiration (24 hours)
    const storedTime = new Date(timestamp).getTime();
    const now = new Date().getTime();
    if (now - storedTime > CREDENTIAL_EXPIRY) {
      console.log('🕒 JIRA credentials expired.');
      clearJIRACredentials();
      return null;
    }

    // Check if automatic key rotation is needed
    if (shouldRotateKey()) {
      console.log('🔄 Automatic key rotation triggered during credential retrieval');
      const newKeyVersion = await rotateEncryptionKey();
      await reencryptWithNewKey(newKeyVersion);
      // Retrieve the re-encrypted data
      return await getSecureJIRACredentials();
    }

    const secret = getSessionPassword(keyVersion);
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
    console.log(`🔐 JIRA credentials securely retrieved using key version ${keyVersion}`);
    return credentials;
  } catch (error) {
    console.error('❌ Error getting secure JIRA credentials:', error);
    // Clear potentially corrupted data
    clearJIRACredentials();
    return null;
  }
};

// Clear credentials from storage and cleanup rotation data
export const clearJIRACredentials = () => {
  // Remove credentials
  sessionStorage.removeItem(C_KEY);
  
  // Clean up all key versions
  const rotationData = sessionStorage.getItem(R_KEY);
  if (rotationData) {
    try {
      const { currentVersion } = JSON.parse(rotationData);
      for (let i = 1; i <= currentVersion; i++) {
        sessionStorage.removeItem(`${S_KEY}-v${i}`);
      }
    } catch {
      // Fallback cleanup
      for (let i = 1; i <= 10; i++) {
        sessionStorage.removeItem(`${S_KEY}-v${i}`);
      }
    }
  }
  
  // Remove rotation schedule and base session key
  sessionStorage.removeItem(R_KEY);
  sessionStorage.removeItem(S_KEY);
  
  console.log('🧹 JIRA credentials and all encryption keys cleared');
};

// Server-side decryption function for encrypted credentials
export const decryptCredentials = async (encryptedData: string): Promise<{ username: string; token: string } | null> => {
  try {
    const { iv, salt, data, sessionKey } = JSON.parse(encryptedData);
    
    if (!iv || !salt || !data || !sessionKey) {
      throw new Error('Missing required decryption data');
    }

    // This function should match the client-side encryption in setSecureJIRACredentials
    // Derive the key using the session key and salt (same as client-side)
    const enc = new TextEncoder();
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(sessionKey),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    const key = await globalThis.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(Buffer.from(salt, 'base64')),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt'],
    );

    // Decrypt the data using AES-GCM (same as client-side)
    const decryptedData = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(Buffer.from(iv, 'base64')) },
      key,
      new Uint8Array(Buffer.from(data, 'base64')),
    );

    const dec = new TextDecoder();
    const credentials = JSON.parse(dec.decode(decryptedData));
    console.log('✅ JIRA credentials decrypted on server');
    return credentials;
  } catch (error) {
    console.error('❌ Error decrypting JIRA credentials on server:', error);
    return null;
  }
};

// Get stored data for UI display (expiration and fingerprint)
export const getJIRACredentialStatus = (): { expires?: Date, fingerprint?: string, keyVersion?: number, nextRotation?: Date } | null => {
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return null;

    const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
    const { timestamp, fingerprint, keyVersion = 1, rotationSchedule } = storedData;

    const storedTime = new Date(timestamp);
    const expirationTime = new Date(storedTime.getTime() + CREDENTIAL_EXPIRY);

    if (new Date() > expirationTime) {
        clearJIRACredentials();
        return null;
    }

    return { 
        expires: expirationTime, 
        fingerprint,
        keyVersion,
        nextRotation: rotationSchedule ? new Date(rotationSchedule) : undefined
    };
};

// Get key rotation status for monitoring
export const getKeyRotationStatus = (): { currentVersion: number, lastRotation?: Date, nextRotation?: Date, rotationInterval: number } | null => {
    const rotationData = sessionStorage.getItem(R_KEY);
    if (!rotationData) return null;

    try {
        const { currentVersion, lastRotation, nextRotation } = JSON.parse(rotationData);
        return {
            currentVersion,
            lastRotation: lastRotation ? new Date(lastRotation) : undefined,
            nextRotation: nextRotation ? new Date(nextRotation) : undefined,
            rotationInterval: KEY_ROTATION_INTERVAL
        };
    } catch {
        return null;
    }
};

// Get the current session key for the active key version
export const getCurrentSessionKey = (): string | null => {
    const storedDataJSON = sessionStorage.getItem(C_KEY);
    if (!storedDataJSON) return null;

    try {
        const storedData: StoredEncryptedData = JSON.parse(storedDataJSON);
        const keyVersion = storedData.keyVersion || 1;
        return getSessionPassword(keyVersion);
    } catch {
        return null;
    }
};

// Force manual key rotation (for testing or security incidents)
export const forceKeyRotation = async (): Promise<boolean> => {
    try {
        const storedDataJSON = sessionStorage.getItem(C_KEY);
        if (!storedDataJSON) {
            console.log('No credentials to rotate');
            return false;
        }

        console.log('🔄 Manual key rotation initiated');
        const newKeyVersion = await rotateEncryptionKey();
        await reencryptWithNewKey(newKeyVersion);
        console.log('✅ Manual key rotation completed');
        return true;
    } catch (error) {
        console.error('❌ Manual key rotation failed:', error);
        return false;
    }
};

 