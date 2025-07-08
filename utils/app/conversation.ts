import { Conversation, Role } from '@/types/chat';
import toast from 'react-hot-toast';

export const updateConversation = (
  updatedConversation: Conversation,
  allConversations: Conversation[],
) => {
  const updatedConversations = allConversations.map((c) => {
    if (c.id === updatedConversation.id) {
      return updatedConversation;
    }

    return c;
  });

  saveConversation(updatedConversation);
  saveConversations(updatedConversations);

  return {
    single: updatedConversation,
    all: updatedConversations,
  };
};

export const saveConversation = (conversation: Conversation) => {
  try {
    sessionStorage.setItem('selectedConversation', JSON.stringify(conversation));
  } catch (error) {
    // Silently handle storage errors without showing popups
    console.log('Storage error, cannot save conversation:', error);
  }
};

export const saveConversations = (conversations: Conversation[]) => {
  try {
    sessionStorage.setItem('conversationHistory', JSON.stringify(conversations));
  } catch (error) {
    // Silently handle storage errors without showing popups
    console.log('Storage error, cannot save conversations:', error);
  }
};

