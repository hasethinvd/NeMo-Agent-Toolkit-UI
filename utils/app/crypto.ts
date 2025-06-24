// Simple encryption utility for JIRA credentials
// Uses Web Crypto API for client-side encryption

const ENCRYPTION_KEY_NAME = 'jira-creds-key';

// Generate or retrieve encryption key
async function getEncryptionKey(): Promise<CryptoKey> {
  // In a real app, you'd want to derive this from user session or store it securely
  // For now, we'll generate a key per session
  const keyData = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
  
  if (keyData) {
    // Import existing key
    const keyBuffer = new Uint8Array(JSON.parse(keyData));
    return await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } else {
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and store key
    const keyBuffer = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(Array.from(new Uint8Array(keyBuffer))));
    
    return key;
  }
}

export async function encryptCredentials(credentials: { username: string; token: string }): Promise<string> {
  if (!credentials.username || !credentials.token) {
    throw new Error('Username and token are required for encryption');
  }

  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(credentials));
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      data
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Return as base64
    return btoa(String.fromCharCode.apply(null, Array.from(combined)));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt credentials');
  }
}

export async function decryptCredentials(encryptedData: string): Promise<{ username: string; token: string }> {
  try {
    const key = await getEncryptionKey();
    
    // Decode from base64
    const combined = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    
    // Split IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );
    
    // Decode
    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decrypted);
    
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt credentials');
  }
}

// Clear encryption key (call on logout)
export function clearEncryptionKey(): void {
  sessionStorage.removeItem(ENCRYPTION_KEY_NAME);
} 