'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

 // Delete account modal state
 const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
 const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' });
 const [deleteLoading, setDeleteLoading] = useState(false);
 const [deleteError, setDeleteError] = useState('');
 const router = useRouter();

 const [saving, setSaving] = useState(false);

 // Profile state
 const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '' });
 const [profileSaving, setProfileSaving] = useState(false);

 // Fetch real settings on mount
 useEffect(() => {
   async function loadSettings() {
     try {
       const user = await apiClient.getCurrentUser();
       const orgSettings = (user.organization?.settings as Record<string, any>) || {};
       setSettings(prev => ({
         ...prev,
         email: user.email || prev.email,
         organizationName: user.organization?.name || prev.organizationName,
         organizationId: user.organizationId || prev.organizationId,
         country: user.organization?.country || prev.country,
         defaultDuration: orgSettings.defaultDuration ?? prev.defaultDuration,
         timezone: orgSettings.timezone ?? prev.timezone,
         notifications: orgSettings.notifications ?? prev.notifications,
       }));
       setProfileForm({
         firstName: user.firstName || '',
         lastName: user.lastName || '',
       });
     } catch (err) {
       if (process.env.NODE_ENV === 'development') {
         console.error('Failed to load settings:', err);
       }
     }
   }
   loadSettings();
 }, []);

 const handleSaveProfile = async () => {
   if (!profileForm.firstName.trim()) {
     toast.error('First name is required');
     return;
   }
   setProfileSaving(true);
   try {
     await apiClient.updateProfile({
       firstName: profileForm.firstName.trim(),
       lastName: profileForm.lastName.trim(),
     });
     toast.success('Profile updated!');
     // Force layout to re-fetch user data so header shows updated name
     router.refresh();
   } catch (error: any) {
     toast.error(error.message || 'Failed to update profile');
   } finally {
     setProfileSaving(false);
   }
 };

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

 const handleDeleteAccount = async () => {
   setDeleteError('');
   if (deleteForm.confirmation !== 'DELETE MY ACCOUNT') {
     setDeleteError('Please type "DELETE MY ACCOUNT" exactly');
     return;
   }
   if (!deleteForm.password) {
     setDeleteError('Password is required');
     return;
   }
   setDeleteLoading(true);
   try {
     await apiClient.deleteAccount({
       password: deleteForm.password,
       confirmation: deleteForm.confirmation,
     });
     // Clear auth state and redirect to login
     apiClient.setAuthenticated(false);
     router.push('/login?deleted=1');
   } catch (error: any) {
     setDeleteError(error.message || 'Failed to delete account. Please check your password.');
   } finally {
     setDeleteLoading(false);
   }
 };

 return (
 <div className="space-y-8">
 <div>
 <h2 className="eh-dash-title font-[var(--font-sora)] text-2xl text-[var(--foreground)]">Settings</h2>
 <p className="mt-2 text-[var(--foreground-secondary)]">
 Manage your account and preferences
 </p>
 </div>

 {/* Profile Settings */}
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Profile</h3>
 <div className="space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 First Name
 </label>
 <input
 type="text"
 value={profileForm.firstName}
 onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
 className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 Last Name
 </label>
 <input
 type="text"
 value={profileForm.lastName}
 onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
 className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 </div>
 <div className="flex justify-end">
 <button
   onClick={handleSaveProfile}
   disabled={profileSaving}
   className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50"
 >
   {profileSaving ? 'Saving...' : 'Update Profile'}
 </button>
 </div>
 </div>
 </div>

 {/* Organization Settings */}
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Organization</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 Organization Name
 </label>
 <input
 type="text"
 value={settings.organizationName}
 onChange={(e) =>
 setSettings({ ...settings, organizationName: e.target.value })
 }
 className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 Admin Email
 </label>
 <input
 type="email"
 value={settings.email}
 onChange={(e) => setSettings({ ...settings, email: e.target.value })}
 className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 </div>
 <div>
   <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
     Region
   </label>
   <select
     value={settings.country || 'US'}
     onChange={(e) => setSettings({ ...settings, country: e.target.value })}
     className="eh-select w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Appearance</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-3">
 Theme Preference
 </label>
 <div className="space-y-2">
 {[
 { value: 'light', label: 'Light', icon: 'light_mode' },
 { value: 'dark', label: 'Dark', icon: 'dark_mode' },
 { value: 'system', label: 'System', icon: 'settings' },
 ].map(({ value, label, icon }) => (
 <label
 key={value}
 className="flex items-center p-2.5 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--surface-hover)] transition"
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
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-3">
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Display Settings</h3>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 Default Content Duration (seconds)
 </label>
 <input
 type="number"
 value={settings.defaultDuration}
 onChange={(e) =>
 setSettings({ ...settings, defaultDuration: parseInt(e.target.value) })
 }
 className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
 />
 <p className="mt-2 text-xs text-[var(--foreground-tertiary)]">
 How long each piece of content displays by default
 </p>
 </div>
 <div>
 <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
 Timezone
 </label>
 <select
 value={settings.timezone}
 onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
 className="eh-select w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Notifications</h3>
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Billing</h3>
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Developer</h3>
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
 <div className="eh-dash-card bg-[var(--surface)] rounded-lg shadow-md p-6">
 <h3 className="eh-dash-subtitle text-lg font-semibold text-[var(--foreground)] mb-4">Account</h3>
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
 <button
   onClick={() => setShowDeleteAccountModal(true)}
   className="w-full px-4 py-3 text-sm bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition font-medium text-left flex items-center gap-2"
 >
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
         settings: {
           defaultDuration: settings.defaultDuration,
           timezone: settings.timezone,
           notifications: settings.notifications,
         },
       });
       toast.success('Settings saved successfully');
     } catch (error: any) {
       toast.error(error.message || 'Failed to save settings');
     } finally {
       setSaving(false);
     }
   }}
   disabled={saving}
   className="eh-btn-neon rounded-xl px-6 py-3 text-sm font-medium transition shadow-md disabled:opacity-50"
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
       <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-1">Current Password</label>
       <input
         type="password"
         value={passwordForm.currentPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
         className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
       />
     </div>
     <div>
       <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-1">New Password</label>
       <input
         type="password"
         value={passwordForm.newPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
         className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
       />
     </div>
     <div>
       <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-1">Confirm New Password</label>
       <input
         type="password"
         value={passwordForm.confirmPassword}
         onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
         className="eh-input w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-[#00E5A0] focus:border-transparent"
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
         className="eh-btn-neon rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-50"
       >
         {passwordLoading ? 'Changing...' : 'Change Password'}
       </button>
     </div>
   </div>
 </Modal>
 {/* Delete Account Modal */}
 <Modal
   isOpen={showDeleteAccountModal}
   onClose={() => {
     setShowDeleteAccountModal(false);
     setDeleteForm({ password: '', confirmation: '' });
     setDeleteError('');
   }}
   title="Delete Account"
 >
   <div className="space-y-4">
     <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
       <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-2">
         This action is permanent and cannot be undone.
       </p>
       <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
         <li>All your content, playlists, and schedules will be deleted</li>
         <li>All paired devices will be unpaired and removed</li>
         <li>Your organization will be permanently deleted if you are the sole admin</li>
         <li>Your account will be anonymized for audit purposes</li>
       </ul>
     </div>
     {deleteError && (
       <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
         <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
       </div>
     )}
     <div>
       <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-1">
         Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE MY ACCOUNT</span> to confirm
       </label>
       <input
         type="text"
         value={deleteForm.confirmation}
         onChange={(e) => setDeleteForm({ ...deleteForm, confirmation: e.target.value })}
         placeholder="DELETE MY ACCOUNT"
         className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
       />
     </div>
     <div>
       <label className="block text-sm font-semibold text-[var(--foreground-secondary)] mb-1">Password</label>
       <input
         type="password"
         value={deleteForm.password}
         onChange={(e) => setDeleteForm({ ...deleteForm, password: e.target.value })}
         placeholder="Enter your password"
         className="w-full px-4 py-2 border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
       />
     </div>
     <div className="flex justify-end gap-3 pt-4">
       <button
         onClick={() => {
           setShowDeleteAccountModal(false);
           setDeleteForm({ password: '', confirmation: '' });
           setDeleteError('');
         }}
         className="px-4 py-2 text-sm font-medium text-[var(--foreground-secondary)] bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surface-hover)] transition"
       >
         Cancel
       </button>
       <button
         onClick={handleDeleteAccount}
         disabled={deleteLoading || deleteForm.confirmation !== 'DELETE MY ACCOUNT' || !deleteForm.password}
         className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
       >
         {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
       </button>
     </div>
   </div>
 </Modal>
 <toast.ToastContainer />
 </div>
 );
}
