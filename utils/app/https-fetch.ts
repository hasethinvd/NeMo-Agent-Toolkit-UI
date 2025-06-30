import https from 'https';

// Create an HTTPS agent that ignores self-signed certificate errors
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Ignore self-signed certificate errors
});

// Custom fetch function for HTTPS requests with self-signed certificates
export async function httpsFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Only use the custom agent for HTTPS URLs in server-side contexts
  if (typeof window === 'undefined' && url.startsWith('https://localhost')) {
    // For Node.js environment (server-side), we need to handle self-signed certs
    const fetchOptions = {
      ...options,
      // @ts-ignore - Node.js fetch supports agent option
      agent: httpsAgent,
    };
    return fetch(url, fetchOptions);
  }
  
  // For client-side or non-localhost HTTPS, use regular fetch
  return fetch(url, options);
} 