'use client';

import { ReactNode, useState } from 'react';

export default function Tooltip({
  children,
  content,
  position = 'top',
}: {
  children: ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [show, setShow] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {show && (
        <div
          className={`absolute z-50 px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--surface-secondary)] rounded-lg shadow-lg whitespace-nowrap border border-[var(--border)] ${positionClasses[position]}`}
          role="tooltip"
        >
          {content}
          <div className="absolute w-2 h-2 bg-[var(--surface-secondary)] transform rotate-45" />
        </div>
      )}
    </div>
  );
}

export function HelpIcon({ content, position }: { content: string; position?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip content={content} position={position}>
      <span className="inline-flex items-center justify-center w-4 h-4 text-xs text-[var(--foreground-tertiary)] border border-[var(--foreground-tertiary)] rounded-full hover:text-[#00E5A0] hover:border-[#00E5A0] transition">
        ?
      </span>
    </Tooltip>
  );
}
