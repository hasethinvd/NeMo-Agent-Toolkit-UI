import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import toast from 'react-hot-toast';
import { JiraStatus } from './JiraStatus';
import { clearJIRACredentials, getJIRACredentialStatus, setSecureJIRACredentials, getSecureJIRACredentials } from '../../utils/app/crypto';
import SecurityDashboard from './SecurityDashboard';
import { MFAVerifyModal } from './MFAVerifyModal';
import { validateJIRACredentialsWithRetry } from '@/utils/app/jira-validation';
import { showErrorToast, createMFAError, createNetworkError, createBackendError, parseResponseError } from '@/utils/app/error-handler';
import { getBackendUrl } from '@/utils/app/api-config';


interface Props {
  open: boolean;
  onClose: () => void;
}

// Helper function to safely access sessionStorage
const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return sessionStorage.getItem(key);
    }
    return null;
  },
  setItem: (key: string, value: string): void => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string): void => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.removeItem(key);
    }
  }
};

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    state: { lightMode, chatCompletionURL, webSocketURL, webSocketSchema: schema, expandIntermediateSteps, intermediateStepOverride, enableIntermediateSteps, webSocketSchemas },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [theme, setTheme] = useState<'light' | 'dark'>(lightMode);
  const [chatCompletionEndPoint, setChatCompletionEndPoint] = useState(chatCompletionURL || '');
  const [webSocketEndPoint, setWebSocketEndPoint] = useState(webSocketURL || '');
  const [webSocketSchema, setWebSocketSchema] = useState(schema || '');
  const [isIntermediateStepsEnabled, setIsIntermediateStepsEnabled] = useState(enableIntermediateSteps);
  const [detailsToggle, setDetailsToggle] = useState(expandIntermediateSteps);
  const [intermediateStepOverrideToggle, setIntermediateStepOverrideToggle] = useState(intermediateStepOverride);
  
  const [jiraUsernameValue, setJiraUsernameValue] = useState('');
  const [jiraTokenValue, setJiraTokenValue] = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [hasMFA, setHasMFA] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidatingJira, setIsValidatingJira] = useState(false);
  const [isCheckingMfa, setIsCheckingMfa] = useState(false);
  
  // MFA modal states
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [showMfaVerify, setShowMfaVerify] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<any>(null);
  const [mfaVerifyData, setMfaVerifyData] = useState<any>(null);
  const [mfaCode, setMfaCode] = useState('');

  // Load values from sessionStorage after component mounts (client-side only)
  useEffect(() => {
    const storedChatURL = safeSessionStorage.getItem('chatCompletionURL');
    const storedWebSocketURL = safeSessionStorage.getItem('webSocketURL');
    const storedWebSocketSchema = safeSessionStorage.getItem('webSocketSchema');
    const storedIntermediateSteps = safeSessionStorage.getItem('enableIntermediateSteps');
    const storedExpandSteps = safeSessionStorage.getItem('expandIntermediateSteps');
    const storedStepOverride = safeSessionStorage.getItem('intermediateStepOverride');

    if (storedChatURL) setChatCompletionEndPoint(storedChatURL);
    if (storedWebSocketURL) setWebSocketEndPoint(storedWebSocketURL);
    if (storedWebSocketSchema) setWebSocketSchema(storedWebSocketSchema);
    if (storedIntermediateSteps !== null) {
      setIsIntermediateStepsEnabled(storedIntermediateSteps === 'true');
    }
    if (storedExpandSteps !== null) {
      setDetailsToggle(storedExpandSteps === 'true');
    }
    if (storedStepOverride !== null) {
      setIntermediateStepOverrideToggle(storedStepOverride !== 'false');
    }
  }, []);

  // Load JIRA credentials and MFA status on component mount
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        // Check if credentials exist
        const status = getJIRACredentialStatus();
        const hasJiraCredentials = !!status?.fingerprint;
        setHasCredentials(hasJiraCredentials);
        
        // Get actual credentials if they exist
        let userId = 'aiq-tpm-system';
        if (hasJiraCredentials) {
          try {
            const credentials = await getSecureJIRACredentials();
            if (credentials?.username) {
              setJiraUsernameValue(credentials.username);
              setJiraTokenValue(credentials.token);
              userId = credentials.username;
            }
          } catch (error) {
            console.log('Could not get JIRA credentials:', error);
          }
        }
        
        // Check MFA status using sessionStorage backend URL
        // Get backend URL from sessionStorage or fallback to environment variable
        const storedChatURL = safeSessionStorage.getItem('chatCompletionURL');
        let backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://0.0.0.0:8000'; // use env var or fallback to 8000
        
        if (storedChatURL) {
          // Extract base URL from stored chat completion URL
          const url = new URL(storedChatURL);
          backendUrl = `${url.protocol}//${url.host}`;
        }
        
        try {
          const mfaResponse = await fetch(`${backendUrl}/api/mfa/status?user_id=${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (mfaResponse.ok) {
            const mfaData = await mfaResponse.json();
            setHasMFA(mfaData.enabled);
          }
        } catch (mfaError) {
          console.log('MFA status check failed (this is normal if backend is not running):', mfaError);
          setHasMFA(false);
        }
      } catch (error) {
        console.error('Error loading credentials:', error);
      }
    };
    
    if (open) {
      loadCredentials();
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close settings dialog when MFA modals are open
      if (showMfaSetup || showMfaVerify) {
        console.log('Ignoring click outside because MFA modal is open');
        return;
      }
      
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  // Validate basic settings fields
  const validateSettings = (): boolean => {
    if (!chatCompletionEndPoint || !webSocketEndPoint) {
      toast.error('Please fill in both Chat Completion URL and WebSocket URL');
      return false;
    }
    return true;
  };

  // Validate JIRA credentials upfront before starting MFA flow
  const validateAndProcessJiraCredentials = async (): Promise<boolean> => {
    if (!jiraUsernameValue || !jiraTokenValue) {
      return true; // No JIRA credentials to validate, proceed with settings save
    }

    console.log('🔐 Validating JIRA credentials for user:', jiraUsernameValue);
    setIsValidatingJira(true);

    try {
      // Use the current form's backend URL instead of sessionStorage
      let currentBackendUrl: string | undefined;
      try {
        if (chatCompletionEndPoint) {
          currentBackendUrl = new URL(chatCompletionEndPoint).origin;
          console.log('🔗 Using backend URL for validation:', currentBackendUrl);
        }
      } catch (urlError) {
        console.warn('🔗 Invalid chat completion URL, using default:', chatCompletionEndPoint);
        // Will use default backend URL in validation
      }
      
      const validation = await validateJIRACredentialsWithRetry(
        jiraUsernameValue.trim(),
        jiraTokenValue.trim(),
        currentBackendUrl
      );

      if (!validation.isValid) {
        console.log('🔍 JIRA validation failed:', {
          errorType: validation.error?.type,
          errorMessage: validation.error?.message,
          technicalDetails: validation.error?.technicalDetails,
          backendUrl: currentBackendUrl
        });
        
        showErrorToast(validation.error!);
        
        // Provide appropriate recovery guidance based on error type
        if (validation.error?.type === 'BACKEND_UNAVAILABLE') {
          handleRecoveryActions('backend');
        } else if (validation.error?.type === 'JIRA_CREDENTIALS') {
          handleRecoveryActions('jira');
        } else {
          handleRecoveryActions('network');
        }
        
        return false;
      }

      console.log('✅ JIRA credentials are valid, proceeding with MFA flow');
      return await handleMfaFlow();
         } catch (error) {
       console.error('JIRA validation error:', error);
       showErrorToast(createNetworkError('JIRA credential validation'));
       handleRecoveryActions('network');
       return false;
     } finally {
       setIsValidatingJira(false);
     }
  };

  // Handle MFA flow after JIRA validation
  const handleMfaFlow = async (): Promise<boolean> => {
    setIsCheckingMfa(true);
    
    try {
      const backendUrl = getCurrentBackendUrl();
      const mfaStatus = await checkMfaStatus(backendUrl);
      
      if (!mfaStatus.enabled) {
        // MFA not set up - show setup modal
        return await initiateMfaSetup(backendUrl);
      } else {
        // MFA is set up - check session validity
        return await validateMfaSession(backendUrl);
      }
    } catch (error) {
      console.error('MFA flow error:', error);
      showErrorToast(createMFAError({ message: 'Failed to check MFA status', isSetup: false }));
      return false;
    } finally {
      setIsCheckingMfa(false);
    }
  };

  // Get backend URL from current settings - now using the imported centralized function
  // but override with current UI state if user is actively editing
  const getCurrentBackendUrl = (): string => {
    if (chatCompletionEndPoint) {
      const url = new URL(chatCompletionEndPoint);
      return `${url.protocol}//${url.host}`;
    }
    // Fall back to the centralized function for consistent behavior
    return getBackendUrl();
  };



  // Check MFA status from backend
  const checkMfaStatus = async (backendUrl: string) => {
    const response = await fetch(`${backendUrl}/api/mfa/status?user_id=${jiraUsernameValue}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status >= 500) {
        throw createBackendError('MFA status check');
      } else {
        throw createMFAError({ message: `MFA status check failed (${response.status})` });
      }
    }

    return response.json();
  };

  // Initiate MFA setup
  const initiateMfaSetup = async (backendUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/api/mfa/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: jiraUsernameValue,
          user_email: `${jiraUsernameValue}@nvidia.com`,
          force_new: false
        }),
      });

      if (!response.ok) {
        throw createMFAError({ message: 'MFA setup request failed', isSetup: true });
      }

      const setupData = await response.json();
      if (!setupData.success) {
        throw createMFAError({ message: setupData.error || 'MFA setup failed', isSetup: true });
      }

      // Show MFA setup modal
      setMfaSetupData({
        qr_code: setupData.qr_code,
        backup_codes: setupData.backup_codes || [],
        is_existing: setupData.is_existing || false,
        username: jiraUsernameValue,
        email: `${jiraUsernameValue}@nvidia.com`
      });
      setShowMfaSetup(true);

      if (setupData.is_existing) {
        toast.success('🔐 Using your existing MFA setup. Enter a code from your authenticator app.');
      } else {
        toast.success('🔐 MFA setup initiated. Please scan the QR code and verify.');
      }

             return false; // Don't continue with save - wait for MFA verification
     } catch (error) {
       showErrorToast(error instanceof Error ? error : createMFAError({ 
         message: 'MFA setup failed', 
         isSetup: true 
       }));
       return false;
     }
  };

  // Validate existing MFA session
  const validateMfaSession = async (backendUrl: string): Promise<boolean> => {
    const storedSessionId = safeSessionStorage.getItem('mfa_session_id');
    const storedSessionUser = safeSessionStorage.getItem('mfa_session_user');

    if (!storedSessionId || storedSessionUser !== jiraUsernameValue) {
      // No active session - require MFA verification
      return await requireMfaVerification();
    }

    try {
      // Validate existing session
      const response = await fetch(`${backendUrl}/api/mfa/session/validate?session_id=${storedSessionId}&user_id=${jiraUsernameValue}`);
      
      if (!response.ok) {
        // Session expired
        clearMfaSession();
        return await requireMfaVerification();
      }

      const sessionData = await response.json();
      if (!sessionData.valid) {
        // Session invalid
        clearMfaSession();
        return await requireMfaVerification();
      }

      // Session is valid - proceed with save
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
      clearMfaSession();
      return await requireMfaVerification();
    }
  };

  // Require MFA verification
  const requireMfaVerification = async (): Promise<boolean> => {
    setMfaVerifyData({
      username: jiraUsernameValue,
      email: `${jiraUsernameValue}@nvidia.com`
    });
    setShowMfaVerify(true);
    toast('🔐 Please verify your MFA to complete JIRA setup.');
    return false; // Don't continue with save - wait for MFA verification
  };

  // Clear MFA session data
  const clearMfaSession = () => {
    safeSessionStorage.removeItem('mfa_session_id');
    safeSessionStorage.removeItem('mfa_session_user');
  };

  // Save application settings (non-JIRA)
  const saveApplicationSettings = () => {
    // Update Redux state
    homeDispatch({ field: 'lightMode', value: theme });
    homeDispatch({ field: 'chatCompletionURL', value: chatCompletionEndPoint });
    homeDispatch({ field: 'webSocketURL', value: webSocketEndPoint });
    homeDispatch({ field: 'webSocketSchema', value: webSocketSchema });
    homeDispatch({ field: 'expandIntermediateSteps', value: detailsToggle });
    homeDispatch({ field: 'intermediateStepOverride', value: intermediateStepOverrideToggle });
    homeDispatch({ field: 'enableIntermediateSteps', value: isIntermediateStepsEnabled });
    
    // Update session storage
    safeSessionStorage.setItem('chatCompletionURL', chatCompletionEndPoint);
    safeSessionStorage.setItem('webSocketURL', webSocketEndPoint);
    safeSessionStorage.setItem('webSocketSchema', webSocketSchema);
    safeSessionStorage.setItem('backendUrl', chatCompletionEndPoint.replace('/chat/stream', ''));
    safeSessionStorage.setItem('expandIntermediateSteps', String(detailsToggle));
    safeSessionStorage.setItem('intermediateStepOverride', String(intermediateStepOverrideToggle));
    safeSessionStorage.setItem('enableIntermediateSteps', String(isIntermediateStepsEnabled));

    // Dispatch events
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('websocket-settings-changed'));
    window.dispatchEvent(new Event('jira-credentials-changed'));
  };

  // Main save handler - much cleaner and more linear
  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicking
    
    console.log('🔧 Starting save process...');
    setIsSaving(true);

    try {
      // Step 1: Validate basic settings
      if (!validateSettings()) {
        return;
      }

      // Step 2: Validate JIRA credentials (if provided) and handle MFA
      const shouldProceed = await validateAndProcessJiraCredentials();
      if (!shouldProceed) {
        return; // MFA modal will be shown, wait for user interaction
      }

      // Step 3: Save application settings
      saveApplicationSettings();

      // Step 4: Success
      toast.success('Settings saved successfully');
      onClose();
      
         } catch (error) {
       console.error('Save error:', error);
       showErrorToast(createNetworkError('saving settings'));
       handleRecoveryActions('network');
     } finally {
       setIsSaving(false);
     }
  };

  const resetMfaModalStates = () => {
    setShowMfaSetup(false);
    setShowMfaVerify(false);
    setMfaSetupData(null);
    setMfaVerifyData(null);
    setMfaCode('');
  };

  // Enhanced error recovery - help users recover from various failure states
  const handleRecoveryActions = (errorType: string) => {
    switch (errorType) {
      case 'network':
        toast('💡 Check internet connection and try again', {
          duration: 8000,
          icon: '🔧',
        });
        break;
      case 'backend':
        const currentUrl = chatCompletionEndPoint || 'Not set';
        toast(`💡 Backend not accessible: ${currentUrl}\n• Start TPM backend server\n• Check port is correct`, {
          duration: 10000,
          icon: '🔧',
        });
        break;
      case 'jira':
        toast('💡 Check JIRA username/token or try new token', {
          duration: 8000,
          icon: '🔧',
        });
        break;
      case 'mfa':
        toast('💡 Wait for new MFA code and try again', {
          duration: 8000,
          icon: '🔧',
        });
        break;
      default:
        toast('💡 Try refreshing the page', {
          duration: 6000,
          icon: '🔧',
        });
    }
  };

  const handleClearJira = async () => {
    try {
      let clearedItems = [];
      
      // Clear JIRA credentials if they exist
      if (hasCredentials) {
        clearJIRACredentials();
        setHasCredentials(false);
        setJiraUsernameValue('');
        setJiraTokenValue('');
        clearedItems.push('JIRA credentials');
      }
      
      // Clear MFA session but keep the authenticator account
      if (hasMFA) {
        try {
          // Clear any stored MFA session data (disconnects MFA but keeps the secret)
          safeSessionStorage.removeItem('mfa_session_id');
          safeSessionStorage.removeItem('mfa_session_user');
          clearedItems.push('MFA session (authenticator account preserved)');
        } catch (mfaError) {
          console.error('Error clearing MFA session:', mfaError);
          toast.error('Error clearing MFA session');
          return;
        }
      }
      
      // Reset MFA modal states to ensure clean state
      setShowMfaSetup(false);
      setShowMfaVerify(false);
      setMfaSetupData(null);
      setMfaVerifyData(null);
      setMfaCode('');
      
      // Dispatch events to notify other components
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('websocket-settings-changed'));
      window.dispatchEvent(new Event('jira-credentials-changed'));
      
      if (clearedItems.length > 0) {
        toast.success(`${clearedItems.join(' and ')} cleared successfully`);
      }
    } catch (error) {
      console.error('Error clearing security settings:', error);
      toast.error('Error clearing security settings');
    }
  };



  const handleMfaVerification = async (isVerifyOnly: boolean) => {
    // Basic validation
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    const userId = isVerifyOnly ? mfaVerifyData?.username : mfaSetupData?.username;
    if (!userId) {
      toast.error('User information missing. Please restart the setup process.');
      resetMfaModalStates();
      return;
    }

    console.log('🔐 MFA Verification starting for user:', userId);
    setIsCheckingMfa(true);

    try {
      // Use consistent backend URL that prioritizes UI settings over environment variables
      const backendUrl = getBackendUrl();
      
      // Add timeout to handle network issues
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch(`${backendUrl}/api/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          code: mfaCode,
          is_backup_code: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Store the session ID
          if (data.session_id) {
            safeSessionStorage.setItem('mfa_session_id', data.session_id);
            safeSessionStorage.setItem('mfa_session_user', userId);
          }
          
          // Close modals
          setShowMfaSetup(false);
          setShowMfaVerify(false);
          setMfaCode('');
          
          toast.success('🎉 MFA verified successfully! Now saving your JIRA credentials...');
          
          // Continue with JIRA credential save
          setTimeout(async () => {
            await continueJiraSave();
          }, 500);
        } else {
          // Handle specific MFA error cases
          const mfaError = createMFAError({
            message: data.error || 'Invalid MFA code',
            code: mfaCode
          });
          showErrorToast(mfaError);
          handleRecoveryActions('mfa');
          
          // Don't close modals on invalid code - let user try again
          setMfaCode('');
        }
      } else {
        // Handle HTTP errors
        const error = await parseResponseError(response, 'MFA verification');
        showErrorToast(error);
        
        // For serious errors, close modals and return to settings
        if (response.status >= 500) {
          resetMfaModalStates();
        } else {
          // For client errors (like rate limiting), just clear the code
          setMfaCode('');
        }
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      
      if (error instanceof Error && error.name === 'AbortError') {
        // Timeout error
        showErrorToast(createNetworkError('MFA verification (timeout)'));
        handleRecoveryActions('network');
      } else {
        // Network or other error
        showErrorToast(createNetworkError('MFA verification'));
        handleRecoveryActions('network');
      }
      
      // Don't close modals for network issues - user might want to retry
      setMfaCode('');
    } finally {
      setIsCheckingMfa(false);
    }
  };

  const continueJiraSave = async () => {
    try {
      setIsSaving(true);
      console.log('🔐 Final JIRA save step: Testing connection and saving credentials');
      
      const backendUrl = safeSessionStorage.getItem('backendUrl') || 
                       process.env.NEXT_PUBLIC_BACKEND_URL ||
                       `${process.env.NEXT_PUBLIC_API_PROTOCOL || 'https'}://${process.env.NEXT_PUBLIC_API_HOST || '0.0.0.0'}:${process.env.NEXT_PUBLIC_API_PORT || '8000'}`;
      
      const response = await fetch(`${backendUrl}/api/mfa/jira/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${jiraUsernameValue}:${jiraTokenValue}`)}`,
        },
      });

      if (response.ok) {
        await setSecureJIRACredentials({ username: jiraUsernameValue, token: jiraTokenValue });
        toast.success('🎉 JIRA credentials saved securely with MFA protection!');
        
        // Update states and close dialog
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('websocket-settings-changed'));
        window.dispatchEvent(new Event('jira-credentials-changed'));
        onClose();
      } else {
        // JIRA validation failed after MFA verification - this is confusing for users
        const jiraError = await parseResponseError(response, 'JIRA validation');
        
        // Clear MFA session since we need to start over
        clearMfaSession();
        resetMfaModalStates();
        
        // Show clear error about JIRA credentials, not MFA
        showErrorToast(jiraError);
        
        // Additional guidance for the user
        handleRecoveryActions('jira');
      }
    } catch (error) {
      console.error('JIRA save error:', error);
      
      // Clear MFA session since we need to start over
      clearMfaSession();
      resetMfaModalStates();
      
      // Show network error instead of confusing MFA message
      showErrorToast(createNetworkError('saving JIRA credentials'));
      handleRecoveryActions('network');
    } finally {
      setIsSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Main Settings Dialog */}
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50 dark:bg-opacity-20 p-4">
      <div
        ref={modalRef}
        className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-[#202123] rounded-2xl shadow-lg transform transition-all relative overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('Settings')}</h2>
        </div>

        {/* Scrollable Content */}
        <div className="px-4 py-3 overflow-y-auto max-h-[calc(90vh-120px)] space-y-4">
          {/* General Settings */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>⚙️</span>
              <span>General Settings</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('Theme')}</label>
                <select
                  className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                >
                  <option value="dark">{t('Dark mode')}</option>
                  <option value="light">{t('Light mode')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('WebSocket Schema')}</label>
                <select
                  className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                  value={webSocketSchema}
                  onChange={(e) => setWebSocketSchema(e.target.value)}
                >
                  {webSocketSchemas?.map((schema) => (
                    <option key={schema} value={schema}>
                      {schema}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('HTTP / HTTPS URL for Chat Completion')}</label>
                <input
                  type="text"
                  value={chatCompletionEndPoint}
                  onChange={(e) => setChatCompletionEndPoint(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('WebSocket URL for Chat Completion')}</label>
                <input
                  type="text"
                  value={webSocketEndPoint}
                  onChange={(e) => setWebSocketEndPoint(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                />
              </div>

              {/* Intermediate Steps Options */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2.5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Intermediate Steps</h4>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableIntermediateSteps"
                    checked={isIntermediateStepsEnabled}
                    onChange={() => setIsIntermediateStepsEnabled(!isIntermediateStepsEnabled)}
                    className="mr-3 rounded"
                  />
                  <label htmlFor="enableIntermediateSteps" className="text-sm text-gray-700 dark:text-gray-300">
                    Enable Intermediate Steps
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="detailsToggle"
                    checked={detailsToggle}
                    onChange={() => setDetailsToggle(!detailsToggle)}
                    disabled={!isIntermediateStepsEnabled}
                    className="mr-3 rounded"
                  />
                  <label htmlFor="detailsToggle" className="text-sm text-gray-700 dark:text-gray-300">
                    Expand Intermediate Steps by default
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="intermediateStepOverrideToggle"
                    checked={intermediateStepOverrideToggle}
                    onChange={() => setIntermediateStepOverrideToggle(!intermediateStepOverrideToggle)}
                    disabled={!isIntermediateStepsEnabled}
                    className="mr-3 rounded"
                  />
                  <label htmlFor="intermediateStepOverrideToggle" className="text-sm text-gray-700 dark:text-gray-300">
                    Override intermediate Steps with same Id
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Security & JIRA Section */}
          <div className="space-y-4">
            {/* Security Dashboard */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-1">
              <SecurityDashboard />
            </div>

            {/* JIRA Integration */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2.5">
                <span className="text-base">🔗</span>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">JIRA Integration</h3>
              </div>
              
              <div className="space-y-3">
                <JiraStatus />
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('JIRA Username')}</label>
                    <input
                      type="text"
                      value={jiraUsernameValue}
                      onChange={(e) => setJiraUsernameValue(e.target.value)}
                      placeholder="Enter username"
                      className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('JIRA Token')}</label>
                    <input
                      type="password"
                      value={jiraTokenValue}
                      onChange={(e) => setJiraTokenValue(e.target.value)}
                      placeholder="Enter API token"
                      className="w-full p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-300 dark:border-gray-600 text-sm"
                    />
                  </div>

                  {/* Clear JIRA Settings Button */}
                  <div className="pt-2.5 border-t border-gray-200 dark:border-gray-600">
                    <button
                      type="button"
                      onClick={handleClearJira}
                      className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      Clear JIRA Settings
                    </button>
                  </div>


                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-end items-center">
            <div className="flex gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                onClick={onClose}
              >
                {t('Cancel')}
              </button>
              <button
                type="button"
                className="px-6 py-2 rounded-lg text-white bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                onClick={handleSave}
                disabled={isSaving || isValidatingJira || isCheckingMfa}
              >
                {(isSaving || isValidatingJira || isCheckingMfa) ? (
                  <span className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>
                      {isValidatingJira && '🔐 Validating JIRA...'}
                      {isCheckingMfa && '🔒 Checking MFA...'}
                      {isSaving && !isValidatingJira && !isCheckingMfa && '💾 Saving...'}
                    </span>
                  </span>
                ) : (
                  <span>{t('Save')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* MFA Setup Modal - Outside main dialog */}
      {showMfaSetup && mfaSetupData && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ 
            zIndex: 999999,
            pointerEvents: 'auto',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onClick={(e) => {
            console.log('MFA Setup Modal backdrop clicked');
            e.preventDefault();
            e.stopPropagation();
            // Don't close on backdrop click to prevent accidental closing
            // User must use the X button to close
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700"
            style={{ 
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 1000000
            }}
            onClick={(e) => {
              console.log('MFA Setup Modal content clicked');
              e.stopPropagation();
            }}
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">🔐 Complete MFA Setup</h3>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('MFA Setup close button mouse down');
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('MFA Setup close button clicked');
                    setTimeout(() => {
                      setShowMfaSetup(false);
                    }, 10);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  style={{ 
                    pointerEvents: 'auto', 
                    zIndex: 1000001,
                    position: 'relative'
                  }}
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="space-y-6">
                {/* QR Code - Always Show */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {mfaSetupData.is_existing ? 'Your Authenticator QR Code' : 'Scan QR Code'}
                  </h4>
                  
                  {mfaSetupData.is_existing && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
                      <p className="text-blue-700 dark:text-blue-300 text-sm">
                        💡 <strong>Account already exists in your authenticator app:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{mfaSetupData.email}</code>
                        <br />You can use your existing entry or scan this QR code again if needed.
                      </p>
                    </div>
                  )}
                  
                  {/* Always show QR code */}
                  <div className="flex justify-center">
                    <div className="p-6 bg-white rounded-xl shadow-inner border-2 border-gray-200">
                      <img
                        src={`data:image/png;base64,${mfaSetupData.qr_code}`}
                        alt="MFA QR Code"
                        className="w-48 h-48 rounded-lg"
                      />
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Account: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{mfaSetupData.email}</code>
                    </p>
                  </div>
                </div>

                {/* Verification */}
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Enter Verification Code</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Enter the 6-digit code from your authenticator app to complete setup:
                  </p>
                  
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={mfaCode}
                      onChange={(e) => {
                        console.log('MFA input changed:', e.target.value);
                        setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      }}
                      onClick={(e) => {
                        console.log('MFA input clicked');
                        e.stopPropagation();
                      }}
                      onFocus={() => console.log('MFA input focused')}
                      placeholder="000000"
                      className="flex-1 px-4 py-3 text-center text-xl font-mono border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      maxLength={6}
                      style={{ 
                        pointerEvents: 'auto',
                        zIndex: 1000001,
                        position: 'relative'
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('MFA Setup complete button mouse down');
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('MFA Setup complete button clicked');
                        
                        // Use setTimeout to ensure the event is fully handled
                        setTimeout(() => {
                          handleMfaVerification(false);
                        }, 10);
                      }}
                      disabled={mfaCode.length !== 6}
                      className="px-6 py-3 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      style={{ 
                        pointerEvents: 'auto', 
                        zIndex: 1000001,
                        position: 'relative'
                      }}
                    >
                      Complete Setup
                    </button>
                  </div>
                  
                                <div className="space-y-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  This creates a 24-hour session for JIRA operations.
                </div>

              </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MFA Verification Modal */}
      {console.log('🔍 Debug: Checking MFA modal render condition:', {
        showMfaVerify: showMfaVerify,
        mfaVerifyData: mfaVerifyData,
        condition: !!(showMfaVerify && mfaVerifyData)
      })}
      {showMfaVerify && mfaVerifyData && (
        <MFAVerifyModal 
          isOpen={showMfaVerify}
          onClose={() => {
            resetMfaModalStates();
            toast('MFA verification cancelled. Please try again when ready.');
          }}
          userEmail={mfaVerifyData.email}
          userName={mfaVerifyData.username}
          mfaCode={mfaCode}
          setMfaCode={setMfaCode}
          onVerify={() => handleMfaVerification(true)}
          existingQrCode={mfaVerifyData.qr_code || mfaSetupData?.qr_code}
        />
      )}
    </div>
    </>
  );
};
