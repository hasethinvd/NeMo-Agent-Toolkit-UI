import { Settings } from '@/types/settings';
import { encryptCredentials, clearStoredCredentials, hasValidCredentials, getTimeUntilExpiration } from './crypto';

const STORAGE_KEY = 'settings';
const ENCRYPTED_JIRA_KEY = 'encrypted_jira_credentials';

export const getSettings = (): Settings => {
  let settings: Settings = {
    theme: 'light',
    jiraUsername: '',
    jiraToken: '',
  };
  const settingsJson = sessionStorage.getItem(STORAGE_KEY);
  if (settingsJson) {
    try {
      let savedSettings = JSON.parse(settingsJson) as Settings;
      settings = Object.assign(settings, savedSettings);
    } catch (e) {
      console.error(e);
    }
  }
  return settings;
};

export const saveSettings = (settings: Settings) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

// Enhanced JIRA utilities with encryption
export const getJiraCredentials = (): { username: string; token: string } => {
  // Try to get from plain storage first (legacy support)
  const plainUsername = sessionStorage.getItem('jiraUsername') || '';
  const plainToken = sessionStorage.getItem('jiraToken') || '';
  
  if (plainUsername && plainToken) {
    return { username: plainUsername, token: plainToken };
  }
  
  // If no plain credentials, return empty (encrypted credentials are handled separately)
  return { username: '', token: '' };
};

export const saveJiraCredentials = async (username: string, token: string): Promise<void> => {
  if (!username || !token) {
    throw new Error('Username and token are required');
  }

  try {
    // Encrypt and store credentials
    const encryptedData = await encryptCredentials({ username, token });
    sessionStorage.setItem(ENCRYPTED_JIRA_KEY, encryptedData);
    
    // Also store in plain format for backward compatibility (can be removed later)
    sessionStorage.setItem('jiraUsername', username);
    sessionStorage.setItem('jiraToken', token);
    
    console.log('✅ JIRA credentials encrypted and saved successfully');
  } catch (error) {
    console.error('❌ Failed to encrypt JIRA credentials:', error);
    throw error;
  }
};

export const hasJiraCredentials = (): boolean => {
  const { username, token } = getJiraCredentials();
  return (username.length > 0 && token.length > 0) || hasValidCredentials();
};

export const clearJiraCredentials = (): void => {
  // Clear both plain and encrypted credentials
  sessionStorage.removeItem('jiraUsername');
  sessionStorage.removeItem('jiraToken');
  sessionStorage.removeItem(ENCRYPTED_JIRA_KEY);
  clearStoredCredentials();
  console.log('✅ JIRA credentials cleared');
};

export const getCredentialsExpiration = (): number | null => {
  return getTimeUntilExpiration();
};
