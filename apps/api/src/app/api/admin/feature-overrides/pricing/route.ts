import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/admin/feature-overrides/pricing - Create pricing override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      organizationId?: string;
      tenantId: string;
      subscriptionTier: string;
      originalPrice?: number;
      customPrice: number;
      discountPercent?: number;
      currency?: string;
      billingInterval: string;
      reason?: string;
      expiresAt?: string;
      grantedBy: string;
    };
    const {
      organizationId,
      tenantId,
      subscriptionTier,
      originalPrice,
      customPrice,
      discountPercent,
      currency = 'USD',
      billingInterval,
      reason,
      expiresAt,
      grantedBy
    } = body;

    // Validate required fields
    if (!tenantId || !subscriptionTier || !customPrice || !billingInterval || !grantedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, subscriptionTier, customPrice, billingInterval, grantedBy' },
        { status: 400 }
      );
    }

    // Validate currency
    const validCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    if (!validCurrencies.includes(currency)) {
      return NextResponse.json(
        { error: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate billing interval
    const validIntervals = ['monthly', 'yearly'];
    if (!validIntervals.includes(billingInterval)) {
      return NextResponse.json(
        { error: `Invalid billing interval. Must be one of: ${validIntervals.join(', ')}` },
        { status: 400 }
      );
    }

    // Create pricing override
    const override = await prisma.feature_overrides.create({
      data: {
        id: `pricing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        tenant_id: tenantId,
        override_type: 'pricing',
        status: 'active',
        subscription_tier: subscriptionTier,
        custom_price: customPrice,
        currency,
        reason,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        granted_by: grantedBy,
        created_at: new Date(),
        updated_at: new Date(),
        feature_override_details: {
          create: [
            {
              detail_type: 'pricing_field',
              detail_key: 'billing_interval',
              detail_value: billingInterval
            },
            ...(originalPrice ? [{
              detail_type: 'pricing_field',
              detail_key: 'original_price',
              detail_value: originalPrice.toString(),
              detail_numeric_value: originalPrice
            }] : []),
            ...(discountPercent ? [{
              detail_type: 'pricing_field',
              detail_key: 'discount_percent',
              detail_value: discountPercent.toString(),
              detail_numeric_value: discountPercent
            }] : [])
          ]
        }
      },
      include: {
        feature_override_details: true
      }
    });

    return NextResponse.json(override, { status: 201 });

  } catch (error) {
    console.error('Error creating pricing override:', error);
    return NextResponse.json(
      { error: 'Failed to create pricing override' },
      { status: 500 }
    );
  }
}
