import { ReactNode } from 'react';
import GeneralSidebar from '../GeneralSidebar';

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

// Specific layout wrappers for different scopes
export const TenantLayout = ({ children }: { children: ReactNode }) => {
  const tenantNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/t/[tenantId]',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      label: 'Inventory',
      href: '/t/[tenantId]/items',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      label: 'Categories',
      href: '/t/[tenantId]/categories',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
      children: [
        {
          label: 'All Categories',
          href: '/t/[tenantId]/categories'
        },
        {
          label: 'Quick Start',
          href: '/t/[tenantId]/categories/quick-start'
        },
        {
          label: 'Google Sync',
          href: '/t/[tenantId]/categories/google-sync'
        }
      ]
    },
    {
      label: 'Settings',
      href: '/t/[tenantId]/settings',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      children: [
        {
          label: 'General',
          href: '/t/[tenantId]/settings'
        },
        {
          label: 'Business Profile',
          href: '/t/[tenantId]/settings/business'
        },
        {
          label: 'Integrations',
          href: '/t/[tenantId]/settings/integrations'
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
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      label: 'User Management',
      href: '/settings/admin/users',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
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
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
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
      label: 'System Settings',
      href: '/settings/admin/system',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      children: [
        {
          label: 'Platform Settings',
          href: '/settings/admin/system'
        },
        {
          label: 'Feature Flags',
          href: '/settings/admin/features'
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
