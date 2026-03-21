'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { useToast } from '@/lib/hooks/useToast';

export const dynamic = 'force-dynamic';

const FEATURE_DEFINITIONS = [
  { key: 'weatherWidget', name: 'Weather Widget', description: 'Display weather information on signage screens' },
  { key: 'rssWidget', name: 'RSS/News Widget', description: 'Display RSS feeds and news headlines on signage' },
  { key: 'clockWidget', name: 'Clock & Countdown Widget', description: 'Display clocks, timers, and countdowns' },
  { key: 'fleetControl', name: 'Fleet Control', description: 'Remote device management commands (reboot, screenshot, etc.)' },
  { key: 'contentModeration', name: 'Content Moderation', description: 'Flag and review content workflow before publishing' },
  { key: 'customBranding', name: 'Custom Branding', description: 'Custom logo, colors, and branding on dashboard and displays' },
  { key: 'advancedAnalytics', name: 'Advanced Analytics', description: 'Detailed content performance metrics and reporting' },
  { key: 'emergencyOverride', name: 'Emergency Override', description: 'Push emergency content to all devices instantly' },
] as const;

export default function FeatureFlagsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadFlags = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getFeatureFlags();
      setFlags(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = (key: string) => {
    if (!isAdmin) return;
    setFlags(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await apiClient.updateFeatureFlags(flags);
      setFlags(updated);
      setDirty(false);
      toast.success('Feature flags saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save feature flags');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadFlags();
    setDirty(false);
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Feature Flags</h2>
          <p className="mt-2 text-[var(--foreground-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Feature Flags</h2>
        <p className="mt-2 text-[var(--foreground-secondary)]">
          Enable or disable features for your organization. All features are enabled by default.
        </p>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Only administrators can modify feature flags. Contact your admin to change these settings.
          </p>
        </div>
      )}

      <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
        <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-6">Features</h3>
        <div className="space-y-1">
          {FEATURE_DEFINITIONS.map(({ key, name, description }) => (
            <label
              key={key}
              className={`flex items-center justify-between p-4 rounded-lg transition ${
                isAdmin
                  ? 'cursor-pointer hover:bg-[var(--surface-hover)]'
                  : 'cursor-default opacity-80'
              }`}
            >
              <div className="flex-1 mr-4">
                <div className="font-medium text-[var(--foreground)]">{name}</div>
                <div className="text-sm text-[var(--foreground-secondary)]">{description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flags[key] !== false}
                disabled={!isAdmin}
                onClick={() => handleToggle(key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#00E5A0] focus:ring-offset-2 disabled:opacity-50 ${
                  flags[key] !== false
                    ? 'bg-[#00E5A0]'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    flags[key] !== false ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end gap-3">
          {dirty && (
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
            >
              Discard Changes
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="eh-btn-neon rounded-xl px-6 py-3 text-sm font-medium transition shadow-md disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      <toast.ToastContainer />
    </div>
  );
}
