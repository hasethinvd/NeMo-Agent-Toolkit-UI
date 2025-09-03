// Utility to get the API base URL dynamically
export function getApiBaseUrl(): string {
  // Check for explicit environment variable first
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // For development, default to local backend (HTTP, not HTTPS)
  if (process.env.NODE_ENV === 'development' || typeof window !== 'undefined') {
    return 'http://localhost:8081';
  }
  
  // For production, use staging backend
  return 'https://tpm-nat.prd.astra.nvidia.com';
}

// Get the full API URL for a specific endpoint
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
} 

// Cache for discovered backend URL
let discoveredBackendUrl: string | null = null;
let discoveryPromise: Promise<string> | null = null;

/**
 * Discover backend URL by trying common ports
 */
async function discoverBackendUrl(): Promise<string> {
  if (discoveredBackendUrl) {
    return discoveredBackendUrl;
  }

  if (discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    // Common ports to try for local development
    const commonPorts = [8081, 8080, 8000, 9000, 3001];
    const protocols = ['http', 'https'];
    
    console.log('🔍 Discovering backend URL...');
    
    for (const protocol of protocols) {
      for (const port of commonPorts) {
        const testUrl = `${protocol}://localhost:${port}`;
        try {
          // Test with a quick health check or jira config endpoint
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
          
          const response = await fetch(`${testUrl}/api/jira/config`, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            console.log('Backend discovered at:', testUrl);
            discoveredBackendUrl = testUrl;
            
            // Store in sessionStorage for future use
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('discoveredBackendUrl', testUrl);
            }
            
            return testUrl;
          }
        } catch (error) {
          // Continue trying other ports
        }
      }
    }
    
    // If discovery fails, fallback to default
    console.warn('⚠️ Backend auto-discovery failed, using default');
    const fallback = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:8081' 
      : getApiBaseUrl();
    
    discoveredBackendUrl = fallback;
    return fallback;
  })();

  return discoveryPromise;
}

// Get backend URL prioritizing UI settings over environment variables
// This function should be used by all MFA and API calls to ensure consistency
export function getBackendUrl(): string {
  // First priority: Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side: use environment variables
    return getApiBaseUrl();
  }
  
  // Second priority: Previously discovered backend URL
  const storedDiscoveredUrl = sessionStorage.getItem('discoveredBackendUrl');
  if (storedDiscoveredUrl) {
    return storedDiscoveredUrl;
  }
  
  // Third priority: Current chat completion URL from sessionStorage (UI settings)
  const storedChatURL = sessionStorage.getItem('chatCompletionURL');
  if (storedChatURL) {
    try {
      const url = new URL(storedChatURL);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.warn('Invalid stored chat URL:', storedChatURL);
    }
  }
  
  // Fourth priority: Explicit backend URL from sessionStorage  
  const storedBackendUrl = sessionStorage.getItem('backendUrl');
  if (storedBackendUrl) {
    return storedBackendUrl;
  }
  
  // Fifth priority: Environment variable base URL
  const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envBackendUrl) {
    return envBackendUrl;
  }
  
  // Final fallback: Use discovery mechanism
  return getApiBaseUrl();
}

/**
 * Get backend URL with automatic discovery
 * Use this for initial connections when you want auto-discovery
 */
export async function getBackendUrlWithDiscovery(): Promise<string> {
  if (typeof window === 'undefined') {
    return getApiBaseUrl();
  }

  try {
    return await discoverBackendUrl();
  } catch (error) {
    console.error('Backend discovery failed:', error);
    return getBackendUrl();
  }
}

// Cache for backend config to avoid repeated requests
let backendConfigCache: { auth_method: string; description: string } | null = null;
let configFetchPromise: Promise<any> | null = null;

// Utility to get backend JIRA configuration with dynamic discovery
export async function getBackendJiraConfig(): Promise<{ auth_method: string; description: string }> {
  // Return cached config if available
  if (backendConfigCache) {
    return backendConfigCache;
  }
  
  // If a fetch is already in progress, return that promise
  if (configFetchPromise) {
    return configFetchPromise;
  }
  
  // Start new fetch with dynamic backend discovery
  configFetchPromise = (async () => {
    try {
      // Use dynamic backend discovery
      const backendUrl = await getBackendUrlWithDiscovery();
      const response = await fetch(`${backendUrl}/api/jira/config`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const config = await response.json();
        backendConfigCache = config;
        console.log('JIRA config fetched from:', backendUrl);
        return config;
      } else {
        console.warn(`Failed to fetch JIRA config from ${backendUrl}, using default`);
        return { auth_method: 'header', description: 'Default auth method (discovery failed)' };
      }
    } catch (error) {
      console.warn('Error fetching backend JIRA config:', error);
      return { auth_method: 'header', description: 'Default auth method (error)' };
    } finally {
      configFetchPromise = null;
    }
  })();
  
  return configFetchPromise;
}

// Utility to check if header auth should be used
export async function shouldUseHeaderAuth(): Promise<boolean> {
  // First check environment variable for explicit configuration
  if (process.env.NEXT_PUBLIC_JIRA_AUTH_METHOD) {
    const envAuthMethod = process.env.NEXT_PUBLIC_JIRA_AUTH_METHOD.toLowerCase();
    console.log(`🔐 Using auth method from environment: ${envAuthMethod}`);
    return envAuthMethod === 'header';
  }
  
  // Fallback to backend config detection
  try {
    const config = await getBackendJiraConfig();
    console.log(`🔐 Detected auth method from backend: ${config.auth_method}`);
    return config.auth_method === 'header';
  } catch (error) {
    console.warn('🔐 Failed to detect auth method, defaulting to header');
    return true; // Default to header if detection fails
  }
}

// Utility to clear the config cache (useful for testing or when config changes)
export function clearBackendConfigCache(): void {
  backendConfigCache = null;
  configFetchPromise = null;
} 