'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import type { SystemAnnouncement } from '@/lib/types';
import { useToast } from '@/lib/hooks/useToast';
import { AnnouncementForm } from '../components/AnnouncementForm';
import { StatusBadge } from '../components/StatusBadge';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Plus, Edit, Trash2, Megaphone, Calendar, AlertTriangle, Info, Wrench } from 'lucide-react';

export default function AdminAnnouncementsPage() {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<SystemAnnouncement | null>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<SystemAnnouncement | null>(null);

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAnnouncements();
      setAnnouncements(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingAnnouncement(null);
    setShowForm(true);
  };

  const handleEdit = (announcement: SystemAnnouncement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleSubmit = async (data: Partial<SystemAnnouncement>) => {
    try {
      setFormLoading(true);
      if (editingAnnouncement) {
        await apiClient.updateAnnouncement(editingAnnouncement.id, data);
        toast.success('Announcement updated successfully');
      } else {
        await apiClient.createAnnouncement(data);
        toast.success('Announcement created successfully');
      }
      setShowForm(false);
      setEditingAnnouncement(null);
      loadAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save announcement');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAnnouncement) return;
    try {
      await apiClient.deleteAnnouncement(deletingAnnouncement.id);
      toast.success('Announcement deleted successfully');
      setDeletingAnnouncement(null);
      loadAnnouncements();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete announcement');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (type: SystemAnnouncement['type']) => {
    switch (type) {
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />;
      case 'maintenance':
        return <Wrench className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getTypeStyles = (type: SystemAnnouncement['type']) => {
    switch (type) {
      case 'info':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'maintenance':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const isExpired = (announcement: SystemAnnouncement) => {
    if (!announcement.expiresAt) return false;
    return new Date(announcement.expiresAt) < new Date();
  };

  const isScheduled = (announcement: SystemAnnouncement) => {
    return new Date(announcement.startsAt) > new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Sort announcements: active first, then by start date
  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
  });

  return (
    <div className="space-y-6">
      <toast.ToastContainer />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Announcements</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Manage system-wide announcements and notifications
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-5 h-5" />
          Create Announcement
        </button>
      </div>

      {/* Announcements List */}
      <div className="space-y-4">
        {sortedAnnouncements.map((announcement) => (
          <div
            key={announcement.id}
            className={`rounded-xl border-2 overflow-hidden ${
              !announcement.isActive || isExpired(announcement)
                ? 'opacity-60 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                : getTypeStyles(announcement.type)
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-2 rounded-lg ${
                      !announcement.isActive || isExpired(announcement)
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                        : ''
                    }`}
                  >
                    {getTypeIcon(announcement.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {announcement.title}
                      </h3>
                      {isScheduled(announcement) && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Scheduled
                        </span>
                      )}
                      {isExpired(announcement) && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          Expired
                        </span>
                      )}
                      <StatusBadge
                        status={announcement.isActive ? 'active' : 'inactive'}
                        size="sm"
                      />
                    </div>
                    <p
                      className={`text-sm ${
                        !announcement.isActive || isExpired(announcement)
                          ? 'text-gray-500 dark:text-gray-400'
                          : ''
                      }`}
                    >
                      {announcement.message}
                    </p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Starts: {formatDate(announcement.startsAt)}</span>
                      </div>
                      {announcement.expiresAt && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Expires: {formatDate(announcement.expiresAt)}</span>
                        </div>
                      )}
                      <span className="px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs capitalize">
                        {announcement.type}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(announcement)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition"
                    title="Edit"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeletingAnnouncement(announcement)}
                    className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-white/50 dark:hover:bg-gray-800/50 rounded-lg transition"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {announcements.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <Megaphone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No announcements yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create announcements to communicate with all users.
          </p>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Create Announcement
          </button>
        </div>
      )}

      {/* Announcement Form Modal */}
      {showForm && (
        <AnnouncementForm
          announcement={editingAnnouncement}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingAnnouncement(null);
          }}
          isLoading={formLoading}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingAnnouncement}
        onClose={() => setDeletingAnnouncement(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        message={`Are you sure you want to delete "${deletingAnnouncement?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
