import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Monitor, 
  FileImage, 
  List, 
  Calendar, 
  BarChart, 
  Settings, 
  HelpCircle,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  setSidebarOpen?: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ setSidebarOpen }) => {
  const location = useLocation();
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Displays', href: '/displays', icon: Monitor },
    { name: 'Content Library', href: '/content', icon: FileImage },
    { name: 'Playlists', href: '/playlists', icon: List },
    { name: 'Schedule', href: '/schedule', icon: Calendar },
    { name: 'Analytics', href: '/analytics', icon: BarChart },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Helper function to check if current path matches the nav item
  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 w-64 fixed left-0 top-0 z-40 overflow-y-auto">
      {/* Sidebar top padding for the navbar */}
      <div className="pt-16">
        <div className="p-4">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg ${
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setSidebarOpen && setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      active ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-600'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="flex-1">{item.name}</span>
                  {active && (
                    <ChevronRight
                      className="ml-3 h-4 w-4 text-primary-600"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Help section */}
      <div className="p-4 mt-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center">
            <HelpCircle className="h-6 w-6 text-primary-600" />
            <h3 className="ml-3 text-sm font-medium text-gray-900">Need help?</h3>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Check our documentation or contact support for assistance.</p>
            <a href="#" className="block mt-2 text-primary-600 hover:text-primary-700 font-medium">
              View documentation
            </a>
          </div>
        </div>
      </div>
      
      {/* App version */}
      <div className="px-4 py-2 mt-4 text-xs text-gray-400">
        Version 1.0.0
      </div>
    </div>
  );
};

export default Sidebar;
