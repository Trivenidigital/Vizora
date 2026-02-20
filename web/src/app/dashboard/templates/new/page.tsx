'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { Icon } from '@/theme/icons';
import LoadingSpinner from '@/components/LoadingSpinner';
import TemplateEditor from '@/components/TemplateEditor';

const CATEGORIES = [
  { value: 'retail', label: 'Retail' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'events', label: 'Events' },
  { value: 'general', label: 'General' },
];

const DIFFICULTIES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const ORIENTATIONS = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'both', label: 'Both' },
];

export default function CreateTemplatePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [difficulty, setDifficulty] = useState('beginner');
  const [orientation, setOrientation] = useState('landscape');
  const [tags, setTags] = useState('');
  const [templateHtml, setTemplateHtml] = useState(
    '<div>\n  <h1>{{title}}</h1>\n  <p>{{description}}</p>\n</div>'
  );
  const [sampleData, setSampleData] = useState<Record<string, unknown>>({
    title: 'Sample Title',
    description: 'Sample description',
  });
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [duration, setDuration] = useState(30);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Auth gate: loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Auth gate: access denied
  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Icon name="shield" size="3xl" className="text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-[var(--foreground)] mb-2">
          Access Denied
        </h2>
        <p className="text-[var(--foreground-secondary)] mb-6">
          You do not have permission to create templates. Admin access is required.
        </p>
        <Link
          href="/dashboard/templates"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-semibold text-sm"
        >
          <Icon name="chevronLeft" size="sm" />
          Back to Templates
        </Link>
      </div>
    );
  }

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const Handlebars = (await import('handlebars')).default;
      const compiled = Handlebars.compile(templateHtml);
      setPreviewHtml(compiled(sampleData));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPreviewHtml(
        `<div style="color: red; padding: 20px;">Preview error: ${message}</div>`
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (!templateHtml.trim()) {
      setError('Template HTML is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await apiClient.createTemplate({
        name: name.trim(),
        description: description.trim() || undefined,
        templateHtml,
        category,
        difficulty,
        orientation,
        tags: parsedTags.length > 0 ? parsedTags : undefined,
        sampleData: sampleData as Record<string, any>,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        duration,
      });

      router.push(`/dashboard/templates/${result.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create template';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/templates"
            className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-hover)] transition text-[var(--foreground-secondary)]"
            aria-label="Back to templates"
          >
            <Icon name="chevronLeft" size="md" />
          </Link>
          <div>
            <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">
              Create Template
            </h2>
            <p className="mt-1 text-sm text-[var(--foreground-secondary)]">
              Add a new template to the global library
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/templates"
            className="px-4 py-2.5 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            Cancel
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <Icon name="error" size="md" className="text-red-500 shrink-0" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 transition"
            aria-label="Dismiss error"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* Main Layout: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Name */}
          <div className="bg-[var(--surface)] rounded-lg shadow p-6 border border-[var(--border)]">
            <label
              htmlFor="template-name"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Template Name <span className="text-red-400">*</span>
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Restaurant Daily Specials"
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] placeholder:text-[var(--foreground-tertiary)]"
            />
          </div>

          {/* Description */}
          <div className="bg-[var(--surface)] rounded-lg shadow p-6 border border-[var(--border)]">
            <label
              htmlFor="template-description"
              className="block text-sm font-medium text-[var(--foreground)] mb-2"
            >
              Description
            </label>
            <textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this template is for and how to use it..."
              rows={3}
              className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] placeholder:text-[var(--foreground-tertiary)] resize-none"
            />
          </div>

          {/* Template Editor */}
          <div className="bg-[var(--surface)] rounded-lg shadow p-6 border border-[var(--border)]">
            <h3 className="text-sm font-medium text-[var(--foreground)] mb-4">
              Template Code &amp; Preview
            </h3>
            <TemplateEditor
              initialHtml={templateHtml}
              sampleData={sampleData}
              onHtmlChange={setTemplateHtml}
              onSampleDataChange={(data) =>
                setSampleData(data as Record<string, unknown>)
              }
              onPreviewRequest={handlePreview}
              previewHtml={previewHtml}
              previewLoading={previewLoading}
            />
          </div>
        </div>

        {/* Right Column (1/3) - Metadata */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--surface)] rounded-lg shadow p-6 border border-[var(--border)] space-y-5 lg:sticky lg:top-24">
            <h3 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wider">
              Metadata
            </h3>

            {/* Category */}
            <div>
              <label
                htmlFor="template-category"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Category
              </label>
              <select
                id="template-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty */}
            <div>
              <label
                htmlFor="template-difficulty"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Difficulty
              </label>
              <select
                id="template-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Orientation */}
            <div>
              <label
                htmlFor="template-orientation"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Orientation
              </label>
              <select
                id="template-orientation"
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm"
              >
                {ORIENTATIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label
                htmlFor="template-tags"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Tags
              </label>
              <input
                id="template-tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., food, menu, daily"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm placeholder:text-[var(--foreground-tertiary)]"
              />
              <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
                Comma-separated
              </p>
            </div>

            {/* Duration */}
            <div>
              <label
                htmlFor="template-duration"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Duration (seconds)
              </label>
              <input
                id="template-duration"
                type="number"
                value={duration}
                onChange={(e) =>
                  setDuration(
                    Math.max(1, Math.min(300, parseInt(e.target.value, 10) || 1))
                  )
                }
                min={1}
                max={300}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm"
              />
              <p className="mt-1 text-xs text-[var(--foreground-tertiary)]">
                1 - 300 seconds
              </p>
            </div>

            {/* Thumbnail URL */}
            <div>
              <label
                htmlFor="template-thumbnail"
                className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1.5"
              >
                Thumbnail URL
              </label>
              <input
                id="template-thumbnail"
                type="text"
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://example.com/thumbnail.png"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0]/50 focus:border-[#00E5A0] text-[var(--foreground)] bg-[var(--background)] text-sm placeholder:text-[var(--foreground-tertiary)]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
