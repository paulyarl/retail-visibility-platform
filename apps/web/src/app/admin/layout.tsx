'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Rocket, 
  Building2, 
  Package, 
  Sparkles, 
  DollarSign,
  Layers,
  Settings,
  Home,
  Users,
  Menu,
  X,
  MapPin,
  FolderTree
} from 'lucide-react';
import SettingsFooter from '@/components/SettingsFooter';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';


export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { settings } = usePlatformSettings();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { href: '/admin/tools', label: 'Control Panel', icon: Rocket },
    { href: '/admin/users', label: 'User Management', icon: Users },
    { href: '/admin/enrichment', label: 'Product Intelligence', icon: Sparkles },
    { href: '/admin/quick-start/products', label: 'Products Quick Start', icon: Rocket },
    { href: '/admin/quick-start/categories', label: 'Product Categories Quick Start', icon: Rocket },
    { href: '/admin/organizations', label: 'Organizations Panel', icon: Building2 },
    { href: '/admin/categories', label: 'Product Categories', icon: Layers },
    { href: '/admin/platform-categories', label: 'Platform Categories', icon: FolderTree },
    { href: '/admin/directory', label: 'Directory Panel', icon: MapPin },
    { href: '/admin/tiers', label: 'Subscription Panel', icon: DollarSign },
    { href: '/admin/billing', label: 'Billing Panel', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                ) : (
                  <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt={settings.platformName || 'Platform Logo'} 
                  className="h-8 sm:h-10 w-auto object-contain"
                />
              ) : (
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-base sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Platform Admin
                </h1>
              </div>
            </div>
            <Link
              href="/admin"
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Home className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Back to Platform</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = mounted && (pathname === item.href || pathname?.startsWith(item.href + '/'));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Mobile Sidebar Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 shadow-2xl border-r border-gray-200 dark:border-gray-700 animate-in slide-in-from-left duration-300">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                <div className="font-semibold text-gray-900 dark:text-white text-base">Admin Menu</div>
                <button 
                  onClick={() => setMobileMenuOpen(false)} 
                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              <nav className="p-3 space-y-1 overflow-auto h-[calc(100%-60px)]">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = mounted && (pathname === item.href || pathname?.startsWith(item.href + '/'));
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium text-base">{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      <SettingsFooter />
    </div>
  );
}
