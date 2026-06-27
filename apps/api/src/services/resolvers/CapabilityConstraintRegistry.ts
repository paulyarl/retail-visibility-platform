/**
 * Cross-Capability Constraint Registry
 *
 * Declarative definitions of cross-capability type dependencies.
 * The ConstraintResolver evaluates these against the assembled
 * effective capability manifest after all individual resolvers complete.
 *
 * See docs/CROSS_CAPABILITY_CONSTRAINT_LAYER.md for full design.
 *
 * Rule R20: This registry is the single source of truth for all
 * cross-capability constraints. No ad-hoc checks elsewhere.
 * Rule R21: Constraints are declarative data, not imperative code.
 */

// ====================
// TYPES
// ====================

export type ConstraintType = 'requires' | 'recommends' | 'excludes' | 'implies';
export type ConstraintSeverity = 'block' | 'warn' | 'info';
export type ConstraintOperator = 'equals' | 'includes' | 'not_includes' | 'is_true' | 'is_false';

export interface ConstraintTarget {
  /** Key in the effective object: 'storefront', 'product_types', 'fulfillment', etc. */
  capability: string;
  /** Field to check: 'effective_type', 'allowed_types', 'enabled', 'shows_service', etc. */
  field: string;
  /** How to compare the field against value */
  operator: ConstraintOperator;
  /** The value to compare against */
  value: string | boolean;
}

export interface CrossCapabilityConstraint {
  /** Unique identifier for this constraint */
  id: string;
  /** Type of constraint */
  type: ConstraintType;
  /** Severity when violated */
  severity: ConstraintSeverity;
  /** When this target matches, the constraint is active */
  source: ConstraintTarget;
  /** This condition must be satisfied (requires) or must NOT be satisfied (excludes) */
  target: ConstraintTarget;
  /** Human-readable explanation */
  message: string;
  /** What the merchant should do to resolve the violation */
  resolution_hint: string;
}

// ====================
// REGISTRY
// ====================

export const CAPABILITY_CONSTRAINTS: CrossCapabilityConstraint[] = [
  // ── Service storefront requires service product type ──
  {
    id: 'storefront_service_requires_product_service',
    type: 'requires',
    severity: 'block',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'service',
    },
    target: {
      capability: 'product_types',
      field: 'allowed_types',
      operator: 'includes',
      value: 'service',
    },
    message: 'Service storefront requires Service product type',
    resolution_hint: 'Enable service product type in your tier or select a different storefront type',
  },

  // ── Social storefront requires social commerce enabled ──
  {
    id: 'storefront_social_requires_social_commerce',
    type: 'requires',
    severity: 'block',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'social',
    },
    target: {
      capability: 'social_commerce_options',
      field: 'enabled',
      operator: 'is_true',
      value: true,
    },
    message: 'Social storefront requires Social Commerce to be enabled',
    resolution_hint: 'Enable Social Commerce in your plan or select a different storefront type',
  },

  // ── Retail storefront recommends physical products ──
  {
    id: 'storefront_retail_recommends_product_physical',
    type: 'recommends',
    severity: 'warn',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'retail',
    },
    target: {
      capability: 'product_types',
      field: 'allowed_types',
      operator: 'includes',
      value: 'physical',
    },
    message: 'Retail storefront works best with Physical products',
    resolution_hint: 'Consider enabling physical product type for optimal retail storefront functionality',
  },

  // ── Online storefront recommends digital products ──
  {
    id: 'storefront_online_recommends_product_digital',
    type: 'recommends',
    severity: 'warn',
    source: {
      capability: 'storefront',
      field: 'effective_type',
      operator: 'equals',
      value: 'online',
    },
    target: {
      capability: 'product_types',
      field: 'allowed_types',
      operator: 'includes',
      value: 'digital',
    },
    message: 'Online storefront works best with Digital products',
    resolution_hint: 'Consider enabling digital product type for optimal online storefront functionality',
  },

  // ── Service products recommend service fulfillment ──
  {
    id: 'product_service_recommends_fulfillment_service',
    type: 'recommends',
    severity: 'warn',
    source: {
      capability: 'product_types',
      field: 'effective_type',
      operator: 'equals',
      value: 'service',
    },
    target: {
      capability: 'fulfillment',
      field: 'shows_service',
      operator: 'is_true',
      value: true,
    },
    message: 'Service products work best with service fulfillment',
    resolution_hint: 'Consider enabling service fulfillment for optimal service product experience',
  },

  // ── Digital products exclude shipping fulfillment ──
  {
    id: 'product_digital_excludes_fulfillment_shipping',
    type: 'excludes',
    severity: 'warn',
    source: {
      capability: 'product_types',
      field: 'effective_type',
      operator: 'equals',
      value: 'digital',
    },
    target: {
      capability: 'fulfillment',
      field: 'shows_shipping',
      operator: 'is_true',
      value: true,
    },
    message: 'Digital products typically do not need shipping fulfillment',
    resolution_hint: 'Consider disabling shipping fulfillment if you only sell digital products',
  },
];

// ====================
// LOOKUP HELPERS
// ====================

/**
 * Get all constraints where the given capability is the source.
 */
export function getConstraintsForSource(capability: string): CrossCapabilityConstraint[] {
  return CAPABILITY_CONSTRAINTS.filter(c => c.source.capability === capability);
}

/**
 * Get all constraints where the given capability is the target.
 */
export function getConstraintsForTarget(capability: string): CrossCapabilityConstraint[] {
  return CAPABILITY_CONSTRAINTS.filter(c => c.target.capability === capability);
}

/**
 * Get all constraints involving a given capability (as source or target).
 */
export function getConstraintsInvolving(capability: string): CrossCapabilityConstraint[] {
  return CAPABILITY_CONSTRAINTS.filter(
    c => c.source.capability === capability || c.target.capability === capability
  );
}
