/**
 * BSaaS Analytics Service
 *
 * Aggregates revenue and usage metrics for BSaaS feature purchases.
 * Read-only — no billing changes.
 */

import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

export interface BsaasAnalyticsSummary {
  totalActivePurchases: number;
  totalTrialPurchases: number;
  totalPastDuePurchases: number;
  totalSuspendedPurchases: number;
  totalExpiredPurchases: number;
  monthlyRecurringRevenue: number;
  annualRecurringRevenue: number;
  totalLifetimeRevenue: number;
  trialConversionRate: number;
  churnRate: number;
  totalTenantsWithPurchases: number;
}

export interface FeatureRevenueRow {
  feature_key: string;
  feature_name: string;
  marketing_name: string | null;
  active_count: number;
  trial_count: number;
  monthly_revenue: number;
  annual_revenue: number;
  lifetime_revenue: number;
}

export interface RecentPurchaseRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  feature_key: string;
  status: string;
  source: string;
  price_cents: number;
  billing_cycle: string;
  purchased_at: Date;
  expires_at: Date | null;
}

export interface BsaasAnalytics {
  summary: BsaasAnalyticsSummary;
  perFeature: FeatureRevenueRow[];
  recentPurchases: RecentPurchaseRow[];
}

class BsaasAnalyticsServiceClass {
  async getAnalytics(): Promise<BsaasAnalytics> {
    const [summary, perFeature, recentPurchases] = await Promise.all([
      this.getSummary(),
      this.getPerFeatureRevenue(),
      this.getRecentPurchases(),
    ]);

    return { summary, perFeature, recentPurchases };
  }

  private async getSummary(): Promise<BsaasAnalyticsSummary> {
    const now = new Date();

    const [
      activeCount,
      trialCount,
      pastDueCount,
      suspendedCount,
      expiredCount,
      activePurchases,
      trialConvertedCount,
      trialStartedCount,
      churnedCount,
      totalTenants,
      allPurchases,
    ] = await Promise.all([
      prisma.tenant_feature_purchases.count({ where: { status: 'active', source: 'bsaas' } }),
      prisma.tenant_feature_purchases.count({ where: { status: 'trial', source: 'bsaas' } }),
      prisma.tenant_feature_purchases.count({ where: { status: 'past_due', source: 'bsaas' } }),
      prisma.tenant_feature_purchases.count({ where: { status: 'suspended', source: 'bsaas' } }),
      prisma.tenant_feature_purchases.count({ where: { status: 'expired', source: 'bsaas' } }),
      prisma.tenant_feature_purchases.findMany({
        where: { status: 'active', source: 'bsaas' },
        select: { metadata: true },
      }),
      prisma.tenant_feature_purchases.count({
        where: { source: 'bsaas', NOT: { status: 'trial' }, metadata: { path: ['trial_converted_at'], not: Prisma.DbNull } },
      }),
      prisma.tenant_feature_purchases.count({
        where: { source: 'bsaas', metadata: { path: ['trial_started_at'], not: Prisma.DbNull } },
      }),
      prisma.tenant_feature_purchases.count({
        where: { status: { in: ['suspended', 'expired'] }, source: 'bsaas' },
      }),
      prisma.tenant_feature_purchases.findMany({
        where: { source: 'bsaas' },
        select: { tenant_id: true },
        distinct: ['tenant_id'],
      }),
      prisma.tenant_feature_purchases.findMany({
        where: { source: 'bsaas' },
        select: { metadata: true, status: true },
      }),
    ]);

    // Calculate MRR and ARR from active purchases
    let mrr = 0;
    let arr = 0;
    let lifetimeRevenue = 0;

    for (const purchase of activePurchases) {
      const meta = (purchase.metadata as any) || {};
      const priceCents = meta.price_cents || 0;
      const cycle = meta.billing_cycle || 'monthly';
      if (cycle === 'monthly') mrr += priceCents;
      if (cycle === 'annual') arr += priceCents;
    }

    // Lifetime revenue: sum all price_cents from non-trial, non-cancelled purchases
    for (const purchase of allPurchases) {
      if (purchase.status === 'trial') continue;
      const meta = (purchase.metadata as any) || {};
      lifetimeRevenue += meta.price_cents || 0;
    }

    const trialConversionRate = trialStartedCount > 0
      ? Math.round((trialConvertedCount / trialStartedCount) * 100)
      : 0;

    const totalEver = activeCount + trialCount + pastDueCount + suspendedCount + expiredCount;
    const churnRate = totalEver > 0
      ? Math.round((churnedCount / totalEver) * 100)
      : 0;

    return {
      totalActivePurchases: activeCount,
      totalTrialPurchases: trialCount,
      totalPastDuePurchases: pastDueCount,
      totalSuspendedPurchases: suspendedCount,
      totalExpiredPurchases: expiredCount,
      monthlyRecurringRevenue: mrr,
      annualRecurringRevenue: arr,
      totalLifetimeRevenue: lifetimeRevenue,
      trialConversionRate,
      churnRate,
      totalTenantsWithPurchases: totalTenants.length,
    };
  }

  private async getPerFeatureRevenue(): Promise<FeatureRevenueRow[]> {
    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: { source: 'bsaas' },
      select: {
        feature_key: true,
        status: true,
        metadata: true,
      },
    });

    const catalog = await prisma.bsaas_catalog.findMany({
      select: { feature_key: true, marketing_name: true },
    });
    const catalogMap = new Map(catalog.map(c => [c.feature_key, c.marketing_name]));

    const features = await prisma.features_list.findMany({
      where: { key: { in: purchases.map(p => p.feature_key) } },
      select: { key: true, name: true },
    });
    const featureMap = new Map(features.map(f => [f.key, f.name]));

    const grouped = new Map<string, FeatureRevenueRow>();

    for (const purchase of purchases) {
      const key = purchase.feature_key;
      if (!grouped.has(key)) {
        grouped.set(key, {
          feature_key: key,
          feature_name: featureMap.get(key) || key,
          marketing_name: catalogMap.get(key) || null,
          active_count: 0,
          trial_count: 0,
          monthly_revenue: 0,
          annual_revenue: 0,
          lifetime_revenue: 0,
        });
      }

      const row = grouped.get(key)!;
      const meta = (purchase.metadata as any) || {};
      const priceCents = meta.price_cents || 0;
      const cycle = meta.billing_cycle || 'monthly';

      if (purchase.status === 'active') {
        row.active_count++;
        if (cycle === 'monthly') row.monthly_revenue += priceCents;
        if (cycle === 'annual') row.annual_revenue += priceCents;
        row.lifetime_revenue += priceCents;
      } else if (purchase.status === 'trial') {
        row.trial_count++;
      } else if (purchase.status !== 'trial') {
        row.lifetime_revenue += priceCents;
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      (b.monthly_revenue + b.annual_revenue) - (a.monthly_revenue + a.annual_revenue)
    );
  }

  private async getRecentPurchases(): Promise<RecentPurchaseRow[]> {
    const purchases = await prisma.tenant_feature_purchases.findMany({
      where: { source: 'bsaas' },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        tenant_id: true,
        feature_key: true,
        status: true,
        source: true,
        metadata: true,
        purchased_at: true,
        expires_at: true,
      },
    });

    const tenantIds = [...new Set(purchases.map(p => p.tenant_id))];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

    return purchases.map(p => {
      const meta = (p.metadata as any) || {};
      return {
        id: p.id,
        tenant_id: p.tenant_id,
        tenant_name: tenantMap.get(p.tenant_id) || null,
        feature_key: p.feature_key,
        status: p.status,
        source: p.source,
        price_cents: meta.price_cents || 0,
        billing_cycle: meta.billing_cycle || 'one_time',
        purchased_at: p.purchased_at,
        expires_at: p.expires_at,
      };
    });
  }
}

export const BsaasAnalyticsService = new BsaasAnalyticsServiceClass();
