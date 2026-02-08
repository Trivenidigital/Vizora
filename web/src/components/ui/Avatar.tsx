'use client';

import React from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  status?: 'online' | 'offline' | 'idle' | 'busy';
  className?: string;
}

const sizeMap: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const statusColor: Record<string, string> = {
  online: 'bg-success-500',
  offline: 'bg-[var(--foreground-tertiary)]',
  idle: 'bg-warning-500',
  busy: 'bg-error-500',
};

const statusSize: Record<AvatarSize, string> = {
  xs: 'w-2 h-2',
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
  xl: 'w-5 h-5',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  initials,
  size = 'md',
  status,
  className,
}) => {
  return (
    <div className={`relative inline-block ${className || ''}`}>
      <div
        className={`${sizeMap[size]} rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold overflow-hidden`}
      >
        {src ? (
          <img src={src} alt={alt} className="w-full h-full object-cover" />
        ) : initials ? (
          <span>{initials}</span>
        ) : (
          <span>?</span>
        )}
      </div>

      {status && (
        <div
          className={`absolute bottom-0 right-0 ${statusSize[size]} rounded-full border-2 border-[var(--surface)] ${statusColor[status]}`}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
};
