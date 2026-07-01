/**
 * Badge Rule Engine
 *
 * Evaluates declarative auto_assign_rule and auto_remove_rule JSONB
 * from the featured_type_registry against product data.
 *
 * Rule format (JSONB):
 * {
 *   "condition": "and" | "or" | "manual",
 *   "rules": [
 *     { "field": "sale_price_cents", "op": "isNotNull" },
 *     { "field": "sale_price_cents", "op": "lt", "fieldRef": "price_cents" },
 *     { "field": "created_at", "op": "gte", "value": { "daysAgo": 14 } },
 *     { "field": "stock", "op": "lte", "value": 3 }
 *   ]
 * }
 *
 * Supported operators:
 *   eq, neq, lt, lte, gt, gte, isNull, isNotNull
 *
 * Special value formats:
 *   { "daysAgo": N } — computed as now - N days
 *   fieldRef — compares against another field on the same product
 *   factor — multiplies fieldRef value (e.g., 0.5 = half price)
 */

import { prisma } from '../prisma';
import { getBadgesWithRules, getConflictPairs } from './BadgeRegistryService';

// ====================
// TYPES
// ====================

export interface RuleCondition {
  field: string;
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'isNull' | 'isNotNull';
  value?: any;
  fieldRef?: string;
  factor?: number;
}

export interface RuleGroup {
  condition: 'and' | 'or' | 'manual';
  rules?: RuleCondition[];
  note?: string;
}

export interface ProductData {
  inventory_item_id: string;
  tenant_id: string;
  name: string;
  price_cents: number | null;
  sale_price_cents: number | null;
  stock: number | null;
  created_at: Date | null;
  item_status: string | null;
  has_variants: boolean | null;
}

export interface RuleEvaluationResult {
  shouldAssign: boolean;
  shouldRemove: boolean;
  reason: string;
}

export interface ConflictPair {
  badgeKey: string;
  conflictsWith: string[];
}

// ====================
// RULE ENGINE
// ====================

/**
 * Evaluate a single condition against product data.
 */
function evaluateCondition(condition: RuleCondition, product: ProductData): boolean {
  const fieldValue = (product as any)[condition.field];

  // Handle null checks first
  if (condition.op === 'isNull') {
    return fieldValue === null || fieldValue === undefined;
  }
  if (condition.op === 'isNotNull') {
    return fieldValue !== null && fieldValue !== undefined;
  }

  // For comparison ops, if field is null, condition is false
  if (fieldValue === null || fieldValue === undefined) {
    return false;
  }

  // Resolve comparison value
  let compareValue = condition.value;

  // Handle { daysAgo: N } value format
  if (compareValue && typeof compareValue === 'object' && 'daysAgo' in compareValue) {
    const daysAgo = (compareValue as any).daysAgo;
    compareValue = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  }

  // Handle fieldRef — compare against another field on the product
  if (condition.fieldRef) {
    const refValue = (product as any)[condition.fieldRef];
    if (refValue === null || refValue === undefined) {
      return false;
    }
    let effectiveRef = refValue;
    if (condition.factor) {
      effectiveRef = typeof refValue === 'number' ? refValue * condition.factor : refValue;
    }
    return compareValues(Number(fieldValue), condition.op, Number(effectiveRef));
  }

  return compareValues(fieldValue, condition.op, compareValue);
}

/**
 * Compare two values with the given operator.
 */
function compareValues(actual: any, op: string, expected: any): boolean {
  switch (op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'lt': return actual < expected;
    case 'lte': return actual <= expected;
    case 'gt': return actual > expected;
    case 'gte': return actual >= expected;
    default: return false;
  }
}

/**
 * Evaluate a rule group (AND/OR) against product data.
 */
export function evaluateRuleGroup(rule: RuleGroup | null, product: ProductData): boolean {
  if (!rule) return false;
  if (rule.condition === 'manual') return false; // Manual rules never auto-evaluate
  if (!rule.rules || rule.rules.length === 0) return false;

  if (rule.condition === 'and') {
    return rule.rules.every(cond => evaluateCondition(cond, product));
  } else {
    return rule.rules.some(cond => evaluateCondition(cond, product));
  }
}

// ====================
// BATCH EVALUATION
// ====================

/**
 * Check if assigning a badge would conflict with existing badges on the same product.
 */
export function checkConflicts(
  badgeKey: string,
  existingBadges: string[],
  conflictPairs: ConflictPair[]
): string[] {
  const conflicts: string[] = [];
  const entry = conflictPairs.find(c => c.badgeKey === badgeKey);
  if (entry) {
    for (const existing of existingBadges) {
      if (entry.conflictsWith.includes(existing)) {
        conflicts.push(existing);
      }
    }
  }
  // Also check reverse: does any existing badge conflict with this one?
  for (const existing of existingBadges) {
    const reverseEntry = conflictPairs.find(c => c.badgeKey === existing);
    if (reverseEntry && reverseEntry.conflictsWith.includes(badgeKey)) {
      if (!conflicts.includes(existing)) {
        conflicts.push(existing);
      }
    }
  }
  return conflicts;
}

/**
 * Fetch product data for rule evaluation.
 */
export async function fetchProductData(tenantId: string): Promise<ProductData[]> {
  const products = await prisma.inventory_items.findMany({
    where: {
      tenant_id: tenantId,
      item_status: 'active',
    },
    select: {
      id: true,
      tenant_id: true,
      name: true,
      price_cents: true,
      sale_price_cents: true,
      stock: true,
      created_at: true,
      item_status: true,
      has_variants: true,
    },
  });

  return products.map((p) => ({
    inventory_item_id: p.id,
    tenant_id: p.tenant_id,
    name: p.name,
    price_cents: p.price_cents,
    sale_price_cents: p.sale_price_cents,
    stock: p.stock,
    created_at: p.created_at,
    item_status: p.item_status,
    has_variants: p.has_variants,
  }));
}

/**
 * Evaluate all badge rules for a tenant's products.
 * Returns a list of actions: assign, remove, or conflict warnings.
 */
export async function evaluateBadgeRulesForTenant(
  tenantId: string
): Promise<{
  toAssign: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
  toRemove: Array<{ inventoryItemId: string; badgeKey: string; reason: string }>;
  conflicts: Array<{ inventoryItemId: string; badgeKey: string; conflictsWith: string[] }>;
}> {
  const toAssign: Array<{ inventoryItemId: string; badgeKey: string; reason: string }> = [];
  const toRemove: Array<{ inventoryItemId: string; badgeKey: string; reason: string }> = [];
  const conflicts: Array<{ inventoryItemId: string; badgeKey: string; conflictsWith: string[] }> = [];

  const badgesWithRules = await getBadgesWithRules();
  if (badgesWithRules.length === 0) return { toAssign, toRemove, conflicts };

  const conflictPairs = await getConflictPairs();
  const products = await fetchProductData(tenantId);

  // Get existing auto-assigned badges for these products
  const existingAutoBadges = await prisma.featured_products.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      assignment_source: 'auto',
    },
    select: { inventory_item_id: true, featured_type: true },
  });

  const autoBadgeMap = new Map<string, Set<string>>();
  for (const ab of existingAutoBadges) {
    if (!autoBadgeMap.has(ab.inventory_item_id)) {
      autoBadgeMap.set(ab.inventory_item_id, new Set());
    }
    autoBadgeMap.get(ab.inventory_item_id)!.add(ab.featured_type);
  }

  for (const product of products) {
    const existingBadges = autoBadgeMap.get(product.inventory_item_id) || new Set();

    for (const badge of badgesWithRules) {
      const assignRule = badge.autoAssignRule as RuleGroup | null;
      const removeRule = badge.autoRemoveRule as RuleGroup | null;

      const shouldAssign = evaluateRuleGroup(assignRule, product);
      const shouldRemove = evaluateRuleGroup(removeRule, product);
      const hasBadge = existingBadges.has(badge.key);

      if (shouldAssign && !hasBadge) {
        // Check conflicts before assigning
        const conflictList = checkConflicts(badge.key, Array.from(existingBadges), conflictPairs);
        if (conflictList.length > 0) {
          conflicts.push({
            inventoryItemId: product.inventory_item_id,
            badgeKey: badge.key,
            conflictsWith: conflictList,
          });
        } else {
          toAssign.push({
            inventoryItemId: product.inventory_item_id,
            badgeKey: badge.key,
            reason: `Auto-assign rule matched for ${badge.label}`,
          });
        }
      } else if (shouldRemove && hasBadge) {
        toRemove.push({
          inventoryItemId: product.inventory_item_id,
          badgeKey: badge.key,
          reason: `Auto-remove rule matched for ${badge.label}`,
        });
      }
    }
  }

  return { toAssign, toRemove, conflicts };
}
