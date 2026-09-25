/**
 * Platform category catalog cleanup — deactivates non-shelf rows and
 * promotes ecosystem-proven grocery labels to canonical shelves.
 *
 * Context: platform_categories is a retail-shelf slice of the GBP taxonomy
 * (~414 rows). Two defects were observed leaking into enrichment prompts
 * via CategoryVocabularyService.loadVocabulary():
 *
 *   1. Junk/generic residue — lowercase GBP-import rows like "market",
 *      "store", "supermarket" that analysts can pick verbatim for
 *      super_categories even though they are meaningless shelves.
 *   2. Non-shelf rows — services (Marketing Agency), B2B wholesale /
 *      manufacture / supplier rows that are not shopper-browsable shelves.
 *
 *   plus a coverage gap: platform-native grocery labels created through
 *   campaigns (Middle Eastern Grocery Store) or registered by operators
 *   (Halal Grocery Store) were visible to analysts only via the ENRICHED /
 *   REGISTERED supplement sections — not canonical, not linkable on
 *   /directory. The GBP taxonomy itself has no grocery variants for these
 *   ethnic niches (restaurant-only), so the platform supplies them.
 *
 * Operations:
 *   - DEACTIVATE_SLUGS → is_active = false (soft archive, matching the
 *     admin DELETE route's semantics — keeps google_category_id / gcid
 *     mapping and historical references intact). Every row is re-checked
 *     for references at run time; referenced rows are still deactivated
 *     but flagged loudly in the log for manual review.
 *   - NEW_SHELVES → insert platform_categories rows by slug (idempotent:
 *     existing slug → reactivate + verify name; missing → insert). New
 *     shelves inherit icon_emoji / sort_order / level conventions from the
 *     existing "Grocery Store" row so they group with the grocery cluster.
 *   - REVIEW pass → prints active rows still matching non-shelf patterns
 *     (wholesaler / manufacturer / supplier / wholesale / market-format)
 *     that were NOT deactivated, for a future cleanup decision.
 *
 * Idempotent — a second run reports everything already applied.
 *
 * Run from apps/api:
 *   doppler run --config local -- npx tsx src/scripts/cleanup-platform-categories.ts
 *   doppler run --config prd   -- npx tsx src/scripts/cleanup-platform-categories.ts
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

// Lowercase GBP-import residue — generic buckets, not browsable shelves.
const GENERIC_SLUGS = [
  'market',
  'store',
  'supermarket',
  'hypermarket',
  'drugstore',
];

// Service businesses — no physical shelf for shoppers to browse.
const SERVICE_SLUGS = [
  'telemarketing-service',
  'internet-marketing-service',
  'marketing-agency',
  'marketing-consultant',
  'market-researcher',
  'grocery-delivery-service',
];

// B2B wholesale / manufacture / supply-chain — not shopper-facing shelves.
const B2B_SLUGS = [
  'fmcg-goods-wholesaler',
  'household-goods-wholesaler',
  'leather-goods-manufacturer',
  'leather-goods-supplier',
  'leather-goods-wholesaler',
  'store-equipment-supplier',
  'store-fixture-supplier',
  'used-store-fixture-supplier',
  'shop-supermarket-furniture-store',
  'wholesale-drugstore',
  'wholesale-food-store',
  'wholesale-market',
  'vegetable-wholesale-market',
  'clothing-wholesale-market-place',
  'cattle-market',
];

const DEACTIVATE_SLUGS = [...GENERIC_SLUGS, ...SERVICE_SLUGS, ...B2B_SLUGS];

// Ecosystem-proven grocery shelves — labels that already exist as campaigns,
// registered labels, or enrichment packets. GBP has no grocery variants for
// these niches (restaurant-only), so they are platform-native categories.
const NEW_SHELVES = [
  { slug: 'middle-eastern-grocery-store', name: 'Middle Eastern Grocery Store' },
  { slug: 'halal-grocery-store', name: 'Halal Grocery Store' },
  { slug: 'halal-meat-market', name: 'Halal Meat Market' },
  { slug: 'international-grocery-store', name: 'International Grocery Store' },
  { slug: 'somali-grocery-store', name: 'Somali Grocery Store' },
  { slug: 'ethiopian-grocery-store', name: 'Ethiopian Grocery Store' },
  { slug: 'hispanic-grocery-store', name: 'Hispanic Grocery Store' },
  { slug: 'caribbean-grocery-store', name: 'Caribbean Grocery Store' },
];

async function countReferences(categoryId: string, name: string, slug: string) {
  const rows = await prisma.$queryRaw<
    { listings: bigint; items: bigint; prospects: bigint; campaigns: bigint }[]
  >`
    SELECT
      (SELECT COUNT(*) FROM directory_listing_categories WHERE category_id = ${categoryId}) AS listings,
      (SELECT COUNT(*) FROM inventory_items WHERE directory_category_id = ${categoryId}) AS items,
      (SELECT COUNT(*) FROM mkt_prospect_queue
        WHERE lower(category) = lower(${name}) OR lower(category) = ${slug}) AS prospects,
      (SELECT COUNT(*) FROM mkt_campaigns_list
        WHERE lower(category) = lower(${name}) OR category = ${slug}) AS campaigns
  `;
  const r = rows[0];
  return {
    listings: Number(r.listings),
    items: Number(r.items),
    prospects: Number(r.prospects),
    campaigns: Number(r.campaigns),
  };
}

async function main() {
  // ── Pass 1: deactivate non-shelf rows ─────────────────────────────────
  let deactivated = 0;
  let alreadyInactive = 0;
  let missing = 0;

  for (const slug of DEACTIVATE_SLUGS) {
    const rows = await prisma.$queryRaw<{ id: string; name: string; is_active: boolean }[]>`
      SELECT id, name, is_active FROM platform_categories WHERE slug = ${slug}
    `;
    const row = rows[0];
    if (!row) {
      missing++;
      logger.warn('cleanup: slug not found — skipping', undefined, { slug });
      continue;
    }
    if (!row.is_active) {
      alreadyInactive++;
      continue;
    }

    const refs = await countReferences(row.id, row.name, slug);
    await prisma.$executeRaw`
      UPDATE platform_categories SET is_active = false, updated_at = now()
      WHERE id = ${row.id}
    `;
    deactivated++;

    const log = refs.listings + refs.items + refs.prospects + refs.campaigns > 0
      ? logger.warn.bind(logger)
      : logger.info.bind(logger);
    log('cleanup: deactivated category', undefined, { slug, name: row.name, refs });
  }

  // ── Pass 2: promote ecosystem-proven grocery shelves ──────────────────
  // Inherit display conventions from the existing "Grocery Store" row so the
  // new shelves group with the grocery cluster.
  const anchor = await prisma.$queryRaw<
    { icon_emoji: string | null; sort_order: number | null; level: number | null }[]
  >`
    SELECT icon_emoji, sort_order, level FROM platform_categories WHERE slug = 'grocery-store'
  `;
  const icon = anchor[0]?.icon_emoji ?? '🛒';
  const sortOrder = anchor[0]?.sort_order ?? 999;
  const level = anchor[0]?.level ?? 0;

  let inserted = 0;
  let alreadyPresent = 0;
  let reactivated = 0;

  for (const shelf of NEW_SHELVES) {
    const existing = await prisma.$queryRaw<{ id: string; is_active: boolean }[]>`
      SELECT id, is_active FROM platform_categories WHERE slug = ${shelf.slug}
    `;
    if (existing.length > 0) {
      if (!existing[0].is_active) {
        await prisma.$executeRaw`
          UPDATE platform_categories SET is_active = true, updated_at = now()
          WHERE id = ${existing[0].id}
        `;
        reactivated++;
        logger.info('cleanup: reactivated existing shelf', undefined, { slug: shelf.slug });
      } else {
        alreadyPresent++;
      }
      continue;
    }

    await prisma.$executeRaw`
      INSERT INTO platform_categories (
        name, slug, google_category_id, icon_emoji, sort_order, level, is_active
      ) VALUES (
        ${shelf.name}, ${shelf.slug}, ${'gcid:' + shelf.slug},
        ${icon}, ${sortOrder}, ${level}, true
      )
    `;
    inserted++;
    logger.info('cleanup: inserted shelf', undefined, { slug: shelf.slug, name: shelf.name });
  }

  // ── Pass 3: flag remaining non-shelf-shaped rows for review ───────────
  const flagged = await prisma.$queryRaw<{ name: string; slug: string }[]>`
    SELECT name, slug FROM platform_categories
    WHERE is_active = true
      AND slug <> ALL(${DEACTIVATE_SLUGS}::text[])
      AND (
        name ~* '(wholesaler|manufacturer|supplier)$'
        OR name ~* 'wholesale'
        OR name ~* '(service|agency|consultant)$'
      )
    ORDER BY name
  `;
  for (const row of flagged) {
    logger.warn('cleanup: review — still-active row looks non-shelf', undefined, {
      slug: row.slug,
      name: row.name,
    });
  }

  logger.info('cleanup: complete', undefined, {
    deactivated,
    alreadyInactive,
    missing,
    inserted,
    reactivated,
    alreadyPresent,
    flaggedForReview: flagged.length,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error('cleanup: fatal error', undefined, {
    error: (err as Error).message,
  });
  process.exit(1);
});
