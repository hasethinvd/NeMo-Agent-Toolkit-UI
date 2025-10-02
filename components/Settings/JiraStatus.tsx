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
      if (currentStatus) {
        const creds = await getSecureJIRACredentials();
        setUiCredentials(creds);
        
        // Also validate with backend using JWT cookies to check active session
        try {
          // Get the correct backend URL dynamically
          const { getBackendUrl } = await import('../utils/app/api-config');
          const backendUrl = getBackendUrl();
          
          const response = await fetch('/api/mfa-jira-test-proxy', {
            method: 'POST',
            credentials: 'include',  // Include httpOnly JWT cookies
            headers: {
              'Content-Type': 'application/json',
              'X-Backend-URL': backendUrl  // Use dynamic backend URL
            },
            body: JSON.stringify({
              jira_credentials: {
                username: creds?.username,
                token: creds?.token
              }
            })
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