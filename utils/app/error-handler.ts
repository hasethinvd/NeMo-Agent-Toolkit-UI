// Error handling utilities for better user feedback
import { toast } from 'react-hot-toast';

export enum ErrorType {
  JIRA_CREDENTIALS = 'JIRA_CREDENTIALS',
  MFA_VERIFICATION = 'MFA_VERIFICATION', 
  NETWORK_CONNECTION = 'NETWORK_CONNECTION',
  BACKEND_UNAVAILABLE = 'BACKEND_UNAVAILABLE',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED'
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  userAction?: string;
  technicalDetails?: string;
}

export class TPMError extends Error {
  public readonly type: ErrorType;
  public readonly userAction?: string;
  public readonly technicalDetails?: string;

  constructor(details: ErrorDetails) {
    super(details.message);
    this.type = details.type;
    this.userAction = details.userAction;
    this.technicalDetails = details.technicalDetails;
    this.name = 'TPMError';
  }
}

// Helper functions to create specific error types
export const createJIRAError = (details: { 
  message: string; 
  statusCode?: number; 
  response?: any;
}): TPMError => {
  let userMessage = 'JIRA credentials validation failed';
  let userAction = 'Please check your JIRA username and token, then try again.';

  // Customize message based on status code or response
  if (details.statusCode === 401) {
    userMessage = 'Invalid JIRA credentials';
    userAction = 'Please verify your JIRA username and token are correct. Generate a new token at https://jirasw.nvidia.com/plugins/servlet/de.resolution.apitokenauth/admin if needed.';
  } else if (details.statusCode === 403) {
    userMessage = 'JIRA access denied';
    userAction = 'Your JIRA token may have expired or lacks necessary permissions. Please generate a new token.';
  } else if (details.statusCode === 429) {
    userMessage = 'Too many JIRA requests';
    userAction = 'Please wait a moment and try again.';
  } else if (details.statusCode && details.statusCode >= 500) {
    userMessage = 'JIRA server error';
    userAction = 'The JIRA server is experiencing issues. Please try again later.';
  } else if (details.response?.detail) {
    userMessage = `JIRA validation failed: ${details.response.detail}`;
  }

  return new TPMError({
    type: ErrorType.JIRA_CREDENTIALS,
    message: userMessage,
    userAction,
    technicalDetails: details.message
  });
};

export const createMFAError = (details: {
  message: string;
  code?: string;
  isSetup?: boolean;
}): TPMError => {
  let userMessage = 'MFA verification failed';
  let userAction = 'Please enter a valid 6-digit code from your authenticator app.';

  if (details.message.includes('Invalid MFA code') || details.message.includes('invalid code')) {
    userMessage = 'Invalid MFA code';
    userAction = 'Please wait for a new code in your authenticator app and try again. Codes change every 30 seconds.';
  } else if (details.message.includes('session')) {
    userMessage = 'MFA session expired';
    userAction = 'Please verify your MFA again to continue.';
  } else if (details.isSetup) {
    userMessage = 'MFA setup failed';
    userAction = 'Please try setting up MFA again. Make sure your authenticator app is working properly.';
  }

  return new TPMError({
    type: ErrorType.MFA_VERIFICATION,
    message: userMessage,
    userAction,
    technicalDetails: details.message
  });
};

export const createNetworkError = (operation: string): TPMError => {
  return new TPMError({
    type: ErrorType.NETWORK_CONNECTION,
    message: 'Network connection failed',
    userAction: `Failed to connect to the server during ${operation}. Please check your internet connection and server settings.`,
    technicalDetails: `Network error during ${operation}`
  });
};

export const createBackendError = (operation: string): TPMError => {
  const isJiraValidation = operation.includes('JIRA validation');
  
  return new TPMError({
    type: ErrorType.BACKEND_UNAVAILABLE,
    message: isJiraValidation ? 'TPM Backend server not reachable' : 'Backend server unavailable',
    userAction: isJiraValidation 
      ? `Check your TPM backend server is running on the correct port`
      : `The backend server is not responding during ${operation}. Please ensure the server is running and try again.`,
    technicalDetails: `Backend unavailable during ${operation}`
  });
};

// Enhanced toast error function with better formatting
export const showErrorToast = (error: TPMError | Error | string): void => {
  if (error instanceof TPMError) {
    // Main error message
    toast.error(error.message, {
      duration: 6000,
      style: {
        maxWidth: '500px',
      },
    });
    
    // User action message (if provided)
    if (error.userAction) {
      setTimeout(() => {
        toast(error.userAction!, {
          icon: '💡',
          duration: 8000,
          style: {
            background: '#f3f4f6',
            color: '#374151',
            maxWidth: '500px',
          },
        });
      }, 500);
    }
  } else if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error(error);
  }
};

// Helper to determine error type from response
export const parseResponseError = async (response: Response, operation: string): Promise<TPMError> => {
  try {
    const errorData = await response.json();
    
    if (operation.includes('jira') || operation.includes('JIRA')) {
      return createJIRAError({
        message: errorData.detail || errorData.error || 'Unknown JIRA error',
        statusCode: response.status,
        response: errorData
      });
    } else if (operation.includes('mfa') || operation.includes('MFA')) {
      return createMFAError({
        message: errorData.error || errorData.detail || 'Unknown MFA error',
        code: errorData.code
      });
    } else {
      return new TPMError({
        type: ErrorType.VALIDATION_FAILED,
        message: errorData.error || errorData.detail || `${operation} failed`,
        userAction: 'Please try again or contact support if the issue persists.',
        technicalDetails: JSON.stringify(errorData)
      });
    }
  } catch (parseError) {
    // If response is not JSON, create generic error
    return new TPMError({
      type: ErrorType.VALIDATION_FAILED,
      message: `${operation} failed (${response.status})`,
      userAction: 'Please try again or contact support if the issue persists.',
      technicalDetails: `HTTP ${response.status} - Could not parse response`
    });
  }
}; 