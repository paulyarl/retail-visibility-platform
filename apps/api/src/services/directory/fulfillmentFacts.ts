/**
 * fulfillmentFacts — shared extraction for the migration-337 fulfillment
 * columns + OQ5 internal seed metadata.
 *
 * Source contract (business-analysis.schema.ts PRODUCT-VISIBILITY FIELDS):
 *   website.has_delivery_option / has_pickup_ordering — tri-state:
 *     true  = observed on a verified public surface
 *     false = explicit rendered negative ONLY ("pickup only", "no shipping")
 *     null  = no rendered surface addressed it
 *   website.{field}_observed_on — names the surface the determination came
 *     from (owned_site, instagram, marketplace, ...). Free string.
 *   observed_assets[] — roll-up of verified strengths; only
 *     confidence === 'verified_on_surface' entries are seed-eligible.
 *
 * Listing column semantics (migration 337): NULL = unobserved, false =
 * explicit negative, true = observed/owner-confirmed. Public filters only
 * ever match `= true`. Nothing here is inferred from category labels.
 */

export interface FulfillmentFacts {
  deliveryOffered: boolean | null;
  pickupOffered: boolean | null;
  /** When the determination was made (audit row created_at). */
  fulfillmentAsOf: Date | null;
  /** 'audit_channel_scan' for audit-derived writes. */
  fulfillmentSource: string | null;
  /** Surfaces the determinations came from, comma-joined. */
  fulfillmentSourceName: string | null;
}

function tri(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null;
}

/**
 * Extract fulfillment facts from a business_analysis audit blob. Returns
 * null when the audit observed NEITHER field — callers must skip the write
 * so an audit that never rendered the question can't erase prior evidence.
 */
export function extractFulfillmentFromAuditData(
  auditData: any,
  auditCreatedAt?: Date | string | null,
): FulfillmentFacts | null {
  const w = auditData?.website ?? {};
  const delivery = tri(w.has_delivery_option);
  const pickup = tri(w.has_pickup_ordering);
  if (delivery === null && pickup === null) return null;

  const surfaces = [
    w.has_delivery_option_observed_on,
    w.has_pickup_ordering_observed_on,
  ]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim());

  return {
    deliveryOffered: delivery,
    pickupOffered: pickup,
    fulfillmentAsOf: auditCreatedAt ? new Date(auditCreatedAt) : new Date(),
    fulfillmentSource: 'audit_channel_scan',
    fulfillmentSourceName:
      surfaces.length > 0 ? [...new Set(surfaces)].join(', ') : 'business_analysis_audit',
  };
}

/**
 * OQ5 seed-eligible observed assets — verified_on_surface only, full
 * internal fidelity (underexposed/underexposure_note/confidence are
 * operator-facing, never public). Cap keeps the JSONB column bounded.
 */
export function extractSeedObservedAssets(auditData: any, cap = 20): any[] {
  const raw = auditData?.observed_assets;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (a) => a && typeof a === 'object' && a.confidence === 'verified_on_surface',
    )
    .slice(0, cap)
    .map((a) => ({
      asset: a.asset ?? null,
      evidence: a.evidence ?? null,
      source_url: a.source_url ?? null,
      observed_on: a.observed_on ?? null,
      also_seen_on: Array.isArray(a.also_seen_on) ? a.also_seen_on : [],
      confidence: a.confidence,
      underexposed: a.underexposed ?? null,
      underexposure_note: a.underexposure_note ?? null,
    }));
}
