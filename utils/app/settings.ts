import { Settings } from '@/types/settings';

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

// JIRA specific utilities
export const getJiraCredentials = (): { username: string; token: string } => {
  return {
    username: sessionStorage.getItem('jiraUsername') || '',
    token: sessionStorage.getItem('jiraToken') || '',
  };
};

export const saveJiraCredentials = (username: string, token: string) => {
  sessionStorage.setItem('jiraUsername', username);
  sessionStorage.setItem('jiraToken', token);
};

export const hasJiraCredentials = (): boolean => {
  const { username, token } = getJiraCredentials();
  return username.length > 0 && token.length > 0;
};
