/**
 * TikTok Shop OAuth & Catalog Sync Routes
 * Phase 2B: TikTok Shop Integration
 *
 * Follows meta-oauth.ts pattern:
 * - GET  /tiktok/oauth/status        — connection status
 * - GET  /tiktok/oauth/authorize     — initiate OAuth flow
 * - GET  /tiktok/oauth/callback      — OAuth callback handler
 * - POST /tiktok/oauth/disconnect    — disconnect TikTok
 * - POST /tiktok/catalog/sync        — trigger manual catalog sync
 * - GET  /tiktok/catalog/sync-status — sync status
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import {
  getAuthorizationUrl,
  decodeState,
  exchangeCodeForTokens,
  getSellerInfo,
  encryptToken,
  decryptToken,
  refreshAccessToken,
} from '../lib/tiktok/oauth';
import { fullCatalogSync } from '../services/TikTokCatalogSyncService';
import { generateTikTokOAuthAccountId, generateTikTokOAuthTokenId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';

/**
 * Get TikTok Shop connection status
 */
router.get('/tiktok/oauth/status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const account = await prisma.tiktok_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        tiktok_oauth_tokens_list: {
          select: {
            id: true,
            expires_at: true,
            refresh_expires_at: true,
            scopes: true,
          },
        },
      },
    });

    const isConnected = !!account?.tiktok_oauth_tokens_list;
    const tokenRecord = account?.tiktok_oauth_tokens_list;
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
        shopId: account?.shop_id || null,
        shopName: account?.shop_name || null,
        scopes: tokenRecord?.scopes || null,
        tokenExpiry: tokenRecord?.expires_at || null,
        message: isConnected
          ? (isExpired ? 'Connected but token expired - re-authorization required' : 'Connected to TikTok Shop')
          : 'Not connected to TikTok Shop',
      },
    });
  } catch (error) {
    logger.error('TikTok OAuth status error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'status_check_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Initiate TikTok OAuth flow
 */
router.get('/tiktok/oauth/authorize', async (req, res) => {
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
    logger.info('TikTok OAuth: redirecting tenant', undefined, { tenantId });
    res.redirect(authUrl);
  } catch (error) {
    logger.error('TikTok OAuth authorize error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'oauth_init_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * OAuth callback handler
 */
router.get('/tiktok/oauth/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error('TikTok OAuth error:', undefined, { error: String(oauthError) });
      return res.redirect(`${WEB_URL}/settings/integrations/tiktok?error=${oauthError}`);
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/tiktok?error=missing_code`);
    }

    if (!state || typeof state !== 'string') {
      return res.redirect(`${WEB_URL}/settings/integrations/tiktok?error=missing_state`);
    }

    const decodedState = decodeState(state);
    if (!decodedState) {
      return res.redirect(`${WEB_URL}/settings/integrations/tiktok?error=invalid_state`);
    }

    const { tenantId } = decodedState;

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/tiktok?error=token_exchange_failed`);
    }

    const sellerInfo = await getSellerInfo(tokens.access_token);
    if (!sellerInfo) {
      return res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/tiktok?error=sellerinfo_failed`);
    }

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const refreshExpiresAt = tokens.refresh_expires_in
      ? new Date(Date.now() + tokens.refresh_expires_in * 1000)
      : null;
    const now = new Date();

    const accountId = generateTikTokOAuthAccountId(tenantId);
    const account = await prisma.tiktok_oauth_accounts_list.upsert({
      where: {
        tenant_id_tiktok_account_id: {
          tenant_id: tenantId,
          tiktok_account_id: sellerInfo.open_id || tokens.open_id,
        },
      },
      create: {
        id: accountId,
        tenant_id: tenantId,
        tiktok_account_id: sellerInfo.open_id || tokens.open_id,
        email: sellerInfo.email || null,
        display_name: sellerInfo.name || null,
        profile_picture_url: sellerInfo.avatar_url || null,
        shop_id: sellerInfo.shop_id || null,
        shop_name: sellerInfo.shop_name || null,
        scopes: [],
        updated_at: now,
      },
      update: {
        email: sellerInfo.email || null,
        display_name: sellerInfo.name || null,
        profile_picture_url: sellerInfo.avatar_url || null,
        shop_id: sellerInfo.shop_id || null,
        shop_name: sellerInfo.shop_name || null,
        updated_at: now,
      },
    });

    const tokenId = generateTikTokOAuthTokenId(tenantId);
    await prisma.tiktok_oauth_tokens_list.upsert({
      where: { account_id: account.id },
      create: {
        id: tokenId,
        account_id: account.id,
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        scopes: [],
        updated_at: now,
      },
      update: {
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        expires_at: expiresAt,
        refresh_expires_at: refreshExpiresAt,
        updated_at: now,
      },
    });

    logger.info('TikTok OAuth: successfully stored tokens', undefined, { tenantId, email: sellerInfo.email });

    res.redirect(`${WEB_URL}/t/${tenantId}/settings/integrations/tiktok?success=connected`);
  } catch (error) {
    logger.error('TikTok OAuth callback error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.redirect(`${WEB_URL}/settings/integrations/tiktok?error=callback_failed`);
  }
});

/**
 * Disconnect TikTok Shop
 */
router.post('/tiktok/oauth/disconnect', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required',
      });
    }

    await prisma.tiktok_oauth_accounts_list.deleteMany({
      where: { tenant_id: tenantId },
    });

    logger.info('TikTok OAuth: disconnected tenant', undefined, { tenantId });

    res.json({
      success: true,
      message: 'Successfully disconnected from TikTok Shop',
    });
  } catch (error) {
    logger.error('TikTok OAuth disconnect error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'disconnect_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Trigger manual catalog sync
 */
router.post('/tiktok/catalog/sync', async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId is required',
      });
    }

    const account = await prisma.tiktok_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: { tiktok_oauth_tokens_list: true },
    });

    if (!account?.tiktok_oauth_tokens_list) {
      return res.status(400).json({
        success: false,
        error: 'not_connected',
        message: 'Not connected to TikTok Shop. Please connect first.',
      });
    }

    if (!account.shop_id) {
      return res.status(400).json({
        success: false,
        error: 'no_shop',
        message: 'No TikTok shop linked. Please connect your shop first.',
      });
    }

    logger.info('TikTok: starting manual catalog sync', undefined, { tenantId });

    fullCatalogSync(tenantId)
      .then(result => {
        logger.info('TikTok catalog sync complete', undefined, { tenantId, synced: result.synced, total: result.total });
      })
      .catch(err => {
        logger.error('TikTok catalog sync failed', undefined, { tenantId, error: err instanceof Error ? err.message : String(err) });
      });

    res.json({
      success: true,
      message: 'Catalog sync started. Check sync status for results.',
    });
  } catch (error) {
    logger.error('TikTok sync trigger error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'sync_trigger_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get catalog sync status
 */
router.get('/tiktok/catalog/sync-status', async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'missing_tenantId',
        message: 'tenantId query parameter is required',
      });
    }

    const { getTikTokFeedStats } = await import('../lib/tiktok/feed-generator');
    const stats = await getTikTokFeedStats(tenantId);

    const account = await prisma.tiktok_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      select: { shop_id: true, shop_name: true, updated_at: true },
    });

    res.json({
      success: true,
      data: {
        ...stats,
        shopId: account?.shop_id || null,
        shopName: account?.shop_name || null,
        lastSyncAt: account?.updated_at || null,
      },
    });
  } catch (error) {
    logger.error('TikTok sync status error', undefined, { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({
      success: false,
      error: 'sync_status_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
