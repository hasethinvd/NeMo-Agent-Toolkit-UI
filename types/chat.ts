export interface Message {
  id?: string;
  role: Role;
  content: string;
  intermediateSteps?: any;
  humanInteractionMessages?: any;
  errorMessages?: any;
}

export type Role = 'assistant' | 'user' | 'agent' | 'system';

export interface ChatBody {
  chatCompletionURL?: string,
  messages?: Message[],
  jiraCredentials?: { username: string; token: string } | { encrypted: string },
  additionalProps?: any
}

export interface Conversation {
  id: string;
  name: string;
  messages: Message[];
  folderId: string | null;
}
