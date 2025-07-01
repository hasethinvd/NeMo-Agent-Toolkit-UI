import { Settings } from '@/types/settings';
import { 
  setSecureJIRACredentials, 
  getSecureJIRACredentials, 
  clearJIRACredentials as clearSecureJIRACredentials,
  getJIRACredentialStatus 
} from './crypto';

const STORAGE_KEY = 'settings';

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

// JIRA utilities using the secure crypto functions
export const getJiraCredentials = async (): Promise<{ username: string; token: string } | null> => {
  return await getSecureJIRACredentials();
};

export const saveJiraCredentials = async (username: string, token: string): Promise<void> => {
  if (!username || !token) {
    throw new Error('Username and token are required');
  }

  try {
    await setSecureJIRACredentials({ username, token });
    console.log('✅ JIRA credentials saved successfully');
  } catch (error) {
    console.error('❌ Failed to save JIRA credentials:', error);
    throw error;
  }
};

export const hasJiraCredentials = (): boolean => {
  return getJIRACredentialStatus() !== null;
};

export const clearJiraCredentials = (): void => {
  clearSecureJIRACredentials();
  console.log('✅ JIRA credentials cleared');
};

export const getCredentialsExpiration = (): Date | null => {
  const status = getJIRACredentialStatus();
  return status?.expires || null;
};

// Re-export for convenience
export { getJIRACredentialStatus };
