import { Router } from 'express';
import { PayPalOAuthService } from '../../services/paypal/PayPalOAuthService';
import { requireAuth } from '../../middleware/auth';

const router = Router();
const paypalOAuth = new PayPalOAuthService();

/**
 * Initiate PayPal OAuth flow
 * GET /api/oauth/paypal/authorize?tenantId=xxx
 */
router.get('/authorize', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    // Check if PayPal OAuth is configured
    if (!paypalOAuth.isConfigured()) {
      return res.status(503).json({ 
        error: 'PayPal OAuth is not configured. Please contact support.' 
      });
    }

    // TODO: Verify user has access to this tenant
    // const hasAccess = await verifyTenantAccess(req.user.id, tenantId);
    // if (!hasAccess) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    const authUrl = paypalOAuth.getAuthorizationUrl(tenantId);
    
    res.json({ authorizationUrl: authUrl });
  } catch (error: any) {
    console.error('[PayPal OAuth] Authorization error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate authorization URL' });
  }
});

/**
 * OAuth callback endpoint
 * GET /api/oauth/paypal/callback?code=xxx&state=xxx
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    const webBaseUrl = process.env.WEB_BASE_URL || 'https://www.visibleshelf.store';

    // Handle OAuth errors from PayPal
    if (error) {
      console.error('[PayPal OAuth] Callback error:', error, error_description);
      const errorMessage = encodeURIComponent(error_description as string || error as string);
      return res.redirect(
        `${webBaseUrl}/settings/payment-gateways?error=paypal_oauth&message=${errorMessage}`
      );
    }

    if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Verify state parameter for CSRF protection
    let tenantId: string;
    try {
      const stateData = paypalOAuth.verifyState(state);
      tenantId = stateData.tenantId;
    } catch (error: any) {
      console.error('[PayPal OAuth] State verification failed:', error);
      return res.redirect(
        `${webBaseUrl}/settings/payment-gateways?error=paypal_oauth&message=Invalid+or+expired+state+parameter`
      );
    }

    // Exchange code for token
    await paypalOAuth.exchangeCodeForToken(code, tenantId);

    // Redirect to success page (use web domain, not API domain)
    res.redirect(`${webBaseUrl}/t/${tenantId}/settings/payment-gateways?connected=paypal&success=true`);
  } catch (error: any) {
    console.error('[PayPal OAuth] Callback error:', error);
    const webBaseUrl = process.env.WEB_BASE_URL || 'https://www.visibleshelf.store';
    const errorMessage = encodeURIComponent(error.message || 'OAuth connection failed');
    res.redirect(`${webBaseUrl}/settings/payment-gateways?error=paypal_oauth&message=${errorMessage}`);
  }
});

/**
 * Get OAuth connection status
 * GET /api/oauth/paypal/status?tenantId=xxx
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
          gateway_type: 'paypal',
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
    console.error('[PayPal OAuth] Status check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check OAuth status' });
  }
});

/**
 * Disconnect PayPal OAuth
 * DELETE /api/oauth/paypal/disconnect
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

    await paypalOAuth.disconnect(tenantId);

    res.json({ success: true, message: 'PayPal OAuth disconnected successfully' });
  } catch (error: any) {
    console.error('[PayPal OAuth] Disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect PayPal OAuth' });
  }
});

/**
 * Manually refresh token (for testing/debugging)
 * POST /api/oauth/paypal/refresh
 */
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    await paypalOAuth.refreshAccessToken(tenantId);

    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error: any) {
    console.error('[PayPal OAuth] Refresh error:', error);
    res.status(500).json({ error: error.message || 'Failed to refresh token' });
  }
});

export default router;
