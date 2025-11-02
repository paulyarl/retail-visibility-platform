#!/usr/bin/env node
/*
 Seed tenant categories to exercise GBP mirror diffs.

 Usage examples:
   node scripts/seed_tenant_categories.js --tenantId=tenant_123 --style=retail --count=12
   node scripts/seed_tenant_categories.js --tenantId=tenant_123 --style=restaurant --count=8
   node scripts/seed_tenant_categories.js --tenantId=tenant_123 --wipe --style=retail
   node scripts/seed_tenant_categories.js --tenantId=tenant_123 --mutate=3   # rename 3 existing to simulate updates

 Flags:
   --tenantId   required
   --count      default 10
   --style      retail | restaurant (default retail)
   --wipe       remove all existing active categories first
   --mutate     number of existing categories to rename (simulates updates)

   Category seeding script added


I created a realistic tenant category seeder modeled after your chain script:

Path: apps/api/scripts/seed_tenant_categories.js
Purpose: Seed or mutate Tenant Categories to exercise mirror diffs.
Works with existing Prisma models and your stub GBP client.
Usage
Required: --tenantId=<tenant_id>
Optional:
--count=<N> default 10
--style=retail|restaurant default retail
--wipe remove existing tenant categories first
--mutate=<M> rename M existing categories to simulate “updated”
Examples:

Create 12 retail categories
node apps/api/scripts/seed_tenant_categories.js --tenantId=tenant_123 --style=retail --count=12

Create 8 restaurant categories, wiping first
node apps/api/scripts/seed_tenant_categories.js --tenantId=tenant_123 --style=restaurant --count=8 --wipe

Mutate 3 existing to generate updates
node apps/api/scripts/seed_tenant_categories.js --tenantId=tenant_123 --mutate=3
Output:

Lists created/updated categories.
Final count of active categories.

Optional follow-ups to exercise other paths
Updates:
node apps/api/scripts/seed_tenant_categories.js --tenantId=tenant_1762044401698_2 --mutate=3
Re-run smoke → expect updated=3.
Deletes (future when GBP has data) or simulate by reducing platform set:
node apps/api/scripts/seed_tenant_categories.js --tenantId=tenant_1762044401698_2 --wipe --count=5
Re-run smoke → created=5 against empty GBP.


*/

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const getArg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const hasFlag = (name) => args.includes(`--${name}`);

const tenantId = getArg('tenantId');
const count = parseInt(getArg('count') || '10', 10);
const style = (getArg('style') || 'retail').toLowerCase();
const wipe = hasFlag('wipe');
const mutate = parseInt(getArg('mutate') || '0', 10);

if (!tenantId) {
  console.error('Error: --tenantId is required');
  process.exit(1);
}

const retailCats = [
  'Beverages', 'Snacks', 'Dairy', 'Bakery', 'Produce', 'Meat & Seafood', 'Frozen Foods', 'Household', 'Health & Beauty', 'Pet Supplies', 'Baby Care', 'Electronics'
];
const restaurantCats = [
  'Appetizers', 'Salads', 'Entrees', 'Pasta', 'Burgers', 'Sandwiches', 'Sides', 'Desserts', 'Beverages', 'Kids Menu', 'Vegan', 'Gluten-Free'
];

const catalog = style === 'restaurant' ? restaurantCats : retailCats;

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

async function main() {
  console.log(`Seeding categories for tenant ${tenantId} (style=${style}, count=${count})`);

  if (wipe) {
    console.log('Wiping existing tenant categories...');
    await prisma.tenantCategory.deleteMany({ where: { tenantId } });
  }

  const existing = await prisma.tenantCategory.findMany({
    where: { tenantId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, slug: true, sortOrder: true },
  });

  // Mutate some existing to simulate updates
  if (existing.length && mutate > 0) {
    const toMutate = pickN(existing, Math.min(mutate, existing.length));
    for (const c of toMutate) {
      const newName = `${c.name} (Updated)`;
      await prisma.tenantCategory.update({ where: { id: c.id }, data: { name: newName } });
      console.log(`Updated: ${c.name} -> ${newName}`);
    }
  }

  const need = Math.max(0, count - existing.length);
  if (need > 0) {
    const names = pickN(catalog, Math.min(need, catalog.length));
    const rows = names.map((name, idx) => ({
      tenantId,
      name,
      slug: slugify(name),
      isActive: true,
      sortOrder: existing.length + idx + 1,
    }));
    await prisma.tenantCategory.createMany({ data: rows, skipDuplicates: true });
    rows.forEach(r => console.log(`Created: ${r.name}`));
  }

  const final = await prisma.tenantCategory.findMany({ where: { tenantId, isActive: true }, orderBy: { sortOrder: 'asc' }, select: { name: true } });
  console.log(`\nDone. Active categories (${final.length}):`);
  final.forEach(c => console.log(` - ${c.name}`));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
