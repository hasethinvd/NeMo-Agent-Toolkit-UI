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
 * Read backend configuration from various sources intelligently
 */
async function readBackendConfig(): Promise<{ port: number; protocol: string; host: string }> {
  // 1. Check environment variables first (highest priority)
  const envPort = process.env.NEXT_PUBLIC_BACKEND_PORT || process.env.PORT;
  const envProtocol = process.env.NEXT_PUBLIC_BACKEND_PROTOCOL || 'http';
  const envHost = process.env.NEXT_PUBLIC_BACKEND_HOST || 'localhost';
  
  if (envPort) {
    console.log('📋 Using backend config from environment:', { port: envPort, protocol: envProtocol, host: envHost });
    return {
      port: parseInt(envPort),
      protocol: envProtocol,
      host: envHost
    };
  }

  // 2. Try to read config.yml file content (if available via static file)
  try {
    if (typeof window !== 'undefined') {
      // Try to fetch the config file directly (works if served as static file)
      const configResponse = await fetch('/configs/config.yml', {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      
      if (configResponse.ok) {
        const configText = await configResponse.text();
        
        // Parse YAML-like content to extract port
        const portMatch = configText.match(/port:\s*\$\{PORT:-(\d+)\}/);
        const hostMatch = configText.match(/host:\s*["']([^"']+)["']/);
        const sslMatch = configText.match(/ssl_cert_file:\s*(.+)/);
        
        if (portMatch) {
          const port = parseInt(portMatch[1]);
          const host = hostMatch ? hostMatch[1] : 'localhost';
          const protocol = sslMatch && sslMatch[1] !== 'null' ? 'https' : 'http';
          
          console.log('📋 Backend config read from config.yml:', { port, protocol, host });
          return { port, protocol, host };
        }
      }
    }
  } catch (error) {
    console.log('📋 Could not read config.yml file');
  }

  // 3. Try to get config from running backend on common ports
  try {
    const tryPorts = [8088, 8081, 8080, 8000]; // Put 8088 first since user mentioned it
    for (const port of tryPorts) {
      try {
        const healthUrl = `http://localhost:${port}/health`;
        const response = await fetch(healthUrl, { 
          method: 'GET',
          signal: AbortSignal.timeout(800)
        });
        
        if (response.ok) {
          console.log('📋 Found running backend at port:', port);
          return {
            port: port,
            protocol: 'http', // Start with HTTP, can upgrade to HTTPS if needed
            host: 'localhost'
          };
        }
      } catch (error) {
        // Continue to next port
      }
    }
  } catch (error) {
    console.log('📋 Could not detect running backend');
  }

  // 4. Fallback to intelligent defaults
  console.log('📋 Using intelligent default backend config');
  return {
    port: 8081, // Most common default
    protocol: 'http', 
    host: 'localhost'
  };
}

/**
 * Discover backend URL by reading config intelligently
 */
async function discoverBackendUrl(): Promise<string> {
  if (discoveredBackendUrl) {
    return discoveredBackendUrl;
  }

  if (discoveryPromise) {
    return discoveryPromise;
  }

  discoveryPromise = (async () => {
    try {
      // Read configuration intelligently
      const config = await readBackendConfig();
      const testUrl = `${config.protocol}://${config.host}:${config.port}`;
      
      console.log('🔍 Testing backend URL from config:', testUrl);
      
      // Verify the backend is actually running
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
        
        const response = await fetch(`${testUrl}/api/jira/config`, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log('✅ Backend verified at:', testUrl);
          discoveredBackendUrl = testUrl;
          
          // Store in sessionStorage for future use
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('discoveredBackendUrl', testUrl);
          }
          
          return testUrl;
        }
      } catch (error) {
        console.warn(`⚠️ Backend not responding at ${testUrl}:`, error.message);
      }
      
      // If configured URL doesn't work, fall back to port scanning
      console.log('🔍 Config-based URL failed, trying port discovery...');
      const fallbackPorts = [8088, 8081, 8080, 8000, 9000, 3001];
      const protocols = ['http', 'https'];
      
      for (const protocol of protocols) {
        for (const port of fallbackPorts) {
          const fallbackUrl = `${protocol}://localhost:${port}`;
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000);
            
            const response = await fetch(`${fallbackUrl}/api/jira/config`, {
              method: 'GET',
              signal: controller.signal,
              headers: { 'Accept': 'application/json' }
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              console.log('✅ Backend discovered via fallback at:', fallbackUrl);
              discoveredBackendUrl = fallbackUrl;
              
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('discoveredBackendUrl', fallbackUrl);
              }
              
              return fallbackUrl;
            }
          } catch (error) {
            // Continue trying other ports
          }
        }
      }
    } catch (error) {
      console.error('Error in backend discovery:', error);
    }
    
    // If all discovery fails, use intelligent default
    console.warn('⚠️ Backend auto-discovery failed, using intelligent default');
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
  
  // Second priority: Explicit backend URL from sessionStorage (set by settings)
  const storedBackendUrl = sessionStorage.getItem('backendUrl');
  if (storedBackendUrl) {
    return storedBackendUrl;
  }
  
  // Third priority: Environment-based detection
  const hostname = window.location.hostname;
  // If running on production domain, use production backend
  if (hostname.includes('tpm.prd.astra.nvidia.com') || hostname.includes('astra.nvidia.com')) {
    return 'https://tpm-nat.prd.astra.nvidia.com';
  }
  // If running on localhost, use local backend
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'http://localhost:8080';
  }
  
  // Fourth priority: Previously discovered backend URL
  const storedDiscoveredUrl = sessionStorage.getItem('discoveredBackendUrl');
  if (storedDiscoveredUrl) {
    return storedDiscoveredUrl;
  }
  
  // Fifth priority: Current chat completion URL from sessionStorage (UI settings)
  const storedChatURL = sessionStorage.getItem('chatCompletionURL');
  if (storedChatURL) {
    try {
      const url = new URL(storedChatURL);
      return `${url.protocol}//${url.host}`;
    } catch (error) {
      console.warn('Invalid stored chat URL:', storedChatURL);
    }
  }
  
  // Sixth priority: Environment variable base URL
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