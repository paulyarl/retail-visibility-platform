/**
 * GBP Sync Tracking Service
 * 
 * Foundation for bidirectional sync between platform and Google Business Profile.
 * Tracks per-field sync state, detects changes, and manages sync history.
 * 
 * Sync States:
 * - synced: Local and Google values match
 * - pending_push: Local changed, needs to push to Google
 * - pending_pull: Google changed, needs to pull to local
 * - conflict: Both changed since last sync
 * - unknown: Never synced or no data
 */

import { prisma } from '../prisma';
import { createHash } from 'crypto';
import { generateQuickStart } from '../lib/id-generator';

// Field categories for sync tracking
export const SYNC_CATEGORIES = {
  BUSINESS_INFO: 'business_info',
  HOURS: 'hours',
  STATUS: 'status',
  CATEGORIES: 'categories',
  ATTRIBUTES: 'attributes',
  MEDIA: 'media',
} as const;

// Fields within each category
export const SYNC_FIELDS = {
  business_info: ['business_name', 'phone_number', 'website', 'address', 'description'],
  hours: ['regular_hours', 'special_hours', 'timezone'],
  status: ['location_status', 'reopening_date'],
  categories: ['primary_category', 'secondary_categories'],
  attributes: ['attributes'],
  media: ['logo', 'cover_photo', 'photos'],
} as const;

export type SyncStatus = 'synced' | 'pending_push' | 'pending_pull' | 'conflict' | 'unknown';
export type SyncDirection = 'push' | 'pull' | 'compare';
export type SyncResult = 'success' | 'failed' | 'partial' | 'skipped';

interface SyncTrackingRecord {
  id: string;
  tenant_id: string;
  field_category: string;
  field_name: string;
  local_value_hash: string | null;
  google_value_hash: string | null;
  local_updated_at: Date | null;
  google_updated_at: Date | null;
  last_sync_at: Date | null;
  last_sync_direction: string | null;
  sync_status: string;
  conflict_detected_at: Date | null;
  conflict_resolution: string | null;
}

/**
 * Generate a hash for a value (for comparison without storing full data)
 */
export function hashValue(value: any): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('md5').update(str).digest('hex');
}

/**
 * Get sync tracking records for a tenant
 */
export async function getSyncTracking(
  tenantId: string,
  category?: string
): Promise<SyncTrackingRecord[]> {
  const where: any = { tenant_id: tenantId };
  if (category) {
    where.field_category = category;
  }
  
  return prisma.gbp_sync_tracking.findMany({
    where,
    orderBy: [{ field_category: 'asc' }, { field_name: 'asc' }],
  });
}

/**
 * Get sync status summary for a tenant
 */
export async function getSyncStatusSummary(tenantId: string): Promise<{
  total: number;
  synced: number;
  pendingPush: number;
  pendingPull: number;
  conflicts: number;
  unknown: number;
  byCategory: Record<string, { status: SyncStatus; fields: number }>;
}> {
  const records = await getSyncTracking(tenantId);
  
  const summary = {
    total: records.length,
    synced: 0,
    pendingPush: 0,
    pendingPull: 0,
    conflicts: 0,
    unknown: 0,
    byCategory: {} as Record<string, { status: SyncStatus; fields: number }>,
  };
  
  const categoryStats: Record<string, { statuses: SyncStatus[]; fields: number }> = {};
  
  for (const record of records) {
    // Count by status
    switch (record.sync_status) {
      case 'synced':
        summary.synced++;
        break;
      case 'pending_push':
        summary.pendingPush++;
        break;
      case 'pending_pull':
        summary.pendingPull++;
        break;
      case 'conflict':
        summary.conflicts++;
        break;
      default:
        summary.unknown++;
    }
    
    // Group by category
    if (!categoryStats[record.field_category]) {
      categoryStats[record.field_category] = { statuses: [], fields: 0 };
    }
    categoryStats[record.field_category].statuses.push(record.sync_status as SyncStatus);
    categoryStats[record.field_category].fields++;
  }
  
  // Determine overall status per category (worst status wins)
  for (const [category, stats] of Object.entries(categoryStats)) {
    let categoryStatus: SyncStatus = 'synced';
    if (stats.statuses.includes('conflict')) {
      categoryStatus = 'conflict';
    } else if (stats.statuses.includes('pending_push')) {
      categoryStatus = 'pending_push';
    } else if (stats.statuses.includes('pending_pull')) {
      categoryStatus = 'pending_pull';
    } else if (stats.statuses.includes('unknown')) {
      categoryStatus = 'unknown';
    }
    summary.byCategory[category] = { status: categoryStatus, fields: stats.fields };
  }
  
  return summary;
}

/**
 * Update local value tracking (call when local data changes)
 */
export async function updateLocalValue(
  tenantId: string,
  category: string,
  fieldName: string,
  value: any
): Promise<SyncTrackingRecord> {
  const valueHash = hashValue(value);
  const now = new Date();
  
  // Find existing record
  const existing = await prisma.gbp_sync_tracking.findUnique({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
  });
  
  // Determine new sync status
  let newStatus: SyncStatus = 'pending_push';
  let conflictDetectedAt: Date | null = null;
  
  if (existing) {
    if (existing.google_value_hash === valueHash) {
      // Local now matches Google
      newStatus = 'synced';
    } else if (existing.google_value_hash && existing.google_updated_at && 
               existing.google_updated_at > (existing.last_sync_at || new Date(0))) {
      // Google also changed since last sync - conflict!
      newStatus = 'conflict';
      conflictDetectedAt = now;
    }
  }
  
  // Upsert the tracking record
  return prisma.gbp_sync_tracking.upsert({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
    create: {
      id: generateQuickStart('gbpst'),
      tenant_id: tenantId,
      field_category: category,
      field_name: fieldName,
      local_value_hash: valueHash,
      local_updated_at: now,
      sync_status: newStatus,
      conflict_detected_at: conflictDetectedAt,
    },
    update: {
      local_value_hash: valueHash,
      local_updated_at: now,
      sync_status: newStatus,
      conflict_detected_at: conflictDetectedAt,
      updated_at: now,
    },
  });
}

/**
 * Update Google value tracking (call after reading from Google API)
 */
export async function updateGoogleValue(
  tenantId: string,
  category: string,
  fieldName: string,
  value: any
): Promise<SyncTrackingRecord> {
  const valueHash = hashValue(value);
  const now = new Date();
  
  // Find existing record
  const existing = await prisma.gbp_sync_tracking.findUnique({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
  });
  
  // Determine new sync status
  let newStatus: SyncStatus = 'pending_pull';
  let conflictDetectedAt: Date | null = null;
  
  if (existing) {
    if (existing.local_value_hash === valueHash) {
      // Google now matches local
      newStatus = 'synced';
    } else if (existing.local_value_hash && existing.local_updated_at && 
               existing.local_updated_at > (existing.last_sync_at || new Date(0))) {
      // Local also changed since last sync - conflict!
      newStatus = 'conflict';
      conflictDetectedAt = now;
    }
  }
  
  // Upsert the tracking record
  return prisma.gbp_sync_tracking.upsert({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
    create: {
      id: generateQuickStart('gbpst'),
      tenant_id: tenantId,
      field_category: category,
      field_name: fieldName,
      google_value_hash: valueHash,
      google_updated_at: now,
      sync_status: newStatus,
      conflict_detected_at: conflictDetectedAt,
    },
    update: {
      google_value_hash: valueHash,
      google_updated_at: now,
      sync_status: newStatus,
      conflict_detected_at: conflictDetectedAt,
      updated_at: now,
    },
  });
}

/**
 * Mark a field as synced (call after successful sync operation)
 */
export async function markAsSynced(
  tenantId: string,
  category: string,
  fieldName: string,
  direction: 'push' | 'pull',
  valueHash: string
): Promise<SyncTrackingRecord> {
  const now = new Date();
  
  return prisma.gbp_sync_tracking.upsert({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
    create: {
      id: generateQuickStart('gbpst'),
      tenant_id: tenantId,
      field_category: category,
      field_name: fieldName,
      local_value_hash: valueHash,
      google_value_hash: valueHash,
      local_updated_at: now,
      google_updated_at: now,
      last_sync_at: now,
      last_sync_direction: direction,
      sync_status: 'synced',
    },
    update: {
      local_value_hash: valueHash,
      google_value_hash: valueHash,
      last_sync_at: now,
      last_sync_direction: direction,
      sync_status: 'synced',
      conflict_detected_at: null,
      conflict_resolution: null,
      updated_at: now,
    },
  });
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  tenantId: string,
  category: string,
  fieldName: string,
  resolution: 'local_wins' | 'google_wins' | 'manual',
  finalValueHash: string
): Promise<SyncTrackingRecord> {
  const now = new Date();
  
  return prisma.gbp_sync_tracking.update({
    where: {
      tenant_id_field_category_field_name: {
        tenant_id: tenantId,
        field_category: category,
        field_name: fieldName,
      },
    },
    data: {
      local_value_hash: finalValueHash,
      google_value_hash: finalValueHash,
      last_sync_at: now,
      last_sync_direction: resolution === 'local_wins' ? 'push' : 'pull',
      sync_status: 'synced',
      conflict_resolution: resolution,
      updated_at: now,
    },
  });
}

/**
 * Log a sync operation to history
 */
export async function logSyncOperation(
  tenantId: string,
  category: string,
  fieldName: string | null,
  direction: SyncDirection,
  status: SyncResult,
  options?: {
    localValueBefore?: any;
    googleValueBefore?: any;
    valueAfter?: any;
    errorMessage?: string;
    errorCode?: string;
    initiatedBy?: 'user' | 'system' | 'webhook' | 'scheduled';
  }
): Promise<void> {
  await prisma.gbp_sync_history.create({
    data: {
      id: generateQuickStart('gbpsh'),
      tenant_id: tenantId,
      field_category: category,
      field_name: fieldName,
      sync_direction: direction,
      sync_status: status,
      local_value_before: options?.localValueBefore ? JSON.stringify(options.localValueBefore) : null,
      google_value_before: options?.googleValueBefore ? JSON.stringify(options.googleValueBefore) : null,
      value_after: options?.valueAfter ? JSON.stringify(options.valueAfter) : null,
      error_message: options?.errorMessage || null,
      error_code: options?.errorCode || null,
      initiated_by: options?.initiatedBy || 'system',
    },
  });
}

/**
 * Get sync history for a tenant
 */
export async function getSyncHistory(
  tenantId: string,
  options?: {
    category?: string;
    limit?: number;
    offset?: number;
  }
): Promise<any[]> {
  const where: any = { tenant_id: tenantId };
  if (options?.category) {
    where.field_category = options.category;
  }
  
  return prisma.gbp_sync_history.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  });
}

/**
 * Initialize sync tracking for a tenant (create records for all fields)
 */
export async function initializeSyncTracking(tenantId: string): Promise<void> {
  const now = new Date();
  
  for (const [category, fields] of Object.entries(SYNC_FIELDS)) {
    for (const fieldName of fields) {
      await prisma.gbp_sync_tracking.upsert({
        where: {
          tenant_id_field_category_field_name: {
            tenant_id: tenantId,
            field_category: category,
            field_name: fieldName,
          },
        },
        create: {
          id: generateQuickStart('gbpst'),
          tenant_id: tenantId,
          field_category: category,
          field_name: fieldName,
          sync_status: 'unknown',
        },
        update: {
          // Don't overwrite existing data
        },
      });
    }
  }
  
  console.log(`[SyncTracking] Initialized tracking for tenant ${tenantId}`);
}

/**
 * Get fields that need to be pushed to Google
 */
export async function getFieldsPendingPush(tenantId: string): Promise<SyncTrackingRecord[]> {
  return prisma.gbp_sync_tracking.findMany({
    where: {
      tenant_id: tenantId,
      sync_status: 'pending_push',
    },
  });
}

/**
 * Get fields that need to be pulled from Google
 */
export async function getFieldsPendingPull(tenantId: string): Promise<SyncTrackingRecord[]> {
  return prisma.gbp_sync_tracking.findMany({
    where: {
      tenant_id: tenantId,
      sync_status: 'pending_pull',
    },
  });
}

/**
 * Get fields with conflicts
 */
export async function getConflicts(tenantId: string): Promise<SyncTrackingRecord[]> {
  return prisma.gbp_sync_tracking.findMany({
    where: {
      tenant_id: tenantId,
      sync_status: 'conflict',
    },
  });
}
