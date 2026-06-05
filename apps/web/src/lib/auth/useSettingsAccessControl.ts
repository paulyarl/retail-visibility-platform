/**
 * Cached Access Control Hook for Settings Pages
 *
 * Batches and caches all permission checks for settings pages to eliminate
 * redundant API calls and improve page load performance.
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  UserData,
  AccessControlOptions,
  isPlatformAdmin,
  AccessPresets,
} from './access-control';

// Cache key for settings access control
const SETTINGS_ACCESS_CACHE_KEY = 'settings_access_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

interface CachedAccessResult {
  timestamp: number;
  isPlatformAdmin: boolean;
  userRole: string | null;
  permissions: Record<string, boolean>;
}

export interface UseSettingsAccessControlResult {
  isPlatformAdmin: boolean;
  userRole: string | null;
  hasPermission: (permission: keyof typeof AccessPresets) => boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Cached hook for settings page access control
 * Performs all permission checks once and caches results
 */
export function useSettingsAccessControl(): UseSettingsAccessControlResult {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<CachedAccessResult | null>(null);

  // Convert AuthContext user to UserData format
  const user = useMemo((): UserData | null => {
    if (!authUser) return null;
    return authUser as unknown as UserData;
  }, [authUser]);

  // Check if cache is still valid
  const isCacheValid = useMemo(() => {
    if (!cachedResult) return false;
    return Date.now() - cachedResult.timestamp < CACHE_DURATION_MS;
  }, [cachedResult]);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(SETTINGS_ACCESS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedAccessResult;
        if (Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
          setCachedResult(parsed);
        } else {
          sessionStorage.removeItem(SETTINGS_ACCESS_CACHE_KEY);
        }
      }
    } catch (err) {
      // Ignore cache errors
      sessionStorage.removeItem(SETTINGS_ACCESS_CACHE_KEY);
    }
  }, []);

  // Fetch permissions if not cached or user changed
  const fetchPermissions = async () => {
    if (!user) return;

    // Check cache first
    if (isCacheValid && cachedResult) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get user role from API (this is the main expensive call)
      // We only need basic user info for platform admin checks
      const isAdmin = isPlatformAdmin(user);
      const userRole = user.role || null;

      // Define all permission checks needed for settings page
      const permissions: Record<string, boolean> = {
        platformAdmin: isAdmin,
        platformStaff: userRole === 'PLATFORM_SUPPORT' || isAdmin,
        admin: userRole === 'ADMIN' || isAdmin,
        // Add more permissions as needed for settings cards
      };

      const result: CachedAccessResult = {
        timestamp: Date.now(),
        isPlatformAdmin: isAdmin,
        userRole,
        permissions,
      };

      // Cache in memory and sessionStorage
      setCachedResult(result);
      sessionStorage.setItem(SETTINGS_ACCESS_CACHE_KEY, JSON.stringify(result));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions when user is available and cache is invalid
  useEffect(() => {
    if (user && !isCacheValid) {
      fetchPermissions();
    }
  }, [user, isCacheValid]);

  // Clear cache when user changes
  useEffect(() => {
    if (!user) {
      setCachedResult(null);
      sessionStorage.removeItem(SETTINGS_ACCESS_CACHE_KEY);
    }
  }, [user]);

  const hasPermission = (permission: keyof typeof AccessPresets): boolean => {
    if (!cachedResult) return false;

    // Map permission presets to cached permissions
    switch (permission) {
      case 'PLATFORM_ADMIN_ONLY':
        return cachedResult.permissions.platformAdmin;
      case 'PLATFORM_STAFF':
        return cachedResult.permissions.platformStaff;
      case 'PLATFORM_SUPPORT':
        return cachedResult.permissions.platformStaff;
      default:
        return false;
    }
  };

  const refetch = async () => {
    setCachedResult(null);
    sessionStorage.removeItem(SETTINGS_ACCESS_CACHE_KEY);
    await fetchPermissions();
  };

  return {
    isPlatformAdmin: cachedResult?.isPlatformAdmin ?? false,
    userRole: cachedResult?.userRole ?? null,
    hasPermission,
    loading: authLoading || loading,
    error,
    refetch,
  };
}
