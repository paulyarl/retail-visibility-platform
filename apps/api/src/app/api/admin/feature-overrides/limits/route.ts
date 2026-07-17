import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../../logger';

const prisma = new PrismaClient();

// POST /api/admin/feature-overrides/limits - Create limits override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      organizationId?: string;
      tenantId: string;
      subscriptionTier: string;
      limitType: string;
      originalLimit?: number;
      customLimit: number;
      reason?: string;
      expiresAt?: string;
      grantedBy: string;
    };
    const {
      organizationId,
      tenantId,
      subscriptionTier,
      limitType,
      originalLimit,
      customLimit,
      reason,
      expiresAt,
      grantedBy
    } = body;

    // Validate required fields
    if (!tenantId || !subscriptionTier || !limitType || !customLimit || !grantedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, subscriptionTier, limitType, customLimit, grantedBy' },
        { status: 400 }
      );
    }

    // Validate limit type
    const validLimitTypes = ['locations', 'skus'];
    if (!validLimitTypes.includes(limitType)) {
      return NextResponse.json(
        { error: `Invalid limit type. Must be one of: ${validLimitTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate limits
    if (customLimit <= 0) {
      return NextResponse.json(
        { error: 'Custom limit must be greater than 0' },
        { status: 400 }
      );
    }

    // Create limits override
    const override = await prisma.feature_overrides.create({
      data: {
        id: `limits-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        tenant_id: tenantId,
        override_type: 'limits',
        status: 'active',
        subscription_tier: subscriptionTier,
        original_limit: originalLimit || 0,
        custom_limit: customLimit,
        reason,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        granted_by: grantedBy,
        created_at: new Date(),
        updated_at: new Date(),
        feature_override_details: {
          create: [
            {
              detail_type: 'limit_type',
              detail_key: 'limit_name',
              detail_value: limitType
            },
            {
              detail_type: 'limit_type',
              detail_key: 'limit_unit',
              detail_value: limitType === 'locations' ? 'locations' : 'items'
            }
          ]
        }
      },
      include: {
        feature_override_details: true
      }
    });

    return NextResponse.json(override, { status: 201 });

  } catch (error) {
    logger.error('Error creating limits override:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { error: 'Failed to create limits override' },
      { status: 500 }
    );
  }
}
