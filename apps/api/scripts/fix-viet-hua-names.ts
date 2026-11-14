/**
 * fix-viet-hua-names — one-off name alignment for the Viet Hua Food Market
 * chain (two Indianapolis locations pushed via pg-mcamp-wpiaacpb-20261109).
 *
 * The E 82nd St seed was ingested as "Viet Hua Food Market越华" — the
 * alt-language form (the sign reads 越華超市) riding the canonical name.
 * This script renames both locations with neighborhood qualifiers, keeps
 * the alternate-language forms in name_variants, re-slugs with location
 * awareness (vacated slugs recorded in slug_aliases, migration 375), and
 * updates the linked business campaign + prospect-queue names so a later
 * NAP projection cannot re-pollute the listing.
 *
 * Write set mirrors DirectoryPresenceSeedService.updateFields /
 * DirectorySeedCampaignLinkService.projectFields:
 *   directory_listings_list (business_name, slug) → slug_aliases →
 *   directory_settings_list.slug → tenants.name →
 *   tenant_business_profiles_list.business_name → dps.name_variants →
 *   directory_field_provenance 'name' upsert (operator_override) →
 *   mkt_campaigns_list.business_name (business-scope links only) →
 *   mkt_prospect_queue.business_name → computeAndStoreSeedFidelity.
 *
 * Usage:
 *   doppler run --config <stg|prd> -- npx tsx scripts/fix-viet-hua-names.ts
 *   doppler run --config <stg|prd> -- npx tsx scripts/fix-viet-hua-names.ts --apply
 *
 * Dry-run by default; --apply writes.
 */

import { prisma } from '../src/prisma';
import { generateDirectoryFieldProvenanceId } from '../src/lib/id-generator';
import { computeAndStoreSeedFidelity } from '../src/services/seed-fidelity';

const APPLY = process.argv.includes('--apply');
const ACTOR = 'devin:name-alignment-2026-11-14';

interface LocationFix {
  addressLike: string;
  newName: string;
  newSlug: string;
  /** Extra identity variants merged into dps.name_variants (canonical prepended). */
  extraVariants: string[];
  note: string;
}

const FIXES: LocationFix[] = [
  {
    addressLike: '%82nd%',
    newName: 'Viet Hua Food Market — Castleton',
    newSlug: 'viet-hua-food-market-castleton',
    extraVariants: [
      'Viet Hua Food Market',
      'Viet Hua Food Market越华',
      'Viet Hua Food Market 越華超市',
      '越華超市',
    ],
    note: "Alt-language suffix (越华; sign reads 越華超市) moved to name_variants; '— Castleton' qualifier added for chain disambiguation (two Indianapolis locations share the brand).",
  },
  {
    addressLike: '%Madison Ave%',
    newName: 'Viet Hua Food Market — Madison Ave',
    newSlug: 'viet-hua-food-market-madison-ave',
    extraVariants: [
      'Viet Hua Food Market',
      'Viet Hua Market',
      'Viet Hua Food Market 越華超市',
    ],
    note: "'— Madison Ave' qualifier added for chain disambiguation (two Indianapolis locations share the brand).",
  },
];

interface SeedRow {
  seed_id: string;
  tenant_id: string;
  listing_id: string;
  business_name: string;
  address: string;
  slug: string;
  name_variants: string[] | null;
}

async function fixLocation(fix: LocationFix): Promise<void> {
  const rows = await prisma.$queryRaw<SeedRow[]>`
    SELECT dps.id AS seed_id, dps.tenant_id, dps.listing_id,
           dl.business_name, dl.address, dl.slug, dps.name_variants
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dl.business_name ILIKE 'Viet Hua%' AND dl.address ILIKE ${fix.addressLike}
    LIMIT 1
  `;
  const seed = rows[0];
  if (!seed) {
    console.log(`  SKIP ${fix.newName} — no seed matched address ${fix.addressLike}`);
    return;
  }
  console.log(
    `  ${seed.seed_id}: "${seed.business_name}" → "${fix.newName}" | slug ${seed.slug} → ${fix.newSlug}`,
  );

  // Slug uniqueness across both oracles (listing + tenant settings).
  const slugTaken = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM directory_listings_list WHERE slug = ${fix.newSlug} AND id <> ${seed.listing_id}
    LIMIT 1
  `;
  const settingsHolder = await prisma.$queryRaw<{ tenant_id: string }[]>`
    SELECT tenant_id FROM directory_settings_list WHERE slug = ${fix.newSlug} LIMIT 1
  `;
  if (slugTaken.length > 0) {
    console.log(`  ABORT ${fix.newSlug} — already held by listing ${slugTaken[0].id}`);
    return;
  }
  const settingsFree = settingsHolder.length === 0 || settingsHolder[0].tenant_id === seed.tenant_id;
  if (!settingsFree) {
    console.log(`  ABORT ${fix.newSlug} — directory_settings_list slug held by ${settingsHolder[0].tenant_id}`);
    return;
  }

  if (!APPLY) return;

  const nameVariants = [fix.newName, ...fix.extraVariants, ...(seed.name_variants ?? [])].filter(
    (v, i, a) => v !== fix.newName || i === 0,
  ).filter((v, i, a) => a.indexOf(v) === i);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE directory_listings_list
      SET business_name = ${fix.newName}, slug = ${fix.newSlug}, updated_at = now()
      WHERE id = ${seed.listing_id}`;

    // Dead-slug insurance (migration 375): vacated slug → alias, new slug
    // drops any stale alias row.
    await tx.$executeRaw`
      INSERT INTO slug_aliases (old_slug, tenant_id, replaced_at)
      VALUES (${seed.slug.toLowerCase()}, ${seed.tenant_id}, now())
      ON CONFLICT (old_slug) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id, replaced_at = now()`;
    await tx.$executeRaw`DELETE FROM slug_aliases WHERE old_slug = ${fix.newSlug}`;

    await tx.$executeRaw`
      UPDATE directory_settings_list SET slug = ${fix.newSlug}, updated_at = now()
      WHERE tenant_id = ${seed.tenant_id}`;

    await tx.$executeRaw`
      UPDATE tenants SET name = ${fix.newName}, updated_at = now() WHERE id = ${seed.tenant_id}`;
    await tx.$executeRaw`
      UPDATE tenant_business_profiles_list
      SET business_name = ${fix.newName}, updated_at = now()
      WHERE tenant_id = ${seed.tenant_id}`;

    await tx.$executeRaw`
      UPDATE directory_presence_seeds
      SET name_variants = ${nameVariants}::text[], updated_at = now()
      WHERE id = ${seed.seed_id}`;

    await tx.$executeRaw`
      INSERT INTO directory_field_provenance (
        id, seed_id, tenant_id, field_key, value,
        source_name, accessed_at, confidence, show_on_public,
        override_by, override_at, notes, created_at, updated_at
      ) VALUES (
        ${generateDirectoryFieldProvenanceId(seed.tenant_id)},
        ${seed.seed_id}, ${seed.tenant_id}, 'name', ${fix.newName},
        'operator_override', CURRENT_DATE, 'high', TRUE,
        ${ACTOR}, now(), ${fix.note}, now(), now()
      )
      ON CONFLICT (seed_id, field_key) DO UPDATE SET
        value = EXCLUDED.value,
        source_name = EXCLUDED.source_name,
        accessed_at = EXCLUDED.accessed_at,
        confidence = EXCLUDED.confidence,
        show_on_public = EXCLUDED.show_on_public,
        override_by = EXCLUDED.override_by,
        override_at = EXCLUDED.override_at,
        notes = EXCLUDED.notes,
        updated_at = now()`;

    // Linked business campaigns carry the canonical NAP — update so a name
    // projection/sync can't re-push the superseded name. Market-scope
    // umbrella links (null business_name) are untouched.
    const campUpd = await tx.$executeRaw`
      UPDATE mkt_campaigns_list SET business_name = ${fix.newName}, updated_at = now()
      WHERE id IN (
        SELECT campaign_id FROM directory_seed_campaign_links
        WHERE seed_id = ${seed.seed_id}
      ) AND scope = 'business' AND business_name IS NOT NULL`;
    console.log(`    campaigns updated: ${campUpd}`);

    const queueUpd = await tx.$executeRaw`
      UPDATE mkt_prospect_queue SET business_name = ${fix.newName}, updated_at = now()
      WHERE seed_id = ${seed.seed_id}`;
    console.log(`    queue rows updated: ${queueUpd}`);
  });

  // Verdict recompute — name change is a material-field change.
  try {
    const verdict = await computeAndStoreSeedFidelity(seed.seed_id);
    console.log(`    seed_fidelity → ${verdict}`);
  } catch (err: any) {
    console.warn(`    fidelity recompute failed (non-fatal): ${err?.message}`);
  }
}

async function main() {
  console.log(`fix-viet-hua-names ${APPLY ? '(APPLY)' : '(dry-run — pass --apply to write)'}`);
  for (const fix of FIXES) await fixLocation(fix);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
