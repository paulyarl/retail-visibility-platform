import { prisma } from '../prisma';

async function main() {
  const rows = await prisma.directory_category_enrichment.findMany({
    where: {
      OR: [
        { city: 'Kansas City', state: 'MO' },
        { city: 'Olathe', state: 'KS' },
        { city: 'Overland Park', state: 'KS' },
        { city: 'Lawrence', state: 'KS' },
      ],
    },
    select: {
      category_key: true, city: true, state: true,
      composer_version: true, trigger_source: true, updated_at: true,
      source_campaign_id: true, source_execution_id: true,
    },
    orderBy: [{ city: 'asc' }, { category_key: 'asc' }],
  });
  for (const r of rows) {
    console.log(`${r.category_key} | ${r.city}, ${r.state} | v${r.composer_version} | ${r.trigger_source} | camp=${r.source_campaign_id} | ${r.updated_at?.toISOString()}`);
  }
}

main().finally(() => prisma.$disconnect());
