/**
 * Bronze reason scope — one vocabulary, two prompt surfaces.
 *
 * A bronze reason's scope (§3.6.1) is not decoration: it is the scan context
 * that tells the analyst how far a finding generalizes and how to classify an
 * empty slot (proof is scope-relative, §6.2.1). Both surfaces that put a
 * reason in front of an analyst read from here so the wording cannot drift:
 *
 *   - `BronzeReasonCatalogService.serializeCatalogBlock` — the stage-1/2
 *     hunt list injected at render time.
 *   - `IntelligenceProfileService.serializeBronzeStandard` — the national
 *     reference (stage 2) and market calibration (stage 3) blocks.
 *
 * Dependency-free on purpose: IntelligenceProfileService must not import
 * BronzeReasonCatalogService (the catalog service imports the normalizers
 * from it — a cycle), so the shared formatter lives here.
 */

/** The scope columns of a catalog row or a `catalog_snapshot` row. */
export interface BronzeScopeFields {
  scope_category_key?: string | null;
  scope_city?: string | null;
  scope_state?: string | null;
  scope_platform?: string | null;
}

/**
 * Human-readable §3.6.1 scope for one reason, as it appears in every injected
 * block: `universal` when every scope column is NULL, else the set parts —
 * `category=african grocery store; location=Indianapolis, IN; platform=yelp`.
 *
 * The geographic level (universal / category / location / category+location)
 * and the independent platform axis (§3.6.5) are both expressed, because the
 * analyst needs both: portability of the finding, and whether the mechanic
 * exists only on one platform.
 */
export function formatBronzeReasonScope(row: BronzeScopeFields): string {
  const parts: string[] = [];
  if (row.scope_category_key) parts.push(`category=${row.scope_category_key}`);
  if (row.scope_city || row.scope_state) {
    parts.push(`location=${row.scope_city ?? ''}${row.scope_city && row.scope_state ? ', ' : ''}${row.scope_state ?? ''}`);
  }
  if (row.scope_platform) parts.push(`platform=${row.scope_platform}`);
  return parts.length ? parts.join('; ') : 'universal';
}

/**
 * The scope definition both directives embed. A bare `Scope: universal` line
 * is a useless variable unless the analyst is told what it does — this text
 * defines the two axes, the selection filter that produced the block, and the
 * three judgements scope then governs.
 *
 * The selection half matters as much as the reporting half: scope is what
 * decided which reasons are in the block (a category-bound reason is here
 * because the scan is for that category), so the analyst can reason about why
 * a reason is present — and why a sibling reason is absent.
 */
export const BRONZE_SCOPE_SEMANTICS = [
  'REASON SCOPE — how to read the Scope line.',
  'Scope is the filter that selected this block. A reason applies to a scan when every scope column is either NULL (wildcard: any category, any market, any platform) or matches the scan\'s context — so a category=<key> reason is here because this scan is for that category and would not appear in another category\'s block; a location=<city, ST> reason is here because this scan covers that market; a platform=<name> reason is here because this scan covers that platform (a cross-platform scan covers every platform-bound reason). Every reason below already passed that filter, so all of them are yours to cover — scope is never a reason to skip one. Reasons are annotated with their scope in brackets where it is known.',
  'Scope then governs three judgements:',
  '  1. How far a finding generalizes. A filled universal reason is a category-wide blind spot; a category-scoped one is specific to this category; a location-scoped one is a finding about THIS market and must never be carried to another market; a platform-bound one is a per-platform finding.',
  '  2. How an empty slot is classified — proof is scope-relative. A reason with no exemplar here but a known exemplar at a wider scope (national, or another market) is empty_proven_elsewhere; a reason with no exemplar at any evaluable scope is empty_unproven. The reason\'s own scope tells you which wider scope to check — at national scope there is no wider scope, so an empty reason is empty_unproven unless the catalog marks it proven elsewhere.',
  '  3. How the result is reported. Never present a location-scoped finding as a category truth, or a platform-bound finding as a whole-business visibility verdict (the §9 prohibited inferences).',
].join('\n');

/**
 * The recording instruction — only meaningful for a scan that emits
 * `catalog_snapshot` (the shared bronze output suffix asks for it), so the
 * hunt-list block carries it and the profile blocks do not.
 */
export const BRONZE_SCOPE_RECORDING_INSTRUCTION =
  'Echo each reason\'s Scope line verbatim into its catalog_snapshot entry (scope_category_key, scope_city, scope_state, scope_platform — null for every part the line omits), and compute scope_mix by geographic level (universal, category, location, category_location), counting platform-scoped reasons additionally as platform_bound (the independent axis).';
