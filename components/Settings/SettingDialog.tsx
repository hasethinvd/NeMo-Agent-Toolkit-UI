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
  const [lastErrorType, setLastErrorType] = useState<string | null>(null);
  const [errorCooldown, setErrorCooldown] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');

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

  // Reset error state after timeout to prevent spam
  useEffect(() => {
    if (errorCooldown) {
      const timer = setTimeout(() => {
        setErrorCooldown(false);
        setLastErrorType(null);
      }, 3000); // 3 second cooldown
      return () => clearTimeout(timer);
    }
  }, [errorCooldown]);

  // Get the backend URL that will be used after save
  const getTargetBackendUrl = (): string => {
    try {
      if (chatCompletionEndPoint) {
        return new URL(chatCompletionEndPoint).origin;
      }
    } catch (urlError) {
      console.warn('🔗 Invalid chat completion URL format, using default');
    }
    return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://127.0.0.1:8080';
  };

  // Handle MFA flow after JIRA validation
  const handleMfaFlow = async (): Promise<boolean> => {
    try {
      setCurrentStep('Setting up MFA...');
      
      // Call the actual MFA setup API to get QR code
      const targetBackendUrl = getTargetBackendUrl();
      const response = await fetch(`${targetBackendUrl}/api/mfa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: jiraUsernameValue,
          user_email: `${jiraUsernameValue}@nvidia.com`,
          force_new: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 MFA setup response data:', data);
        
        if (data.success) {
          // Handle different possible API response formats
          const qrCodeData = data.qr_code || data.qr_code_data || data.qrCode || '';
          
          if (!qrCodeData) {
            console.warn('🔐 No QR code data in response:', Object.keys(data));
          }
          
          setMfaSetupData({
            username: jiraUsernameValue,
            email: `${jiraUsernameValue}@nvidia.com`,
            qrCodeUrl: data.qr_code_url || '',
            secret: data.secret || '',
            qr_code: qrCodeData, // This is the base64 QR code image
            is_existing: data.is_existing || false,
            backup_codes: data.backup_codes || []
          });
          
          console.log('🔐 Setting MFA setup data with QR code length:', qrCodeData.length);
          setShowMfaSetup(true);
          setCurrentStep(''); // Clear step indicator when modal is shown
          return true; // Success - waiting for user input, not failure
        } else {
          throw new Error(data.error || 'MFA setup failed');
        }
      } else {
        const errorText = await response.text();
        console.error('🔐 MFA setup HTTP error:', response.status, errorText);
        throw new Error(`MFA setup failed: ${response.status} - ${errorText}`);
      }
      
    } catch (error) {
      console.error('MFA flow error:', error);
      setCurrentStep('');
      
      if (!errorCooldown) {
        showErrorToast(createMFAError({
          message: 'Failed to start MFA setup',
          isSetup: true
        }));
        setLastErrorType('mfa');
        setErrorCooldown(true);
      }
      return false; // Actual failure
    }
  };

  // Validate JIRA credentials upfront before starting MFA flow
  const validateAndProcessJiraCredentials = async (): Promise<boolean> => {
    if (!jiraUsernameValue || !jiraTokenValue) {
      return true; // No JIRA credentials to validate, proceed with settings save
    }

    // Prevent multiple simultaneous validations
    if (isValidatingJira || errorCooldown) {
      console.log('🔧 Validation already in progress or in cooldown, skipping');
      return false;
    }

    setCurrentStep('Validating JIRA...');
    console.log('🔐 Validating JIRA credentials for user:', jiraUsernameValue);
    setIsValidatingJira(true);
    setLastErrorType(null);

    try {
      // Use the target backend URL (after settings save) for validation
      const targetBackendUrl = getTargetBackendUrl();
      console.log('🔗 Using target backend URL for JIRA validation:', targetBackendUrl);
      
      const validation = await validateJIRACredentialsWithRetry(
        jiraUsernameValue.trim(),
        jiraTokenValue.trim(),
        targetBackendUrl
      );

      if (!validation.isValid) {
        setCurrentStep('');
        console.log('🔍 JIRA validation failed:', {
          errorType: validation.error?.type,
          errorMessage: validation.error?.message,
          technicalDetails: validation.error?.technicalDetails,
          backendUrl: targetBackendUrl
        });
        
        // Prevent duplicate error handling
        if (lastErrorType !== validation.error?.type) {
          showErrorToast(validation.error!);
          setLastErrorType(validation.error?.type || 'unknown');
          setErrorCooldown(true);
          
          // Only call recovery actions once per error type
          if (validation.error?.type === 'BACKEND_UNAVAILABLE') {
            handleRecoveryActions('backend');
          } else if (validation.error?.type === 'JIRA_CREDENTIALS') {
            handleRecoveryActions('jira');
          } else {
            handleRecoveryActions('network');
          }
        }
        
        return false; // Actual validation failure
      }

      console.log('✅ JIRA credentials are valid, proceeding with MFA flow');
      
      const mfaResult = await handleMfaFlow();
      return mfaResult; // true = MFA modal shown (success), false = MFA setup failed
      
    } catch (error) {
      setCurrentStep('');
      console.error('JIRA validation error:', error);
      
      // Prevent duplicate error handling
      if (lastErrorType !== 'network') {
        showErrorToast(createNetworkError('JIRA credential validation'));
        setLastErrorType('network');
        setErrorCooldown(true);
        handleRecoveryActions('network');
      }
      return false;
    } finally {
      setIsValidatingJira(false);
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
    if (isSaving || isValidatingJira || isCheckingMfa) {
      console.log('🔧 Save already in progress or validation running, skipping');
      return; // Prevent double-clicking and overlapping operations
    }
    
    console.log('🔧 Starting save process...');
    setIsSaving(true);
    setLastErrorType(null);

    try {
      // Step 1: Validate basic settings first
      if (!validateSettings()) {
        return;
      }

      // Step 2: Save basic settings immediately (don't wait for JIRA validation)
      console.log('🔧 Saving basic application settings...');
      saveApplicationSettings();

      // Step 3: If JIRA credentials provided, validate and handle MFA
      if (jiraUsernameValue && jiraTokenValue) {
        console.log('🔧 JIRA credentials provided, starting validation...');
        const shouldProceed = await validateAndProcessJiraCredentials();
        if (!shouldProceed) {
          // Only show warning if validation actually failed
          console.log('🔧 JIRA validation failed, but basic settings were saved');
          toast('⚠️ Basic settings saved, but JIRA credentials need attention');
          return;
        }
        // If shouldProceed is true, either JIRA is complete OR MFA modal is waiting
        // Don't show any message yet - let MFA completion handle it
        console.log('🔧 JIRA credentials validated, MFA flow initiated');
        return; // Wait for MFA completion
      } else {
        // No JIRA credentials, just finish with basic settings
        toast.success('Settings saved successfully');
        onClose();
        return;
      }
      
    } catch (error) {
      console.error('Save error:', error);
      
      // Only show error if we haven't shown one recently
      if (!errorCooldown) {
        showErrorToast(createNetworkError('saving settings'));
        setLastErrorType('network');
        setErrorCooldown(true);
      }
    } finally {
      setIsSaving(false);
      setCurrentStep('');
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
    // Remove duplicate toasts - the main error toast already handles user messaging
    // This function is now just for internal error categorization
    console.log(`🔧 Error recovery triggered for type: ${errorType}`);
  };

  const handleClearJira = async () => {
    try {
      let clearedItems = [];
      
      // Always clear the form fields regardless of hasCredentials state
      setJiraUsernameValue('');
      setJiraTokenValue('');
      
      // Always clear stored credentials (in case they exist but hasCredentials is wrong)
      clearJIRACredentials();
      setHasCredentials(false);
      clearedItems.push('JIRA credentials');

      // Clear MFA session
      const currentBackendUrl = chatCompletionEndPoint ? 
        new URL(chatCompletionEndPoint).origin : 
        (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://127.0.0.1:8080');
      
      try {
        await fetch(`${currentBackendUrl}/api/mfa/clear-session`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        clearedItems.push('MFA session');
      } catch (error) {
        console.warn('🔧 Could not clear MFA session (this is expected if server is not running)');
      }

      // Clear any stored MFA state
      resetMfaModalStates();
      clearedItems.push('MFA setup state');

      // Clear any session storage items that might contain JIRA data
      try {
        ['jira_session_id', 'jira_session_user', 'mfa_session_id', 'mfa_session_user'].forEach(key => {
          sessionStorage.removeItem(key);
        });
      } catch (error) {
        console.warn('🔧 Could not clear session storage items:', error);
      }

      // Dispatch events to notify other components about the clearing
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('jira-credentials-changed'));
      window.dispatchEvent(new Event('websocket-settings-changed'));

      toast.success('Cleared JIRA and MFA credentials');
      console.log('🧹 All JIRA credential data cleared successfully');
      
    } catch (error) {
      console.error('🔧 Error during clear operation:', error);
      toast.error('❌ Error clearing data');
    }
  };



  const handleMfaVerification = async (isVerifyOnly: boolean) => {
    // Basic validation
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    // Prevent multiple simultaneous MFA checks
    if (isCheckingMfa) {
      console.log('🔧 MFA verification already in progress, skipping');
      return;
    }

    const userId = isVerifyOnly ? mfaVerifyData?.username : mfaSetupData?.username;
    if (!userId) {
      toast.error('❌ User information missing for MFA verification');
      return;
    }

    setCurrentStep('Verifying MFA code...');
    console.log('🔐 MFA Verification starting for user:', userId);
    setIsCheckingMfa(true);

    try {
      // Use the same target backend URL as MFA setup
      const targetBackendUrl = getTargetBackendUrl();
      console.log('🔗 Using target backend URL for MFA verification:', targetBackendUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      // Use the same API endpoint format as setup
      const response = await fetch(`${targetBackendUrl}/api/mfa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_email: `${userId}@nvidia.com`,
          code: mfaCode.trim(),
          is_setup: !isVerifyOnly
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log('🔐 MFA verification response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 MFA verification response data:', data);
        
        if (data.verified || data.success) {
          setCurrentStep('MFA verified - Saving JIRA credentials...');
          toast.success('MFA verification successful!');
          
          // Reset modal states
          resetMfaModalStates();
          
          // Continue with JIRA save after successful MFA
          if (!isVerifyOnly) {
            await continueJiraSave();
          } else {
            // For verify-only, just close and refresh
            setHasCredentials(true);
            window.dispatchEvent(new Event('jira-credentials-changed'));
            onClose();
          }
        } else {
          setCurrentStep('');
          const errorMsg = data.error || 'Invalid MFA code. Please try again.';
          toast.error(`❌ ${errorMsg}`);
          setMfaCode('');
        }
      } else {
        setCurrentStep('');
        const errorData = await response.json().catch(() => ({}));
        console.error('🔐 MFA verification failed:', response.status, errorData);
        
        // Only show error if we haven't shown one recently
        if (!errorCooldown) {
          const mfaError = createMFAError({
            message: errorData.error || `MFA verification failed (${response.status})`,
            isSetup: !isVerifyOnly
          });
          showErrorToast(mfaError);
          setLastErrorType('mfa');
          setErrorCooldown(true);
        }
        
        setMfaCode('');
      }
    } catch (error) {
      setCurrentStep('');
      console.error('MFA verification error:', error);
      
      // Only show error if we haven't shown one recently
      if (!errorCooldown) {
        if (error instanceof Error && error.name === 'AbortError') {
          showErrorToast(createNetworkError('MFA verification timed out - check backend URL and port'));
        } else {
          showErrorToast(createNetworkError('MFA verification failed - check backend connection'));
        }
        setLastErrorType('network');
        setErrorCooldown(true);
      }
      
      setMfaCode('');
    } finally {
      setIsCheckingMfa(false);
      setTimeout(() => setCurrentStep(''), 500);
    }
  };

  const continueJiraSave = async () => {
    if (isSaving) {
      console.log('🔧 JIRA save already in progress, skipping');
      return;
    }

    try {
      setIsSaving(true);
      setCurrentStep('Saving JIRA credentials securely...');
      console.log('🔐 Final JIRA save step: Testing connection and saving credentials');
      
      // Use the same target backend URL for consistency
      const targetBackendUrl = getTargetBackendUrl();
      console.log('🔗 Using target backend URL for JIRA save:', targetBackendUrl);

      const response = await fetch(`${targetBackendUrl}/api/mfa/jira/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${jiraUsernameValue}:${jiraTokenValue}`)}`,
        },
      });

      if (response.ok) {
        await setSecureJIRACredentials({ username: jiraUsernameValue, token: jiraTokenValue });
        setCurrentStep('JIRA credentials saved successfully!');
        toast.success('JIRA credentials saved securely with MFA protection!');
        
        // Update states and close dialog
        setHasCredentials(true);
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('websocket-settings-changed'));
        window.dispatchEvent(new Event('jira-credentials-changed'));
        
        onClose();
      } else {
        setCurrentStep('');
        const jiraError = await parseResponseError(response, 'JIRA validation');
        
        // Clear MFA session since we need to start over
        resetMfaModalStates();
        
        // Only show error if we haven't shown one recently
        if (!errorCooldown) {
          showErrorToast(jiraError);
          setLastErrorType('jira');
          setErrorCooldown(true);
        }
      }
    } catch (error) {
      setCurrentStep('');
      console.error('JIRA save error:', error);
      
      // Clear MFA session since we need to start over
      resetMfaModalStates();
      
      // Only show error if we haven't shown one recently
      if (!errorCooldown) {
        showErrorToast(createNetworkError('Failed to save JIRA credentials - check backend connection'));
        setLastErrorType('network');
        setErrorCooldown(true);
      }
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
                      {currentStep || (isValidatingJira && 'Validating...') || (isCheckingMfa && 'Verifying...') || (isSaving && 'Saving...')}
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
