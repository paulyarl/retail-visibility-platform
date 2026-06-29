/**
 * Directory Home — Switchable Layout Types
 *
 * Mirrors the storefront layout system (resolveStorefrontLayout / StorefrontLayoutProps)
 * but for the platform-admin-controlled directory home page.
 *
 * Three variants (discovery / editorial / immersive) all consume the same
 * useDirectoryData() hook output via identical DirectoryLayoutProps.
 */

import type { DirectoryStore, DirectoryCategory } from '@/services/DirectorySingletonService';
import type { ActiveFeaturedResult } from '@/services/ActiveFeaturedService';
export type { DirectoryCategory };

// ---------------------------------------------------------------------------
// Layout identifiers
// ---------------------------------------------------------------------------

export type DirectoryLayoutKey = 'discovery' | 'editorial' | 'immersive';

// ---------------------------------------------------------------------------
// Variant resolution (mirror resolveStorefrontLayout)
// ---------------------------------------------------------------------------

export function resolveDirectoryLayout(
  stored?: string | null,
  preview?: string | null,
): DirectoryLayoutKey {
  const valid: DirectoryLayoutKey[] = ['discovery', 'editorial', 'immersive'];
  if (preview && valid.includes(preview as DirectoryLayoutKey)) {
    return preview as DirectoryLayoutKey;
  }
  if (stored && valid.includes(stored as DirectoryLayoutKey)) {
    return stored as DirectoryLayoutKey;
  }
  return 'discovery';
}

// ---------------------------------------------------------------------------
// Variant metadata (mirror STOREFRONT_OPT_TYPE_META)
// ---------------------------------------------------------------------------

export interface DirectoryLayoutMeta {
  label: string;
  description: string;
  icon: string;
}

export const DIRECTORY_LAYOUT_META: Record<DirectoryLayoutKey, DirectoryLayoutMeta> = {
  discovery: {
    label: 'Discovery',
    description:
      'Location-first marketplace grid with sticky filters and distance badges.',
    icon: '🧭',
  },
  editorial: {
    label: 'Editorial',
    description:
      'Storytelling emphasis: large hero, curated featured rows, magazine-style sections.',
    icon: '📰',
  },
  immersive: {
    label: 'Immersive',
    description:
      'Edge-to-edge map + results split view, compact cards, conversion-focused.',
    icon: '🗺️',
  },
};

// ---------------------------------------------------------------------------
// Shared data types for useDirectoryData return
// ---------------------------------------------------------------------------

export type DirectoryViewMode = 'grid' | 'list' | 'map';

export interface DirectoryStoreType {
  id: string;
  name: string;
  slug: string;
  storeCount: number;
  description?: string;
}

export interface DirectoryUserLocation {
  latitude: number;
  longitude: number;
  city: string;
  state: string;
}

export interface DirectoryPaginationInfo {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface DirectoryCounts {
  totalStores: number;
  totalCategories: number;
  openNowCount: number;
}

// ---------------------------------------------------------------------------
// Shared props contract every variant receives (identical data)
// ---------------------------------------------------------------------------

/**
 * The return type of useDirectoryData().
 * Every layout variant receives this exact object — no variant fetches independently.
 */
export interface DirectoryData {
  // Store results
  stores: DirectoryStore[];
  loading: boolean;
  error: string | null;
  pagination: DirectoryPaginationInfo | null;

  // Filter / browse data
  categories: DirectoryCategory[];
  storeTypes: DirectoryStoreType[];
  userLocation: DirectoryUserLocation | null;

  // UI state
  viewMode: DirectoryViewMode;
  pageSize: number;

  // Counts
  counts: DirectoryCounts;

  // URL-derived state
  searchQuery: string | null;
  activeCategory: string | null;
  activeSort: string;
  hasLocation: boolean;
  hasActiveQuery: boolean;

  // Active featured products (from ActiveFeaturedResolver)
  activeFeatured?: ActiveFeaturedResult;

  // Handlers
  setViewMode: (mode: DirectoryViewMode) => void;
  setPageSize: (size: number) => void;
  handlePageChange: (page: number) => void;
  refetch: () => Promise<void>;
}

export interface DirectoryLayoutProps {
  variant: DirectoryLayoutKey;
  data: DirectoryData;
}
