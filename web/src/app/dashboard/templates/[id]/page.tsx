'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Icon } from '@/theme/icons';

interface TemplateDetail {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  orientation?: string;
  difficulty?: string;
  thumbnailUrl?: string;
  isFeatured?: boolean;
  sampleData?: Record<string, any>;
  htmlTemplate?: string;
  cssTemplate?: string;
  variables?: Array<{ name: string; type: string; description?: string; defaultValue?: any }>;
  createdAt?: string;
  updatedAt?: string;
}

export default function TemplateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clone modal state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  useEffect(() => {
    if (templateId) {
      loadTemplate();
      loadPreview();
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getTemplateDetail(templateId);
      setTemplate(data);
      setCloneName(data.name ? `${data.name} (Copy)` : '');
      setCloneDescription(data.description || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      const data = await apiClient.getTemplatePreview(templateId);
      setPreviewHtml(data.html || null);
    } catch (err: any) {
      console.error('[TemplateDetail] Failed to load preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleClone = async () => {
    try {
      setCloning(true);
      setCloneError(null);
      await apiClient.cloneTemplate(templateId, {
        name: cloneName || undefined,
        description: cloneDescription || undefined,
      });
      setCloneSuccess(true);
      setTimeout(() => {
        setShowCloneModal(false);
        setCloneSuccess(false);
        router.push('/dashboard/content');
      }, 1500);
    } catch (err: any) {
      setCloneError(err.message || 'Failed to clone template');
    } finally {
      setCloning(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty?.toLowerCase()) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-[var(--surface-hover)] text-[var(--foreground-secondary)]';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/templates"
          className="inline-flex items-center gap-2 text-sm text-[var(--foreground-secondary)] hover:text-[#00E5A0] transition"
        >
          <Icon name="chevronLeft" size="sm" />
          Back to Template Library
        </Link>
        <div className="bg-[var(--surface)] rounded-lg shadow p-8 text-center">
          <Icon name="error" size="xl" className="text-red-500 mx-auto mb-3" />
          <p className="text-[var(--foreground-secondary)]">{error || 'Template not found'}</p>
          <button
            onClick={loadTemplate}
            className="mt-4 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-medium text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/templates"
        className="inline-flex items-center gap-2 text-sm text-[var(--foreground-secondary)] hover:text-[#00E5A0] transition"
      >
        <Icon name="chevronLeft" size="sm" />
        Back to Template Library
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-6 items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-3xl font-bold text-[var(--foreground)]">{template.name}</h2>
            {template.isFeatured && (
              <span className="px-3 py-1 text-xs font-semibold bg-[#00E5A0] text-[#061A21] rounded-full">
                Featured
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-[var(--foreground-secondary)] mt-1 max-w-2xl">
              {template.description}
            </p>
          )}

          {/* Metadata badges */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {template.category && (
              <span className="px-3 py-1 text-sm bg-[var(--surface-hover)] text-[var(--foreground-secondary)] rounded-lg">
                {template.category}
              </span>
            )}
            {template.difficulty && (
              <span className={`px-3 py-1 text-sm rounded-lg font-medium ${getDifficultyColor(template.difficulty)}`}>
                {template.difficulty}
              </span>
            )}
            {template.orientation && (
              <span className="px-3 py-1 text-sm bg-[var(--surface-hover)] text-[var(--foreground-secondary)] rounded-lg flex items-center gap-1">
                <Icon name="grid" size="sm" />
                {template.orientation}
              </span>
            )}
          </div>

          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {template.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-[var(--background)] text-[var(--foreground-tertiary)] rounded border border-[var(--border)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Clone Button */}
        <button
          onClick={() => setShowCloneModal(true)}
          className="px-6 py-3 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-semibold shadow-md hover:shadow-lg flex items-center gap-2 flex-shrink-0"
        >
          <Icon name="copy" size="md" />
          Clone to My Content
        </button>
      </div>

      {/* Main Content: Preview + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preview Area (2/3 width) */}
        <div className="lg:col-span-2">
          <div className="bg-[var(--surface)] rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-2">
                <Icon name="preview" size="md" className="text-[#00E5A0]" />
                Template Preview
              </h3>
              <button
                onClick={loadPreview}
                className="text-sm text-[var(--foreground-secondary)] hover:text-[#00E5A0] transition flex items-center gap-1"
              >
                <Icon name="refresh" size="sm" />
                Refresh
              </button>
            </div>

            <div className="relative bg-[var(--background)]" style={{ minHeight: '400px' }}>
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <LoadingSpinner size="lg" />
                </div>
              ) : previewHtml ? (
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts"
                  className="w-full border-0"
                  style={{ height: '500px' }}
                  title={`Preview of ${template.name}`}
                />
              ) : template.thumbnailUrl ? (
                <div className="flex items-center justify-center h-96">
                  <img
                    src={template.thumbnailUrl}
                    alt={template.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-96 text-[var(--foreground-tertiary)]">
                  <Icon name="grid" size="6xl" className="opacity-30 mb-4" />
                  <p className="text-sm">Preview not available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details Sidebar (1/3 width) */}
        <div className="space-y-6">
          {/* Template Info Card */}
          <div className="bg-[var(--surface)] rounded-lg shadow p-5">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 uppercase tracking-wider">
              Template Details
            </h3>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--foreground-tertiary)]">Category</dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">{template.category || 'Uncategorized'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--foreground-tertiary)]">Difficulty</dt>
                <dd>
                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${getDifficultyColor(template.difficulty || '')}`}>
                    {template.difficulty || 'Not specified'}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-[var(--foreground-tertiary)]">Orientation</dt>
                <dd className="text-sm font-medium text-[var(--foreground)]">{template.orientation || 'Any'}</dd>
              </div>
              {template.createdAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-[var(--foreground-tertiary)]">Created</dt>
                  <dd className="text-sm font-medium text-[var(--foreground)]">
                    {new Date(template.createdAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
              {template.updatedAt && (
                <div className="flex justify-between">
                  <dt className="text-sm text-[var(--foreground-tertiary)]">Updated</dt>
                  <dd className="text-sm font-medium text-[var(--foreground)]">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Template Variables */}
          {template.variables && template.variables.length > 0 && (
            <div className="bg-[var(--surface)] rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 uppercase tracking-wider">
                Template Variables
              </h3>
              <div className="space-y-3">
                {template.variables.map((variable) => (
                  <div key={variable.name} className="p-3 bg-[var(--background)] rounded-lg border border-[var(--border)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--foreground)]">{variable.name}</span>
                      <span className="text-xs px-2 py-0.5 bg-[var(--surface-hover)] text-[var(--foreground-tertiary)] rounded">
                        {variable.type}
                      </span>
                    </div>
                    {variable.description && (
                      <p className="text-xs text-[var(--foreground-tertiary)]">{variable.description}</p>
                    )}
                    {variable.defaultValue !== undefined && (
                      <p className="text-xs text-[var(--foreground-tertiary)] mt-1">
                        Default: <code className="bg-[var(--surface-hover)] px-1 rounded">{String(variable.defaultValue)}</code>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Data */}
          {template.sampleData && Object.keys(template.sampleData).length > 0 && (
            <div className="bg-[var(--surface)] rounded-lg shadow p-5">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 uppercase tracking-wider">
                Sample Data
              </h3>
              <pre className="text-xs text-[var(--foreground-secondary)] bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(template.sampleData, null, 2)}
              </pre>
            </div>
          )}

          {/* Clone CTA (repeated for visibility) */}
          <div className="bg-gradient-to-br from-[#00E5A0]/10 to-[#00B4D8]/10 rounded-lg p-5 border border-[#00E5A0]/20">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
              Use this template
            </h3>
            <p className="text-xs text-[var(--foreground-secondary)] mb-4">
              Clone this template to your content library and customize it with your own data.
            </p>
            <button
              onClick={() => setShowCloneModal(true)}
              className="w-full px-4 py-2.5 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition font-semibold text-sm flex items-center justify-center gap-2"
            >
              <Icon name="copy" size="sm" />
              Clone Template
            </button>
          </div>
        </div>
      </div>

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !cloning && setShowCloneModal(false)}
          />

          {/* Modal content */}
          <div className="relative bg-[var(--surface)] rounded-lg shadow-xl border border-[var(--border)] w-full max-w-md mx-4 p-6 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--foreground)]">Clone Template</h3>
              <button
                onClick={() => !cloning && setShowCloneModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-hover)] transition text-[var(--foreground-tertiary)]"
              >
                <Icon name="close" size="md" />
              </button>
            </div>

            {cloneSuccess ? (
              <div className="text-center py-6">
                <Icon name="success" size="xl" className="text-[#00E5A0] mx-auto mb-3" />
                <p className="text-[var(--foreground)] font-medium">Template cloned successfully!</p>
                <p className="text-sm text-[var(--foreground-secondary)] mt-1">Redirecting to your content library...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-[var(--foreground-secondary)]">
                  Clone &quot;{template.name}&quot; to your organization&apos;s content library. You can optionally customize the name and description.
                </p>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                    Content Name
                  </label>
                  <input
                    type="text"
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)]"
                    placeholder="Enter a name for the cloned content"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={cloneDescription}
                    onChange={(e) => setCloneDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent text-[var(--foreground)] bg-[var(--background)] resize-none"
                    placeholder="Describe how you plan to use this template"
                  />
                </div>

                {cloneError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{cloneError}</p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setShowCloneModal(false)}
                    disabled={cloning}
                    className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClone}
                    disabled={cloning}
                    className="px-4 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {cloning ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        <Icon name="copy" size="sm" />
                        Clone Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
