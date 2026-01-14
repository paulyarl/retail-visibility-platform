import { prisma } from '../../prisma';

export interface FeeCalculation {
  platformFeeCents: number;
  platformFeePercentage: number;
  platformFeeFixedCents: number;
  gatewayFeeCents: number;
  totalFeesCents: number;
  netAmountCents: number;
  feeWaived: boolean;
  feeWaivedReason?: string;
}

export class PlatformFeeCalculator {
  /**
   * Calculate complete fee breakdown for a transaction
   */
  static async calculateFees(
    tenantId: string,
    transactionAmountCents: number,
    gatewayFeeCents: number
  ): Promise<FeeCalculation> {
    // 1. Check for active override (highest priority)
    const override = await this.getActiveOverride(tenantId);
    if (override) {
      return this.applyFeeStructure(
        transactionAmountCents,
        gatewayFeeCents,
        Number(override.fee_percentage) || 0,
        override.fee_fixed_cents || 0,
        false,
        `Override: ${override.reason}`
      );
    }

    // 2. Check if fees are waived
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        platform_fee_waived: true,
        platform_fee_waived_reason: true,
        platform_fee_waived_until: true,
        subscription_tier: true,
      },
    });

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    if (tenant.platform_fee_waived) {
      const waivedUntil = tenant.platform_fee_waived_until;
      if (!waivedUntil || new Date() < waivedUntil) {
        return this.applyFeeStructure(
          transactionAmountCents,
          gatewayFeeCents,
          0,
          0,
          true,
          tenant.platform_fee_waived_reason || 'Fees waived'
        );
      }
    }

    // 3. Get tier-based fees
    const tierFees = await this.getTierFees(tenant.subscription_tier);
    return this.applyFeeStructure(
      transactionAmountCents,
      gatewayFeeCents,
      tierFees.percentage,
      tierFees.fixedCents,
      false
    );
  }

  /**
   * Get active fee override for tenant
   */
  private static async getActiveOverride(tenantId: string) {
    return await prisma.platform_fee_overrides.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        OR: [
          { starts_at: null },
          { starts_at: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { expires_at: null },
              { expires_at: { gt: new Date() } },
            ],
          },
        ],
      },
      orderBy: {
        starts_at: 'desc',
      },
    });
  }

  /**
   * Get tier-based fee structure
   */
  private static async getTierFees(
    tier?: string | null
  ): Promise<{ percentage: number; fixedCents: number }> {
    const tierFee = await prisma.platform_fee_tiers.findFirst({
      where: {
        tier_name: tier || 'trial',
        is_active: true,
      },
    });

    if (tierFee) {
      return {
        percentage: Number(tierFee.fee_percentage) || 0,
        fixedCents: tierFee.fee_fixed_cents || 0,
      };
    }

    // Default fallback: 2% fee
    return { percentage: 2.0, fixedCents: 0 };
  }

  /**
   * Apply fee structure and calculate breakdown
   */
  private static applyFeeStructure(
    transactionAmountCents: number,
    gatewayFeeCents: number,
    feePercentage: number,
    feeFixedCents: number,
    feeWaived: boolean,
    feeWaivedReason?: string
  ): FeeCalculation {
    const platformFeeCents = feeWaived
      ? 0
      : Math.round((transactionAmountCents * feePercentage) / 100) + feeFixedCents;

    const totalFeesCents = gatewayFeeCents + platformFeeCents;
    const netAmountCents = transactionAmountCents - totalFeesCents;

    return {
      platformFeeCents,
      platformFeePercentage: feePercentage,
      platformFeeFixedCents: feeFixedCents,
      gatewayFeeCents,
      totalFeesCents,
      netAmountCents,
      feeWaived,
      feeWaivedReason,
    };
  }

  /**
   * Waive fees for a tenant
   */
  static async waiveFees(
    tenantId: string,
    reason: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        platform_fee_waived: true,
        platform_fee_waived_reason: reason,
        platform_fee_waived_until: expiresAt || null,
      },
    });
  }

  /**
   * Remove fee waiver
   */
  static async removeWaiver(tenantId: string): Promise<void> {
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        platform_fee_waived: false,
        platform_fee_waived_reason: null,
        platform_fee_waived_until: null,
      },
    });
  }

  /**
   * Create fee override for tenant
   */
  static async createOverride(
    tenantId: string,
    feePercentage: number,
    feeFixedCents: number,
    reason: string,
    approvedBy: string,
    approvedByEmail: string,
    expiresAt?: Date
  ): Promise<void> {
    await prisma.platform_fee_overrides.create({
      data: {
        id: `override_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: tenantId,
        fee_percentage: feePercentage,
        fee_fixed_cents: feeFixedCents,
        reason,
        approved_by: approvedBy,
        approved_by_email: approvedByEmail,
        expires_at: expiresAt || null,
        is_active: true,
      },
    });
  }

  /**
   * Get revenue summary
   */
  static async getRevenueSummary(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await prisma.$queryRaw<
      Array<{
        total_transactions: bigint;
        gross_volume: number;
        gateway_fees: number;
        platform_revenue: number;
        total_fees: number;
        net_to_merchants: number;
        waived_count: bigint;
        waived_volume: number;
      }>
    >`
      SELECT 
        COUNT(*)::bigint as total_transactions,
        SUM(amount_cents) / 100.0 as gross_volume,
        SUM(gateway_fee_cents) / 100.0 as gateway_fees,
        SUM(platform_fee_cents) / 100.0 as platform_revenue,
        SUM(total_fees_cents) / 100.0 as total_fees,
        SUM(net_amount_cents) / 100.0 as net_to_merchants,
        COUNT(*) FILTER (WHERE fee_waived = true)::bigint as waived_count,
        SUM(amount_cents) FILTER (WHERE fee_waived = true) / 100.0 as waived_volume
      FROM payments
      WHERE payment_status = 'paid'
        AND created_at >= ${startDate}
    `;

    return result[0] || null;
  }

  /**
   * Get revenue by tier
   */
  static async getRevenueByTier(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return await prisma.$queryRaw<
      Array<{
        subscription_tier: string;
        transaction_count: bigint;
        gross_volume: number;
        platform_revenue: number;
        avg_fee_percentage: number;
        waived_count: bigint;
      }>
    >`
      SELECT 
        t.subscription_tier,
        COUNT(p.id)::bigint as transaction_count,
        SUM(p.amount_cents) / 100.0 as gross_volume,
        SUM(p.platform_fee_cents) / 100.0 as platform_revenue,
        AVG(p.platform_fee_percentage) as avg_fee_percentage,
        COUNT(*) FILTER (WHERE p.fee_waived = true)::bigint as waived_count
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      JOIN tenants t ON o.tenant_id = t.id
      WHERE p.payment_status = 'paid'
        AND p.created_at >= ${startDate}
      GROUP BY t.subscription_tier
      ORDER BY platform_revenue DESC
    `;
  }

  /**
   * Calculate potential revenue from waived fees
   */
  static async getWaivedFeeOpportunityCost(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await prisma.$queryRaw<
      Array<{
        waived_transactions: bigint;
        potential_revenue: number;
      }>
    >`
      SELECT 
        COUNT(*)::bigint as waived_transactions,
        SUM(amount_cents * 0.015) / 100.0 as potential_revenue
      FROM payments
      WHERE payment_status = 'paid'
        AND platform_fee_cents = 0
        AND fee_waived = true
        AND created_at >= ${startDate}
    `;

    return result[0] || null;
  }
}
