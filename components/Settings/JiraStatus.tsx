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
    
    // Check UI credentials only
    const currentStatus = getJIRACredentialStatus();
    if (currentStatus) {
      const creds = await getSecureJIRACredentials();
      setUiCredentials(creds);
    } else {
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