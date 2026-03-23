"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { directoryService } from '@/services/DirectorySingletonService';
import { useRBAC, RBACNavGates } from '@/lib/auth/useRBAC';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = RBACNavGates & {
  label: string;
  href?: string;
  icon?: ReactNode;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'new';
  children?: NavItem[];
  dividerBefore?: boolean;
};

interface DynamicTenantSidebarProps {
  tenantId: string;
  slug?: string;
  children: ReactNode;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const Icon = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Inventory: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Orders: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  Directory: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Integrations: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Store: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Google: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  Star: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  Platform: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg className={cn('w-4 h-4 transition-transform duration-200', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  X: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ─── Nav builder ─────────────────────────────────────────────────────────────

function buildTenantNav(
  tenantId: string,
  slug: string | undefined,
  directorySlug: string | undefined,
  isPublished: boolean,
): NavItem[] {
  return [
    {
      label: 'Dashboard',
      href: `/t/${tenantId}/dashboard`,
      icon: <Icon.Dashboard />,
    },
    {
      label: 'Inventory',
      href: `/t/${tenantId}/items`,
      icon: <Icon.Inventory />,
      children: [
        { label: 'Product Manager', href: `/t/${tenantId}/items` },
        { label: 'Add Product', href: `/t/${tenantId}/items/create` },
        { label: 'Barcode Scan', href: `/t/${tenantId}/scan` },
        { label: 'Quick Start', href: `/t/${tenantId}/quick-start` },
        { label: 'Categories', href: `/t/${tenantId}/categories` },
        { label: 'Featured Products', href: `/t/${tenantId}/settings/featured-products` },
      ],
    },
    {
      label: 'Orders',
      href: `/t/${tenantId}/orders`,
      icon: <Icon.Orders />,
      requiredGroup: 'IS_TENANT_MANAGER',
      children: [
        { label: 'Order Management', href: `/t/${tenantId}/orders` },
        { label: 'Payment Gateways', href: `/t/${tenantId}/settings/payment-gateways`, requiredPermission: 'CAN_MANAGE_TENANT_BILLING' },
        { label: 'Fulfillment Options', href: `/t/${tenantId}/settings/fulfillment`, requiredGroup: 'IS_TENANT_MANAGER' },
      ],
    },
    {
      label: 'Directory & Storefront',
      href: `/t/${tenantId}/settings/directory`,
      icon: <Icon.Directory />,
      children: [
        ...(isPublished && directorySlug
          ? [{ label: 'View in Directory', href: `/directory/${directorySlug}`, badge: 'Live', badgeVariant: 'success' as const }]
          : []),
        { label: 'Directory Settings', href: `/t/${tenantId}/settings/directory` },
        { label: 'Branding', href: `/t/${tenantId}/settings/branding` },
        { label: 'Store Hours', href: `/t/${tenantId}/settings/hours` },
        { label: 'Business Category', href: `/t/${tenantId}/settings/gbp-category` },
        ...(slug ? [{ label: 'My Storefront', href: `/shops/${slug}` }] : []),
      ],
    },
    {
      label: 'Integrations',
      href: `/t/${tenantId}/settings/integrations`,
      icon: <Icon.Integrations />,
      requiredGroup: 'IS_TENANT_ADMIN',
      children: [
        { label: 'Google Merchant Center', href: `/t/${tenantId}/settings/integrations/google` },
        { label: 'Feed Validation', href: `/t/${tenantId}/feed-validation` },
        { label: 'Clover POS', href: `/t/${tenantId}/settings/integrations/clover` },
        { label: 'Square POS', href: `/t/${tenantId}/settings/integrations/square` },
      ],
    },
    {
      label: 'Settings',
      href: `/t/${tenantId}/settings`,
      icon: <Icon.Settings />,
      requiredGroup: 'IS_TENANT_MANAGER',
      children: [
        { label: 'Store Profile', href: `/t/${tenantId}/settings/tenant`, requiredPermission: 'CAN_MANAGE_TENANT_SETTINGS' },
        { label: 'Reviews', href: `/t/${tenantId}/settings/reviews` },
        { label: 'Team Members', href: `/t/${tenantId}/settings/users`, requiredPermission: 'CAN_MANAGE_TENANT_USERS' },
        { label: 'Appearance', href: `/t/${tenantId}/settings/appearance` },
        { label: 'Language & Region', href: `/t/${tenantId}/settings/language` },
        { label: 'Subscription', href: `/t/${tenantId}/settings/subscription`, requiredPermission: 'CAN_MANAGE_TENANT_BILLING' },
        { label: 'Propagation', href: `/t/${tenantId}/settings/propagation`, requiredGroup: 'IS_TENANT_OWNER' },
      ],
    },
    {
      label: 'Platform',
      href: '/',
      icon: <Icon.Platform />,
      dividerBefore: true,
      children: [
        { label: 'Platform Home', href: '/' },
        { label: 'My Account', href: '/settings/account' },
        { label: 'Subscription', href: '/settings/subscription' },
        { label: 'Support', href: '/settings/contact' },
      ],
    },
  ];
}

// ─── Shared nav item helpers ──────────────────────────────────────────────────

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

function NavBadge({ text, variant = 'default' }: { text: string; variant?: NavItem['badgeVariant'] }) {
  const colors: Record<NonNullable<NavItem['badgeVariant']>, string> = {
    default: 'bg-neutral-100 text-neutral-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    new: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none', colors[variant ?? 'default'])}>
      {text}
    </span>
  );
}

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
  const key = item.href ?? item.label;
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
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
    isActive || isParentActive
      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
      : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
          {item.icon && (
            <span className={cn('flex-shrink-0', isActive || isParentActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200')}>
              {item.icon}
            </span>
          )}
          <span className="flex-1 text-left truncate">{item.label}</span>
          {item.badge && <NavBadge text={item.badge} variant={item.badgeVariant} />}
          <Icon.ChevronRight className={isExpanded ? 'rotate-90 text-neutral-500' : 'text-neutral-400'} />
        </button>
        {isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map(child => (
              <NavItemRow
                key={child.href ?? child.label}
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
    >
      {item.icon && (
        <span className={cn('flex-shrink-0', isActive ? 'text-primary-600 dark:text-primary-400' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-200')}>
          {item.icon}
        </span>
      )}
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && <NavBadge text={item.badge} variant={item.badgeVariant} />}
    </Link>
  );
}

// ─── Sidebar scroll content ───────────────────────────────────────────────────

function SidebarNav({
  items,
  pathname,
  expanded,
  onToggle,
  onNavigate,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onNavigate: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
      {items.map(item => (
        <div key={item.href ?? item.label}>
          {item.dividerBefore && (
            <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />
          )}
          {collapsed ? (
            item.icon ? (
              <Link
                href={item.href ?? (item.children?.[0]?.href ?? '#')}
                onClick={onNavigate}
                title={item.label}
                className={cn(
                  'flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-colors',
                  item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
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
  );
}

// ─── Mobile Drawer ────────────────────────────────────────────────────────────

function MobileDrawer({
  open,
  onClose,
  items,
  pathname,
  expanded,
  onToggle,
  tenantName,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  tenantName: string;
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
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[280px] bg-white dark:bg-neutral-900 shadow-2xl',
          'flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{tenantName}</span>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close navigation"
          >
            <Icon.X />
          </button>
        </div>
        <SidebarNav
          items={items}
          pathname={pathname}
          expanded={expanded}
          onToggle={onToggle}
          onNavigate={onClose}
        />
      </div>
    </>
  );
}

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({
  items,
  pathname,
  expanded,
  onToggle,
  tenantName,
}: {
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  tenantName: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col flex-shrink-0 bg-white dark:bg-neutral-900',
        'border-r border-neutral-200 dark:border-neutral-800',
        'transition-all duration-300 ease-in-out relative h-full',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
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

      <div className={cn('px-4 py-4 border-b border-neutral-100 dark:border-neutral-800 flex-shrink-0', collapsed && 'px-2')}>
        {collapsed ? (
          <div className="w-8 h-8 mx-auto rounded-lg bg-primary-600 flex items-center justify-center">
            <Icon.Store />
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white tracking-tight truncate">{tenantName}</h2>
        )}
      </div>

      <SidebarNav
        items={items}
        pathname={pathname}
        expanded={expanded}
        onToggle={onToggle}
        onNavigate={() => {}}
        collapsed={collapsed}
      />
    </aside>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <aside className="hidden md:flex flex-col w-[240px] flex-shrink-0 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800">
      <div className="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="h-4 w-28 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
      </div>
      <div className="p-3 space-y-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 bg-neutral-100 dark:bg-neutral-800 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
      </div>
    </aside>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * DynamicTenantSidebar
 *
 * Aligned with the UniversalNavContent system:
 * - Typed NavItem (no `any[]`)
 * - Clean buildTenantNav() — no useEffect array splicing
 * - Auto-expand active section on pathname change
 * - Collapsible desktop sidebar (240px ↔ 60px)
 * - Slide-in mobile drawer with backdrop blur, Escape-to-close, scroll lock
 * - Directory "View in Directory" link shown conditionally based on published status
 */
export default function DynamicTenantSidebar({ tenantId, slug, children }: DynamicTenantSidebarProps) {
  const pathname = usePathname();
  const { filterNavItems } = useRBAC();

  const [directorySlug, setDirectorySlug] = useState<string | undefined>(slug);
  const [isPublished, setIsPublished] = useState(false);
  const [tenantName, setTenantName] = useState('My Store');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const fetch = async () => {
      try {
        const directoryInfo = await directoryService.getTenantDirectorySlug(tenantId);
        if (directoryInfo) {
          setDirectorySlug(directoryInfo.slug ?? slug);
          setIsPublished(true);
        }
      } catch {
        // non-fatal — sidebar still renders with defaults
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [tenantId, slug]);

  const rawItems = buildTenantNav(tenantId, slug, directorySlug, isPublished);
  const items = filterNavItems(rawItems);

  const [expanded, setExpanded] = useState<Set<string>>(() => computeExpanded(items, pathname));

  useEffect(() => {
    setExpanded(computeExpanded(items, pathname));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isPublished]);

  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Desktop sidebar */}
      {loading ? (
        <SidebarSkeleton />
      ) : (
        <DesktopSidebar
          items={items}
          pathname={pathname}
          expanded={expanded}
          onToggle={toggleExpanded}
          tenantName={tenantName}
        />
      )}

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        items={items}
        pathname={pathname}
        expanded={expanded}
        onToggle={toggleExpanded}
        tenantName={tenantName}
      />

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 md:hidden">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Open navigation"
          >
            <Icon.Menu />
          </button>
          <span className="font-semibold text-neutral-900 dark:text-white text-sm truncate">{tenantName}</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
