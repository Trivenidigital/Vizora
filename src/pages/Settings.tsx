import { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  CreditCard, 
  Bell, 
  Shield, 
  Users, 
  Monitor, 
  Zap,
  Save,
  ChevronRight
} from 'lucide-react';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'billing', name: 'Billing', icon: CreditCard },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'team', name: 'Team Members', icon: Users },
    { id: 'displays', name: 'Display Settings', icon: Monitor },
    { id: 'ai', name: 'AI Settings', icon: Zap },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="text-secondary-500">Manage your account and preferences</p>
      </div>

      {/* Settings Panel */}
      <div className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-4">
          
          {/* Sidebar */}
          <div className="bg-secondary-50 p-4 border-r border-secondary-200">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {<tab.icon className="mr-3 flex-shrink-0 h-5 w-5" />}
                  <span>{tab.name}</span>
                  {activeTab === tab.id && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="p-6 md:col-span-3">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg font-medium text-secondary-900 mb-4">Profile Settings</h2>

                <div className="mb-6 flex items-center">
                  <img
                    className="h-16 w-16 rounded-full"
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    alt="User"
                  />
                  <div className="ml-4">
                    <button className="btn btn-secondary text-sm">Change photo</button>
                    <button className="ml-2 text-sm text-secondary-500 hover:text-secondary-700">Remove</button>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-y-6 gap-x-4">
                    <div className="sm:col-span-3">
                      <label htmlFor="first-name" className="label">
                        First name
                      </label>
                      <input
                        type="text"
                        name="first-name"
                        id="first-name"
                        className="input"
                        defaultValue="John"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="last-name" className="label">
                        Last name
                      </label>
                      <input
                        type="text"
                        name="last-name"
                        id="last-name"
                        className="input"
                        defaultValue="Doe"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="email" className="label">
                        Email address
                      </label>
                      <input
                        type="email"
                        name="email"
                        id="email"
                        className="input"
                        defaultValue="john.doe@example.com"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="company" className="label">
                        Company
                      </label>
                      <input
                        type="text"
                        name="company"
                        id="company"
                        className="input"
                        defaultValue="Acme Inc."
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label htmlFor="job-title" className="label">
                        Job title
                      </label>
                      <input
                        type="text"
                        name="job-title"
                        id="job-title"
                        className="input"
                        defaultValue="Marketing Director"
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label htmlFor="timezone" className="label">
                        Timezone
                      </label>
                      <select
                        id="timezone"
                        name="timezone"
                        className="input"
                        defaultValue="America/New_York"
                      >
                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                        <option value="America/Chicago">Central Time (US & Canada)</option>
                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-5 flex justify-end">
                    <button type="button" className="btn btn-secondary mr-3">
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary flex items-center">
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholder for other tabs */}
            {activeTab !== 'profile' && (
              <div className="text-center py-12">
                <SettingsIcon className="mx-auto h-12 w-12 text-secondary-400" />
                <h3 className="mt-2 text-sm font-medium text-secondary-900">Coming Soon</h3>
                <p className="mt-1 text-sm text-secondary-500">
                  This settings section is currently under development.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
