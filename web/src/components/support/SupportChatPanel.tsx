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

/*
 * ONE STATUS VOCABULARY across the product, which this did not have. The
 * customer-facing panel painted `open` amber and `in_progress` blue, while the
 * admin list (`SupportRequestCard`) painted `open` blue and `in_progress` amber -
 * so a request looked like a different state depending on who was looking at it.
 * The summary row above the admin list disagreed with both. All three now use
 * the documented `--status-*-bg` pairs, measured ink-on-fill in globals.css:
 * pairing 4.51:1, error 5.41:1, online 5.47:1, neutral 6.46:1 with the
 * secondary ink this panel already carried.
 */
function statusColor(status: string): string {
  switch (status) {
    case 'open':
      return 'bg-[var(--status-pairing-bg)] text-[var(--info-ink)]';
    case 'in_progress':
      return 'bg-[var(--status-error-bg)] text-[var(--warning-ink)]';
    case 'resolved':
      return 'bg-[var(--status-online-bg)] text-[var(--success-ink)]';
    case 'closed':
      return 'bg-[var(--status-neutral-bg)] text-[var(--foreground-secondary)]';
    default:
      return 'bg-[var(--status-neutral-bg)] text-[var(--foreground-secondary)]';
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
    retryFailedMessage,
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
      className={`fixed bottom-24 right-6 z-40 w-[380px] max-sm:w-[calc(100vw-48px)] max-h-[520px] max-sm:max-h-[70vh] bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Green accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--primary)] to-[var(--accent-brass)] flex-shrink-0" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          {!showConversationList && (
            <button
              onClick={startNewConversation}
              className="p-1 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors rounded"
              aria-label="Back to conversations"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Vizora Assistant</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              startComposing();
            }}
            className="p-1.5 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded transition-colors"
            aria-label="New conversation"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleChat}
            className="p-1.5 text-[var(--foreground-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-hover)] rounded transition-colors"
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
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[var(--primary-ink)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--foreground-secondary)] mb-1">No conversations yet</p>
              <p className="text-xs text-[var(--foreground-tertiary)]">Start a new chat to get help or report an issue.</p>
            </div>
          ) : (
            <div className="py-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className="w-full text-left px-4 py-3 hover:bg-[var(--surface-hover)] transition-colors border-b border-[var(--border)] last:border-b-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-[var(--foreground)] truncate flex-1">
                      {conv.title || 'Untitled conversation'}
                    </p>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${statusColor(conv.status)}`}>
                      {conv.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--foreground-tertiary)] mt-1">{formatDate(conv.createdAt)}</p>
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
                <p className="text-sm text-[var(--foreground-secondary)] mb-1">How can we help?</p>
                <p className="text-xs text-[var(--foreground-tertiary)]">Type a message or pick a quick action below.</p>
              </div>
            )}
            {messages.map((msg) => (
              <SupportMessageBubble
                key={msg.id}
                role={msg.role}
                content={msg.content}
                createdAt={msg.createdAt}
                deliveryStatus={msg.deliveryStatus}
                errorMessage={msg.errorMessage}
                onRetry={msg.deliveryStatus === 'failed' ? () => { void retryFailedMessage(msg.id); } : undefined}
              />
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-[var(--background-secondary)] rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 text-[var(--foreground-secondary)] animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions — only at start of new conversation (no messages yet) */}
          {messages.length === 0 && !activeRequestId && <SupportQuickActions />}

          {/* Input area */}
          <div className="flex items-end gap-2 px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 bg-[var(--background-secondary)] text-sm text-[var(--foreground)] placeholder-[var(--foreground-tertiary)] px-3 py-2 rounded-xl resize-none outline-none focus:ring-1 focus:ring-brand/50 transition-all max-sm:py-3"
              style={{ maxHeight: '72px' }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="flex-shrink-0 w-9 h-9 max-sm:w-10 max-sm:h-10 flex items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--lw-on-forest)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
