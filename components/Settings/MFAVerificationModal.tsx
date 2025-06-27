import { FC, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
  title?: string;
  description?: string;
}

export const MFAVerificationModal: FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "MFA Verification Required",
  description = "Please verify your identity to continue with this secure operation."
}) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [isBackupCode, setIsBackupCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setVerificationCode('');
      setIsBackupCode(false);
      setIsVerifying(false);
      setFailedAttempts(0);
      setIsLocked(false);
      setLockoutTime(0);
    }
  }, [isOpen]);

  // Handle lockout countdown
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setTimeout(() => {
        setLockoutTime(lockoutTime - 1);
        if (lockoutTime === 1) {
          setIsLocked(false);
          setFailedAttempts(0);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [lockoutTime]);

  const handleVerify = async () => {
    if (!verificationCode || (!isBackupCode && verificationCode.length !== 6)) {
      toast.error('Please enter a valid verification code');
      return;
    }

    if (isLocked) {
      toast.error(`Please wait ${lockoutTime} seconds before trying again`);
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch('/api/mfa', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'default-user',
        },
        body: JSON.stringify({
          code: verificationCode,
          is_backup_code: isBackupCode,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('🎉 MFA verification successful!');
          onSuccess(data.session_id);
          onClose();
        } else {
          const newFailedAttempts = failedAttempts + 1;
          setFailedAttempts(newFailedAttempts);
          
          if (newFailedAttempts >= 3) {
            setIsLocked(true);
            setLockoutTime(30); // 30 second lockout
            toast.error('🔒 Too many failed attempts. Please wait 30 seconds.');
          } else {
            toast.error(`❌ Invalid code. ${3 - newFailedAttempts} attempts remaining.`);
          }
          
          setVerificationCode('');
        }
      } else {
        toast.error('Failed to verify MFA code');
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      toast.error('Failed to verify MFA code');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isVerifying && !isLocked) {
      handleVerify();
    }
  };

  const toggleBackupCode = () => {
    setIsBackupCode(!isBackupCode);
    setVerificationCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl border-2 border-gray-200 dark:border-gray-700 animate-slideUp">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                <span className="text-2xl">🔐</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>

          {/* Failed Attempts Warning */}
          {failedAttempts > 0 && !isLocked && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-yellow-500 text-lg">⚠️</span>
                <div>
                  <div className="font-semibold text-yellow-800 dark:text-yellow-200">
                    {failedAttempts} failed attempt{failedAttempts > 1 ? 's' : ''}
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    {3 - failedAttempts} attempt{3 - failedAttempts !== 1 ? 's' : ''} remaining before lockout
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lockout Warning */}
          {isLocked && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <span className="text-red-500 text-lg animate-pulse">🔒</span>
                <div>
                  <div className="font-semibold text-red-800 dark:text-red-200">
                    Account Temporarily Locked
                  </div>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Please wait <span className="font-mono font-bold">{lockoutTime}</span> seconds before trying again
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Code Type Toggle */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => {
                  setIsBackupCode(false);
                  setVerificationCode('');
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  !isBackupCode
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="mr-2">📱</span>
                Authenticator Code
              </button>
              <button
                onClick={() => {
                  setIsBackupCode(true);
                  setVerificationCode('');
                }}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isBackupCode
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span className="mr-2">🔑</span>
                Backup Code
              </button>
            </div>
          </div>

          {/* Input Field */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {isBackupCode ? (
                <>
                  <span className="flex items-center space-x-2">
                    <span>🔑</span>
                    <span>Enter Backup Code</span>
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-1 block">
                    Enter one of your saved backup codes
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center space-x-2">
                    <span>📱</span>
                    <span>Enter 6-Digit Code</span>
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-1 block">
                    From your authenticator app
                  </span>
                </>
              )}
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                if (isBackupCode) {
                  setVerificationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                } else {
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                }
              }}
              onKeyPress={handleKeyPress}
              placeholder={isBackupCode ? "BACKUP-CODE" : "000000"}
              disabled={isLocked}
              className={`w-full px-4 py-4 text-center text-2xl font-mono border-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                isLocked 
                  ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                  : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
              maxLength={isBackupCode ? 20 : 6}
              autoFocus
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-all duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleVerify}
              disabled={isVerifying || isLocked || !verificationCode || (!isBackupCode && verificationCode.length !== 6)}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>🔓</span>
                  <span>Verify</span>
                </>
              )}
            </button>
          </div>

          {/* Help Text */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 text-sm">💡</span>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <div className="font-semibold mb-1">Need help?</div>
                <ul className="space-y-1 text-xs">
                  <li>• Open your authenticator app (Google Authenticator, Authy, etc.)</li>
                  <li>• Find the 6-digit code for this account</li>
                  <li>• Or use one of your saved backup codes</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

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