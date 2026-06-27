/**
 * Capability Constraint Service
 *
 * Loads cross-capability constraints from the database with an in-memory cache.
 * Falls back to the static registry if the DB table is not yet populated.
 *
 * CCL Phase 4: DB-driven constraints.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import {
  CAPABILITY_CONSTRAINTS,
  type CrossCapabilityConstraint,
  type ConstraintType,
  type ConstraintSeverity,
  type ConstraintOperator,
} from './CapabilityConstraintRegistry';

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedConstraints: CrossCapabilityConstraint[] | null = null;
let cacheExpiry = 0;

function parseOperator(op: string): ConstraintOperator {
  switch (op) {
    case 'equals':
    case 'includes':
    case 'not_includes':
    case 'is_true':
    case 'is_false':
      return op;
    default:
      return 'equals';
  }
}

function parseValue(raw: string): string | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return raw;
}

function dbRowToConstraint(row: any): CrossCapabilityConstraint {
  return {
    id: row.constraint_id,
    type: row.type as ConstraintType,
    severity: row.severity as ConstraintSeverity,
    source: {
      capability: row.source_capability,
      field: row.source_field,
      operator: parseOperator(row.source_operator),
      value: parseValue(row.source_value),
    },
    target: {
      capability: row.target_capability,
      field: row.target_field,
      operator: parseOperator(row.target_operator),
      value: parseValue(row.target_value),
    },
    message: row.message,
    resolution_hint: row.resolution_hint,
  };
}

/**
 * Get all active constraints. Loads from DB with cache, falls back to static registry.
 */
export async function getActiveConstraints(): Promise<CrossCapabilityConstraint[]> {
  const now = Date.now();
  if (cachedConstraints && now < cacheExpiry) {
    return cachedConstraints;
  }

  try {
    const rows = await prisma.capability_constraints_list.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
    });

    if (rows.length === 0) {
      // DB table exists but empty — fall back to static
      cachedConstraints = CAPABILITY_CONSTRAINTS;
    } else {
      cachedConstraints = rows.map(dbRowToConstraint);
    }
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (error) {
    logger.warn('[CapabilityConstraintService] Failed to load constraints from DB, using static fallback', undefined, {
      error: (error as Error).message,
    });
    cachedConstraints = CAPABILITY_CONSTRAINTS;
    cacheExpiry = now + CACHE_TTL_MS;
  }

  return cachedConstraints;
}

/**
 * Invalidate the in-memory cache. Call after admin CRUD operations.
 */
export function invalidateConstraintCache(): void {
  cachedConstraints = null;
  cacheExpiry = 0;
}
