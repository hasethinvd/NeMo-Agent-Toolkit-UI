import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import toast from 'react-hot-toast';
import { JiraStatus } from './JiraStatus';
import { clearJIRACredentials, getJIRACredentialStatus, setSecureJIRACredentials } from '../../utils/app/crypto';
import SecurityDashboard from './SecurityDashboard';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    state: { lightMode, chatCompletionURL, webSocketURL, webSocketSchema: schema, expandIntermediateSteps, intermediateStepOverride, enableIntermediateSteps, webSocketSchemas },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [theme, setTheme] = useState<'light' | 'dark'>(lightMode);
  const [chatCompletionEndPoint, setChatCompletionEndPoint] = useState(sessionStorage.getItem('chatCompletionURL') || chatCompletionURL || '');
  const [webSocketEndPoint, setWebSocketEndPoint] = useState( sessionStorage.getItem('webSocketURL') || webSocketURL || '');
  const [webSocketSchema, setWebSocketSchema] = useState( sessionStorage.getItem('webSocketSchema') || schema || '');
  const [isIntermediateStepsEnabled, setIsIntermediateStepsEnabled] = useState(sessionStorage.getItem('enableIntermediateSteps') ? sessionStorage.getItem('enableIntermediateSteps') === 'true' : enableIntermediateSteps);
  const [detailsToggle, setDetailsToggle] = useState( sessionStorage.getItem('expandIntermediateSteps') === 'true' ? true : expandIntermediateSteps);
  const [intermediateStepOverrideToggle, setIntermediateStepOverrideToggle] = useState( sessionStorage.getItem('intermediateStepOverride') === 'false' ? false : intermediateStepOverride);
  
  const [jiraUsernameValue, setJiraUsernameValue] = useState('');
  const [jiraTokenValue, setJiraTokenValue] = useState('');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const updateCredentialStatus = () => {
      const status = getJIRACredentialStatus();
      setHasCredentials(!!status?.fingerprint);
    };

    updateCredentialStatus();
    
    // Listen for credential changes
    const handleCredentialChange = () => {
      updateCredentialStatus();
    };
    
    window.addEventListener('jira-credentials-changed', handleCredentialChange);
    
    return () => {
      window.removeEventListener('jira-credentials-changed', handleCredentialChange);
    };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (open) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  const handleSave = async () => {
    if(!chatCompletionEndPoint || !webSocketEndPoint) {
      toast.error('Please fill all the fields to save settings');
      return;
    }

    homeDispatch({ field: 'lightMode', value: theme });
    homeDispatch({ field: 'chatCompletionURL', value: chatCompletionEndPoint });
    homeDispatch({ field: 'webSocketURL', value: webSocketEndPoint });
    homeDispatch({ field: 'webSocketSchema', value: webSocketSchema });
    homeDispatch({ field: 'expandIntermediateSteps', value: detailsToggle });
    homeDispatch({ field: 'intermediateStepOverride', value: intermediateStepOverrideToggle });
    homeDispatch({ field: 'enableIntermediateSteps', value: isIntermediateStepsEnabled });
    
    sessionStorage.setItem('chatCompletionURL', chatCompletionEndPoint);
    sessionStorage.setItem('webSocketURL', webSocketEndPoint);
    sessionStorage.setItem('webSocketSchema', webSocketSchema);
    sessionStorage.setItem('expandIntermediateSteps', String(detailsToggle));
    sessionStorage.setItem('intermediateStepOverride', String(intermediateStepOverrideToggle));
    sessionStorage.setItem('enableIntermediateSteps', String(isIntermediateStepsEnabled));
    
    if (jiraUsernameValue && jiraTokenValue) {
      setIsSaving(true);
      const response = await fetch('/api/validate-jira', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: jiraUsernameValue, token: jiraTokenValue }),
      });

      if (response.ok) {
        await setSecureJIRACredentials({ username: jiraUsernameValue, token: jiraTokenValue });
        toast.success('JIRA credentials saved securely.');
      } else {
        const errorData = await response.json();
        toast.error(`JIRA validation failed: ${errorData.error || 'Unknown error'}`);
        setIsSaving(false);
        return; // Stop execution if validation fails
      }
      setIsSaving(false);
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('jira-credentials-changed'));

    toast.success('Settings saved successfully');
    onClose();
  };

  const handleClearJira = () => {
    setJiraUsernameValue('');
    setJiraTokenValue('');
    clearJIRACredentials();
    setHasCredentials(false);
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('jira-credentials-changed'));
    toast.success('JIRA credentials cleared.');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm z-50 dark:bg-opacity-20">
      <div
        ref={modalRef}
        className="w-full max-w-md bg-white dark:bg-[#202123] rounded-2xl shadow-lg p-6 transform transition-all relative"
      >
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{t('Settings')}</h2>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('Theme')}</label>
        <select
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
          value={theme}
          onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
        >
          <option value="dark">{t('Dark mode')}</option>
          <option value="light">{t('Light mode')}</option>
        </select>
      
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">{t('HTTP URL for Chat Completion')}</label>
        <input
          type="text"
          value={chatCompletionEndPoint}
          onChange={(e) => setChatCompletionEndPoint(e.target.value)}
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">{t('WebSocket URL for Chat Completion')}</label>
        <input
          type="text"
          value={webSocketEndPoint}
          onChange={(e) => setWebSocketEndPoint(e.target.value)}
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">{t('WebSocket Schema')}</label>
        <select
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
          value={webSocketSchema}
          onChange={(e) => {
            setWebSocketSchema(e.target.value)}
          }
        >
          {webSocketSchemas?.map((schema) => (
            <option key={schema} value={schema}>
              {schema}
            </option>
          ))}
        </select>

        <div className="flex align-middle text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
          <input
            type="checkbox"
            id="enableIntermediateSteps"
            checked={isIntermediateStepsEnabled}
            onChange={ () => {
              setIsIntermediateStepsEnabled(!isIntermediateStepsEnabled)
            }}
            className="mr-2"
          />
          <label
            htmlFor="enableIntermediateSteps"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Enable Intermediate Steps
          </label>
        </div>

        <div className="flex align-middle text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
          <input
            type="checkbox"
            id="detailsToggle"
            checked={detailsToggle}
            onChange={ () => {
              setDetailsToggle(!detailsToggle)
            }}
            disabled={!isIntermediateStepsEnabled}
            className="mr-2"
          />
          <label
            htmlFor="detailsToggle"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Expand Intermediate Steps by default
          </label>
        </div>

        <div className="flex align-middle text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">
          <input
            type="checkbox"
            id="intermediateStepOverrideToggle"
            checked={intermediateStepOverrideToggle}
            onChange={ () => {
              setIntermediateStepOverrideToggle(!intermediateStepOverrideToggle)
            }}
            disabled={!isIntermediateStepsEnabled}
            className="mr-2"
          />
          <label
            htmlFor="intermediateStepOverrideToggle"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Override intermediate Steps with same Id
          </label>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">JIRA Configuration</h3>
          <JiraStatus className="mb-3" />
          <SecurityDashboard />
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">{t('JIRA Username')}</label>
        <input
          type="text"
          value={jiraUsernameValue}
          onChange={(e) => setJiraUsernameValue(e.target.value)}
          placeholder="Enter your JIRA username"
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        />

        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-4">{t('JIRA Token')}</label>
        <input
          type="password"
          value={jiraTokenValue}
          onChange={(e) => setJiraTokenValue(e.target.value)}
          placeholder="Enter your JIRA API token"
          className="w-full mt-1 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none"
        />

        {hasCredentials && (
          <div className="mt-4">
            <button
              type="button"
              className="w-full px-4 py-2 rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors"
              onClick={handleClearJira}
            >
              {t('Clear JIRA Credentials')}
            </button>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-white bg-[#76b900] hover:bg-opacity-80 transition-all shadow-sm hover:shadow-md transform hover:-translate-y-0.5 disabled:bg-gray-400"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? t('Saving...') : t('Save')}
          </button>
        </div>
      </div>
    </div>
  );
};
