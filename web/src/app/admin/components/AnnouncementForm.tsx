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
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    maintenance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg">
        <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {announcement ? 'Edit Announcement' : 'Create Announcement'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Scheduled Maintenance"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Message
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={formData.startsAt ? String(formData.startsAt).slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, startsAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Expires At
              </label>
              <input
                type="datetime-local"
                value={formData.expiresAt ? String(formData.expiresAt).slice(0, 16) : ''}
                onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
          </label>

          {/* Preview */}
          {formData.title && formData.message && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview</p>
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

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
