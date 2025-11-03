import { Router } from 'express';
import { google } from 'googleapis';

const router = Router();

/**
 * Test endpoint to verify Google Business Profile API access
 * GET /test-gbp
 */
router.get('/test-gbp', async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_BUSINESS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_BUSINESS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI;

    // Check if credentials are configured
    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).json({
        success: false,
        error: 'missing_credentials',
        message: 'Google OAuth credentials not configured',
        details: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasRedirectUri: !!redirectUri,
        }
      });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Generate auth URL to test if credentials are valid
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/business.manage'],
      prompt: 'consent',
    });

    res.json({
      success: true,
      message: 'Google OAuth credentials are configured correctly',
      details: {
        clientId: clientId.substring(0, 20) + '...',
        redirectUri,
        authUrl, // You can visit this URL to test OAuth flow
      },
      nextSteps: [
        'Visit the authUrl to test the OAuth flow',
        'If it redirects to Google login, credentials are valid',
        'After login, you should see consent screen for Business Profile API',
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'test_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
