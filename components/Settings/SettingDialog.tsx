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
import { getBackendUrl, getBackendUrlWithDiscovery } from '@/utils/app/api-config';
import { 
  storeMFASession, 
  hasValidMFASession, 
  clearMFASession,
  validateMFASessionWithBackend
} from '@/utils/app/mfa-session';
import { updateCSPForBackend } from '@/utils/app/security-headers';
import {
  startMFAVerification,
  endMFAVerification,
  isMFAOperationInProgress
} from '@/utils/app/mfa-state';
import { DEFAULT_CHAT_COMPLETION_URL, DEFAULT_WEBSOCKET_URL } from '@/constants/constants';
import { ServerEnvVars } from '@/types/env';

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
  // Prioritize environment variables over sessionStorage for URL values
  useEffect(() => {
    const loadEnvironmentVariables = async () => {
      const storedChatURL = safeSessionStorage.getItem('chatCompletionURL');
      const storedWebSocketURL = safeSessionStorage.getItem('webSocketURL');
      const storedWebSocketSchema = safeSessionStorage.getItem('webSocketSchema');
      const storedIntermediateSteps = safeSessionStorage.getItem('enableIntermediateSteps');
      const storedExpandSteps = safeSessionStorage.getItem('expandIntermediateSteps');
      const storedStepOverride = safeSessionStorage.getItem('intermediateStepOverride');
  
      let envChatURL = DEFAULT_CHAT_COMPLETION_URL;
      let envWebSocketURL = DEFAULT_WEBSOCKET_URL;
  
      try {
        // Fetch environment variables from server-side API
        console.log('🔧 Fetching environment variables from server...');
        const response = await fetch('/api/env-vars');
        
        if (response.ok) {
          const serverEnvVars: ServerEnvVars = await response.json();
          console.log('✅ Server-side environment variables loaded:', serverEnvVars);
          
          // Use server-side environment variables if available
          envChatURL = serverEnvVars.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL || DEFAULT_CHAT_COMPLETION_URL;
          envWebSocketURL = serverEnvVars.NEXT_PUBLIC_WS_CHAT_COMPLETION_URL || DEFAULT_WEBSOCKET_URL;
          
          // Store for use by other parts of the app
          window.__SERVER_ENV = serverEnvVars;
          
        } else {
          console.warn('⚠️ Failed to fetch server environment variables, using defaults');
        }
      } catch (error) {
        console.error('❌ Error fetching server environment variables:', error);
        console.log('🔄 Falling back to default constants');
        
        // Fallback to default constants (process.env is empty in production anyway)
        envChatURL = DEFAULT_CHAT_COMPLETION_URL;
        envWebSocketURL = DEFAULT_WEBSOCKET_URL;
      }
      // Add debug logging
      console.log('🔍 =================================');
      console.log('🔍 ENVIRONMENT VARIABLES DEBUG');
      console.log('🔍 =================================');

      // Show server-side environment variables (if available)
      console.log('📋 Server-side Environment Variables (from API):');
      if (window.__SERVER_ENV) {
        console.log('  NEXT_PUBLIC_API_BASE_URL:', window.__SERVER_ENV.NEXT_PUBLIC_API_BASE_URL);
        console.log('  NEXT_PUBLIC_API_HOST:', window.__SERVER_ENV.NEXT_PUBLIC_API_HOST);
        console.log('  NEXT_PUBLIC_API_PORT:', window.__SERVER_ENV.NEXT_PUBLIC_API_PORT);
        console.log('  NEXT_PUBLIC_API_PROTOCOL:', window.__SERVER_ENV.NEXT_PUBLIC_API_PROTOCOL);
        console.log('  NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL:', window.__SERVER_ENV.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL);
        console.log('  NEXT_PUBLIC_WS_CHAT_COMPLETION_URL:', window.__SERVER_ENV.NEXT_PUBLIC_WS_CHAT_COMPLETION_URL);
        console.log('  NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON:', window.__SERVER_ENV.NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON);
        console.log('  NEXT_PUBLIC_CHAT_HISTORY_DEFAULT_ON:', window.__SERVER_ENV.NEXT_PUBLIC_CHAT_HISTORY_DEFAULT_ON);
      } else {
        console.log('  ❌ Server-side environment variables not available');
      }

      // Show client-side environment variables (for comparison)
      console.log('📋 Client-side Environment Variables (build-time):');
      console.log('  NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL:', process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL || '(empty)');
      console.log('  NEXT_PUBLIC_WS_CHAT_COMPLETION_URL:', process.env.NEXT_PUBLIC_WS_CHAT_COMPLETION_URL || '(empty)');

      // Show Node environment
      console.log('🌍 Node Environment:');
      console.log('  NODE_ENV:', process.env.NODE_ENV);
      console.log('  typeof window:', typeof window);

      // Show current URL context
      console.log('🌐 Current Context:');
      console.log('  window.location.hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');
      console.log('  window.location.href:', typeof window !== 'undefined' ? window.location.href : 'N/A');

      console.log('🔍 =================================');

      console.log('🔍 SessionStorage Values:');
      console.log('  storedChatURL:', storedChatURL);
      console.log('  storedWebSocketURL:', storedWebSocketURL);

      console.log('🔍 Final Values Used:');
      console.log('  Final chatURL:', storedChatURL || envChatURL || '');
      console.log('  Final webSocketURL:', storedWebSocketURL || envWebSocketURL || '');
      
      setChatCompletionEndPoint(storedChatURL || envChatURL || '');
      setWebSocketEndPoint(storedWebSocketURL || envWebSocketURL || '');
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
  };
  loadEnvironmentVariables();
  }, []);
  // Update CSP on component mount if backend URL is already set
  useEffect(() => {
    const storedChatURL = sessionStorage.getItem('chatCompletionURL');
    if (storedChatURL) {
      console.log('Updating CSP on mount for stored URL:', storedChatURL);
      try {
        updateCSPForBackend(storedChatURL);
      } catch (error) {
        console.warn('Failed to update CSP on mount:', error);
      }
    }
  }, []);

  // Load saved URLs from localStorage on component mount
  useEffect(() => {
    const loadSavedSettings = () => {
      // Priority 1: localStorage (UI Settings - user's explicit choice)
      const savedChatURL = localStorage.getItem('chatCompletionURL');
      const savedWebSocketURL = localStorage.getItem('webSocketURL');
      const savedWebSocketSchema = localStorage.getItem('webSocketSchema');
      
      // Priority 2: Environment variables (deployment configuration)
      const envChatURL = process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL;
      const envWebSocketURL = process.env.NEXT_PUBLIC_WS_CHAT_COMPLETION_URL;
      
      // Use UI settings first, then environment variables
      const finalChatURL = savedChatURL || envChatURL;
      const finalWebSocketURL = savedWebSocketURL || envWebSocketURL;
      
      if (finalChatURL && finalChatURL !== chatCompletionEndPoint) {
        setChatCompletionEndPoint(finalChatURL);
        homeDispatch({ field: 'chatCompletionURL', value: finalChatURL });
        console.log('Loaded chat URL:', finalChatURL, envChatURL ? '(from env)' : '(from localStorage)');
      }
      
      if (finalWebSocketURL && finalWebSocketURL !== webSocketEndPoint) {
        setWebSocketEndPoint(finalWebSocketURL);
        homeDispatch({ field: 'webSocketURL', value: finalWebSocketURL });
        console.log('Loaded WebSocket URL:', finalWebSocketURL, envWebSocketURL ? '(from env)' : '(from localStorage)');
      }
      
      if (savedWebSocketSchema && savedWebSocketSchema !== webSocketSchema) {
        setWebSocketSchema(savedWebSocketSchema);
        homeDispatch({ field: 'webSocketSchema', value: savedWebSocketSchema });
        console.log('Loaded WebSocket schema from localStorage:', savedWebSocketSchema);
      }
    };

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
        
        // Check MFA status using consistent backend URL resolution
        try {
          const backendUrl = getTargetBackendUrl();
          console.log('Using target backend URL for MFA status:', backendUrl);
          
          const mfaResponse = await fetch(`/api/mfa-status-proxy?user_id=${userId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Backend-URL': backendUrl,
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
      loadSavedSettings();  // Load saved URLs first
      loadCredentials();    // Then load credentials
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
    console.log('getTargetBackendUrl called with chatCompletionEndPoint:', chatCompletionEndPoint);
    
    // Priority 1: UI Settings (user's explicit choice in the form field - HIGHEST PRIORITY)
    if (chatCompletionEndPoint && chatCompletionEndPoint.trim()) {
      try {
        const url = new URL(chatCompletionEndPoint);
        const uiBackendUrl = `${url.protocol}//${url.host}`;
        console.log('✅ Using backend URL from UI form field (highest priority):', uiBackendUrl);
        return uiBackendUrl;
      } catch (error) {
        console.warn('Invalid UI chatCompletionEndPoint format:', chatCompletionEndPoint);
      }
    }
    
    // Priority 2: Environment variables (deployment configuration)
    if (process.env.NEXT_PUBLIC_BACKEND_URL) {
      console.log('✅ Using NEXT_PUBLIC_BACKEND_URL from environment:', process.env.NEXT_PUBLIC_BACKEND_URL);
      return process.env.NEXT_PUBLIC_BACKEND_URL;
    }
    
    // Priority 3: Extract from environment chat completion URL
    if (process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL) {
      try {
        const url = new URL(process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL);
        const envBackendUrl = `${url.protocol}//${url.host}`;
        console.log('✅ Using backend URL from NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL:', envBackendUrl);
        return envBackendUrl;
      } catch (error) {
        console.warn('Invalid NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL:', process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL);
      }
    }
    
    // Priority 4: Server-side environment variables
    if (typeof window !== 'undefined' && (window as any).__SERVER_ENV) {
      const serverEnv = (window as any).__SERVER_ENV;
      if (serverEnv.NEXT_PUBLIC_BACKEND_URL) {
        console.log('✅ Using server-side NEXT_PUBLIC_BACKEND_URL:', serverEnv.NEXT_PUBLIC_BACKEND_URL);
        return serverEnv.NEXT_PUBLIC_BACKEND_URL;
      }
      if (serverEnv.NEXT_PUBLIC_API_BASE_URL) {
        console.log('✅ Using server-side NEXT_PUBLIC_API_BASE_URL as backend:', serverEnv.NEXT_PUBLIC_API_BASE_URL);
        return serverEnv.NEXT_PUBLIC_API_BASE_URL;
      }
    }
    
    // Final fallback - use localhost for local development
    const fallbackUrl = 'http://127.0.0.1:8081';
    console.log('⚠️ Using fallback backend URL:', fallbackUrl);
    return fallbackUrl;
  };

  // Handle MFA flow after JIRA validation
  const handleMfaFlow = async (forceNew: boolean = false): Promise<boolean> => {
    try {
      setCurrentStep('Setting up MFA...');
      
      // Call the MFA setup API via proxy to bypass CSP restrictions
      const targetBackendUrl = getTargetBackendUrl();
      console.log(' Using MFA proxy with backend URL:', targetBackendUrl);
      
      const response = await fetch('/api/mfa-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Backend-URL': targetBackendUrl,
        },
        body: JSON.stringify({
          user_id: jiraUsernameValue,
          user_email: `${jiraUsernameValue}@nvidia.com`,
          force_new: forceNew
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(' MFA setup response data:', data);
        
        if (data.success) {
          // Handle different possible API response formats
          const qrCodeData = data.qr_code || data.qr_code_data || data.qrCode || '';
          
          if (!qrCodeData) {
            console.warn(' No QR code data in response:', Object.keys(data));
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
          
          console.log(' Setting MFA setup data with QR code length:', qrCodeData.length);
          setShowMfaSetup(true);
          setCurrentStep(''); // Clear step indicator when modal is shown
          return true; // Success - waiting for user input, not failure
        } else {
          throw new Error(data.error || 'MFA setup failed');
        }
      } else {
        const errorText = await response.text();
        console.error(' MFA setup HTTP error:', response.status, errorText);
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
      console.log(' Validation already in progress or in cooldown, skipping');
      return false;
    }

    setCurrentStep('Validating JIRA...');
    console.log(' Validating JIRA credentials for user:', jiraUsernameValue);
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
        console.log(' JIRA validation failed:', {
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

      console.log(' JIRA credentials are valid, proceeding with MFA flow');
      
      // Update CSP to allow the backend URL before MFA flow
      try {
        console.log(' Updating CSP before MFA flow for URL:', targetBackendUrl);
        console.log(' Target backend URL details:', {
          targetBackendUrl,
          protocol: new URL(targetBackendUrl).protocol,
          hostname: new URL(targetBackendUrl).hostname,
          port: new URL(targetBackendUrl).port
        });
        updateCSPForBackend(targetBackendUrl);
        // Give the browser more time to process the CSP update
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log(' CSP update completed, proceeding with MFA flow');
      } catch (error) {
        console.warn('Failed to update CSP before MFA flow:', error);
      }
      
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
  // Get the correct backend URL for MFA and API calls based on environment
  const getCurrentBackendUrl = (): string => {
    // Check if we're in production environment (AI Factory)
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      // If running on production domain, use production backend
      if (hostname.includes('tpm.prd.astra.nvidia.com') || hostname.includes('astra.nvidia.com')) {
        return 'https://tpm-nat.prd.astra.nvidia.com';
      }
      // If running on localhost, use local backend
      if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return 'http://localhost:8080';
      }
    }
    
    // Fallback to environment variable or production
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tpm-nat.prd.astra.nvidia.com';
  };



  // Check MFA status from backend
  const checkMfaStatus = async (backendUrl: string) => {
    // Use consistent backend URL resolution
    const targetBackendUrl = getTargetBackendUrl();
    const response = await fetch(`/api/mfa-status-proxy?user_id=${jiraUsernameValue}`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'X-Backend-URL': targetBackendUrl,
      },
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
        toast.success('Using your existing MFA setup. Enter a code from your authenticator app.');
      } else {
        toast.success('MFA setup initiated. Please scan the QR code and verify.');
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

  // Validate existing MFA session using unified session management
  const validateMfaSession = async (backendUrl: string): Promise<boolean> => {
    // Check if user has a valid session
    if (!hasValidMFASession(jiraUsernameValue)) {
      return await requireMfaVerification();
    }

    try {
      // Validate existing session with backend (uses consistent URL resolution)
      const isValid = await validateMFASessionWithBackend(undefined, jiraUsernameValue);
      
      if (!isValid) {
        return await requireMfaVerification();
      }

      // Session is valid - proceed with save
      return true;
    } catch (error) {
      console.error('Session validation error:', error);
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
    toast('Please verify your MFA to complete JIRA setup.');
    return false; // Don't continue with save - wait for MFA verification
  };

  // Clear MFA session data using unified session management
  const clearMfaSession = () => {
    clearMFASession();
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
    
    // Also store in localStorage for new tab persistence
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('chatCompletionURL', chatCompletionEndPoint);
      localStorage.setItem('webSocketURL', webSocketEndPoint);
      localStorage.setItem('webSocketSchema', webSocketSchema);
      localStorage.setItem('backendUrl', chatCompletionEndPoint.replace('/chat/stream', ''));
      
      console.log('URLs saved to localStorage for new tab persistence:', {
        chatURL: chatCompletionEndPoint,
        webSocketURL: webSocketEndPoint,
        backendURL: chatCompletionEndPoint.replace('/chat/stream', '')
      });
    }
    
    // Update CSP to allow the new backend URL
    try {
      console.log('Updating CSP for backend URL:', chatCompletionEndPoint);
      updateCSPForBackend(chatCompletionEndPoint);
      console.log('CSP update completed');
    } catch (error) {
      console.warn('Failed to update CSP:', error);
    }
    
    // Determine the correct backend URL for MFA/API calls based on environment
    const getBackendUrlForMFA = (): string => {
      // Check if we're in production environment (AI Factory)
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // If running on production domain, use production backend
        if (hostname.includes('tpm.prd.astra.nvidia.com') || hostname.includes('astra.nvidia.com')) {
          return 'https://tpm-nat.prd.astra.nvidia.com';
        }
        // If running on localhost, use local backend
        if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
          return 'http://localhost:8080';
        }
      }
      
      // Fallback to environment variable or production
      return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://tpm-nat.prd.astra.nvidia.com';
    };
    
    const backendUrlForMFA = getBackendUrlForMFA();
    safeSessionStorage.setItem('backendUrl', backendUrlForMFA);
    console.log('Settings: Storing backend URL for MFA/API calls:', backendUrlForMFA);
    
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
      console.log('Save already in progress or validation running, skipping');
      return; // Prevent double-clicking and overlapping operations
    }
    
    console.log('Starting save process...');
    setIsSaving(true);
    setLastErrorType(null);

    try {
      // Step 0: Update CSP early to allow backend connections
      const targetBackendUrl = getTargetBackendUrl();
      try {
        console.log(' Updating CSP early for URL:', targetBackendUrl);
        updateCSPForBackend(targetBackendUrl);
      } catch (error) {
        console.warn('Failed to update CSP early:', error);
      }

      // Step 1: Validate basic settings first
      if (!validateSettings()) {
        return;
      }

      // Step 2: Save basic settings immediately (don't wait for JIRA validation)
      console.log(' Saving basic application settings...');
      saveApplicationSettings();

      // Step 3: If JIRA credentials provided, validate and handle MFA
      if (jiraUsernameValue && jiraTokenValue) {
        console.log(' JIRA credentials provided, starting validation...');
        const shouldProceed = await validateAndProcessJiraCredentials();
        if (!shouldProceed) {
          // Only show warning if validation actually failed
          console.log(' JIRA validation failed, but basic settings were saved');
          toast('Basic settings saved', {
              icon: '⚙️',
            });
          return;
        }
        // If shouldProceed is true, either JIRA is complete OR MFA modal is waiting
        // Don't show any message yet - let MFA completion handle it
        console.log(' JIRA credentials validated, MFA flow initiated');
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
    console.log(` Error recovery triggered for type: ${errorType}`);
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
        await fetch('/api/mfa-clear-session-proxy', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Backend-URL': currentBackendUrl,
          }
        });
        clearedItems.push('MFA session');
      } catch (error) {
        console.warn(' Could not clear MFA session (this is expected if server is not running)');
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
        console.warn(' Could not clear session storage items:', error);
      }

      // Dispatch events to notify other components about the clearing
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('jira-credentials-changed'));
      window.dispatchEvent(new Event('websocket-settings-changed'));

      toast.success('Cleared JIRA and MFA credentials');
      console.log('🧹 All JIRA credential data cleared successfully');
      
    } catch (error) {
      console.error(' Error during clear operation:', error);
      toast.error(' Error clearing data');
    }
  };



  const handleMfaVerification = async (isVerifyOnly: boolean) => {
    // Basic validation
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    // Get user ID first
    const currentUserId = isVerifyOnly ? mfaVerifyData?.username : mfaSetupData?.username;
    if (!currentUserId) {
      toast.error(' User information missing for MFA verification');
      return;
    }

    // Prevent multiple simultaneous MFA checks for this user
    if (isCheckingMfa || isMFAOperationInProgress(currentUserId)) {
      console.log(' MFA verification already in progress for user, skipping');
      return;
    }

    const operationId = startMFAVerification(currentUserId);
    if (!operationId) {
      toast.error('🔒 Cannot start MFA verification - another operation is in progress.');
      return;
    }

    setCurrentStep('Verifying MFA code...');
    console.log(' MFA Verification starting for user:', currentUserId);
    setIsCheckingMfa(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      // Use MFA verify proxy to bypass CSP restrictions
      const backendUrl = getTargetBackendUrl();
      console.log('🔗 Using MFA verify proxy with backend URL:', backendUrl);
      const response = await fetch('/api/mfa-verify-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Backend-URL': backendUrl,
        },
        body: JSON.stringify({
          user_id: currentUserId,
          code: mfaCode.trim(),
          is_backup_code: false
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log(' MFA verification response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(' MFA verification response data:', data);
        
        if (data.success) {
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
          const backendError = data.error || 'Invalid MFA code';
          console.log(' MFA verification failed:', backendError);
          toast.custom((t) => (
            <div className={`bg-white border border-red-200 px-4 py-3 rounded-lg shadow-md max-w-md text-center ${t.visible ? 'animate-fade-in' : 'animate-fade-out'}`}>
              <div className="text-red-600 font-medium">{backendError}. Please try again.</div>
              <div className="text-gray-500 text-sm mt-1">If issues persist: Delete "TPM AI Assistant" from your authenticator app and scan the QR code again.</div>
            </div>
          ), {
            duration: 4000,
          });
          setMfaCode('');
        }
      } else {
        setCurrentStep('');
        const errorData = await response.json().catch(() => ({}));
        console.error(' MFA verification failed:', response.status, errorData);
        
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
      endMFAVerification(currentUserId, operationId);
      setTimeout(() => setCurrentStep(''), 500);
    }
  };



  const continueJiraSave = async () => {
    if (isSaving) {
      console.log(' JIRA save already in progress, skipping');
      return;
    }

    try {
      setIsSaving(true);
      setCurrentStep('Saving JIRA credentials securely...');
      console.log(' Final JIRA save step: Testing connection and saving credentials');
      
      // Use the same target backend URL for consistency
      const targetBackendUrl = getTargetBackendUrl();
      console.log('🔗 Using target backend URL for JIRA save:', targetBackendUrl);

      const response = await fetch('/api/mfa-jira-test-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${jiraUsernameValue}:${jiraTokenValue}`)}`,
          'X-Backend-URL': targetBackendUrl,
        },
        body: JSON.stringify({
          jira_credentials: {
            username: jiraUsernameValue,
            token: jiraTokenValue
          }
        }),
      });

      if (response.ok) {
        console.log(' MFA Setup: Storing JIRA credentials after successful MFA verification');
        await setSecureJIRACredentials({ username: jiraUsernameValue, token: jiraTokenValue });
        
        // Verify credentials were stored
        const storedDataJSON = sessionStorage.getItem('jira-credentials');
        console.log(' MFA Setup: Credentials storage verification:', {
          hasStoredData: !!storedDataJSON,
          storedDataLength: storedDataJSON?.length || 0
        });
        
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
              <span>⚙</span>
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
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Complete MFA Setup</h3>
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
      {console.log(' Debug: Checking MFA modal render condition:', {
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
