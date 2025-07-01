import { FC, useState, useEffect } from 'react';
import { getJIRACredentialStatus } from '../../utils/app/crypto';

interface Props {
  className?: string;
}

export const JiraTokenCountdown: FC<Props> = ({ className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const getTimeUntilExpiration = (expirationDate: Date): string => {
    const now = new Date();
    const diffMs = expirationDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Expired';
    }
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ${diffSeconds}s`;
    } else {
      return `${diffSeconds}s`;
    }
  };

  const getExpirationColor = (expires: Date): string => {
    if (timeRemaining === 'Expired') {
      return 'text-red-500 bg-red-100 dark:bg-red-900/20';
    }
    
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'text-red-500 bg-red-100 dark:bg-red-900/20 animate-pulse';
    } else if (diffHours < 2) {
      return 'text-red-500 bg-red-100 dark:bg-red-900/20';
    } else if (diffHours < 6) {
      return 'text-orange-500 bg-orange-100 dark:bg-orange-900/20';
    } else if (diffHours < 12) {
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    } else {
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      const status = getJIRACredentialStatus();
      if (status && status.expires) {
        setTimeRemaining(getTimeUntilExpiration(status.expires));
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    // Listen for credential changes
    const handleCredentialChange = () => {
      updateTimer();
    };

    window.addEventListener('jira-credentials-changed', handleCredentialChange);
    window.addEventListener('storage', handleCredentialChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('jira-credentials-changed', handleCredentialChange);
      window.removeEventListener('storage', handleCredentialChange);
    };
  }, []);

  if (!isVisible || !timeRemaining) {
    return null;
  }

  const status = getJIRACredentialStatus();
  if (!status || !status.expires) {
    return null;
  }

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getExpirationColor(status.expires)} ${className}`}
      title="JIRA Token Expiration Time"
    >
      <span>🔑</span>
      <span>{timeRemaining}</span>
    </div>
  );
}; 