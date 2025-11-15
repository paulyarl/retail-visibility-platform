/**
 * Trash Capacity Utility
 * 
 * Calculates trash bin capacity as 5% of tier SKU limit
 * Prevents trash from growing indefinitely
 */

interface TierLimits {
  maxSKUs: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  google_only: { maxSKUs: 250 },
  starter: { maxSKUs: 500 },
  professional: { maxSKUs: 5000 },
  enterprise: { maxSKUs: Infinity },
  organization: { maxSKUs: Infinity },
};

const TRASH_CAPACITY_PERCENT = 0.05; // 5% of SKU limit
const DEFAULT_TRASH_CAPACITY = 25; // Default for unknown tiers or unlimited

/**
 * Calculate trash capacity for a given tier
 * @param tier - Subscription tier
 * @returns Maximum number of items allowed in trash
 */
export function getTrashCapacity(tier: string): number {
  const tierConfig = TIER_LIMITS[tier];
  
  if (!tierConfig) {
    return DEFAULT_TRASH_CAPACITY;
  }
  
  // For unlimited tiers, use a reasonable default
  if (tierConfig.maxSKUs === Infinity) {
    return 250; // 5% of 5000 (professional limit)
  }
  
  // Calculate 5% of SKU limit, minimum 10
  const capacity = Math.max(10, Math.ceil(tierConfig.maxSKUs * TRASH_CAPACITY_PERCENT));
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
