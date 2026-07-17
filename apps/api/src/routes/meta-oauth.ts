/**
 * Meta Commerce OAuth & Catalog Sync Routes
 * Phase 2A: Meta Commerce Integration
 *
 * Follows google-merchant-oauth.ts pattern:
 * - GET  /meta/oauth/status       — connection status
 * - GET  /meta/oauth/authorize    — initiate OAuth flow
 * - GET  /meta/oauth/callback     — OAuth callback handler
 * - POST /meta/oauth/disconnect   — disconnect Meta
 * - GET  /meta/oauth/businesses   — list business accounts
 * - POST /meta/oauth/link-catalog — link a commerce catalog
 * - POST /meta/catalog/sync       — trigger manual catalog sync
 * - GET  /meta/catalog/sync-status — sync status
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import {
  getAuthorizationUrl,
  decodeState,
  exchangeCodeForTokens,
  getLongLivedToken,
  getUserInfo,
  getBusinessAccounts,
  encryptToken,
  decryptToken,
  revokeToken,
} from '../lib/meta/oauth';
import { fullCatalogSync } from '../services/MetaCatalogSyncService';
import { generateMetaOAuthAccountId, generateMetaOAuthTokenId } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';
import { logger } from '../logger';

const router = Router();

const WEB_URL = unifiedConfig.webUrl;

/**
 * Get Meta Commerce connection status
 * GET /meta/oauth/status
 */
router.get('/meta/oauth/status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        meta_oauth_tokens_list: {
          select: {
            id: true,
            expires_at: true,
            scopes: true,
          },
        },
      },
    });

    const isConnected = !!account?.meta_oauth_tokens_list;
    const tokenRecord = account?.meta_oauth_tokens_list;
    const isExpired = tokenRecord?.expires_at
      ? new Date(tokenRecord.expires_at) < new Date()
      : false;

    res.json({
      success: true,
      data: {
        isConnected,
        isExpired,
        hasTokens: !!tokenRecord,
        email: account?.email || null,
        displayName: account?.display_name || null,
        businessId: account?.business_id || null,
        catalogId: account?.catalog_id || null,
        instagramAccountId: account?.instagram_account_id || null,
        scopes: tokenRecord?.scopes || null,
        tokenExpiry: tokenRecord?.expires_at || null,
        message: isConnected
          ? (isExpired ? 'Connected but token expired - re-authorization required' : 'Connected to Meta Commerce')
          : 'Not connected to Meta Commerce',
      },
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error checking status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Initiate Meta OAuth flow
 * GET /meta/oauth/authorize
 */
router.get('/meta/oauth/authorize', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'tenant_not_found',
        message: 'Tenant not found',
      });
    }

    const authUrl = getAuthorizationUrl(tenantId);
    console.log(`[Meta OAuth] Returning OAuth URL for tenant ${tenantId}`);
    return res.json({
      success: true,
      data: { url: authUrl }
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error initiating OAuth:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'oauth_init_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OAuth callback handler
 * GET /meta/oauth/callback
 */
router.get('/meta/oauth/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error('[Meta OAuth] OAuth error:', undefined, { error: { name: 'Error', message: String(String(oauthError)) } });
      return res.redirect(`${WEB_URL}/settings/integrations/meta?error=${oauthError}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/meta?error=missing_code`);
    }

    if (!state || typeof state !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/meta?error=missing_state`);
    }

    const decodedState = decodeState(state);
    if (!decodedState) {
      return res.redirect(`${WEB_URL}/settings/integrations/meta?error=invalid_state`);
    }

    const { tenantId } = decodedState;

    // Exchange code for short-lived tokens
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/meta?error=token_exchange_failed`);
    }

    // Exchange for long-lived token (60 days)
    const longLived = await getLongLivedToken(tokens.access_token);
    const accessToken = longLived?.access_token || tokens.access_token;
    const expiresIn = longLived?.expires_in || tokens.expires_in;

    // Get user info
    const userInfo = await getUserInfo(accessToken);
    if (!userInfo) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/meta?error=userinfo_failed`);
    }

    const encryptedAccessToken = encryptToken(accessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const now = new Date();

    // Upsert account record
    const accountId = generateMetaOAuthAccountId(tenantId);
    const account = await prisma.meta_oauth_accounts_list.upsert({
      where: {
        tenant_id_meta_account_id: {
          tenant_id: tenantId,
          meta_account_id: userInfo.id,
        },
      },
      create: {
        id: accountId,
        tenant_id: tenantId,
        meta_account_id: userInfo.id,
        email: userInfo.email || null,
        display_name: userInfo.name || null,
        profile_picture_url: userInfo.picture?.data?.url || null,
        scopes: [],
        updated_at: now,
      },
      update: {
        email: userInfo.email || null,
        display_name: userInfo.name || null,
        profile_picture_url: userInfo.picture?.data?.url || null,
        updated_at: now,
      },
    });

    // Upsert token record
    const tokenId = generateMetaOAuthTokenId(tenantId);
    await prisma.meta_oauth_tokens_list.upsert({
      where: { account_id: account.id },
      create: {
        id: tokenId,
        account_id: account.id,
        access_token_encrypted: encryptedAccessToken,
        expires_at: expiresAt,
        scopes: [],
        updated_at: now,
      },
      update: {
        access_token_encrypted: encryptedAccessToken,
        expires_at: expiresAt,
        updated_at: now,
      },
    });

    console.log(`[Meta OAuth] Successfully stored tokens for tenant ${tenantId}, user: ${userInfo.email}`);

    res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/meta?success=connected`);
  } catch (error) {
    logger.error('[Meta OAuth] Callback error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.redirect(`${WEB_URL}/settings/integrations/meta?error=callback_failed`);
  }
});

/**
 * Disconnect Meta Commerce
 * POST /meta/oauth/disconnect
 */
router.post('/meta/oauth/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required',
      });
    }

    // Get account to revoke token
    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { meta_oauth_tokens_list: true },
    });

    if (account?.meta_oauth_tokens_list) {
      try {
        const token = decryptToken(account.meta_oauth_tokens_list.access_token_encrypted);
        await revokeToken(token);
      } catch (e) {
        console.warn('[Meta OAuth] Token revocation failed (continuing with disconnect):', e);
      }
    }

    // Delete all OAuth accounts and tokens for this tenant (cascade will delete tokens)
    await prisma.meta_oauth_accounts_list.deleteMany({
      where: { tenant_id: tenantId },
    });

    console.log(`[Meta OAuth] Disconnected tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Successfully disconnected from Meta Commerce',
    });
  } catch (error) {
    logger.error('[Meta OAuth] Disconnect error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'disconnect_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * List available Meta Business accounts
 * GET /meta/oauth/businesses
 */
router.get('/meta/oauth/businesses', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { meta_oauth_tokens_list: true },
    });

    if (!account?.meta_oauth_tokens_list) {
      return res.status(404).json({
        success: false,
        error: 'no_oauth_account',
        message: 'No Meta account connected. Please connect your Meta account first.',
      });
    }

    const token = decryptToken(account.meta_oauth_tokens_list.access_token_encrypted);
    const businesses = await getBusinessAccounts(token);

    res.json({
      success: true,
      data: {
        businesses: businesses?.data || [],
        email: account.email,
      },
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error listing businesses:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'list_businesses_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Link a Meta Commerce catalog to this tenant
 * POST /meta/oauth/link-catalog
 */
router.post('/meta/oauth/link-catalog', async (req, res) => {
  try {
    const { tenantId, businessId, catalogId, instagramAccountId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required',
      });
    }

    if (!catalogId || typeof catalogId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_catalogId',
        message: 'catalogId is required',
      });
    }

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'no_oauth_account',
        message: 'No Meta account connected.',
      });
    }

    await prisma.meta_oauth_accounts_list.update({
      where: { id: account.id },
      data: {
        business_id: businessId || null,
        catalog_id: catalogId,
        instagram_account_id: instagramAccountId || null,
        updated_at: new Date(),
      },
    });

    console.log(`[Meta OAuth] Linked catalog ${catalogId} to tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Catalog linked successfully',
      data: { businessId, catalogId, instagramAccountId },
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error linking catalog:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'link_catalog_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger manual catalog sync
 * POST /meta/catalog/sync
 */
router.post('/meta/catalog/sync', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required',
      });
    }

    // Check connection
    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { meta_oauth_tokens_list: true },
    });

    if (!account?.meta_oauth_tokens_list) {
      return res.status(400).json({
        success: false,
        error: 'not_connected',
        message: 'Not connected to Meta Commerce. Please connect first.',
      });
    }

    if (!account.catalog_id) {
      return res.status(400).json({
        success: false,
        error: 'no_catalog',
        message: 'No catalog linked. Please link a catalog first.',
      });
    }

    console.log(`[Meta OAuth] Starting manual catalog sync for tenant ${tenantId}`);

    // Run sync asynchronously
    fullCatalogSync(tenantId)
      .then(result => {
        console.log(`[Meta OAuth] Catalog sync complete for tenant ${tenantId}: ${result.synced}/${result.total} synced`);
      })
      .catch(err => {
        logger.error(`[Meta OAuth] Catalog sync failed for tenant ${tenantId}:`, undefined, { error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err), stack: (err as any)?.stack } });
      });

    res.json({
      success: true,
      message: 'Catalog sync started. Check sync status for results.',
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error triggering catalog sync:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'sync_trigger_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get catalog sync status
 * GET /meta/catalog/sync-status
 */
router.get('/meta/catalog/sync-status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const { getMetaFeedStats } = await import('../lib/meta/feed-generator');
    const stats = await getMetaFeedStats(tenantId);

    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      select: { catalog_id: true, updated_at: true },
    });

    res.json({
      success: true,
      data: {
        ...stats,
        catalogId: account?.catalog_id || null,
        lastSyncAt: account?.updated_at || null,
      },
    });
  } catch (error) {
    logger.error('[Meta OAuth] Error getting sync status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'sync_status_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
