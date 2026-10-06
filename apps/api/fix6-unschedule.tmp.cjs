const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const NAMES = [
  'storefront_category_counts','storefront_category_counts_10','refresh-storefront_category_counts',
  'storefront_products','storefront_products_mv','storefront_variants_mv',
  'directory_category_products','directory_category_stores','directory_category_stats',
  'directory_category_listings','directory_gbp_stats','directory_gbp_listings',
  'gbp_category_usage_stats','mv_global_discovery','mv_category_discovery',
  'mv_shop_discovery','mv_trending_scores','mv_trending_products',
  'mv_selection_products','mv_new_products','mv_sale_products','mv_seasonal_products',
];
(async () => {
  for (const name of NAMES) {
    try {
      const r = await prisma.$queryRawUnsafe(`select cron.unschedule('${name}') as ok`);
      console.log(`unscheduled ${name}:`, r);
    } catch (e) {
      console.log(`FAILED ${name}: ${e.message.split('\n')[0]}`);
    }
  }
  const remaining = await prisma.$queryRawUnsafe(`select count(*) as active_jobs from cron.job where active`);
  const dupes = await prisma.$queryRawUnsafe(`select count(*) as n from (
    select command from cron.job where active group by command having count(*)>1) t`);
  console.log('active jobs now:', remaining, '| remaining duplicate commands:', dupes);
})().finally(() => prisma.$disconnect());
