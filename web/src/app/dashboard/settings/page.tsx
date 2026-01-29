'use client';

import { useState } from 'react';
import { Icon } from '@/theme/icons';
import { useTheme } from '@/components/providers/ThemeProvider';
import { semanticColors } from '@/theme/colors';

export default function SettingsPage() {
  const { mode, setMode } = useTheme();
  const [settings, setSettings] = useState({
    organizationName: 'My Organization',
    email: 'admin@vizora.com',
    timezone: 'America/New_York',
    defaultDuration: 30,
    notifications: true,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-50">Settings</h2>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your account and preferences
        </p>
      </div>

      {/* Organization Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Organization</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={settings.organizationName}
              onChange={(e) =>
                setSettings({ ...settings, organizationName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Admin Email
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Theme Preference
            </label>
            <div className="space-y-3">
              {[
                { value: 'light', label: 'Light', icon: 'light_mode' },
                { value: 'dark', label: 'Dark', icon: 'dark_mode' },
                { value: 'system', label: 'System', icon: 'settings' },
              ].map(({ value, label, icon }) => (
                <label
                  key={value}
                  className="flex items-center p-3 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={mode === value}
                    onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <Icon name={icon as any} size="lg" className="ml-3 text-gray-600 dark:text-gray-400" />
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-50">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Color Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Semantic Colors Preview
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { name: 'primary', color: semanticColors.primary },
                { name: 'success', color: semanticColors.success },
                { name: 'warning', color: semanticColors.warning },
                { name: 'error', color: semanticColors.error },
                { name: 'info', color: semanticColors.info },
              ].map(({ name, color }) => (
                <div key={name} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: color.light }}
                      title={`${name} light`}
                    />
                    <div
                      className="w-8 h-8 rounded-md border border-gray-300 dark:border-gray-600"
                      style={{ backgroundColor: color.dark }}
                      title={`${name} dark`}
                    />
                  </div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default Content Duration (seconds)
            </label>
            <input
              type="number"
              value={settings.defaultDuration}
              onChange={(e) =>
                setSettings({ ...settings, defaultDuration: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              How long each piece of content displays by default
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="America/New_York">Eastern Time (US & Canada)</option>
              <option value="America/Chicago">Central Time (US & Canada)</option>
              <option value="America/Denver">Mountain Time (US & Canada)</option>
              <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Notifications</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-50">Email Notifications</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Receive alerts about device status and content updates
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) =>
                setSettings({ ...settings, notifications: e.target.checked })
              }
              className="w-5 h-5"
            />
          </label>
        </div>
      </div>

      {/* Account Actions */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Account</h3>
        <div className="space-y-3">
          <button className="w-full px-4 py-3 text-sm bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition font-medium text-left flex items-center gap-2">
            <Icon name="settings" size="md" className="text-blue-600 dark:text-blue-300" />
            Change Password
          </button>
          <button className="w-full px-4 py-3 text-sm bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium text-left flex items-center gap-2">
            <Icon name="download" size="md" className="text-gray-600 dark:text-gray-400" />
            Export Data
          </button>
          <button className="w-full px-4 py-3 text-sm bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition font-medium text-left flex items-center gap-2">
            <Icon name="warning" size="md" className="text-red-600 dark:text-red-300" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition shadow-md">
          Save Changes
        </button>
      </div>
    </div>
  );
}
