import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { getJIRACredentialStatus, getSecureJIRACredentials } from '@/utils/app/crypto';
import { JIRACredentials } from '@/types/jira';

interface Props {
  className?: string;
}

export const JiraStatus: FC<Props> = ({ className = '' }) => {
  const { t } = useTranslation('settings');
  const [uiCredentials, setUiCredentials] = useState<JIRACredentials | null>(null);
  const [loading, setLoading] = useState(true);

    const updateStatus = async () => {
    setLoading(true);
    
    try {
      // First check local credentials
      const currentStatus = getJIRACredentialStatus();
      console.log('JIRA credential status check:', currentStatus);
      
      if (currentStatus) {
        const creds = await getSecureJIRACredentials();
        console.log('Retrieved JIRA credentials:', creds ? `username: ${creds.username}` : 'null');
        setUiCredentials(creds);
        
        // Also validate with backend using JWT cookies to check active session
        try {
          // Get backend URL with UI priority (check if SettingDialog has UI form values)
          const { shouldUseHeaderAuth } = await import('../../utils/app/api-config');
          
          // Check if we can get the backend URL from UI settings (highest priority)
          let backendUrl = 'http://localhost:8080'; // fallback
          
          // Try to get the current UI form value if SettingDialog is open
          const chatURLFromStorage = localStorage.getItem('chatCompletionURL');
          if (chatURLFromStorage) {
            try {
              const url = new URL(chatURLFromStorage);
              backendUrl = `${url.protocol}//${url.host}`;
              console.log('JIRA Status: Using backend URL from localStorage (UI settings):', backendUrl);
            } catch (error) {
              console.warn('Invalid stored chat URL:', chatURLFromStorage);
            }
          } else {
            // Fallback to environment variables
            if (process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL) {
              try {
                const url = new URL(process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL);
                backendUrl = `${url.protocol}//${url.host}`;
                console.log('JIRA Status: Using backend URL from environment:', backendUrl);
              } catch (error) {
                console.warn('Invalid environment chat URL:', process.env.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL);
              }
            }
          }
          
          const useHeaderAuth = await shouldUseHeaderAuth();
          
          let headers: any = {
            'Content-Type': 'application/json',
            'X-Backend-URL': backendUrl
          };
          let body: any = {};
          
          if (useHeaderAuth) {
            // Send credentials via Authorization header
            headers['Authorization'] = `Basic ${btoa(`${creds?.username}:${creds?.token}`)}`;
            body = {};  // Empty body for header auth
          } else {
            // Send credentials in request body
            body = {
              jira_credentials: {
                username: creds?.username,
                token: creds?.token
              }
            };
          }
          
          const response = await fetch('/api/mfa-jira-test-proxy', {
            method: 'POST',
            credentials: 'include',  // Include httpOnly JWT cookies
            headers: headers,
            body: JSON.stringify(body)
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('JIRA backend validation result:', data.valid, 'using backend:', backendUrl);
            // Keep credentials if backend validation succeeds
          } else {
            console.log('JIRA backend validation failed, but keeping local credentials. Backend:', backendUrl);
            // Still show connected based on local credentials
          }
        } catch (error) {
          console.log('Could not validate JIRA session with backend:', error);
          // Still show connected based on local credentials
        }
      } else {
        setUiCredentials(null);
      }
    } catch (error) {
      console.error('Error updating JIRA status:', error);
      setUiCredentials(null);
    }
    
    setLoading(false);
    };

  useEffect(() => {
    updateStatus();

    window.addEventListener('jira-credentials-changed', updateStatus);
    window.addEventListener('websocket-settings-changed', updateStatus);

    return () => {
      window.removeEventListener('jira-credentials-changed', updateStatus);
      window.removeEventListener('websocket-settings-changed', updateStatus);
    };
  }, []);

  const getStatus = () => {
    if (loading) return { connected: false, message: 'Checking...', color: 'gray' };
    
    if (uiCredentials) {
      return {
        connected: true,
        message: `JIRA Connected (${uiCredentials.username})`,
        color: 'green'
      };
    } else {
      return {
        connected: false,
        message: 'JIRA Not Connected',
        color: 'red'
      };
    }
  };

  const status = getStatus();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          status.color === 'green' ? 'bg-green-500' :
          status.color === 'gray' ? 'bg-gray-400' :
          'bg-red-500'
        }`} />
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {status.message}
      </span>
      </div>
    </div>
  );
}; 