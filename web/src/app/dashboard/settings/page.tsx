'use client';

import { useState } from 'react';
import { Icon } from '@/theme/icons';

export default function SettingsPage() {
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
        <h2 className="text-3xl font-bold text-gray-900">Settings</h2>
        <p className="mt-2 text-gray-600">
          Manage your account and preferences
        </p>
      </div>

      {/* Organization Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Organization</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={settings.organizationName}
              onChange={(e) =>
                setSettings({ ...settings, organizationName: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Email
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Display Settings */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Display Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Content Duration (seconds)
            </label>
            <input
              type="number"
              value={settings.defaultDuration}
              onChange={(e) =>
                setSettings({ ...settings, defaultDuration: parseInt(e.target.value) })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-2 text-xs text-gray-500">
              How long each piece of content displays by default
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Timezone
            </label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Notifications</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition">
            <div>
              <div className="font-medium text-gray-900">Email Notifications</div>
              <div className="text-sm text-gray-600">
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Account</h3>
        <div className="space-y-3">
          <button className="w-full px-4 py-3 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium text-left flex items-center gap-2">
            <Icon name="settings" size="md" className="text-blue-600" />
            Change Password
          </button>
          <button className="w-full px-4 py-3 text-sm bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition font-medium text-left flex items-center gap-2">
            <Icon name="download" size="md" className="text-gray-600" />
            Export Data
          </button>
          <button className="w-full px-4 py-3 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium text-left flex items-center gap-2">
            <Icon name="warning" size="md" className="text-red-600" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-md">
          Save Changes
        </button>
      </div>
    </div>
  );
}
