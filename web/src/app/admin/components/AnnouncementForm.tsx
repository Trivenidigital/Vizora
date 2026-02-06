'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { SystemAnnouncement } from '@/lib/types';

interface AnnouncementFormProps {
  announcement?: SystemAnnouncement | null;
  onSubmit: (data: Partial<SystemAnnouncement>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AnnouncementForm({ announcement, onSubmit, onCancel, isLoading = false }: AnnouncementFormProps) {
  const [formData, setFormData] = useState<Partial<SystemAnnouncement>>({
    title: '',
    message: '',
    type: 'info',
    isActive: true,
    startsAt: new Date().toISOString().slice(0, 16),
    expiresAt: null,
  });

  useEffect(() => {
    if (announcement) {
      setFormData({
        title: announcement.title,
        message: announcement.message,
        type: announcement.type,
        isActive: announcement.isActive,
        startsAt: announcement.startsAt ? new Date(announcement.startsAt).toISOString().slice(0, 16) : '',
        expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().slice(0, 16) : null,
      });
    }
  }, [announcement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      startsAt: formData.startsAt ? new Date(formData.startsAt).toISOString() : undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    };
    await onSubmit(submitData);
  };

  const typeColors = {
    info: 'bg-[#00E5A0]/10 text-[#00E5A0]',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    maintenance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl w-full max-w-lg">
        <div className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            {announcement ? 'Edit Announcement' : 'Create Announcement'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition"
          >
            <X className="w-5 h-5 text-[var(--foreground-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              placeholder="Scheduled Maintenance"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
              Message
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
              Type
            </label>
            <div className="flex flex-wrap gap-2">
              {(['info', 'warning', 'critical', 'maintenance'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, type }))}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                    formData.type === type
                      ? typeColors[type]
                      : 'bg-[var(--background-secondary)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={formData.startsAt ? String(formData.startsAt).slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, startsAt: e.target.value }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">
                Expires At
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt ? String(formData.expiresAt).slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value || null }))}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--foreground)] focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-[#00E5A0] focus:ring-[#00E5A0]"
            />
            <span className="text-sm text-[var(--foreground-secondary)]">Active</span>
          </label>

          {/* Preview */}
          {formData.title && formData.message && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--foreground-tertiary)] mb-2">Preview</p>
              <div
                className={`p-4 rounded-lg ${
                  typeColors[formData.type as keyof typeof typeColors] || typeColors.info
                }`}
              >
                <h4 className="font-semibold">{formData.title}</h4>
                <p className="text-sm mt-1 opacity-90">{formData.message}</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)] rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#061A21]/30 border-t-[#061A21] rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Announcement'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
