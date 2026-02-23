'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface TemplateDetailModalProps {
  templateId: string;
  onClose: () => void;
  onUseTemplate: (id: string) => void;
  onCustomize: (id: string) => void;
}

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  difficulty: string;
  templateOrientation: string | null;
  libraryTags: string[];
  isFeatured: boolean;
  useCount: number;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export default function TemplateDetailModal({
  templateId,
  onClose,
  onUseTemplate,
  onCustomize,
}: TemplateDetailModalProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState<TemplateData[]>([]);

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const [detail, preview] = await Promise.all([
        apiClient.getTemplateDetail(templateId),
        apiClient.getTemplatePreview(templateId).catch(() => ({ html: '' })),
      ]);
      setTemplate(detail as unknown as TemplateData);
      setPreviewHtml(preview.html || null);

      // Load similar templates (same category)
      if (detail.category) {
        const results = await apiClient.searchTemplates({ category: detail.category, limit: 5 });
        const items = (results as any).data || results || [];
        setSimilar(items.filter((t: any) => t.id !== templateId).slice(0, 4));
      }
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyConfig = (d: string) => {
    if (d === 'beginner') return { label: 'Beginner', dot: 'bg-green-400', bg: 'bg-green-400/10 text-green-400' };
    if (d === 'intermediate') return { label: 'Intermediate', dot: 'bg-yellow-400', bg: 'bg-yellow-400/10 text-yellow-400' };
    if (d === 'advanced') return { label: 'Advanced', dot: 'bg-red-400', bg: 'bg-red-400/10 text-red-400' };
    return { label: d, dot: 'bg-gray-400', bg: 'bg-gray-400/10 text-gray-400' };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] w-full max-w-4xl mx-4 shadow-2xl animate-[fadeIn_0.2s_ease-out]">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-8 h-8 border-2 border-[#00E5A0]/20 border-t-[#00E5A0] rounded-full animate-spin" />
          </div>
        ) : template ? (
          <>
            {/* Preview area */}
            <div className="relative h-80 sm:h-96 bg-gradient-to-br from-[#0A2A33] to-[#061A21] rounded-t-2xl overflow-hidden">
              {previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-scripts"
                  title={`Preview: ${template.name}`}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--foreground-tertiary)] opacity-30">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 15l4-4a3 5 0 0 1 3 0l5 5" />
                  </svg>
                </div>
              )}
            </div>

            {/* Template info */}
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-[var(--font-sora)] text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-2">
                    {template.name}
                  </h2>
                  <p className="text-[var(--foreground-secondary)] text-sm max-w-xl">
                    {template.description || 'A professionally designed template ready to customize for your displays.'}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      onClose();
                      router.push(`/dashboard/templates/${template.id}/edit`);
                    }}
                    className="px-5 py-2.5 rounded-lg bg-[#00E5A0] text-[#061A21] font-semibold text-sm hover:bg-[#00CC8E] transition-all hover:shadow-[0_0_20px_rgba(0,229,160,0.3)]"
                  >
                    Edit Visually
                  </button>
                  <button
                    onClick={() => onUseTemplate(template.id)}
                    className="px-5 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] font-medium text-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all"
                  >
                    Use This Template
                  </button>
                  <button
                    onClick={() => onCustomize(template.id)}
                    className="px-5 py-2.5 rounded-lg border border-[var(--border)] text-[var(--foreground-secondary)] font-medium text-sm hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-all"
                  >
                    Customize
                  </button>
                </div>
              </div>

              {/* Metadata badges */}
              <div className="flex flex-wrap gap-2 mb-6">
                {template.category && (
                  <span className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-secondary)] capitalize">
                    {template.category}
                  </span>
                )}
                {template.difficulty && (
                  <span className={`px-3 py-1 text-xs font-medium rounded-lg ${getDifficultyConfig(template.difficulty).bg}`}>
                    {getDifficultyConfig(template.difficulty).label}
                  </span>
                )}
                {template.templateOrientation && (
                  <span className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-secondary)] capitalize">
                    {template.templateOrientation}
                  </span>
                )}
                {(template.useCount || 0) > 0 && (
                  <span className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--surface-hover)] text-[var(--foreground-tertiary)]">
                    Used {template.useCount} times
                  </span>
                )}
              </div>

              {/* Tags */}
              {template.libraryTags && template.libraryTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {template.libraryTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-[var(--background)] text-[var(--foreground-tertiary)] border border-[var(--border)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Similar templates */}
              {similar.length > 0 && (
                <div className="border-t border-[var(--border)] pt-6">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">Similar Templates</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {similar.map((t: any) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          // Re-open modal with new template
                          onClose();
                          setTimeout(() => {
                            const event = new CustomEvent('openTemplateDetail', { detail: t.id });
                            window.dispatchEvent(event);
                          }, 100);
                        }}
                        className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden hover:border-[#00E5A0]/20 transition-all group/similar"
                      >
                        <div className="h-20 bg-gradient-to-br from-[#0A2A33] to-[#061A21] flex items-center justify-center">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[var(--foreground-tertiary)] opacity-30">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-medium text-[var(--foreground)] truncate group-hover/similar:text-[#00E5A0] transition-colors">
                            {t.name}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-32">
            <p className="text-[var(--foreground-secondary)]">Template not found</p>
          </div>
        )}
      </div>
    </div>
  );
}
