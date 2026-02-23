'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from '@/components/Modal';
import { apiClient } from '@/lib/api';
import type { Display } from '@/lib/types';

interface DisplayPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (displayIds: string[]) => void;
  loading?: boolean;
}

export default function DisplayPickerModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: DisplayPickerModalProps) {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDisplays = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const response = await apiClient.getDisplays({ page: 1, limit: 100 });
      // Handle both envelope-wrapped { data: [...] } and direct array responses
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];
      setDisplays(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load displays');
      setDisplays([]);
    } finally {
      setFetching(false);
    }
  }, []);

  // Fetch displays and reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      fetchDisplays();
    }
  }, [isOpen, fetchDisplays]);

  const toggleDisplay = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displays.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displays.map((d) => d.id)));
    }
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  const allSelected = displays.length > 0 && selectedIds.size === displays.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < displays.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Push to Screens" size="md">
      <div className="flex flex-col gap-4">
        {/* Loading state */}
        {fetching && (
          <div className="flex items-center justify-center py-12">
            <svg
              className="h-6 w-6 animate-spin text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="ml-3 text-sm text-gray-400">Loading displays...</span>
          </div>
        )}

        {/* Error state */}
        {!fetching && error && (
          <div className="py-8 text-center text-sm text-red-400">{error}</div>
        )}

        {/* Empty state */}
        {!fetching && !error && displays.length === 0 && (
          <div className="py-8 text-center text-sm text-gray-400">
            No displays found. Pair a display device first.
          </div>
        )}

        {/* Display list */}
        {!fetching && !error && displays.length > 0 && (
          <>
            {/* Select All */}
            <label className="flex cursor-pointer items-center gap-3 px-1">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected;
                }}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
              />
              <span className="text-sm font-medium text-white">
                Select All ({displays.length})
              </span>
            </label>

            {/* Divider */}
            <div className="border-t border-gray-700" />

            {/* Scrollable list */}
            <div className="max-h-64 overflow-y-auto pr-1">
              <div className="flex flex-col gap-1">
                {displays.map((display) => (
                  <label
                    key={display.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-700/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(display.id)}
                      onChange={() => toggleDisplay(display.id)}
                      className="h-4 w-4 shrink-0 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">
                        {display.nickname || display.id}
                      </div>
                      {display.location && (
                        <div className="truncate text-xs text-gray-500">
                          {display.location}
                        </div>
                      )}
                    </div>
                    <span
                      className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        display.status === 'online'
                          ? 'bg-emerald-400'
                          : 'bg-gray-600'
                      }`}
                      title={display.status === 'online' ? 'Online' : 'Offline'}
                    />
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-700 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0 || loading}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Pushing...
              </span>
            ) : (
              `Push to ${selectedIds.size} Screen${selectedIds.size !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
