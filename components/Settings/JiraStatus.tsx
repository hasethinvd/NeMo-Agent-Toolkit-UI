import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { getJIRACredentialStatus, getSecureJIRACredentials } from '@/utils/app/crypto';
import { getApiUrl, getBackendJiraConfig } from '@/utils/app/api-config';
import { JIRACredentials } from '@/types/jira';

interface Props {
  className?: string;
}

interface BackendStatus {
  connected: boolean;
  source: 'backend_env' | 'ui_context' | 'none' | 'unknown';
  user?: {
    displayName: string;
    emailAddress: string;
  };
  error?: string;
  auth_method?: string;
}

export const JiraStatus: FC<Props> = ({ className = '' }) => {
  const { t } = useTranslation('settings');
  const [uiStatus, setUiStatus] = useState<{ expires?: Date; fingerprint?: string } | null>(null);
  const [uiCredentials, setUiCredentials] = useState<JIRACredentials | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const checkBackendStatus = async () => {
    try {
      const backendUrl = getApiUrl('/jira/status');
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const status = await response.json();
        
        // Also get the auth method from config
        try {
          const config = await getBackendJiraConfig();
          status.auth_method = config.auth_method;
        } catch (error) {
          console.warn('Could not get backend JIRA config:', error);
        }
        
        setBackendStatus(status);
      } else {
        setBackendStatus({
          connected: false,
          source: 'unknown',
          error: `Backend unreachable: ${response.status}`
        });
      }
    } catch (error) {
      console.error('Failed to check backend JIRA status:', error);
      setBackendStatus({
        connected: false,
        source: 'unknown',
        error: 'Backend connection failed'
      });
    }
  };

  const updateStatus = async () => {
    setLoading(true);
    
    // Check UI credentials
    const currentStatus = getJIRACredentialStatus();
    setUiStatus(currentStatus);
    if (currentStatus) {
      const creds = await getSecureJIRACredentials();
      setUiCredentials(creds);
    } else {
      setUiCredentials(null);
    }
    
    // Check backend status
    await checkBackendStatus();
    
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

  const getOverallStatus = () => {
    if (loading) return { connected: false, message: 'Checking...', color: 'gray' };
    
    const hasUiCredentials = uiStatus && uiCredentials;
    const backendConnected = backendStatus?.connected;
    const authMethod = backendStatus?.auth_method || 'body';
    
    if (hasUiCredentials && backendConnected) {
      return {
        connected: true,
        message: `JIRA Connected (${uiCredentials.username})`,
        details: `UI + Backend (${backendStatus.source}) • Auth: ${authMethod}`,
        color: 'green'
      };
    } else if (backendConnected && !hasUiCredentials) {
      return {
        connected: true,
        message: 'JIRA Connected (Backend Only)',
        details: `Source: ${backendStatus.source} • Auth: ${authMethod}`,
        color: 'yellow'
      };
    } else if (hasUiCredentials && !backendConnected) {
      return {
        connected: false,
        message: 'JIRA UI Configured, Backend Failed',
        details: backendStatus?.error || 'Backend connection issue',
        color: 'orange'
      };
    } else {
      return {
        connected: false,
        message: 'JIRA Not Connected',
        details: backendStatus?.error || 'No credentials configured',
        color: 'red'
      };
    }
  };

  const status = getOverallStatus();

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${
          status.color === 'green' ? 'bg-green-500' :
          status.color === 'yellow' ? 'bg-yellow-500' :
          status.color === 'orange' ? 'bg-orange-500' :
          status.color === 'gray' ? 'bg-gray-400' :
          'bg-red-500'
        }`} />
        <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
          {status.message}
        </span>
      </div>
      
      {status.details && (
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-4">
          {status.details}
        </div>
      )}
      
      {/* Debug info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="ml-4 text-xs text-gray-400">
          <summary className="cursor-pointer">Debug Info</summary>
          <div className="mt-1 space-y-1">
            <div>UI Credentials: {uiCredentials ? '✅' : '❌'}</div>
            <div>Backend Connected: {backendStatus?.connected ? '✅' : '❌'}</div>
            <div>Backend Source: {backendStatus?.source || 'unknown'}</div>
            {backendStatus?.error && <div>Backend Error: {backendStatus.error}</div>}
          </div>
        </details>
      )}
    </div>
  );
}; 