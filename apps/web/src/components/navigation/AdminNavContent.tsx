"use client";

import { ReactNode, useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRBAC, RBACNavGates } from '@/lib/auth/useRBAC';
import { cn } from '@/lib/utils';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { tenantInfoService } from '@/services/TenantInfoService';
import { DynamicNavTemplates } from '@/services/DynamicNavTemplates';
import { getIconComponent } from './NavItemRow';
import { type NavLink, type DynamicTemplate } from '@/services/NavigationLinksService';
import { type ProcessedNavLink } from '@/hooks/useNavLinks';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = RBACNavGates & {
  id?: string;
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'new';
  prefetch?: boolean;
  children?: NavItem[];
  dividerBefore?: boolean;
  metadata?: {
    dynamicTemplate?: DynamicTemplate;
    nestingLevel: number;
    parentKey?: string;
    hasChildren: boolean;
    childrenKeys: string[];
  };
};

interface AdminNavContentProps {
  children: ReactNode;
  /** Optional injected links from the Navigation Control Panel */
  injectedItems?: ProcessedNavLink[];
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Building: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Chart: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Cog: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Navigation: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
    </svg>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg className={cn('w-4 h-4 transition-transform duration-200', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  X: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Admin: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  // Role-based icons for tenant navigation
  Crown: () => (
    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.86-2h8.28l.96-5.88-3.96 3.68L12 8.12l-1.14 3.68-3.96-3.68.96 5.88z"/>
    </svg>
  ),
  ShieldRole: () => (
    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Star: () => (
    <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  UsersRole: () => (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Briefcase: () => (
    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Eye: () => (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ─── Nav definition (only real pages) ────────────────────────────────────────

const buildAdminNavItems = (): NavItem[] => [
  {
    label: 'Admin Dashboard',
    href: '/settings/admin',
    icon: <Icon.Dashboard />,
    prefetch: false,
  },
  {
    label: 'Users',
    icon: <Icon.Users />,
    href: '/settings/admin/users',
    prefetch: false,
    children: [
      { label: 'All Users',         href: '/settings/admin/users' },
      { label: 'Deletion Requests', href: '/settings/admin/deletion-requests' },
    ],
  },
  {
    label: 'Tenants',
    icon: <Icon.Building />,
    href: '/settings/admin/tenants',
    prefetch: false,
    children: [
      { label: 'All Tenants',       href: '/settings/admin/tenants' },
      { label: 'Tenant Limits',    href: '/settings/admin/limits' },
    ],
  },
  {
    label: 'Capacity',
    icon: <Icon.Chart />,
    href: '/settings/admin/capacity/overview',
    prefetch: false,
    children: [
      { label: 'Overview',         href: '/settings/admin/capacity/overview' },
      { label: 'Location Limits', href: '/settings/admin/capacity/location-limits' },
      { label: 'Alerts',          href: '/settings/admin/capacity/alerts' },
    ],
  },
  {
    label: 'Quick Start',
    icon: <Icon.Star />,
    prefetch: false,
    children: [
      { label: 'Seed Categories', href: '/settings/admin/quick-start/categories' },
      { label: 'Seed Products',   href: '/settings/admin/quick-start/products' },
    ],
  },
  {
    label: 'Subscriptions',
    icon: <Icon.Chart />,
    href: '/settings/admin/tier-system',
    prefetch: false,
    children: [
      { label: 'Tier Management',  href: '/settings/admin/tier-system' },
      { label: 'Subscription Mgmt', href: '/settings/admin/tiers' },
      { label: 'Billing Mgmt',      href: '/settings/admin/billing' },
      { label: 'Email Logs',        href: '/settings/admin/notification-logs' },
    ],
  },
  {
    label: 'Catalog',
    icon: <Icon.Cog />,
    href: '/settings/admin/categories',
    prefetch: false,
    children: [
      { label: 'Categories Quick Start',  href: '/settings/admin/quick-start/categories' },
      { label: 'Product Categories',  href: '/settings/admin/categories' },
      { label: 'Platform Categories', href: '/settings/admin/platform-categories' },
      { label: 'Enrichment',          href: '/settings/admin/enrichment' },
    ],
  },
  {
    label: 'Directory',
    icon: <Icon.Globe />,
    href: '/settings/admin/directory/listings',
    prefetch: false,
    children: [
      { label: 'Listings',          href: '/settings/admin/directory/listings' },
      { label: 'Featured',          href: '/settings/admin/directory/featured' },
      { label: 'Featured Products', href: '/settings/admin/featured-products' },
    ],
  },
  {
    label: 'Content',
    icon: <Icon.Navigation />,
    href: '/settings/admin/reviews',
    prefetch: false,
    children: [
      { label: 'Reviews',   href: '/settings/admin/reviews' },
      { label: 'Analytics', href: '/settings/admin/analytics' },
    ],
  },
  {
    label: 'Security & Platform',
    icon: <Icon.Shield />,
    href: '/settings/admin/security',
    prefetch: false,
    children: [
      { label: 'Security',          href: '/settings/admin/security' },
      { label: 'Platform Settings', href: '/settings/admin/platform' },
      { label: 'Sentry',          href: '/settings/admin/sentry' },
      { label: 'Feature Overrides', href: '/settings/admin/feature-overrides' },
      { label: 'Subdomain Mgmt',    href: '/settings/admin/subdomain' },
      { label: 'Ticker',            href: '/settings/admin/ticker' },
    ],
  },
  {
    label: 'Analytics',
    icon: <Icon.Chart />,
    href: '/settings/admin/scan-metrics',
    prefetch: false,
    children: [
      { label: 'Scan Metrics', href: '/settings/admin/scan-metrics' },
    ],
  },
  {
    label: 'Navigation Control',
    href: '/settings/admin/navigation',
    icon: <Icon.Navigation />,
    badge: 'Admin',
    badgeVariant: 'warning',
    dividerBefore: true,
    prefetch: false,
  },
  {
    label: 'Account Settings',
    href: '/settings',
    icon: <Icon.Admin />,
    dividerBefore: true,
    prefetch: false,
  },
];

// ─── Auto-expand helper ───────────────────────────────────────────────────────

function computeExpanded(items: NavItem[], pathname: string): Set<string> {
  const result = new Set<string>();
  const walk = (nodes: NavItem[]) => {
    for (const node of nodes) {
      const key = node.href ?? node.label;
      if (node.children) {
        const hasActive = node.children.some(
          c => c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))
        );
        if (hasActive) result.add(key);
        walk(node.children);
      }
    }
  };
  walk(items);
  return result;
}

// ─── Page title from pathname ─────────────────────────────────────────────────

function pageTitleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'Admin';
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function NavBadge({ text, variant = 'default' }: { text: string; variant?: NavItem['badgeVariant'] }) {
  const colors: Record<string, string> = {
    default: 'bg-neutral-100 text-neutral-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error:   'bg-red-100 text-red-700',
    new:     'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', colors[variant ?? 'default'])}>
      {text}
    </span>
  );
}

// ─── Single nav item row ──────────────────────────────────────────────────────

function NavItemRow({
  item,
  level = 0,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: NavItem;
  level?: number;
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onNavigate: () => void;
}) {
  // Use id as primary key to avoid collision between items with same href
  const key = item.id ?? item.href ?? item.label;
  const hasChildren = !!(item.children?.length);
  const isExpanded = expanded.has(key);
  const isActive = item.href
    ? pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
    : false;
  const isParentActive = hasChildren && item.children!.some(
    c => c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))
  );

  const paddingLeft = 16 + level * 14;

  const sharedClass = cn(
    'group flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
    isActive || isParentActive
      ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
  );

  const iconClass = cn(
    'flex-shrink-0',
    isActive || isParentActive
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200'
  );

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => onToggle(key)}
          className={sharedClass}
          style={{ paddingLeft, paddingRight: 12 }}
          aria-expanded={isExpanded}
        >
          {item.icon && <span className={iconClass}>{typeof item.icon === 'string' ? getIconComponent(item.icon) : item.icon}</span>}
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && <NavBadge text={item.badge} variant={item.badgeVariant} />}
          <Icon.ChevronRight className={isExpanded ? 'rotate-90 text-neutral-500' : 'text-neutral-400'} />
        </button>
        {isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map((child, index) => (
              <NavItemRow
                key={child.id ?? `${item.id ?? item.label}-${index}-${child.href ?? child.label}`}
                item={child}
                level={level + 1}
                pathname={pathname}
                expanded={expanded}
                onToggle={onToggle}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      onClick={onNavigate}
      className={sharedClass}
      style={{ paddingLeft, paddingRight: 12 }}
      prefetch={item.prefetch ?? false}
    >
      {item.icon && <span className={iconClass}>{typeof item.icon === 'string' ? getIconComponent(item.icon) : item.icon}</span>}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <NavBadge text={item.badge} variant={item.badgeVariant} />}
    </Link>
  );
}

// ─── Sidebar content (shared between desktop + mobile drawer) ─────────────────

function SidebarContent({
  items,
  pathname,
  expanded,
  onToggle,
  onNavigate,
  user,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onNavigate: () => void;
  user: { email: string; firstName?: string; lastName?: string; role: string } | null;
  collapsed?: boolean;
}) {
  const displayName = user
    ? user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email
    : '';

  return (
    <div className="flex flex-col h-full">
      {/* Admin identity strip */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-4 border-b border-amber-100 dark:border-neutral-800',
        collapsed && 'justify-center px-2'
      )}>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold">
            {displayName.charAt(0).toUpperCase() || 'A'}
          </span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{displayName}</p>
            <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 truncate">{user?.role}</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map(item => (
          <div key={item.id ?? item.label}>
            {item.dividerBefore && (
              <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />
            )}
            {collapsed ? (
              item.icon ? (
                <Link
                  href={item.href ?? (item.children?.[0]?.href ?? '#')}
                  onClick={onNavigate}
                  title={item.label}
                  prefetch={item.prefetch ?? false}
                  className={cn(
                    'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors',
                    item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
                  )}
                >
                  {item.icon}
                </Link>
              ) : null
            ) : (
              <NavItemRow
                item={item}
                pathname={pathname}
                expanded={expanded}
                onToggle={onToggle}
                onNavigate={onNavigate}
              />
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-neutral-100 dark:border-neutral-800">
          <p className="text-xs text-neutral-400">Platform Administration</p>
        </div>
      )}
    </div>
  );
}

// ─── Mobile drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  items,
  pathname,
  expanded,
  onToggle,
  user,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  user: { email: string; firstName?: string; lastName?: string; role: string } | null;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />
      {/* Slide-in panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-neutral-900 shadow-2xl',
          'flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-amber-100 dark:border-neutral-800 bg-amber-50 dark:bg-amber-900/20">
          <span className="text-base font-semibold text-amber-900 dark:text-amber-200">Admin Panel</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close navigation"
          >
            <Icon.X />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent
            items={items}
            pathname={pathname}
            expanded={expanded}
            onToggle={onToggle}
            onNavigate={onClose}
            user={user}
          />
        </div>
      </div>
    </>
  );
}

// ─── Mobile top bar ───────────────────────────────────────────────────────────

function MobileTopBar({ onOpen, title }: { onOpen: () => void; title: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-amber-50 dark:bg-neutral-900 border-b border-amber-200 dark:border-neutral-800 md:hidden">
      <button
        onClick={onOpen}
        className="p-2 -ml-2 rounded-lg hover:bg-amber-100 dark:hover:bg-neutral-800 transition-colors"
        aria-label="Open admin navigation"
      >
        <Icon.Menu />
      </button>
      <span className="font-semibold text-amber-900 dark:text-amber-200 text-sm truncate">{title}</span>
      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200">
        Admin
      </span>
    </div>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({
  items,
  pathname,
  expanded,
  onToggle,
  user,
}: {
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  user: { email: string; firstName?: string; lastName?: string; role: string } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col flex-shrink-0',
        'bg-white dark:bg-neutral-900',
        'border-r border-amber-100 dark:border-neutral-800',
        'transition-all duration-300 ease-in-out relative h-full',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(prev => !prev)}
        className={cn(
          'absolute -right-3 top-6 z-10 w-6 h-6 rounded-full',
          'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700',
          'flex items-center justify-center shadow-sm',
          'hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors'
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          className={cn('w-3 h-3 text-neutral-500 transition-transform duration-300', collapsed ? 'rotate-180' : '')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Header */}
      <div className={cn(
        'px-4 py-4 border-b border-amber-100 dark:border-neutral-800 bg-amber-50 dark:bg-amber-900/20',
        collapsed && 'px-2'
      )}>
        {collapsed ? (
          <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500 flex items-center justify-center">
            <Icon.Cog />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 tracking-tight">Admin Panel</h2>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200 leading-none">
              Platform
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <SidebarContent
          items={items}
          pathname={pathname}
          expanded={expanded}
          onToggle={onToggle}
          onNavigate={() => {}}
          user={user}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function AdminNavContent({ children, injectedItems = [] }: AdminNavContentProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { filterNavItems } = useRBAC();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Role icon mapping for dynamic templates
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Icon.Crown />;
      case 'ADMIN':
        return <Icon.ShieldRole />;
      case 'SUPPORT':
        return <Icon.Star />;
      case 'MANAGER':
        return <Icon.Briefcase />;
      case 'MEMBER':
        return <Icon.UsersRole />;
      case 'VIEWER':
        return <Icon.Eye />;
      default:
        return null;
    }
  };

  // Process dynamic templates in injected items using shared service
  const processDynamicTemplates = async (items: ProcessedNavLink[], user: any): Promise<NavItem[]> => {
    // Get real tenant data from SecuritySingletonService
    let tenants: { id: string; name: string; role: string; organizationId?: string; organizationName?: string }[] = [];
    if (user) {
      try {
        const sessionInfo = await securitySingletonService.getSessionInfo();
        tenants = sessionInfo.user?.tenants || [];
      } catch (error) {
        console.error('[AdminNavContent] Error fetching tenant data:', error);
        // Fallback to user.tenants if available
        tenants = user.tenants || [];
      }
    }

    // Use the shared DynamicNavTemplates service
    const processedLinks = DynamicNavTemplates.processDynamicTemplates(items as NavLink[], tenants);
    
    return processedLinks;
  };

  // Database-first approach: use injected items if available, fallback to hardcoded
  // console.log('AdminNavContent - injectedItems:', injectedItems);
  // console.log('AdminNavContent - injectedItems.length:', injectedItems.length);
  const [rawItems, setRawItems] = useState<NavItem[]>([]);
  const [items, setItems] = useState<NavItem[]>([]);

  // Process navigation items when dependencies change
  useEffect(() => {
    const processItems = async () => {
      let processedItems: NavItem[] = [];
      
      if (injectedItems.length > 0) {
        processedItems = await processDynamicTemplates(injectedItems, user);
      } else {
        processedItems = buildAdminNavItems();
      }
      
      const filteredItems = filterNavItems(processedItems);
      setRawItems(processedItems);
      setItems(filteredItems);
    };

    processItems();
  }, [injectedItems, user]);
  // console.log('AdminNavContent - rawItems:', rawItems);

  const [expanded, setExpanded] = useState<Set<string>>(() =>
    computeExpanded(items, pathname)
  );

  useEffect(() => {
    setExpanded(computeExpanded(items, pathname));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const pageTitle = pageTitleFromPath(pathname);

  const userForSidebar = user
    ? { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
    : null;

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Desktop sidebar */}
      <DesktopSidebar
        items={items}
        pathname={pathname}
        expanded={expanded}
        onToggle={toggleExpanded}
        user={userForSidebar}
      />

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        pathname={pathname}
        expanded={expanded}
        onToggle={toggleExpanded}
        user={userForSidebar}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <MobileTopBar onOpen={() => setDrawerOpen(true)} title={pageTitle} />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AdminNavContent;
