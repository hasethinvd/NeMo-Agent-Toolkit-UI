export interface Attachment {
  id?: string;
  type: string;
  content: string; // base64 encoded for images
  name?: string;
}

export interface MessageContent {
  text: string;
  attachments?: Attachment[];
}

export interface Message {
  id?: string;
  role: Role;
  content: string | MessageContent;
  intermediateSteps?: any;
  humanInteractionMessages?: any;
  errorMessages?: any;
  parentId?: string;
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
