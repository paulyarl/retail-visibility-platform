'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  MapPin, 
  Bell, 
  Settings, 
  LogOut,
  User
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/notifications', label: 'Notifications', icon: Bell },
  { href: '/account/settings', label: 'Settings', icon: Settings },
];

export function CustomerSidebar() {
  const pathname = usePathname();
  const { customer, logout } = useCustomerAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      {/* Customer Info */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {customer?.firstName || customer?.email?.split('@')[0] || 'Customer'}
            </p>
            <p className="text-xs text-gray-500 truncate">{customer?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/account' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 w-full transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
}
