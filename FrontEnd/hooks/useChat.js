//src/hooks/useChat.js

import {useContext} from 'react';
import {ChatContext} from '../contexts/ChatContextCore';

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
