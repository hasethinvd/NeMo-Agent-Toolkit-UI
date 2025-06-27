import { FC, useState, useEffect } from 'react';

interface Props {
  fingerprint?: string;
  expires?: Date;
  className?: string;
}

export const JiraCredentialsStatus: FC<Props> = ({ fingerprint, expires, className = '' }) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  if (!fingerprint || !expires) {
    return null;
  }

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
      return `${diffDays}d ${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes}m ${diffSeconds}s`;
    } else {
      return `${diffSeconds}s`;
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      setTimeRemaining(getTimeUntilExpiration(expires));
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expires]);

  const getExpirationColor = (): string => {
    if (timeRemaining === 'Expired') {
      return 'text-red-600';
    }
    
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return 'text-red-600 animate-pulse'; // Red and pulsing when < 1 hour
    } else if (diffHours < 2) {
      return 'text-red-600'; // Red when < 2 hours
    } else if (diffHours < 6) {
      return 'text-orange-600'; // Orange when 2-6 hours
    } else if (diffHours < 12) {
      return 'text-yellow-600'; // Yellow when 6-12 hours
    } else {
      return 'text-green-600'; // Green when > 12 hours
    }
  };

  const getStatusIcon = (): string => {
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (timeRemaining === 'Expired') {
      return '❌';
    } else if (diffHours < 2) {
      return '⚠️';
    } else {
      return '✔';
    }
  };

  const getStatusIconColor = (): string => {
    const now = new Date();
    const diffMs = expires.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (timeRemaining === 'Expired') {
      return 'text-red-600';
    } else if (diffHours < 2) {
      return 'text-yellow-600';
    } else {
      return 'text-green-600'; // Green checkmark when secured
    }
  };

  return (
    <div
      className={`flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 ${className}`}
      title="Your JIRA credentials are encrypted and stored securely on this device."
    >
      <div className="flex items-center gap-1">
        <span className={`font-semibold ${getStatusIconColor()}`}>{getStatusIcon()}</span>
        <span>Secured</span>
      </div>
      <div className="flex items-center gap-1" title={`Full Fingerprint: ${fingerprint}`}>
        <span className="font-semibold">FP:</span>
        <span className="font-mono">{fingerprint.substring(0, 8)}...</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">Expires:</span>
        <span className={getExpirationColor()}>{timeRemaining}</span>
      </div>
    </div>
  );
}; 