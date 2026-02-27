'use client';

import { useContext } from 'react';
import { SupportChatContext } from './SupportChatProvider';

export function useSupportChat() {
  const context = useContext(SupportChatContext);
  if (!context) {
    throw new Error('useSupportChat must be used within a SupportChatProvider');
  }
  return context;
}
