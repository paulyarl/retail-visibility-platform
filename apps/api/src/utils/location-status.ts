/**
 * Location Status Utility Functions
 * 
 * Provides business logic for location lifecycle management including:
 * - Access control based on status
 * - Visibility rules for storefronts and directories
 * - Status transition validation
 * - Display information
 */

export type LocationStatus = 'pending' | 'active' | 'inactive' | 'closed' | 'archived';
export type UserRole = 'PLATFORM_ADMIN' | 'PLATFORM_SUPPORT' | 'PLATFORM_VIEWER' | 'TENANT_OWNER' | 'TENANT_ADMIN' | 'TENANT_MANAGER' | 'TENANT_MEMBER' | 'TENANT_VIEWER';

/**
 * Status transition rules - defines which status changes are allowed
 */
export const STATUS_TRANSITIONS: Record<LocationStatus, LocationStatus[]> = {
  pending: ['active', 'archived'],
  active: ['inactive', 'closed', 'archived'],
  inactive: ['active', 'closed', 'archived'],
  closed: ['archived'],
  archived: ['active'], // Cannot transition from archived
};

/**
 * Check if a user can access a location based on its status and their role
 */
export function canAccessLocation(status: LocationStatus, userRole: UserRole): boolean {
  // Platform admins can access everything
  if (userRole === 'PLATFORM_ADMIN') {
    return true;
  }

  // Platform support can access everything except archived
  if (userRole === 'PLATFORM_SUPPORT') {
    return status !== 'archived';
  }

  // Platform viewers can view everything except archived
  if (userRole === 'PLATFORM_VIEWER') {
    return status !== 'archived';
  }

  // Tenant users can access their locations based on status
  switch (status) {
    case 'pending':
    case 'active':
    case 'inactive':
      return true; // Full access
    case 'closed':
      return ['TENANT_OWNER', 'TENANT_ADMIN'].includes(userRole); // Read-only for 90 days
    case 'archived':
      return false; // Only platform admins
    default:
      return false;
  }
}

/**
 * Check if a location should sync to Google based on its status
 */
export function canSyncLocation(status: LocationStatus): boolean {
  return status === 'active';
}

/**
 * Check if a location should appear in the directory
 */
export function shouldShowInDirectory(status: LocationStatus): boolean {
  return ['active', 'inactive', 'closed'].includes(status);
}

/**
 * Check if a location's storefront should be accessible
 */
export function shouldShowStorefront(status: LocationStatus): boolean {
  return ['active', 'inactive', 'closed'].includes(status);
}

/**
 * Check if a location should count toward tier limits
 */
export function countsTowardLimits(status: LocationStatus): boolean {
  // Archived locations don't count
  return status !== 'archived';
}

/**
 * Check if a location should be billed
 */
export function shouldBeBilled(status: LocationStatus): boolean {
  // Archived locations are not billed
  return status !== 'archived';
}

/**
 * Get allowed status transitions from current status
 */
export function getStatusTransitions(currentStatus: LocationStatus): LocationStatus[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

/**
 * Validate if a status change is allowed
 */
export function validateStatusChange(
  fromStatus: LocationStatus,
  toStatus: LocationStatus,
  reason?: string
): { valid: boolean; error?: string } {
  console.log(`[validateStatusChange] Validating transition: ${fromStatus} → ${toStatus}`, {
    fromStatus,
    toStatus,
    reason: reason?.substring(0, 50),
    timestamp: new Date().toISOString()
  });

  // Allow no-op transitions (same status)
  if (fromStatus === toStatus) {
    console.log(`[validateStatusChange] Allowing no-op transition: ${fromStatus} → ${toStatus}`);
    return { valid: true };
  }

  // Check if transition is allowed
  const allowedTransitions = getStatusTransitions(fromStatus);
  console.log(`[validateStatusChange] Allowed transitions from ${fromStatus}:`, allowedTransitions);

  if (!allowedTransitions.includes(toStatus)) {
    const error = `Cannot transition from ${fromStatus} to ${toStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`;
    console.log(`[validateStatusChange] Transition blocked:`, error);
    return {
      valid: false,
      error,
    };
  }

  // Require reason for closed or archived
  if ((toStatus === 'closed' || toStatus === 'archived') && !reason) {
    const error = `Reason is required when changing status to ${toStatus}`;
    console.log(`[validateStatusChange] Reason required but missing for ${toStatus}`);
    return {
      valid: false,
      error,
    };
  }

  console.log(`[validateStatusChange] Transition validated successfully: ${fromStatus} → ${toStatus}`);
  return { valid: true };
}

/**
 * Get display information for a status
 */
export interface LocationStatusInfo {
  status: LocationStatus;
  label: string;
  description: string;
  color: 'green' | 'yellow' | 'orange' | 'red' | 'gray';
  icon: string;
  canSync: boolean;
  showInDirectory: boolean;
  showStorefront: boolean;
  countsTowardLimits: boolean;
  shouldBeBilled: boolean;
}

export function getLocationStatusInfo(status: LocationStatus): LocationStatusInfo {
  const baseInfo = {
    status,
    canSync: canSyncLocation(status),
    showInDirectory: shouldShowInDirectory(status),
    showStorefront: shouldShowStorefront(status),
    countsTowardLimits: countsTowardLimits(status),
    shouldBeBilled: shouldBeBilled(status),
  };

  switch (status) {
    case 'pending':
      return {
        ...baseInfo,
        label: 'Pending',
        description: 'New location being set up',
        color: 'yellow',
        icon: '⏳',
      };
    case 'active':
      return {
        ...baseInfo,
        label: 'Active',
        description: 'Fully operational',
        color: 'green',
        icon: '✅',
      };
    case 'inactive':
      return {
        ...baseInfo,
        label: 'Temporarily Closed',
        description: 'Seasonal closure or renovations',
        color: 'orange',
        icon: '⏸️',
      };
    case 'closed':
      return {
        ...baseInfo,
        label: 'Permanently Closed',
        description: 'No longer operational',
        color: 'red',
        icon: '🔒',
      };
    case 'archived':
      return {
        ...baseInfo,
        label: 'Archived',
        description: 'Historical record only',
        color: 'gray',
        icon: '📦',
      };
    default:
      return {
        ...baseInfo,
        label: 'Unknown',
        description: 'Unknown status',
        color: 'gray',
        icon: '❓',
      };
  }
}

/**
 * Get storefront message for non-active locations
 */
export function getStorefrontMessage(
  status: LocationStatus,
  reopeningDate?: Date | null
): { title: string; message: string } | null {
  switch (status) {
    case 'inactive':
      if (reopeningDate) {
        const dateStr = reopeningDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
        return {
          title: 'Temporarily Closed',
          message: `We're currently closed for renovations or seasonal closure. We'll reopen on ${dateStr}. Thank you for your patience!`,
        };
      }
      return {
        title: 'Temporarily Closed',
        message: "We're currently closed for renovations or seasonal closure. Please check back soon!",
      };
    case 'closed':
      return {
        title: 'Permanently Closed',
        message: 'This location is permanently closed. Thank you for your patronage over the years.',
      };
    case 'pending':
    case 'archived':
      return {
        title: 'Location Not Available',
        message: 'This location is not currently available.',
      };
    case 'active':
    default:
      return null;
  }
}

/**
 * Get directory badge info for a status
 */
export function getDirectoryBadge(status: LocationStatus): { text: string; color: string } | null {
  switch (status) {
    case 'inactive':
      return { text: 'Temporarily Closed', color: 'orange' };
    case 'closed':
      return { text: 'Permanently Closed', color: 'red' };
    case 'pending':
      return { text: 'Opening Soon', color: 'yellow' };
    case 'active':
    case 'archived':
    default:
      return null;
  }
}

/**
 * Check if a user can change a location's status
 */
export function canChangeStatus(userRole: UserRole): boolean {
  return ['PLATFORM_ADMIN', 'TENANT_OWNER', 'TENANT_ADMIN'].includes(userRole);
}

/**
 * Get billing multiplier for a status (1.0 = full price, 0.5 = half price, 0 = free)
 */
export function getBillingMultiplier(status: LocationStatus, daysSinceClosed?: number): number {
  switch (status) {
    case 'active':
    case 'inactive':
    case 'pending':
      return 1.0; // Full billing
    case 'closed':
      // 30-day grace period at full rate, then 50% for data retention
      if (daysSinceClosed !== undefined && daysSinceClosed > 30) {
        return 0.5; // Half price for data retention
      }
      return 1.0; // Full price during grace period
    case 'archived':
      return 0; // No billing
    default:
      return 1.0;
  }
}

/**
 * Check if a location should be included in propagation targets
 */
export function canBePropagationTarget(status: LocationStatus): boolean {
  return status === 'active';
}

/**
 * Get status change impact summary
 */
export interface StatusChangeImpact {
  storefront: string;
  directory: string;
  googleSync: string;
  billing: string;
  propagation: string;
}

export function getStatusChangeImpact(
  fromStatus: LocationStatus,
  toStatus: LocationStatus
): StatusChangeImpact {
  const fromInfo = getLocationStatusInfo(fromStatus);
  const toInfo = getLocationStatusInfo(toStatus);

  return {
    storefront: fromInfo.showStorefront === toInfo.showStorefront
      ? 'No change'
      : toInfo.showStorefront
      ? 'Storefront will be visible'
      : 'Storefront will be hidden',
    directory: fromInfo.showInDirectory === toInfo.showInDirectory
      ? 'No change'
      : toInfo.showInDirectory
      ? 'Will appear in directory'
      : 'Will be removed from directory',
    googleSync: fromInfo.canSync === toInfo.canSync
      ? 'No change'
      : toInfo.canSync
      ? 'Google sync will resume'
      : 'Google sync will pause',
    billing: fromInfo.shouldBeBilled === toInfo.shouldBeBilled
      ? 'No change'
      : toInfo.shouldBeBilled
      ? 'Billing will resume'
      : 'Billing will stop',
    propagation: canBePropagationTarget(fromStatus) === canBePropagationTarget(toStatus)
      ? 'No change'
      : canBePropagationTarget(toStatus)
      ? 'Can receive propagated changes'
      : 'Will not receive propagated changes',
  };
}
