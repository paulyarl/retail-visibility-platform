import React from 'react';
import GeneralSidebar from '../GeneralSidebar';
import NavigationStandards, { NavigationHelpers } from '@/lib/navigation/NavigationStandards';

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
  hierarchy?: number
}

// Icon components - Use NavigationStandards for consistency
const DashboardIcon = NavigationHelpers.getStandardIcon('ANALYTICS');
const InventoryIcon = NavigationHelpers.getStandardIcon('STORE');
const UsersIcon = NavigationHelpers.getStandardIcon('TEAM');
const SettingsIcon = NavigationHelpers.getStandardIcon('SETTINGS');
const StoreIcon = NavigationHelpers.getStandardIcon('STORE');
const AnalyticsIcon = NavigationHelpers.getStandardIcon('ANALYTICS');

// Tenant-scoped sidebar template
export const TenantSidebarTemplate = () => {
  const tenantNavItems: NavItem[] = NavigationHelpers.sortByHierarchy([
    {
      label: 'Dashboard',
      href: '/t/[tenantId]',
      icon: NavigationHelpers.getStandardIcon('DASHBOARD'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.DASHBOARD,
    },
    {
      label: 'Onboarding',
      href: '/t/[tenantId]/onboarding',
      icon: NavigationHelpers.getStandardIcon('HELP'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.DASHBOARD,
    },
    {
      label: 'User Panel',
      href: '/t/[tenantId]/account',
      icon: NavigationHelpers.getStandardIcon('USER_PANEL'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.USER_PANEL,
      children: [
        {
          label: 'Account',
          href: '/t/[tenantId]/account'
        },
        {
          label: 'Teams',
          href: '/t/[tenantId]/teams',
          children: [
            {
              label: 'Store Team',
              href: '/t/[tenantId]/teams/store',
              children: [
                {
                  label: 'Store Owner',
                  href: '/t/[tenantId]/teams/store/owner'
                },
                {
                  label: 'Store Member',
                  href: '/t/[tenantId]/teams/store/member'
                },
                {
                  label: 'Store Admin',
                  href: '/t/[tenantId]/teams/store/admin'
                }
              ]
            },
            {
              label: 'Platform Team',
              href: '/t/[tenantId]/teams/platform',
              children: [
                {
                  label: 'Platform Admin',
                  href: '/t/[tenantId]/teams/platform/admin'
                },
                {
                  label: 'Platform Support',
                  href: '/t/[tenantId]/teams/platform/support'
                },
                {
                  label: 'Platform Viewer',
                  href: '/t/[tenantId]/teams/platform/viewer'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      label: 'Store Center',
      href: '/t/[tenantId]/store',
      icon: NavigationHelpers.getStandardIcon('STORE_CENTER'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.STORE_CENTER,
      children: [
        {
          label: 'Store Profile',
          href: '/t/[tenantId]/store/profile'
        },
        {
          label: 'Store Sync',
          href: '/t/[tenantId]/store/sync'
        },
        {
          label: 'Store Settings',
          href: '/t/[tenantId]/store/settings'
        },
        {
          label: 'Platform Centers',
          href: '/t/[tenantId]/store/platforms'
        },
        {
          label: 'Organization',
          href: '/t/[tenantId]/store/organization'
        },
        {
          label: 'Subscription',
          href: '/t/[tenantId]/store/subscription'
        }
      ]
    },
    {
      label: 'Inventory Center',
      href: '/t/[tenantId]/inventory',
      icon: NavigationHelpers.getStandardIcon('INVENTORY_CENTER'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.INVENTORY_MANAGEMENT,
      children: [
        {
          label: 'Items',
          href: '/t/[tenantId]/inventory/items',
          badge: {
            text: '47',
            variant: 'success'
          }
        },
        {
          label: 'Barcode Scanner',
          href: '/t/[tenantId]/inventory/scanner'
        },
        {
          label: 'Quick Start',
          href: '/t/[tenantId]/inventory/quick-start'
        }
      ]
    },
    {
      label: 'Storefront',
      href: '/t/[tenantId]/storefront',
      icon: NavigationHelpers.getStandardIcon('STORE'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
    },
    {
      label: 'Categories',
      href: '/t/[tenantId]/categories',
      icon: NavigationHelpers.getStandardIcon('ANALYTICS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
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
      icon: NavigationHelpers.getStandardIcon('SETTINGS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.ADVANCED_FEATURES,
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
  ]);

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
  const adminNavItems: NavItem[] = NavigationHelpers.sortByHierarchy([
    {
      label: 'Admin Dashboard',
      href: '/admin',
      icon: NavigationHelpers.getStandardIcon('ADMIN'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_ADMIN,
    },
    {
      label: 'User Management',
      href: '/admin/users',
      icon: NavigationHelpers.getStandardIcon('TEAM'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_USERS,
      children: [
        {
          label: 'All Users',
          href: '/admin/users'
        },
        {
          label: 'Invitations',
          href: '/admin/invitations'
        },
        {
          label: 'Permissions',
          href: '/admin/permissions'
        }
      ]
    },
    {
      label: 'Tenant Management',
      href: '/admin/tenants',
      icon: NavigationHelpers.getStandardIcon('STORE'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_USERS,
      children: [
        {
          label: 'All Tenants',
          href: '/admin/tenants'
        },
        {
          label: 'Tenant Limits',
          href: '/admin/limits'
        },
        {
          label: 'Capacity Overview',
          href: '/admin/capacity'
        }
      ]
    },
    {
      label: 'Platform Settings',
      href: '/admin/settings',
      icon: NavigationHelpers.getStandardIcon('SETTINGS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_SETTINGS,
      children: [
        {
          label: 'General Settings',
          href: '/admin/settings'
        },
        {
          label: 'Feature Flags',
          href: '/admin/features'
        },
        {
          label: 'Integrations',
          href: '/admin/integrations'
        }
      ]
    },
    {
      label: 'Insights & Analytics',
      href: '/insights',
      icon: NavigationHelpers.getStandardIcon('ANALYTICS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_INSIGHTS,
      children: [
        {
          label: 'Analytics Dashboard',
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
  ]);

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
  const platformNavItems: NavItem[] = NavigationHelpers.sortByHierarchy([
    {
      label: 'Platform Dashboard',
      href: '/',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_DASHBOARD'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_DASHBOARD,
      children: [
        {
          label: 'Overview',
          href: '/'
        },
        {
          label: 'Admin Controls',
          href: '/admin',
          accessLevel: 'admin',
          children: [
            {
              label: 'User Management',
              href: '/admin/users'
            },
            {
              label: 'Tenant Management',
              href: '/admin/tenants'
            },
            {
              label: 'System Settings',
              href: '/admin/system'
            },
            {
              label: 'Feature Flags',
              href: '/admin/features'
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
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
      badge: {
        text: '12',
        variant: 'default'
      }
    },
    {
      label: 'Directory',
      href: '/directory',
      icon: NavigationHelpers.getStandardIcon('ANALYTICS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: NavigationHelpers.getStandardIcon('SETTINGS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.ADVANCED_FEATURES,
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
  ]);

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
