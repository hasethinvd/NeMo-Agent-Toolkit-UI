import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import toast from 'react-hot-toast';
import { JiraStatus } from './JiraStatus';
import { clearJIRACredentials, getJIRACredentialStatus, setSecureJIRACredentials, getSecureJIRACredentials } from '../../utils/app/crypto';
import SecurityDashboard from './SecurityDashboard';
import { MFAVerifyModal } from './MFAVerifyModal';


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

  useEffect(() => {
    const updateCredentialStatus = async () => {
      const status = getJIRACredentialStatus();
      const hasJiraCredentials = !!status?.fingerprint;
      
      // Get JIRA username for MFA user ID
      let userId = 'aiq-tpm-system';
      try {
        const credentials = await getSecureJIRACredentials();
        if (credentials?.username) {
          userId = credentials.username;
        }
      } catch (error) {
        console.log('Could not get JIRA username for MFA check:', error);
      }
      
      // Check MFA status with correct user ID
      let mfaEnabled = false;
      try {
        const mfaResponse = await fetch(`/api/mfa/status?user_id=${userId}`);
        const mfaStatus = await mfaResponse.json();
        mfaEnabled = mfaStatus.enabled;
      } catch (error) {
        console.log('Could not check MFA status:', error);
      }
      
      setHasCredentials(hasJiraCredentials);
      setHasMFA(mfaEnabled);
    };

    updateCredentialStatus();
    
    // Listen for credential changes
    const handleCredentialChange = () => {
      updateCredentialStatus();
    };
    
    // Listen for MFA status changes
    const handleMFAChange = () => {
      updateCredentialStatus();
    };
    
    window.addEventListener('jira-credentials-changed', handleCredentialChange);
    window.addEventListener('mfa-status-changed', handleMFAChange);
    
    return () => {
      window.removeEventListener('jira-credentials-changed', handleCredentialChange);
      window.removeEventListener('mfa-status-changed', handleMFAChange);
    };
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

  const handleSave = async () => {
    console.log('🔧 handleSave called with:', {
      chatCompletionEndPoint,
      webSocketEndPoint,
      jiraUsernameValue,
      hasJiraToken: !!jiraTokenValue,
      jiraTokenLength: jiraTokenValue?.length
    });
    
    console.log('🔍 Debug: Checking required fields:', {
      chatCompletionEndPoint: chatCompletionEndPoint,
      webSocketEndPoint: webSocketEndPoint,
      hasCompletion: !!chatCompletionEndPoint,
      hasWebSocket: !!webSocketEndPoint
    });
    
    if(!chatCompletionEndPoint || !webSocketEndPoint) {
      console.log('❌ Debug: Missing required fields, returning early');
      toast.error('Please fill all the fields to save settings');
      return;
    }

    // If trying to save JIRA credentials, handle MFA automatically
    console.log('🔍 Debug: About to check JIRA credentials:', {
      jiraUsernameValue: jiraUsernameValue,
      jiraTokenValue: jiraTokenValue ? '***HIDDEN***' : null,
      hasUsername: !!jiraUsernameValue,
      hasToken: !!jiraTokenValue,
      condition: !!(jiraUsernameValue && jiraTokenValue)
    });
    
    if (jiraUsernameValue && jiraTokenValue) {
      console.log('🔐 JIRA credentials detected, starting MFA flow for user:', jiraUsernameValue);
      try {
        // Check if MFA is already set up for this user
        console.log('🔍 Checking MFA status for user:', jiraUsernameValue);
        const mfaResponse = await fetch(`/api/mfa/status?user_id=${jiraUsernameValue}`);
        console.log('🔍 MFA status response:', mfaResponse.status, mfaResponse.ok);
        
        if (!mfaResponse.ok) {
          console.error('❌ MFA status check failed:', mfaResponse.status);
          toast.error('Failed to check MFA status. Please try again.');
          return;
        }
        
        const mfaStatus = await mfaResponse.json();
        console.log('🔍 MFA status data:', mfaStatus);
        
        if (!mfaStatus.enabled) {
          // MFA not set up - trigger automatic MFA setup
          toast('🔐 Setting up MFA for your JIRA account...');
          
          try {
            const mfaSetupResponse = await fetch('/api/mfa', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-user-id': jiraUsernameValue,
                'x-user-email': `${jiraUsernameValue}@nvidia.com`,
              },
            });

            if (mfaSetupResponse.ok) {
              const setupData = await mfaSetupResponse.json();
              
              if (setupData.success) {
                // Show MFA setup modal with QR code
                setMfaSetupData({
                  qr_code: setupData.qr_code,
                  backup_codes: setupData.backup_codes || [],
                  is_existing: setupData.is_existing || false,
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`
                });
                setShowMfaSetup(true);
                
                if (setupData.is_existing) {
                  toast.success('🔐 Using your existing MFA setup. Enter a code from your authenticator app to complete JIRA setup.');
                } else {
                  toast.success('🔐 MFA setup initiated. Please scan the QR code and verify to complete JIRA setup.');
                }
                return; // Don't save JIRA credentials yet - wait for MFA verification
              } else {
                toast.error(`MFA setup failed: ${setupData.error || 'Unknown error'}`);
                return;
              }
            } else {
              toast.error('Failed to set up MFA. Please try again.');
              return;
            }
          } catch (mfaError) {
            console.error('MFA setup error:', mfaError);
            toast.error('Failed to set up MFA. Please try again.');
            return;
          }
        } else {
          // MFA is set up - check if we have an active session
          const storedSessionId = safeSessionStorage.getItem('mfa_session_id');
          const storedSessionUser = safeSessionStorage.getItem('mfa_session_user');
          
          if (!storedSessionId || storedSessionUser !== jiraUsernameValue) {
            // No active session - fetch QR code and show MFA verification modal
            try {
              const mfaSetupResponse = await fetch('/api/mfa', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': jiraUsernameValue,
                  'x-user-email': `${jiraUsernameValue}@nvidia.com`,
                },
              });

              console.log('SettingDialog: MFA Setup Response status (1st):', mfaSetupResponse.status);
              if (mfaSetupResponse.ok) {
                const setupData = await mfaSetupResponse.json();
                console.log('SettingDialog: MFA Setup Response data (1st):', {
                  success: setupData.success,
                  hasQrCode: !!setupData.qr_code,
                  qrCodeLength: setupData.qr_code ? setupData.qr_code.length : 0,
                  isExisting: setupData.is_existing
                });
                const mfaData = {
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`,
                  qr_code: setupData.qr_code
                };
                console.log('🔍 Debug: Setting mfaVerifyData (1st):', mfaData);
                setMfaVerifyData(mfaData);
              } else {
                console.log('SettingDialog: MFA Setup Response failed (1st):', mfaSetupResponse.status);
                setMfaVerifyData({
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`
                });
              }
            } catch (error) {
              console.error('Error fetching QR code:', error);
              setMfaVerifyData({
                username: jiraUsernameValue,
                email: `${jiraUsernameValue}@nvidia.com`
              });
            }
            
            console.log('🔍 Debug: Setting MFA verify modal to true');
            setShowMfaVerify(true);
            console.log('🔍 Debug: MFA verify modal state should now be true');
            toast('🔐 Please verify your MFA to complete JIRA setup.');
            return; // Don't save JIRA credentials yet - wait for MFA verification
          }
          
          // Validate the existing session
          const sessionResponse = await fetch(`/api/mfa/session/validate?session_id=${storedSessionId}&user_id=${jiraUsernameValue}`);
          if (!sessionResponse.ok) {
            // Session expired - fetch QR code and show MFA verification modal
            safeSessionStorage.removeItem('mfa_session_id');
            safeSessionStorage.removeItem('mfa_session_user');
            
            try {
              const mfaSetupResponse = await fetch('/api/mfa', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': jiraUsernameValue,
                  'x-user-email': `${jiraUsernameValue}@nvidia.com`,
                },
              });

              if (mfaSetupResponse.ok) {
                const setupData = await mfaSetupResponse.json();
                setMfaVerifyData({
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`,
                  qr_code: setupData.qr_code
                });
              } else {
                setMfaVerifyData({
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`
                });
              }
            } catch (error) {
              console.error('Error fetching QR code:', error);
              setMfaVerifyData({
                username: jiraUsernameValue,
                email: `${jiraUsernameValue}@nvidia.com`
              });
            }
            
            setShowMfaVerify(true);
            toast('🔐 MFA session expired. Please verify your MFA to complete JIRA setup.');
            return;
          }
          
          const sessionData = await sessionResponse.json();
          if (!sessionData.valid) {
            // Session invalid - fetch QR code and show MFA verification modal
            safeSessionStorage.removeItem('mfa_session_id');
            safeSessionStorage.removeItem('mfa_session_user');
            
            try {
              const mfaSetupResponse = await fetch('/api/mfa', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': jiraUsernameValue,
                  'x-user-email': `${jiraUsernameValue}@nvidia.com`,
                },
              });

              if (mfaSetupResponse.ok) {
                const setupData = await mfaSetupResponse.json();
                setMfaVerifyData({
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`,
                  qr_code: setupData.qr_code
                });
              } else {
                setMfaVerifyData({
                  username: jiraUsernameValue,
                  email: `${jiraUsernameValue}@nvidia.com`
                });
              }
            } catch (error) {
              console.error('Error fetching QR code:', error);
              setMfaVerifyData({
                username: jiraUsernameValue,
                email: `${jiraUsernameValue}@nvidia.com`
              });
            }
            
            setShowMfaVerify(true);
            toast('🔐 MFA session expired. Please verify your MFA to complete JIRA setup.');
            return;
          }
          
          // MFA session is valid - proceed with JIRA credential save
        }
        
      } catch (error) {
        console.error('Error checking MFA status:', error);
        toast.error('⚠️ Cannot verify MFA status. Please try again.');
        return;
      }
    }

    homeDispatch({ field: 'lightMode', value: theme });
    homeDispatch({ field: 'chatCompletionURL', value: chatCompletionEndPoint });
    homeDispatch({ field: 'webSocketURL', value: webSocketEndPoint });
    homeDispatch({ field: 'webSocketSchema', value: webSocketSchema });
    homeDispatch({ field: 'expandIntermediateSteps', value: detailsToggle });
    homeDispatch({ field: 'intermediateStepOverride', value: intermediateStepOverrideToggle });
    homeDispatch({ field: 'enableIntermediateSteps', value: isIntermediateStepsEnabled });
    
    safeSessionStorage.setItem('chatCompletionURL', chatCompletionEndPoint);
    safeSessionStorage.setItem('webSocketURL', webSocketEndPoint);
    safeSessionStorage.setItem('webSocketSchema', webSocketSchema);
    safeSessionStorage.setItem('expandIntermediateSteps', String(detailsToggle));
    safeSessionStorage.setItem('intermediateStepOverride', String(intermediateStepOverrideToggle));
    safeSessionStorage.setItem('enableIntermediateSteps', String(isIntermediateStepsEnabled));
    
    // JIRA credentials are now handled through MFA flow above
    // This section should not run if JIRA credentials exist
    console.log('🔧 Skipping direct JIRA save - handled by MFA flow');

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('jira-credentials-changed'));

    toast.success('Settings saved successfully');
    onClose();
  };

  const resetMfaModalStates = () => {
    setShowMfaSetup(false);
    setShowMfaVerify(false);
    setMfaSetupData(null);
    setMfaVerifyData(null);
    setMfaCode('');
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
    if (!mfaCode || mfaCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    try {
      const userId = isVerifyOnly ? mfaVerifyData?.username : mfaSetupData?.username;
      console.log('MFA Verification - User ID:', userId);
      console.log('MFA Verification - Code:', mfaCode);
      console.log('MFA Verification - Is Verify Only:', isVerifyOnly);
      
      const response = await fetch('/api/mfa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          code: mfaCode,
          is_backup_code: false,
        }),
      });

      console.log('MFA Verification - Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('MFA Verification - Response data:', data);
        
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
          const errorMsg = data.error || 'Invalid code';
          console.error('MFA Verification failed:', errorMsg);
          toast.error(`❌ ${errorMsg}. Please try again from Settings.`);
          
          // Close MFA modals and return to settings window on failure
          setShowMfaSetup(false);
          setShowMfaVerify(false);
          setMfaCode('');
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('MFA Verification HTTP error:', response.status, errorData);
        toast.error(`Failed to verify MFA code: ${errorData.error || 'Server error'}. Please try again from Settings.`);
        
        // Close MFA modals and return to settings window on HTTP error
        setShowMfaSetup(false);
        setShowMfaVerify(false);
        setMfaCode('');
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      toast.error('Connection error. Please try again from Settings.');
      
      // Close MFA modals and return to settings window on connection error
      setShowMfaSetup(false);
      setShowMfaVerify(false);
      setMfaCode('');
    }
  };

  const continueJiraSave = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/validate-jira', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: jiraUsernameValue, token: jiraTokenValue }),
      });

      if (response.ok) {
        await setSecureJIRACredentials({ username: jiraUsernameValue, token: jiraTokenValue });
        toast.success('JIRA credentials saved securely with MFA protection.');
        
        // Update states and close dialog
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new Event('jira-credentials-changed'));
        onClose();
      } else {
        const errorData = await response.json();
        
        // Clear MFA session when JIRA validation fails to require re-authentication
        safeSessionStorage.removeItem('mfa_session_id');
        safeSessionStorage.removeItem('mfa_session_user');
        
        // Reset MFA modal states to ensure clean state
        resetMfaModalStates();
        
        toast.error(`JIRA validation failed: ${errorData.error || 'Unknown error'}`);
        toast('🔐 Please verify MFA again to retry JIRA credentials.');
      }
    } catch (error) {
      console.error('JIRA save error:', error);
      
      // Clear MFA session when JIRA validation has network/other errors to require re-authentication
      safeSessionStorage.removeItem('mfa_session_id');
      safeSessionStorage.removeItem('mfa_session_user');
      
      // Reset MFA modal states to ensure clean state
      resetMfaModalStates();
      
      toast.error('Failed to save JIRA credentials');
      toast('🔐 Please verify MFA again to retry JIRA credentials.');
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
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>{t('Saving...')}</span>
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
