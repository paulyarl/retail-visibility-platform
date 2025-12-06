import React from 'react';
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

// Icon components
const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const InventoryIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const StoreIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

// Tenant-scoped sidebar template
export const TenantSidebarTemplate = () => {
  const tenantNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/t/[tenantId]',
      icon: <DashboardIcon />
    },
    {
      label: 'Inventory',
      href: '/t/[tenantId]/items',
      icon: <InventoryIcon />,
      badge: {
        text: '47',
        variant: 'success'
      }
    },
    {
      label: 'Storefront',
      href: '/t/[tenantId]/storefront',
      icon: <StoreIcon />
    },
    {
      label: 'Categories',
      href: '/t/[tenantId]/categories',
      icon: <AnalyticsIcon />,
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
      icon: <SettingsIcon />,
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
          href: '/t/[tenantId]/settings/integrations',
          badge: {
            text: '2',
            variant: 'success'
          }
        }
      ]
    }
  ];

  return (
    <GeneralSidebar
      nav={tenantNavItems}
      collapsible={true}
      scope="tenant"
    />
  );
};

// Admin-scoped sidebar template
export const AdminSidebarTemplate = () => {
  const adminNavItems: NavItem[] = [
    {
      label: 'Admin Dashboard',
      href: '/settings/admin',
      icon: <DashboardIcon />
    },
    {
      label: 'User Management',
      href: '/settings/admin/users',
      icon: <UsersIcon />,
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
      icon: <StoreIcon />,
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
      icon: <SettingsIcon />,
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
    },
    {
      label: 'Integrations',
      href: '/settings/admin/integrations',
      icon: <AnalyticsIcon />,
      badge: {
        text: 'NEW',
        variant: 'warning'
      }
    }
  ];

  return (
    <GeneralSidebar
      nav={adminNavItems}
      collapsible={true}
      scope="admin"
    />
  );
};

// Platform-scoped sidebar template
export const PlatformSidebarTemplate = () => {
  const platformNavItems: NavItem[] = [
    {
      label: 'Platform Dashboard',
      href: '/',
      icon: <DashboardIcon />
    },
    {
      label: 'Tenants',
      href: '/tenants',
      icon: <StoreIcon />,
      badge: {
        text: '12',
        variant: 'default'
      }
    },
    {
      label: 'Directory',
      href: '/directory',
      icon: <AnalyticsIcon />
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: <SettingsIcon />,
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
    <GeneralSidebar
      nav={platformNavItems}
      collapsible={true}
      scope="platform"
    />
  );
};

// Usage example component
export const SidebarUsageExample = () => {
  return (
    <div className="flex">
      {/* Tenant Sidebar */}
      <TenantSidebarTemplate />
      
      {/* Admin Sidebar */}
      <AdminSidebarTemplate />
      
      {/* Platform Sidebar */}
      <PlatformSidebarTemplate />
    </div>
  );
};

export default {
  TenantSidebarTemplate,
  AdminSidebarTemplate,
  PlatformSidebarTemplate,
  SidebarUsageExample
};
