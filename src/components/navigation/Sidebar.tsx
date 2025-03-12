import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  FolderOpen, 
  PlaySquare, 
  Calendar, 
  BarChart3, 
  Settings,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

const Sidebar = () => {
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  
  const menuItems = [
    { 
      name: 'Dashboard', 
      icon: LayoutDashboard, 
      path: '/dashboard',
      submenu: [] 
    },
    { 
      name: 'Displays', 
      icon: Monitor, 
      path: '/displays',
      submenu: [
        { name: 'All Displays', path: '/displays' },
        { name: 'Add Display', path: '/displays/add' },
        { name: 'Display Groups', path: '/displays/groups' }
      ]
    },
    { 
      name: 'Content Library', 
      icon: FolderOpen, 
      path: '/content',
      submenu: [
        { name: 'All Content', path: '/content' },
        { name: 'Upload Content', path: '/content/upload' },
        { name: 'Categories', path: '/content/categories' }
      ]
    },
    { 
      name: 'Playlists', 
      icon: PlaySquare, 
      path: '/playlists',
      submenu: [] 
    },
    { 
      name: 'Schedule', 
      icon: Calendar, 
      path: '/schedule',
      submenu: [] 
    },
    { 
      name: 'Analytics', 
      icon: BarChart3, 
      path: '/analytics',
      submenu: [] 
    },
    { 
      name: 'Settings', 
      icon: Settings, 
      path: '/settings',
      submenu: [] 
    }
  ];
  
  const toggleMenu = (menuName: string) => {
    if (expandedMenus.includes(menuName)) {
      setExpandedMenus(expandedMenus.filter(name => name !== menuName));
    } else {
      setExpandedMenus([...expandedMenus, menuName]);
    }
  };
  
  const isMenuActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };
  
  return (
    <aside className="w-64 bg-white shadow-sm h-screen sticky top-0 hidden md:block">
      <div className="h-full px-3 py-4 overflow-y-auto">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              {item.submenu.length > 0 ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`flex items-center w-full p-2 text-base rounded-lg ${
                      isMenuActive(item.path) 
                        ? 'bg-primary-50 text-primary-600' 
                        : 'text-secondary-600 hover:bg-secondary-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-2" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {expandedMenus.includes(item.name) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedMenus.includes(item.name) && (
                    <ul className="py-2 space-y-1 pl-6">
                      {item.submenu.map((subItem) => (
                        <li key={subItem.name}>
                          <Link
                            to={subItem.path}
                            className={`flex items-center p-2 text-sm rounded-lg ${
                              location.pathname === subItem.path
                                ? 'bg-primary-50 text-primary-600'
                                : 'text-secondary-600 hover:bg-secondary-50'
                            }`}
                          >
                            {subItem.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center p-2 text-base rounded-lg ${
                    isMenuActive(item.path)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-secondary-600 hover:bg-secondary-50'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-2" />
                  <span>{item.name}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
