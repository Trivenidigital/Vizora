'use client';

import type { SupportRequest, SupportCategory, SupportPriority, SupportStatus } from '@/lib/types';
import { Eye } from 'lucide-react';

interface SupportRequestCardProps {
  request: SupportRequest;
  onSelect: (request: SupportRequest) => void;
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

/*
 * ONE PRIORITY VOCABULARY, four steps, used here as a solid dot and in
 * `SupportRequestDetail` as the matching tint + ink. Ordered red -> amber ->
 * grey -> green, which is monotonic in alarm and keeps `medium` distinct from
 * `high` - mapping both onto the warning family would have made two of the four
 * levels render identically.
 *
 * Computed on `--surface`, the card fill, and separated on the repo's ~40 sRGB
 * floor: error 4.67:1, warning 3.08:1, foreground-tertiary 5.89:1,
 * success 3.18:1; closest pair critical/high at 87.1. The 3:1 bar applies
 * because these are 10px dots, not text.
 *
 * KNOWN GAP, not introduced here and not fixed here: the dot is the ONLY
 * priority signal on this card - there is no label and no `title`, so priority
 * is encoded in colour alone (WCAG 1.4.1). Adding a `title`/`aria-label` is a
 * one-attribute fix but it is a copy decision, so it is reported rather than
 * taken.
 */
const priorityDotColors: Record<SupportPriority, string> = {
  critical: 'bg-[var(--error)]',
  high: 'bg-[var(--warning)]',
  medium: 'bg-[var(--foreground-tertiary)]',
  low: 'bg-[var(--success)]',
};

/*
 * CATEGORY IS AN IDENTITY LABEL, so it takes the `--cat-*` set rather than the
 * status families - a category asserts what the request is ABOUT, not how bad
 * it is, and painting `feedback` with `--success` claimed a state it does not
 * have. `help_question` was already converted to `--cat-purple`; this finishes
 * the set it started.
 *
 * Each ink on its own tint, from globals.css: red 4.83:1, blue 5.69:1,
 * purple 5.23:1, teal 4.70:1, green 4.79:1, orange 4.76:1. Separability over
 * this six-hue consuming map: closest pair red/orange at 40.1, the same number
 * globals.css already accepts for the widget-type map. No `--cat-cyan` exists,
 * so `template_request` takes teal, the ivory-safe neighbour.
 *
 * PRE-EXISTING COLLISION, preserved rather than silently changed:
 * `bug_report` and `urgent_issue` render identically today (both red) and still
 * do. Telling them apart means deciding whether `urgent_issue` is an identity
 * or a severity, which is a product call, so it is reported not taken.
 */
const categoryBadgeColors: Record<SupportCategory, { bg: string; text: string }> = {
  bug_report: { bg: 'bg-[var(--cat-red-bg)]', text: 'text-[var(--cat-red)]' },
  feature_request: { bg: 'bg-[var(--cat-blue-bg)]', text: 'text-[var(--cat-blue)]' },
  help_question: { bg: 'bg-[var(--cat-purple-bg)]', text: 'text-[var(--cat-purple)]' },
  template_request: { bg: 'bg-[var(--cat-teal-bg)]', text: 'text-[var(--cat-teal)]' },
  feedback: { bg: 'bg-[var(--cat-green-bg)]', text: 'text-[var(--cat-green)]' },
  urgent_issue: { bg: 'bg-[var(--cat-red-bg)]', text: 'text-[var(--cat-red)]' },
  account_issue: { bg: 'bg-[var(--cat-orange-bg)]', text: 'text-[var(--cat-orange)]' },
};

const categoryLabels: Record<SupportCategory, string> = {
  bug_report: 'Bug Report',
  feature_request: 'Feature Request',
  help_question: 'Help Question',
  template_request: 'Template Request',
  feedback: 'Feedback',
  urgent_issue: 'Urgent Issue',
  account_issue: 'Account Issue',
};

/*
 * STATUS, so the badge fills are the documented `--status-*-bg` pairs - five
 * states, five distinct tints, each ink measured on its own fill in
 * globals.css: pairing 4.51:1, error 5.41:1, online 5.47:1, neutral 4.75:1,
 * offline 4.89:1. The inks were already tokens; only the raw `-500/20` tints
 * moved.
 */
const statusBadgeColors: Record<SupportStatus, string> = {
  open: 'bg-[var(--status-pairing-bg)] text-[var(--info-ink)]',
  in_progress: 'bg-[var(--status-error-bg)] text-[var(--warning-ink)]',
  resolved: 'bg-[var(--status-online-bg)] text-[var(--success-ink)]',
  closed: 'bg-[var(--status-neutral-bg)] text-[var(--foreground-tertiary)]',
  wont_fix: 'bg-[var(--status-offline-bg)] text-[var(--error-ink)]',
};

const statusLabels: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  wont_fix: "Won't Fix",
};

export function SupportRequestCard({ request, onSelect }: SupportRequestCardProps) {
  const displayTitle = request.title || (request.description?.slice(0, 80) + (request.description?.length > 80 ? '...' : ''));
  const catColors = categoryBadgeColors[request.category] || { bg: 'bg-[var(--status-neutral-bg)]', text: 'text-[var(--foreground-tertiary)]' };
  const userName = request.user
    ? `${request.user.firstName} ${request.user.lastName}`
    : 'Unknown User';

  return (
    <div
      onClick={() => onSelect(request)}
      className="bg-[var(--surface)] rounded-lg p-4 border border-[var(--border)] hover:border-brand/30 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${priorityDotColors[request.priority]}`} />
            <h3 className="text-[var(--foreground)] font-medium truncate">{displayTitle}</h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${catColors.bg} ${catColors.text}`}>
              {categoryLabels[request.category] || request.category}
            </span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeColors[request.status]}`}>
              {statusLabels[request.status] || request.status}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--foreground-tertiary)]">
            <span>{userName}</span>
            <span className="text-[var(--border)]">|</span>
            <span>{timeAgo(request.createdAt)}</span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(request);
          }}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--foreground-secondary)] hover:text-[var(--foreground)] bg-[var(--background-secondary)] rounded-lg hover:bg-[var(--background-tertiary)] transition flex-shrink-0"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      </div>
    </div>
  );
}
