/**
 * BSaaS Coupon Metadata Migration Script
 *
 * For existing purchases that have coupon_id in metadata but lack the new
 * coupon_duration / coupon_duration_in_months / coupon_percent_off / coupon_amount_off
 * / original_price_cents / renewal_count fields.
 *
 * Usage: doppler run --config local -- node scripts/migrate_bsaas_coupon_metadata.js
 *
 * This script is idempotent — it only updates purchases missing the new fields.
 */

const { PrismaClient } = require('@prisma/client');
const Stripe = require('stripe');

const prisma = new PrismaClient();
const dryRun = process.env.MIGRATION_DRY_RUN === 'true';

async function main() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set — cannot retrieve coupon details from Stripe');
    process.exit(1);
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  // Find all purchases with coupon_id in metadata
  const purchases = await prisma.tenant_feature_purchases.findMany({
    where: {
      source: { in: ['bsaas', 'bsaas_bundle'] },
    },
  });

  const purchasesWithCoupons = purchases.filter(p => {
    const meta = p.metadata || {};
    return meta.coupon_id && !meta.coupon_duration;
  });

  console.log(`Found ${purchasesWithCoupons.length} purchases with coupon_id but missing coupon_duration`);

  if (purchasesWithCoupons.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  // Collect unique coupon IDs
  const couponIds = [...new Set(purchasesWithCoupons.map(p => p.metadata.coupon_id))];
  console.log(`Retrieving ${couponIds.length} unique coupons from Stripe...`);

  // Fetch coupon details from Stripe
  const couponCache = new Map();
  for (const couponId of couponIds) {
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      couponCache.set(couponId, coupon);
      console.log(`  Retrieved coupon ${couponId}: ${coupon.duration}, ${coupon.percent_off || coupon.amount_off} off`);
    } catch (err) {
      console.error(`  Failed to retrieve coupon ${couponId}:`, err.message);
      // Skip — we can't migrate without coupon details
    }
  }

  let migrated = 0;
  let skipped = 0;

  for (const purchase of purchasesWithCoupons) {
    const meta = purchase.metadata;
    const coupon = couponCache.get(meta.coupon_id);

    if (!coupon) {
      console.log(`  Skipping purchase ${purchase.id} — coupon ${meta.coupon_id} not found in Stripe`);
      skipped++;
      continue;
    }

    // Calculate renewal_count based on purchase date and billing cycle
    const purchasedAt = meta.purchased_at ? new Date(meta.purchased_at) : purchase.created_at;
    const billingCycleDays = meta.billing_cycle === 'weekly' ? 7
      : meta.billing_cycle === 'annual' ? 365
      : 30; // default to monthly
    const elapsedDays = Math.floor((Date.now() - purchasedAt.getTime()) / (24 * 60 * 60 * 1000));
    const renewalCount = Math.max(0, Math.floor(elapsedDays / billingCycleDays));

    const updatedMetadata = {
      ...meta,
      coupon_duration: coupon.duration,
      coupon_duration_in_months: coupon.duration_in_months || null,
      coupon_percent_off: coupon.percent_off || null,
      coupon_amount_off: coupon.amount_off || null,
      original_price_cents: meta.original_price_cents || meta.price_cents,
      renewal_count: meta.renewal_count || renewalCount,
    };

    if (dryRun) {
      console.log(`  [DRY RUN] Would update purchase ${purchase.id} (feature: ${purchase.feature_key}, coupon: ${meta.coupon_id}, renewal_count: ${renewalCount})`);
    } else {
      await prisma.tenant_feature_purchases.update({
        where: { id: purchase.id },
        data: {
          metadata: updatedMetadata,
          updated_at: new Date(),
        },
      });
      console.log(`  Updated purchase ${purchase.id} (feature: ${purchase.feature_key}, renewal_count: ${renewalCount})`);
    }
    migrated++;
  }

  console.log(`\nMigration complete: ${migrated} ${dryRun ? 'would be ' : ''}migrated, ${skipped} skipped`);
}

main()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
