import { FC, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName: string;
  mfaCode: string;
  setMfaCode: (code: string) => void;
  onVerify: () => void;
  existingQrCode?: string;
}

export const MFAVerifyModal: FC<Props> = ({
  isOpen,
  onClose,
  userEmail,
  userName,
  mfaCode,
  setMfaCode,
  onVerify,
  existingQrCode
}) => {
  const [qrCode, setQrCode] = useState<string>('');
  const [isLoadingQR, setIsLoadingQR] = useState(false);



  useEffect(() => {
    if (isOpen) {
      if (existingQrCode) {
        // Use the existing QR code if provided
        console.log('MFAVerifyModal: Using existing QR code, length:', existingQrCode.length);
        setQrCode(existingQrCode);
      } else if (userName && !qrCode) {
        // Fetch QR code if not provided
        console.log('MFAVerifyModal: No existing QR code, fetching for user:', userName);
        fetchQRCode();
      } else {
        console.log('MFAVerifyModal: No QR code available and no userName:', { userName, existingQrCode: !!existingQrCode });
      }
    }
  }, [isOpen, userName, qrCode, existingQrCode]);

  const fetchQRCode = async () => {
    setIsLoadingQR(true);
    try {
      // For verification, we fetch the existing QR code (reuse_existing=true)
      const response = await fetch('/api/mfa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userName,
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          reuse_existing: true
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.qr_code) {
          setQrCode(data.qr_code);
        }
      }
    } catch (error) {
      console.error('Error fetching QR code:', error);
    } finally {
      setIsLoadingQR(false);
    }
  };

  if (!isOpen) return null;

  return (
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
        e.preventDefault();
        e.stopPropagation();
        // Completely prevent any click from closing the modal
        console.log('MFA Verify Modal backdrop clicked - preventing closure');
        return false;
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
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
          e.stopPropagation();
          console.log('MFA Verify Modal content clicked');
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">🔐 Verify MFA</h3>
                         <button
               type="button"
               onMouseDown={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
               }}
               onClick={(e) => {
                 e.preventDefault();
                 e.stopPropagation();
                 console.log('MFA Verify Modal close button clicked');
                 setTimeout(() => {
                   onClose();
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

          {/* QR Code Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Your QR Code Reference
            </h4>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                📱 <strong>Authenticator App:</strong> Use your existing entry for <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{userEmail}</code>
                <br />If you need to re-scan, use the QR code below.
              </p>
            </div>

            {/* QR Code Display */}
            <div className="flex justify-center mb-4">
              {isLoadingQR ? (
                <div className="p-6 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : qrCode ? (
                <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-gray-200">
                  <img
                    src={`data:image/png;base64,${qrCode}`}
                    alt="MFA QR Code"
                    className="w-40 h-40 rounded-lg"
                  />
                </div>
              ) : (
                <div className="p-6 bg-gray-100 dark:bg-gray-700 rounded-xl border-2 border-gray-200 dark:border-gray-600">
                  <p className="text-gray-600 dark:text-gray-400 text-sm">QR code not available</p>
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Account: <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">{userEmail}</code>
              </p>
            </div>
          </div>

          {/* Verification Section */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Enter Verification Code</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Enter the 6-digit code from your authenticator app:
            </p>
            
            <div className="flex gap-3 mb-4">
                             <input
                 type="text"
                 value={mfaCode}
                 onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                 onClick={(e) => {
                   e.stopPropagation();
                   console.log('MFA input clicked');
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
                   console.log('MFA Verify button mouse down');
                 }}
                 onClick={(e) => {
                   e.preventDefault();
                   e.stopPropagation();
                   console.log('MFA Verify button clicked');
                   
                   if (mfaCode.length === 6) {
                     console.log('MFAVerifyModal: Verify button clicked, code:', mfaCode);
                     setTimeout(() => {
                       onVerify();
                     }, 10);
                   }
                 }}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter' || e.key === ' ') {
                     e.preventDefault();
                     e.stopPropagation();
                     if (mfaCode.length === 6) {
                       console.log('MFAVerifyModal: Verify button pressed with keyboard, code:', mfaCode);
                       setTimeout(() => {
                         onVerify();
                       }, 10);
                     }
                   }
                 }}
                 disabled={mfaCode.length !== 6}
                 className="px-6 py-3 bg-gradient-to-r from-[#76B900] to-[#6AA600] hover:from-[#6AA600] hover:to-[#5E9400] text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                 style={{ 
                   pointerEvents: 'auto', 
                   zIndex: 1000001,
                   position: 'relative'
                 }}
               >
                 Verify
               </button>
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              This creates a 24-hour session for JIRA operations.
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}; 