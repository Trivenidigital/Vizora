import { useState, lazy, Suspense } from 'react';
import { FiUser, FiBell, FiLock, FiDatabase, FiLink, FiCreditCard, FiActivity } from 'react-icons/fi';
import { authService } from '@/services/authService';
import { SystemDiagnosticsPage } from './SettingsPages/SystemDiagnosticsPage';

// Lazy load the cache settings page to improve initial loading performance
const CacheSettingsPage = lazy(() => import('./SettingsPages/CacheSettingsPage'));

export function Settings() {
  const [activeTab, setActiveTab] = useState('account');
  const isAdmin = authService.isAdmin();

  const tabs = [
    { id: 'account', label: 'Account', icon: FiUser },
    { id: 'notifications', label: 'Notifications', icon: FiBell },
    { id: 'security', label: 'Security', icon: FiLock },
    { id: 'cache', label: 'Cache', icon: FiDatabase },
    { id: 'integrations', label: 'Integrations', icon: FiLink },
    { id: 'billing', label: 'Billing', icon: FiCreditCard },
  ];

  // Add System Diagnostics tab for admins
  if (isAdmin) {
    tabs.push({ id: 'diagnostics', label: 'System Diagnostics', icon: FiActivity });
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <div className="flex flex-wrap md:flex-nowrap gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`flex items-center w-full px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="mr-2 h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="flex-1 bg-white rounded-lg shadow p-6">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'cache' && (
            <Suspense fallback={<div className="py-10 text-center">Loading cache settings...</div>}>
              <CacheSettingsPage />
            </Suspense>
          )}
          {activeTab === 'integrations' && <IntegrationSettings />}
          {activeTab === 'billing' && <BillingSettings />}
          {activeTab === 'diagnostics' && <SystemDiagnosticsPage />}
        </div>
      </div>
    </div>
  );
}

// Account Settings component
const AccountSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium leading-6 text-gray-900">Profile Information</h3>
        <p className="mt-1 text-sm text-gray-500">Update your account information.</p>
      </div>

      <form className="space-y-6">
        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="first-name" className="block text-sm font-medium text-gray-700">
              First name
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="first-name"
                id="first-name"
                autoComplete="given-name"
                defaultValue="John"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="last-name" className="block text-sm font-medium text-gray-700">
              Last name
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="last-name"
                id="last-name"
                autoComplete="family-name"
                defaultValue="Doe"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue="john.doe@example.com"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="job-title" className="block text-sm font-medium text-gray-700">
              Job title
            </label>
            <div className="mt-1">
              <input
                type="text"
                name="job-title"
                id="job-title"
                defaultValue="Marketing Manager"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-purple-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
};

// Placeholder components for other settings tabs
const NotificationSettings = () => (
  <div className="text-center py-10">
    <p className="text-gray-500">Notification preferences will appear here</p>
  </div>
);

const SecuritySettings = () => (
  <div className="text-center py-10">
    <p className="text-gray-500">Security settings will appear here</p>
  </div>
);

const IntegrationSettings = () => (
  <div className="text-center py-10">
    <p className="text-gray-500">Integration options will appear here</p>
  </div>
);

const BillingSettings = () => (
  <div className="text-center py-10">
    <p className="text-gray-500">Billing information will appear here</p>
  </div>
); 