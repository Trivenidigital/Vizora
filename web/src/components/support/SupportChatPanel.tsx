'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { useSupportChat } from './useSupportChat';
import SupportMessageBubble from './SupportMessage';
import SupportQuickActions from './SupportQuickActions';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDay = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDay === 0) return 'Today';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function statusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-400';
    case 'resolved':
      return 'bg-green-500/20 text-green-400';
    case 'closed':
      return 'bg-gray-500/20 text-gray-400';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

export default function SupportChatPanel() {
  const {
    messages,
    activeRequestId,
    isLoading,
    isComposing,
    conversations,
    inputText,
    setInputText,
    toggleChat,
    sendMessage,
    startNewConversation,
    startComposing,
    selectConversation,
  } = useSupportChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Animate in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus textarea when opening a conversation
  useEffect(() => {
    if (activeRequestId !== null || messages.length === 0) {
      textareaRef.current?.focus();
    }
  }, [activeRequestId, messages.length]);

  // Auto-grow textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Reset height to auto to recalculate
    e.target.style.height = 'auto';
    // Clamp to 3 lines max (~72px)
    e.target.style.height = Math.min(e.target.scrollHeight, 72) + 'px';
  }, [setInputText]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    await sendMessage(text);
  }, [inputText, isLoading, setInputText, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Show conversation list or active chat
  const showConversationList = activeRequestId === null && messages.length === 0 && !isComposing;

  return (
    <div
      className={`fixed bottom-24 right-6 z-40 w-[380px] max-sm:w-[calc(100vw-48px)] max-h-[520px] max-sm:max-h-[70vh] bg-[#111827] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Green accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[#00E5A0] to-[#00B4D8] flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          {!showConversationList && (
            <button
              onClick={startNewConversation}
              className="p-1 text-gray-400 hover:text-white transition-colors rounded"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="text-sm font-semibold text-white">Vizora Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              startComposing();
            }}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            aria-label="New conversation"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleChat}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showConversationList ? (
        /* Conversation list view */
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#00E5A0]/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#00E5A0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 mb-1">No conversations yet</p>
              <p className="text-xs text-gray-500">Start a new chat to get help or report an issue.</p>
            </div>
          ) : (
            <div className="py-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-200 truncate flex-1">
                      {conv.title || 'Untitled conversation'}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${statusColor(conv.status)}`}>
                      {conv.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatDate(conv.createdAt)}</p>
                </button>
              ))}
            </div>
          )}

          {/* Quick actions when no active conversation */}
          <SupportQuickActions />
        </div>
      ) : (
        /* Active chat view */
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm text-gray-400 mb-1">How can we help?</p>
                <p className="text-xs text-gray-500">Type a message or pick a quick action below.</p>
              </div>
            )}
            {messages.map((msg) => (
              <SupportMessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-[#1F2937] rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions — only at start of new conversation (no messages yet) */}
          {messages.length === 0 && !activeRequestId && <SupportQuickActions />}

          {/* Input area */}
          <div className="flex items-end gap-2 px-4 py-3 border-t border-white/10 flex-shrink-0">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-[#1F2937] text-sm text-gray-200 placeholder-gray-500 px-3 py-2 rounded-xl resize-none outline-none focus:ring-1 focus:ring-[#00E5A0]/50 transition-all max-sm:py-3"
              style={{ maxHeight: '72px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="flex-shrink-0 w-9 h-9 max-sm:w-10 max-sm:h-10 flex items-center justify-center rounded-xl bg-[#00E5A0] text-[#0A0F1C] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
