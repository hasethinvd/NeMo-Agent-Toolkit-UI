// Utility to get the API base URL dynamically
export function getApiBaseUrl(): string {
  // Check for explicit environment variable first
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // Get port from environment or default to 8080
  const port = process.env.NEXT_PUBLIC_API_PORT || '8080';
  
  // Get protocol from environment or default to https
  const protocol = process.env.NEXT_PUBLIC_API_PROTOCOL || 'https';
  
  // Get host from environment or default to localhost
  const host = process.env.NEXT_PUBLIC_API_HOST || 'localhost';
  
  return `${protocol}://${host}:${port}`;
}

// Get the full API URL for a specific endpoint
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
} 

// Get backend URL prioritizing UI settings over environment variables
// This function should be used by all MFA and API calls to ensure consistency
export function getBackendUrl(): string {
  // First priority: Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side: use environment variables
    return getApiBaseUrl();
  }
  
  // Second priority: Current chat completion URL from sessionStorage (UI settings)
  const storedChatURL = sessionStorage.getItem('chatCompletionURL');
  if (storedChatURL) {
    try {
      const url = new URL(storedChatURL);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.warn('Invalid stored chat URL:', storedChatURL);
    }
  }
  
  // Third priority: Explicit backend URL from sessionStorage  
  const storedBackendUrl = sessionStorage.getItem('backendUrl');
  if (storedBackendUrl) {
    return storedBackendUrl;
  }
  
  // Fourth priority: Environment variable base URL
  const envBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envBackendUrl) {
    return envBackendUrl;
  }
  
  // Final fallback: Construct from environment variables or defaults
  return getApiBaseUrl();
}

// Cache for backend config to avoid repeated requests
let backendConfigCache: { auth_method: string; description: string } | null = null;
let configFetchPromise: Promise<any> | null = null;

// Utility to get backend JIRA configuration
export async function getBackendJiraConfig(): Promise<{ auth_method: string; description: string }> {
  // Return cached config if available
  if (backendConfigCache) {
    return backendConfigCache;
  }
  
  // If a fetch is already in progress, return that promise
  if (configFetchPromise) {
    return configFetchPromise;
  }
  
  // Start new fetch
  configFetchPromise = (async () => {
    try {
      const response = await fetch(getApiUrl('/api/jira/config'), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const config = await response.json();
        backendConfigCache = config;
        return config;
      } else {
        console.warn('Failed to fetch backend JIRA config, using default (body)');
        return { auth_method: 'body', description: 'Default auth method' };
      }
    } catch (error) {
      console.warn('Error fetching backend JIRA config:', error);
      return { auth_method: 'body', description: 'Default auth method' };
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