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
        
        const rotationStatus = getKeyRotationStatus();
        const credentialStatus = getJIRACredentialStatus();
        
        if (rotationStatus?.nextRotation) {
          const timeUntilRotation = getTimeUntilExpiration(rotationStatus.nextRotation);
          setKeyRotationTime(timeUntilRotation);
        }
        
        if (rotationStatus?.currentVersion) {
          setKeyVersion(rotationStatus.currentVersion);
        }
        
        if (credentialStatus?.expires) {
          const timeUntilExpiration = getTimeUntilExpiration(credentialStatus.expires);
          setCredentialExpiration(timeUntilExpiration);
        }
        
        if (credentialStatus?.fingerprint) {
          setFingerprint(credentialStatus.fingerprint);
        }
      };
      
      updateData();
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
    
    if (diffMs <= 0) return 'Expired';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffDays > 0) return `${diffDays}d ${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    if (diffHours > 0) return `${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
    return `${diffMinutes}m ${diffSeconds}s`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
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

  const getStatusColor = (timeString: string) => {
    if (timeString === 'Expired') return 'text-red-600 font-semibold';
    const hours = parseInt(timeString.match(/(\d+)h/)?.[1] || '0');
    const days = parseInt(timeString.match(/(\d+)d/)?.[1] || '0');
    const totalHours = days * 24 + hours;
    
    if (totalHours < 2) return 'text-red-600 font-semibold';
    if (totalHours < 6) return 'text-orange-600 font-semibold';
    return 'text-green-600 font-semibold';
  };

  if (!isVisible) {
    return (
      <div className="mb-0">
        <button
          onClick={() => setIsVisible(true)}
          className="group flex items-center justify-between w-full px-3 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg text-blue-700 dark:text-blue-300 transition-all duration-200 transform hover:scale-105 shadow-sm hover:shadow-md"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-100 dark:bg-blue-800/50 rounded-full group-hover:scale-110 transition-transform">
              <span className="text-base">🛡️</span>
            </div>
            <div>
              <div className="font-semibold text-sm">Security Dashboard</div>
              <div className="text-xs opacity-75 mt-0.5">Monitor security events</div>
            </div>
          </div>
          <span className="text-base group-hover:translate-x-1 transition-transform">→</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setIsVisible(false)}
      />
      
      <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl z-50 overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🛡️</span>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white">Security Dashboard</h3>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="text-xl">✕</span>
            </button>
          </div>

          {securityReport && (
            <div className="space-y-4">
              {/* Security Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3.5 rounded-lg border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center space-x-2 mb-2.5">
                    <span className="text-lg">⏱️</span>
                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">Session Age</div>
                  </div>
                  <div className="text-lg font-bold text-blue-800 dark:text-blue-200">
                    {formatDuration(securityReport.summary.sessionAge)}
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900/20 p-3.5 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center space-x-2 mb-2.5">
                    <span className="text-lg">🔑</span>
                    <div className="text-sm font-semibold text-green-600 dark:text-green-400">Credential Access</div>
                  </div>
                  <div className="text-lg font-bold text-green-800 dark:text-green-200">
                    {securityReport.summary.credentialAccesses}
                  </div>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3.5 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <div className="flex items-center space-x-2 mb-2.5">
                    <span className="text-lg">📊</span>
                    <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">Total Events</div>
                  </div>
                  <div className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                    {securityReport.summary.totalEvents}
                  </div>
                </div>
                
                <div className="bg-red-50 dark:bg-red-900/20 p-3.5 rounded-lg border border-red-200 dark:border-red-700">
                  <div className="flex items-center space-x-2 mb-2.5">
                    <span className="text-lg">🚨</span>
                    <div className="text-sm font-semibold text-red-600 dark:text-red-400">Alerts</div>
                  </div>
                  <div className="text-lg font-bold text-red-800 dark:text-red-200">
                    {securityReport.summary.highEvents + securityReport.summary.criticalEvents}
                  </div>
                </div>
              </div>

              {/* Credential Security */}
              {(fingerprint || keyVersion > 0) && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2 mb-3.5">
                    <span className="text-lg">🔐</span>
                    <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">JIRA Security</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {fingerprint && credentialExpiration && (
                      <div className="flex items-center justify-between py-2.5 px-3.5 bg-white dark:bg-gray-700 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">✅</span>
                          <div>
                            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Credentials</div>
                            <div className="text-xs text-gray-500 font-mono">{fingerprint.substring(0, 8)}...</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Expires</div>
                          <div className={`text-sm font-mono ${getStatusColor(credentialExpiration)}`}>
                            {credentialExpiration}
                          </div>
                        </div>
                      </div>
                    )}

                    {keyVersion > 0 && (
                      <div className="flex items-center justify-between py-2.5 px-3.5 bg-white dark:bg-gray-700 rounded-lg border">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg">🔄</span>
                          <div>
                            <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">Key Rotation</div>
                            <div className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">
                              v{keyVersion}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 dark:text-gray-400">Next</div>
                          <div className={`text-sm font-mono ${getStatusColor(keyRotationTime)}`}>
                            {keyRotationTime || 'Loading...'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recent Events */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-3.5">
                  <span className="text-lg">📋</span>
                  <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">Recent Events</h4>
                </div>
                
                <div className="max-h-40 overflow-y-auto space-y-2.5">
                  {securityReport.recentEvents.length === 0 ? (
                    <div className="text-center py-6">
                      <span className="text-3xl mb-2 block">🔒</span>
                      <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">No recent events</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your session is secure</div>
                    </div>
                  ) : (
                    securityReport.recentEvents.slice(0, 5).map((event, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-lg">{getSeverityIcon(event.severity)}</span>
                            <div>
                              <div className="font-semibold text-sm">
                                {event.event.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              <div className="text-xs opacity-75 mt-1">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full font-bold border ${getSeverityColor(event.severity)}`}>
                            {event.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Session Info */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-3.5">
                  <span className="text-lg">🔍</span>
                  <h4 className="text-base font-bold text-gray-700 dark:text-gray-300">Session Info</h4>
                </div>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white dark:bg-gray-700 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-400">ID:</span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs">
                      {securityReport.sessionInfo.id.substring(0, 8)}...
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white dark:bg-gray-700 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Created:</span>
                    <span className="text-sm">{new Date(securityReport.sessionInfo.created).toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 px-3 bg-white dark:bg-gray-700 rounded-lg">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Last Activity:</span>
                    <span className="text-sm">{new Date(securityReport.sessionInfo.lastActivity).toLocaleTimeString()}</span>
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