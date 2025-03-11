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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-secondary-900">Settings</h1>
        <p className="text-secondary-500">Manage your account and preferences</p>
      </div>
      
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
                  <tab.icon className="mr-3 flex-shrink-0 h-5 w-5" />
                  <span>{tab.name}</span>
                  {activeTab === tab.id && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content area */}
          <div className="p-6 md:col-span-3">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-lg font-medium text-secondary-900 mb-4">Profile Settings</h2>
                
                <div className="mb-6">
                  <div className="flex items-center">
                    <img
                      className="h-16 w-16 rounded-full"
                      src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                      alt=""
                    />
                    <div className="ml-4">
                      <button className="btn btn-secondary text-sm">Change photo</button>
                      <button className="ml-2 text-sm text-secondary-500 hover:text-secondary-700">Remove</button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                    <div className="sm:col-span-3">
                      <label htmlFor="first-name" className="label">
                        First name
                      </label>
                      <input
                        type="text"
                        name="first-name"
                        id="first-name"
                        autoComplete="given-name"
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
                        autoComplete="family-name"
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
                        autoComplete="email"
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
                        autoComplete="organization"
                        className="input"
                        defaultValue="Acme Inc."
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label html<ez1Action type="file" filePath="src/pages/Settings.tsx">
                      <label htmlFor="job-title" className="label">
                        Job title
                      </label>
                      <input
                        type="text"
                        name="job-title"
                        id="job-title"
                        autoComplete="organization-title"
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
                        autoComplete="timezone"
                        className="input"
                        defaultValue="America/New_York"
                      >
                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                        <option value="America/Chicago">Central Time (US & Canada)</option>
                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                        <option value="Europe/London">GMT (London)</option>
                        <option value="Europe/Paris">Central European Time (Paris)</option>
                        <option value="Asia/Tokyo">Japan Standard Time (Tokyo)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="pt-5">
                    <div className="flex justify-end">
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
              </div>
            )}
            
            {activeTab === 'billing' && (
              <div>
                <h2 className="text-lg font-medium text-secondary-900 mb-4">Billing Settings</h2>
                
                <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-md">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <CreditCard className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-primary-800">Pro Plan</h3>
                      <div className="mt-1 text-sm text-primary-700">
                        <p>Your plan renews on January 1, 2023</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 mb-3">Payment method</h3>
                    <div className="bg-secondary-50 p-4 rounded-md border border-secondary-200 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="bg-white p-2 rounded-md border border-secondary-200">
                          <svg className="h-6 w-6" viewBox="0 0 36 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="36" height="24" rx="4" fill="#EEEEEE" />
                            <path d="M10.5 16.5H13.5L15 8.5H12L10.5 16.5Z" fill="#4F46E5" />
                            <path d="M17.5 8.5C16.5 8.5 15 9 15 10.5C15 12.5 17 12.5 17 13.5C17 14 16.5 14.5 15.5 14.5C14.5 14.5 13.5 14 13.5 14L13 16C13 16 14 16.5 15.5 16.5C17 16.5 19 15.5 19 13.5C19 11.5 17 11.5 17 10.5C17 10 17.5 9.5 18.5 9.5C19.5 9.5 20.5 10 20.5 10L21 8C21 8 19.5 8.5 17.5 8.5Z" fill="#4F46E5" />
                            <path d="M21.5 16.5H24.5L26 8.5H23L21.5 16.5Z" fill="#4F46E5" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-secondary-900">Visa ending in 4242</div>
                          <div className="text-sm text-secondary-500">Expires 12/2024</div>
                        </div>
                      </div>
                      <div>
                        <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">Edit</button>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 mb-3">Billing history</h3>
                    <div className="bg-white border border-secondary-200 rounded-md overflow-hidden">
                      <table className="min-w-full divide-y divide-secondary-200">
                        <thead className="bg-secondary-50">
                          <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                              Description
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th scope="col" className="relative px-6 py-3">
                              <span className="sr-only">Download</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-secondary-200">
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Dec 1, 2022
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Pro Plan Subscription
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              $99.00
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <a href="#" className="text-primary-600 hover:text-primary-700">
                                Download
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Nov 1, 2022
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Pro Plan Subscription
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              $99.00
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <a href="#" className="text-primary-600 hover:text-primary-700">
                                Download
                              </a>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Oct 1, 2022
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              Pro Plan Subscription
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                              $99.00
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <a href="#" className="text-primary-600 hover:text-primary-700">
                                Download
                              </a>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-lg font-medium text-secondary-900 mb-4">Notification Settings</h2>
                
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 mb-3">Email Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="display-alerts"
                            name="display-alerts"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            defaultChecked
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="display-alerts" className="font-medium text-secondary-700">
                            Display alerts
                          </label>
                          <p className="text-secondary-500">Get notified when a display goes offline or has issues.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="content-updates"
                            name="content-updates"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            defaultChecked
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="content-updates" className="font-medium text-secondary-700">
                            Content updates
                          </label>
                          <p className="text-secondary-500">Receive notifications when content is published or updated.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="ai-suggestions"
                            name="ai-suggestions"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            defaultChecked
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="ai-suggestions" className="font-medium text-secondary-700">
                            AI suggestions
                          </label>
                          <p className="text-secondary-500">Get notified when AI generates new content suggestions.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="analytics-reports"
                            name="analytics-reports"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            defaultChecked
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="analytics-reports" className="font-medium text-secondary-700">
                            Analytics reports
                          </label>
                          <p className="text-secondary-500">Receive weekly analytics reports and insights.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium text-secondary-900 mb-3">System Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="browser-notifications"
                            name="browser-notifications"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                            defaultChecked
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="browser-notifications" className="font-medium text-secondary-700">
                            Browser notifications
                          </label>
                          <p className="text-secondary-500">Show browser notifications for important alerts.</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="sms-notifications"
                            name="sms-notifications"
                            type="checkbox"
                            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="sms-notifications" className="font-medium text-secondary-700">
                            SMS notifications
                          </label>
                          <p className="text-secondary-500">Receive text messages for critical alerts.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-5">
                    <div className="flex justify-end">
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
              </div>
            )}
            
            {activeTab !== 'profile' && activeTab !== 'billing' && activeTab !== 'notifications' && (
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
