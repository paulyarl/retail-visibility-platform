"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { navigationLinksService, NavLink } from '@/services/NavigationLinksService';

// Re-export types for compatibility
export type { SidebarTarget, BadgeVariant, NavLink } from '@/services/NavigationLinksService';

// ─── Shared in-memory cache (one fetch per browser session) ───────────────────

let _cache: NavLink[] | null = null;
let _fetchPromise: Promise<NavLink[]> | null = null;

async function fetchLinks(): Promise<NavLink[]> {
  const result = await navigationLinksService.getLinks();
  
  if (!result.success) {
    throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'navigation-links fetch failed');
  }
  
  return result.data as NavLink[];
}

function getLinks(): Promise<NavLink[]> {
  if (_cache) return Promise.resolve(_cache);
  if (_fetchPromise) return _fetchPromise;
  _fetchPromise = fetchLinks().then(links => {
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
  allLinks:    NavLink[];
  tenantLinks: NavLink[];
  adminLinks:  NavLink[];
  loading:     boolean;
  error:       string | null;
  refresh:     () => void;
}

export function useNavLinks(): UseNavLinksResult {
  const { isAuthenticated } = useAuth();
  const [links, setLinks]   = useState<NavLink[]>(_cache || []); // Ensure array initialization
  const [loading, setLoading] = useState<boolean>(!_cache);
  const [error, setError]   = useState<string | null>(null);

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
  const enabled = linksArray.filter(l => l.enabled);

  return {
    allLinks:    enabled.filter(l => l.targets.includes('all')),
    tenantLinks: enabled.filter(l => l.targets.includes('tenant')),
    adminLinks:  enabled.filter(l => l.targets.includes('admin')),
    loading,
    error,
    refresh: () => { invalidateNavLinksCache(); load(); },
  };
}
