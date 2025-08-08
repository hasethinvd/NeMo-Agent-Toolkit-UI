import { Conversation, Message } from '@/types/chat';
import { FolderInterface } from '@/types/folder';
import { t } from 'i18next';
import { getApiUrl } from '@/utils/app/api-config';
import { env } from 'next-runtime-env';

export interface HomeInitialState {
  loading: boolean;
  lightMode: 'light' | 'dark';
  messageIsStreaming: boolean;
  folders: FolderInterface[];
  conversations: Conversation[];
  selectedConversation: Conversation | undefined;
  currentMessage: Message | undefined;
  showChatbar: boolean;
  currentFolder: FolderInterface | undefined;
  messageError: boolean;
  searchTerm: string;
  chatHistory: boolean;
  chatCompletionURL?: string;
  webSocketMode?: boolean;
  webSocketConnected?: boolean;
  webSocketURL?: string;
  webSocketSchema?: string;
  webSocketSchemas?: string[];
  enableIntermediateSteps?: boolean;
  expandIntermediateSteps?: boolean;
  intermediateStepOverride?: boolean;
  autoScroll?: boolean;
  jiraToken?: string;
  jiraUsername?: string;
  additionalConfig: any;
}

export const initialState: HomeInitialState = {
  loading: false,
  lightMode: 'light',
  messageIsStreaming: false,
  folders: [],
  conversations: [],
  selectedConversation: undefined,
  currentMessage: undefined,
  showChatbar: true,
  currentFolder: undefined,
  messageError: false,
  searchTerm: '',
  chatHistory: process?.env?.NEXT_PUBLIC_CHAT_HISTORY_DEFAULT_ON === 'true' || false,
  // Default to staging chat completion URL if no env override is provided
  chatCompletionURL:
    process?.env?.NEXT_PUBLIC_HTTP_CHAT_COMPLETION_URL ||
    'https://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/chat/stream',
  webSocketMode: process?.env?.NEXT_PUBLIC_WEB_SOCKET_DEFAULT_ON === 'true' || false,
  webSocketConnected: false,
      webSocketURL: process?.env?.NEXT_PUBLIC_WS_CHAT_COMPLETION_URL || 'wss://tpmjira-tpm-jira-aiq.stg.astra.nvidia.com/websocket',
  webSocketSchema: 'chat_stream',
  webSocketSchemas: ['chat_stream', 'chat', 'generate_stream', 'generate'],
  enableIntermediateSteps: env('NEXT_PUBLIC_ENABLE_INTERMEDIATE_STEPS') === 'true' || process?.env?.NEXT_PUBLIC_ENABLE_INTERMEDIATE_STEPS === 'true' ? true : false,
  expandIntermediateSteps: false,
  intermediateStepOverride: true,
  autoScroll: true,
  jiraToken: process?.env?.NEXT_PUBLIC_JIRA_TOKEN || '',
  jiraUsername: process?.env?.NEXT_PUBLIC_JIRA_USERNAME || '',
  additionalConfig: {},
};
