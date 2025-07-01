import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { getJIRACredentialStatus, getSecureJIRACredentials } from '@/utils/app/crypto';
import { JIRACredentials } from '@/types/jira';

interface Props {
  className?: string;
}

export const JiraStatus: FC<Props> = ({ className = '' }) => {
  const { t } = useTranslation('settings');
  const [status, setStatus] = useState<{ expires?: Date; fingerprint?: string } | null>(null);
  const [credentials, setCredentials] = useState<JIRACredentials | null>(null);

  useEffect(() => {
    const updateStatus = async () => {
      const currentStatus = getJIRACredentialStatus();
      setStatus(currentStatus);
      if (currentStatus) {
        const creds = await getSecureJIRACredentials();
        setCredentials(creds);
      } else {
        setCredentials(null);
      }
    };

    updateStatus();

    window.addEventListener('jira-credentials-changed', updateStatus);

    return () => {
      window.removeEventListener('jira-credentials-changed', updateStatus);
    };
  }, []);

  const isConnected = status && credentials;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {isConnected ? `JIRA Connected (${credentials.username})` : 'JIRA Not Connected'}
      </span>
    </div>
  );
}; 