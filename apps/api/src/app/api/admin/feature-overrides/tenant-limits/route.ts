import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../../logger';

const prisma = new PrismaClient();

// POST /api/admin/feature-overrides/tenant-limits - Create tenant limits override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      organizationId?: string;
      tenantId: string;
      subscriptionTier: string;
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
      originalLimit,
      customLimit,
      reason,
      expiresAt,
      grantedBy
    } = body;

    // Validate required fields
    if (!tenantId || !subscriptionTier || !customLimit || !grantedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, subscriptionTier, customLimit, grantedBy' },
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

    // Create tenant limits override
    const override = await prisma.feature_overrides.create({
      data: {
        id: `tenant-limits-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        tenant_id: tenantId,
        override_type: 'tenant_limits',
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
              detail_value: 'locations'
            },
            {
              detail_type: 'limit_type',
              detail_key: 'geographic_scope',
              detail_value: 'nationwide'
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
    logger.error('Error creating tenant limits override:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { error: 'Failed to create tenant limits override' },
      { status: 500 }
    );
  }
}
