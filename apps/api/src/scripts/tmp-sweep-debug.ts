import { prisma } from '../prisma';

async function main() {
  // Remove the pre-namespacing stray row — its source now lives under
  // discovery:northeast_news_a_guide_to_independence_a
  await prisma.$executeRaw`
    DELETE FROM directory_field_provenance
    WHERE seed_id = 'dps-W9CH-zuf6zwa8' AND field_key = 'discovery'
  `;
  const remaining = await prisma.$queryRaw<any[]>`
    SELECT field_key, source_name FROM directory_field_provenance
    WHERE seed_id = 'dps-W9CH-zuf6zwa8' ORDER BY field_key
  `;
  console.log('PROVENANCE NOW:', JSON.stringify(remaining, null, 2));

  // Orphan tenant from the rolled-back seed delete (tenant DELETE itself
  // failed on a stale-sequence trigger). Check then neutralize it.
  const tenant = await prisma.$queryRaw<any[]>`
    SELECT id, name, directory_visible, location_status, subscription_tier
    FROM tenants WHERE id = 'tid-vde9sc6a'
  `;
  console.log('ORPHAN TENANT:', JSON.stringify(tenant, null, 2));
  if (tenant[0]) {
    await prisma.$executeRaw`
      UPDATE tenants SET directory_visible = false, location_status = 'archived', updated_at = now()
      WHERE id = 'tid-vde9sc6a'
    `;
    console.log('orphan tenant neutralized (directory_visible=false, archived)');
  }
}

main().finally(() => prisma.$disconnect());
