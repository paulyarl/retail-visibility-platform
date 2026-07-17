import { Router } from 'express';
import { prisma } from '../prisma';
import { 
  getAuthorizationUrl, 
  decodeState, 
  exchangeCodeForTokens, 
  encryptToken,
  getUserInfo
} from '../lib/google/oauth';
import { listMerchantAccounts } from '../lib/google/gmc';
import { generateQuickStart } from '../lib/id-generator';
import { isGMCSyncAllowed } from '../lib/google/capability-gate';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const router = Router();

const WEB_URL = unifiedConfig.webUrl;

/**
 * Get Google Merchant Center connection status
 * GET /google/oauth/status
 */
router.get('/google/oauth/status', async (req, res) => {
  const startTime = Date.now();
  console.log(`[Google Merchant OAuth] Status check started for tenant: ${req.query.tenantId}`);

  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      console.log(`[Google Merchant OAuth] Status check failed - missing tenantId (${Date.now() - startTime}ms)`);
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    console.log(`[Google Merchant OAuth] Checking OAuth account for tenant: ${tenantId}`);
    const dbQueryStart = Date.now();

    // Check for OAuth account linked to this tenant
    const accountRecord = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_oauth_tokens_list: {
          select: {
            id: true,
            expires_at: true,
            scopes: true,
          }
        }
      }
    });

    const dbQueryTime = Date.now() - dbQueryStart;
    console.log(`[Google Merchant OAuth] Database query completed in ${dbQueryTime}ms`);

    const processingStart = Date.now();

    const isConnected = !!accountRecord?.google_oauth_tokens_list;
    const tokenRecord = accountRecord?.google_oauth_tokens_list;
    const isExpired = tokenRecord?.expires_at 
      ? new Date(tokenRecord.expires_at) < new Date() 
      : false;

    const processingTime = Date.now() - processingStart;
    console.log(`[Google Merchant OAuth] Data processing completed in ${processingTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`[Google Merchant OAuth] Status check completed in ${totalTime}ms - DB: ${dbQueryTime}ms, Processing: ${processingTime}ms`);

    res.json({
      success: true,
      data: {
        isConnected,
        isExpired,
        hasTokens: !!tokenRecord,
        email: accountRecord?.email || null,
        displayName: accountRecord?.display_name || null,
        scopes: tokenRecord?.scopes || null,
        tokenExpiry: tokenRecord?.expires_at || null,
        message: isConnected 
          ? (isExpired ? 'Connected but token expired - will auto-refresh' : 'Connected to Google Merchant Center')
          : 'Not connected to Google Merchant Center'
      }
    });
  } catch (error) {
    const errorTime = Date.now() - startTime;
    logger.error(`[Google Merchant OAuth] Error checking status after ${errorTime}ms:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Initiate Google Merchant Center OAuth flow
 * GET /google/oauth/authorize
 */
router.get('/google/oauth/authorize', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    // Verify tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found'
      });
    }

    // Generate authorization URL
    const authUrl = getAuthorizationUrl(tenantId);
    
    console.log(`[Google Merchant OAuth] Returning OAuth URL for tenant ${tenantId}`);
    
    // Return URL as JSON — frontend navigates browser to it
    return res.json({
      success: true,
      data: { url: authUrl }
    });
  } catch (error) {
    logger.error('[Google Merchant OAuth] Error initiating OAuth:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'oauth_init_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * OAuth callback handler
 * GET /google/oauth/callback
 */
router.get('/google/oauth/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Handle OAuth errors
    if (oauthError) {
      logger.error('[Google Merchant OAuth] OAuth error:', undefined, { error: { name: (oauthError as any)?.name || 'Error', message: (oauthError as any)?.message || String(oauthError), stack: (oauthError as any)?.stack } });
      return res.redirect(`${WEB_URL}/settings/integrations/google?error=${oauthError}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/google?error=missing_code`);
    }

    if (!state || typeof state !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/google?error=missing_state`);
    }

    // Decode and validate state
    const decodedState = decodeState(state);
    if (!decodedState) {
      return res.redirect(`${WEB_URL}/settings/integrations/google?error=invalid_state`);
    }

    const { tenantId } = decodedState;

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/google?error=token_exchange_failed`);
    }

    // Get user info to get Google account ID and email
    const userInfo = await getUserInfo(tokens.access_token);
    if (!userInfo) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/google?error=userinfo_failed`);
    }

    // Encrypt tokens for storage
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = tokens.scope.split(' ');
    const now = new Date();

    // Create or update Google OAuth account record
    const accountId = generateQuickStart('goa'); // google_oauth_account
    
    // Upsert account record
    const account = await prisma.google_oauth_accounts_list.upsert({
      where: {
        tenant_id_google_account_id: {
          tenant_id: tenantId,
          google_account_id: userInfo.id
        }
      },
      create: {
        id: accountId,
        tenant_id: tenantId,
        google_account_id: userInfo.id,
        email: userInfo.email,
        display_name: userInfo.name || null,
        profile_picture_url: userInfo.picture || null,
        scopes,
        updated_at: now,
      },
      update: {
        email: userInfo.email,
        display_name: userInfo.name || null,
        profile_picture_url: userInfo.picture || null,
        scopes,
        updated_at: now,
      }
    });

    // Create or update token record
    const tokenId = generateQuickStart('got'); // google_oauth_token
    await prisma.google_oauth_tokens_list.upsert({
      where: { account_id: account.id },
      create: {
        id: tokenId,
        account_id: account.id,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        scopes,
        updated_at: now,
      },
      update: {
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        scopes,
        updated_at: now,
      }
    });

    console.log(`[Google Merchant OAuth] Successfully stored tokens for tenant ${tenantId}, email: ${userInfo.email}`);

    // Redirect back to integrations page with success
    res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/google?success=connected`);
  } catch (error) {
    logger.error('[Google Merchant OAuth] Callback error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.redirect(`${WEB_URL}/settings/integrations/google?error=callback_failed`);
  }
});

/**
 * Disconnect Google Merchant Center
 * POST /google/oauth/disconnect
 */
router.post('/google/oauth/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    // Delete all OAuth accounts and tokens for this tenant (cascade will delete tokens)
    await prisma.google_oauth_accounts_list.deleteMany({
      where: { tenant_id: tenantId }
    });

    console.log(`[Google Merchant OAuth] Disconnected tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Successfully disconnected from Google Merchant Center'
    });
  } catch (error) {
    logger.error('[Google Merchant OAuth] Disconnect error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'disconnect_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List available Merchant Center accounts
 * GET /google/oauth/merchants
 */
router.get('/google/oauth/merchants', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    // Get OAuth account for this tenant
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      select: { id: true, email: true }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'no_oauth_account',
        message: 'No Google account connected. Please connect your Google account first.'
      });
    }

    // List merchant accounts using the GMC API
    const merchants = await listMerchantAccounts(account.id);

    console.log(`[Google Merchant OAuth] Found ${merchants.length} merchant accounts for tenant ${tenantId}`);

    res.json({
      success: true,
      data: {
        merchants: merchants.map((m: any) => ({
          id: String(m.accountId || m.merchantId || '').replace('accounts/', ''),
          name: m.accountName || m.name || 'Unnamed Account',
          displayName: m.accountName || m.name || 'Unnamed Account',
        })),
        email: account.email
      }
    });
  } catch (error) {
    logger.error('[Google Merchant OAuth] Error listing merchants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'list_merchants_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Link a Merchant Center account to this tenant
 * POST /google/oauth/link-merchant
 */
router.post('/google/oauth/link-merchant', async (req, res) => {
  try {
    const { tenantId, merchantId, merchantName } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    if (!merchantId || typeof merchantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_merchantId',
        message: 'merchantId is required'
      });
    }

    // Get OAuth account for this tenant
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      select: { id: true }
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'no_oauth_account',
        message: 'No Google account connected'
      });
    }

    // Check if link already exists
    const existingLink = await prisma.google_merchant_links_list.findFirst({
      where: {
        account_id: account.id,
        merchant_id: merchantId
      }
    });

    const now = new Date();

    // Ensure only one active merchant link per tenant
    await prisma.google_merchant_links_list.updateMany({
      where: {
        is_active: true,
        google_oauth_accounts_list: { tenant_id: tenantId },
      },
      data: {
        is_active: false,
        updated_at: now,
      },
    });

    if (existingLink) {
      // Update existing link
      await prisma.google_merchant_links_list.update({
        where: { id: existingLink.id },
        data: {
          merchant_name: merchantName || 'Merchant Account',
          is_active: true,
          updated_at: now,
        }
      });
    } else {
      // Create new link
      const linkId = generateQuickStart('gml'); // google_merchant_link
      await prisma.google_merchant_links_list.create({
        data: {
          id: linkId,
          account_id: account.id,
          merchant_id: merchantId,
          merchant_name: merchantName || 'Merchant Account',
          is_active: true,
          updated_at: now,
        }
      });
    }

    console.log(`[Google Merchant OAuth] Linked merchant ${merchantId} to tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Merchant Center account linked successfully',
      data: {
        merchantId,
        merchantName: merchantName || 'Merchant Account'
      }
    });
  } catch (error) {
    logger.error('[Google Merchant OAuth] Error linking merchant:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'link_merchant_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// PRODUCT SYNC ENDPOINTS
// ============================================================================

/**
 * Get GMC product sync status
 * GET /google/merchant/sync-status
 */
router.get('/google/merchant/sync-status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { getGMCSyncStatus } = await import('../services/GMCProductSync');
    const status = await getGMCSyncStatus(tenantId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('[GMC Sync Status] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'get_status_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update GMC sync settings (pickup-only intent, etc.)
 * PATCH /google/merchant/settings
 */
router.patch('/google/merchant/settings', async (req, res) => {
  try {
    const { tenantId, pickupOnly, pickupMethod, pickupSla, fulfillmentMode } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const allowedFulfillmentModes = new Set(['standard', 'shipping_and_pickup', 'pickup_only']);
    if (fulfillmentMode && typeof fulfillmentMode === 'string' && !allowedFulfillmentModes.has(fulfillmentMode)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_fulfillment_mode',
        message: 'fulfillmentMode must be one of: standard, shipping_and_pickup, pickup_only'
      });
    }

    // Validate pickup values if provided
    const allowedPickupMethods = new Set(['buy', 'reserve', 'ship to store', 'not supported']);
    const allowedPickupSlas = new Set(['same day', 'next day', '2-day', '3-day', '4-day', '5-day', '6-day', '7-day', 'multi-week']);

    if (pickupMethod && typeof pickupMethod === 'string' && !allowedPickupMethods.has(pickupMethod)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_pickup_method',
        message: 'pickupMethod must be one of: buy, reserve, ship to store, not supported'
      });
    }

    if (pickupSla && typeof pickupSla === 'string' && !allowedPickupSlas.has(pickupSla)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_pickup_sla',
        message: 'pickupSla must be one of: same day, next day, 2-day, 3-day, 4-day, 5-day, 6-day, 7-day, multi-week'
      });
    }

    // Determine next mode (support legacy pickupOnly)
    let nextMode: string | undefined;
    if (typeof fulfillmentMode === 'string') {
      nextMode = fulfillmentMode;
    } else if (typeof pickupOnly === 'boolean') {
      nextMode = pickupOnly ? 'pickup_only' : 'standard';
    }

    // Keep legacy pickup_only boolean aligned with the pickup_only mode only
    const nextPickupOnly = nextMode ? (nextMode === 'pickup_only') : (typeof pickupOnly === 'boolean' ? pickupOnly : undefined);

    // Find the tenant's OAuth account + active merchant link
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
          select: { id: true }
        }
      }
    });

    const linkId = account?.google_merchant_links_list?.[0]?.id;
    if (!linkId) {
      return res.status(404).json({
        success: false,
        error: 'no_merchant_link',
        message: 'No active Merchant Center link found for this tenant'
      });
    }

    await prisma.google_merchant_links_list.update({
      where: { id: linkId },
      data: {
        fulfillment_mode: nextMode,
        pickup_only: typeof nextPickupOnly === 'boolean' ? nextPickupOnly : undefined,
        pickup_method: typeof pickupMethod === 'string' ? pickupMethod : undefined,
        pickup_sla: typeof pickupSla === 'string' ? pickupSla : undefined,
        updated_at: new Date(),
      }
    });

    const { getGMCSyncStatus } = await import('../services/GMCProductSync');
    const status = await getGMCSyncStatus(tenantId);

    return res.json({
      success: true,
      message: 'GMC settings updated',
      data: status,
    });
  } catch (error) {
    logger.error('[GMC Settings] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({
      success: false,
      error: 'update_settings_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Sync all products to Google Merchant Center
 * POST /google/merchant/sync
 */
router.post('/google/merchant/sync', async (req, res) => {
  try {
    const { tenantId, itemIds } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const { batchSyncProducts, getGMCSyncStatus } = await import('../services/GMCProductSync');

    // Check if tenant's tier allows GMC sync
    const gmcAllowed = await isGMCSyncAllowed(tenantId);
    if (!gmcAllowed) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan. Please upgrade to use this feature.'
      });
    }

    // Check if tenant can sync
    const status = await getGMCSyncStatus(tenantId);
    if (!status.hasGMCConnection) {
      return res.status(400).json({
        success: false,
        error: 'not_connected',
        message: 'Google Merchant Center not connected. Please connect first.'
      });
    }

    if (!status.hasMerchantLink) {
      return res.status(400).json({
        success: false,
        error: 'no_merchant_link',
        message: 'No Merchant Center account linked. Please link an account first.'
      });
    }

    // Perform batch sync
    const result = await batchSyncProducts(tenantId, itemIds);

    console.log(`[GMC Sync] Sync completed for tenant ${tenantId}:`, {
      total: result.total,
      synced: result.synced,
      failed: result.failed,
    });

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced ${result.synced} products to Google Merchant Center`
        : `Sync completed with ${result.failed} failures`,
      data: result
    });
  } catch (error) {
    logger.error('[GMC Sync] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'sync_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Sync a single product to Google Merchant Center
 * POST /google/merchant/sync/:itemId
 */
router.post('/google/merchant/sync/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    // Check if tenant's tier allows GMC sync
    const gmcAllowed = await isGMCSyncAllowed(tenantId);
    if (!gmcAllowed) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan. Please upgrade to use this feature.'
      });
    }

    const { syncProduct } = await import('../services/GMCProductSync');
    const result = await syncProduct(tenantId, itemId);

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully synced product to Google Merchant Center`
        : `Failed to sync product: ${result.error}`,
      data: result
    });
  } catch (error) {
    logger.error('[GMC Sync Product] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'sync_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update inventory/stock for a product
 * PATCH /google/merchant/inventory/:itemId
 */
router.patch('/google/merchant/inventory/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { tenantId, quantity } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    if (typeof quantity !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'missing_quantity',
        message: 'quantity is required and must be a number'
      });
    }

    const { updateInventory } = await import('../services/GMCProductSync');
    const result = await updateInventory(tenantId, itemId, quantity);

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully updated inventory on Google Merchant Center`
        : `Failed to update inventory: ${result.error}`,
      data: result
    });
  } catch (error) {
    logger.error('[GMC Update Inventory] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'update_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update price for a product
 * PATCH /google/merchant/price/:itemId
 */
router.patch('/google/merchant/price/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { tenantId, priceCents, currency } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    if (typeof priceCents !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'missing_price',
        message: 'priceCents is required and must be a number'
      });
    }

    const { updatePrice } = await import('../services/GMCProductSync');
    const result = await updatePrice(tenantId, itemId, priceCents, currency || 'USD');

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully updated price on Google Merchant Center`
        : `Failed to update price: ${result.error}`,
      data: result
    });
  } catch (error) {
    logger.error('[GMC Update Price] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'update_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a product from Google Merchant Center
 * DELETE /google/merchant/product/:itemId
 */
router.delete('/google/merchant/product/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const { deleteProduct } = await import('../services/GMCProductSync');
    const result = await deleteProduct(tenantId, itemId);

    res.json({
      success: result.success,
      message: result.success 
        ? `Successfully deleted product from Google Merchant Center`
        : `Failed to delete product: ${result.error}`,
      data: result
    });
  } catch (error) {
    logger.error('[GMC Delete Product] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'delete_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get GMC validation report for all products
 * GET /google/merchant/validation-report
 */
router.get('/google/merchant/validation-report', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required'
      });
    }

    const { validateProductsForGMC } = await import('../services/GMCValidationService');

    // Fetch all syncable inventory items for the tenant
    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        item_status: { not: 'trashed' },
        product_type: { in: ['physical', 'hybrid'] },
        visibility: 'public',
      },
      take: 1000,
    });

    // Resolve Google category IDs from platform_categories
    const platformCats = await prisma.platform_categories.findMany({
      where: { is_active: true },
      select: { name: true, google_category_id: true },
    });
    const googleCatByPlatformName = new Map<string, string>();
    for (const pc of platformCats) {
      if (pc.google_category_id) {
        googleCatByPlatformName.set(pc.name.toLowerCase(), pc.google_category_id);
      }
    }
    for (const item of items) {
      const catPath = (item as any).category_path as string[] | undefined;
      if (catPath && catPath.length > 0) {
        for (let i = catPath.length - 1; i >= 0; i--) {
          const gcid = googleCatByPlatformName.get(catPath[i].toLowerCase());
          if (gcid) {
            (item as any).google_product_category_id = gcid;
            break;
          }
        }
      }
    }

    const report = validateProductsForGMC(items);
    report.tenantId = tenantId;

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    logger.error('[GMC Validation Report] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'validation_report_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get per-product GMC sync status
 * GET /google/merchant/product-sync-status
 */
router.get('/google/merchant/product-sync-status', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const statusFilter = (req.query.status as string) || 'all';
    const search = (req.query.search as string) || '';
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

    const { prisma } = await import('../prisma');

    const where: any = { tenant_id: tenantId };

    if (statusFilter !== 'all' && ['pending', 'success', 'error'].includes(statusFilter)) {
      where.sync_status = statusFilter;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.inventory_items.findMany({
        where,
        select: {
          id: true,
          title: true,
          sku: true,
          sync_status: true,
          synced_at: true,
          visibility: true,
          price: true,
          product_type: true,
          metadata: true,
        },
        orderBy: { title: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.inventory_items.count({ where }),
    ]);

    const products = items.map((item) => {
      const meta = item.metadata as any;
      return {
        id: item.id,
        title: item.title,
        sku: item.sku || null,
        syncStatus: item.sync_status || 'pending',
        syncedAt: item.synced_at?.toISOString() || null,
        visibility: item.visibility || 'public',
        price: item.price ? Number(item.price) : null,
        productType: item.product_type || null,
        syncError: meta?.gmc_sync_error || null,
        gmcItemId: meta?.gmc_item_id || null,
      };
    });

    res.json({
      success: true,
      data: {
        products,
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    logger.error('[GMC Product Sync Status] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'product_sync_status_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
