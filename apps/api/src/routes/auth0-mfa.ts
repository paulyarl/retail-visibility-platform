/**
 * Auth0 MFA Routes
 * API endpoints for Auth0-based MFA with custom UI
 */

import { Router } from 'express';
import { auth0MFAService } from '../services/auth0-mfa.service';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// All MFA routes require authentication
router.use(authenticateToken);

/**
 * GET /auth0-mfa/status
 * Get current MFA status for the authenticated user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    const status = await auth0MFAService.getMFAStatus(userId);

    res.json({
      success: true,
      data: status
    });

  } catch (error: any) {
    logger.error('Auth0 MFA status check failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get MFA status'
    });
  }
});

/**
 * POST /auth0-mfa/totp/enroll
 * Initiate TOTP enrollment
 */
router.post('/totp/enroll', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    const enrollmentData = await auth0MFAService.initiateTOTPEnrollment(userId);

    res.json({
      success: true,
      data: {
        ...enrollmentData,
        message: 'Scan the QR code with your authenticator app and enter the 6-digit code to complete setup'
      }
    });

  } catch (error: any) {
    logger.error('Auth0 TOTP enrollment failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to setup TOTP'
    });
  }
});

/**
 * POST /auth0-mfa/totp/verify
 * Verify TOTP enrollment
 */
router.post('/totp/verify', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { factorId, code } = req.body;

    if (!factorId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Factor ID and verification code are required'
      });
    }

    const verified = await auth0MFAService.verifyTOTPEnrollment(userId, factorId, code);

    if (verified) {
      res.json({
        success: true,
        message: 'TOTP setup completed successfully. Your account is now protected with two-factor authentication.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

  } catch (error: any) {
    logger.error('Auth0 TOTP verification failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify TOTP setup'
    });
  }
});

/**
 * POST /auth0-mfa/sms/enroll
 * Initiate SMS enrollment
 */
router.post('/sms/enroll', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    const enrollmentData = await auth0MFAService.initiateSMSEnrollment(userId, phoneNumber);

    res.json({
      success: true,
      data: enrollmentData
    });

  } catch (error: any) {
    logger.error('Auth0 SMS enrollment failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to setup SMS'
    });
  }
});

/**
 * POST /auth0-mfa/sms/verify
 * Verify SMS enrollment
 */
router.post('/sms/verify', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { factorId, code } = req.body;

    if (!factorId || !code) {
      return res.status(400).json({
        success: false,
        message: 'Factor ID and verification code are required'
      });
    }

    const verified = await auth0MFAService.verifySMSEnrollment(userId, factorId, code);

    if (verified) {
      res.json({
        success: true,
        message: 'SMS setup completed successfully. Your account is now protected with two-factor authentication.'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please try again.'
      });
    }

  } catch (error: any) {
    logger.error('Auth0 SMS verification failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to verify SMS setup'
    });
  }
});

/**
 * DELETE /auth0-mfa/factor/:factorId
 * Delete an MFA factor
 */
router.delete('/factor/:factorId', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;
    const { factorId } = req.params;

    await auth0MFAService.deleteMFAFactor(userId, factorId);

    res.json({
      success: true,
      message: 'MFA factor removed successfully'
    });

  } catch (error: any) {
    logger.error('Auth0 MFA factor deletion failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to remove MFA factor'
    });
  }
});

/**
 * POST /auth0-mfa/backup-codes/generate
 * Generate new backup codes
 */
router.post('/backup-codes/generate', async (req, res) => {
  try {
    const userId = (req.user?.userId || req.user?.id)!;

    const backupCodes = await auth0MFAService.generateBackupCodes(userId);

    res.json({
      success: true,
      data: { backupCodes },
      message: 'Backup codes generated successfully. Save these codes in a secure location.'
    });

  } catch (error: any) {
    logger.error('Auth0 backup codes generation failed', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate backup codes'
    });
  }
});

/**
 * GET /auth0-mfa/factors/available
 * Get available MFA factors for enrollment
 */
router.get('/factors/available', async (req, res) => {
  try {
    const factors = await auth0MFAService.getAvailableFactors();

    res.json({
      success: true,
      data: { factors }
    });

  } catch (error: any) {
    logger.error('Failed to get available factors', { 
      region: process.env.AWS_REGION || 'unknown'
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get available MFA factors'
    });
  }
});

export default router;
