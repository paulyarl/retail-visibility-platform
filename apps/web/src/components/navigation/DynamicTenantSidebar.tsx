"use client";

import { useState, useEffect, useRef, ReactNode, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { directoryService } from '@/services/DirectorySingletonService';
import { useRBAC, RBACNavGates } from '@/lib/auth/useRBAC';
import { DynamicNavTemplates, type Tenant as NavTenant } from '@/services/DynamicNavTemplates';
import { NavItemRow, type NavItem } from '@/components/navigation/NavItemRow';
import { useAuth } from '@/contexts/AuthContext';
import { useNavLinks } from '@/hooks/useNavLinks';
import { NavTemplateParser } from '@/services/NavigationLinksService';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import TenantScopeHeader from '@/components/tenant/TenantScopeHeader';

// Types are imported from NavItemRow component
type NavItemWithRBAC = NavItem & RBACNavGates;

interface DynamicTenantSidebarProps {
  tenantId: string;
  slug?: string;
  hasPublishedDirectory?: boolean;
  children: ReactNode;
}

// Tenant type for dynamic templates
interface Tenant {
  id: string;
  name: string;
  role: string;
  organizationId?: string;
  organizationName?: string;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

// SVG Icons - Updated with prefetch support

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
  Eye: () => (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  Briefcase: () => (
    <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Products: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Categories: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  QuickStart: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Alerts: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  Capacity: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
};

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
      return <Icon.Users />;
    case 'VIEWER':
      return <Icon.Eye />;
    default:
      return null;
  }
};

// Compute expanded state from items and pathname
function computeExpanded(items: NavItem[], pathname: string): Set<string> {
  const expanded = new Set<string>();
  const walk = (nodes: NavItem[]) => {
    for (const node of nodes) {
      if (!node.href) continue;
      const key = node.id ?? node.href ?? node.label;
      if (pathname === node.href || pathname.startsWith(node.href + '/')) {
        expanded.add(key);
      }
      if (node.children) {
        const hasActive = node.children.some(
          c => c.href && (pathname === c.href || pathname.startsWith(c.href + '/'))
        );
        if (hasActive) expanded.add(key);
        walk(node.children);
      }
    }
  };
  walk(items);
  return expanded;
}

// ─── Nav builder ─────────────────────────────────────────────────────────────

function buildTenantNav(
  tenantId: string,
  currentTenantId: string,
  slug?: string,
  isPublished?: boolean,
  directorySlug?: string,
): NavItemWithRBAC[] {
  return [
    {
      label: 'Dashboard',
      href: `/t/${currentTenantId}/dashboard`,
      icon: <Icon.Dashboard />,
    },
    {
      label: 'Inventory',
      href: `/t/${currentTenantId}/items`,
      icon: <Icon.Inventory />,
      children: [
        { label: 'Product Manager', href: `/t/${currentTenantId}/items` },
        { label: 'Add Product', href: `/t/${currentTenantId}/items/create` },
        { label: 'Product Catalog', href: `/t/${currentTenantId}/catalog` },
        { label: 'Barcode Scan', href: `/t/${currentTenantId}/scan` },
        { label: 'Quick Start', href: `/t/${currentTenantId}/quick-start` },
        { label: 'Categories', href: `/t/${currentTenantId}/categories` },
        { label: 'Featured Products', href: `/t/${currentTenantId}/settings/featured-products` },
      ],
    },
    {
      label: 'Orders',
      href: `/t/${currentTenantId}/orders`,
      icon: <Icon.Orders />,
      requiredGroup: 'IS_TENANT_MANAGER',
      children: [
        { label: 'Order Management', href: `/t/${currentTenantId}/orders` },
        { label: 'Payment Gateways', href: `/t/${currentTenantId}/settings/payment-gateways`, requiredPermission: 'CAN_MANAGE_TENANT_BILLING' },
        { label: 'Fulfillment Options', href: `/t/${currentTenantId}/settings/fulfillment`, requiredGroup: 'IS_TENANT_MANAGER' },
      ],
    },
    {
      label: 'Directory & Storefront',
      href: `/t/${currentTenantId}/settings/directory`,
      icon: <Icon.Directory />,
      children: [
        ...(isPublished && directorySlug
          ? [{ label: 'View in Directory', href: `/directory/${directorySlug}`, badge: 'Live', badgeVariant: 'success' as const }]
          : []),
        { label: 'Directory Settings', href: `/t/${currentTenantId}/settings/directory` },
        { label: 'Branding', href: `/t/${currentTenantId}/settings/branding` },
        { label: 'Store Hours', href: `/t/${currentTenantId}/settings/hours` },
        { label: 'Business Category', href: `/t/${currentTenantId}/settings/gbp-category` },
        { label: 'Location Status', href: `/t/${currentTenantId}/settings/location-status` },
        { label: 'Review Management', href: `/t/${currentTenantId}/reviews` },
        ...(slug ? [{ label: 'My Storefront', href: `/tenant/${slug}` }] : []),
      ],
    },
    {
      label: 'Integrations',
      href: `/t/${currentTenantId}/settings/integrations`,
      icon: <Icon.Integrations />,
      requiredGroup: 'IS_TENANT_ADMIN',
      children: [
        { label: 'Google Merchant Center', href: `/t/${currentTenantId}/settings/integrations/google` },
        { label: 'Feed Validation', href: `/t/${currentTenantId}/feed-validation` },
        { label: 'Clover POS', href: `/t/${currentTenantId}/settings/integrations/clover` },
        { label: 'Square POS', href: `/t/${currentTenantId}/settings/integrations/square` },
      ],
    },
    {
      label: 'Settings',
      href: `/t/${currentTenantId}/settings`,
      icon: <Icon.Settings />,
      requiredGroup: 'IS_TENANT_MANAGER',
      children: [
        { label: 'Store Profile', href: `/t/${currentTenantId}/settings/tenant`, requiredPermission: 'CAN_MANAGE_TENANT_SETTINGS' },
        { label: 'Team Members', href: `/t/${currentTenantId}/settings/users`, requiredPermission: 'CAN_MANAGE_TENANT_USERS' },
        { label: 'Appearance', href: `/t/${currentTenantId}/settings/appearance` },
        { label: 'Language & Region', href: `/t/${currentTenantId}/settings/language` },
        { label: 'Subscription', href: `/t/${currentTenantId}/settings/subscription`, requiredPermission: 'CAN_MANAGE_TENANT_BILLING' },
        { label: 'Digital Downloads', href: `/t/${currentTenantId}/settings/digital-downloads` },
        { label: 'Onboarding', href: `/t/${currentTenantId}/settings/onboarding`, requiredPermission: 'CAN_MANAGE_TENANT_SETTINGS' },
        { label: 'Organization Dashboard', href: `/t/${currentTenantId}/settings/organization` },
        { label: 'Propagation Settings', href: `/t/${currentTenantId}/settings/propagation` },
        { label: 'Propagation Center', href: `/t/${currentTenantId}/propagation` },
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
        { label: 'My Locations', href: '/tenants' },
        { label: 'Subscription', href: '/settings/subscription' },
        { label: 'Support', href: '/settings/contact' },
      ],
    },
  ];
}

// ─── Shared nav item helpers ──────────────────────────────────────────────────

function SidebarNav({
  items,
  pathname,
  expanded,
  onToggle,
  onNavigate,
}: {
  items: NavItemWithRBAC[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onNavigate: () => void;
}) {
  return (
    <nav className="space-y-0.5" role="navigation" aria-label="Main navigation">
      {items.map(item => (
        <NavItemRow
          key={item.id || item.href || item.label}
          item={item}
          pathname={pathname}
          expanded={expanded}
          onToggle={onToggle}
          onNavigate={onNavigate}
        />
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
  user,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  tenantName: string;
  user: { email: string; firstName?: string; lastName?: string; role: string; picture?: string } | null;
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
  user,
}: {
  items: NavItem[];
  pathname: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  tenantName: string;
  user: { email: string; firstName?: string; lastName?: string; role: string; picture?: string } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  
  const displayName = user
    ? user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.email
    : '';

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

      {/* User identity strip */}
      <div className={cn('flex items-center gap-3 px-4 py-4 border-b border-neutral-100 dark:border-neutral-800', collapsed && 'justify-center px-2')}>
        {user?.picture ? (
          <img 
            src={user.picture} 
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {displayName.charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{displayName}</p>
            <p className="text-xs text-neutral-500 truncate">{user?.role}</p>
          </div>
        )}
      </div>

      <SidebarNav
        items={items}
        pathname={pathname}
        expanded={expanded}
        onToggle={onToggle}
        onNavigate={() => {}}
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
export default function DynamicTenantSidebar({ tenantId, slug, hasPublishedDirectory, children }: DynamicTenantSidebarProps) {
  const pathname = usePathname();
  const { filterNavItems } = useRBAC();
  const { user } = useAuth();
  
  // Use centralized tenant context - this ensures sidebar aligns with current context
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(tenantId);
  
  useEffect(() => {
    // Check tenant context every second to stay in sync
    const checkContext = () => {
      const context = clientTenantContextManager.getTenantContext();
      if (context.tenantId && context.tenantId !== currentTenantId) {
        setCurrentTenantId(context.tenantId);
      }
    };
    
    checkContext();
    const interval = setInterval(checkContext, 1000);
    return () => clearInterval(interval);
  }, [currentTenantId]);
  const { tenantLinks } = useNavLinks();

  // Stabilize user.tenants to prevent infinite re-renders
  const prevTenantsRef = useRef<NavTenant[] | undefined>(undefined);
  const stableTenants = useMemo(() => {
    const tenants = user?.tenants as NavTenant[] | undefined;
    // Only update if tenants actually changed (deep comparison)
    if (
      prevTenantsRef.current &&
      tenants &&
      tenants.length === prevTenantsRef.current.length &&
      tenants.every((t, i) => 
        t.id === prevTenantsRef.current![i].id &&
        t.role === prevTenantsRef.current![i].role &&
        t.organizationId === prevTenantsRef.current![i].organizationId
      )
    ) {
      return prevTenantsRef.current; // Return previous stable version
    }
    
    prevTenantsRef.current = tenants || [];
    return tenants || [];
  }, [user?.tenants]);

  // Parse tenant links with template context
  const parsedTenantLinks = useMemo(() => {
    if (!tenantLinks.length) return [];
    
    // Extract clean tenant ID without $ prefix
    const cleanTenantId = tenantId?.replace(/^\$/, '') || tenantId;
    
    const templateContext = NavTemplateParser.getContext({
      tenantId: cleanTenantId,
      slug,
    });
    
    // Add organization info if available
    if (user?.tenants) {
      const currentTenant = (user.tenants as NavTenant[]).find(t => t.id === tenantId);
      if (currentTenant) {
        templateContext.organizationId = currentTenant.organizationId;
        templateContext.organizationName = currentTenant.organizationName;
      }
    }
    
    return NavTemplateParser.parseNavLinks(tenantLinks, templateContext);
  }, [tenantLinks, tenantId, slug, user?.tenants]);

  // Process dynamic templates with shared logic
  const processedTenantLinks = useMemo(() => {
    if (!parsedTenantLinks.length) return [];
    
    // Convert ProcessedNavLink to NavLink for template processing
    const linksForProcessing: any[] = parsedTenantLinks.map(link => ({
      id: link.id,
      label: link.label,
      href: link.href,
      icon: link.icon,
      badge: link.badge || '',
      badgeVariant: link.badgeVariant || 'default',
      targets: link.targets || [],
      order: link.order || 0,
      enabled: link.enabled !== false,
      dividerBefore: link.dividerBefore || false,
      requiredPermission: link.requiredPermission || '',
      requiredGroup: link.requiredGroup || '',
      requiredRole: link.requiredRole || '',
      prefetch: link.prefetch !== false,
      metadata: link.metadata || {},
      children: link.children || [],
    }));
    
    // Apply dynamic template processing with fallback to empty array
    const processedLinks = DynamicNavTemplates.processDynamicTemplates(linksForProcessing, stableTenants || []);
    
    // Convert back to ProcessedNavLink format
    return processedLinks.map(link => ({
      ...link,
      children: link.children || [],
    }));
  }, [parsedTenantLinks, stableTenants]);

  // Apply RBAC filtering
  const filteredTenantLinks = useMemo(() => {
    return filterNavItems(processedTenantLinks);
  }, [processedTenantLinks, filterNavItems]);

  const [directorySlug, setDirectorySlug] = useState<string | undefined>(slug);
  const [isPublished, setIsPublished] = useState(false);
  const [tenantName, setTenantName] = useState('My Store');
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    // console.log(`[DynamicTenantSidebar] Fetching directory info for tenant: ${tenantId}`);
    // console.log(`[DynamicTenantSidebar] Has published directory: ${hasPublishedDirectory}`);
    // console.log(`[DynamicTenantSidebar] Slug: ${slug}`);
    const fetch = async () => {
      try {
        if (!hasPublishedDirectory) {          
          setIsPublished(false);          
          setDirectorySlug(slug);
          setLoading(false);
          return;
        }
        if (slug) {
          setDirectorySlug(slug);          
          setIsPublished(true);
          setLoading(false);
          return;
        }
       
      } catch {
        // non-fatal — sidebar still renders with defaults
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [tenantId, slug, hasPublishedDirectory]);

  // Compute navigation items using useMemo to avoid infinite loops
  const items = useMemo(() => {
    let processedItems: NavItem[] = [];
    
    if (processedTenantLinks.length > 0) {
      // Convert ProcessedNavLink to NavItem format for rendering
      processedItems = processedTenantLinks.map(link => ({
        id: link.id,
        label: link.label,
        href: link.href,
        icon: link.icon,
        badge: link.badge || '',
        badgeVariant: link.badgeVariant || 'default',
        targets: link.targets || [],
        order: link.order || 0,
        enabled: link.enabled !== false,
        dividerBefore: link.dividerBefore || false,
        requiredPermission: link.requiredPermission || '',
        requiredGroup: link.requiredGroup || '',
        requiredRole: link.requiredRole || '',
        prefetch: link.prefetch !== false,
        metadata: link.metadata || {},
        children: link.children || [],
      }));
    }
    
    return filterNavItems(processedItems);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processedTenantLinks, stableTenants, tenantId, slug, directorySlug, isPublished]);

  // Expanded state for navigation items
  const [expanded, setExpanded] = useState<Set<string>>(() => computeExpanded(items, pathname));

  // Only update expanded when pathname changes, not when items change
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
          user={user}
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
        user={user}
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

        {/* Tenant Scope Header - Desktop only, mobile uses top bar */}
        <div className="hidden md:block">
          <TenantScopeHeader tenantId={currentTenantId || tenantId} />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
