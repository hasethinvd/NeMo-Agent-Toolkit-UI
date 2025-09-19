// Security headers and browser protection utilities

// Content Security Policy for credential protection
export const setupSecurityHeaders = () => {
  // Only run in browser environment
  if (typeof document === 'undefined') {
    return;
  }

  // Get the current backend URL dynamically using the same logic as api-config.ts
  const getBackendUrl = () => {
    // Check if we have a configured backend URL in sessionStorage
    const storedBackendUrl = sessionStorage.getItem('backendUrl');
    if (storedBackendUrl) {
      try {
        const url = new URL(storedBackendUrl);
        return `${url.protocol}//${url.host}`;
      } catch (e) {
        // Invalid URL, fall back to default
      }
    }
    
    // Check if we have a stored chat completion URL (this is what's actually being used)
    const storedChatURL = sessionStorage.getItem('chatCompletionURL');
    if (storedChatURL) {
      try {
        const url = new URL(storedChatURL);
        return `${url.protocol}//${url.host}`;
      } catch (error) {
        console.warn('Invalid stored chat URL:', storedChatURL);
      }
    }
    
    // Check environment variables
    const apiHost = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
    const apiProtocol = process.env.NEXT_PUBLIC_API_PROTOCOL || 'http';
    const apiPort = process.env.NEXT_PUBLIC_API_PORT || '8080';
    
    return `${apiProtocol}://${apiHost}:${apiPort}`;
  };

  const backendUrl = getBackendUrl();
  const backendHost = backendUrl.replace(/^https?:\/\//, '').split(':')[0];
  
  // Debug logging
  console.log('🔧 CSP Backend URL detection:', {
    backendUrl,
    backendHost,
    storedBackendUrl: sessionStorage.getItem('backendUrl'),
    storedChatURL: sessionStorage.getItem('chatCompletionURL'),
    envHost: process.env.NEXT_PUBLIC_API_HOST,
    envProtocol: process.env.NEXT_PUBLIC_API_PROTOCOL,
    envPort: process.env.NEXT_PUBLIC_API_PORT,
    windowLocation: typeof window !== 'undefined' ? window.location.href : 'N/A'
  });
  
  // Build connect-src directive with dynamic backend URL
  const connectSrc = [
    "'self'",
    "https://jirasw.nvidia.com",
    "https://*.astra.nvidia.com", 
    "https://tpm-nat.prd.astra.nvidia.com",
    "https://127.0.0.1:*",
    "http://127.0.0.1:*",
    "https://localhost:*",
    "http://localhost:*",
    `http://${backendHost}:*`,
    `https://${backendHost}:*`,
    "wss:",
    "ws:"
  ].join(' ');
  
  console.log('🔧 CSP connect-src:', connectSrc);

  // Prevent credential data from being accessed via XSS
  const meta = document.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src ${connectSrc};
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s+/g, ' ').trim();
  document.head.appendChild(meta);
};

// Function to update CSP dynamically when backend URL changes
export const updateCSPForBackend = (backendUrl: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  try {
    const url = new URL(backendUrl);
    const backendHost = url.hostname;
    
    console.log('🔧 Updating CSP for backend:', { backendUrl, backendHost });
    
    // Remove ALL existing CSP meta tags
    const existingMetas = document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]');
    existingMetas.forEach(meta => meta.remove());
    
    // Build new connect-src directive
    const connectSrc = [
      "'self'",
      "https://jirasw.nvidia.com",
      "https://*.astra.nvidia.com", 
      "https://tpm-nat.prd.astra.nvidia.com",
      "https://127.0.0.1:*",
      "http://127.0.0.1:*",
      "https://localhost:*",
      "http://localhost:*",
      `http://${backendHost}:*`,
      `https://${backendHost}:*`,
      "wss:",
      "ws:"
    ].join(' ');
    
    // Create new CSP meta tag
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = `
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src ${connectSrc};
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    `.replace(/\s+/g, ' ').trim();
    
    // Insert at the beginning of head to ensure it's processed first
    document.head.insertBefore(meta, document.head.firstChild);
    
    // Force a small delay to ensure the CSP is processed
    setTimeout(() => {
      console.log('✅ CSP updated with connect-src:', connectSrc);
      console.log('🔧 Current CSP meta tags:', document.querySelectorAll('meta[http-equiv="Content-Security-Policy"]').length);
      
      // Try to force browser to recognize the new CSP by dispatching a custom event
      const event = new CustomEvent('csp-updated', { 
        detail: { backendUrl, backendHost, connectSrc } 
      });
      document.dispatchEvent(event);
    }, 50);
  } catch (error) {
    console.error('❌ Failed to update CSP:', error);
  }
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