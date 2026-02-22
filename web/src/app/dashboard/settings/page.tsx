'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Icon } from '@/theme/icons';
import { useTheme } from '@/components/providers/ThemeProvider';
import { semanticColors } from '@/theme/colors';
import Modal from '@/components/Modal';
import { useToast } from '@/lib/hooks/useToast';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
 const { mode, setMode } = useTheme();
 const toast = useToast();
 const [settings, setSettings] = useState({
 organizationName: 'My Organization',
 email: 'admin@vizora.com',
 timezone: 'America/New_York',
 defaultDuration: 30,
 notifications: true,
 country: 'US',
 organizationId: '',
 });

 // Change password modal state
 const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
 const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
 const [passwordLoading, setPasswordLoading] = useState(false);

 const [saving, setSaving] = useState(false);

 // Fetch real settings on mount
 useEffect(() => {
   async function loadSettings() {
     try {
       const user = await apiClient.getCurrentUser();
       setSettings(prev => ({
         ...prev,
         email: user.email || prev.email,
         organizationName: user.organization?.name || prev.organizationName,
         organizationId: user.organizationId || prev.organizationId,
         country: user.organization?.country || prev.country,
       }));
     } catch (err) {
       console.error('Failed to load settings:', err);
     }
   }
   loadSettings();
 }, []);

 const handleChangePassword = async () => {
   if (passwordForm.newPassword !== passwordForm.confirmPassword) {
     toast.error('New passwords do not match');
     return;
   }
   if (passwordForm.newPassword.length < 8) {
     toast.error('New password must be at least 8 characters');
     return;
   }
   setPasswordLoading(true);
   try {
     await apiClient.changePassword({
       currentPassword: passwordForm.currentPassword,
       newPassword: passwordForm.newPassword,
     });
     toast.success('Password changed successfully');
     setShowChangePasswordModal(false);
     setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
   } catch (error: any) {
     toast.error(error.message || 'Failed to change password');
   } finally {
     setPasswordLoading(false);
   }
 };

 return (
 <div className="space-y-6">
 <div>
 <h2 className="eh-heading font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Settings</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Manage your account and preferences
 </p>
 </div>

 {/* Organization Settings */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Organization</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Organization Name
 </label>
 <input
 type="text"
 value={settings.organizationName}
 onChange={(e) =>
 setSettings({ ...settings, organizationName: e.target.value })
 }
 className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Admin Email
 </label>
 <input
 type="email"
 value={settings.email}
 onChange={(e) => setSettings({ ...settings, email: e.target.value })}
 className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 <div>
   <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
     Region
   </label>
   <select
     value={settings.country || 'US'}
     onChange={(e) => setSettings({ ...settings, country: e.target.value })}
     className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
   >
     <option value="US">United States (USD)</option>
     <option value="IN">India (INR)</option>
   </select>
   <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
     Determines your billing currency and payment methods
   </p>
 </div>
 </div>
 </div>

 {/* Theme Settings */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Appearance</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-3">
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
 className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--surface-hover)] transition"
 >
 <input
 type="radio"
 name="theme"
 value={value}
 checked={mode === value}
 onChange={(e) => setMode(e.target.value as 'light' | 'dark' | 'system')}
 className="w-4 h-4 accent-primary cursor-pointer"
 />
 <Icon name={icon as any} size="lg" className="ml-3 text-[var(--foreground-secondary)]" />
 <span className="ml-3 text-sm font-medium text-[var(--foreground)]">{label}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Color Preview */}
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-3">
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
 className="w-8 h-8 rounded-md border border-[var(--border)]"
 style={{ backgroundColor: color.light }}
 title={`${name} light`}
 />
 <div
 className="w-8 h-8 rounded-md border border-[var(--border)]"
 style={{ backgroundColor: color.dark }}
 title={`${name} dark`}
 />
 </div>
 <p className="text-xs font-medium text-[var(--foreground-secondary)] capitalize">{name}</p>
 </div>
 ))}
 </div>
 </div>
 </div>
 </div>

 {/* Display Settings */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Display Settings</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Default Content Duration (seconds)
 </label>
 <input
 type="number"
 value={settings.defaultDuration}
 onChange={(e) =>
 setSettings({ ...settings, defaultDuration: parseInt(e.target.value) })
 }
 className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
 How long each piece of content displays by default
 </p>
 </div>
 <div>
 <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-2">
 Timezone
 </label>
 <select
 value={settings.timezone}
 onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
 className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
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
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Notifications</h3>
 <div className="space-y-4">
 <label className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg cursor-pointer hover:bg-[var(--surface-hover)] transition">
 <div>
 <div className="font-medium text-[var(--foreground)]">Email Notifications</div>
 <div className="text-sm text-[var(--foreground-secondary)]">
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

 {/* Billing Settings */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Billing</h3>
 <div className="space-y-3">
 <Link
 href="/dashboard/settings/billing"
 className="w-full px-4 py-3 text-sm bg-[var(--background)] text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium text-left flex items-center gap-2"
 >
 <Icon name="analytics" size="md" className="text-[var(--foreground-secondary)]" />
 Subscription & Billing
 <span className="ml-auto text-[var(--foreground-tertiary)]">
 <Icon name="chevronRight" size="md" />
 </span>
 </Link>
 </div>
 </div>

 {/* Developer Settings */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Developer</h3>
 <div className="space-y-3">
 <Link
 href="/dashboard/settings/api-keys"
 className="w-full px-4 py-3 text-sm bg-[var(--background)] text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium text-left flex items-center gap-2"
 >
 <Icon name="key" size="md" className="text-[var(--foreground-secondary)]" />
 API Keys
 <span className="ml-auto text-[var(--foreground-tertiary)]">
 <Icon name="chevronRight" size="md" />
 </span>
 </Link>
 </div>
 </div>

 {/* Account Actions */}
 <div className="bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">Account</h3>
 <div className="space-y-3">
 <button
   onClick={() => setShowChangePasswordModal(true)}
   className="w-full px-4 py-3 text-sm bg-[#00E5A0]/5 dark:bg-[#00E5A0]/10 text-[#00E5A0] dark:text-[#00E5A0] rounded-lg hover:bg-[#00E5A0]/10 dark:hover:bg-[#00E5A0]/10 transition font-medium text-left flex items-center gap-2"
 >
 <Icon name="settings" size="md" className="text-[#00E5A0] dark:text-[#00E5A0]" />
 Change Password
 </button>
 <button className="w-full px-4 py-3 text-sm bg-[var(--background)] text-[var(--foreground-secondary)] rounded-lg hover:bg-[var(--surface-hover)] transition font-medium text-left flex items-center gap-2">
 <Icon name="download" size="md" className="text-[var(--foreground-secondary)]" />
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
 <button
   onClick={async () => {
     if (!settings.organizationId) {
       toast.error('Organization not loaded yet');
       return;
     }
     setSaving(true);
     try {
       await apiClient.updateOrganization(settings.organizationId, {
         name: settings.organizationName,
         country: settings.country,
       });
       toast.success('Settings saved successfully');
     } catch (error: any) {
       toast.error(error.message || 'Failed to save settings');
     } finally {
       setSaving(false);
     }
   }}
   disabled={saving}
   className="px-6 py-3 text-sm font-medium bg-[#00E5A0] text-[#061A21] hover:bg-[#00CC8E] dark:bg-[#00E5A0] dark:hover:bg-[#00CC8E] rounded-lg transition shadow-md disabled:opacity-50"
 >
   {saving ? 'Saving...' : 'Save Changes'}
 </button>
 </div>

 {/* Change Password Modal */}
 <Modal
   isOpen={showChangePasswordModal}
   onClose={() => {
     setShowChangePasswordModal(false);
     setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
   }}
   title="Change Password"
 >
   <div className="space-y-4">
     <div>
       <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">Current Password</label>
       <input
         type="password"
         value={passwordForm.currentPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
         className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
       />
     </div>
     <div>
       <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">New Password</label>
       <input
         type="password"
         value={passwordForm.newPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
         className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
       />
     </div>
     <div>
       <label className="block text-sm font-medium text-[var(--foreground-secondary)] mb-1">Confirm New Password</label>
       <input
         type="password"
         value={passwordForm.confirmPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
         className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
       />
     </div>
     <div className="flex justify-end gap-3 pt-4">
       <button
         onClick={() => {
           setShowChangePasswordModal(false);
           setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
         }}
         className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
       >
         Cancel
       </button>
       <button
         onClick={handleChangePassword}
         disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
         className="px-4 py-2 text-sm font-medium bg-[#00E5A0] text-[#061A21] rounded-lg hover:bg-[#00CC8E] transition disabled:opacity-50"
       >
         {passwordLoading ? 'Changing...' : 'Change Password'}
       </button>
     </div>
   </div>
 </Modal>
 <toast.ToastContainer />
 </div>
 );
}
