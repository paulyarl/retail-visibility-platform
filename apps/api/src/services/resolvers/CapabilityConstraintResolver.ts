/**
 * Cross-Capability Constraint Resolver
 *
 * Post-resolution pass that evaluates cross-capability constraints
 * against the assembled effective capability manifest.
 *
 * Runs AFTER all individual resolvers complete (Rule R18).
 * Surfaces violations, does NOT silently change effective states (Rule R19).
 *
 * See docs/CROSS_CAPABILITY_CONSTRAINT_LAYER.md for full design.
 */

import { type ConstraintOperator } from './CapabilityConstraintRegistry';
import { getActiveConstraints } from './CapabilityConstraintService';
import type { EffectiveCapabilities, ConstraintViolation, ConstraintStatusMap } from './types';

// ====================
// CORE: Apply Constraints
// ====================

/**
 * Evaluate all cross-capability constraints against the assembled effective manifest.
 *
 * Returns:
 * - violations: array of ConstraintViolation objects
 * - constraint_status: map of capability -> ConstraintStatus (blocked_types, warning_types)
 *
 * The caller (EffectiveCapabilityResolver) attaches these to the result.
 */
export async function applyCrossCapabilityConstraints(
  effective: EffectiveCapabilities['effective']
): Promise<{
  violations: ConstraintViolation[];
  constraint_status: ConstraintStatusMap;
}> {
  const constraints = await getActiveConstraints();
  const violations: ConstraintViolation[] = [];
  const constraintStatus: ConstraintStatusMap = {};

  for (const constraint of constraints) {
    const sourceMatches = evaluateTarget(constraint.source, effective);
    if (!sourceMatches) continue;

    const targetSatisfied = evaluateTarget(constraint.target, effective);

    // For 'requires': violation when target is NOT satisfied
    // For 'recommends': violation when target is NOT satisfied (warn only)
    // For 'excludes': violation when target IS satisfied (they conflict)
    // For 'implies': violation when target is NOT satisfied (info only)
    const isViolated =
      constraint.type === 'excludes' ? targetSatisfied : !targetSatisfied;

    if (isViolated) {
      const violation: ConstraintViolation = {
        constraint_id: constraint.id,
        type: constraint.type,
        severity: constraint.severity,
        source_capability: constraint.source.capability,
        source_type: String(constraint.source.value),
        target_capability: constraint.target.capability,
        target_type: String(constraint.target.value),
        message: constraint.message,
        resolution_hint: constraint.resolution_hint,
      };
      violations.push(violation);

      // Update constraint_status for the source capability
      if (!constraintStatus[constraint.source.capability]) {
        constraintStatus[constraint.source.capability] = {
          blocked_types: [],
          warning_types: [],
          active_violations: [],
        };
      }

      const status = constraintStatus[constraint.source.capability];
      status.active_violations.push(constraint.id);

      const sourceValue = String(constraint.source.value);

      if (constraint.severity === 'block') {
        if (!status.blocked_types.includes(sourceValue)) {
          status.blocked_types.push(sourceValue);
        }
      } else if (constraint.severity === 'warn') {
        if (!status.warning_types.includes(sourceValue)) {
          status.warning_types.push(sourceValue);
        }
      }
    }
  }

  return { violations, constraint_status: constraintStatus };
}

// ====================
// EVALUATION ENGINE
// ====================

/**
 * Evaluate a ConstraintTarget against the effective manifest.
 * Returns true if the target condition is met.
 *
 * Supported operators:
 * - equals:       field value === target value (string comparison)
 * - includes:     field value (array) includes target value
 * - not_includes: field value (array) does NOT include target value
 * - is_true:      field value is truthy (boolean)
 * - is_false:     field value is falsy (boolean)
 */
function evaluateTarget(
  target: { capability: string; field: string; operator: ConstraintOperator; value: string | boolean },
  effective: EffectiveCapabilities['effective']
): boolean {
  const cap = (effective as Record<string, any>)[target.capability];
  if (!cap) return false;

  const fieldValue = cap[target.field];
  if (fieldValue === undefined) return false;

  switch (target.operator) {
    case 'equals':
      return String(fieldValue) === String(target.value);

    case 'includes':
      return Array.isArray(fieldValue) && fieldValue.includes(target.value);

    case 'not_includes':
      return Array.isArray(fieldValue) && !fieldValue.includes(target.value);

    case 'is_true':
      return !!fieldValue;

    case 'is_false':
      return !fieldValue;

    default:
      return false;
  }
}

// ====================
// WRITE-TIME VALIDATION
// ====================

/**
 * Validate a proposed settings change against cross-capability constraints.
 *
 * Used by PUT handlers in settings routes (Rule R22).
 *
 * @param simulatedEffective  The effective manifest with the proposed change applied
 * @returns Block violations that would occur with the proposed change
 */
export async function validateProposedChange(
  simulatedEffective: EffectiveCapabilities['effective']
): Promise<ConstraintViolation[]> {
  const { violations } = await applyCrossCapabilityConstraints(simulatedEffective);
  return violations.filter(v => v.severity === 'block');
}
