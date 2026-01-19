"use client";

import { ReactNode, useEffect, useState } from 'react';
import GeneralSidebar from '../GeneralSidebar';
import { NavigationHelpers } from '@/lib/navigation/NavigationHelpers';

// NavItem type definition
type NavItem = { 
  label: string
  href: string
  icon?: React.ReactNode
  badge?: {
    text: string
    variant: 'default' | 'success' | 'warning' | 'error' | 'org'
  }
  children?: NavItem[]
  accessLevel?: 'public' | 'user' | 'admin' | 'owner'
}

interface ResponsiveSidebarLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  scope?: 'workspace' | 'tenant' | 'admin' | 'platform';
  className?: string;
  showMobileBreadcrumb?: boolean;
}

export default function ResponsiveSidebarLayout({
  children,
  navItems,
  scope = 'workspace',
  className = '',
  showMobileBreadcrumb = true
}: ResponsiveSidebarLayoutProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close sidebar when navigating on mobile
  const handleMobileNavClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Mobile breadcrumb navigation
  const MobileBreadcrumb = () => {
    if (!showMobileBreadcrumb || !isMobile) return null;

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const currentItem = navItems.find(item => 
      currentPath === item.href || currentPath.startsWith(item.href + '/')
    );

    if (!currentItem) return null;

    return (
      <div className="md:hidden bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-label="Open navigation"
          >
            <svg className="h-5 w-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2 text-neutral-600">
            <span>Navigation</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-medium text-neutral-900">{currentItem.label}</span>
          </div>
        </div>
      </div>
    );
  };

  // Mobile overlay sidebar
  const MobileSidebar = () => {
    if (!isMobile || !sidebarOpen) return null;

    return (
      <>
        {/* Overlay */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
        
        {/* Mobile Sidebar */}
        <div className="fixed inset-y-0 left-0 w-80 bg-white shadow-xl z-50 md:hidden transform transition-transform duration-300 ease-in-out">
          <div className="flex items-center justify-between p-4 border-b border-neutral-200">
            <h2 className="text-lg font-semibold text-neutral-900">Navigation</h2>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5 text-neutral-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Mobile Navigation Items */}
          <div className="flex-1 overflow-y-auto">
            <GeneralSidebar
              nav={navItems}
              collapsible={false}
              scope={scope}
              onMobileNavClick={handleMobileNavClick}
              isMobile={true}
            />
          </div>
        </div>
      </>
    );
  };

  if (isMobile) {
    // Mobile layout: overlay sidebar + full-width content
    return (
      <div className={`min-h-screen bg-neutral-50 ${className}`}>
        <MobileSidebar />
        <MobileBreadcrumb />
        <main className="flex-1">
          {children}
        </main>
      </div>
    );
  }

  // Desktop layout: traditional sidebar
  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Desktop Sidebar - always visible */}
      <GeneralSidebar
        nav={navItems}
        collapsible={true}
        scope={scope}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-white dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

// HOC for easy page integration
export function withResponsiveSidebarLayout(
  navItems: NavItem[],
  options: Omit<ResponsiveSidebarLayoutProps, 'children' | 'navItems'> = {}
) {
  return function WrappedComponent(props: any) {
    return (
      <ResponsiveSidebarLayout navItems={navItems} {...options}>
        <WrappedComponent {...props} />
      </ResponsiveSidebarLayout>
    );
  };
}

// Static layouts for different scopes
export const ResponsiveAdminLayout = ({ children }: { children: ReactNode }) => {
  const adminNavItems: NavItem[] = [
    {
      label: 'Admin Dashboard',
      href: '/settings/admin',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_DASHBOARD'),
    },
    {
      label: 'User Management',
      href: '/settings/admin/users',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_USERS'),
      children: [
        {
          label: 'All Users',
          href: '/settings/admin/users'
        },
        {
          label: 'Invitations',
          href: '/settings/admin/invitations'
        },
        {
          label: 'Permissions',
          href: '/settings/admin/permissions'
        }
      ]
    },
    {
      label: 'Tenant Management',
      href: '/settings/admin/tenants',
      icon: NavigationHelpers.getStandardIcon('STORE'),
      children: [
        {
          label: 'All Tenants',
          href: '/settings/admin/tenants'
        },
        {
          label: 'Tenant Limits',
          href: '/settings/admin/limits'
        },
        {
          label: 'Capacity Overview',
          href: '/settings/admin/capacity'
        }
      ]
    },
    {
      label: 'Security',
      href: '/settings/admin/security',
      icon: NavigationHelpers.getStandardIcon('ADMIN'),
      children: [
        {
          label: 'Security Dashboard',
          href: '/settings/admin/security'
        },
        {
          label: 'Threat Monitor',
          href: '/settings/admin/security#threats'
        },
        {
          label: 'Blocked IPs',
          href: '/settings/admin/security#blocked-ips'
        }
      ]
    },
    {
      label: 'System Settings',
      href: '/settings/admin/system',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
      children: [
        {
          label: 'Platform Settings',
          href: '/settings/admin/platform'
        },
        {
          label: 'Feature Flags',
          href: '/settings/admin/features'
        },
        {
          label: 'Sentry',
          href: '/settings/admin/sentry'
        },
        {
          label: 'Analytics',
          href: '/settings/admin/analytics'
        }
      ]
    }
  ];

  return (
    <ResponsiveSidebarLayout
      navItems={adminNavItems}
      scope="admin"
    >
      {children}
    </ResponsiveSidebarLayout>
  );
};

export const ResponsivePlatformLayout = ({ children, tenantCount = 0 }: { children: ReactNode; tenantCount?: number }) => {
  const platformNavItems: NavItem[] = [
    {
      label: 'Platform Dashboard',
      href: '/',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_DASHBOARD'),
      children: [
        {
          label: 'Overview',
          href: '/'
        },
        {
          label: 'Admin Controls',
          href: '/settings/admin',
          accessLevel: 'admin',
          children: [
            {
              label: 'User Management',
              href: '/settings/admin/users'
            },
            {
              label: 'Tenant Management',
              href: '/settings/admin/tenants'
            },
            {
              label: 'System Settings',
              href: '/settings/admin/system'
            },
            {
              label: 'Feature Flags',
              href: '/settings/admin/features'
            }
          ]
        }
      ]
    },
    {
      label: 'Tenants',
      href: '/tenants',
      icon: NavigationHelpers.getStandardIcon('STORE'),
      badge: {
        text: String(tenantCount),
        variant: 'default'
      }
    },
    {
      label: 'Directory',
      href: '/directory',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_INSIGHTS'),
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
      children: [
        {
          label: 'Account',
          href: '/settings/account'
        },
        {
          label: 'Organization',
          href: '/settings/organization',
          badge: {
            text: 'ORG',
            variant: 'org'
          }
        },
        {
          label: 'Subscription',
          href: '/settings/subscription'
        },
        {
          label: 'Admin Panel',
          href: '/settings/admin',
          accessLevel: 'admin'
        }
      ]
    }
  ];

  return (
    <ResponsiveSidebarLayout
      navItems={platformNavItems}
      scope="platform"
    >
      {children}
    </ResponsiveSidebarLayout>
  );
};
