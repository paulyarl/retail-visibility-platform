"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { navigationLinksService, NavLink } from '@/services/NavigationLinksService';
import { ReactNode } from 'react';

// Type for navigation items with ReactNode icons
export type ProcessedNavLink = Omit<NavLink, 'icon'> & {
  icon?: ReactNode;
  children?: ProcessedNavLink[];
};

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
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
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
};

// Convert icon string to React component
function getIconComponent(iconName: string): React.ReactNode {
  const IconComponent = IconComponents[iconName as keyof typeof IconComponents];
  return IconComponent ? <IconComponent /> : null;
}

// Re-export types for compatibility
export type { SidebarTarget, BadgeVariant, NavLink } from '@/services/NavigationLinksService';

// ─── Shared in-memory cache (one fetch per browser session) ───────────────────

let _cache: ProcessedNavLink[] | null = null;
let _fetchPromise: Promise<ProcessedNavLink[]> | null = null;

async function fetchLinks(): Promise<ProcessedNavLink[]> {
  const result = await navigationLinksService.getLinks();
  
  if (!result.success) {
    throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'navigation-links fetch failed');
  }
  
  // Handle double-wrapped response: { success: true, data: { success: true, data: [links] } }
  const innerData = (result.data as any)?.data;
  const flatLinks = innerData as NavLink[];
  
  // Decode nested structure from flat database links
  return decodeNestedStructure(flatLinks);
}

// Decoding function: Transform flat database links to nested structure
function decodeNestedStructure(flatLinks: NavLink[]): ProcessedNavLink[] {
  const itemMap = new Map<string, ProcessedNavLink>();
  const rootItems: ProcessedNavLink[] = [];
  
  // First pass: Create map of all items with empty children arrays and convert icons
  flatLinks.forEach(link => {
    const { icon, ...linkWithoutIcon } = link;
    const item: ProcessedNavLink = { 
      ...linkWithoutIcon, 
      children: [],
      // Convert icon string to React component
      icon: icon ? getIconComponent(icon) : undefined
    };
    itemMap.set(link.id, item);
  });
  
  // Second pass: Build parent-child relationships
  flatLinks.forEach(link => {
    const item = itemMap.get(link.id)!;
    
    if (link.metadata?.parentKey) {
      // This is a child item
      const parent = itemMap.get(link.metadata.parentKey);
      if (parent) {
        parent.children!.push(item);
      } else {
        // Parent not found, treat as root item
        rootItems.push(item);
      }
    } else {
      // This is a root item
      rootItems.push(item);
    }
  });
  
  return rootItems;
}

function getLinks(): Promise<ProcessedNavLink[]> {
  if (_cache) return Promise.resolve(_cache);
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetchLinks().then(links => {
    // console.log('Storing in cache:', links);
    _cache = links;
    _fetchPromise = null;
    return links;
  }).catch(err => {
    _fetchPromise = null;
    throw err;
  });
  return _fetchPromise;
}

export function invalidateNavLinksCache() {
  _cache = null;
  _fetchPromise = null;
  navigationLinksService.invalidateCache();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseNavLinksResult {
  links:      ProcessedNavLink[];
  allLinks:    ProcessedNavLink[];
  tenantLinks: ProcessedNavLink[];
  adminLinks:  ProcessedNavLink[];
  loading:     boolean;
  error:       string | null;
  refresh:     () => void;
}

export function useNavLinks(): UseNavLinksResult {
  const { isAuthenticated } = useAuth();
  const [links, setLinks]   = useState<ProcessedNavLink[]>(_cache || []); // Ensure array initialization
  const [loading, setLoading] = useState<boolean>(!_cache);
  const [error, setError]   = useState<string | null>(null);
  // console.log(`useNavLinks - isAuthenticated:`, isAuthenticated);
  // console.log(`useNavLinks - _cache:`, _cache);
  // console.log(`useNavLinks - links:`, links);

  const load = useCallback(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getLinks()
      .then(data => {
        setLinks(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('[useNavLinks]', err);
        setError(err.message);
        setLoading(false);
      });
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  // Ensure links is always an array
  const linksArray = Array.isArray(links) ? links : [];
  // console.log('useNavLinks - linksArray:', linksArray);
  
  const enabled = linksArray.filter(l => l.enabled);
  // console.log('useNavLinks - enabled links:', enabled);

  const adminLinks = enabled.filter(l => l.targets.includes('admin'));
  const allLinks = enabled.filter(l => l.targets.includes('all'));
  const tenantLinks = enabled.filter(l => l.targets.includes('tenant'));
  
  // console.log('useNavLinks - filtered adminLinks:', adminLinks);
  // console.log('useNavLinks - filtered allLinks:', allLinks);
  // console.log('useNavLinks - filtered tenantLinks:', tenantLinks);

  return {
    links,
    allLinks,
    tenantLinks,
    adminLinks,
    loading,
    error,
    refresh: () => { invalidateNavLinksCache(); load(); },
  };
}
