'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import Modal from '@/components/Modal';

interface EmergencyOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

interface ContentItem {
  id: string;
  name: string;
  type: string;
}

interface DisplayItem {
  id: string;
  nickname: string;
}

interface GroupItem {
  id: string;
  name: string;
}

const DURATION_OPTIONS = [
  { value: 15, label: '15m' },
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 120, label: '2h' },
  { value: 240, label: '4h' },
];

export default function EmergencyOverrideModal({ isOpen, onClose, organizationId }: EmergencyOverrideModalProps) {
  const toast = useToast();
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [displays, setDisplays] = useState<DisplayItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [selectedContentId, setSelectedContentId] = useState('');
  const [targetType, setTargetType] = useState<'organization' | 'group' | 'device'>('organization');
  const [targetId, setTargetId] = useState('');
  const [duration, setDuration] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [contentRes, displaysRes, groupsRes] = await Promise.all([
        apiClient.getContent(),
        apiClient.getDisplays(),
        apiClient.getDisplayGroups(),
      ]);
      const cData = (contentRes as any)?.data ?? contentRes ?? [];
      const dData = (displaysRes as any)?.data ?? displaysRes ?? [];
      const gData = (groupsRes as any)?.data ?? groupsRes ?? [];
      setContentList(cData as ContentItem[]);
      setDisplays(dData as DisplayItem[]);
      setGroups(gData as GroupItem[]);
    } catch (error: any) {
      toast.error('Failed to load data');
    }
  };

  const handleSubmit = async () => {
    if (!selectedContentId) return;

    try {
      setSubmitting(true);
      const target = {
        type: targetType,
        id: targetType === 'organization' ? organizationId : targetId,
      };

      const result = await apiClient.sendFleetCommand({
        command: 'push_content',
        target,
        payload: {
          contentId: selectedContentId,
          duration,
          priority: 'emergency',
        },
      });

      toast.success(
        `Emergency content pushed to ${result.devicesTargeted} devices (${result.devicesOnline} online, ${result.devicesQueued} queued)`
      );
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to push emergency content');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedContentId('');
    setTargetType('organization');
    setTargetId('');
    setDuration(60);
  };

  const resolvedTargetId = targetType === 'organization' ? organizationId : targetId;
  const isSubmitDisabled = !selectedContentId || (targetType !== 'organization' && !targetId) || submitting;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Emergency Content Override" size="lg">
      <div className="space-y-6">
        {/* Content Picker */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
            Content to Push
          </label>
          <select
            value={selectedContentId}
            onChange={(e) => setSelectedContentId(e.target.value)}
            className="eh-select w-full"
          >
            <option value="">Select content...</option>
            {contentList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>

        {/* Target Selector */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
            Target
          </label>
          <div className="flex gap-3 mb-3">
            {([
              { value: 'organization', label: 'All Devices' },
              { value: 'group', label: 'Device Group' },
              { value: 'device', label: 'Single Device' },
            ] as const).map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition ${
                  targetType === option.value
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--foreground-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value={option.value}
                  checked={targetType === option.value}
                  onChange={() => { setTargetType(option.value); setTargetId(''); }}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>

          {targetType === 'group' && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="eh-select w-full"
            >
              <option value="">Select group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          {targetType === 'device' && (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="eh-select w-full"
            >
              <option value="">Select device...</option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>{d.nickname}</option>
              ))}
            </select>
          )}
        </div>

        {/* Duration Pills */}
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
            Duration
          </label>
          <div className="flex gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDuration(opt.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  duration === opt.value
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-[var(--background)] text-[var(--foreground-secondary)] border border-[var(--border)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div className="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg p-4">
          <p className="text-sm text-error-700 dark:text-error-300 font-medium">
            This will immediately interrupt current content on targeted devices
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            className="eh-btn-danger rounded-xl px-6 py-2 text-sm font-medium disabled:opacity-50 transition"
          >
            {submitting ? 'Pushing...' : 'Push Emergency Content'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
