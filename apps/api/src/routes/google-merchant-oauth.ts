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

const router = Router();

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/**
 * Get Google Merchant Center connection status
 * GET /google/oauth/status
 */
router.get('/google/oauth/status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required'
      });
    }

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

    const isConnected = !!accountRecord?.google_oauth_tokens_list;
    const tokenRecord = accountRecord?.google_oauth_tokens_list;
    const isExpired = tokenRecord?.expires_at 
      ? new Date(tokenRecord.expires_at) < new Date() 
      : false;

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
    console.error('[Google Merchant OAuth] Error checking status:', error);
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
    
    console.log(`[Google Merchant OAuth] Redirecting tenant ${tenantId} to Google OAuth`);
    
    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('[Google Merchant OAuth] Error initiating OAuth:', error);
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
      console.error('[Google Merchant OAuth] OAuth error:', oauthError);
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
    console.error('[Google Merchant OAuth] Callback error:', error);
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
    console.error('[Google Merchant OAuth] Disconnect error:', error);
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
    console.error('[Google Merchant OAuth] Error listing merchants:', error);
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
    console.error('[Google Merchant OAuth] Error linking merchant:', error);
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
    console.error('[GMC Sync Status] Error:', error);
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
    console.error('[GMC Settings] Error:', error);
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
    console.error('[GMC Sync] Error:', error);
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
    console.error('[GMC Sync Product] Error:', error);
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
    console.error('[GMC Update Inventory] Error:', error);
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
    console.error('[GMC Update Price] Error:', error);
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
    console.error('[GMC Delete Product] Error:', error);
    res.status(500).json({
      success: false,
      error: 'delete_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
