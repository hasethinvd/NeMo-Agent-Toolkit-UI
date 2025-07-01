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