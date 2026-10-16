/**
 * Trash Capacity Utility
 * 
 * Calculates trash bin capacity as 5% of tier SKU limit
 * Prevents trash from growing indefinitely
 */
import { DEFAULT_TIER } from './tier-defaults';

interface TierLimits {
  maxSkus: number;
}

// Exported for the tier-contract guard (sprint plan 4.4): subset limit map —
// keys must stay ⊆ the contract tier universe.
export const TRASH_TIER_LIMITS: Record<string, TierLimits> = {
  directory_presence: { maxSkus: 5 },
  google_only: { maxSkus: 250 },
  discovery: { maxSkus: 1000 },
  storefront: { maxSkus: 5000 },
  commitment: { maxSkus: 10000 },
  starter: { maxSkus: 500 },
  professional: { maxSkus: 5000 },
  enterprise: { maxSkus: Infinity },
  organization: { maxSkus: Infinity },
};

const TRASH_CAPACITY_PERCENT = 0.05; // 5% of SKU limit
// 1.7: "no/unknown tier" resolves through DEFAULT_TIER's limits row
// (directory_presence → 5 SKUs → 5% → min-10 floor), not a hardcoded 25.
const DEFAULT_TRASH_CAPACITY = Math.max(
  10,
  Math.ceil((TRASH_TIER_LIMITS[DEFAULT_TIER]?.maxSkus ?? 5) * TRASH_CAPACITY_PERCENT),
);

/**
 * Calculate trash capacity for a given tier
 * @param tier - Subscription tier
 * @returns Maximum number of items allowed in trash
 */
export function getTrashCapacity(tier: string): number {
  const tierConfig = TRASH_TIER_LIMITS[tier];
  
  if (!tierConfig) {
    return DEFAULT_TRASH_CAPACITY;
  }
  
  // For unlimited tiers, use a reasonable default
  if (tierConfig.maxSkus === Infinity) {
    return 250; // 5% of 5000 (professional limit)
  }
  
  // Calculate 5% of SKU limit, minimum 10
  const capacity = Math.max(10, Math.ceil(tierConfig.maxSkus * TRASH_CAPACITY_PERCENT));
  return capacity;
}

/**
 * Check if trash is at capacity
 * @param currentTrashCount - Current number of items in trash
 * @param tier - Subscription tier
 * @returns true if trash is full
 */
export function isTrashFull(currentTrashCount: number, tier: string): boolean {
  const capacity = getTrashCapacity(tier);
  return currentTrashCount >= capacity;
}

/**
 * Get trash capacity info for display
 * @param currentTrashCount - Current number of items in trash
 * @param tier - Subscription tier
 * @returns Capacity info object
 */
export function getTrashCapacityInfo(currentTrashCount: number, tier: string) {
  const capacity = getTrashCapacity(tier);
  const percent = Math.min(100, Math.round((currentTrashCount / capacity) * 100));
  const remaining = Math.max(0, capacity - currentTrashCount);
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  let color: 'green' | 'yellow' | 'red' = 'green';
  
  if (percent >= 100) {
    status = 'critical';
    color = 'red';
  } else if (percent >= 80) {
    status = 'warning';
    color = 'yellow';
  }
  
  return {
    current: currentTrashCount,
    capacity,
    remaining,
    percent,
    status,
    color,
    isFull: currentTrashCount >= capacity,
  };
}
