import { Router } from 'express';
import { google } from 'googleapis';
import { prisma } from '../prisma';

const router = Router();

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
        error: 'missing_tenant_id',
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
    let tenant_id: string;
    try {
      const stateData = JSON.parse(state as string);
      tenantId = stateData.tenant_id;
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
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        googleBusinessAccessToken: tokens.access_token,
        googleBusinessRefreshToken: tokens.refresh_token,
        googleBusinessTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      }
    });

    console.log(`[Google Business OAuth] Successfully connected tenant ${tenantId}`);

    // Redirect back to frontend with success
    res.redirect(`${process.env.WEB_URL}/t/${tenantId}/settings?success=business_connected`);
  } catch (error) {
    console.error('[Google Business OAuth] Error in callback:', error);
    res.redirect(`${process.env.WEB_URL}/settings?error=oauth_failed`);
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
        error: 'missing_tenant_id',
        message: 'tenantId is required'
      });
    }

    // Remove tokens from database
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        googleBusinessAccessToken: null,
        googleBusinessRefreshToken: null,
        googleBusinessTokenExpiry: null,
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

export default router;
