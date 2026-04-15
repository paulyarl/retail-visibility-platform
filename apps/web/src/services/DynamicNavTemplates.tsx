import React from 'react';
import { NavLink, NavTemplateParser } from './NavigationLinksService';

// Tenant interface for dynamic templates
export interface Tenant {
  id: string;
  name: string;
  role: string;
  organizationId?: string;
  organizationName?: string;
}

// Icon names for dynamic templates (as strings to match NavLink interface)
export const DynamicNavIconNames = {
  Dashboard: 'dashboard',
  Users: 'users',
  Inventory: 'inventory',
  Orders: 'orders',
  Google: 'google',
  Settings: 'settings',
  Store: 'store',
  Integrations: 'integrations',
} as const;

// Shared dynamic template processor
export class DynamicNavTemplates {
  /**
   * Process dynamic templates for navigation links
   */
  static processDynamicTemplates(items: NavLink[], tenants: Tenant[]): NavLink[] {
    return items.map(item => {
      // Handle tenant-locations dynamic template (My Locations)
      if (item.metadata?.dynamicTemplate === 'tenant-locations') {
        return this.processTenantLocationsTemplate(item, tenants);
      }
      
      // Handle organization-locations dynamic template (My Organizations)
      if (item.metadata?.dynamicTemplate === 'organization-locations') {
        return this.processOrganizationLocationsTemplate(item, tenants);
      }

      return item;
    }).filter(Boolean) as NavLink[];
  }

  /**
   * Process tenant-locations template (My Locations)
   */
  private static processTenantLocationsTemplate(item: NavLink, tenants: Tenant[]): NavLink | null {
    // Show ALL tenants (both with and without organization IDs)
    const allTenants = tenants;
    
    if (allTenants.length === 0) {
      return null;
    }

    return {
      ...item,
      children: allTenants.map(tenant => ({
        ...item,
        id: `${item.id}-${tenant.id}`,
        label: tenant.name,
        href: `/t/${tenant.id}/dashboard`,
        metadata: {
          ...item.metadata,
          parentKey: item.id,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 1,
          hasChildren: true,
          childrenKeys: [
            `${item.id}-${tenant.id}-dashboard`,
            `${item.id}-${tenant.id}-profile`,
            `${item.id}-${tenant.id}-inventory`,
            `${item.id}-${tenant.id}-orders`,
            `${item.id}-${tenant.id}-google`,
            `${item.id}-${tenant.id}-settings`
          ],
        },
        children: this.createTenantLocationChildren(item, tenant),
      })),
    };
  }

  /**
   * Process organization-locations template (My Organizations)
   */
  private static processOrganizationLocationsTemplate(item: NavLink, tenants: Tenant[]): NavLink | null {
    const tenantsWithOrgs = tenants.filter(t => t.organizationId);
    
    if (tenantsWithOrgs.length === 0) {
      return null;
    }

    // Group tenants by organizationId
    const orgGroups = tenantsWithOrgs.reduce((groups, tenant) => {
      const orgId = tenant.organizationId!;
      
      if (!groups[orgId]) {
        groups[orgId] = {
          id: orgId,
          name: `Organization ${orgId}`,
          tenants: [],
        };
      }
      groups[orgId].tenants.push(tenant);
      return groups;
    }, {} as Record<string, { id: string; name: string; tenants: Tenant[] }>);
    
    const organizationLinks = Object.values(orgGroups).map(org => ({
      ...item,
      id: `${item.id}-${org.id}`,
      label: org.name,
      href: `/t/${org.tenants[0].id}/dashboard`,
      metadata: {
        ...item.metadata,
        parentKey: item.id,
        nestingLevel: (item.metadata?.nestingLevel || 0) + 1,
        hasChildren: true,
        childrenKeys: org.tenants.map(tenant => `${item.id}-${org.id}-${tenant.id}`),
      },
      children: org.tenants.map(tenant => ({
        ...item,
        id: `${item.id}-${org.id}-${tenant.id}`,
        label: `${tenant.name} (${tenant.role})`,
        href: `/t/${tenant.id}/dashboard`,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${org.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: true,
          childrenKeys: [
            `${item.id}-${org.id}-${tenant.id}-dashboard`,
            `${item.id}-${org.id}-${tenant.id}-org-dashboard`,
            `${item.id}-${org.id}-${tenant.id}-settings`,
            `${item.id}-${org.id}-${tenant.id}-propagation`
          ],
        },
        children: this.createOrganizationChildren(item, org.id, tenant),
      })),
    }));

    return {
      ...item,
      children: organizationLinks,
    };
  }

  /**
   * Create children for tenant locations (My Locations)
   */
  private static createTenantLocationChildren(item: NavLink, tenant: Tenant): NavLink[] {
    return [
      {
        ...item,
        id: `${item.id}-${tenant.id}-dashboard`,
        label: 'Dashboard',
        href: `/t/${tenant.id}/dashboard`,
        icon: DynamicNavIconNames.Dashboard,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${tenant.id}-profile`,
        label: 'Profile',
        href: `/t/${tenant.id}/settings/tenant`,
        icon: DynamicNavIconNames.Users,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${tenant.id}-inventory`,
        label: 'Inventory',
        href: `/t/${tenant.id}/items`,
        icon: DynamicNavIconNames.Inventory,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${tenant.id}-orders`,
        label: 'Orders',
        href: `/t/${tenant.id}/orders`,
        icon: DynamicNavIconNames.Orders,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${tenant.id}-google`,
        label: 'Google',
        href: `/t/${tenant.id}/settings/integrations/google`,
        icon: DynamicNavIconNames.Google,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${tenant.id}-settings`,
        label: 'Settings',
        href: `/t/${tenant.id}/settings`,
        icon: DynamicNavIconNames.Settings,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 2,
          hasChildren: false,
          childrenKeys: [],
        },
      },
    ].map(child => ({
      id: child.id,
      label: child.label,
      href: child.href,
      icon: child.icon,
      badge: '',
      badgeVariant: 'default' as const,
      targets: ['tenant'],
      order: 0,
      enabled: true,
      dividerBefore: false,
      requiredPermission: '',
      requiredGroup: '',
      requiredRole: '',
      prefetch: true,
      metadata: child.metadata,
    }));
  }

  /**
   * Create children for organization locations (My Organizations)
   */
  private static createOrganizationChildren(item: NavLink, orgId: string, tenant: Tenant): NavLink[] {
    return [
      {
        ...item,
        id: `${item.id}-${orgId}-${tenant.id}-dashboard`,
        label: 'Dashboard',
        href: `/t/${tenant.id}/dashboard`,
        icon: DynamicNavIconNames.Dashboard,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${orgId}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 3,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${orgId}-${tenant.id}-org-dashboard`,
        label: 'Organization Dashboard',
        href: `/t/${tenant.id}/settings/organization`,
        icon: DynamicNavIconNames.Store,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${orgId}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 3,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${orgId}-${tenant.id}-settings`,
        label: 'Propagation Settings',
        href: `/t/${tenant.id}/settings/propagation`,
        icon: DynamicNavIconNames.Settings,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${orgId}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 3,
          hasChildren: false,
          childrenKeys: [],
        },
      },
      {
        ...item,
        id: `${item.id}-${orgId}-${tenant.id}-propagation`,
        label: 'Propagation Center',
        href: `/t/${tenant.id}/propagation`,
        icon: DynamicNavIconNames.Integrations,
        metadata: {
          ...item.metadata,
          parentKey: `${item.id}-${orgId}-${tenant.id}`,
          nestingLevel: (item.metadata?.nestingLevel || 0) + 3,
          hasChildren: false,
          childrenKeys: [],
        },
      },
    ].map(child => ({
      id: child.id,
      label: child.label,
      href: child.href,
      icon: child.icon,
      badge: '',
      badgeVariant: 'default' as const,
      targets: ['tenant'],
      order: 0,
      enabled: true,
      dividerBefore: false,
      requiredPermission: '',
      requiredGroup: '',
      requiredRole: '',
      prefetch: true,
      metadata: child.metadata,
    }));
  }
}
