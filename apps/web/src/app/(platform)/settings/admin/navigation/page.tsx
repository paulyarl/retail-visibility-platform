"use client";

import { useState, useCallback, useEffect } from 'react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import { navigationLinksService, type SidebarTarget, type BadgeVariant, type DynamicTemplate, type NavLink } from '@/services/NavigationLinksService';
import { DynamicNavTemplates, type Tenant } from '@/services/DynamicNavTemplates';
import { NavItemRow } from '@/components/navigation/NavItemRow';
import { invalidateNavLinksCache } from '@/hooks/useNavLinks';
import { securitySingletonService } from '@/services/SecuritySingletonService';
import { tenantInfoService } from '@/services/TenantInfoService';

// ─── Types ────────────────────────────────────────────────────────────────────

type NavLinkWithChildren = NavLink & {
  children?: NavLinkWithChildren[];
};

const SIDEBAR_LABELS: Record<SidebarTarget, { label: string; description: string; color: string }> = {
  all: {
    label: 'All Users',
    description: 'Visible to every authenticated user in account settings',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  tenant: {
    label: 'Tenant Users',
    description: 'Visible to store owners and tenant members',
    color: 'bg-green-100 text-green-700 border-green-200',
  },
  admin: {
    label: 'Admin Only',
    description: 'Visible only to platform administrators',
    color: 'bg-red-100 text-red-700 border-red-200',
  },
};

const BADGE_VARIANTS: BadgeVariant[] = ['default', 'success', 'warning', 'error', 'new'];

const DYNAMIC_TEMPLATES: Record<DynamicTemplate, { label: string; description: string; icon: string; requiredGroup?: string }> = {
  none: {
    label: 'Static Link',
    description: 'Manual configuration with fixed href and children',
    icon: 'link',
  },
  'tenant-locations': {
    label: 'My Locations (Dynamic)',
    description: 'Automatically generates links for user\'s tenant locations',
    icon: 'building',
    requiredGroup: 'IS_TENANT_USER',
  },
  'organization-locations': {
    label: 'Organization (Dynamic)',
    description: 'Automatically generates organization links for tenants in organizations',
    icon: 'building',
    requiredGroup: 'IS_TENANT_USER',
  },
};

// Decoding function: Transform flat database links to nested structure
function decodeNestedStructure(flatLinks: NavLink[]): NavLink[] {
  const itemMap = new Map<string, NavLink & { children?: NavLink[] }>();
  const rootItems: (NavLink & { children?: NavLink[] })[] = [];
  
  // First pass: Create map of all items, preserving existing children from dynamic templates
  flatLinks.forEach(link => {
    const item = { ...link, children: link.children || [] };
    itemMap.set(link.id, item);
  });
  
  // Second pass: Build parent-child relationships
  flatLinks.forEach(link => {
    const item = itemMap.get(link.id)!;
    
    // Debug logging
    // console.log(`Decoding item: ${link.label}, parentKey: ${link.metadata.parentKey}`);
    
    // If this item already has children from dynamic templates, preserve them
    if (item.children && item.children.length > 0) {
      // This is a dynamic template item with children, treat as root item
      rootItems.push(item);
    } else if (link.metadata.parentKey) {
      // This is a child item from database relationships
      const parent = itemMap.get(link.metadata.parentKey);
      if (parent) {
        // console.log(`  Adding ${link.label} as child of ${parent.label}`);
        parent.children!.push(item);
      } else {
        // Parent not found, treat as root item
        // console.log(`  Parent ${link.metadata.parentKey} not found, treating ${link.label} as root`);
        rootItems.push(item);
      }
    } else {
      // This is a root item
      rootItems.push(item);
    }
  });
  
  // Third pass: Sort root items and children within each parent
  rootItems.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  rootItems.forEach(item => {
    if (item.children && item.children.length > 0) {
      item.children.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
      // console.log(`Parent ${item.label} has children:`, item.children.map(c => c.label));
    }
  });
  
  // console.log('Final root items:', rootItems.map(item => ({
  //   label: item.label,
  //   parentKey: item.metadata.parentKey,
  //   children: item.children?.map(c => c.label) || []
  // })));
  
  return rootItems;
}

// Encoding function: Transform nested structure to flat database links
function encodeNestedStructure(nestedLinks: NavLink[]): NavLink[] {
  const flatLinks: NavLink[] = [];
  
  function processItem(item: NavLink & { children?: NavLink[] }, level: number = 0, parentKey?: string) {
    // Debug logging
    // console.log(`Encoding item: ${item.label}, level: ${level}, parentKey: ${parentKey}`);
    
    // Update metadata for current item
    const flatItem: NavLink = {
      ...item,
      metadata: {
        nestingLevel: level,
        parentKey,
        hasChildren: !!(item.children && item.children.length > 0),
        childrenKeys: item.children?.map(child => child.id) || []
      }
    };
    
    // Remove children from flat item (they're encoded in metadata)
    const { children, ...itemWithoutChildren } = item;
    flatLinks.push(flatItem);
    
    // Process children recursively
    if (item.children && item.children.length > 0) {
      item.children.forEach(child => {
        processItem(child, level + 1, item.id);
      });
    }
  }
  
  nestedLinks.forEach(item => processItem(item));
  return flatLinks;
}

// Icon components matching the sidebar components
function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function PaletteIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CreditCardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

// Role-based icons for tenant navigation preview
function CrownIcon() {
  return (
    <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2.86-2h8.28l.96-5.88-3.96 3.68L12 8.12l-1.14 3.68-3.96-3.68.96 5.88z"/>
    </svg>
  );
}

function ShieldRoleIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function ProductsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

function CategoriesIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}

function QuickStartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function AlertsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CapacityIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function CogIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function InventoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}

const IconComponents = {
  home: HomeIcon,
  user: UserIcon,
  shield: ShieldIcon,
  lock: LockIcon,
  building: BuildingIcon,
  palette: PaletteIcon,
  globe: GlobeIcon,
  'credit-card': CreditCardIcon,
  chat: ChatIcon,
  admin: AdminIcon,
  bell: BellIcon,
  // Role-based icons for tenant navigation
  crown: CrownIcon,
  'shield-role': ShieldRoleIcon,
  star: StarIcon,
  briefcase: BriefcaseIcon,
  users: UsersIcon,
  eye: EyeIcon,
  // New platform icons
  dashboard: DashboardIcon,
  products: ProductsIcon,
  categories: CategoriesIcon,
  quickstart: QuickStartIcon,
  alerts: AlertsIcon,
  capacity: CapacityIcon,
  chart: ChartIcon,
  cog: CogIcon,
  inventory: InventoryIcon,
};

// Convert icon string to React component
function getIconComponent(iconName: string): React.ReactNode {
  const IconComponent = IconComponents[iconName as keyof typeof IconComponents];
  return IconComponent ? <IconComponent /> : null;
}

const ICON_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'home', label: 'Home' },
  { value: 'user', label: 'User' },
  { value: 'shield', label: 'Shield' },
  { value: 'lock', label: 'Lock' },
  { value: 'building', label: 'Building' },
  { value: 'palette', label: 'Palette' },
  { value: 'globe', label: 'Globe' },
  { value: 'credit-card', label: 'Credit Card' },
  { value: 'chat', label: 'Chat' },
  { value: 'admin', label: 'Admin' },
  { value: 'bell', label: 'Bell' },
  // New platform icons
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'products', label: 'Products' },
  { value: 'categories', label: 'Categories' },
  { value: 'quickstart', label: 'Quick Start' },
  { value: 'alerts', label: 'Alerts' },
  { value: 'capacity', label: 'Capacity' },
  { value: 'chart', label: 'Chart' },
  { value: 'cog', label: 'Cog/Settings' },
  { value: 'inventory', label: 'Inventory' },
];

const PERMISSION_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'CAN_ADMIN_PLATFORM',        label: 'CAN_ADMIN_PLATFORM' },
  { value: 'CAN_SUPPORT_PLATFORM',       label: 'CAN_SUPPORT_PLATFORM' },
  { value: 'CAN_VIEW_PLATFORM_LOGS',     label: 'CAN_VIEW_PLATFORM_LOGS' },
  { value: 'CAN_MANAGE_PLATFORM_USERS',  label: 'CAN_MANAGE_PLATFORM_USERS' },
  { value: 'CAN_ACCESS_SYSTEM_TOOLS',    label: 'CAN_ACCESS_SYSTEM_TOOLS' },
  { value: 'CAN_VIEW_SENSITIVE_DATA',    label: 'CAN_VIEW_SENSITIVE_DATA' },
  { value: 'CAN_DELETE_DATA',            label: 'CAN_DELETE_DATA' },
  { value: 'CAN_BULK_OPERATIONS',        label: 'CAN_BULK_OPERATIONS' },
  { value: 'CAN_MANAGE_TENANT_USERS',    label: 'CAN_MANAGE_TENANT_USERS' },
  { value: 'CAN_MANAGE_TENANT_BILLING',  label: 'CAN_MANAGE_TENANT_BILLING' },
  { value: 'CAN_MANAGE_TENANT_SETTINGS', label: 'CAN_MANAGE_TENANT_SETTINGS' },
  { value: 'CAN_MANAGE_TENANT_ANALYTICS',label: 'CAN_MANAGE_TENANT_ANALYTICS' },
  { value: 'CAN_MANAGE_TENANT_INVENTORY',label: 'CAN_MANAGE_TENANT_INVENTORY' },
  { value: 'CAN_EXPORT_TENANT_DATA',     label: 'CAN_EXPORT_TENANT_DATA' },
];

const GROUP_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'IS_PLATFORM_ADMIN',   label: 'IS_PLATFORM_ADMIN' },
  { value: 'IS_PLATFORM_SUPPORT', label: 'IS_PLATFORM_SUPPORT' },
  { value: 'IS_TENANT_ADMIN',     label: 'IS_TENANT_ADMIN' },
  { value: 'IS_TENANT_OWNER',     label: 'IS_TENANT_OWNER' },
  { value: 'IS_TENANT_MANAGER',   label: 'IS_TENANT_MANAGER' },
  { value: 'IS_TENANT_USER',      label: 'IS_TENANT_USER' },
];

const ROLE_OPTIONS = [
  { value: '', label: 'None (everyone)' },
  { value: 'PLATFORM_ADMIN',   label: 'PLATFORM_ADMIN' },
  { value: 'PLATFORM_SUPPORT', label: 'PLATFORM_SUPPORT' },
  { value: 'TENANT_ADMIN',     label: 'TENANT_ADMIN' },
  { value: 'TENANT_OWNER',     label: 'TENANT_OWNER' },
  { value: 'OWNER',            label: 'OWNER' },
  { value: 'USER',             label: 'USER' },
  { value: 'ADMIN',            label: 'ADMIN' },
];

const DEFAULT_LINK: Omit<NavLink, 'id' | 'order'> = {
  label: '',
  href: '',
  icon: '',
  badge: '',
  badgeVariant: 'default',
  targets: [],
  enabled: true,
  dividerBefore: false,
  requiredPermission: '',
  requiredGroup: '',
  requiredRole: '',
  prefetch: true,
  metadata: {
    nestingLevel: 0,
    parentKey: undefined,
    hasChildren: false,
    childrenKeys: []
  }
};

// ─── Seed data (static defaults — replace with DB fetch when API is ready) ────

const SEED_LINKS: NavLink[] = [
  {
    id: 'built-in-home',
    label: 'Platform Home',
    href: '/',
    icon: 'home',
    badge: '',
    badgeVariant: 'default',
    targets: ['all', 'tenant', 'admin'],
    order: 0,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: true,
    metadata: {
      nestingLevel: 0,
      parentKey: undefined,
      hasChildren: false,
      childrenKeys: []
    }
  },
  {
    id: 'built-in-tenant-dashboard',
    label: 'Tenant Dashboard',
    href: '/t/{tenantId}/dashboard',
    icon: 'dashboard',
    badge: 'Tenant',
    badgeVariant: 'success',
    targets: ['tenant'],
    order: 10,
    enabled: true,
    dividerBefore: true,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: true,
    metadata: {
      nestingLevel: 0,
      parentKey: undefined,
      hasChildren: false,
      childrenKeys: []
    }
  },
  {
    id: 'built-in-tenant-inventory',
    label: 'Tenant Inventory',
    href: '/t/{tenantId}/items',
    icon: 'inventory',
    badge: 'Tenant',
    badgeVariant: 'success',
    targets: ['tenant'],
    order: 11,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: true,
    metadata: {
      nestingLevel: 0,
      parentKey: undefined,
      hasChildren: true,
      childrenKeys: ['built-in-tenant-inventory-manager', 'built-in-tenant-inventory-create']
    }
  },
  {
    id: 'built-in-tenant-inventory-manager',
    label: 'Product Manager',
    href: '/t/{tenantId}/items',
    icon: 'inventory',
    badge: '',
    badgeVariant: 'default',
    targets: ['tenant'],
    order: 12,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: true,
    metadata: {
      nestingLevel: 1,
      parentKey: 'built-in-tenant-inventory',
      hasChildren: false,
      childrenKeys: []
    }
  },
  {
    id: 'built-in-tenant-inventory-create',
    label: 'Add Product',
    href: '/t/{tenantId}/items/create',
    icon: 'inventory',
    badge: '',
    badgeVariant: 'default',
    targets: ['tenant'],
    order: 13,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: true,
    metadata: {
      nestingLevel: 1,
      parentKey: 'built-in-tenant-inventory',
      hasChildren: false,
      childrenKeys: []
    }
  },
  {
    id: 'built-in-security',
    label: 'Security & Privacy',
    href: '/settings/security',
    icon: 'shield',
    badge: '',
    badgeVariant: 'default',
    targets: ['all', 'tenant'],
    order: 2,
    enabled: true,
    dividerBefore: false,
    requiredPermission: '',
    requiredGroup: '',
    requiredRole: '',
    prefetch: false,
    metadata: {
      nestingLevel: 0,
      parentKey: undefined,
      hasChildren: false,
      childrenKeys: []
    }
  },
  {
    id: 'built-in-admin',
    label: 'Admin Panel',
    href: '/settings/admin',
    icon: 'admin',
    badge: 'Admin',
    badgeVariant: 'warning',
    targets: ['admin'],
    order: 3,
    enabled: true,
    dividerBefore: true,
    requiredPermission: 'CAN_ADMIN_PLATFORM',
    requiredGroup: 'IS_PLATFORM_ADMIN',
    requiredRole: '',
    prefetch: false,
    metadata: {
      nestingLevel: 0,
      parentKey: undefined,
      hasChildren: false,
      childrenKeys: []
    }
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TargetPill({ target, active, onClick }: { target: SidebarTarget; active: boolean; onClick: () => void }) {
  const cfg = SIDEBAR_LABELS[target];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-all ${
        active
          ? cfg.color
          : 'bg-neutral-100 text-neutral-400 border-neutral-200 hover:border-neutral-300'
      }`}
    >
      {cfg.label}
    </button>
  );
}

function BadgePill({ variant }: { variant: BadgeVariant }) {
  const colors: Record<BadgeVariant, string> = {
    default: 'bg-neutral-100 text-neutral-600',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    new: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors[variant]}`}>
      {variant}
    </span>
  );
}

function LinkRow({
  link,
  index,
  total,
  onEdit,
  onToggle,
  onDelete,
  onMove,
}: {
  link: NavLink;
  index: number;
  total: number;
  onEdit: (link: NavLink) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
}) {
  const isBuiltIn = link.id.startsWith('built-in-');
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${link.enabled ? 'bg-white border-neutral-200' : 'bg-neutral-50 border-neutral-100 opacity-60'}`}>
      {/* Order controls */}
      <div className="flex flex-col gap-0.5">
        <button
          disabled={index === 0}
          onClick={() => onMove(link.id, 'up')}
          className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move up"
        >
          <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          disabled={index === total - 1}
          onClick={() => onMove(link.id, 'down')}
          className="p-0.5 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Move down"
        >
          <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Icon */}
      <div className="flex-shrink-0">
        {getIconComponent(link.icon)}
      </div>

      {/* Label + href */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-neutral-900 truncate">{link.label || <span className="italic text-neutral-400">Untitled</span>}</span>
          {link.badge && <BadgePill variant={link.badgeVariant} />}
          {link.dividerBefore && (
            <span className="text-[10px] text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">divider</span>
          )}
          {isBuiltIn && (
            <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">built-in</span>
          )}
          {link.metadata?.dynamicTemplate && link.metadata.dynamicTemplate !== 'none' && (
            <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
              {DYNAMIC_TEMPLATES[link.metadata.dynamicTemplate].label}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-400 font-mono truncate mt-0.5">{link.href || '—'}</p>
      </div>

      {/* Sidebar targets + RBAC gates */}
      <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 items-end">
        <div className="flex items-center gap-1">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
            link.targets.includes(t) ? (
              <span key={t} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${SIDEBAR_LABELS[t].color}`}>
                {SIDEBAR_LABELS[t].label}
              </span>
            ) : null
          ))}
        </div>
        {(link.requiredPermission || link.requiredGroup || link.requiredRole) && (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {link.requiredPermission && (
              <span className="text-[9px] font-mono bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded" title="Required permission">
                {link.requiredPermission}
              </span>
            )}
            {link.requiredGroup && (
              <span className="text-[9px] font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0.5 rounded" title="Required group">
                {link.requiredGroup}
              </span>
            )}
            {link.requiredRole && (
              <span className="text-[9px] font-mono bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded" title="Required role">
                {link.requiredRole}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(link.id)}
          className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${link.enabled ? 'bg-primary-500' : 'bg-neutral-300'}`}
          title={link.enabled ? 'Disable' : 'Enable'}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${link.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
        </button>
        {!isBuiltIn && (
          <button
            onClick={() => onEdit(link)}
            className="p-1.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
        {!isBuiltIn && (
          <button
            onClick={() => onDelete(link.id)}
            className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function LinkEditor({
  link,
  onSave,
  onCancel,
  links,
}: {
  link: Partial<NavLink>;
  onSave: (link: NavLink) => void;
  onCancel: () => void;
  links: NavLink[];
}) {
  const [form, setForm] = useState<Omit<NavLink, 'id' | 'order'>>({
    label: link.label ?? '',
    href: link.href ?? '',
    icon: link.icon ?? '',
    badge: link.badge ?? '',
    badgeVariant: link.badgeVariant ?? 'default',
    targets: link.targets ?? [],
    enabled: link.enabled ?? true,
    dividerBefore: link.dividerBefore ?? false,
    requiredPermission: link.requiredPermission ?? '',
    requiredGroup: link.requiredGroup ?? '',
    requiredRole: link.requiredRole ?? '',
    prefetch: link.prefetch ?? true,
    metadata: {
      ...link.metadata,
      nestingLevel: link.metadata?.nestingLevel ?? 0,
      parentKey: link.metadata?.parentKey,
      hasChildren: link.metadata?.hasChildren ?? false,
      childrenKeys: link.metadata?.childrenKeys ?? [],
      dynamicTemplate: link.metadata?.dynamicTemplate ?? 'none'
    }
  });

  const toggleTarget = (t: SidebarTarget) => {
    setForm(prev => ({
      ...prev,
      targets: prev.targets.includes(t)
        ? prev.targets.filter(x => x !== t)
        : [...prev.targets, t],
    }));
  };

  const handleSave = () => {
    if (!form.label.trim()) return;
    // href is optional - groups can have their own page or be group-only
    // console.log(`Saving item: ${form.label}, parentKey: ${form.metadata.parentKey}`);
    // console.log('Full form data:', form);
    onSave({
      ...form,
      id: link.id ?? `custom-${Date.now()}`,
      order: link.order ?? 999,
    });
  };

  return (
    <div className="bg-white border border-primary-200 rounded-xl p-5 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-neutral-900">{link.id ? 'Edit Link' : 'New Link'}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Label *</label>
          <input
            value={form.label}
            onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
            placeholder="e.g. My Reports"
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">
            URL / Path <span className="text-neutral-400 font-normal">(optional - groups can have their own page)</span>
          </label>
          <input
            value={form.href}
            onChange={e => setForm(p => ({ ...p, href: e.target.value }))}
            placeholder="e.g. /settings/reports (leave empty for group-only navigation)"
            disabled={form.metadata.dynamicTemplate !== 'none'}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
              form.metadata.dynamicTemplate !== 'none' 
                ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed' 
                : 'border-neutral-300'
            }`}
          />
          <p className="text-xs text-neutral-500 mt-1">
            {form.metadata.dynamicTemplate !== 'none' 
              ? 'Dynamic templates automatically generate their own links'
              : 'Leave empty if this item only groups other items without its own page'
            }
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Icon</label>
          <select
            value={form.icon}
            onChange={e => setForm(p => ({ ...p, icon: e.target.value }))}
            disabled={form.metadata.dynamicTemplate !== 'none'}
            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
              form.metadata.dynamicTemplate !== 'none' 
                ? 'bg-neutral-100 border-neutral-200 text-neutral-500 cursor-not-allowed' 
                : 'border-neutral-300'
            }`}
          >
            {ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {form.metadata.dynamicTemplate !== 'none' && (
            <p className="text-xs text-neutral-500 mt-1">
              Icon is automatically set by the dynamic template
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Badge Text</label>
          <div className="flex gap-2">
            <input
              value={form.badge}
              onChange={e => setForm(p => ({ ...p, badge: e.target.value }))}
              placeholder="e.g. NEW"
              className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <select
              value={form.badgeVariant}
              onChange={e => setForm(p => ({ ...p, badgeVariant: e.target.value as BadgeVariant }))}
              className="px-2 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {BADGE_VARIANTS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Parent Item (for nesting)</label>
          <select
            value={form.metadata.parentKey ?? ''}
            onChange={e => setForm(p => ({ 
              ...p, 
              metadata: { 
                ...p.metadata, 
                parentKey: e.target.value || undefined 
              }
            }))}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">None (Root Level)</option>
            {links
              .filter((l: NavLink) => l.id !== link.id) // Exclude self
              .map((l: NavLink) => (
                <option key={l.id} value={l.id}>
                  {'  '.repeat(l.metadata.nestingLevel)}{l.label}
                </option>
              ))
            }
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Prefetch Behavior</label>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="prefetch"
              checked={form.prefetch}
              onChange={e => setForm(p => ({ ...p, prefetch: e.target.checked }))}
              disabled={form.metadata.dynamicTemplate !== 'none'}
              className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 focus:ring-2"
            />
            <label htmlFor="prefetch" className="text-sm text-neutral-700">
              Enable prefetching
              <span className="text-neutral-500 font-normal block text-xs">
                {form.metadata.dynamicTemplate !== 'none' 
                  ? 'Controlled by dynamic template'
                  : 'Enable for faster navigation, disable for auth-protected routes to prevent CORS issues'
                }
              </span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Dynamic Template</label>
          <select
            value={form.metadata.dynamicTemplate ?? 'none'}
            onChange={e => {
              const template = e.target.value as DynamicTemplate;
              const templateConfig = DYNAMIC_TEMPLATES[template];
              setForm(p => ({ 
                ...p, 
                metadata: { 
                  ...p.metadata, 
                  dynamicTemplate: template
                },
                // Auto-populate template-specific fields
                icon: template === 'none' ? p.icon : templateConfig.icon,
                requiredGroup: template === 'none' ? p.requiredGroup : (templateConfig.requiredGroup || ''),
                href: template === 'none' ? p.href : '', // Dynamic templates don't need href
              }));
            }}
            className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {Object.entries(DYNAMIC_TEMPLATES).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
          {form.metadata.dynamicTemplate && form.metadata.dynamicTemplate !== 'none' && (
            <p className="text-xs text-neutral-500 mt-1">
              {DYNAMIC_TEMPLATES[form.metadata.dynamicTemplate].description}
            </p>
          )}
        </div>
      </div>

      {/* Sidebar visibility */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-2">Sidebar Visibility</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
            <TargetPill
              key={t}
              target={t}
              active={form.targets.includes(t)}
              onClick={() => toggleTarget(t)}
            />
          ))}
        </div>
        {form.targets.length === 0 && (
          <p className="text-xs text-red-500 mt-1">At least one sidebar must be selected.</p>
        )}
        <div className="mt-2 space-y-1">
          {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).filter(t => form.targets.includes(t)).map(t => (
            <p key={t} className="text-xs text-neutral-500">
              <span className="font-medium">{SIDEBAR_LABELS[t].label}:</span> {SIDEBAR_LABELS[t].description}
            </p>
          ))}
        </div>
      </div>

      {/* RBAC Access Gates */}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-2">
          Access Gates
          <span className="ml-1 text-neutral-400 font-normal">(optional — all fields are AND-combined)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-purple-600 mb-1">Required Permission</label>
            <select
              value={form.requiredPermission}
              onChange={e => setForm(p => ({ ...p, requiredPermission: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {PERMISSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-indigo-600 mb-1">Required Group</label>
            <select
              value={form.requiredGroup}
              onChange={e => setForm(p => ({ ...p, requiredGroup: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-orange-600 mb-1">Required Role</label>
            <select
              value={form.requiredRole}
              onChange={e => setForm(p => ({ ...p, requiredRole: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        {(form.requiredPermission || form.requiredGroup || form.requiredRole) && (
          <p className="text-xs text-neutral-500 mt-2">
            This link will only be visible to users who satisfy <strong>all</strong> configured gates.
          </p>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={e => setForm(p => ({ ...p, enabled: e.target.checked }))}
            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.dividerBefore}
            onChange={e => setForm(p => ({ ...p, dividerBefore: e.target.checked }))}
            className="w-4 h-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-700">Add divider above</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!form.label.trim() || form.targets.length === 0}
          className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Save Link
        </button>
      </div>
    </div>
  );
}

function SidebarPreview({ links, target }: { links: NavLink[]; target: SidebarTarget }) {
  // Role icon mapping for dynamic templates
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'crown'; // Will be handled by getIconComponent
      case 'ADMIN':
        return 'shield-role';
      case 'SUPPORT':
        return 'star';
      case 'MANAGER':
        return 'briefcase';
      case 'MEMBER':
        return 'users';
      case 'VIEWER':
        return 'eye';
      default:
        return null;
    }
  };

  // Process dynamic templates for preview using shared service
  const processDynamicTemplates = async (items: NavLink[]): Promise<NavLink[]> => {
    // Get real tenant data from SecuritySingletonService
    let tenants: Tenant[] = [];
    try {
      const sessionInfo = await securitySingletonService.getSessionInfo();
      tenants = sessionInfo.user?.tenants || [];
    } catch (error) {
      console.error('SidebarPreview: Error fetching tenant data:', error);
      // Fallback to mock data for preview
      tenants = [
        { id: '1', name: 'Main Store', role: 'OWNER' },
        { id: '2', name: 'Branch Office', role: 'ADMIN' },
        { id: '3', name: 'Satellite Location', role: 'MEMBER' },
        { id: '4', name: 'Warehouse', role: 'MANAGER' },
      ];
    }

    // Use the shared DynamicNavTemplates service
    return DynamicNavTemplates.processDynamicTemplates(items, tenants);
  };

  // State for processed links
  const [visible, setVisible] = useState<NavLink[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Process links when dependencies change
  useEffect(() => {
    const processLinks = async () => {
      const processedLinks = await processDynamicTemplates(links);
      // console.log('SidebarPreview: Processed links:', processedLinks);
      const nestedLinks = decodeNestedStructure(processedLinks);
      // console.log('SidebarPreview: Nested links:', nestedLinks);
      const filteredLinks = nestedLinks.filter(l => l.enabled && l.targets.includes(target));
      // console.log('SidebarPreview: Visible links for target', target, ':', filteredLinks);
      setVisible(filteredLinks);
    };

    processLinks();
  }, [links, target]);
  
  const toggleExpanded = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${SIDEBAR_LABELS[target].color}`}>
          {SIDEBAR_LABELS[target].label} Sidebar
        </span>
      </div>
      <div className="p-3 space-y-0.5 min-h-[160px]">
        {visible.length === 0 && (
          <p className="text-xs text-neutral-400 italic py-4 text-center">No links</p>
        )}
        {visible.map(link => (
          <div key={link.id}>
            {link.dividerBefore && <div className="my-1.5 border-t border-neutral-100" />}
            <NavItemRow
              item={link}
              pathname={typeof window !== 'undefined' ? window.location.pathname : ''}
              expanded={expanded}
              onToggle={(key) => setExpanded(prev => {
                const newSet = new Set(prev);
                if (newSet.has(key)) {
                  newSet.delete(key);
                } else {
                  newSet.add(key);
                }
                return newSet;
              })}
              onNavigate={() => {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NavigationControlPage() {
  const { hasAccess, loading } = useAccessControl(null, AccessPresets.PLATFORM_ADMIN_ONLY);

  const [links, setLinks] = useState<NavLink[]>(SEED_LINKS);
  // console.log(`Initial links:`, links);
  const [apiLoading, setApiLoading] = useState(true);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NavLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activePreview, setActivePreview] = useState<SidebarTarget>('all');

  // Fetch persisted links from API on mount; fall back to SEED_LINKS on error
  const loadLinksFromAPI = useCallback(async () => {
    try {
      const result = await navigationLinksService.getLinks();
      // console.log('Loaded links from API:', result);
      
      // Handle double-wrapped response: { success: true, data: { success: true, data: [links] } }
      const innerData = (result.data as any)?.data;
      
      if (result.success && Array.isArray(innerData) && innerData.length > 0) {
        // console.log('Setting links from database:', innerData);
        setLinks(innerData);
      }
    } catch (error) {
      console.error('Failed to load navigation links:', error);
      /* keep SEED_LINKS */
    } finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinksFromAPI();
  }, [loadLinksFromAPI]);

  const handleSave = useCallback((link: NavLink) => {
    setLinks(prev => {
      const idx = prev.findIndex(l => l.id === link.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = link;
        return next;
      }
      return [...prev, { ...link, order: prev.length }];
    });
    setEditing(null);
    setCreating(false);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setLinks(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setLinks(prev => prev.filter(l => l.id !== id));
  }, []);

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    setLinks(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(l => l.id === id);
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const next = [...sorted];
      [next[idx].order, next[swapIdx].order] = [next[swapIdx].order, next[idx].order];
      return next;
    });
  }, []);

  const handlePublish = async () => {
    setPublishError(null);
    try {
      // Links are already in flat format with metadata, no encoding needed
      const result = await navigationLinksService.saveLinks(links);
      if (!result.success) {
        const errorMessage = typeof result.error === 'string' 
          ? result.error 
          : result.error?.message || 'Publish failed';
        throw new Error(errorMessage);
      }
      if (Array.isArray(result.data)) setLinks(result.data);
      
      // Invalidate navigation links cache to refresh sidebar
      invalidateNavLinksCache();
      
      // Also refresh admin page data from database
      await loadLinksFromAPI();
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish');
    }
  };

  if (loading || apiLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return <AccessDenied />;
  }

  const sortedLinks = [...links].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Navigation Control</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Create and manage links across all three sidebar contexts. Changes apply at publish time.
          </p>
        </div>
        <button
          onClick={handlePublish}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-primary-600 hover:bg-primary-700 text-white'
          }`}
        >
          {saved ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Saved
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Publish Changes
            </>
          )}
        </button>
      </div>

      {/* Sidebar legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.entries(SIDEBAR_LABELS) as [SidebarTarget, typeof SIDEBAR_LABELS['all']][]).map(([key, cfg]) => (
          <div key={key} className={`px-4 py-3 rounded-xl border ${cfg.color} bg-opacity-40`}>
            <p className="text-xs font-bold">{cfg.label}</p>
            <p className="text-xs mt-0.5 opacity-80">{cfg.description}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Link list */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">
              Navigation Links <span className="text-neutral-400 font-normal">({sortedLinks.length})</span>
            </h2>
            {!creating && !editing && (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Link
              </button>
            )}
          </div>

          {creating && (
            <LinkEditor
              link={{ ...DEFAULT_LINK }}
              onSave={handleSave}
              onCancel={() => setCreating(false)}
              links={links}
            />
          )}

          {editing && (
            <LinkEditor
              link={editing}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
              links={links}
            />
          )}

          {sortedLinks.length === 0 && !creating && (
            <div className="text-center py-10 text-sm text-neutral-400 border border-dashed border-neutral-200 rounded-xl">
              No links yet. Add your first link above.
            </div>
          )}

          {sortedLinks.length > 0 && (
            <div className="space-y-2">
              {sortedLinks.map((link, i) => (
                <LinkRow
                  key={link.id}
                  link={link}
                  index={i}
                  total={sortedLinks.length}
                  onEdit={setEditing}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onMove={handleMove}
                />
              ))}
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-700">Preview</h2>
            <div className="flex gap-1">
              {(Object.keys(SIDEBAR_LABELS) as SidebarTarget[]).map(t => (
                <button
                  key={t}
                  onClick={() => setActivePreview(t)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-all ${
                    activePreview === t ? SIDEBAR_LABELS[t].color : 'bg-neutral-100 text-neutral-400 border-neutral-200'
                  }`}
                >
                  {SIDEBAR_LABELS[t].label}
                </button>
              ))}
            </div>
          </div>
          <SidebarPreview links={links} target={activePreview} />

          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 space-y-1">
            <p className="font-semibold">Persistence active</p>
            <p>Links are saved to the database via <code className="font-mono bg-amber-100 px-1 rounded">/api/admin/navigation-links</code> and loaded on every visit.</p>
            {publishError && <p className="text-red-600 font-semibold mt-1">{publishError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
