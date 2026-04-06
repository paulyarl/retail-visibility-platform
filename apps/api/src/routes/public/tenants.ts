import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';
import { getDirectPool } from '../../utils/db-pool';
import TenantProfileService from '../../services/TenantProfileService';
const tenantReviewsRoutes = require('./[tenantId]/reviews').default;

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
        t.business_name,
        t.logo_url,
        COUNT(DISTINCT sp.id) as product_count
      FROM tenants t
      LEFT JOIN storefront_products sp ON t.id = sp.tenant_id
        AND sp.is_public = true
        AND sp.is_active = true
      WHERE t.is_active = true
        AND EXISTS (
          SELECT 1 FROM storefront_products sp2 
          WHERE sp2.tenant_id = t.id 
            AND sp2.is_public = true 
            AND sp2.is_active = true
        )
      GROUP BY t.id, t.name, t.slug, t.business_name, t.logo_url
      HAVING COUNT(DISTINCT sp.id) > 0
      ORDER BY t.business_name ASC, t.name ASC
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
    console.error('Public tenants error:', error);
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
    console.error('Tenant slug error:', error);
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
    console.error('Slug tenant error:', error);
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
    
    // Check if tenant has published directory listing
    const { prisma } = await import('../../prisma');
    const directoryResult = await prisma.$queryRaw`
      SELECT is_published FROM "directory_settings_list" WHERE tenant_id = ${tenantId}
    `;
    const hasPublishedDirectory = directoryResult && (directoryResult as any[])?.[0]?.is_published === true;
    
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

    // Return the profile data (contact info is included in the profile object)
    res.json({
      success: true,
      data: {
        id: profile.id,
        name: profile.name,
        slug: profile.slug,
        description: profile.description,
        logo: profile.logo,
        banner: profile.banner,
        business_name: profile.name, // For compatibility with frontend
        phone_number: profile.contact?.phone, // For compatibility with frontend
        email: profile.contact?.email,
        website: profile.contact?.website,
        address_line1: profile.contact?.address?.street,
        address_line2: null,
        city: profile.contact?.address?.city,
        state: profile.contact?.address?.state,
        postal_code: profile.contact?.address?.zipCode,
        country: profile.contact?.address?.country,
        business_description: profile.description,
        logo_url: profile.logo,
        contact: profile.contact, // Include full contact object
        business: profile.business,
        branding: profile.branding,
        settings: profile.settings,
        has_published_directory: hasPublishedDirectory,
        metadata: {
          // Merge branding info for frontend compatibility
          theme: profile.branding?.theme || 'professional',
          primaryColor: profile.branding?.primaryColor,
          secondaryColor: profile.branding?.secondaryColor,
          accentColor: profile.branding?.accentColor,
          // Include other metadata
          ...profile.business,
          ...profile.branding
        }
      },
      message: 'Public tenant profile retrieved successfully'
    });
    
  } catch (error) {
    console.error('[Public Tenant Profile] Error:', error);
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
    console.error('Public tenant payment gateways error:', error);
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
    console.error('Public OAuth status error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      connected: false
    });
  }
});

// Mount individual tenant routes
router.use('/:tenantId/reviews', tenantReviewsRoutes);

export default router;
