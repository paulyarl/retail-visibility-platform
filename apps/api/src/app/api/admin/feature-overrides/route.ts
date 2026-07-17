import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../../../logger';

const prisma = new PrismaClient();

// GET /api/admin/feature-overrides - List all overrides
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const organizationId = searchParams.get('organizationId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {};
    
    if (type) where.override_type = type;
    if (status) where.status = status;
    if (tenantId) where.tenant_id = tenantId;
    if (organizationId) where.organization_id = organizationId;

    // Get total count
    const totalCount = await prisma.feature_overrides.count({ where });

    // Get overrides with details
    const overrides = await prisma.feature_overrides.findMany({
      where,
      include: {
        feature_override_details: {
          orderBy: [
            { detail_type: 'asc' },
            { detail_key: 'asc' }
          ]
        }
      },
      orderBy: [
        { created_at: 'desc' }
      ],
      skip: offset,
      take: limit
    });

    // Format response
    const formattedOverrides = overrides.map(override => {
      const baseOverride = {
        id: override.id,
        organizationId: override.organization_id,
        tenantId: override.tenant_id,
        type: override.override_type,
        status: override.status,
        reason: override.reason,
        approvedBy: override.approved_by,
        approvedAt: override.approved_at?.toISOString(),
        createdAt: override.created_at.toISOString(),
        updatedAt: override.updated_at.toISOString(),
        expiresAt: override.expires_at?.toISOString() || null
      };

      // Add type-specific fields from details
      const details: Record<string, any> = {};
      override.feature_override_details.forEach(detail => {
        if (detail.detail_numeric_value !== null) {
          details[detail.detail_key] = detail.detail_numeric_value;
        } else if (detail.detail_boolean_value !== null) {
          details[detail.detail_key] = detail.detail_boolean_value;
        } else {
          details[detail.detail_key] = detail.detail_value;
        }
      });

      // Add common fields from main table
      if (override.subscription_tier) details.subscriptionTier = override.subscription_tier;
      if (override.original_limit !== null) details.originalLimit = override.original_limit;
      if (override.custom_limit !== null) details.customLimit = override.custom_limit;
      if (override.custom_price !== null) details.customPrice = override.custom_price;
      if (override.currency) details.currency = override.currency;

      return { ...baseOverride, ...details };
    });

    return NextResponse.json({
      overrides: formattedOverrides,
      count: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    logger.error('Error fetching feature overrides:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return NextResponse.json(
      { error: 'Failed to fetch feature overrides' },
      { status: 500 }
    );
  }
}

// POST /api/admin/feature-overrides - Create override (generic)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      organizationId?: string;
      tenantId: string;
      overrideType: string;
      reason?: string;
      expiresAt?: string;
      grantedBy: string;
      details?: Array<{
        type: string;
        key: string;
        value: string;
        numericValue?: number;
        booleanValue?: boolean;
      }>;
    };
    const {
      organizationId,
      tenantId,
      overrideType,
      reason,
      expiresAt,
      grantedBy,
      details = []
    } = body;

    // Validate required fields
    if (!tenantId || !overrideType || !grantedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: tenantId, overrideType, grantedBy' },
        { status: 400 }
      );
    }

    // Validate override type
    const validTypes = ['feature', 'pricing', 'limits', 'featured_products', 'tenant_limits'];
    if (!validTypes.includes(overrideType)) {
      return NextResponse.json(
        { error: `Invalid override type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Handle specific override types
    if (overrideType === 'feature') {
      return handleFeatureOverride(request);
    } else if (overrideType === 'pricing') {
      return handlePricingOverride(request);
    } else if (overrideType === 'limits') {
      return handleLimitsOverride(request);
    } else if (overrideType === 'featured_products') {
      return handleFeaturedProductsOverride(request);
    } else if (overrideType === 'tenant_limits') {
      return handleTenantLimitsOverride(request);
    }

    // Create override with details
    const override = await prisma.feature_overrides.create({
      data: {
        id: `override-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        organization_id: organizationId,
        tenant_id: tenantId,
        override_type: overrideType,
        status: 'active',
        reason,
        expires_at: expiresAt ? new Date(expiresAt) : null,
        granted_by: grantedBy,
        created_at: new Date(),
        updated_at: new Date(),
        feature_override_details: {
          create: details.map((detail: any) => ({
            detail_type: detail.type,
            detail_key: detail.key,
            detail_value: detail.value,
            detail_numeric_value: detail.numericValue || null,
            detail_boolean_value: detail.booleanValue || null
          }))
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

// Handle feature override creation
async function handleFeatureOverride(request: NextRequest) {
  const body = await request.json() as {
    organizationId?: string;
    tenantId: string;
    feature: string;
    featureName: string;
    reason?: string;
    expiresAt?: string;
    grantedBy: string;
  };
  const { organizationId, tenantId, feature, featureName, reason, expiresAt, grantedBy } = body;

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
}

// Handle pricing override creation
async function handlePricingOverride(request: NextRequest) {
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
  const { organizationId, tenantId, subscriptionTier, originalPrice, customPrice, discountPercent, currency = 'USD', billingInterval, reason, expiresAt, grantedBy } = body;

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
}

// Handle limits override creation
async function handleLimitsOverride(request: NextRequest) {
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
  const { organizationId, tenantId, subscriptionTier, limitType, originalLimit, customLimit, reason, expiresAt, grantedBy } = body;

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
}

// Handle featured products override creation
async function handleFeaturedProductsOverride(request: NextRequest) {
  const body = await request.json() as {
    organizationId?: string;
    tenantId: string;
    subscriptionTier: string;
    featuredType: string;
    originalLimit?: number;
    customLimit: number;
    reason?: string;
    expiresAt?: string;
    grantedBy: string;
  };
  const { organizationId, tenantId, subscriptionTier, featuredType, originalLimit, customLimit, reason, expiresAt, grantedBy } = body;

  const override = await prisma.feature_overrides.create({
    data: {
      id: `featured-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organization_id: organizationId,
      tenant_id: tenantId,
      override_type: 'featured_products',
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
            detail_type: 'featured_type',
            detail_key: 'featured_name',
            detail_value: featuredType
          },
          {
            detail_type: 'featured_type',
            detail_key: 'duration',
            detail_value: '90_days'
          }
        ]
      }
    },
    include: {
      feature_override_details: true
    }
  });

  return NextResponse.json(override, { status: 201 });
}

// Handle tenant limits override creation
async function handleTenantLimitsOverride(request: NextRequest) {
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
  const { organizationId, tenantId, subscriptionTier, originalLimit, customLimit, reason, expiresAt, grantedBy } = body;

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
}
