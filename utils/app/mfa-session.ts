/**
 * Unified MFA Session Management
 * Provides consistent session storage across all MFA components
 */

// Safe session storage wrapper that works in both client and server environments
const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(key);
    }
  }
};

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
 * Store MFA session data
 */
export function storeMFASession(sessionId: string, userId: string): void {
  const now = Date.now();
  
  safeSessionStorage.setItem(MFA_SESSION_KEYS.SESSION_ID, sessionId);
  safeSessionStorage.setItem(MFA_SESSION_KEYS.SESSION_USER, userId);
  safeSessionStorage.setItem(MFA_SESSION_KEYS.LAST_ACTIVITY, now.toString());
  
  console.log('🔐 MFA session stored for user:', userId);
}

/**
 * Get stored MFA session data
 */
export function getMFASession(): MFASessionData | null {
  const sessionId = safeSessionStorage.getItem(MFA_SESSION_KEYS.SESSION_ID);
  const userId = safeSessionStorage.getItem(MFA_SESSION_KEYS.SESSION_USER);
  const lastActivity = safeSessionStorage.getItem(MFA_SESSION_KEYS.LAST_ACTIVITY);
  
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
 * Check if current user has a valid stored session
 */
export function hasValidMFASession(userId: string): boolean {
  const session = getMFASession();
  
  if (!session || session.userId !== userId) {
    return false;
  }
  
  // Check if session is not too old (24 hours)
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const age = Date.now() - session.lastActivity;
  
  if (age > maxAge) {
    clearMFASession();
    return false;
  }
  
  return true;
}

/**
 * Update session activity timestamp
 */
export function updateMFASessionActivity(): void {
  const session = getMFASession();
  if (session) {
    safeSessionStorage.setItem(MFA_SESSION_KEYS.LAST_ACTIVITY, Date.now().toString());
  }
}

/**
 * Clear all MFA session data
 */
export function clearMFASession(): void {
  safeSessionStorage.removeItem(MFA_SESSION_KEYS.SESSION_ID);
  safeSessionStorage.removeItem(MFA_SESSION_KEYS.SESSION_USER);
  safeSessionStorage.removeItem(MFA_SESSION_KEYS.LAST_ACTIVITY);
  
  console.log('🔐 MFA session cleared');
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
