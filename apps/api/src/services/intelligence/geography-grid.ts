/**
 * Geography grid — authoritative sweep units for intelligence discovery.
 *
 * The geography grid is the category-independent enumeration floor: every ZIP /
 * corridor / municipality in it is swept independently, and a sweep unit with
 * zero findings is an executed-empty result rather than a silent gap.
 *
 * Two sources, in precedence order:
 *   1. The CITY-LEVEL CACHE (`mkt_geography_grids`, via GeographyGridService) —
 *      looked up under the EXACT key this run would write (`city+state`, or
 *      `city+state+zips` when the campaign carries ZIPs). A hit means a prior run
 *      already derived this exact market scope, so it is reused.
 *   2. The CAMPAIGN (`intelligence_zip_codes`) — when no cached grid exists for
 *      the exact key but the campaign names ZIPs.
 *   3. AI DERIVATION — when neither exists, the AI is instructed to derive the
 *      grid. This is the SCALE PATH (most markets will have no ZIPs at
 *      deployment time), so the derivation instruction is explicit about the
 *      retail catchment: the principal city PLUS its contiguous commercial
 *      suburbs, including separately-incorporated municipalities that share
 *      ZIPs with the principal city (the "Gladstone class").
 *
 * Kept as a pure module so it is unit-testable without the service.
 */

/** Parse the campaign's free-text zip code list into normalized 5-digit ZIPs. */
export function parseZipCodes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of String(raw).split(/[\s,;|]+/)) {
    const t = token.trim();
    if (/^\d{5}(-\d{4})?$/.test(t)) {
      const zip = t.slice(0, 5);
      if (!seen.has(zip)) {
        seen.add(zip);
        out.push(zip);
      }
    }
  }
  return out;
}

/**
 * Normalized cache key for a market.
 *
 * EXACT-STRING SEMANTICS: the key is `city+state` when the campaign carries no
 * ZIPs, or `city+state+zips` when it does. A grid is written under the exact
 * string that produced it and reused only by a later run with the same exact
 * string — a ZIP-scoped grid and a city-wide grid are distinct keys and do not
 * share.
 *
 * Format: `<lowercased city>|<uppercased state>|<sorted deduped zips, comma-joined>`.
 * The ZIP segment is sorted + deduped so ZIP ordering never creates a spurious
 * distinct key; it is empty when the campaign carries no ZIPs.
 */
export function normalizeCityKey(
  city: string | null | undefined,
  state: string | null | undefined,
  zips?: string[] | null,
): string | null {
  const c = (city ?? '').toString().trim().toLowerCase();
  const s = (state ?? '').toString().trim().toUpperCase();
  if (!c && !s) return null;
  const z = Array.isArray(zips) && zips.length > 0
    ? Array.from(new Set(zips)).sort().join(',')
    : '';
  return `${c}|${s}|${z}`;
}

/**
 * National-market sentinel: '__all__' marks a national campaign or row
 * (all markets). It is NOT a real city/state — normalizers must never treat
 * it as one (normalizeReferenceCity would title-case it to '__All__', an
 * orphan slot no resolver reads). Callers translate the sentinel to the
 * national slot at their own seams: NULL reference_city on intelligence
 * profiles, literal '__all__' on directory_category_enrichment rows.
 */
export function isNationalSentinel(v: string | null | undefined): boolean {
  return (v ?? '').toString().trim().toLowerCase() === '__all__';
}

export interface GeographyGrid {
  city: string | null;
  state: string | null;
  zips: string[];
  corridors: string[];
  adjacent_municipalities: string[];
  radius_miles: number | null;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

/** Build the structured grid from campaign fields. */
export function buildGeographyGrid(campaign: any): GeographyGrid {
  const city = (campaign?.city ?? '').toString().trim() || null;
  const state = (campaign?.state ?? '').toString().trim() || null;
  const zips = parseZipCodes(campaign?.intelligence_zip_codes);
  const rawRadius = campaign?.intelligence_search_radius_miles;
  const radius = rawRadius === null || rawRadius === undefined || rawRadius === ''
    ? null
    : Number(rawRadius);
  return {
    city,
    state,
    zips,
    corridors: [],
    adjacent_municipalities: [],
    radius_miles: Number.isFinite(radius as number) ? (radius as number) : null,
  };
}

/**
 * Render the authoritative GEOGRAPHY GRID directive. Returns '' when the
 * campaign names no city and no state (nothing to scope).
 *
 * `cached` is the city-level grid from GeographyGridService, if one exists.
 */
export function buildGeographyGridDirective(
  campaign: any,
  cached?: Partial<GeographyGrid> | null,
): string {
  const campaignCity = (campaign?.city ?? '').toString().trim() || null;
  const campaignState = (campaign?.state ?? '').toString().trim() || null;
  if (!campaignCity && !campaignState) return '';
  // National ('__all__') campaigns have no single retail catchment — the
  // catchment is authored by city-scoped establishments. Emit nothing rather
  // than a directive that would read "Market: __all__" and ask for a
  // nationwide ZIP/corridor derivation.
  if (isNationalSentinel(campaignCity) || isNationalSentinel(campaignState)) return '';

  const campaignZips = parseZipCodes(campaign?.intelligence_zip_codes);
  const cachedZips = asStringArray(cached?.zips);
  const corridors = asStringArray(cached?.corridors);
  const adjacent = asStringArray(cached?.adjacent_municipalities);

  // EXACT-STRING reuse: `cached` is looked up under the same exact key this run
  // would write (`city+state` or `city+state+zips`), so a hit means a prior run
  // already derived this market (or this market+ZIP scope) — reuse it. Otherwise
  // the campaign's own ZIPs, otherwise derive.
  const usingCache = cachedZips.length > 0;
  const usingCampaign = !usingCache && campaignZips.length > 0;
  const zips = usingCache ? cachedZips : campaignZips;

  const rawRadius = campaign?.intelligence_search_radius_miles;
  const radius = rawRadius === null || rawRadius === undefined || rawRadius === ''
    ? (typeof cached?.radius_miles === 'number' ? cached!.radius_miles : null)
    : Number(rawRadius);

  const scopeLabel = campaignCity && campaignState
    ? `${campaignCity}, ${campaignState}`
    : (campaignCity || campaignState) as string;

  const zipLine = zips.length > 0
    ? `ZIP sweep units (authoritative${usingCampaign ? ', from this campaign' : ', from the cached market grid'}): ${zips.join(', ')}`
    : [
        'ZIP sweep units: DERIVE them — no cached grid exists for this market.',
        '  Enumerate EVERY ZIP whose addresses fall in the RETAIL CATCHMENT: the',
        '  principal city PLUS its contiguous commercial suburbs, INCLUDING',
        '  separately-incorporated municipalities that share ZIPs with the principal',
        '  city (e.g. a suburb like Gladstone, MO sharing 64118 with Kansas City).',
        '  Do NOT return only the principal city\'s administrative ZIPs.',
      ].join('\n');

  const corridorsLine = corridors.length > 0
    ? `Corridors (from cached market grid): ${corridors.join('; ')}`
    : 'Corridors: DERIVE them — arterial commercial stretches, from address evidence where possible.';

  const adjacentLine = adjacent.length > 0
    ? `Adjacent municipalities (from cached market grid): ${adjacent.join(', ')}`
    : 'Adjacent municipalities: DERIVE them — list the separately-incorporated suburbs and contiguous commercial municipalities in the catchment (the shared-ZIP suburb class).';

  const radiusLine = typeof radius === 'number' && Number.isFinite(radius)
    ? `Search radius: ${radius} miles`
    : '';

  return `=== GEOGRAPHY GRID — AUTHORITATIVE SWEEP UNITS ===
Market: ${scopeLabel}
${zipLine}
${corridorsLine}
${adjacentLine}${radiusLine ? '\n' + radiusLine : ''}

DIRECTIVE:
- SWEEP SCOPE IS THE RETAIL CATCHMENT, NOT THE ADMINISTRATIVE CITY. The market is
  the principal city plus its contiguous commercial suburbs — including
  separately-incorporated municipalities that share ZIPs with the principal city.
  A ZIP that spans the principal city and a suburb is ONE sweep unit, listed once
  with both municipality names, so "no results in <zip>" cannot be silently true.
- Sweep EVERY sweep unit above INDEPENDENTLY. A ZIP/corridor with zero findings
  is an executed-empty result to report — never a silent skip. Do not stop after
  the first ZIP that yields results.
- Execute the generic-label x geography matrix: for each platform, sweep the
  generic labels that SWALLOW this category (not the correct category label)
  across each sweep unit.
- Execute every address-indexed dataset (state registry, benefit-program
  authorization, licensing/permit registries) by GEOGRAPHY (ZIP/address) with NO
  category-name filter, then filter to category fit by assortment evidence.
  Do NOT key these datasets on the category name — token-keying a
  label-independent dataset makes it label-dependent.
- RECORD THE DERIVATION BASIS: state how the ZIP set and adjacent municipalities
  were derived (city boundary + adjacent municipalities + arterial corridors), so
  coverage is auditable rather than a bare list.
- Copy this grid verbatim into the profile's "geography_grid" field.
=== END GEOGRAPHY GRID ===`;
}
