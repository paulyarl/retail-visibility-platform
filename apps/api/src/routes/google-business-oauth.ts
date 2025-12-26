import { Router } from 'express';
import { google } from 'googleapis';
import { prisma } from '../prisma';

const router = Router();

/**
 * Get Google Business Profile connection status
 * GET /google/business/status
 */
router.get('/google/business/status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        google_business_access_token: true,
        google_business_refresh_token: true,
        google_business_token_expiry: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found'
      });
    }

    const isConnected = !!(tenant.google_business_access_token && tenant.google_business_refresh_token);
    const isExpired = tenant.google_business_token_expiry 
      ? new Date(tenant.google_business_token_expiry) < new Date() 
      : false;

    res.json({
      success: true,
      data: {
        isConnected,
        isExpired,
        hasAccessToken: !!tenant.google_business_access_token,
        hasRefreshToken: !!tenant.google_business_refresh_token,
        tokenExpiry: tenant.google_business_token_expiry,
        message: isConnected 
          ? (isExpired ? 'Connected but token expired - will auto-refresh' : 'Connected to Google Business Profile')
          : 'Not connected to Google Business Profile'
      }
    });
  } catch (error) {
    console.error('[Google Business OAuth] Error checking status:', error);
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initiate Google Business Profile OAuth flow
 * GET /google/business
 */
router.get('/google/business', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        success: false,
        error: 'missing_credentials',
        message: 'Google Business Profile OAuth credentials not configured'
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate auth URL with state parameter containing tenantId
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent',
      state: JSON.stringify({ tenantId }),
    });

    // Redirect user to Google OAuth consent screen
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Google Business OAuth] Error initiating flow:', error);
    res.status(500).json({
      success: false,
      error: 'oauth_init_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Handle Google Business Profile OAuth callback
 * GET /google/business/callback
 */
router.get('/google/business/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('[Google Business OAuth] OAuth error:', error);
      return res.redirect(`${process.env.WEB_URL}/settings?error=oauth_denied`);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_code',
        message: 'Authorization code not provided'
      });
    }

    // Parse state to get tenantId
    let tenantId: string;
    try {
      const stateData = JSON.parse(state as string);
      tenantId = stateData.tenantId;
    } catch {
      return res.status(400).json({
        success: false,
        error: 'invalid_state',
        message: 'Invalid state parameter'
      });
    }

    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        success: false,
        error: 'missing_credentials',
        message: 'Google Business Profile OAuth credentials not configured'
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to obtain tokens');
    }

    // Store tokens in database
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        google_business_access_token: tokens.access_token,
        google_business_refresh_token: tokens.refresh_token,
        google_business_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      }
    });

    console.log(`[Google Business OAuth] Successfully connected tenant ${tenantId}`);

    // Redirect back to frontend with success
    res.redirect(`${process.env.WEB_URL}/t/${tenantId}/settings/integrations/google?success=business_connected`);
  } catch (error) {
    console.error('[Google Business OAuth] Error in callback:', error);
    res.redirect(`${process.env.WEB_URL}/settings/integrations/google?error=oauth_failed`);
  }
});

/**
 * Disconnect Google Business Profile
 * POST /google/business/disconnect
 */
router.post('/google/business/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    // Remove tokens from database
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        google_business_access_token: null,
        google_business_refresh_token: null,
        google_business_token_expiry: null,
      }
    });

    res.json({
      success: true,
      message: 'Google Business Profile disconnected successfully'
    });
  } catch (error) {
    console.error('[Google Business OAuth] Error disconnecting:', error);
    res.status(500).json({
      success: false,
      error: 'disconnect_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List GBP locations for the connected account
 * GET /google/business/locations
 */
router.get('/google/business/locations', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    // Get tenant with GBP tokens
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        google_business_access_token: true,
        google_business_refresh_token: true,
        google_business_token_expiry: true,
      }
    });

    if (!tenant?.google_business_access_token) {
      return res.status(404).json({
        success: false,
        error: 'not_connected',
        message: 'Google Business Profile not connected'
      });
    }

    // Check token expiry and refresh if needed
    let accessToken = tenant.google_business_access_token;
    if (tenant.google_business_token_expiry && new Date(tenant.google_business_token_expiry) < new Date()) {
      // Token expired - try to refresh
      if (tenant.google_business_refresh_token) {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_BUSINESS_CLIENT_ID,
          process.env.GOOGLE_BUSINESS_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: tenant.google_business_refresh_token });
        
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          accessToken = credentials.access_token!;
          
          // Update stored token
          await prisma.tenants.update({
            where: { id: tenantId },
            data: {
              google_business_access_token: accessToken,
              google_business_token_expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
            }
          });
        } catch (refreshError) {
          console.error('[GBP] Token refresh failed:', refreshError);
          return res.status(401).json({
            success: false,
            error: 'token_expired',
            message: 'Google token expired and refresh failed. Please reconnect.'
          });
        }
      }
    }

    // First, get the accounts
    const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('[GBP] Failed to fetch accounts:', errorText);
      
      // Parse error for user-friendly messages
      try {
        const errorData = JSON.parse(errorText);
        const errorCode = errorData?.error?.code;
        const errorReason = errorData?.error?.details?.[0]?.reason;
        
        // Handle quota/rate limit errors (429)
        if (errorCode === 429 || errorReason === 'RATE_LIMIT_EXCEEDED') {
          const quotaLimit = errorData?.error?.details?.[0]?.metadata?.quota_limit_value;
          
          // If quota is 0, API access hasn't been approved yet
          if (quotaLimit === '0') {
            return res.status(503).json({
              success: false,
              error: 'api_not_approved',
              message: 'Google Business Profile API access is pending approval. This feature will be available soon.',
              userMessage: 'GBP location linking is temporarily unavailable while we complete platform verification with Google. Please check back later.'
            });
          }
          
          // Regular rate limit
          return res.status(429).json({
            success: false,
            error: 'rate_limited',
            message: 'Too many requests to Google. Please wait a moment and try again.',
            userMessage: 'Please wait a moment before trying again.'
          });
        }
        
        // Handle permission denied (403)
        if (errorCode === 403 || errorReason === 'SERVICE_DISABLED') {
          return res.status(503).json({
            success: false,
            error: 'api_disabled',
            message: 'Google Business Profile API is not enabled for this platform.',
            userMessage: 'GBP location linking is temporarily unavailable. Please contact support.'
          });
        }
        
        // Handle unauthorized (401)
        if (errorCode === 401) {
          return res.status(401).json({
            success: false,
            error: 'unauthorized',
            message: 'Google authorization expired. Please reconnect your Google account.',
            userMessage: 'Please reconnect your Google account to continue.'
          });
        }
      } catch (parseError) {
        // If we can't parse the error, fall through to generic error
      }
      
      return res.status(500).json({
        success: false,
        error: 'api_error',
        message: 'Failed to fetch GBP accounts'
      });
    }

    const accountsData = await accountsResponse.json() as { accounts?: any[] };
    const accounts = accountsData.accounts || [];

    if (accounts.length === 0) {
      return res.json({
        success: true,
        data: { locations: [], message: 'No GBP accounts found' }
      });
    }

    // Fetch locations for each account
    const allLocations: any[] = [];
    
    for (const account of accounts) {
      const accountName = account.name; // e.g., "accounts/123456789"
      
      const locationsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title,storefrontAddress,phoneNumbers,websiteUri,categories,metadata`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json() as { locations?: any[] };
        const locations = locationsData.locations || [];
        
        for (const loc of locations) {
          allLocations.push({
            id: loc.name, // Full resource name like "locations/123456789"
            locationId: loc.name.split('/').pop(),
            name: loc.title,
            address: loc.storefrontAddress ? formatGBPAddress(loc.storefrontAddress) : null,
            phone: loc.phoneNumbers?.primaryPhone || null,
            website: loc.websiteUri || null,
            category: loc.categories?.primaryCategory?.displayName || null,
            isVerified: loc.metadata?.hasVoiceOfMerchant || false,
            accountName: accountName,
          });
        }
      }
    }

    console.log(`[GBP] Found ${allLocations.length} locations for tenant ${tenantId}`);

    res.json({
      success: true,
      data: {
        locations: allLocations,
        accountCount: accounts.length
      }
    });
  } catch (error) {
    console.error('[GBP] Error listing locations:', error);
    res.status(500).json({
      success: false,
      error: 'list_locations_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Link a GBP location to this tenant
 * POST /google/business/link-location
 */
router.post('/google/business/link-location', async (req, res) => {
  try {
    const { tenantId, locationId, locationName, address } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    if (!locationId || typeof locationId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_locationId',
        message: 'locationId is required'
      });
    }

    // Get or create OAuth account for this tenant
    let account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId }
    });

    // If no OAuth account exists, create one from the legacy tokens
    if (!account) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: {
          google_business_access_token: true,
          google_business_refresh_token: true,
        }
      });

      if (!tenant?.google_business_access_token) {
        return res.status(404).json({
          success: false,
          error: 'not_connected',
          message: 'Google Business Profile not connected'
        });
      }

      // Create OAuth account record
      const accountId = `goa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      account = await prisma.google_oauth_accounts_list.create({
        data: {
          id: accountId,
          tenant_id: tenantId,
          google_account_id: 'legacy',
          email: 'legacy@gbp.local',
          updated_at: new Date(),
        }
      });
    }

    // Check if location already linked
    const existingLink = await prisma.gbp_locations_list.findFirst({
      where: {
        account_id: account.id,
        location_id: locationId
      }
    });

    const now = new Date();

    if (existingLink) {
      // Update existing link
      await prisma.gbp_locations_list.update({
        where: { id: existingLink.id },
        data: {
          location_name: locationName || existingLink.location_name,
          address: address || existingLink.address,
          last_fetched_at: now,
          updated_at: now,
        }
      });
    } else {
      // Create new link
      const linkId = `gbp_loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await prisma.gbp_locations_list.create({
        data: {
          id: linkId,
          account_id: account.id,
          location_id: locationId,
          location_name: locationName || 'GBP Location',
          address: address || null,
          is_verified: true,
          is_published: true,
          last_fetched_at: now,
          updated_at: now,
        }
      });
    }

    console.log(`[GBP] Linked location ${locationId} to tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'GBP location linked successfully',
      data: {
        locationId,
        locationName
      }
    });
  } catch (error) {
    console.error('[GBP] Error linking location:', error);
    res.status(500).json({
      success: false,
      error: 'link_location_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get linked GBP location for tenant
 * GET /google/business/linked-location
 */
router.get('/google/business/linked-location', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    // Get OAuth account and linked location
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        gbp_locations_list: {
          take: 1,
          orderBy: { updated_at: 'desc' }
        }
      }
    });

    const linkedLocation = account?.gbp_locations_list[0] || null;

    res.json({
      success: true,
      data: {
        hasLinkedLocation: !!linkedLocation,
        location: linkedLocation ? {
          id: linkedLocation.id,
          locationId: linkedLocation.location_id,
          name: linkedLocation.location_name,
          address: linkedLocation.address,
          isVerified: linkedLocation.is_verified,
          lastFetched: linkedLocation.last_fetched_at,
        } : null
      }
    });
  } catch (error) {
    console.error('[GBP] Error getting linked location:', error);
    res.status(500).json({
      success: false,
      error: 'get_linked_location_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to format GBP address
function formatGBPAddress(address: any): string {
  const parts = [
    address.addressLines?.join(', '),
    address.locality,
    address.administrativeArea,
    address.postalCode,
  ].filter(Boolean);
  
  return parts.join(', ');
}

/**
 * Sync business info to Google Business Profile
 * POST /google/business/sync
 * 
 * This is the main endpoint for businesses to push their data to Google
 */
router.post('/google/business/sync', async (req, res) => {
  try {
    const { tenantId, fields } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    // Import sync service
    const { syncAllBusinessInfo, getSyncStatus } = await import('../services/GBPBusinessInfoSync');

    // Check if tenant can sync
    const status = await getSyncStatus(tenantId);
    if (!status.canSync) {
      return res.status(400).json({
        success: false,
        error: 'cannot_sync',
        message: status.hasGBPConnection 
          ? 'No GBP location linked. Please link a location first.'
          : 'Google Business Profile not connected. Please connect first.',
        status
      });
    }

    // Get tenant data
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        metadata: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found'
      });
    }

    // Get business profile for all business data
    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
    });

    // Get secondary categories from tenant metadata
    const tenantMetadata = tenant.metadata as any || {};
    const secondaryCategories = tenantMetadata?.gbp_categories?.secondary || [];

    // Build sync payload from business profile
    const syncPayload: any = {};

    // Only include fields that have values
    if (businessProfile?.business_name || tenant.name) {
      syncPayload.name = businessProfile?.business_name || tenant.name;
    }
    if (businessProfile?.phone_number) syncPayload.phone = businessProfile.phone_number;
    if (businessProfile?.website) syncPayload.website = businessProfile.website;
    if (businessProfile?.business_description) syncPayload.description = businessProfile.business_description;
    
    if (businessProfile?.address_line1 && businessProfile?.city && businessProfile?.state) {
      syncPayload.address = {
        addressLines: [businessProfile.address_line1],
        locality: businessProfile.city,
        administrativeArea: businessProfile.state,
        postalCode: businessProfile.postal_code || '',
        regionCode: businessProfile.country_code || 'US',
      };
    }

    if (businessProfile?.gbp_category_id) {
      syncPayload.primaryCategoryId = businessProfile.gbp_category_id;
      if (secondaryCategories.length > 0) {
        syncPayload.secondaryCategoryIds = secondaryCategories.map((c: any) => c.id);
      }
    }

    // Perform sync
    const result = await syncAllBusinessInfo(tenantId, syncPayload);

    console.log(`[GBP Sync] Sync completed for tenant ${tenantId}:`, {
      success: result.success,
      syncedFields: result.syncedFields,
      failedFields: result.failedFields,
    });

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced ${result.syncedFields.length} fields to Google`
        : 'Sync failed',
      data: result
    });
  } catch (error) {
    console.error('[GBP Sync] Error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Sync specific field to Google Business Profile
 * POST /google/business/sync/:field
 */
router.post('/google/business/sync/:field', async (req, res) => {
  try {
    const { field } = req.params;
    const { tenantId, value } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const validFields = ['name', 'phone', 'website', 'address', 'description', 'categories'];
    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_field',
        message: `Invalid field. Valid fields: ${validFields.join(', ')}`
      });
    }

    // Import sync functions
    const { 
      syncBusinessName, 
      syncPhoneNumber, 
      syncWebsite, 
      syncAddress, 
      syncDescription, 
      syncCategories,
      getSyncStatus 
    } = await import('../services/GBPBusinessInfoSync');

    // Check if tenant can sync
    const status = await getSyncStatus(tenantId);
    if (!status.canSync) {
      return res.status(400).json({
        success: false,
        error: 'cannot_sync',
        message: status.hasGBPConnection 
          ? 'No GBP location linked'
          : 'Google Business Profile not connected',
        status
      });
    }

    let result;
    switch (field) {
      case 'name':
        result = await syncBusinessName(tenantId, value);
        break;
      case 'phone':
        result = await syncPhoneNumber(tenantId, value);
        break;
      case 'website':
        result = await syncWebsite(tenantId, value);
        break;
      case 'address':
        result = await syncAddress(tenantId, value);
        break;
      case 'description':
        result = await syncDescription(tenantId, value);
        break;
      case 'categories':
        result = await syncCategories(tenantId, value.primaryCategoryId, value.secondaryCategoryIds);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'invalid_field',
          message: 'Invalid field'
        });
    }

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced ${field} to Google`
        : result.skipped 
          ? `Skipped: ${result.reason}`
          : `Failed to sync ${field}`,
      data: result
    });
  } catch (error) {
    console.error('[GBP Sync Field] Error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get sync status for a tenant
 * GET /google/business/sync-status
 */
router.get('/google/business/sync-status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { getSyncStatus } = await import('../services/GBPBusinessInfoSync');
    const status = await getSyncStatus(tenantId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[GBP Sync Status] Error:', error);
    res.status(500).json({
      success: false,
      error: 'get_status_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// ADVANCED FEATURES: Photos, Posts, Reviews, Attributes
// ============================================================================

/**
 * List media items for a location
 * GET /google/business/media
 */
router.get('/google/business/media', async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { listMedia } = await import('../services/GBPAdvancedSync');
    const result = await listMedia(tenantId);
    res.json({ success: result.success, data: result.media, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'list_media_failed' });
  }
});

/**
 * Upload a photo to GBP
 * POST /google/business/media
 */
router.post('/google/business/media', async (req, res) => {
  try {
    const { tenantId, photoUrl, category, description } = req.body;
    if (!tenantId || !photoUrl) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    const { uploadPhoto } = await import('../services/GBPAdvancedSync');
    const result = await uploadPhoto(tenantId, photoUrl, category || 'ADDITIONAL', description);
    res.json({ success: result.success, data: { mediaItemId: result.mediaItemId }, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'upload_photo_failed' });
  }
});

/**
 * Delete a media item
 * DELETE /google/business/media/:mediaItemName
 */
router.delete('/google/business/media/:mediaItemName', async (req, res) => {
  try {
    const { mediaItemName } = req.params;
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { deleteMedia } = await import('../services/GBPAdvancedSync');
    const result = await deleteMedia(tenantId, decodeURIComponent(mediaItemName));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'delete_media_failed' });
  }
});

/**
 * List GBP posts
 * GET /google/business/posts
 */
router.get('/google/business/posts', async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { listPosts } = await import('../services/GBPAdvancedSync');
    const result = await listPosts(tenantId);
    res.json({ success: result.success, data: result.posts, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'list_posts_failed' });
  }
});

/**
 * Create a GBP post
 * POST /google/business/posts
 */
router.post('/google/business/posts', async (req, res) => {
  try {
    const { tenantId, summary, callToAction, media, topicType, event, offer } = req.body;
    if (!tenantId || !summary) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    const { createPost } = await import('../services/GBPAdvancedSync');
    const result = await createPost(tenantId, { summary, callToAction, media, topicType, event, offer });
    res.json({ success: result.success, data: { postId: result.postId }, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'create_post_failed' });
  }
});

/**
 * Delete a GBP post
 * DELETE /google/business/posts/:postName
 */
router.delete('/google/business/posts/:postName', async (req, res) => {
  try {
    const { postName } = req.params;
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { deletePost } = await import('../services/GBPAdvancedSync');
    const result = await deletePost(tenantId, decodeURIComponent(postName));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'delete_post_failed' });
  }
});

/**
 * List reviews
 * GET /google/business/reviews
 */
router.get('/google/business/reviews', async (req, res) => {
  try {
    const { tenantId, pageSize, pageToken } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { listReviews } = await import('../services/GBPAdvancedSync');
    const result = await listReviews(tenantId, Number(pageSize) || 50, pageToken as string);
    res.json({
      success: result.success,
      data: {
        reviews: result.reviews,
        averageRating: result.averageRating,
        totalReviewCount: result.totalReviewCount,
        nextPageToken: result.nextPageToken,
      },
      error: result.error,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'list_reviews_failed' });
  }
});

/**
 * Reply to a review
 * POST /google/business/reviews/:reviewName/reply
 */
router.post('/google/business/reviews/:reviewName/reply', async (req, res) => {
  try {
    const { reviewName } = req.params;
    const { tenantId, comment } = req.body;
    if (!tenantId || !comment) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    const { replyToReview } = await import('../services/GBPAdvancedSync');
    const result = await replyToReview(tenantId, decodeURIComponent(reviewName), comment);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'reply_to_review_failed' });
  }
});

/**
 * Delete a review reply
 * DELETE /google/business/reviews/:reviewName/reply
 */
router.delete('/google/business/reviews/:reviewName/reply', async (req, res) => {
  try {
    const { reviewName } = req.params;
    const { tenantId } = req.body;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { deleteReviewReply } = await import('../services/GBPAdvancedSync');
    const result = await deleteReviewReply(tenantId, decodeURIComponent(reviewName));
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'delete_reply_failed' });
  }
});

/**
 * Get available attributes for location category
 * GET /google/business/attributes/available
 */
router.get('/google/business/attributes/available', async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { getAvailableAttributes } = await import('../services/GBPAdvancedSync');
    const result = await getAvailableAttributes(tenantId);
    res.json({ success: result.success, data: result.attributes, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'get_attributes_failed' });
  }
});

/**
 * Get current location attributes
 * GET /google/business/attributes
 */
router.get('/google/business/attributes', async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { getLocationAttributes } = await import('../services/GBPAdvancedSync');
    const result = await getLocationAttributes(tenantId);
    res.json({ success: result.success, data: result.attributes, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: 'get_attributes_failed' });
  }
});

/**
 * Update location attributes
 * PATCH /google/business/attributes
 */
router.patch('/google/business/attributes', async (req, res) => {
  try {
    const { tenantId, attributes } = req.body;
    if (!tenantId || !attributes) {
      return res.status(400).json({ success: false, error: 'missing_required_fields' });
    }

    const { updateAttributes } = await import('../services/GBPAdvancedSync');
    const result = await updateAttributes(tenantId, attributes);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'update_attributes_failed' });
  }
});

/**
 * Set common attributes (WiFi, wheelchair, etc.)
 * POST /google/business/attributes/common
 */
router.post('/google/business/attributes/common', async (req, res) => {
  try {
    const { tenantId, ...options } = req.body;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'missing_tenantId' });
    }

    const { setCommonAttributes } = await import('../services/GBPAdvancedSync');
    const result = await setCommonAttributes(tenantId, options);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: 'set_attributes_failed' });
  }
});

/**
 * Read current data from Google Business Profile
 * GET /google/business/read
 * 
 * Fetches the current state of the business on Google
 */
router.get('/google/business/read', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { readFromGoogle, getSyncStatus } = await import('../services/GBPBusinessInfoSync');

    // Check if tenant can read
    const status = await getSyncStatus(tenantId);
    if (!status.canSync) {
      return res.status(400).json({
        success: false,
        error: 'cannot_read',
        message: status.hasGBPConnection 
          ? 'No GBP location linked. Please link a location first.'
          : 'Google Business Profile not connected. Please connect first.',
        status
      });
    }

    const result = await readFromGoogle(tenantId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'read_failed',
        message: result.error || 'Failed to read from Google'
      });
    }

    res.json({
      success: true,
      message: 'Successfully read data from Google',
      data: result.data
    });
  } catch (error) {
    console.error('[GBP Read] Error:', error);
    res.status(500).json({
      success: false,
      error: 'read_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Compare local data with Google data
 * GET /google/business/compare
 * 
 * Returns a side-by-side comparison showing conflicts
 */
router.get('/google/business/compare', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { compareWithGoogle, getSyncStatus } = await import('../services/GBPBusinessInfoSync');

    // Check if tenant can compare
    const status = await getSyncStatus(tenantId);
    if (!status.canSync) {
      return res.status(400).json({
        success: false,
        error: 'cannot_compare',
        message: status.hasGBPConnection 
          ? 'No GBP location linked. Please link a location first.'
          : 'Google Business Profile not connected. Please connect first.',
        status
      });
    }

    const result = await compareWithGoogle(tenantId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'compare_failed',
        message: result.error || 'Failed to compare with Google'
      });
    }

    res.json({
      success: true,
      message: `Comparison complete: ${result.summary.synced} synced, ${result.summary.conflicts} conflicts`,
      data: result
    });
  } catch (error) {
    console.error('[GBP Compare] Error:', error);
    res.status(500).json({
      success: false,
      error: 'compare_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// SYNC TRACKING ENDPOINTS
// ============================================================================

/**
 * Get sync tracking status for a tenant
 * GET /google/business/sync-tracking
 */
router.get('/google/business/sync-tracking', async (req, res) => {
  try {
    const { tenantId, category } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { getSyncTracking, getSyncStatusSummary } = await import('../services/GBPSyncTrackingService');

    const [records, summary] = await Promise.all([
      getSyncTracking(tenantId, category as string | undefined),
      getSyncStatusSummary(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        records,
        summary,
      }
    });
  } catch (error) {
    console.error('[GBP Sync Tracking] Error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_tracking_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initialize sync tracking for a tenant
 * POST /google/business/sync-tracking/initialize
 */
router.post('/google/business/sync-tracking/initialize', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const { initializeSyncTracking, getSyncStatusSummary } = await import('../services/GBPSyncTrackingService');

    await initializeSyncTracking(tenantId);
    const summary = await getSyncStatusSummary(tenantId);

    res.json({
      success: true,
      message: 'Sync tracking initialized',
      data: { summary }
    });
  } catch (error) {
    console.error('[GBP Sync Tracking] Initialize error:', error);
    res.status(500).json({
      success: false,
      error: 'initialize_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get sync history for a tenant
 * GET /google/business/sync-history
 */
router.get('/google/business/sync-history', async (req, res) => {
  try {
    const { tenantId, category, limit, offset } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { getSyncHistory } = await import('../services/GBPSyncTrackingService');

    const history = await getSyncHistory(tenantId, {
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    console.error('[GBP Sync History] Error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_history_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get pending sync items
 * GET /google/business/sync-pending
 */
router.get('/google/business/sync-pending', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { getFieldsPendingPush, getFieldsPendingPull, getConflicts } = await import('../services/GBPSyncTrackingService');

    const [pendingPush, pendingPull, conflicts] = await Promise.all([
      getFieldsPendingPush(tenantId),
      getFieldsPendingPull(tenantId),
      getConflicts(tenantId),
    ]);

    res.json({
      success: true,
      data: {
        pendingPush,
        pendingPull,
        conflicts,
        summary: {
          pendingPushCount: pendingPush.length,
          pendingPullCount: pendingPull.length,
          conflictCount: conflicts.length,
        }
      }
    });
  } catch (error) {
    console.error('[GBP Sync Pending] Error:', error);
    res.status(500).json({
      success: false,
      error: 'sync_pending_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
