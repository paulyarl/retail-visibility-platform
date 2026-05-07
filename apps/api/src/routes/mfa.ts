/**
 * MFA (Multi-Factor Authentication) Routes - Phase 3
 * API endpoints for MFA setup, verification, and management
 */

import { Router } from 'express';
import { mfaService } from '../services/mfa';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// All MFA routes require authentication
router.use(authenticateToken);

/**
 * GET /mfa/status
 * Get current MFA status for the authenticated user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    const status = await mfaService.getMFAStatus(userId);

    res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    logger.error('MFA status check failed', undefined, { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get MFA status'
    });
  }
});

/**
 * POST /mfa/setup
 * Initiate MFA setup - generates secret and QR code
 */
router.post('/setup', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    const setupData = await mfaService.setupMFA(userId);

    // Generate QR code as data URL
    const qrCodeDataURL = await mfaService.generateQRCode(setupData.qrCodeUrl);

    res.json({
      success: true,
      data: {
        secret: setupData.secret,
        qrCode: qrCodeDataURL,
        backupCodes: setupData.backupCodes,
        message: 'Scan the QR code with your authenticator app and enter the 6-digit code to complete setup'
      }
    });

  } catch (error: any) {
    logger.error('MFA setup failed', undefined, { error: error.message });

    if (error.message.includes('already enabled')) {
      return res.status(400).json({
        success: false,
        message: 'MFA is already enabled for this account'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to setup MFA'
    });
  }
});

/**
 * POST /mfa/verify
 * Verify MFA setup with initial TOTP code
 */
router.post('/verify', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { token } = req.body;

    if (!token || typeof token !== 'string' || token.length !== 6) {
      return res.status(400).json({
        success: false,
        message: 'Valid 6-digit token is required'
      });
    }

    const verified = await mfaService.verifyMFASetup(userId, token);

    if (verified) {
      res.json({
        success: true,
        message: 'MFA setup completed successfully. Your account is now protected with two-factor authentication.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

  } catch (error: any) {
    logger.error('MFA verification failed', undefined, { error: error.message });

    if (error.message.includes('not initiated') || error.message.includes('already enabled')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to verify MFA setup'
    });
  }
});

/**
 * POST /mfa/verify-login
 * Verify MFA token during login process
 */
router.post('/verify-login', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'MFA token is required'
      });
    }

    const result = await mfaService.verifyMFAToken(userId, token);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(401).json({
        success: false,
        message: result.message,
        requiresSetup: result.requiresSetup
      });
    }

  } catch (error) {
    logger.error('MFA login verification failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'MFA verification failed'
    });
  }
});

/**
 * POST /mfa/disable
 * Disable MFA for the authenticated user
 */
router.post('/disable', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    await mfaService.disableMFA(userId);

    res.json({
      success: true,
      message: 'MFA has been disabled for your account'
    });

  } catch (error) {
    logger.error('MFA disable failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to disable MFA'
    });
  }
});

/**
 * POST /mfa/regenerate-backup
 * Regenerate backup codes (requires MFA verification)
 */
router.post('/regenerate-backup', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Current MFA token is required to regenerate backup codes'
      });
    }

    // Verify the current MFA token first
    const verification = await mfaService.verifyMFAToken(userId, token);

    if (!verification.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid MFA token'
      });
    }

    // Generate new backup codes and update user
    const backupCodes = Array.from({ length: 10 }, () =>
      require('crypto').randomBytes(4).toString('hex').toUpperCase()
    );

    const encryptedBackupCodes = mfaService['encrypt'](JSON.stringify(backupCodes));

    await require('../prisma').prisma.users.update({
      where: { id: userId },
      data: { mfa_backup_codes: encryptedBackupCodes }
    });

    res.json({
      success: true,
      data: { backupCodes },
      message: 'Backup codes regenerated successfully. Save these codes in a secure location.'
    });

  } catch (error) {
    logger.error('Backup code regeneration failed', undefined, { error: error as any });
    res.status(500).json({
      success: false,
      message: 'Failed to regenerate backup codes'
    });
  }
});

export default router;
