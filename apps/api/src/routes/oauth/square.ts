import { Router } from 'express';
import { SquareOAuthService } from '../../services/square/SquareOAuthService';
import { requireAuth } from '../../middleware/auth';

const router = Router();
const squareOAuth = new SquareOAuthService();

/**
 * Initiate Square OAuth flow
 * GET /api/oauth/square/authorize?tenantId=xxx
 */
router.get('/authorize', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Check if Square OAuth is configured
    if (!squareOAuth.isConfigured()) {
      return res.status(503).json({ 
        error: 'Square OAuth is not configured. Please contact support.' 
      });
    }

    // TODO: Verify user has access to this tenant
    // const hasAccess = await verifyTenantAccess(req.user.id, tenantId);
    // if (!hasAccess) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    const authUrl = squareOAuth.getAuthorizationUrl(tenantId);
    
    res.json({ authorizationUrl: authUrl });
  } catch (error: any) {
    console.error('[Square OAuth] Authorization error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate authorization URL' });
  }
});

/**
 * OAuth callback endpoint
 * GET /api/oauth/square/callback?code=xxx&state=xxx
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle OAuth errors from Square
    if (error) {
      console.error('[Square OAuth] Callback error:', error, error_description);
      const errorMessage = encodeURIComponent(error_description as string || error as string);
      return res.redirect(
        `/settings/payment-gateways?error=square_oauth&message=${errorMessage}`
      );
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Verify state parameter for CSRF protection
    let tenantId: string;
    try {
      const stateData = squareOAuth.verifyState(state);
      tenantId = stateData.tenantId;
    } catch (error: any) {
      console.error('[Square OAuth] State verification failed:', error);
      return res.redirect(
        `/settings/payment-gateways?error=square_oauth&message=Invalid+or+expired+state+parameter`
      );
    }

    // Exchange code for token
    await squareOAuth.exchangeCodeForToken(code, tenantId);

    // Redirect to success page
    res.redirect(`/t/${tenantId}/settings/payment-gateways?connected=square&success=true`);
  } catch (error: any) {
    console.error('[Square OAuth] Callback error:', error);
    const errorMessage = encodeURIComponent(error.message || 'OAuth connection failed');
    res.redirect(`/settings/payment-gateways?error=square_oauth&message=${errorMessage}`);
  }
});

/**
 * Get OAuth connection status
 * GET /api/oauth/square/status?tenantId=xxx
 */
router.get('/status', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const { prisma } = await import('../../prisma');
    
    const tokenRecord = await prisma.oauth_tokens.findUnique({
      where: {
        tenant_id_gateway_type: {
          tenant_id: tenantId,
          gateway_type: 'square',
        },
      },
      select: {
        expires_at: true,
        merchant_id: true,
        merchant_email: true,
        created_at: true,
        last_refreshed_at: true,
      },
    });

    if (!tokenRecord) {
      return res.json({ connected: false });
    }

    const isExpired = tokenRecord.expires_at.getTime() < Date.now();

    res.json({
      connected: true,
      isExpired,
      expiresAt: tokenRecord.expires_at,
      merchantId: tokenRecord.merchant_id,
      merchantEmail: tokenRecord.merchant_email,
      connectedAt: tokenRecord.created_at,
      lastRefreshed: tokenRecord.last_refreshed_at,
    });
  } catch (error: any) {
    console.error('[Square OAuth] Status check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check OAuth status' });
  }
});

/**
 * Disconnect Square OAuth (with token revocation)
 * DELETE /api/oauth/square/disconnect
 */
router.delete('/disconnect', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // TODO: Verify user has access to this tenant
    // const hasAccess = await verifyTenantAccess(req.user.id, tenantId);
    // if (!hasAccess) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    await squareOAuth.revokeToken(tenantId);

    res.json({ success: true, message: 'Square OAuth disconnected successfully' });
  } catch (error: any) {
    console.error('[Square OAuth] Disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect Square OAuth' });
  }
});

/**
 * Manually refresh token (for testing/debugging)
 * POST /api/oauth/square/refresh
 */
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    await squareOAuth.refreshAccessToken(tenantId);

    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error: any) {
    console.error('[Square OAuth] Refresh error:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

export default router;
