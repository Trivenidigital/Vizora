'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CreditCard,
  Gift,
  Building2,
  Users,
  Activity,
  BarChart3,
  Settings,
  Shield,
  Megaphone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { name: 'Plans', href: '/admin/plans', icon: CreditCard },
  { name: 'Promotions', href: '/admin/promotions', icon: Gift },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Health', href: '/admin/health', icon: Activity },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Config', href: '/admin/config', icon: Settings },
  { name: 'Security', href: '/admin/security', icon: Shield },
  { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
  { name: 'Support', href: '/admin/support', icon: MessageSquare },
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } bg-[#061A21] min-h-screen fixed left-0 top-0 z-40 transition-all duration-300 flex flex-col`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#1B3D47]">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#8B5CF6] to-[#00B4D8] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <span className="text-white font-semibold">Admin</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-[#081E28] text-[#8A8278] hover:text-white transition"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#8B5CF6] to-[#00B4D8] text-white'
                      : 'text-[#8A8278] hover:bg-[#081E28] hover:text-white'
                  }`}
                  title={collapsed ? item.name : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-[#1B3D47]">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-[#8A8278] hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      )}
    </aside>
  );
}
