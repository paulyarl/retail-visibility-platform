import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../../logger';

const prisma = new PrismaClient();

// POST /api/admin/feature-overrides/feature - Create feature override
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      organizationId?: string;
      tenantId: string;
      feature: string;
      featureName: string;
      reason?: string;
      expiresAt?: string;
      grantedBy: string;
    };
    const {
      organizationId,
      tenantId,
      feature,
      featureName,
      reason,
      expiresAt,
      grantedBy
    } = body;

    // Validate required fields
    if (!tenantId || !feature || !featureName || !grantedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, feature, featureName, grantedBy' },
        { status: 400 }
      );
    }

    // Create feature override
    const override = await prisma.feature_overrides.create({
      data: {
        id: `feature-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        tenant_id: tenantId,
        override_type: 'feature',
        status: 'active',
        reason,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        granted_by: grantedBy,
        created_at: new Date(),
        updated_at: new Date(),
        feature_override_details: {
          create: [
            {
              detail_type: 'feature',
              detail_key: 'feature_name',
              detail_value: featureName
            },
            {
              detail_type: 'feature',
              detail_key: 'feature_key',
              detail_value: feature
            },
            {
              detail_type: 'feature',
              detail_key: 'granted',
              detail_value: 'true',
              detail_boolean_value: true
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
    logger.error('Error creating feature override:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { error: 'Failed to create feature override' },
      { status: 500 }
    );
  }
}
