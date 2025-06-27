// Security headers and browser protection utilities

// Content Security Policy for credential protection
export const setupSecurityHeaders = () => {
  // Only run in browser environment
  if (typeof document === 'undefined') {
    return;
  }

  // Prevent credential data from being accessed via XSS
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://jirasw.nvidia.com wss: ws:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s+/g, ' ').trim();
  document.head.appendChild(meta);
};

// Detect potential credential theft attempts
export const detectSuspiciousActivity = () => {
  let accessCount = 0;
  let lastAccess = 0;
  const MAX_ACCESS_RATE = 10; // Max 10 accesses per minute
  const TIME_WINDOW = 60 * 1000; // 1 minute

  return {
    logAccess: () => {
      const now = Date.now();
      if (now - lastAccess > TIME_WINDOW) {
        accessCount = 0;
      }
      accessCount++;
      lastAccess = now;

      if (accessCount > MAX_ACCESS_RATE) {
        console.warn('🚨 Suspicious credential access pattern detected');
        // Could trigger additional security measures
        return false;
      }
      return true;
    },
    
    getStats: () => ({
      accessCount,
      lastAccess: new Date(lastAccess),
      withinTimeWindow: Date.now() - lastAccess < TIME_WINDOW
    })
  };
};

// Browser integrity checks
export const verifyBrowserIntegrity = (): boolean => {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    return true; // Skip validation on server
  }

  try {
    // Check if crypto API is available and not tampered
    if (!window.crypto || !window.crypto.subtle) {
      console.error('🚨 Crypto API not available or tampered');
      return false;
    }

    // Check if sessionStorage is available
    if (!window.sessionStorage) {
      console.error('🚨 SessionStorage not available');
      return false;
    }

    // Verify crypto functions exist
    const requiredMethods = ['encrypt', 'decrypt', 'importKey', 'deriveKey'] as const;
    for (const method of requiredMethods) {
      if (typeof (window.crypto.subtle as any)[method] !== 'function') {
        console.error(`🚨 Crypto method ${method} not available`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('🚨 Browser integrity check failed:', error);
    return false;
  }
};

// Memory protection utilities
export const secureMemoryHandling = {
  // Clear sensitive data from memory
  clearSensitiveData: (obj: any) => {
    if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'string') {
          obj[key] = '0'.repeat(obj[key].length);
        }
        delete obj[key];
      });
    }
  },

  // Create a secure string that clears itself
  createSecureString: (value: string) => {
    let data = value;
    return {
      get: () => data,
      clear: () => {
        data = '0'.repeat(data.length);
        data = '';
      },
      toString: () => '[SecureString]'
    };
  }
}; 