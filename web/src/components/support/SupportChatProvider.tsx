'use client';

import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { SupportMessage, SupportRequest, SupportContext } from '@/lib/types';

interface ConversationSummary {
  id: string;
  title: string | null;
  status: string;
  createdAt: string;
}

interface SupportChatState {
  isOpen: boolean;
  messages: SupportMessage[];
  activeRequestId: string | null;
  isLoading: boolean;
  unreadCount: number;
  conversations: ConversationSummary[];
  isComposing: boolean;
}

interface SupportChatContextValue extends SupportChatState {
  toggleChat: () => void;
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => void;
  startComposing: (prefill?: string) => void;
  selectConversation: (id: string) => Promise<void>;
  setInputText: (text: string) => void;
  inputText: string;
}

export const SupportChatContext = createContext<SupportChatContextValue | null>(null);

// Keep last 10 console errors for context capture
const recentErrors: string[] = [];
let consoleErrorIntercepted = false;

function interceptConsoleErrors() {
  if (consoleErrorIntercepted || typeof window === 'undefined') return;
  consoleErrorIntercepted = true;
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    recentErrors.push(message);
    if (recentErrors.length > 10) {
      recentErrors.shift();
    }
    originalError.apply(console, args);
  };
}

function captureContext(): SupportContext {
  return {
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    consoleErrors: JSON.stringify(recentErrors),
  };
}

export function SupportChatProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const loadedRef = useRef(false);

  // Intercept console errors on mount
  useEffect(() => {
    interceptConsoleErrors();
  }, []);

  // Load conversations on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    async function loadConversations() {
      try {
        const response = await apiClient.getSupportRequests({ limit: 20 });
        const summaries: ConversationSummary[] = response.data.map((r: SupportRequest) => ({
          id: r.id,
          title: r.title || r.description.substring(0, 50),
          status: r.status,
          createdAt: r.createdAt,
        }));
        setConversations(summaries);

        // Count unread: requests with admin messages that are still open/in_progress
        const openRequests = response.data.filter(
          (r: SupportRequest) => r.status === 'open' || r.status === 'in_progress'
        );
        let unread = 0;
        for (const req of openRequests) {
          if (req.messages && req.messages.length > 0) {
            const lastMsg = req.messages[req.messages.length - 1];
            if (lastMsg.role === 'admin') {
              unread++;
            }
          }
        }
        setUnreadCount(unread);
      } catch {
        // Silently fail — the user just hasn't used support yet or isn't logged in
      }
    }

    loadConversations();
  }, []);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveRequestId(null);
    setMessages([]);
    setInputText('');
    setIsComposing(false);
  }, []);

  const startComposing = useCallback((prefill?: string) => {
    setActiveRequestId(null);
    setMessages([]);
    setIsComposing(true);
    setInputText(prefill || '');
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const request = await apiClient.getSupportRequest(id);
      setActiveRequestId(id);
      setMessages(request.messages || []);
      // Decrement unread if this was unread
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Failed to load conversation
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    const context = captureContext();
    setIsLoading(true);

    if (activeRequestId) {
      // Add to existing conversation
      const optimisticMsg: SupportMessage = {
        id: `temp-${Date.now()}`,
        requestId: activeRequestId,
        organizationId: '',
        userId: '',
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      try {
        const serverMsg = await apiClient.addSupportMessage(activeRequestId, content.trim());
        // Replace optimistic message with server response
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? serverMsg : m))
        );
      } catch {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      } finally {
        setIsLoading(false);
      }
    } else {
      // Create new conversation
      const optimisticMsg: SupportMessage = {
        id: `temp-${Date.now()}`,
        requestId: '',
        organizationId: '',
        userId: '',
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages([optimisticMsg]);

      try {
        const result = await apiClient.createSupportRequest({
          message: content.trim(),
          context,
        });
        const newRequest = result.request;
        setActiveRequestId(newRequest.id);

        // Build messages from the response
        const newMessages: SupportMessage[] = [
          {
            id: newRequest.id + '-user',
            requestId: newRequest.id,
            organizationId: newRequest.organizationId,
            userId: newRequest.userId,
            role: 'user',
            content: content.trim(),
            createdAt: newRequest.createdAt,
          },
        ];

        // Add the assistant response if available
        if (result.response) {
          newMessages.push({
            id: newRequest.id + '-assistant',
            requestId: newRequest.id,
            organizationId: newRequest.organizationId,
            userId: '',
            role: 'assistant',
            content: result.response,
            createdAt: new Date().toISOString(),
          });
        }

        setMessages(newMessages);

        // Add to conversations list
        setConversations((prev) => [
          {
            id: newRequest.id,
            title: newRequest.title || content.trim().substring(0, 50),
            status: newRequest.status,
            createdAt: newRequest.createdAt,
          },
          ...prev,
        ]);
      } catch {
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeRequestId]);

  const value: SupportChatContextValue = {
    isOpen,
    messages,
    activeRequestId,
    isLoading,
    unreadCount,
    conversations,
    isComposing,
    inputText,
    toggleChat,
    sendMessage,
    startNewConversation,
    startComposing,
    selectConversation,
    setInputText,
  };

  return (
    <SupportChatContext.Provider value={value}>
      {children}
    </SupportChatContext.Provider>
  );
}
