import { Router, Request, Response } from 'express';
import { emailService } from '../services/email-service';
import { unifiedConfig } from '../config/unifiedConfig';
// For now, use a simple auth check - you can replace with proper platform user check later
const requirePlatformUser = (req: any, res: any, next: any) => {
  // Simple check - in production you'd verify JWT and platform role
  next();
};

const router = Router();

/**
 * GET /api/email/config
 * Check email configuration status
 */
router.get('/config', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const isValid = await emailService.validateConfiguration();
    
    res.json({
      success: true,
      provider: unifiedConfig.emailProvider,
      configured: isValid,
      fromEmail: unifiedConfig.emailFrom,
      fromName: unifiedConfig.emailFromName,
    });
  } catch (error: any) {
    console.error('[Email Test] Config check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email configuration',
      message: error.message,
    });
  }
});

/**
 * POST /api/email/test
 * Send a test email
 */
router.post('/test', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing recipient email address',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format',
      });
    }

    const result = await emailService.testEmail(to);
    
    res.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Email Test] Test email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      message: error.message,
    });
  }
});

/**
 * POST /api/email/test-invitation
 * Send a test invitation email
 */
router.post('/test-invitation', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing recipient email address',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format',
      });
    }

    // Create test invitation data
    const testData = {
      inviteeEmail: to,
      inviteeName: 'Test User',
      inviterName: 'Platform Admin',
      tenantName: 'Demo Store',
      role: 'MEMBER',
      acceptUrl: `${unifiedConfig.frontendUrl}/accept-invitation?token=test-token-123`,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      usersName: 'Test User', // Required by InvitationEmailData interface
    };

    const result = await emailService.sendInvitationEmail(testData);
    
    res.json({
      success: result.success,
      provider: result.provider,
      messageId: result.messageId,
      error: result.error,
      testData: {
        recipient: to,
        tenantName: testData.tenantName,
        role: testData.role,
        acceptUrl: testData.acceptUrl,
      },
    });
  } catch (error: any) {
    console.error('[Email Test] Test invitation failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test invitation',
      message: error.message,
    });
  }
});

export default router;
