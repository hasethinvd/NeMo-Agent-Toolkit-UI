import { FC } from 'react';

interface Props {
  fingerprint?: string;
  expires?: Date;
  className?: string;
}

export const JiraCredentialsStatus: FC<Props> = ({ fingerprint, expires, className = '' }) => {
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
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  };

  const timeRemaining = getTimeUntilExpiration(expires);

  return (
    <div
      className={`flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 ${className}`}
      title="Your JIRA credentials are encrypted and stored securely on this device."
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold text-green-600">✔</span>
        <span>Secured</span>
      </div>
      <div className="flex items-center gap-1" title={`Full Fingerprint: ${fingerprint}`}>
        <span className="font-semibold">FP:</span>
        <span className="font-mono">{fingerprint.substring(0, 8)}...</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-semibold">Expires:</span>
        <span className={timeRemaining === 'Expired' ? 'text-red-600' : ''}>{timeRemaining}</span>
      </div>
    </div>
  );
}; 