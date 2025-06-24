import { FC, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'next-i18next';
import HomeContext from '@/pages/api/home/home.context';
import toast from 'react-hot-toast';
import { JiraStatus } from './JiraStatus';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingDialog: FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation('settings');
  const modalRef = useRef<HTMLDivElement>(null);
  const {
    state: { lightMode, chatCompletionURL, webSocketURL, webSocketSchema: schema, expandIntermediateSteps, intermediateStepOverride, enableIntermediateSteps, webSocketSchemas, jiraToken, jiraUsername },
    dispatch: homeDispatch,
  } = useContext(HomeContext);

  const [theme, setTheme] = useState<'light' | 'dark'>(lightMode);
  const [chatCompletionEndPoint, setChatCompletionEndPoint] = useState(sessionStorage.getItem('chatCompletionURL') || chatCompletionURL || '');
  const [webSocketEndPoint, setWebSocketEndPoint] = useState( sessionStorage.getItem('webSocketURL') || webSocketURL || '');
  const [webSocketSchema, setWebSocketSchema] = useState( sessionStorage.getItem('webSocketSchema') || schema || '');
  const [isIntermediateStepsEnabled, setIsIntermediateStepsEnabled] = useState(sessionStorage.getItem('enableIntermediateSteps') ? sessionStorage.getItem('enableIntermediateSteps') === 'true' : enableIntermediateSteps);
  const [detailsToggle, setDetailsToggle] = useState( sessionStorage.getItem('expandIntermediateSteps') === 'true' ? true : expandIntermediateSteps);
  const [intermediateStepOverrideToggle, setIntermediateStepOverrideToggle] = useState( sessionStorage.getItem('intermediateStepOverride') === 'false' ? false : intermediateStepOverride);
  const [jiraTokenValue, setJiraTokenValue] = useState(sessionStorage.getItem('jiraToken') || jiraToken || '');
  const [jiraUsernameValue, setJiraUsernameValue] = useState(sessionStorage.getItem('jiraUsername') || jiraUsername || '');

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

  const handleSave = () => {
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
    homeDispatch({ field: 'jiraToken', value: jiraTokenValue });
    homeDispatch({ field: 'jiraUsername', value: jiraUsernameValue });

    sessionStorage.setItem('chatCompletionURL', chatCompletionEndPoint);
    sessionStorage.setItem('webSocketURL', webSocketEndPoint);
    sessionStorage.setItem('webSocketSchema', webSocketSchema);
    sessionStorage.setItem('expandIntermediateSteps', String(detailsToggle));
    sessionStorage.setItem('intermediateStepOverride', String(intermediateStepOverrideToggle));
    sessionStorage.setItem('enableIntermediateSteps', String(isIntermediateStepsEnabled));
    sessionStorage.setItem('jiraToken', jiraTokenValue);
    sessionStorage.setItem('jiraUsername', jiraUsernameValue);
    
    // Trigger storage event to update JIRA status
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('jira-credentials-changed'));

    toast.success('Settings saved successfully');
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
          {(jiraUsernameValue || jiraTokenValue) && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                🔒 Credentials are encrypted during transmission
              </span>
            </div>
          )}
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
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Generate your API token from JIRA → Account Settings → Security → API Tokens
        </p>

        {(jiraUsernameValue || jiraTokenValue) && (
          <button
            type="button"
            onClick={() => {
              setJiraUsernameValue('');
              setJiraTokenValue('');
              sessionStorage.removeItem('jiraUsername');
              sessionStorage.removeItem('jiraToken');
              window.dispatchEvent(new Event('storage'));
              window.dispatchEvent(new Event('jira-credentials-changed'));
            }}
            className="mt-3 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
          >
            Clear JIRA Credentials
          </button>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 focus:outline-none"
            onClick={onClose}
          >
            {t('Cancel')}
          </button>
          <button
            className="px-4 py-2 bg-[#76b900] text-white rounded-md hover:bg-[#5a9100] focus:outline-none"
            onClick={handleSave}
          >
            {t('Save')}
          </button>
        </div>
      </div>
    </div>
  );
};
