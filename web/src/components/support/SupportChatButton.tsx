'use client';

import { MessageCircle, X } from 'lucide-react';
import { useSupportChat } from './useSupportChat';

export default function SupportChatButton() {
  const { isOpen, toggleChat, unreadCount } = useSupportChat();

  return (
    <button
      onClick={toggleChat}
      className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#00E5A0] text-[#0A0F1C] shadow-lg hover:brightness-110 flex items-center justify-center transition-all duration-200 active:scale-95 ${
        unreadCount > 0 && !isOpen ? 'animate-pulse' : ''
      }`}
      aria-label={isOpen ? 'Close support chat' : 'Open support chat'}
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <MessageCircle className="w-6 h-6" />
      )}

      {/* Unread badge */}
      {unreadCount > 0 && !isOpen && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
