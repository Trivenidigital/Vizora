import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  HomeIcon, 
  TvIcon, 
  PlayIcon, 
  ServerIcon, 
  UsersIcon, 
  CogIcon, 
  ChartBarIcon 
} from '@heroicons/react/24/outline';

// Update logo path to use the SVG
const logoPath = '/logos/logo192.svg';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  
  // Navigation items
  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <HomeIcon className="w-5 h-5" /> },
    { name: 'Displays', path: '/displays', icon: <TvIcon className="w-5 h-5" /> },
    { name: 'Content', path: '/content', icon: <PlayIcon className="w-5 h-5" /> },
    { name: 'Controllers', path: '/controllers', icon: <ServerIcon className="w-5 h-5" /> },
    { name: 'Analytics', path: '/analytics', icon: <ChartBarIcon className="w-5 h-5" /> },
    { name: 'Users', path: '/users', icon: <UsersIcon className="w-5 h-5" /> },
    { name: 'Settings', path: '/settings', icon: <CogIcon className="w-5 h-5" /> },
  ];

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 bg-slate-900 text-white transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out lg:translate-x-0`}>
      <div className="flex flex-col h-full w-64">
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <Link to="/dashboard" className="flex items-center space-x-3">
            <img src={logoPath} alt="Vizora Logo" className="w-8 h-8" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">Vizora</span>
          </Link>
        </div>
        
        {/* Nav items */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                  ? 'bg-purple-700 text-white' 
                  : 'text-gray-300 hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-800 text-xs text-gray-500">
          <p>Vizora v1.0.0</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar; 