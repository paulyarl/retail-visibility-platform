import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';
import { getDirectPool } from '../../utils/db-pool';
import TenantProfileService from '../../services/TenantProfileService';
import { resolveEffectiveStatusFromTenant } from '../../utils/org-standing-inheritance';
import { logger } from '../../logger';

const router = Router();

// GET /api/public/tenants - Public tenants endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    // Query public tenants with product counts
    const query = `
      SELECT DISTINCT
        t.id,
        t.name,
        t.slug,
        t.name as business_name,
        t.logo_url,
        COUNT(DISTINCT sp.id) as product_count
      FROM tenants t
      LEFT JOIN public.storefront_products sp ON t.id = sp.tenant_id
        AND sp.visibility = 'public'
        AND sp.item_status = 'active'
      WHERE t.is_active = true
        AND t.location_status = 'active'
        AND EXISTS (
          SELECT 1 FROM public.storefront_products sp2 
          WHERE sp2.tenant_id = t.id 
            AND sp2.visibility = 'public'
            AND sp2.item_status = 'active'
        )
      GROUP BY t.id, t.name, t.slug, t.logo_url
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY t.id, t.name ASC
    `;

    const result = await getDirectPool().query(query);

    const tenants = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      business_name: row.business_name,
      logo_url: row.logo_url
    }));

    res.json({ tenants });

  } catch (error) {
    logger.error('Public tenants error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/tenant/:tenantId/slug - Get tenant slug by ID
router.get('/tenant/:tenantId/slug', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    const query = `
      SELECT slug 
      FROM tenants 
      WHERE id = $1 AND is_active = true
      LIMIT 1
    `;

    const result = await getDirectPool().query(query, [tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ slug: result.rows[0].slug });

  } catch (error) {
    logger.error('Tenant slug error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/slug/:slug/tenant - Get tenant ID by slug
router.get('/slug/:slug/tenant', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' });
    }

    const query = `
      SELECT id 
      FROM tenants 
      WHERE slug = $1 AND is_active = true
      LIMIT 1
    `;

    const result = await getDirectPool().query(query, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ tenantId: result.rows[0].id });

  } catch (error) {
    logger.error('Slug tenant error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/public/tenant/:tenantId/profile - Get public tenant profile with contact information
router.get('/tenant/:tenantId/profile', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    console.log(`[Public Tenant Profile] Fetching profile for tenant: ${tenantId}`);

    // Get singleton instance of TenantProfileService
    const tenantService = TenantProfileService.getInstance();

    // Get the tenant profile (this includes contact information)
    const profile = await tenantService.getTenantProfile(tenantId);

    // Check if tenant has published directory listing and get subscription data
    const { prisma } = await import('../../prisma');
    const [directoryResult, tenantData] = await Promise.all([
      prisma.$queryRaw`
        SELECT is_published FROM "directory_settings_list" WHERE tenant_id = ${tenantId}
      `,
      prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          subscription_status: true,
          subscription_tier: true,
          trial_ends_at: true,
          subscription_ends_at: true,
          grace_ends_at: true,
          manual_subscription_control: true,
          manual_subscription_expires_at: true,
          manual_subscription_reason: true,
          organization_id: true,
          org_standing_mode: true,
          organizations_list: { select: { subscription_status: true, subscription_tier: true } },
          location_status: true,
          gbp_primary_category_id: true,
          gbp_primary_category_name: true,
          gbp_secondary_categories: true,
          is_demo: true,
          demo_expires_at: true,
        }
      } as any),
    ]);

    const hasPublishedDirectory = directoryResult && (directoryResult as any[])?.[0]?.is_published === true;

    // Check featured products separately — featured_products is the source of truth
    let hasFeaturedProducts = false;
    try {
      const featuredProductsResult = await prisma.$queryRaw`
        SELECT 1 FROM featured_products
        WHERE tenant_id = ${tenantId} AND is_active = true
        LIMIT 1
      `;
      hasFeaturedProducts = (featuredProductsResult as any[])?.length > 0;
    } catch (error) {
      console.log('[Public Tenant Profile] featured_products query failed, defaulting hasFeaturedProducts to false');
    }

    console.log(`[Public Tenant Profile] hasPublishedDirectory: ${hasPublishedDirectory}, hasFeaturedProducts: ${hasFeaturedProducts}`);

    if (!profile) {
      console.log(`[Public Tenant Profile] No profile found for tenant: ${tenantId}`);
      return res.status(404).json({
        success: false,
        error: 'Tenant profile not found'
      });
    }

    console.log(`[Public Tenant Profile] Found profile for tenant: ${tenantId}`, {
      hasPhone: !!profile.contact?.phone,
      hasEmail: !!profile.contact?.email,
      hasWebsite: !!profile.contact?.website,
      hasAddress: !!profile.contact?.address
    });

    // Calculate effective expiration
    const effectiveExpiration = tenantData?.manual_subscription_control
      ? {
        expiresAt: tenantData.manual_subscription_expires_at,
        type: 'manual' as const,
        source: 'manual_override' as const
      }
      : tenantData?.subscription_status === 'trial' && tenantData?.trial_ends_at
        ? {
          expiresAt: tenantData.trial_ends_at,
          type: 'trial' as const,
          source: 'automatic_trial' as const
        }
        : tenantData?.subscription_ends_at
          ? {
            expiresAt: tenantData.subscription_ends_at,
            type: 'subscription' as const,
            source: 'automatic_subscription' as const
          }
          : null;

    // Return the profile data (contact info is included in the profile object)
    res.json({
      success: true,
      data: {
        id: profile.id,
        name: profile.name,
        slug: profile.slug,
        subscriptionStatus: tenantData ? resolveEffectiveStatusFromTenant(tenantData).effectiveStatus : 'active',
        subscriptionTier: tenantData?.subscription_tier,
        hasPublishedDirectory: hasPublishedDirectory,
        hasFeaturedProducts,
        primaryCategory: profile.business?.category,
        seoKeywords: profile.seo?.keywords || [],
        seoDescriptions: profile.description || '',
        isFeatured: false, // Could be derived from directory data
        featuredUntil: null,
        isPublished: hasPublishedDirectory,
        secondaryCategories: profile.business?.subcategory ? [profile.business.subcategory] : [],
        metadata: {
          // Merge branding info for frontend compatibility
          theme: profile.branding?.theme || 'professional',
          primaryColor: profile.branding?.primaryColor,
          secondaryColor: profile.branding?.secondaryColor,
          accentColor: profile.branding?.accentColor,
          // Include other metadata
          ...profile.business,
          ...profile.branding
        },
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
        settings: profile.settings,
        addressLine1: profile.contact?.address?.street,
        addressLine2: null,
        city: profile.contact?.address?.city,
        state: profile.contact?.address?.state,
        phoneNumber: profile.contact?.phone,
        email: profile.contact?.email,
        website: profile.contact?.website,
        logoUrl: profile.logo,
        bannerUrl: profile.banner,
        businessDescription: profile.description,
        hours: {}, // Could be added from business hours data
        socialLinks: profile.social,
        latitude: null, // Could be added from address geocoding
        longitude: null,
        gbpCategoryName: profile.business?.category,
        gbpPrimaryCategoryId: tenantData?.gbp_primary_category_id,
        gbpPrimaryCategoryName: tenantData?.gbp_primary_category_name,
        gbpSecondaryCategories: tenantData?.gbp_secondary_categories || [],
        countryCode: profile.contact?.address?.country,
        postalCode: profile.contact?.address?.zipCode,
        contactPerson: profile.name,
        businessInfo: profile.business,
        language: profile.settings?.language || 'en-US',
        currency: profile.settings?.currency || 'USD',
        region: 'us-east-1', // Could be derived from tenant data
        trialEndsAt: tenantData?.trial_ends_at,
        subscriptionEndsAt: tenantData?.subscription_ends_at,
        organizationId: tenantData?.organization_id,
        locationStatus: tenantData?.location_status,
        manualSubscriptionControl: tenantData?.manual_subscription_control,
        manualSubscriptionExpiresAt: tenantData?.manual_subscription_expires_at,
        manualSubscriptionReason: tenantData?.manual_subscription_reason,
        effectiveExpiresAt: effectiveExpiration?.expiresAt,
        effectiveExpiresType: effectiveExpiration?.type,
        effectiveExpiresSource: effectiveExpiration?.source,
        isDemo: tenantData?.is_demo || false,
        demoExpiresAt: tenantData?.demo_expires_at ? tenantData.demo_expires_at.toISOString() : null,
      },
      metadata: {
        tenant: {
          id: tenantId,
          name: profile.name,
          slug: profile.slug,
          type: 'tenant_id'
        },
        identifierType: 'tenant_id'
      }
    });

  } catch (error) {
    logger.error('[Public Tenant Profile] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve tenant profile'
    });
  }
});

// GET /api/public/tenant/:tenantId/payment-gateways - Get tenant payment gateways (public endpoint)
router.get('/tenant/:tenantId/payment-gateways', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID is required'
      });
    }

    console.log(`[Public Tenant Gateways] Querying for tenant: ${tenantId}`);

    // First, let's check if there are any gateways at all
    const allGateways = await prisma.tenant_payment_gateways.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
      },
    });

    console.log(`[Public Tenant Gateways] Found ${allGateways.length} total gateways:`, allGateways);

    // Query active payment gateways for the tenant
    const gateways = await prisma.tenant_payment_gateways.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true, // Only return active gateways
      },
      select: {
        id: true,
        gateway_type: true,
        is_active: true,
        is_default: true,
        // Don't expose sensitive config data like api keys
      },
      orderBy: [
        { is_default: 'desc' },
        { created_at: 'desc' },
      ],
    });

    console.log(`[Public Tenant Gateways] Found ${gateways.length} active gateways:`, gateways);

    // Transform the data to match expected format
    const transformedGateways = gateways.map(gateway => ({
      id: gateway.id,
      name: gateway.gateway_type.charAt(0).toUpperCase() + gateway.gateway_type.slice(1), // Capitalize first letter
      gatewayType: gateway.gateway_type,
      isActive: gateway.is_active,
      isDefault: gateway.is_default,
    }));

    res.json({
      success: true,
      gateways: transformedGateways,
      metadata: {
        tenant: {
          id: tenantId,
          type: 'tenant_id'
        },
        identifierType: 'tenant_id'
      }
    });

  } catch (error) {
    logger.error('Public tenant payment gateways error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      gateways: []
    });
  }
});

// GET /api/public/tenant/:tenantId/oauth-status/:gatewayType - Check OAuth status for a gateway (public endpoint)
router.get('/tenant/:tenantId/oauth-status/:gatewayType', async (req: Request, res: Response) => {
  try {
    const { tenantId, gatewayType } = req.params;

    if (!tenantId || !gatewayType) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID and gateway type are required'
      });
    }

    console.log(`[Public OAuth Status] Checking ${gatewayType} OAuth for tenant: ${tenantId}`);

    // Get the OAuth tokens for this gateway
    const tokens = await prisma.oauth_tokens.findFirst({
      where: {
        tenant_id: tenantId,
        gateway_type: gatewayType.toLowerCase(),
      },
      select: {
        id: true,
        access_token: true,
        refresh_token: true,
        expires_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!tokens) {
      return res.json({
        success: true,
        connected: false,
        isExpired: false,
        message: 'No OAuth tokens found for this gateway'
      });
    }

    // Check if token is expired
    const isExpired = tokens.expires_at ? new Date(tokens.expires_at) < new Date() : false;

    res.json({
      success: true,
      connected: !!tokens.access_token && !isExpired,
      isExpired,
      expiresAt: tokens.expires_at,
    });

  } catch (error) {
    logger.error('Public OAuth status error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      connected: false
    });
  }
});

export default router;
