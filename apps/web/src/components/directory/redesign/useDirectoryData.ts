'use client';

/**
 * useDirectoryData — Single shared hook for the directory home page.
 *
 * Encapsulates ALL logic currently spread across DirectoryClient.tsx:
 * - useDirectoryStores (store search/pagination/caching)
 * - Categories & store-types fetch via DirectorySingletonService
 * - Geolocation auto-detect + URL param sync
 * - Behavior tracking (page view + search)
 * - View-mode & page-size persistence (localStorage)
 * - Pagination handlers (router.push, not window.location.href)
 *
 * Every layout variant (discovery / editorial / immersive) consumes the
 * same returned DirectoryData object — no variant fetches independently.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useDirectoryStores } from '@/hooks/useDirectoryStores';
import { directoryService } from '@/services/DirectorySingletonService';
import type { DirectoryCategory, DirectoryStore } from '@/services/DirectorySingletonService';
import { externalApiService } from '@/services/ExternalApiService';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import type {
  DirectoryData,
  DirectoryViewMode,
  DirectoryStoreType,
  DirectoryUserLocation,
  DirectoryPaginationInfo,
  DirectoryCounts,
} from './types';

// ---------------------------------------------------------------------------
// Cache config for categories & store types (localStorage with TTL)
// ---------------------------------------------------------------------------

const CACHE_CONFIG = {
  categories: {
    key: 'directory-categories',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
  storeTypes: {
    key: 'directory-store-types',
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },
};

function getCachedData<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const config = Object.values(CACHE_CONFIG).find((c) => c.key === key);
    if (!config || Date.now() - timestamp > config.ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

function setCachedData(key: string, data: unknown): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Geolocation utility (extracted from DirectoryClient)
// ---------------------------------------------------------------------------

async function getUserLocation(): Promise<DirectoryUserLocation | null> {
  try {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            enableHighAccuracy: true,
          });
        },
      );

      const { latitude, longitude } = position.coords;
      const data = await externalApiService.reverseGeocode(latitude, longitude);

      if (!data) {
        return { latitude, longitude, city: 'Unknown', state: 'Unknown' };
      }

      const address = data.address || {};
      const city =
        address.city || address.town || address.village || 'Unknown';
      const state = address.state || 'Unknown';

      return { latitude, longitude, city, state };
    }
  } catch {
    // fall through to IP-based
  }

  // Fallback to IP-based location
  try {
    const getUserIdFromContext = () => {
      const userId =
        localStorage.getItem('userId') ||
        sessionStorage.getItem('userId');
      if (userId) return userId;
      const cookies = document.cookie.split(';');
      const userIdCookie = cookies.find((cookie) =>
        cookie.trim().startsWith('userId='),
      );
      if (userIdCookie) return userIdCookie.split('=')[1]?.trim();
      return null;
    };

    const getSessionIdFromContext = () => {
      let sessionId = sessionStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId =
          'session_' +
          Date.now() +
          '_' +
          Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('sessionId', sessionId);
      }
      return sessionId;
    };

    const userId = getUserIdFromContext();
    const sessionId = getSessionIdFromContext();
    const userContext = userId || sessionId || 'anonymous';
    const cacheKey = `ip-geolocation-${userContext}`;

    const ipLocation = await externalApiService.getIpGeolocation(cacheKey);

    if (!ipLocation || !ipLocation.latitude || !ipLocation.longitude) {
      return null;
    }

    return {
      latitude: ipLocation.latitude,
      longitude: ipLocation.longitude,
      city: ipLocation.city || 'Unknown',
      state: ipLocation.region || 'Unknown',
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDirectoryData(): DirectoryData {
  const searchParams = useSearchParams();
  const router = useRouter();

  // --- URL-derived params ---
  const searchQuery =
    searchParams.get('q') || searchParams.get('search') || null;
  const activeCategory = searchParams.get('category') || null;
  const activeSort = searchParams.get('sort') || 'activity';
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const hasLocation = !!(latParam && lngParam);
  const pageParam = searchParams.get('page')
    ? parseInt(searchParams.get('page')!, 10)
    : 1;
  const limitParam = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : 24;

  // --- Store data via useDirectoryStores ---
  const {
    stores,
    loading,
    error,
    pagination,
    refetch,
  } = useDirectoryStores({
    search: searchQuery || undefined,
    category: activeCategory || undefined,
    lat:
      activeSort === 'distance' && latParam
        ? parseFloat(latParam)
        : undefined,
    lng:
      activeSort === 'distance' && lngParam
        ? parseFloat(lngParam)
        : undefined,
    sort: activeSort,
    page: pageParam,
    limit: limitParam,
  });

  // --- Categories & store types ---
  const [categories, setCategories] = useState<DirectoryCategory[]>([]);
  const [storeTypes, setStoreTypes] = useState<DirectoryStoreType[]>([]);

  // --- User location ---
  const [userLocation, setUserLocation] =
    useState<DirectoryUserLocation | null>(null);

  // --- UI state ---
  const [viewMode, setViewModeState] = useState<DirectoryViewMode>('grid');
  const [pageSize, setPageSizeState] = useState(24);

  // --- Track searches to avoid duplicate events ---
  const trackedSearchesRef = useRef<Set<string>>(new Set());

  // --- Hydration: load persisted view mode & page size ---
  useEffect(() => {
    const savedView = localStorage.getItem('directory-view-mode');
    if (
      savedView &&
      ['grid', 'list', 'map'].includes(savedView)
    ) {
      setViewModeState(savedView as DirectoryViewMode);
    }
    const savedPageSize = localStorage.getItem('directory-page-size');
    if (
      savedPageSize &&
      [12, 24, 48, 96].includes(Number(savedPageSize))
    ) {
      setPageSizeState(Number(savedPageSize));
    }

    // Track directory page view
    trackBehaviorClient({
      entityType: 'category',
      entityId: 'directory_home',
      entityName: 'Directory Home',
      pageType: 'directory_home',
    });
  }, []);

  // --- Auto-detect location on first visit ---
  useEffect(() => {
    if (latParam && lngParam) return; // already has location
    const autoLocationDisabled = localStorage.getItem(
      'directory-auto-location-disabled',
    );
    if (autoLocationDisabled === 'true') return;

    getUserLocation()
      .then((location) => {
        if (location) {
          setUserLocation(location);
          const params = new URLSearchParams(searchParams.toString());
          params.set('lat', location.latitude.toString());
          params.set('lng', location.longitude.toString());
          params.set('sort', 'distance');
          router.replace(`?${params.toString()}`, { scroll: false });
        }
      })
      .catch(() => {
        // non-fatal
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Fetch categories & store types ---
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        // Start non-blocking location detection for UI display
        getUserLocation()
          .then((loc) => setUserLocation(loc))
          .catch(() => setUserLocation(null));

        // Categories — clear cache to force fresh (matches existing behavior)
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CACHE_CONFIG.categories.key);
        }
        const cats = getCachedData<DirectoryCategory[]>(
          CACHE_CONFIG.categories.key,
        );
        if (!cats || cats.length === 0) {
          const categoriesData =
            await directoryService.getDirectoryCategories();
          if (categoriesData) {
            setCategories(categoriesData);
          } else {
            setCategories([]);
          }
        }

        // Store types — clear cache to force fresh (matches existing behavior)
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CACHE_CONFIG.storeTypes.key);
        }
        let types = getCachedData<DirectoryStoreType[]>(
          CACHE_CONFIG.storeTypes.key,
        );
        if (!types) {
          const typesData =
            await directoryService.getDirectoryStoreTypes();
          if (typesData) {
            types = typesData as DirectoryStoreType[];
          } else {
            types = [];
          }
        }
        setStoreTypes(types || []);
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };

    fetchFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Track search behavior (once per unique search) ---
  useEffect(() => {
    if (latParam && lngParam && activeSort === 'distance') {
      const searchKey = `near-me-${latParam}-${lngParam}`;
      if (!trackedSearchesRef.current.has(searchKey)) {
        trackedSearchesRef.current.add(searchKey);
        trackBehaviorClient({
          entityType: 'search',
          entityId: searchKey,
          entityName: 'Near Me Search',
          pageType: 'search_results',
          context: {
            searchType: 'location',
            latitude: parseFloat(latParam),
            longitude: parseFloat(lngParam),
            sort: activeSort,
          },
        });
      }
    } else if (searchQuery) {
      const searchKey = `search-${searchQuery}`;
      if (!trackedSearchesRef.current.has(searchKey)) {
        trackedSearchesRef.current.add(searchKey);
        trackBehaviorClient({
          entityType: 'search',
          entityId: searchKey,
          entityName: searchQuery,
          pageType: 'search_results',
          context: {
            searchType: 'text',
            query: searchQuery,
          },
        });
      }
    }
  }, [latParam, lngParam, activeSort, searchQuery]);

  // --- Handlers ---

  const setViewMode = useCallback((mode: DirectoryViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('directory-view-mode', mode);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    localStorage.setItem('directory-page-size', size.toString());
  }, []);

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      router.push(`/directory?${params.toString()}`, { scroll: true });
    },
    [searchParams, router],
  );

  // --- Derived counts ---
  const counts: DirectoryCounts = {
    totalStores: pagination?.totalItems ?? 0,
    totalCategories: categories.length,
    openNowCount: stores.filter(
      (s: DirectoryStore) => s.businessHours != null,
    ).length,
  };

  const hasActiveQuery = !!(
    searchQuery ||
    activeCategory ||
    searchParams.get('storeType') ||
    searchParams.get('q') ||
    searchParams.get('search')
  );

  // --- Normalized pagination ---
  const normalizedPagination: DirectoryPaginationInfo | null = pagination
    ? {
        page: pagination.page,
        limit: pagination.limit,
        totalItems: pagination.totalItems,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      }
    : null;

  return {
    stores,
    loading,
    error,
    pagination: normalizedPagination,
    categories,
    storeTypes,
    userLocation,
    viewMode,
    pageSize,
    counts,
    searchQuery,
    activeCategory,
    activeSort,
    hasLocation,
    hasActiveQuery,
    setViewMode,
    setPageSize,
    handlePageChange,
    refetch,
  };
}
