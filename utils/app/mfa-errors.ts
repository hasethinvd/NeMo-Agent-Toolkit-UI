/**
 * Unified MFA Error Messages
 * Provides consistent error messaging across all MFA components
 */

export enum MFAErrorType {
  INVALID_CODE = 'INVALID_CODE',
  EXPIRED_CODE = 'EXPIRED_CODE',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  SETUP_FAILED = 'SETUP_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BACKEND_ERROR = 'BACKEND_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  OPERATION_IN_PROGRESS = 'OPERATION_IN_PROGRESS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  MFA_NOT_ENABLED = 'MFA_NOT_ENABLED',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

interface MFAErrorMessage {
  title: string;
  message: string;
  action?: string;
  icon: string;
}

const MFA_ERROR_MESSAGES: Record<MFAErrorType, MFAErrorMessage> = {
  [MFAErrorType.INVALID_CODE]: {
    title: 'Invalid Code',
    message: 'The code you entered is incorrect.',
    action: 'Please wait for a new code in your authenticator app and try again.',
    icon: '❌'
  },
  [MFAErrorType.EXPIRED_CODE]: {
    title: 'Code Expired',
    message: 'The code has expired.',
    action: 'Please wait for a new code (codes change every 30 seconds) and try again.',
    icon: '⏰'
  },
  [MFAErrorType.TOO_MANY_ATTEMPTS]: {
    title: 'Too Many Attempts',
    message: 'Too many failed attempts.',
    action: 'Please wait 30 seconds before trying again.',
    icon: '🔒'
  },
  [MFAErrorType.SETUP_FAILED]: {
    title: 'MFA Setup Failed',
    message: 'Failed to set up Multi-Factor Authentication.',
    action: 'Please try again. Make sure your authenticator app is working properly.',
    icon: '⚠️'
  },
  [MFAErrorType.NETWORK_ERROR]: {
    title: 'Connection Error',
    message: 'Unable to connect to the server.',
    action: 'Please check your internet connection and try again.',
    icon: '🌐'
  },
  [MFAErrorType.BACKEND_ERROR]: {
    title: 'Server Error',
    message: 'The server encountered an error.',
    action: 'Please try again in a moment. If the problem persists, contact support.',
    icon: '🔧'
  },
  [MFAErrorType.SESSION_EXPIRED]: {
    title: 'Session Expired',
    message: 'Your MFA session has expired.',
    action: 'Please verify your MFA again to continue.',
    icon: '🔐'
  },
  [MFAErrorType.OPERATION_IN_PROGRESS]: {
    title: 'Operation in Progress',
    message: 'Another MFA operation is currently running.',
    action: 'Please wait for the current operation to complete.',
    icon: '🔄'
  },
  [MFAErrorType.USER_NOT_FOUND]: {
    title: 'User Not Found',
    message: 'User information is missing.',
    action: 'Please enter your JIRA username first.',
    icon: '👤'
  },
  [MFAErrorType.MFA_NOT_ENABLED]: {
    title: 'MFA Not Set Up',
    message: 'Multi-Factor Authentication is not enabled for this user.',
    action: 'Please set up MFA first before trying to verify.',
    icon: '🔐'
  },
  [MFAErrorType.VALIDATION_ERROR]: {
    title: 'Validation Error',
    message: 'Please enter a valid 6-digit code.',
    action: 'Make sure you enter exactly 6 digits from your authenticator app.',
    icon: '📝'
  }
};

/**
 * Get formatted error message for MFA error type
 */
export function getMFAErrorMessage(errorType: MFAErrorType): MFAErrorMessage {
  return MFA_ERROR_MESSAGES[errorType];
}

/**
 * Show consistent MFA error toast
 */
export function showMFAError(errorType: MFAErrorType, customMessage?: string): void {
  const errorMsg = getMFAErrorMessage(errorType);
  const message = customMessage || errorMsg.message;
  const fullMessage = errorMsg.action ? `${message} ${errorMsg.action}` : message;
  
  // Import toast dynamically to avoid issues
  import('react-hot-toast').then(({ default: toast }) => {
    toast.error(`${errorMsg.icon} ${errorMsg.title}: ${fullMessage}`);
  });
}

/**
 * Show consistent MFA success toast
 */
export function showMFASuccess(message: string, icon: string = '🎉'): void {
  import('react-hot-toast').then(({ default: toast }) => {
    toast.success(`${icon} ${message}`);
  });
}

/**
 * Detect error type from response or error message
 */
export function detectMFAErrorType(error: any, statusCode?: number): MFAErrorType {
  const errorMessage = typeof error === 'string' ? error : error?.message || error?.error || '';
  const lowerMessage = errorMessage.toLowerCase();

  // Check status code first
  if (statusCode === 429) {
    return MFAErrorType.TOO_MANY_ATTEMPTS;
  }
  if (statusCode === 404) {
    return MFAErrorType.USER_NOT_FOUND;
  }
  if (statusCode >= 500) {
    return MFAErrorType.BACKEND_ERROR;
  }

  // Check error message content
  if (lowerMessage.includes('invalid') && lowerMessage.includes('code')) {
    return MFAErrorType.INVALID_CODE;
  }
  if (lowerMessage.includes('expired') || lowerMessage.includes('timeout')) {
    return MFAErrorType.EXPIRED_CODE;
  }
  if (lowerMessage.includes('too many') || lowerMessage.includes('attempts')) {
    return MFAErrorType.TOO_MANY_ATTEMPTS;
  }
  if (lowerMessage.includes('setup') && lowerMessage.includes('failed')) {
    return MFAErrorType.SETUP_FAILED;
  }
  if (lowerMessage.includes('session') && (lowerMessage.includes('expired') || lowerMessage.includes('invalid'))) {
    return MFAErrorType.SESSION_EXPIRED;
  }
  if (lowerMessage.includes('not enabled') || lowerMessage.includes('mfa not')) {
    return MFAErrorType.MFA_NOT_ENABLED;
  }
  if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
    return MFAErrorType.NETWORK_ERROR;
  }
  if (lowerMessage.includes('progress') || lowerMessage.includes('operation')) {
    return MFAErrorType.OPERATION_IN_PROGRESS;
  }
  if (lowerMessage.includes('6-digit') || lowerMessage.includes('valid code')) {
    return MFAErrorType.VALIDATION_ERROR;
  }

  // Default to backend error
  return MFAErrorType.BACKEND_ERROR;
}

/**
 * Handle MFA error with consistent messaging
 */
export function handleMFAError(error: any, statusCode?: number, customMessage?: string): void {
  const errorType = detectMFAErrorType(error, statusCode);
  showMFAError(errorType, customMessage);
}

/**
 * Common MFA success messages
 */
export const MFA_SUCCESS_MESSAGES = {
  SETUP_COMPLETE: 'MFA setup completed successfully!',
  VERIFICATION_SUCCESS: 'MFA verification successful!',
  SESSION_VALID: 'MFA session is valid',
  SETTINGS_SAVED: 'Settings saved with MFA protection'
} as const;
