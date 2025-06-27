import { FC, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getJIRACredentialStatus, getSecureJIRACredentials } from '../../utils/app/crypto';

interface MFAStatus {
  enabled: boolean;
  backup_codes_remaining?: number;
  has_active_session?: boolean;
}

interface MFASetupData {
  qr_code: string;
  backup_codes: string[];
  is_existing?: boolean;
}

interface Props {
  className?: string;
}

export const MFASettings: FC<Props> = ({ className = '' }) => {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [showQuickVerify, setShowQuickVerify] = useState(false);
  const [quickVerifyCode, setQuickVerifyCode] = useState('');
  
  // State for JIRA username-based MFA
  const [jiraUsername, setJiraUsername] = useState<string>('');
  
  // Get JIRA username and derive email to prevent duplicate entries
  const userId = jiraUsername;
  const userEmail = jiraUsername ? `${jiraUsername}@nvidia.com` : '';

  const isCompact = className.includes('compact');

  useEffect(() => {
    fetchJiraUsername();
    fetchMFAStatus();
    
    // Listen for JIRA credential changes
    const handleCredentialChange = () => {
      fetchJiraUsername();
      fetchMFAStatus();
    };
    
    window.addEventListener('jira-credentials-changed', handleCredentialChange);
    
    return () => {
      window.removeEventListener('jira-credentials-changed', handleCredentialChange);
    };
  }, []);

  const fetchJiraUsername = async () => {
    try {
      const credentials = await getSecureJIRACredentials();
      if (credentials?.username) {
        setJiraUsername(credentials.username);
      }
    } catch (error) {
      console.log('Could not fetch JIRA username:', error);
      // Keep default username
    }
  };

  const fetchMFAStatus = async () => {
    if (!userId) {
      setMfaStatus({ enabled: false });
      return;
    }
    
    try {
      const response = await fetch('/api/mfa/status?user_id=' + userId);
      if (response.ok) {
        const data = await response.json();
        
        // Check if we have a valid stored session
        const storedSessionId = sessionStorage.getItem('mfa_session_id');
        const storedSessionUser = sessionStorage.getItem('mfa_session_user');
        
        let hasActiveSession = false;
        if (storedSessionId && storedSessionUser === userId) {
          try {
            // Validate the stored session
            const sessionResponse = await fetch(`http://localhost:8000/mfa/session/validate?session_id=${storedSessionId}&user_id=${userId}`);
            if (sessionResponse.ok) {
              const sessionData = await sessionResponse.json();
              hasActiveSession = sessionData.valid;
              
              if (!hasActiveSession) {
                // Clear invalid session data
                sessionStorage.removeItem('mfa_session_id');
                sessionStorage.removeItem('mfa_session_user');
              }
            }
          } catch (error) {
            console.error('Error validating session:', error);
            // Clear invalid session data
            sessionStorage.removeItem('mfa_session_id');
            sessionStorage.removeItem('mfa_session_user');
          }
        }
        
        setMfaStatus({
          ...data,
          has_active_session: hasActiveSession
        });
      } else {
        console.error('Failed to fetch MFA status:', response.status);
        setMfaStatus({ enabled: false });
      }
    } catch (error) {
      console.error('Error fetching MFA status:', error);
      setMfaStatus({ enabled: false });
    }
  };

  const handleSetupMFA = async () => {
    if (!userId) {
      toast.error('⚠️ Please enter your JIRA username first to set up MFA.');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log('🔐 Starting MFA setup...');
      
      const response = await fetch('/api/mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
          'x-user-email': userEmail,
        },
      });

      console.log('🔐 MFA setup response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔐 MFA setup response data:', data);
        
        if (data.success) {
          // Ensure backup_codes is an array
          const backupCodes = Array.isArray(data.backup_codes) ? data.backup_codes : [];
          const isExisting = data.is_existing || false;
          
          setSetupData({
            qr_code: data.qr_code || '',
            backup_codes: backupCodes,
            is_existing: isExisting,
          });
          
          console.log('🔐 Setup data set:', {
            qr_code_length: data.qr_code?.length || 0,
            backup_codes_count: backupCodes.length,
            is_existing: isExisting
          });
          
          setShowSetup(true);
          
          if (isExisting) {
            toast.success('🔐 Using your existing MFA setup. Enter a code from your authenticator app to verify.');
          } else {
            toast.success('🔐 MFA setup initiated. Please scan the QR code with your authenticator app.');
          }
        } else {
          console.error('🔐 MFA setup failed:', data.error);
          toast.error(data.error || 'Failed to setup MFA');
        }
      } else {
        const errorText = await response.text();
        console.error('🔐 MFA setup HTTP error:', response.status, errorText);
        toast.error(`Failed to setup MFA (${response.status})`);
      }
    } catch (error) {
      console.error('🔐 MFA setup error:', error);
      toast.error('Failed to setup MFA - Check console for details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/mfa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          code: verificationCode,
          is_backup_code: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Store the session ID for later use
          if (data.session_id) {
            sessionStorage.setItem('mfa_session_id', data.session_id);
            sessionStorage.setItem('mfa_session_user', userId);
          }
          toast.success('🎉 MFA verification completed successfully!');
          setShowSetup(false);
          setSetupData(null);
          setVerificationCode('');
          await fetchMFAStatus();
        } else {
          // Provide more helpful error messages
          if (data.error?.includes('Invalid MFA code')) {
            toast.error('❌ Invalid code. Please wait for a new code in your authenticator app and try again.');
          } else {
            toast.error(data.error || 'Verification failed. Please try again.');
          }
        }
      } else if (response.status === 429) {
        toast.error('⏱️ Too many attempts. Please wait a moment and try again.');
      } else {
        toast.error('Failed to verify MFA code. Please check your internet connection.');
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      toast.error('Connection error. Please check your internet connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuickVerify = async () => {
    if (!quickVerifyCode || quickVerifyCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/mfa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          code: quickVerifyCode,
          is_backup_code: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Store the session ID for later use
          if (data.session_id) {
            sessionStorage.setItem('mfa_session_id', data.session_id);
            sessionStorage.setItem('mfa_session_user', userId);
          }
          toast.success('✅ MFA verified! You can now save JIRA credentials.');
          setShowQuickVerify(false);
          setQuickVerifyCode('');
          await fetchMFAStatus();
        } else {
          toast.error('❌ Invalid code. Please try again.');
        }
      } else {
        toast.error('Failed to verify MFA code.');
      }
    } catch (error) {
      console.error('Quick MFA verification error:', error);
      toast.error('Connection error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!confirm('⚠️ Are you sure you want to disable MFA?\n\nThis will reduce your account security and make JIRA operations unavailable until MFA is re-enabled.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/mfa', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('🔓 MFA disabled successfully');
          // Force refresh MFA status and trigger UI update
          setMfaStatus({ enabled: false, backup_codes_remaining: 0, has_active_session: false });
          await fetchMFAStatus();
          // Notify other components of the change
          window.dispatchEvent(new Event('mfa-status-changed'));
        } else {
          toast.error(data.error || 'Failed to disable MFA');
        }
      } else {
        toast.error('Failed to disable MFA');
      }
    } catch (error) {
      console.error('MFA disable error:', error);
      toast.error('Failed to disable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (setupData?.backup_codes && setupData.backup_codes.length > 0) {
      const codesText = setupData.backup_codes.join('\n');
      navigator.clipboard.writeText(codesText);
      toast.success('📋 Backup codes copied to clipboard');
    } else {
      toast.error('No backup codes available to copy');
    }
  };

  const downloadBackupCodes = () => {
    if (setupData?.backup_codes && setupData.backup_codes.length > 0) {
      const codesText = setupData.backup_codes.join('\n');
      const blob = new Blob([codesText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mfa-backup-codes.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('💾 Backup codes downloaded');
    } else {
      toast.error('No backup codes available to download');
    }
  };

  if (mfaStatus === null) {
    return (
      <div className={`${isCompact ? 'p-4' : 'p-6'} ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600 dark:text-gray-400 text-sm">Loading MFA settings...</span>
        </div>
      </div>
    );
  }

  if (isCompact) {
    return (
      <div className={`${className}`}>
        {/* Compact MFA Status */}
        <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{mfaStatus.enabled ? '🔐' : '⚠️'}</span>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {mfaStatus.enabled ? 'MFA Configured' : 'MFA Required'}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mfaStatus.enabled ? 'Ready for JIRA operations' : 'Required for JIRA operations'}
                </p>
              </div>
            </div>
            <div className={`px-2 py-1 text-sm font-bold rounded-full ${
              mfaStatus.enabled 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
            }`}>
              {mfaStatus.enabled ? 'READY' : 'REQUIRED'}
            </div>
          </div>

          {/* Compact Status Info */}
          {mfaStatus.enabled && (
            <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
              <div className="bg-gray-50 dark:bg-gray-600 p-2 rounded text-center">
                <div className="font-medium text-gray-900 dark:text-white">Backup Codes</div>
                <div className={`${
                  (mfaStatus.backup_codes_remaining || 0) > 3 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {mfaStatus.backup_codes_remaining || 0} left
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-600 p-2 rounded text-center">
                <div className="font-medium text-gray-900 dark:text-white">Session</div>
                <div className={`${
                  mfaStatus.has_active_session 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {mfaStatus.has_active_session ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
          )}

          {/* Compact Action Button */}
          <div className="flex gap-2">
            {!mfaStatus.enabled ? (
              <button
                onClick={handleSetupMFA}
                disabled={isLoading}
                className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <span>🔐</span>
                    <span>Setup MFA (Required)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex-1 text-center py-2 px-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 rounded-md text-sm font-medium">
                ✅ MFA Configured & Ready
              </div>
            )}
          </div>

          {/* Mandatory Notice */}
          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded text-sm">
            <div className="flex items-center space-x-1">
              <span className="text-blue-500">🔒</span>
              <span className="text-blue-700 dark:text-blue-300 font-medium">
                {mfaStatus.enabled 
                  ? 'MFA is configured. Connect your JIRA credentials to start using protected operations.'
                  : 'Complete MFA setup first, then connect your JIRA credentials to enable secure operations.'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Setup Modal (same as full version) */}
        {showSetup && setupData && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 animate-slideUp">
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                      <span className="text-2xl">🔐</span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Setup MFA
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowSetup(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <span className="text-xl">✕</span>
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Step 1: QR Code or Existing Setup */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {setupData.is_existing ? 'Use Existing Authenticator' : 'Scan QR Code'}
                      </h4>
                    </div>
                    <div className="ml-10 space-y-3">
                      <p className="text-gray-600 dark:text-gray-400">
                        {setupData.is_existing 
                          ? 'You already have this account set up in your authenticator app. Use the existing entry to generate codes.'
                          : 'Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan this QR code:'
                        }
                      </p>
                      
                      {setupData.is_existing ? (
                        /* Existing MFA - Show account identifier */
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                          <div className="flex items-start space-x-2">
                            <span className="text-green-500 text-lg">✅</span>
                            <div className="text-sm text-green-700 dark:text-green-300">
                              <strong>Using Existing MFA Setup:</strong>
                              <ul className="mt-2 space-y-1 list-disc list-inside">
                                <li>Look for this account in your authenticator app: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{userEmail}</code></li>
                                <li>Use the 6-digit code from that entry</li>
                                <li>No need to scan the QR code again</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* New MFA - Show QR code only */
                        <div className="flex justify-center">
                          <div className="p-6 bg-white rounded-xl shadow-inner border-2 border-gray-200">
                            <img
                              src={`data:image/png;base64,${setupData.qr_code}`}
                              alt="MFA QR Code"
                              className="w-48 h-48 rounded-lg"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2: Verification */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Enter Verification Code
                      </h4>
                    </div>
                    <div className="ml-10 space-y-3">
                      <p className="text-gray-600 dark:text-gray-400">
                        Enter the 6-digit code from your authenticator app:
                      </p>
                      
                      {/* Timing guidance */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                        <div className="flex items-start space-x-2">
                          <span className="text-blue-500">💡</span>
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>Timing Tips:</strong>
                            <ul className="mt-1 space-y-1 list-disc list-inside">
                              <li>TOTP codes change every 30 seconds</li>
                              <li>Wait for a fresh code if you're unsure of timing</li>
                              <li>Each code can only be used once</li>
                              <li>The system allows a 90-second window for verification</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="flex-1 px-4 py-3 text-center text-2xl font-mono border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          maxLength={6}
                        />
                        <button
                          onClick={handleVerifySetup}
                          disabled={isVerifying || verificationCode.length !== 6}
                          className="px-4 py-3 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-md text-sm"
                        >
                          {isVerifying ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            '✓ Verify'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Backup Codes */}
                  {!setupData.is_existing && setupData.backup_codes && setupData.backup_codes.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Save Backup Codes
                        </h4>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 ml-10">
                        Save these backup codes securely. Use them to access your account if you lose your authenticator device:
                      </p>
                    
                    <div className="ml-10 bg-gray-50 dark:bg-gray-700 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                        {(setupData.backup_codes || []).map((code, index) => (
                          <div key={index} className="py-2 px-3 bg-white dark:bg-gray-800 rounded border text-center font-semibold">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="ml-10 flex gap-3">
                      <button
                        onClick={copyBackupCodes}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transform hover:scale-105 transition-all duration-200 text-sm"
                      >
                        <span>📋</span>
                        <span>Copy</span>
                      </button>
                      <button
                        onClick={downloadBackupCodes}
                        className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transform hover:scale-105 transition-all duration-200 text-sm"
                      >
                        <span>💾</span>
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Security Warning */}
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
                    <div className="flex items-start space-x-3">
                      <span className="text-yellow-500 text-2xl">⚠️</span>
                      <div>
                        <h4 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                          Important Security Notes
                        </h4>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                          <li className="flex items-center space-x-2">
                            <span>🔒</span>
                            <span>Store backup codes in a secure location (password manager recommended)</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <span>🔄</span>
                            <span>Each backup code can only be used once</span>
                          </li>
                          <li className="flex items-center space-x-2">
                            <span>✅</span>
                            <span>Complete verification to activate MFA protection</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Verify Modal */}
        {showQuickVerify && (
          <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Verify MFA</h3>
                  <button
                    onClick={() => setShowQuickVerify(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  >
                    <span className="text-xl">✕</span>
                  </button>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Enter the 6-digit code from your authenticator app for: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{userEmail}</code>
                </p>
                
                <div className="flex gap-3 mb-4">
                  <input
                    type="text"
                    value={quickVerifyCode}
                    onChange={(e) => setQuickVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="flex-1 px-4 py-3 text-center text-xl font-mono border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    maxLength={6}
                  />
                  <button
                    onClick={handleQuickVerify}
                    disabled={isVerifying || quickVerifyCode.length !== 6}
                    className="px-4 py-3 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                  >
                    {isVerifying ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      '✓ Verify'
                    )}
                  </button>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  This creates a 30-minute session for JIRA operations.
                </div>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          @keyframes slideUp {
            from { 
              opacity: 0;
              transform: translateY(20px) scale(0.95);
            }
            to { 
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
          }
          
          .animate-slideUp {
            animation: slideUp 0.3s ease-out;
          }
        `}</style>
      </div>
    );
  }

  // Full version (existing code)
  return (
    <div className={`space-y-6 ${className}`}>
      {/* No JIRA Username Warning */}
      {!userId && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <span className="text-yellow-500 text-xl">⚠️</span>
            <div>
              <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">JIRA Username Required</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Please enter your JIRA username in the JIRA Integration section first. MFA will be tied to your JIRA account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MFA Status Card */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-full ${mfaStatus.enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
              <span className="text-2xl">{mfaStatus.enabled ? '🔐' : '⚠️'}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Multi-Factor Authentication (Required)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {mfaStatus.enabled 
                  ? 'MFA is configured and ready for JIRA operations'
                  : 'MFA setup is required before connecting JIRA'
                }
              </p>
            </div>
          </div>
          <div className={`px-4 py-2 text-sm font-bold rounded-full border-2 transition-all duration-200 ${
            mfaStatus.enabled 
              ? 'bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-700'
              : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-700'
          }`}>
            {mfaStatus.enabled ? '✅ CONFIGURED' : '⚠️ REQUIRED'}
          </div>
        </div>

        {/* Status Grid */}
        {mfaStatus.enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🛡️</span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Backup Codes</div>
                  <div className={`text-sm font-medium ${
                    (mfaStatus.backup_codes_remaining || 0) > 5 
                      ? 'text-green-600 dark:text-green-400' 
                      : (mfaStatus.backup_codes_remaining || 0) > 2
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {mfaStatus.backup_codes_remaining || 0} remaining
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
              <div className="flex items-center space-x-3">
                <span className={`text-2xl ${mfaStatus.has_active_session ? 'animate-pulse' : ''}`}>
                  {mfaStatus.has_active_session ? '🟢' : '🔴'}
                </span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">Active Session</div>
                  <div className={`text-sm font-medium ${
                    mfaStatus.has_active_session 
                      ? 'text-green-600 dark:text-green-400' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {mfaStatus.has_active_session ? 'Authenticated' : 'Not authenticated'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {!mfaStatus.enabled ? (
            <button
              onClick={handleSetupMFA}
              disabled={isLoading}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Setting up...</span>
                </>
              ) : (
                <>
                  <span>🔐</span>
                  <span>Setup MFA (Required)</span>
                </>
              )}
            </button>
          ) : (
            <div className="flex gap-3">
                              <div className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium rounded-lg border border-green-200 dark:border-green-700 text-sm">
                <span>✅</span>
                <span>MFA Configured</span>
              </div>
              {!mfaStatus.has_active_session && (
                <button
                  onClick={() => setShowQuickVerify(true)}
                                      className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors text-sm"
                >
                  <span>🔓</span>
                  <span>Verify for JIRA</span>
                </button>
              )}
              {mfaStatus.has_active_session && (
                                 <div className="flex items-center space-x-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 font-medium rounded-lg border border-blue-200 dark:border-blue-700 text-sm">
                  <span>🔒</span>
                  <span>Verified & Ready</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mandatory Notice */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start space-x-3">
            <span className="text-blue-500 text-lg">🔒</span>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                MFA Required for JIRA Operations
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                {mfaStatus.enabled 
                  ? 'MFA is configured. Connect your JIRA credentials to start using protected operations.'
                  : 'Complete MFA setup first, then connect your JIRA credentials to enable secure operations.'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MFA Setup Modal */}
      {showSetup && setupData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-gray-700 animate-slideUp">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Setup MFA
                  </h3>
                </div>
                <button
                  onClick={() => setShowSetup(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                >
                  <span className="text-xl">✕</span>
                </button>
              </div>

              <div className="space-y-8">
                {/* Step 1: QR Code */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Scan QR Code
                    </h4>
                  </div>
                  <div className="ml-10 space-y-3">
                    <p className="text-gray-600 dark:text-gray-400">
                      Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan this QR code:
                    </p>
                    
                    {/* Important note about duplicates */}
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <span className="text-yellow-500">⚠️</span>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">
                          <strong>Important:</strong> If you see duplicate entries in your authenticator app, 
                          delete the old ones and use only the newest entry for this setup.
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-center">
                      <div className="p-6 bg-white rounded-xl shadow-inner border-2 border-gray-200">
                        <img
                          src={`data:image/png;base64,${setupData.qr_code}`}
                          alt="MFA QR Code"
                          className="w-48 h-48 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Verification */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Enter Verification Code
                    </h4>
                  </div>
                  <div className="ml-10 space-y-3">
                    <p className="text-gray-600 dark:text-gray-400">
                      Enter the 6-digit code from your authenticator app:
                    </p>
                    
                    {/* Timing guidance */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <span className="text-blue-500">💡</span>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          <strong>Timing Tips:</strong>
                          <ul className="mt-1 space-y-1 list-disc list-inside">
                            <li>TOTP codes change every 30 seconds</li>
                            <li>Wait for a fresh code if you're unsure of timing</li>
                            <li>Each code can only be used once</li>
                            <li>The system allows a 90-second window for verification</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="flex-1 px-4 py-3 text-center text-2xl font-mono border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        maxLength={6}
                      />
                      <button
                        onClick={handleVerifySetup}
                        disabled={isVerifying || verificationCode.length !== 6}
                        className="px-4 py-3 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-md text-sm"
                      >
                        {isVerifying ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          '✓ Verify'
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3: Backup Codes */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Save Backup Codes
                    </h4>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 ml-10">
                    Save these backup codes securely. Use them to access your account if you lose your authenticator device:
                  </p>
                  
                  <div className="ml-10 bg-gray-50 dark:bg-gray-700 p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {(setupData.backup_codes || []).map((code, index) => (
                        <div key={index} className="py-2 px-3 bg-white dark:bg-gray-800 rounded border text-center font-semibold">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="ml-10 flex gap-3">
                    <button
                      onClick={copyBackupCodes}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transform hover:scale-105 transition-all duration-200 text-sm"
                    >
                      <span>📋</span>
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={downloadBackupCodes}
                      className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transform hover:scale-105 transition-all duration-200 text-sm"
                    >
                      <span>💾</span>
                      <span>Download</span>
                    </button>
                  </div>
                </div>

                {/* Security Warning */}
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
                  <div className="flex items-start space-x-3">
                    <span className="text-yellow-500 text-2xl">⚠️</span>
                    <div>
                      <h4 className="text-lg font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                        Important Security Notes
                      </h4>
                      <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
                        <li className="flex items-center space-x-2">
                          <span>🔒</span>
                          <span>Store backup codes in a secure location (password manager recommended)</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <span>🔄</span>
                          <span>Each backup code can only be used once</span>
                        </li>
                        <li className="flex items-center space-x-2">
                          <span>✅</span>
                          <span>Complete verification to activate MFA protection</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}; 