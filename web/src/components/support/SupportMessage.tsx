'use client';

interface SupportMessageProps {
  role: 'user' | 'assistant' | 'admin';
  content: string;
  createdAt: string;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Simple markdown-like renderer for chat messages.
 * Supports: **bold**, [links](url), and line breaks.
 * No external dependencies.
 */
function renderMessageContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) {
      elements.push(<br key={`br-${lineIdx}`} />);
    }

    // Process inline formatting: **bold** and [text](url)
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partIdx = 0;

    while (remaining.length > 0) {
      // Check for bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Check for link: [text](url)
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      // Find the earliest match
      let earliestIdx = remaining.length;
      let matchType: 'bold' | 'link' | null = null;

      if (boldMatch && boldMatch.index !== undefined && boldMatch.index < earliestIdx) {
        earliestIdx = boldMatch.index;
        matchType = 'bold';
      }
      if (linkMatch && linkMatch.index !== undefined && linkMatch.index < earliestIdx) {
        earliestIdx = linkMatch.index;
        matchType = 'link';
      }

      if (matchType === null) {
        // No more matches — push remaining text
        if (remaining) parts.push(remaining);
        break;
      }

      // Push text before match
      if (earliestIdx > 0) {
        parts.push(remaining.substring(0, earliestIdx));
      }

      if (matchType === 'bold' && boldMatch) {
        parts.push(
          <strong key={`b-${lineIdx}-${partIdx}`} className="font-semibold">
            {boldMatch[1]}
          </strong>
        );
        remaining = remaining.substring(earliestIdx + boldMatch[0].length);
      } else if (matchType === 'link' && linkMatch) {
        parts.push(
          <a
            key={`a-${lineIdx}-${partIdx}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[#00E5A0] hover:text-[#00CC8E]"
          >
            {linkMatch[1]}
          </a>
        );
        remaining = remaining.substring(earliestIdx + linkMatch[0].length);
      }
      partIdx++;
    }

    elements.push(...parts);
  });

  return elements;
}

export default function SupportMessage({ role, content, createdAt }: SupportMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-1'}`}>
        {/* Admin badge */}
        {role === 'admin' && (
          <div className="mb-1">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 uppercase tracking-wide">
              Admin
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-[#00E5A0]/15 text-[#d1fae5] rounded-br-md'
              : 'bg-[#1F2937] text-gray-200 rounded-bl-md'
          }`}
        >
          {renderMessageContent(content)}
        </div>

        {/* Timestamp */}
        <div className={`mt-1 text-xs text-gray-500 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTimeAgo(createdAt)}
        </div>
      </div>
    </div>
  );
}
