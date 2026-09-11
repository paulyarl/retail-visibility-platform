/**
 * Cleanup script — strips auto-populated secondary_categories from directory
 * presence seeds, and repairs keywords polluted by verbose
 * "<name>: <description>" intelligence-profile subcategory entries.
 *
 * Secondary categories are operator-managed: set via Edit Fields after the
 * category-identification audit, never composed automatically. This script
 * clears listing.secondary_categories and deletes the secondary_categories
 * provenance row for seeds whose provenance came from an automated source
 * (intelligence_profile / seed_seo_composer / business_analysis_audit /
 * linked_campaign / prospect_queue:*). Operator- and owner-sourced rows
 * (operator_override, owner_claim) are left untouched.
 *
 * Keywords pass: for seeds with auto-sourced `keywords` provenance, each
 * keyword entry containing a colon whose prefix is not a known key:value
 * keyword key (neighborhood / origin_country / origin_region) is reduced to
 * its label segment; prose-length entries (>100 chars) are dropped. The
 * keywords provenance row is updated to the cleaned join. Listing keywords
 * are also mirrored into directory_settings_list.seo_keywords.
 *
 * Idempotent — a second run finds no auto-sourced provenance rows and no
 * verbose keyword entries.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/cleanup-seed-secondary-categories.ts
 *   doppler run --config prd -- npx tsx src/scripts/cleanup-seed-secondary-categories.ts
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

const AUTO_SOURCES = [
  'intelligence_profile',
  'seed_seo_composer',
  'business_analysis_audit',
  'linked_campaign',
];

// Legit key:value keyword prefixes emitted by SeedSeoComposer — anything else
// with a colon is a "<name>: <description>" subcategory leak.
const KNOWN_KEY_PREFIXES = new Set([
  'neighborhood',
  'origin_country',
  'origin_region',
]);

const KEYWORD_LABEL_MAX = 100;

function cleanKeyword(kw: string): string | null {
  const trimmed = String(kw).trim();
  if (!trimmed) return null;
  const colon = trimmed.indexOf(':');
  if (colon > 0) {
    const prefix = trimmed.slice(0, colon).trim().toLowerCase();
    if (KNOWN_KEY_PREFIXES.has(prefix)) return trimmed.toLowerCase();
    const label = trimmed.slice(0, colon).replace(/_/g, ' ').trim();
    if (!label || label.length > KEYWORD_LABEL_MAX) return null;
    return label.toLowerCase();
  }
  if (trimmed.length > KEYWORD_LABEL_MAX) return null;
  return trimmed.toLowerCase();
}

async function main() {
  // ── Pass 1: clear auto-populated secondary_categories ─────────────────
  const rows = await prisma.$queryRaw<any[]>`
    SELECT dfp.seed_id, dps.listing_id, dps.tenant_id, dfp.source_name,
           dl.secondary_categories
    FROM directory_field_provenance dfp
    JOIN directory_presence_seeds dps ON dps.id = dfp.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dfp.field_key = 'secondary_categories'
      AND (dfp.source_name = ANY(${AUTO_SOURCES}::text[])
           OR dfp.source_name LIKE 'prospect_queue:%')
  `;

  logger.info('cleanup: found seeds with auto-sourced secondary_categories', undefined, {
    count: rows.length,
  });

  for (const row of rows) {
    await prisma.$executeRaw`
      UPDATE directory_listings_list
      SET secondary_categories = '{}'::text[], updated_at = now()
      WHERE id = ${row.listing_id}
    `;
    await prisma.$executeRaw`
      DELETE FROM directory_field_provenance
      WHERE seed_id = ${row.seed_id} AND field_key = 'secondary_categories'
    `;
    await prisma.$executeRaw`
      UPDATE directory_settings_list
      SET secondary_categories = '{}'::text[], updated_at = now()
      WHERE tenant_id = ${row.tenant_id}
    `;
    logger.info('cleanup: cleared secondary_categories', undefined, {
      seedId: row.seed_id,
      listingId: row.listing_id,
      source: row.source_name,
      removedCount: Array.isArray(row.secondary_categories)
        ? row.secondary_categories.length
        : 0,
    });
  }

  // ── Pass 2: clean verbose keyword entries on auto-sourced seeds ────────
  const kwRows = await prisma.$queryRaw<any[]>`
    SELECT dfp.seed_id, dps.listing_id, dps.tenant_id, dfp.source_name,
           dl.keywords
    FROM directory_field_provenance dfp
    JOIN directory_presence_seeds dps ON dps.id = dfp.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dfp.field_key = 'keywords'
      AND (dfp.source_name = ANY(${AUTO_SOURCES}::text[])
           OR dfp.source_name LIKE 'prospect_queue:%')
      AND COALESCE(array_length(dl.keywords, 1), 0) > 0
  `;

  let keywordsCleaned = 0;
  for (const row of kwRows) {
    const original: string[] = Array.isArray(row.keywords) ? row.keywords : [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const kw of original) {
      const c = cleanKeyword(kw);
      if (c && !seen.has(c)) {
        seen.add(c);
        cleaned.push(c);
      }
    }
    const changed =
      cleaned.length !== original.length ||
      cleaned.some((c, i) => c !== String(original[i]).trim().toLowerCase());
    if (!changed) continue;

    await prisma.$executeRaw`
      UPDATE directory_listings_list
      SET keywords = ${cleaned}::text[], updated_at = now()
      WHERE id = ${row.listing_id}
    `;
    await prisma.$executeRaw`
      UPDATE directory_field_provenance
      SET value = ${cleaned.join(', ')}, updated_at = now()
      WHERE seed_id = ${row.seed_id} AND field_key = 'keywords'
    `;
    await prisma.$executeRaw`
      UPDATE directory_settings_list
      SET seo_keywords = ${cleaned}::text[], updated_at = now()
      WHERE tenant_id = ${row.tenant_id}
    `;
    keywordsCleaned++;
    logger.info('cleanup: cleaned keywords', undefined, {
      seedId: row.seed_id,
      source: row.source_name,
      before: original.length,
      after: cleaned.length,
    });
  }

  // ── Warn pass: verbose leftovers lacking auto provenance ──────────────
  const suspicious = await prisma.$queryRaw<any[]>`
    SELECT dps.id AS seed_id, dl.secondary_categories, dl.keywords
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE EXISTS (
      SELECT 1 FROM unnest(dl.secondary_categories) s
      WHERE position(':' in s) > 0 OR length(s) > 100
    )
  `;
  for (const row of suspicious) {
    logger.warn('cleanup: verbose secondary categories remain — review manually', undefined, {
      seedId: row.seed_id,
      secondaryCategories: row.secondary_categories,
    });
  }

  const suspiciousKw = await prisma.$queryRaw<any[]>`
    SELECT dps.id AS seed_id, dl.keywords
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE EXISTS (
      SELECT 1 FROM unnest(dl.keywords) k
      WHERE (position(':' in k) > 0
             AND lower(split_part(k, ':', 1)) <> ALL
               (ARRAY['neighborhood','origin_country','origin_region']))
         OR length(k) > 100
    )
  `;
  for (const row of suspiciousKw) {
    logger.warn('cleanup: verbose keyword entries remain — review manually', undefined, {
      seedId: row.seed_id,
      keywords: row.keywords,
    });
  }

  logger.info('cleanup: complete', undefined, {
    secondaryCategoriesCleared: rows.length,
    keywordsCleaned,
    flaggedForReview: suspicious.length + suspiciousKw.length,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error('cleanup: fatal error', undefined, {
    error: (err as Error).message,
  });
  process.exit(1);
});
