/**
 * useBadgeRegistry Hook
 *
 * React Query hook for fetching badge type definitions from the registry API.
 * Uses the public endpoint for system badges (storefront rendering) and
 * the tenant endpoint for tenant-scoped badges (management UI).
 *
 * Falls back to static data on error, so components always have badge metadata.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { badgeRegistryService, type BadgeTypeMeta } from '@/services/BadgeRegistryService';

const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const GC_TIME = 10 * 60 * 1000; // 10 minutes

/**
 * Fetch system badges (public, no auth needed).
 * Use this for storefront rendering, product cards, and public-facing displays.
 */
export function useSystemBadges() {
  return useQuery<BadgeTypeMeta[]>({
    queryKey: ['badge-registry', 'system'],
    queryFn: () => badgeRegistryService.fetchSystemBadges(),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    initialData: badgeRegistryService.getSystemBadges(),
  });
}

/**
 * Fetch tenant badges (system + custom, auth required).
 * Use this for tenant management UIs (FeaturedProductsManager, admin panels).
 */
export function useTenantBadges(tenantId?: string) {
  return useQuery<BadgeTypeMeta[]>({
    queryKey: ['badge-registry', 'tenant', tenantId],
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.fetchTenantBadges(tenantId);
    },
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    initialData: badgeRegistryService.getSystemBadges(),
  });
}

/**
 * Convenience hook: get a single badge by key from system badges.
 */
export function useBadgeMeta(key: string | null | undefined): BadgeTypeMeta | null {
  const { data } = useSystemBadges();
  if (!key) return null;
  return data?.find(b => b.key === key) ?? null;
}

/**
 * Convenience hook: check if a badge type is promotional.
 */
export function useIsPromotional(key: string | null | undefined): boolean {
  const badge = useBadgeMeta(key);
  return badge?.isPromotional ?? false;
}

/**
 * Convenience hook: get badge color CSS class by key.
 */
export function useBadgeColorClass(key: string | null | undefined): string {
  const { data } = useSystemBadges();
  if (!key || !data) return badgeRegistryService.getBadgeColorClass(key || '');
  const badge = data.find(b => b.key === key);
  if (!badge?.color) return 'bg-gray-100 text-gray-700 border-gray-300';

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-300',
    green: 'bg-green-100 text-green-700 border-green-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
    red: 'bg-red-100 text-red-700 border-red-300',
    purple: 'bg-purple-100 text-purple-700 border-purple-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    yellow: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    gold: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    teal: 'bg-teal-100 text-teal-700 border-teal-300',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    pink: 'bg-pink-100 text-pink-700 border-pink-300',
  };

  return colorMap[badge.color] || 'bg-gray-100 text-gray-700 border-gray-300';
}

/**
 * Fetch badge rule validation for a tenant (conflicts, auto-assign/remove suggestions).
 * Used by FeaturedProductsManager to show validation warnings.
 */
export function useBadgeRuleValidation(tenantId?: string) {
  return useQuery({
    queryKey: ['badge-registry', 'validation', tenantId],
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.fetchBadgeRuleValidation(tenantId);
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000, // 2 minutes (more frequent than badge metadata)
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch tenant custom badges (non-system only, with tier gate info).
 * Used by the custom badge management UI.
 */
export function useTenantCustomBadges(tenantId?: string) {
  return useQuery<{
    badges: BadgeTypeMeta[];
    usedSlots: number;
    hasAccess: boolean;
  }>({
    queryKey: ['badge-registry', 'custom', tenantId],
    queryFn: () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.fetchTenantCustomBadges(tenantId);
    },
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Create a custom badge for a tenant.
 */
export function useCreateCustomBadge(tenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; label: string; description?: string; icon?: string; color?: string }) => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.createCustomBadge(tenantId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'custom', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'tenant', tenantId] });
    },
  });
}

/**
 * Update a custom badge for a tenant.
 */
export function useUpdateCustomBadge(tenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ badgeId, input }: {
      badgeId: string;
      input: { label?: string; description?: string; icon?: string; color?: string; isActive?: boolean };
    }) => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.updateCustomBadge(tenantId, badgeId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'custom', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'tenant', tenantId] });
    },
  });
}

/**
 * Delete a custom badge for a tenant.
 */
export function useDeleteCustomBadge(tenantId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (badgeId: string) => {
      if (!tenantId) throw new Error('Tenant ID is required');
      return badgeRegistryService.deleteCustomBadge(tenantId, badgeId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'custom', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['badge-registry', 'tenant', tenantId] });
    },
  });
}
