import { FC, useEffect, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { getJiraCredentials, hasJiraCredentials } from '@/utils/app/settings';

interface Props {
  className?: string;
}

export const JiraStatus: FC<Props> = ({ className = '' }) => {
  const { t } = useTranslation('settings');
  const [isConnected, setIsConnected] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [credentials, setCredentials] = useState({ username: '', token: '' });

  const validateJiraCredentials = async (username: string, token: string): Promise<boolean> => {
    if (!username || !token) return false;
    
    try {
      // Test credentials by making a simple API call to JIRA
      const response = await fetch('/api/validate-jira', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, token }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('JIRA validation error:', error);
      return false;
    }
  };

  useEffect(() => {
    const checkJiraConnection = async () => {
      const creds = getJiraCredentials();
      setCredentials(creds);
      
      if (hasJiraCredentials()) {
        setIsValidating(true);
        const valid = await validateJiraCredentials(creds.username, creds.token);
        setIsConnected(valid);
        setIsValidating(false);
      } else {
        setIsConnected(false);
      }
    };

    checkJiraConnection();
    
    // Listen for storage changes to update status
    const handleStorageChange = () => {
      checkJiraConnection();
    };

    // Listen for custom events to trigger validation
    const handleJiraValidation = () => {
      checkJiraConnection();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('jira-credentials-changed', handleJiraValidation);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('jira-credentials-changed', handleJiraValidation);
    };
  }, []);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${
        isValidating ? 'bg-yellow-500 animate-pulse' : 
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <span className="text-sm text-gray-600 dark:text-gray-300">
        {isValidating ? (
          'Validating JIRA credentials...'
        ) : isConnected ? (
          `JIRA Connected (${credentials.username})`
        ) : (
          credentials.username ? 'JIRA Authentication Failed' : 'JIRA Not Connected'
        )}
      </span>
    </div>
  );
}; 