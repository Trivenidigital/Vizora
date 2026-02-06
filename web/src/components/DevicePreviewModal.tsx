'use client';

import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { Display, ScreenshotResponse } from '@/lib/types';
import { apiClient } from '@/lib/api';
import { useToast } from '@/lib/hooks/useToast';
import { useSocket } from '@/lib/hooks/useSocket';
import { Icon } from '@/theme/icons';

interface DevicePreviewModalProps {
  device: Display;
  isOpen: boolean;
  onClose: () => void;
}

export default function DevicePreviewModal({ device, isOpen, onClose }: DevicePreviewModalProps) {
  const toast = useToast();
  const [screenshot, setScreenshot] = useState<ScreenshotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // Setup WebSocket listener for screenshot:ready events
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket || !isOpen) return;

    const handleScreenshotReady = (data: {
      deviceId: string;
      requestId: string;
      url: string;
      width: number;
      height: number;
      capturedAt: string;
    }) => {
      // Only update if this is for our device and matches our current request
      if (data.deviceId === device.id && data.requestId === currentRequestId) {
        setScreenshot({
          url: data.url,
          capturedAt: data.capturedAt,
          width: data.width,
          height: data.height,
        });
        setRefreshing(false);
        setLoading(false);
        toast.success('Screenshot captured successfully');
      }
    };

    socket.on('screenshot:ready', handleScreenshotReady);

    return () => {
      socket.off('screenshot:ready', handleScreenshotReady);
    };
  }, [socket, device.id, currentRequestId, isOpen, toast]);

  // Load screenshot when modal opens
  useEffect(() => {
    if (isOpen) {
      loadScreenshot();
    } else {
      // Reset state when modal closes
      setScreenshot(null);
      setError(null);
      setCurrentRequestId(null);
    }
  }, [isOpen, device.id]);

  const loadScreenshot = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiClient.getDeviceScreenshot(device.id);
      setScreenshot(result);
    } catch (err: any) {
      setError(err.message || 'Failed to load screenshot');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (device.status !== 'online') {
      toast.error('Device must be online to capture a screenshot');
      return;
    }

    try {
      setRefreshing(true);
      setError(null);
      const response = await apiClient.requestDeviceScreenshot(device.id);
      setCurrentRequestId(response.requestId);
      toast.info('Screenshot request sent to device...');

      // Set a timeout in case the device doesn't respond
      setTimeout(() => {
        if (refreshing) {
          setRefreshing(false);
          setError('Screenshot request timed out. Device may be offline or unresponsive.');
        }
      }, 30000); // 30 second timeout
    } catch (err: any) {
      setRefreshing(false);
      setError(err.message || 'Failed to request screenshot');
      toast.error('Failed to request screenshot');
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Device Preview" size="xl">
      <div className="space-y-4">
        {/* Device Info Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <Icon name="devices" size="xl" className="text-[var(--foreground-secondary)]" />
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">
                {device.nickname}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    device.status === 'online'
                      ? 'bg-success-100 text-success-800 dark:bg-success-900 dark:text-success-200'
                      : 'bg-[var(--background-secondary)] text-[var(--foreground)]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      device.status === 'online' ? 'bg-success-500' : 'bg-[var(--foreground-tertiary)]'
                    }`}
                  />
                  {device.status === 'online' ? 'Online' : 'Offline'}
                </span>
                {device.location && (
                  <span className="text-sm text-[var(--foreground-tertiary)]">
                    • {device.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || device.status !== 'online'}
            className="flex items-center gap-2 px-4 py-2 bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
          >
            {refreshing ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Capturing...</span>
              </>
            ) : (
              <>
                <Icon name="refresh" size="lg" className="text-[#061A21]" />
                <span>Refresh Screenshot</span>
              </>
            )}
          </button>
        </div>

        {/* Screenshot Display Area */}
        <div className="relative bg-[var(--background-secondary)] rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', maxWidth: '800px', margin: '0 auto' }}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Icon name="error" size="2xl" className="text-red-500 mb-3" />
              <p className="text-red-600 dark:text-red-400 font-medium mb-2">
                {error}
              </p>
              <button
                onClick={loadScreenshot}
                className="text-[#00E5A0] hover:text-[#00CC8E] text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          ) : screenshot ? (
            <>
              <img
                src={screenshot.url}
                alt={`Screenshot of ${device.nickname}`}
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                <div className="flex items-center justify-between text-white text-sm">
                  <span>
                    Captured: {formatTimestamp(screenshot.capturedAt)}
                  </span>
                  {screenshot.width && screenshot.height && (
                    <span>
                      {screenshot.width} × {screenshot.height}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <Icon name="image" size="2xl" className="text-[var(--foreground-tertiary)] mb-3" />
              <p className="text-[var(--foreground-secondary)] mb-2">
                No screenshot available yet
              </p>
              <button
                onClick={handleRefresh}
                disabled={device.status !== 'online'}
                className="text-[#00E5A0] hover:text-[#00CC8E] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {device.status === 'online' ? 'Capture Screenshot' : 'Device is offline'}
              </button>
            </div>
          )}
        </div>

        {/* Info Message */}
        {device.status !== 'online' && (
          <div className="bg-warning-50 dark:bg-warning-900 border border-warning-200 dark:border-warning-700 rounded-lg p-3">
            <p className="text-sm text-warning-800 dark:text-warning-200 flex items-center gap-2">
              <Icon name="warning" size="lg" className="text-warning-600 dark:text-warning-400" />
              Device is currently offline. Screenshots can only be captured from online devices.
            </p>
          </div>
        )}

        {/* Close Button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[var(--foreground-secondary)] bg-[var(--background-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
