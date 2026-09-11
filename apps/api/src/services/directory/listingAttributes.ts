/**
 * Shared sourced-attribute extraction for directory listing surfaces.
 *
 * One normalize/extract/dedupe pipeline used by every surface that handles
 * listing attributes:
 *   - seed detail suggestions panel (DirectoryPresenceSeedService.listAttributeSuggestions)
 *   - campaign → seed creation (DirectoryPresenceSeedService.createFromCampaign)
 *   - prospect queue → campaign promotion (attributes ride business_snapshot)
 *   - public chip rendering consumes the stored result
 *
 * Evidence contract: every attribute carries its own source platform + URL +
 * as_of date as recorded by the analyst. Nothing is inferred from category
 * labels. SNAP/EBT stays in its dedicated snap_ebt_* columns (migration 207).
 */
/** A single sourced attribute chip stored on a directory listing (migration 267). */
export interface DirectoryListingAttribute {
  key: string;
  label: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  asOf?: string;
  /** Set when the owner confirmed (or added) the chip at claim time
   *  (migration 274) — distinguishes owner-minted truth from sourced hints. */
  ownerConfirmed?: boolean;
}

/** Audit platforms whose audit_data carries extractable attributes. */export const ATTRIBUTE_AUDIT_PLATFORMS = [
  'gold_standard_scan',
  'business_analysis',
  'intelligence_discovery',
  'city_analysis',
] as const;

export function slugifyAttributeKey(label: string): string {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Normalize one attribute entry — analysts may emit a bare string (label
 * only) or a structured object ({ key, label, source_url, as_of }).
 */
export function normalizeAttributeEntry(
  raw: any,
  platform: string,
  fallbackUrl?: string | null,
  fallbackAsOf?: string | null,
): DirectoryListingAttribute | null {
  if (typeof raw === 'string') {
    const label = raw.trim();
    return label
      ? {
          key: slugifyAttributeKey(label),
          label,
          sourcePlatform: platform,
          sourceUrl: fallbackUrl ?? undefined,
          asOf: fallbackAsOf ?? undefined,
        }
      : null;
  }
  if (raw && typeof raw === 'object') {
    const label = String(raw.label ?? raw.value ?? '').trim();
    if (!label) return null;
    const key = String(raw.key ?? '').trim() || slugifyAttributeKey(label);
    return {
      key: key.toLowerCase(),
      label,
      sourcePlatform: platform,
      sourceUrl: String(raw.source_url ?? fallbackUrl ?? '') || undefined,
      asOf: String(raw.as_of ?? fallbackAsOf ?? '') || undefined,
    };
  }
  return null;
}

/**
 * Extract sourced attributes from one audit row, dispatching on the audit
 * platform. Handles the four audit shapes that carry attributes:
 *   - gold_standard_scan: candidates[].platform_evaluations[].platform_config.attributes
 *   - business_analysis:  platforms.<platform>.attributes (+ top-level snapshot
 *     attributes stamped by the manual-queue path)
 *   - intelligence_discovery: discovered/qualifying businesses' observed_attributes
 *   - city_analysis:      full city-scan business JSON (attributes / observed_attributes)
 */
export function extractAttributesFromAuditData(
  origin: string,
  data: any,
): DirectoryListingAttribute[] {
  if (!data || typeof data !== 'object') return [];
  const out: DirectoryListingAttribute[] = [];

  const push = (raw: any, platform: string, fallbackUrl?: string | null, fallbackAsOf?: string | null) => {
    const n = normalizeAttributeEntry(raw, platform, fallbackUrl, fallbackAsOf);
    if (n) out.push(n);
  };

  if (origin === 'gold_standard_scan') {
    const scanDate = data.scan_metadata?.scan_date ?? null;
    for (const cand of Array.isArray(data.candidates) ? data.candidates : []) {
      for (const pe of Array.isArray(cand?.platform_evaluations) ? cand.platform_evaluations : []) {
        const platform = String(pe?.platform ?? '').trim();
        for (const raw of Array.isArray(pe?.platform_config?.attributes) ? pe.platform_config.attributes : []) {
          push(raw, platform, pe?.profile_url ?? null, scanDate ?? null);
        }
      }
    }
  } else if (origin === 'business_analysis') {
    const auditDate = data.audit_metadata?.audit_date ?? null;
    const platforms = data.platforms && typeof data.platforms === 'object' ? data.platforms : {};
    for (const [platform, block] of Object.entries(platforms)) {
      if (!block || typeof block !== 'object') continue;
      for (const raw of Array.isArray((block as any).attributes) ? (block as any).attributes : []) {
        push(raw, platform, (block as any).profile_url ?? null, auditDate ?? null);
      }
    }
    // Manual-queue audits stamp snapshot attributes at the top level.
    for (const raw of Array.isArray(data.attributes) ? data.attributes : []) {
      push(raw, 'queue_snapshot', null, auditDate ?? null);
    }
  } else if (origin === 'intelligence_discovery') {
    const businesses = [
      ...(Array.isArray(data.discovered_businesses) ? data.discovered_businesses : []),
      ...(Array.isArray(data.qualifying_businesses) ? data.qualifying_businesses : []),
    ];
    for (const biz of businesses) {
      for (const raw of Array.isArray(biz?.observed_attributes) ? biz.observed_attributes : []) {
        push(raw, String(raw?.platform ?? ''), raw?.source_url ?? null, raw?.as_of ?? null);
      }
    }
  } else if (origin === 'city_analysis') {
    // City pain scan business JSON — attributes may arrive as a structured
    // array or bare label strings, under either key.
    for (const raw of [
      ...(Array.isArray(data.attributes) ? data.attributes : []),
      ...(Array.isArray(data.observed_attributes) ? data.observed_attributes : []),
    ]) {
      push(raw, String(raw?.platform ?? 'city_scan'), raw?.source_url ?? null, raw?.as_of ?? null);
    }
  }

  return out;
}

/**
 * Extract + dedupe sourced attributes across audit rows. Callers pass audits
 * newest-first; first occurrence of a key wins. `excludeKeys` drops entries
 * already present on the target listing; `cap` bounds the result.
 */
export function extractAttributesFromAudits(
  audits: Array<{ platform: string; audit_data: any; created_at?: Date | string | null }>,
  opts: { excludeKeys?: Set<string>; cap?: number } = {},
): DirectoryListingAttribute[] {
  const seen = new Set<string>();
  const exclude = opts.excludeKeys ?? new Set<string>();
  const out: DirectoryListingAttribute[] = [];
  for (const audit of Array.isArray(audits) ? audits : []) {
    const data = audit.audit_data;
    if (!data || typeof data !== 'object') continue;
    for (const a of extractAttributesFromAuditData(data, String(audit.platform))) {
      const key = String(a?.key ?? '').trim().toLowerCase();
      if (!key || seen.has(key) || exclude.has(key)) continue;
      seen.add(key);
      out.push(a);
      if (out.length >= (opts.cap ?? 40)) break;
    }
    if (out.length >= (opts.cap ?? 40)) break;
  }
  return out;
}
