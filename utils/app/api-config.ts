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
  const config = await getBackendJiraConfig();
  return config.auth_method === 'header';
}

// Utility to clear the config cache (useful for testing or when config changes)
export function clearBackendConfigCache(): void {
  backendConfigCache = null;
  configFetchPromise = null;
} 