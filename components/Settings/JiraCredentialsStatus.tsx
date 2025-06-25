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

  const formattedDate = expires.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 ${className}`}
    >
      <div className="flex items-center gap-2" title="Your JIRA credentials are encrypted and stored securely on this device.">
        <span className="font-semibold text-green-600">✔</span>
        <span>Secured</span>
      </div>
      <div className="flex items-center gap-2" title={`Full Fingerprint: ${fingerprint}`}>
        <span className="font-semibold">FP:</span>
        <span className="font-mono">{fingerprint.substring(0, 8)}...</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-semibold">Expires:</span>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
}; 