// JIRA credential validation utilities
import { TPMError, createJIRAError, createNetworkError, createBackendError, parseResponseError } from './error-handler';

export interface JIRAValidationResult {
  isValid: boolean;
  error?: TPMError;
  user?: {
    displayName: string;
    username: string;
  };
}

/**
 * Validates JIRA credentials before attempting MFA flow
 * This provides clearer error messages and separates JIRA issues from MFA issues
 */
export const validateJIRACredentials = async (
  username: string, 
  token: string,
  backendUrl?: string  // Optional backend URL override
): Promise<JIRAValidationResult> => {
  if (!username || !token) {
    return {
      isValid: false,
      error: createJIRAError({
        message: 'Username and token are required',
        statusCode: 400,
        response: { detail: 'Please provide both JIRA username and token' }
      })
    };
  }

  try {
    const response = await fetch('/api/validate-jira', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(backendUrl && { 'x-backend-url': backendUrl }) // Pass backend URL if provided
      },
      body: JSON.stringify({
        username: username.trim(),
        token: token.trim(),
        ...(backendUrl && { backend_url: backendUrl }) // Also include in body
      }),
    });

    if (response.ok) {
      const result = await response.json();
      return {
        isValid: true,
        user: result.user
      };
    } else {
      // Parse the error response to determine the issue
      const errorData = await response.json().catch(() => ({}));
      
      console.log('🔍 JIRA validation error details:', {
        status: response.status,
        errorData,
        backendStatus: errorData.backend_status
      });
      
      // Handle specific backend connectivity issues (more comprehensive detection)
      if (response.status === 500 && errorData.backend_status === 'unreachable') {
        console.log('🔍 Detected backend unreachable error');
        return {
          isValid: false,
          error: createBackendError('JIRA validation - TPM backend server is not accessible')
        };
      }
      
      // Handle gateway/proxy errors (backend not responding)
      if (response.status >= 502 && response.status <= 504) {
        console.log('🔍 Detected gateway/proxy error');
        return {
          isValid: false,
          error: createBackendError('JIRA validation - TPM backend server is not accessible')
        };
      }
      
      // Handle JIRA credential issues (only when backend responded)
      if (response.status === 401 && errorData.backend_status === 'failed') {
        console.log('🔍 Detected JIRA credential error');
        return {
          isValid: false,
          error: createJIRAError({
            message: errorData.error || 'Invalid JIRA credentials',
            statusCode: response.status,
            response: errorData
          })
        };
      }
      
      // Default to backend error for 500s, JIRA error for auth issues, generic for others
      console.log('🔍 Unhandled error, defaulting based on status code');
      if (response.status >= 500) {
        return {
          isValid: false,
          error: createBackendError('JIRA validation - Server error, likely backend connectivity issue')
        };
      } else if (response.status === 401 || response.status === 403) {
        return {
          isValid: false,
          error: createJIRAError({
            message: errorData.error || 'Authentication failed',
            statusCode: response.status,
            response: errorData
          })
        };
      } else {
        return {
          isValid: false,
          error: createNetworkError(`JIRA validation failed (${response.status})`)
        };
      }
    }
  } catch (error) {
    console.error('JIRA validation network error:', error);
    return {
      isValid: false,
      error: createNetworkError('JIRA credential validation')
    };
  }
};

/**
 * Enhanced JIRA validation with retry logic for transient errors
 */
export const validateJIRACredentialsWithRetry = async (
  username: string,
  token: string,
  backendUrl?: string,  // Optional backend URL override
  maxRetries: number = 2
): Promise<JIRAValidationResult> => {
  let lastError: TPMError | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    const result = await validateJIRACredentials(username, token, backendUrl);
    
    if (result.isValid) {
      return result;
    }
    
    lastError = result.error;
    
    // Don't retry on credential errors (401, 403) or backend unavailable
    if (result.error?.type === 'JIRA_CREDENTIALS' || 
        result.error?.type === 'BACKEND_UNAVAILABLE') {
      break;
    }
    
    // Don't retry on the last attempt
    if (attempt <= maxRetries) {
      console.log(`JIRA validation attempt ${attempt} failed, retrying...`);
      // Wait a short time before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return {
    isValid: false,
    error: lastError
  };
};

/**
 * Check if the TPM backend server is running
 */
export const checkBackendAvailability = async (backendUrl?: string): Promise<boolean> => {
  try {
    let targetUrl = backendUrl;
    
    if (!targetUrl) {
      // Fallback to getting URL from sessionStorage or environment
      const storedChatURL = typeof window !== 'undefined' && window.sessionStorage 
        ? sessionStorage.getItem('chatCompletionURL') 
        : null;
      
      targetUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://127.0.0.1:9001'; // use env var or fallback to 9001
      
      if (storedChatURL) {
        // Extract base URL from stored chat completion URL
        const url = new URL(storedChatURL);
        targetUrl = `${url.protocol}//${url.host}`;
      }
    }
    
    // Try a simple connection to the backend's health endpoint
    const response = await fetch(`${targetUrl}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(3000) // 3 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Quick JIRA connection test (for status checks)
 */
export const testJIRAConnection = async (backendUrl?: string): Promise<boolean> => {
  return await checkBackendAvailability(backendUrl);
}; 