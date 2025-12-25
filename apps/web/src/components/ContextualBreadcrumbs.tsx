"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavigationStandards, { NavigationHelpers } from '@/lib/navigation/NavigationStandards';


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export interface ContextualBreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  scope?: 'platform' | 'tenant' | 'admin';
}

interface ContextualBreadcrumbsProps {
  customItems?: ContextualBreadcrumbItem[];
  showHome?: boolean;
  className?: string;
  tenantId?: string;
}


export function ContextualBreadcrumbs({
  customItems,
  showHome = true,
  className = '',
  tenantId
}: ContextualBreadcrumbsProps) {
  const pathname = usePathname();

  // Use custom items if provided, otherwise auto-generate
  const breadcrumbItems = customItems || generateContextualBreadcrumbs(pathname, tenantId);

  if (breadcrumbItems.length === 0) return null;

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className}`} aria-label="Breadcrumb">
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && (
            <svg
              className="h-4 w-4 mx-2 text-neutral-400 dark:text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}

          {item.href ? (
            <Link
              href={item.href}
              className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-2 text-neutral-900 dark:text-white font-medium">
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Generate contextual breadcrumbs based on navigation standards
function generateContextualBreadcrumbs(pathname: string, tenantId?: string): ContextualBreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs: ContextualBreadcrumbItem[] = [];

  // Add home/dashboard based on context
  if (segments.length > 0) {
    const firstSegment = segments[0];

    if (firstSegment === 't' && segments[1]) {
      // Tenant context
      breadcrumbs.push({
        label: 'Dashboard',
        href: `/t/${segments[1]}`,
        icon: NavigationHelpers.getStandardIcon('ANALYTICS'),
        scope: 'tenant'
      });
    } else if (firstSegment === 'settings' && segments[1] === 'admin') {
      // Admin context
      breadcrumbs.push({
        label: 'Admin',
        href: '/settings/admin',
        icon: NavigationHelpers.getStandardIcon('SETTINGS'),
        scope: 'admin'
      });
    } else if (firstSegment === 'settings') {
      // Platform settings context
      breadcrumbs.push({
        label: 'Settings',
        href: '/settings',
        icon: NavigationHelpers.getStandardIcon('SETTINGS'),
        scope: 'platform'
      });
    } else {
      // Platform dashboard
      breadcrumbs.push({
        label: 'Dashboard',
        href: '/',
        icon: NavigationHelpers.getStandardIcon('ANALYTICS'),
        scope: 'platform'
      });
    }
  }

  // Process remaining segments with contextual labels
  let currentPath = '';
  let isInTenantContext = false;
  let tenantSlug = '';

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;

    // Detect tenant context
    if (segment === 't' && segments[index + 1]) {
      isInTenantContext = true;
      tenantSlug = segments[index + 1];
      return; // Skip the 't' segment
    }

    if (isInTenantContext && segment === tenantSlug) {
      return; // Skip tenant ID segment
    }

    // Apply contextual labels based on NavigationStandards
    let label = getContextualLabel(segment, currentPath, isInTenantContext);
    let icon = getContextualIcon(segment, currentPath);

    // Don't add href for last item (current page)
    breadcrumbs.push({
      label,
      href: isLast ? undefined : currentPath,
      icon: icon,
      scope: isInTenantContext ? 'tenant' : getScopeFromPath(currentPath)
    });
  });

  return breadcrumbs;
}

// Get contextual label for segment
function getContextualLabel(segment: string, fullPath: string, isTenantContext: boolean): string {
  // Standard mappings aligned with new navigation structure
  const standardLabels: Record<string, string> = {
    // Dashboard/Onboarding
    'dashboard': 'Dashboard',
    'onboarding': 'Onboarding',

    // User Panel
    'account': 'Account',
    'teams': 'Teams',
    'store-team': 'Store Team',
    'platform-team': 'Platform Team',
    'store-owner': 'Store Owner',
    'store-member': 'Store Member',
    'store-admin': 'Store Admin',
    'platform-support': 'Platform Support',
    'platform-viewer': 'Platform Viewer',

    // Store Center
    'store': 'Store Center',
    'profile': 'Store Profile',
    'sync': 'Store Sync',
    'settings': 'Store Settings',
    'platforms': 'Platform Centers',
    'organization': 'Organization',
    'subscription': 'Subscription',

    // Inventory Center
    'inventory': 'Inventory Center',
    'items': 'Items',
    'scanner': 'Barcode Scanner',
    'quick-start': 'Quick Start',

    // Platform Dashboard
    'admin': 'Admin Controls',
    'insights': 'Insights',
    'analytics': 'Analytics',
    'reports': 'Reports',
    'performance': 'Performance',
    'users': 'User Management',
    'tenants': 'Tenant Management',
    'limits': 'Tenant Limits',
    'capacity': 'Capacity Overview',
    'features': 'Feature Flags',
    'integrations': 'Integrations',

    // Legacy mappings (keeping for backward compatibility)
    'products': 'Products',
    'categories': 'Categories',
    'appearance': 'Appearance',
    'language': 'Language',
    'branding': 'Branding',
    'business': 'Business Profile',
    'contact': 'Contact',
    'help': 'Help',
    'support': 'Support',
    'billing': 'Billing',
    'permissions': 'Permissions',
    'system': 'System',
    'directory': 'Directory',
    'storefront': 'Storefront',
    'trash': 'Trash',
    'location-status': 'Location Status',
    'subdomain': 'Custom Domain',
    'promotion': 'Promotion',
    'propagation': 'Propagation',
    'hours': 'Business Hours',
    'gbp-category': 'Business Category',
    'feed-validation': 'Feed Validation',
    'scan-metrics': 'Scan Metrics',
    'feature-overrides': 'Feature Overrides',
    'platform-flags': 'Feature Flags',
    'tier-matrix': 'Tier Matrix',
    'tier-management': 'Tier Management',
    'tier-system': 'Tier System',
    'upgrade-requests': 'Upgrade Requests',
    'organization-requests': 'Organization Requests',
    'emails': 'Email Settings',
    'features-showcase': 'Feature Showcase',
    'gbp-sync': 'GBP Sync'
  };

  // Check for exact match
  if (standardLabels[segment]) {
    return standardLabels[segment];
  }

  // Handle dynamic segments (like [tenantId])
  if (segment.match(/^[a-f0-9]{8,}$/)) {
    return isTenantContext ? 'Store' : segment;
  }

  // Default formatting
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Get contextual icon for segment
function getContextualIcon(segment: string, fullPath: string): React.ReactNode | undefined {
  const iconMappings: Record<string, keyof typeof NavigationStandards.ICONS> = {
    // Dashboard/Onboarding
    'dashboard': 'DASHBOARD',
    'onboarding': 'HELP',

    // User Panel
    'account': 'ACCOUNT',
    'teams': 'TEAM',
    'store-team': 'STORE',
    'platform-team': 'PLATFORM_DASHBOARD',
    'store-owner': 'USER',
    'store-member': 'USER',
    'store-admin': 'ADMIN',
    'platform-support': 'HELP',
    'platform-viewer': 'USER',

    // Store Center
    'store': 'STORE_CENTER',
    'profile': 'STORE_PROFILE',
    'sync': 'STORE_SYNC',
    'settings': 'STORE_SETTINGS',
    'platforms': 'STORE_PLATFORM',
    'organization': 'STORE_ORGANIZATION',
    'subscription': 'STORE_SUBSCRIPTION',

    // Inventory Center
    'inventory': 'INVENTORY_CENTER',
    'items': 'STORE',
    'scanner': 'INVENTORY_SCANNER',
    'quick-start': 'HELP',

    // Platform Dashboard
    'admin': 'ADMIN',
    'insights': 'PLATFORM_INSIGHTS',
    'analytics': 'ANALYTICS',
    'reports': 'ANALYTICS',
    'performance': 'ANALYTICS',
    'users': 'PLATFORM_USERS',
    'tenants': 'STORE',
    'limits': 'SETTINGS',
    'capacity': 'ANALYTICS',
    'features': 'PLATFORM_FEATURES',
    'integrations': 'PLATFORM_INTEGRATIONS',

    // Legacy mappings (keeping for backward compatibility)
    'products': 'STORE',
    'categories': 'ANALYTICS',
    'appearance': 'APPEARANCE',
    'language': 'SETTINGS',
    'branding': 'SETTINGS',
    'business': 'STORE',
    'contact': 'HELP',
    'help': 'HELP',
    'billing': 'SUBSCRIPTION',
    'permissions': 'SETTINGS',
    'system': 'SETTINGS',
    'directory': 'ANALYTICS',
    'storefront': 'STORE',
    'trash': 'SETTINGS'
  };

  const iconKey = iconMappings[segment];
  return iconKey ? NavigationHelpers.getStandardIcon(iconKey) : undefined;
}

// Determine scope from path
function getScopeFromPath(path: string): 'platform' | 'tenant' | 'admin' {
  if (path.includes('/settings/admin')) return 'admin';
  if (path.includes('/t/')) return 'tenant';
  return 'platform';
}


export default ContextualBreadcrumbs;
