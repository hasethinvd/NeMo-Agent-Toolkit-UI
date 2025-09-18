/**
 * MFA Configuration Management
 * Fetches and caches MFA configuration from backend
 */

interface MFAConfig {
  session_timeout: number;
  storage_type: 'localStorage' | 'sessionStorage';
  validation_frequency: number;
  auto_refresh_activity: boolean;
}

// Cache for MFA config
let mfaConfigCache: MFAConfig | null = null;
let configFetchPromise: Promise<MFAConfig> | null = null;

/**
 * Get MFA configuration from backend
 */
export async function getMFAConfig(): Promise<MFAConfig> {
  // Return cached config if available
  if (mfaConfigCache) {
    return mfaConfigCache;
  }
  
  // If fetch is in progress, return that promise
  if (configFetchPromise) {
    return configFetchPromise;
  }
  
  // Start new fetch
  configFetchPromise = (async () => {
    try {
      const { getBackendUrlWithDiscovery } = await import('./api-config');
      const backendUrl = await getBackendUrlWithDiscovery();
      
      const response = await fetch(`${backendUrl}/api/mfa/config`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          mfaConfigCache = data.config;
          console.log('📋 MFA config loaded:', data.config);
          return data.config;
        }
      }
      
      throw new Error('Failed to fetch MFA config');
      
    } catch (error) {
      console.warn('Using default MFA config due to error:', error);
      
      // Return default config
      const defaultConfig: MFAConfig = {
        session_timeout: 604800,  // 7 days
        storage_type: 'localStorage',
        validation_frequency: 3600,  // 1 hour  
        auto_refresh_activity: true
      };
      
      mfaConfigCache = defaultConfig;
      return defaultConfig;
    } finally {
      configFetchPromise = null;
    }
  })();
  
  return configFetchPromise;
}

/**
 * Clear config cache (useful for testing or when config changes)
 */
export function clearMFAConfigCache(): void {
  mfaConfigCache = null;
  configFetchPromise = null;
}

/**
 * Get storage interface based on config
 */
export async function getMFAStorage() {
  const config = await getMFAConfig();
  const storageType = config.storage_type;
  
  if (storageType === 'localStorage') {
    return {
      getItem: (key: string): string | null => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return localStorage.getItem(key);
        }
        return null;
      },
      setItem: (key: string, value: string): void => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(key, value);
        }
      },
      removeItem: (key: string): void => {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.removeItem(key);
        }
      },
      type: 'localStorage' as const
    };
  } else {
    return {
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
      },
      type: 'sessionStorage' as const
    };
  }
}

export type { MFAConfig };
