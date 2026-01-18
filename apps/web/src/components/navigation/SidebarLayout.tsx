import { ReactNode } from 'react';
import GeneralSidebar from '../GeneralSidebar';
import { NavigationHelpers } from '@/lib/navigation/NavigationHelpers';

// NavItem type definition (copied from GeneralSidebar since it's not exported)
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

interface SidebarLayoutProps {
  children: ReactNode;
  navItems: NavItem[];
  scope?: 'workspace' | 'tenant' | 'admin' | 'platform';
  collapsible?: boolean;
  showCollapseButton?: boolean;
  className?: string;
}

export default function SidebarLayout({
  children,
  navItems,
  scope = 'workspace',
  collapsible = true,
  showCollapseButton = true,
  className = ''
}: SidebarLayoutProps) {
  return (
    <div className={`flex h-screen bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Sidebar */}
      <GeneralSidebar
        nav={navItems}
        collapsible={collapsible}
        scope={scope}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Main content area */}
        <main className="flex-1 overflow-auto bg-white dark:bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}

// HOC for easy page integration
export function withSidebarLayout(
  navItems: NavItem[],
  options: Omit<SidebarLayoutProps, 'children' | 'navItems'> = {}
) {
  return function WrappedComponent(props: any) {
    return (
      <SidebarLayout navItems={navItems} {...options}>
        <WrappedComponent {...props} />
      </SidebarLayout>
    );
  };
}

// Dynamic tenant layout that accepts nav items with dynamic hrefs
export const DynamicTenantLayout = ({ children, navItems }: { children: ReactNode; navItems: NavItem[] }) => {
  return (
    <SidebarLayout
      navItems={navItems}
      scope="tenant"
      collapsible={true}
    >
      {children}
    </SidebarLayout>
  );
};

// Static tenant layout with predefined items
export const TenantLayout = ({ children, tenantId }: { children: ReactNode; tenantId: string }) => {
  const tenantNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: `/t/${tenantId}`,
      icon: NavigationHelpers.getStandardIcon('DASHBOARD'),
    },
    {
      label: 'Inventory',
      href: `/t/${tenantId}/items`,
      icon: NavigationHelpers.getStandardIcon('INVENTORY_CENTER'),
    },
    {
      label: 'Categories',
      href: `/t/${tenantId}/categories`,
      icon: NavigationHelpers.getStandardIcon('STORE_CENTER'),
      children: [
        {
          label: 'All Categories',
          href: `/t/${tenantId}/categories`
        },
        {
          label: 'Quick Start',
          href: `/t/${tenantId}/categories/quick-start`
        },
        {
          label: 'Google Sync',
          href: `/t/${tenantId}/categories/google-sync`
        }
      ]
    },
    {
      label: 'Settings',
      href: `/t/${tenantId}/settings`,
      icon: NavigationHelpers.getStandardIcon('USER_PANEL'),
      children: [
        {
          label: 'General',
          href: `/t/${tenantId}/settings`
        },
        {
          label: 'Business Profile',
          href: `/t/${tenantId}/settings/business`
        },
        {
          label: 'Integrations',
          href: `/t/${tenantId}/settings/integrations`
        }
      ]
    }
  ];

  return (
    <SidebarLayout
      navItems={tenantNavItems}
      scope="tenant"
      collapsible={true}
    >
      {children}
    </SidebarLayout>
  );
};

export const AdminLayout = ({ children }: { children: ReactNode }) => {
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
    <SidebarLayout
      navItems={adminNavItems}
      scope="admin"
      collapsible={true}
    >
      {children}
    </SidebarLayout>
  );
};

export const PlatformLayout = ({ children, tenantCount = 0 }: { children: ReactNode; tenantCount?: number }) => {
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
        },
        {
          label: 'Insights',
          href: '/insights',
          children: [
            {
              label: 'Analytics',
              href: '/insights/analytics'
            },
            {
              label: 'Reports',
              href: '/insights/reports'
            },
            {
              label: 'Performance',
              href: '/insights/performance'
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
      },
      children: [
        {
          label: 'All Tenants',
          href: '/tenants'
        },
        {
          label: 'Create Tenant',
          href: '/tenants/create'
        }
      ]
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
    <SidebarLayout
      navItems={platformNavItems}
      scope="platform"
      collapsible={true}
    >
      {children}
    </SidebarLayout>
  );
};
