// Session security and audit logging

interface SecurityEvent {
  timestamp: number;
  event: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent: string;
  sessionId: string;
}

interface SessionInfo {
  id: string;
  created: number;
  lastActivity: number;
  ipAddress?: string;
  userAgent: string;
  credentialAccess: number;
}

class SessionSecurityManager {
  private sessionId: string;
  private securityEvents: SecurityEvent[] = [];
  private sessionInfo: SessionInfo;
  private readonly MAX_EVENTS = 100;
  private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
  private readonly CREDENTIAL_ACCESS_LIMIT = 50; // Max credential accesses per session

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionInfo = {
      id: this.sessionId,
      created: Date.now(),
      lastActivity: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
      credentialAccess: 0
    };
    
    this.setupSessionMonitoring();
  }

  private generateSessionId(): string {
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      // Fallback for server-side rendering
      return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private setupSessionMonitoring() {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    // Monitor for session hijacking attempts
    setInterval(() => {
      this.validateSession();
    }, 60000); // Check every minute

    // Monitor page visibility to detect potential screen recording
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.logSecurityEvent('session_hidden', {}, 'low');
      } else {
        this.logSecurityEvent('session_visible', {}, 'low');
      }
    });

    // Monitor for developer tools
    let devtools = false;
    setInterval(() => {
      const threshold = 160;
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools) {
          devtools = true;
          this.logSecurityEvent('devtools_opened', {}, 'medium');
        }
      } else {
        if (devtools) {
          devtools = false;
          this.logSecurityEvent('devtools_closed', {}, 'medium');
        }
      }
    }, 1000);
  }

  logSecurityEvent(event: string, details: any = {}, severity: SecurityEvent['severity'] = 'low') {
    const securityEvent: SecurityEvent = {
      timestamp: Date.now(),
      event,
      details,
      severity,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
      sessionId: this.sessionId
    };

    this.securityEvents.push(securityEvent);
    
    // Keep only recent events
    if (this.securityEvents.length > this.MAX_EVENTS) {
      this.securityEvents = this.securityEvents.slice(-this.MAX_EVENTS);
    }

    // Log critical events to console
    if (severity === 'critical' || severity === 'high') {
      console.warn(`🚨 Security Event [${severity.toUpperCase()}]:`, event, details);
    }

    this.sessionInfo.lastActivity = Date.now();
  }

  logCredentialAccess(operation: string) {
    this.sessionInfo.credentialAccess++;
    
    if (this.sessionInfo.credentialAccess > this.CREDENTIAL_ACCESS_LIMIT) {
      this.logSecurityEvent('credential_access_limit_exceeded', {
        operation,
        accessCount: this.sessionInfo.credentialAccess
      }, 'high');
      return false;
    }

    this.logSecurityEvent('credential_access', { operation }, 'medium');
    return true;
  }

  validateSession(): boolean {
    const now = Date.now();
    
    // Check session timeout
    if (now - this.sessionInfo.lastActivity > this.SESSION_TIMEOUT) {
      this.logSecurityEvent('session_timeout', {
        inactiveTime: now - this.sessionInfo.lastActivity
      }, 'medium');
      this.invalidateSession();
      return false;
    }

    // Check for suspicious user agent changes (only in browser)
    if (typeof navigator !== 'undefined' && navigator.userAgent !== this.sessionInfo.userAgent) {
      this.logSecurityEvent('user_agent_changed', {
        original: this.sessionInfo.userAgent,
        current: navigator.userAgent
      }, 'high');
      this.invalidateSession();
      return false;
    }

    return true;
  }

  invalidateSession() {
    this.logSecurityEvent('session_invalidated', {}, 'high');
    
    // Clear all sensitive data (only in browser)
    if (typeof sessionStorage !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch (error) {
        console.error('Failed to clear storage:', error);
      }
    }

    // Reload page to reset state (only in browser)
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  getSecurityReport() {
    return {
      sessionInfo: this.sessionInfo,
      recentEvents: this.securityEvents.slice(-20),
      summary: {
        totalEvents: this.securityEvents.length,
        criticalEvents: this.securityEvents.filter(e => e.severity === 'critical').length,
        highEvents: this.securityEvents.filter(e => e.severity === 'high').length,
        sessionAge: Date.now() - this.sessionInfo.created,
        credentialAccesses: this.sessionInfo.credentialAccess
      }
    };
  }

  // Export security logs (for debugging or audit)
  exportSecurityLogs(): string {
    const report = this.getSecurityReport();
    return JSON.stringify(report, null, 2);
  }
}

// Singleton instance (only create in browser)
export const sessionSecurity = typeof window !== 'undefined' 
  ? new SessionSecurityManager() 
  : null;

// Convenience functions
export const logSecurityEvent = (event: string, details?: any, severity?: SecurityEvent['severity']) => {
  if (sessionSecurity) {
    sessionSecurity.logSecurityEvent(event, details, severity);
  }
};

export const logCredentialAccess = (operation: string) => {
  if (sessionSecurity) {
    return sessionSecurity.logCredentialAccess(operation);
  }
  return true; // Allow access on server
};

export const validateSession = () => {
  if (sessionSecurity) {
    return sessionSecurity.validateSession();
  }
  return true; // Valid on server
};

export const getSecurityReport = () => {
  if (sessionSecurity) {
    return sessionSecurity.getSecurityReport();
  }
  // Return empty report for server
  return {
    sessionInfo: {
      id: 'server',
      created: Date.now(),
      lastActivity: Date.now(),
      userAgent: 'Server',
      credentialAccess: 0
    },
    recentEvents: [],
    summary: {
      totalEvents: 0,
      criticalEvents: 0,
      highEvents: 0,
      sessionAge: 0,
      credentialAccesses: 0
    }
  };
}; 