'use client';

import { useState } from 'react';
import type { SupportRequest, SupportMessage, SupportStatus, SupportPriority } from '@/lib/types';
import Modal from '@/components/Modal';
import { Send, ChevronDown, ChevronUp, Sparkles, Globe, Monitor, AlertTriangle } from 'lucide-react';

interface SupportRequestDetailProps {
  request: SupportRequest;
  isOpen: boolean;
  onClose: () => void;
  onReply: (requestId: string, content: string) => Promise<void>;
  onUpdate: (requestId: string, data: { status?: string; priority?: string; resolutionNotes?: string }) => Promise<void>;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

const priorityColors: Record<SupportPriority, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-orange-500/20 text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

const statusColors: Record<SupportStatus, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-yellow-500/20 text-yellow-400',
  resolved: 'bg-green-500/20 text-green-400',
  closed: 'bg-gray-500/20 text-gray-400',
  wont_fix: 'bg-red-500/20 text-red-400',
};

const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  wont_fix: "Won't Fix",
};

const categoryLabels: Record<string, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  help_question: 'Help Question',
  template_request: 'Template Request',
  feedback: 'Feedback',
  urgent_issue: 'Urgent Issue',
  account_issue: 'Account Issue',
};

export function SupportRequestDetail({
  request,
  isOpen,
  onClose,
  onReply,
  onUpdate,
}: SupportRequestDetailProps) {
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [status, setStatus] = useState<string>(request.status);
  const [priority, setPriority] = useState<string>(request.priority);
  const [resolutionNotes, setResolutionNotes] = useState(request.resolutionNotes || '');
  const [saving, setSaving] = useState(false);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setReplying(true);
    try {
      await onReply(request.id, replyContent.trim());
      setReplyContent('');
    } finally {
      setReplying(false);
    }
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const data: { status?: string; priority?: string; resolutionNotes?: string } = {};
      if (status !== request.status) data.status = status;
      if (priority !== request.priority) data.priority = priority;
      if (resolutionNotes !== (request.resolutionNotes || '')) data.resolutionNotes = resolutionNotes;
      if (Object.keys(data).length > 0) {
        await onUpdate(request.id, data);
      }
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    status !== request.status ||
    priority !== request.priority ||
    resolutionNotes !== (request.resolutionNotes || '');

  const hasContext = request.pageUrl || request.browserInfo || request.consoleErrors;
  const messages = request.messages || [];

  const displayTitle = request.title || 'Support Request';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayTitle} size="xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${priorityColors[request.priority]}`}>
            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)} Priority
          </span>
          <span className={`px-2.5 py-1 rounded text-xs font-medium ${statusColors[request.status]}`}>
            {statusLabels[request.status]}
          </span>
          <span className="px-2.5 py-1 rounded text-xs font-medium bg-[#1F2937] text-[var(--foreground-secondary)]">
            {categoryLabels[request.category] || request.category}
          </span>
          <span className="text-xs text-[var(--foreground-tertiary)] ml-auto">
            {timeAgo(request.createdAt)}
          </span>
        </div>

        {/* Description */}
        <div className="text-sm text-[var(--foreground-secondary)] whitespace-pre-wrap">
          {request.description}
        </div>

        {/* AI Summary */}
        {(request.aiSummary || request.aiSuggestedAction) && (
          <div className="bg-[#1a1a2e] border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-400">AI Analysis</span>
            </div>
            {request.aiSummary && (
              <p className="text-sm text-[var(--foreground-secondary)] mb-2">{request.aiSummary}</p>
            )}
            {request.aiSuggestedAction && (
              <div className="mt-2 pt-2 border-t border-purple-500/20">
                <span className="text-xs text-purple-300 font-medium">Suggested Action: </span>
                <span className="text-sm text-[var(--foreground-secondary)]">{request.aiSuggestedAction}</span>
              </div>
            )}
          </div>
        )}

        {/* Context (collapsible) */}
        {hasContext && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setShowContext(!showContext)}
              className="w-full flex items-center justify-between p-3 text-sm text-[var(--foreground-secondary)] hover:bg-[#1F2937] transition"
            >
              <span className="font-medium">Context Details</span>
              {showContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showContext && (
              <div className="p-3 pt-0 space-y-3 text-sm">
                {request.pageUrl && (
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-[var(--foreground-tertiary)] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[var(--foreground-tertiary)] text-xs">Page URL</span>
                      <p className="text-[var(--foreground-secondary)] break-all">{request.pageUrl}</p>
                    </div>
                  </div>
                )}
                {request.browserInfo && (
                  <div className="flex items-start gap-2">
                    <Monitor className="w-4 h-4 text-[var(--foreground-tertiary)] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-[var(--foreground-tertiary)] text-xs">Browser Info</span>
                      <p className="text-[var(--foreground-secondary)]">{request.browserInfo}</p>
                    </div>
                  </div>
                )}
                {request.consoleErrors && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[var(--foreground-tertiary)] text-xs">Console Errors</span>
                      <pre className="mt-1 p-2 bg-[#0A0F1C] rounded text-xs text-red-300 overflow-x-auto whitespace-pre-wrap">
                        {request.consoleErrors}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conversation thread */}
        {messages.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--foreground)]">Conversation</h4>
            <div className="space-y-2">
              {messages.map((msg: SupportMessage) => {
                const isUser = msg.role === 'user';
                const isAdmin = msg.role === 'admin';
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 text-sm ${
                        isUser
                          ? 'bg-[#00E5A0]/20 text-[#00E5A0]'
                          : isAdmin
                          ? 'bg-[#1F2937] text-[var(--foreground-secondary)] border border-purple-500/30'
                          : 'bg-[#1F2937] text-[var(--foreground-secondary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium opacity-70">
                          {isUser ? 'User' : isAdmin ? 'Admin' : 'Assistant'}
                        </span>
                        {isAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400">
                            ADMIN
                          </span>
                        )}
                        <span className="text-xs opacity-50">{timeAgo(msg.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Admin reply section */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[var(--foreground)]">Reply as Admin</h4>
          <div className="flex gap-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Type your reply..."
              rows={3}
              className="flex-1 bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50 placeholder-[var(--foreground-tertiary)] resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleReply}
              disabled={!replyContent.trim() || replying}
              className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Send className="w-4 h-4" />
              {replying ? 'Sending...' : 'Send Reply'}
            </button>
          </div>
        </div>

        {/* Actions bar */}
        <div className="border-t border-[var(--border)] pt-4 space-y-4">
          <h4 className="text-sm font-medium text-[var(--foreground)]">Update Request</h4>
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <label className="text-xs text-[var(--foreground-tertiary)]">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="wont_fix">Won&apos;t Fix</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[var(--foreground-tertiary)]">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {(status === 'resolved' || status === 'closed' || status === 'wont_fix') && (
            <div className="space-y-1">
              <label className="text-xs text-[var(--foreground-tertiary)]">Resolution Notes</label>
              <textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Describe the resolution..."
                rows={2}
                className="w-full bg-[#1F2937] border border-[var(--border)] rounded-lg text-white text-sm p-3 focus:outline-none focus:ring-2 focus:ring-[#00E5A0]/50 placeholder-[var(--foreground-tertiary)] resize-none"
              />
            </div>
          )}

          {hasChanges && (
            <div className="flex justify-end">
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
