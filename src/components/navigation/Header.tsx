import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { 
  Bell, 
  Menu as MenuIcon, 
  User, 
  LogOut, 
  Settings,
  HelpCircle
} from 'lucide-react';

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void;
}

const Header = ({ setSidebarOpen }: HeaderProps) => {
  return (
    <div className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white shadow">
      <button
        type="button"
        className="px-4 border-r border-secondary-200 text-secondary-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <MenuIcon className="h-6 w-6" aria-hidden="true" />
      </button>
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex items-center">
          <div className="max-w-2xl w-full">
            <h1 className="text-xl font-semibold text-secondary-900">Welcome to Vizora</h1>
            <p className="text-sm text-secondary-500">AI-powered digital signage platform</p>
          </div>
        </div>
        <div className="ml-4 flex items-center md:ml-6">
          {/* Notification dropdown */}
          <Menu as="div" className="ml-3 relative">
            <div>
              <Menu.Button className="bg-white p-1 rounded-full text-secondary-400 hover:text-secondary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <span className="sr-only">View notifications</span>
                <Bell className="h-6 w-6" aria-hidden="true" />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-2 border-b border-secondary-200">
                  <h3 className="text-sm font-medium text-secondary-900">Notifications</h3>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <Menu.Item>
                    <div className="px-4 py-3 hover:bg-secondary-50 cursor-pointer">
                      <p className="text-sm font-medium text-secondary-900">Display #3 is offline</p>
                      <p className="text-xs text-secondary-500">5 minutes ago</p>
                    </div>
                  </Menu.Item>
                  <Menu.Item>
                    <div className="px-4 py-3 hover:bg-secondary-50 cursor-pointer">
                      <p className="text-sm font-medium text-secondary-900">AI content suggestion ready</p>
                      <p className="text-xs text-secondary-500">1 hour ago</p>
                    </div>
                  </Menu.Item>
                  <Menu.Item>
                    <div className="px-4 py-3 hover:bg-secondary-50 cursor-pointer">
                      <p className="text-sm font-medium text-secondary-900">Weekly analytics report</p>
                      <p className="text-xs text-secondary-500">Yesterday</p>
                    </div>
                  </Menu.Item>
                </div>
                <div className="border-t border-secondary-200 px-4 py-2">
                  <Link to="/app/settings/notifications" className="text-xs text-primary-600 hover:text-primary-500">
                    View all notifications
                  </Link>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Profile dropdown */}
          <Menu as="div" className="ml-3 relative">
            <div>
              <Menu.Button className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                <span className="sr-only">Open user menu</span>
                <img
                  className="h-8 w-8 rounded-full"
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                  alt=""
                />
              </Menu.Button>
            </div>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/app/profile"
                      className={`${
                        active ? 'bg-secondary-100' : ''
                      } block px-4 py-2 text-sm text-secondary-700 flex items-center`}
                    >
                      <User className="mr-3 h-4 w-4" />
                      Your Profile
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/app/settings"
                      className={`${
                        active ? 'bg-secondary-100' : ''
                      } block px-4 py-2 text-sm text-secondary-700 flex items-center`}
                    >
                      <Settings className="mr-3 h-4 w-4" />
                      Settings
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/help"
                      className={`${
                        active ? 'bg-secondary-100' : ''
                      } block px-4 py-2 text-sm text-secondary-700 flex items-center`}
                    >
                      <HelpCircle className="mr-3 h-4 w-4" />
                      Help Center
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/logout"
                      className={`${
                        active ? 'bg-secondary-100' : ''
                      } block px-4 py-2 text-sm text-secondary-700 flex items-center`}
                    >
                      <LogOut className="mr-3 h-4 w-4" />
                      Sign out
                    </Link>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  );
};

export default Header;
