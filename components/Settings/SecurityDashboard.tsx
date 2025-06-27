import React, { useState, useEffect } from 'react';
import { getSecurityReport } from '@/utils/app/session-security';
import { getKeyRotationStatus, getJIRACredentialStatus } from '@/utils/app/crypto';

interface SecurityEvent {
  timestamp: number;
  event: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userAgent: string;
  sessionId: string;
}

interface SecurityReport {
  sessionInfo: {
    id: string;
    created: number;
    lastActivity: number;
    userAgent: string;
    credentialAccess: number;
  };
  recentEvents: SecurityEvent[];
  summary: {
    totalEvents: number;
    criticalEvents: number;
    highEvents: number;
    sessionAge: number;
    credentialAccesses: number;
  };
}

const SecurityDashboard: React.FC = () => {
  const [securityReport, setSecurityReport] = useState<SecurityReport | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [keyRotationTime, setKeyRotationTime] = useState<string>('');
  const [keyVersion, setKeyVersion] = useState<number>(0);
  const [credentialExpiration, setCredentialExpiration] = useState<string>('');
  const [fingerprint, setFingerprint] = useState<string>('');

  useEffect(() => {
    if (isVisible && typeof window !== 'undefined') {
      const updateData = () => {
        const report = getSecurityReport();
        setSecurityReport(report);
        
        // Get key rotation status
        const rotationStatus = getKeyRotationStatus();
        const credentialStatus = getJIRACredentialStatus();
        
        if (rotationStatus?.nextRotation) {
          const timeUntilRotation = getTimeUntilExpiration(rotationStatus.nextRotation);
          setKeyRotationTime(timeUntilRotation);
        }
        
        if (rotationStatus?.currentVersion) {
          setKeyVersion(rotationStatus.currentVersion);
        }
        
        // Get credential status
        if (credentialStatus?.expires) {
          const timeUntilExpiration = getTimeUntilExpiration(credentialStatus.expires);
          setCredentialExpiration(timeUntilExpiration);
        }
        
        if (credentialStatus?.fingerprint) {
          setFingerprint(credentialStatus.fingerprint);
        }
      };
      
      updateData();
      
      // Refresh every second for real-time countdown
      const interval = setInterval(updateData, 1000);

      return () => clearInterval(interval);
    }
  }, [isVisible]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

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

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📋';
    }
  };

  const getRotationCountdownColor = (timeString: string) => {
    if (timeString === 'Expired' || timeString.includes('0s')) {
      return 'text-red-600 animate-pulse';
    }
    
    // Parse time to get minutes remaining
    const minutesMatch = timeString.match(/(\d+)m/);
    const hoursMatch = timeString.match(/(\d+)h/);
    const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const totalMinutes = hours * 60 + minutes;
    
    if (totalMinutes < 5) {
      return 'text-red-600 animate-pulse';
    } else if (totalMinutes < 15) {
      return 'text-orange-600';
    } else if (totalMinutes < 30) {
      return 'text-yellow-600';
    } else {
      return 'text-blue-800 dark:text-blue-200';
    }
  };

  const getCredentialExpirationColor = (timeString: string) => {
    if (timeString === 'Expired') {
      return 'text-red-600';
    }
    
    // Parse time to get hours remaining
    const hoursMatch = timeString.match(/(\d+)h/);
    const daysMatch = timeString.match(/(\d+)d/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const days = daysMatch ? parseInt(daysMatch[1]) : 0;
    const totalHours = days * 24 + hours;
    
    if (totalHours < 1) {
      return 'text-red-600 animate-pulse'; // Red and pulsing when < 1 hour
    } else if (totalHours < 2) {
      return 'text-red-600'; // Red when < 2 hours
    } else if (totalHours < 6) {
      return 'text-orange-600'; // Orange when 2-6 hours
    } else if (totalHours < 12) {
      return 'text-yellow-600'; // Yellow when 6-12 hours
    } else {
      return 'text-green-600'; // Green when > 12 hours
    }
  };

  const getCredentialStatusIcon = (timeString: string) => {
    if (timeString === 'Expired') {
      return '❌';
    }
    
    const hoursMatch = timeString.match(/(\d+)h/);
    const daysMatch = timeString.match(/(\d+)d/);
    const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
    const days = daysMatch ? parseInt(daysMatch[1]) : 0;
    const totalHours = days * 24 + hours;
    
    if (totalHours < 2) {
      return '⚠️';
    } else {
      return '✔️';
    }
  };

  if (!isVisible) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 
                     border border-blue-200 rounded-lg text-blue-700 transition-colors w-full justify-center"
        >
          <span>🛡️</span>
          <span>Security Dashboard</span>
          <span className="ml-2">→</span>
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40"
        onClick={() => setIsVisible(false)}
      />
      
      {/* Sliding Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center space-x-2">
              <span>🛡️</span>
              <span>Security Dashboard</span>
            </h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-xl"
            >
              ✕
            </button>
          </div>

      {securityReport && (
                <div className="space-y-4">
          {/* Credential Security Status */}
          {(fingerprint || keyVersion > 0) && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
              <h4 className="text-lg font-semibold text-green-800 dark:text-green-200 mb-3 flex items-center space-x-2">
                <span>🛡️</span>
                <span>JIRA Credential Security</span>
              </h4>
              
              <div className="grid grid-cols-1 gap-4">
                {/* Credential Status */}
                {fingerprint && credentialExpiration && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`text-lg ${getCredentialExpirationColor(credentialExpiration) === 'text-green-600' ? 'text-green-600' : 'text-yellow-600'}`}>
                          {getCredentialStatusIcon(credentialExpiration)}
                        </span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Secured</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400" title={`Full Fingerprint: ${fingerprint}`}>
                        FP: {fingerprint.substring(0, 6)}...
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Expires:</span>
                      <span className={`font-mono text-sm font-bold ${getCredentialExpirationColor(credentialExpiration)}`}>
                        {credentialExpiration}
                      </span>
                    </div>
                  </div>
                )}

                {/* Key Rotation Status */}
                {keyVersion > 0 && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">🔄</span>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Key Rotation</span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                          v{keyVersion}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Next in:</span>
                      <span className={`font-mono text-sm font-bold ${getRotationCountdownColor(keyRotationTime)}`}>
                        {keyRotationTime || 'Loading...'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Session Age</div>
              <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                {formatDuration(securityReport.summary.sessionAge)}
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">Credential Access</div>
              <div className="text-lg font-bold text-green-800 dark:text-green-200">
                {securityReport.summary.credentialAccesses}
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">Security Events</div>
              <div className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                {securityReport.summary.totalEvents}
              </div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-700">
              <div className="text-sm text-red-600 dark:text-red-400 font-medium">High/Critical</div>
              <div className="text-lg font-bold text-red-800 dark:text-red-200">
                {securityReport.summary.highEvents + securityReport.summary.criticalEvents}
              </div>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">Recent Security Events</h4>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {securityReport.recentEvents.length === 0 ? (
                <div className="text-gray-500 text-center py-4">No recent security events</div>
              ) : (
                securityReport.recentEvents.map((event, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-2">
                        <span className="text-lg">{getSeverityIcon(event.severity)}</span>
                        <div>
                          <div className="font-medium">{event.event.replace(/_/g, ' ')}</div>
                          <div className="text-sm opacity-75">
                            {formatTimestamp(event.timestamp)}
                          </div>
                          {Object.keys(event.details).length > 0 && (
                            <div className="text-xs mt-1 font-mono bg-white bg-opacity-50 p-1 rounded">
                              {JSON.stringify(event.details, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${getSeverityColor(event.severity)}`}>
                        {event.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
            <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-2">Session Information</h4>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Session ID:</span>
                <span className="ml-2 font-mono text-xs">
                  {securityReport.sessionInfo.id.substring(0, 8)}...
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Created:</span>
                <span className="ml-2">{formatTimestamp(securityReport.sessionInfo.created)}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Last Activity:</span>
                <span className="ml-2">{formatTimestamp(securityReport.sessionInfo.lastActivity)}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">User Agent:</span>
                <span className="ml-2 text-xs truncate">
                  {securityReport.sessionInfo.userAgent.substring(0, 50)}...
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </>
  );
};

export default SecurityDashboard; 