'use client';

import { useSupportChat } from './useSupportChat';
import SupportChatButton from './SupportChatButton';
import SupportChatPanel from './SupportChatPanel';

export function SupportChat() {
  const { isOpen } = useSupportChat();

  return (
    <>
      <SupportChatButton />
      {isOpen && <SupportChatPanel />}
    </>
  );
}
