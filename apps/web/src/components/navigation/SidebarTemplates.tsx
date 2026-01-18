'use client';

import React, { useState, useEffect } from 'react';
import GeneralSidebar from '../GeneralSidebar';
import NavigationStandards from '@/lib/navigation/NavigationStandards';
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
  hierarchy?: number
}

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
      label: 'Orders',
      href: '/t/[tenantId]/orders',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_INSIGHTS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
    },
    {
      label: 'Categories',
      href: '/t/[tenantId]/categories',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_INSIGHTS'),
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
      icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
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
          label: 'Fulfillment',
          href: '/t/[tenantId]/settings/fulfillment'
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
      href: '/settings/admin',
      icon: NavigationHelpers.getStandardIcon('ADMIN'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_ADMIN,
    },
    {
      label: 'User Management',
      href: '/settings/admin/users',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_USERS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_USERS,
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
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_USERS,
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
      label: 'Platform Settings',
      href: '/settings/admin/settings',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.PLATFORM_SETTINGS,
      children: [
        {
          label: 'General Settings',
          href: '/settings/admin/settings'
        },
        {
          label: 'Feature Flags',
          href: '/settings/admin/features'
        },
        {
          label: 'Integrations',
          href: '/settings/admin/integrations'
        }
      ]
    },
    {
      label: 'Insights & Analytics',
      href: '/insights',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_INSIGHTS'),
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
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch tenants for dynamic sidebar
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch('/api/tenants');
        if (response.ok) {
          const data = await response.json();
          setTenants(data.tenants || data || []);
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTenants();
  }, []);

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
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
      badge: {
        text: loading ? '...' : String(tenants.length),
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
        },
        ...(tenants.length > 0 ? [
          { label: '─', href: '#' }, // Separator
          ...tenants.map((tenant: any) => ({
            label: tenant.name || 'Unknown Tenant',
            href: `/tenants/${tenant.id}`,
            badge: tenant.locationStatus ? {
              text: tenant.locationStatus,
              variant: tenant.locationStatus === 'active' ? 'success' : 
                      tenant.locationStatus === 'pending' ? 'warning' : 'default'
            } : undefined
          }))
        ] : [])
      ]
    },
    {
      label: 'Directory',
      href: '/directory',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_INSIGHTS'),
      hierarchy: NavigationStandards.GROUP_HIERARCHY.BUSINESS_OPERATIONS,
    },
    {
      label: 'Settings',
      href: '/settings',
      icon: NavigationHelpers.getStandardIcon('PLATFORM_SETTINGS'),
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
