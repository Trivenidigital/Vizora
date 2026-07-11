'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import type { Content } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import LoadingSpinner from '@/components/LoadingSpinner';
import { Icon } from '@/theme/icons';

interface ContentLifecyclePanelProps {
  /** The full content-detail record (getContentItem) currently being edited. */
  content: Content;
  /**
   * Candidate content for the auto-replacement selector — typically the
   * currently-loaded list. Self is filtered out internally.
   */
  replacementCandidates: Content[];
  /** Called after any lifecycle mutation so the parent can refresh list + detail. */
  onChanged: () => void;
  disabled?: boolean;
}

// Only file-backed content can have its underlying file swapped. URL / HTML /
// template content is edited elsewhere, not "replaced".
const FILE_REPLACEABLE_TYPES = new Set(['image', 'video', 'pdf']);

const FILE_ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  pdf: 'application/pdf',
};

/**
 * Convert an ISO timestamp to the value a `<input type="datetime-local">`
 * expects — local time, minute precision, no zone: `YYYY-MM-DDTHH:mm`.
 */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatTimestamp(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export default function ContentLifecyclePanel({
  content,
  replacementCandidates,
  onChanged,
  disabled = false,
}: ContentLifecyclePanelProps) {
  const toast = useToast();

  const [expiresAt, setExpiresAt] = useState(toDatetimeLocalValue(content.expiresAt));
  const [replacementId, setReplacementId] = useState(content.replacementContentId ?? '');
  const [savingExpiration, setSavingExpiration] = useState(false);

  const [versions, setVersions] = useState<Content[] | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [keepBackup, setKeepBackup] = useState(true);
  const [replacing, setReplacing] = useState(false);

  // Re-seed local form state whenever a different content item is opened.
  useEffect(() => {
    setExpiresAt(toDatetimeLocalValue(content.expiresAt));
    setReplacementId(content.replacementContentId ?? '');
    setReplaceFile(null);
  }, [content.id, content.expiresAt, content.replacementContentId]);

  const candidates = replacementCandidates.filter((c) => c.id !== content.id);
  const canReplaceFile = FILE_REPLACEABLE_TYPES.has(content.type);
  const busy = disabled || savingExpiration || replacing || restoringId !== null;

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const list = await apiClient.getContentVersions(content.id);
      setVersions(list);
    } catch (error) {
      setVersionsError(error instanceof Error ? error.message : 'Failed to load version history');
    } finally {
      setVersionsLoading(false);
    }
  }, [content.id]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const handleSetExpiration = async () => {
    if (!expiresAt) {
      toast.error('Choose an expiration date first');
      return;
    }
    const parsed = new Date(expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      toast.error('Invalid expiration date');
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      toast.error('Expiration must be in the future');
      return;
    }
    setSavingExpiration(true);
    try {
      await apiClient.setContentExpiration(
        content.id,
        parsed.toISOString(),
        replacementId || undefined,
      );
      toast.success('Expiration scheduled');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to set expiration');
    } finally {
      setSavingExpiration(false);
    }
  };

  const handleClearExpiration = async () => {
    setSavingExpiration(true);
    try {
      await apiClient.clearContentExpiration(content.id);
      setExpiresAt('');
      setReplacementId('');
      toast.success('Expiration cleared');
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear expiration');
    } finally {
      setSavingExpiration(false);
    }
  };

  const handleReplaceFile = async () => {
    if (!replaceFile) {
      toast.error('Choose a replacement file first');
      return;
    }
    setReplacing(true);
    try {
      await apiClient.replaceContentFile(content.id, replaceFile, { keepBackup });
      toast.success(keepBackup ? 'File replaced (previous version kept)' : 'File replaced');
      setReplaceFile(null);
      onChanged();
      void loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to replace file');
    } finally {
      setReplacing(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await apiClient.restoreContentVersion(versionId);
      toast.success('Version restored');
      onChanged();
      void loadVersions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  const nowLocal = toDatetimeLocalValue(new Date().toISOString());

  return (
    <div className="space-y-5 border-t border-[var(--border)] pt-4">
      {/* Expiration + auto-replacement */}
      <section className="space-y-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <Icon name="clock" size="md" />
          Expiration &amp; auto-replacement
        </h3>
        {content.expiresAt ? (
          <p className="text-xs text-[var(--foreground-tertiary)]">
            Currently expires {formatTimestamp(content.expiresAt)}
          </p>
        ) : (
          <p className="text-xs text-[var(--foreground-tertiary)]">No expiration set</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="content-expires-at"
              className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1"
            >
              Expires at
            </label>
            <input
              id="content-expires-at"
              type="datetime-local"
              value={expiresAt}
              min={nowLocal}
              disabled={busy}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent disabled:opacity-50"
            />
          </div>
          <div>
            <label
              htmlFor="content-replacement"
              className="block text-xs font-medium text-[var(--foreground-secondary)] mb-1"
            >
              Replace with (optional)
            </label>
            <select
              id="content-replacement"
              value={replacementId}
              disabled={busy}
              onChange={(e) => setReplacementId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent disabled:opacity-50"
            >
              <option value="">Remove from playlists on expiry</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.status !== 'active' ? ` (${c.status})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={handleSetExpiration}
            disabled={busy || !expiresAt}
            className="bg-[#00E5A0] text-[#061A21] hover:bg-[#00CC8E] transition rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {savingExpiration && <LoadingSpinner size="sm" />}
            Schedule expiration
          </button>
          {content.expiresAt && (
            <button
              type="button"
              onClick={handleClearExpiration}
              disabled={busy}
              className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] transition rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              Clear expiration
            </button>
          )}
        </div>
      </section>

      {/* File replacement */}
      {canReplaceFile && (
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Icon name="upload" size="md" />
            Replace file
          </h3>
          <p className="text-xs text-[var(--foreground-tertiary)]">
            Upload a new file for this item. Playlists keep pointing at it.
          </p>
          <input
            type="file"
            accept={FILE_ACCEPT[content.type]}
            disabled={busy}
            onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-[var(--foreground-secondary)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-[var(--foreground)] disabled:opacity-50"
          />
          <label className="flex items-center gap-2 text-xs text-[var(--foreground-secondary)]">
            <input
              type="checkbox"
              checked={keepBackup}
              disabled={busy}
              onChange={(e) => setKeepBackup(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] text-[#00E5A0] focus:ring-[#00E5A0]"
            />
            Keep previous version (saved to version history)
          </label>
          <button
            type="button"
            onClick={handleReplaceFile}
            disabled={busy || !replaceFile}
            className="bg-[#00E5A0] text-[#061A21] hover:bg-[#00CC8E] transition rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {replacing && <LoadingSpinner size="sm" />}
            Replace file
          </button>
        </section>
      )}

      {/* Version history */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
            <Icon name="refresh" size="md" />
            Version history
          </h3>
          <button
            type="button"
            onClick={() => void loadVersions()}
            disabled={versionsLoading}
            className="text-xs text-[var(--primary)] hover:underline disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
        {versionsLoading && versions === null ? (
          <div className="py-3 flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        ) : versionsError ? (
          <div className="text-xs text-red-500 dark:text-red-400">
            {versionsError}{' '}
            <button
              type="button"
              onClick={() => void loadVersions()}
              className="underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : versions && versions.length > 1 ? (
          <ul className="space-y-1">
            {versions.map((version) => {
              const isCurrent = version.id === content.id;
              return (
                <li
                  key={version.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[var(--foreground)]">
                      v{version.versionNumber ?? 1} · {version.title}
                    </p>
                    <p className="text-xs text-[var(--foreground-tertiary)]">
                      {isCurrent ? 'Current' : version.status}
                      {version.createdAt ? ` · ${formatTimestamp(version.createdAt)}` : ''}
                    </p>
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => handleRestore(version.id)}
                      disabled={busy}
                      className="bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] transition rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-50 flex items-center gap-1 shrink-0"
                    >
                      {restoringId === version.id && <LoadingSpinner size="sm" />}
                      Restore
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-[var(--foreground-tertiary)]">
            No previous versions. Replacing the file with &ldquo;keep previous version&rdquo;
            enabled adds one here.
          </p>
        )}
      </section>
    </div>
  );
}
