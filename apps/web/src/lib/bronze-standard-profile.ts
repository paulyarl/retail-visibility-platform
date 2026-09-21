/**
 * Bronze Standard profile shape helpers.
 *
 * A bronze profile's `configuration_json` is the `bronze_standard_scan`
 * output (spec: docs/LocalBiz/BRONZE_STANDARD_SPEC.md §4) — NOT the §10
 * Category Intelligence Profile shape, so CategoryProfileView renders only
 * its header for one. These helpers detect the shape and compute the
 * operator-facing summary counts; BronzeStandardProfileView renders it.
 *
 * Used by:
 *   - BronzeStandardProfileView (detail view)
 *   - IntelligenceProfilesClient (view modal dispatch, list card summary)
 *   - IntelligenceEstablishmentPanel (active-profile detail dispatch)
 */

import type { IntelligenceProfile } from '@/services/MarketingOpsService';

// ─── Types (mirror of bronze-standard-scan.schema.ts output) ─────────────

export type BronzeCoverageStatus = 'filled' | 'empty_unproven' | 'empty_proven_elsewhere';
export type BronzeDigitalQuality = 'low' | 'very_low';
export type BronzeOperationalStatus = 'active' | 'likely_active' | 'unable_to_verify';
export type BronzeDiscoveredBy =
  | 'operator_self_discovery'
  | 'business_audit'
  | 'emerging_scan'
  | 'competitive_scan'
  | 'bronze_establishment_scan';

export interface BronzeSlot {
  business_name: string;
  address?: string | null;
  observed_platform?: string | null;
  category_fit_evidence?: string;
  operational_evidence?: string;
  operational_status?: BronzeOperationalStatus | null;
  discovered_by?: BronzeDiscoveredBy;
  discovered_via?: string | null;
  evidence_urls?: string[];
  digital_quality?: BronzeDigitalQuality;
  platform_presence?: Record<string, string>;
  [k: string]: any;
}

export interface BronzeReasonCoverageEntry {
  reason_key: string;
  status: BronzeCoverageStatus;
  slots?: BronzeSlot[];
  empty_slot_note?: string | null;
  [k: string]: any;
}

export interface BronzeCatalogSnapshotRow {
  reason_key: string;
  label?: string;
  definition?: string;
  signals?: string[];
  expected_vectors?: string[];
  priority?: number | null;
  scope_category_key?: string | null;
  scope_city?: string | null;
  scope_state?: string | null;
  scope_platform?: string | null;
  provenance?: string | null;
  [k: string]: any;
}

export interface BronzeVectorLogEntry {
  vector: string;
  executed: boolean;
  returned?: number | null;
  [k: string]: any;
}

export interface BronzeScopeMix {
  universal?: number;
  category?: number;
  location?: number;
  category_location?: number;
  platform_bound?: number;
  [k: string]: any;
}

export interface BronzeProfileConfig {
  category_key?: string;
  category_name?: string;
  reference_city?: string | null;
  reference_state?: string | null;
  reference_platform?: string | null;
  catalog_revision?: number;
  catalog_snapshot?: BronzeCatalogSnapshotRow[];
  reason_coverage?: BronzeReasonCoverageEntry[];
  not_applicable_reasons?: string[];
  scope_mix?: BronzeScopeMix;
  vector_execution_log?: BronzeVectorLogEntry[];
  prohibited_inferences?: string[];
  scan_metadata?: Record<string, any>;
  [k: string]: any;
}

// ─── Display vocabulary ──────────────────────────────────────────────────

export const BRONZE_COVERAGE_STATUS_META: Record<
  BronzeCoverageStatus,
  { label: string; color: string; description: string }
> = {
  filled: {
    label: 'Filled',
    color: 'green',
    description: 'At least one qualifying exemplar found in this market this pass.',
  },
  empty_unproven: {
    label: 'Empty — unproven',
    color: 'gray',
    description: 'No exemplar here, and none has ever been found at any evaluable scope.',
  },
  empty_proven_elsewhere: {
    label: 'Empty — proven elsewhere',
    color: 'yellow',
    description: 'No exemplar here, but proven at national scope or another market — a real finding about this market.',
  },
};

export const BRONZE_PRESENCE_META: Record<string, { label: string; color: string }> = {
  present_category_aligned: { label: 'Present — category aligned', color: 'green' },
  present_generic_category: { label: 'Present — generic category', color: 'teal' },
  present_unclaimed: { label: 'Present — unclaimed', color: 'yellow' },
  hosted_storefront_unverified: { label: 'Hosted storefront (unverified)', color: 'orange' },
  absent: { label: 'Absent', color: 'red' },
  not_verified: { label: 'Not verified', color: 'gray' },
};

export const BRONZE_DIGITAL_QUALITY_META: Record<BronzeDigitalQuality, { label: string; color: string }> = {
  low: { label: 'Low digital quality', color: 'orange' },
  very_low: { label: 'Very low digital quality', color: 'red' },
};

export const BRONZE_OPERATIONAL_STATUS_META: Record<BronzeOperationalStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'green' },
  likely_active: { label: 'Likely active', color: 'teal' },
  unable_to_verify: { label: 'Unable to verify', color: 'gray' },
};

export const BRONZE_DISCOVERED_BY_LABELS: Record<BronzeDiscoveredBy, string> = {
  operator_self_discovery: 'Operator self-discovery',
  business_audit: 'Business audit',
  emerging_scan: 'Emerging scan',
  competitive_scan: 'Competitive scan',
  bronze_establishment_scan: 'Bronze establishment scan',
};

export const BRONZE_PLATFORM_LABELS: Record<string, string> = {
  google: 'Google',
  yelp: 'Yelp',
  facebook: 'Facebook',
  apple_maps: 'Apple Maps',
  bing: 'Bing',
  bbb: 'BBB',
  website: 'Website',
};

export const BRONZE_SCOPE_MIX_LABELS: Array<{ key: keyof BronzeScopeMix; label: string }> = [
  { key: 'universal', label: 'Universal' },
  { key: 'category', label: 'Category' },
  { key: 'location', label: 'Location' },
  { key: 'category_location', label: 'Category + location' },
  { key: 'platform_bound', label: 'Platform-bound' },
];

export function bronzePlatformLabel(key: string): string {
  return BRONZE_PLATFORM_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** `universal` | `cat:<key>` | `City, ST` | `@platform` — mirrors the catalog admin's scope label. */
export function bronzeScopeLabel(row: BronzeCatalogSnapshotRow): string {
  const parts: string[] = [];
  if (row.scope_category_key) parts.push(`cat:${row.scope_category_key}`);
  if (row.scope_city || row.scope_state) {
    parts.push(`${row.scope_city ?? ''}${row.scope_city && row.scope_state ? ', ' : ''}${row.scope_state ?? ''}`);
  }
  if (row.scope_platform) parts.push(`@${row.scope_platform}`);
  return parts.length ? parts.join(' · ') : 'universal';
}

// ─── Shape access + detection ────────────────────────────────────────────

export function bronzeProfileConfig(profile: IntelligenceProfile): BronzeProfileConfig {
  return (profile.configuration_json ?? {}) as BronzeProfileConfig;
}

/**
 * Detect whether a profile is a Bronze Standard profile — either declared by
 * focus (`bronze_standards`) or by the `bronze_standard_scan` shape
 * (`reason_coverage` / `catalog_snapshot`). Focus alone is checked first so a
 * bronze draft whose config is still being edited keeps the bronze view.
 */
export function isBronzeStandardProfile(profile: IntelligenceProfile): boolean {
  if (profile.intelligence_focus === 'bronze_standards') return true;
  const config = bronzeProfileConfig(profile);
  return Array.isArray(config.reason_coverage) || Array.isArray(config.catalog_snapshot);
}

export interface BronzeStandardSummary {
  reasonCount: number;
  filledCount: number;
  emptyUnprovenCount: number;
  emptyProvenElsewhereCount: number;
  slotCount: number;
  catalogSnapshotCount: number;
  vectorCount: number;
  executedVectorCount: number;
  catalogRevision: number | null;
}

/**
 * Compute summary stats for a bronze profile card. Returns null if the
 * profile is not a bronze-standard shape.
 */
export function bronzeStandardSummary(profile: IntelligenceProfile): BronzeStandardSummary | null {
  if (!isBronzeStandardProfile(profile)) return null;
  const config = bronzeProfileConfig(profile);
  const coverage = config.reason_coverage ?? [];
  const vectors = config.vector_execution_log ?? [];
  return {
    reasonCount: coverage.length,
    filledCount: coverage.filter((c) => c.status === 'filled').length,
    emptyUnprovenCount: coverage.filter((c) => c.status === 'empty_unproven').length,
    emptyProvenElsewhereCount: coverage.filter((c) => c.status === 'empty_proven_elsewhere').length,
    slotCount: coverage.reduce((n, c) => n + (c.slots?.length ?? 0), 0),
    catalogSnapshotCount: config.catalog_snapshot?.length ?? 0,
    vectorCount: vectors.length,
    executedVectorCount: vectors.filter((v) => v.executed).length,
    catalogRevision: typeof config.catalog_revision === 'number' ? config.catalog_revision : null,
  };
}
