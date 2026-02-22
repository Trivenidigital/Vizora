'use client';

import { useState } from 'react';

interface TemplateCardProps {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  difficulty?: string;
  orientation?: string;
  thumbnailUrl?: string | null;
  previewImageUrl?: string | null;
  templateHtml?: string | null;
  renderedHtml?: string | null;
  isFeatured?: boolean;
  useCount?: number;
  tags?: string[];
  onClick: (id: string) => void;
  onUseTemplate?: (id: string) => void;
  isAdmin?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  variant?: 'grid' | 'featured';
}

const CATEGORY_COLORS: Record<string, string> = {
  retail: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  restaurant: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  corporate: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  education: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  healthcare: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  events: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  general: 'bg-[var(--surface-hover)] text-[var(--foreground-secondary)] border-[var(--border)]',
};

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  beginner: { label: 'Beginner', color: 'text-green-400', dot: 'bg-green-400' },
  intermediate: { label: 'Intermediate', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  advanced: { label: 'Advanced', color: 'text-red-400', dot: 'bg-red-400' },
};

export default function TemplateCard({
  id,
  name,
  description,
  category,
  difficulty,
  orientation,
  thumbnailUrl,
  previewImageUrl,
  templateHtml,
  renderedHtml,
  isFeatured,
  useCount,
  tags,
  onClick,
  onUseTemplate,
  isAdmin,
  onEdit,
  onDelete,
  variant = 'grid',
}: TemplateCardProps) {
  const [imgError, setImgError] = useState(false);
  const thumb = thumbnailUrl || previewImageUrl;
  const catColor = CATEGORY_COLORS[category || 'general'] || CATEGORY_COLORS.general;
  const diffConfig = DIFFICULTY_CONFIG[difficulty || ''];

  const isFeaturedVariant = variant === 'featured';

  return (
    <div
      onClick={() => onClick(id)}
      className={`group relative bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-[#00E5A0]/20 ${
        isFeaturedVariant ? 'flex-shrink-0 w-72' : ''
      }`}
    >
      {/* Thumbnail area */}
      <div className={`relative overflow-hidden ${isFeaturedVariant ? 'h-40' : 'h-44'}`}>
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A2A33] to-[#061A21]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 40%, rgba(0,229,160,0.15), transparent 60%),
                             radial-gradient(circle at 70% 60%, rgba(0,180,216,0.1), transparent 50%)`,
          }}
        />

        {/* Thumbnail image or HTML preview */}
        {thumb && !imgError ? (
          <img
            src={thumb}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (renderedHtml || templateHtml) ? (
          <div className="absolute inset-0 overflow-hidden">
            <iframe
              srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;overflow:hidden;background:#fff;}</style></head><body>${renderedHtml || templateHtml}</body></html>`}
              sandbox=""
              tabIndex={-1}
              className="w-[1920px] h-[1080px] origin-top-left pointer-events-none border-0"
              style={{ transform: 'scale(0.16)', transformOrigin: 'top left' }}
              title={`${name} preview`}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--foreground-tertiary)] opacity-30">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 15l4-4a3 5 0 0 1 3 0l5 5" />
              <path d="M14 14l1-1a3 5 0 0 1 3 0l3 3" />
            </svg>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseTemplate?.(id);
            }}
            className="opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 px-5 py-2 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] shadow-lg"
          >
            Use Template
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {isFeatured && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-[#00E5A0] text-[#061A21] rounded-md">
              Featured
            </span>
          )}
          {orientation && orientation !== 'both' && (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-black/50 backdrop-blur-sm text-white/80 rounded-md capitalize">
              {orientation}
            </span>
          )}
        </div>

        {/* Admin actions */}
        {isAdmin && (onEdit || onDelete) && (
          <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(id); }}
                className="p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white/80 hover:bg-black/70 hover:text-[#00E5A0] transition-all"
                title="Edit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(id); }}
                className="p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white/80 hover:bg-red-600/80 hover:text-white transition-all"
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-[var(--foreground)] text-sm mb-1 truncate group-hover:text-[#00E5A0] transition-colors duration-300">
          {name}
        </h3>
        <p className="text-xs text-[var(--foreground-tertiary)] mb-3 line-clamp-2 min-h-[2rem]">
          {description || 'A professionally designed template ready to customize'}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {category && (
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border capitalize ${catColor}`}>
              {category}
            </span>
          )}
          {diffConfig && (
            <span className="flex items-center gap-1 text-[10px]">
              <span className={`w-1.5 h-1.5 rounded-full ${diffConfig.dot}`} />
              <span className={diffConfig.color}>{diffConfig.label}</span>
            </span>
          )}
          {(useCount || 0) > 0 && (
            <span className="ml-auto text-[10px] text-[var(--foreground-tertiary)] flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              {useCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
