// Utility to get the API base URL dynamically
export function getApiBaseUrl(): string {
  // Check for explicit environment variable first
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // Default to staging backend - no more localhost!
  return 'https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com';
}

// Get the full API URL for a specific endpoint
export function getApiUrl(endpoint: string): string {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
} 