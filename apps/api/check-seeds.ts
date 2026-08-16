import { prisma } from './src/prisma';

async function main() {
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, slug, is_published, business_name, listing_origin, tenant_id
     FROM directory_listings_list
     WHERE slug LIKE $1 OR business_name LIKE $2
     LIMIT 10`,
    '%african-market%',
    '%African Market%',
  );
  console.log('Listings matching african-market:');
  console.log(JSON.stringify(rows, null, 2));

  const seeds: any[] = await prisma.$queryRawUnsafe(
    `SELECT id, tenant_id, listing_id, status, seed_batch
     FROM directory_presence_seeds
     LIMIT 10`,
  );
  console.log('\nPresence seeds:');
  console.log(JSON.stringify(seeds, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
