/**
 * Diagnostic: dump all rows for a given intelligence profile id so we can
 * see why a scoped-gold-standard promotion is failing.
 *
 * Usage:
 *   doppler run --config local -- npx tsx src/scripts/diagnose-intel-profile.ts <profileId>
 */
import { prisma } from '../prisma';

async function main(): Promise<void> {
  const profileId = process.argv[2];
  if (!profileId) {
    console.error('Usage: npx tsx src/scripts/diagnose-intel-profile.ts <profileId>');
    process.exit(1);
  }

  const rows = await prisma.mkt_intelligence_profiles.findMany({
    where: { id: profileId },
    orderBy: { version: 'desc' },
  });

  console.log(`Found ${rows.length} row(s) for id=${profileId}`);
  for (const r of rows) {
    console.log({
      id: r.id,
      version: r.version,
      status: r.status,
      intelligence_focus: r.intelligence_focus,
      reference_city: r.reference_city,
      reference_state: r.reference_state,
      reference_platform: r.reference_platform,
      category_key: r.category_key,
      category_name: r.category_name,
      updated_at: r.updated_at,
    });
  }

  // Also check whether a scoped profile already exists for Pittsburgh/PA
  // for the same category_key (in case the nationwide one is missing).
  if (rows.length > 0) {
    const categoryKey = rows[0].category_key;
    const scoped = await prisma.mkt_intelligence_profiles.findMany({
      where: {
        category_key: categoryKey,
        intelligence_focus: 'gold_standards',
        reference_city: 'Pittsburgh',
        reference_state: 'PA',
      },
      orderBy: { version: 'desc' },
    });
    console.log(`\nScoped Pittsburgh/PA gold_standards rows for category_key=${categoryKey}: ${scoped.length}`);
    for (const s of scoped) {
      console.log({
        id: s.id,
        version: s.version,
        status: s.status,
        reference_city: s.reference_city,
        reference_state: s.reference_state,
      });
    }
  }

  // Also list all active nationwide gold_standards profiles for context
  const nationwide = await prisma.mkt_intelligence_profiles.findMany({
    where: {
      status: 'active',
      intelligence_focus: 'gold_standards',
      reference_city: null,
      reference_state: null,
    },
    orderBy: { updated_at: 'desc' },
  });
  console.log(`\nAll active nationwide gold_standards profiles: ${nationwide.length}`);
  for (const n of nationwide) {
    console.log({
      id: n.id,
      version: n.version,
      category_key: n.category_key,
      category_name: n.category_name,
      updated_at: n.updated_at,
    });
  }
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
