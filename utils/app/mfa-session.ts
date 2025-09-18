/**
 * Unified MFA Session Management
 * Provides consistent session storage across all MFA components
 * Storage type (localStorage vs sessionStorage) is configurable via backend config
 */

import { getMFAStorage, getMFAConfig } from './mfa-config';

// Storage interface - will be set based on config
let storageInterface: any = null;

// MFA session keys
const MFA_SESSION_KEYS = {
  SESSION_ID: 'mfa_session_id',
  SESSION_USER: 'mfa_session_user',
  LAST_ACTIVITY: 'mfa_last_activity'
} as const;

export interface MFASessionData {
  sessionId: string;
  userId: string;
  lastActivity: number;
}

/**
 * Get storage interface based on config
 */
async function getStorage() {
  if (!storageInterface) {
    storageInterface = await getMFAStorage();
  }
  return storageInterface;
}

/**
 * Store MFA session data using configurable storage
 */
export async function storeMFASession(sessionId: string, userId: string): Promise<void> {
  const now = Date.now();
  const storage = await getStorage();
  
  storage.setItem(MFA_SESSION_KEYS.SESSION_ID, sessionId);
  storage.setItem(MFA_SESSION_KEYS.SESSION_USER, userId);
  storage.setItem(MFA_SESSION_KEYS.LAST_ACTIVITY, now.toString());
  
  console.log(`🔐 MFA session stored for user ${userId} using ${storage.type}`);
}

/**
 * Get stored MFA session data using configurable storage
 */
export async function getMFASession(): Promise<MFASessionData | null> {
  const storage = await getStorage();
  
  const sessionId = storage.getItem(MFA_SESSION_KEYS.SESSION_ID);
  const userId = storage.getItem(MFA_SESSION_KEYS.SESSION_USER);
  const lastActivity = storage.getItem(MFA_SESSION_KEYS.LAST_ACTIVITY);
  
  if (!sessionId || !userId || !lastActivity) {
    return null;
  }
  
  return {
    sessionId,
    userId,
    lastActivity: parseInt(lastActivity, 10)
  };
}

/**
 * Check if current user has a valid stored session with configurable timeout
 */
export async function hasValidMFASession(userId: string): Promise<boolean> {
  const session = await getMFASession();
  const config = await getMFAConfig();
  
  if (!session || session.userId !== userId) {
    return false;
  }
  
  // Use configurable timeout from backend
  const maxAge = config.session_timeout * 1000; // Convert to milliseconds
  const age = Date.now() - session.lastActivity;
  
  if (age > maxAge) {
    await clearMFASession();
    return false;
  }
  
  return true;
}

/**
 * Update session activity timestamp using configurable storage
 */
export async function updateMFASessionActivity(): Promise<void> {
  const session = await getMFASession();
  if (session) {
    const storage = await getStorage();
    storage.setItem(MFA_SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  }
}

/**
 * Clear all MFA session data using configurable storage
 */
export async function clearMFASession(): Promise<void> {
  const storage = await getStorage();
  
  storage.removeItem(MFA_SESSION_KEYS.SESSION_ID);
  storage.removeItem(MFA_SESSION_KEYS.SESSION_USER);
  storage.removeItem(MFA_SESSION_KEYS.LAST_ACTIVITY);
  
  console.log(`🔐 MFA session cleared from ${storage.type}`);
}

/**
 * Validate MFA session with backend
 */
export async function validateMFASessionWithBackend(
  backendUrl?: string, 
  userId?: string
): Promise<boolean> {
  // Import backend URL functions dynamically to avoid circular dependencies
  const { getBackendUrl, getBackendUrlWithDiscovery } = await import('./api-config');
  
  // Use discovery if no specific backend URL provided
  const resolvedBackendUrl = backendUrl || (await getBackendUrlWithDiscovery());
  const session = getMFASession();
  
  if (!session) {
    return false;
  }
  
  // If userId provided, check it matches
  if (userId && session.userId !== userId) {
    clearMFASession();
    return false;
  }
  
  try {
    const response = await fetch(
      `${resolvedBackendUrl}/api/mfa/session/validate?session_id=${session.sessionId}&user_id=${session.userId}`
    );
    
    if (!response.ok) {
      clearMFASession();
      return false;
    }
    
    const data = await response.json();
    if (!data.valid) {
      clearMFASession();
      return false;
    }
    
    // Update activity timestamp on successful validation
    updateMFASessionActivity();
    return true;
    
  } catch (error) {
    console.error('MFA session validation error:', error);
    clearMFASession();
    return false;
  }
}
