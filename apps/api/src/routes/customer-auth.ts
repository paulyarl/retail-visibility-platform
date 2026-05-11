/**
 * Customer Authentication Routes
 * 
 * Public endpoints for customer account management:
 * - Registration (email/password)
 * - Login (email/password)
 * - OAuth login (Google)
 * - Password reset
 * - Email verification
 * - Logout
 * 
 * Session management uses httpOnly cookies (customer_session_id)
 */

import { Router, Request, Response } from 'express';
import { CustomerAuthService } from '../services/CustomerAuthService';

const router = Router();
const customerAuthService = CustomerAuthService.getInstance();

/**
 * POST /api/customer-auth/register
 * 
 * Register a new customer account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Email and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'invalid_password',
        message: 'Password must be at least 8 characters',
      });
    }

    const result = await customerAuthService.register({
      email,
      password,
      firstName,
      lastName,
      phone,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'registration_failed',
        message: result.error,
      });
    }

    // Set session cookie
    res.cookie('customer_session_id', result.customer!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.status(201).json({
      success: true,
      customer: result.customer,
      isNewCustomer: result.isNewCustomer,
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Register error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to register account',
    });
  }
});

/**
 * POST /api/customer-auth/login
 * 
 * Login with email/password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Email and password are required',
      });
    }

    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    const result = await customerAuthService.login({
      email,
      password,
      deviceInfo,
      ipAddress,
    });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'login_failed',
        message: result.error,
      });
    }

    // Set session cookie
    res.cookie('customer_session_id', result.customer!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      customer: result.customer,
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to log in',
    });
  }
});

/**
 * POST /api/customer-auth/oauth/:provider
 * 
 * OAuth login (Google, Facebook)
 */
router.post('/oauth/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { oauthId, email, firstName, lastName } = req.body;

    if (!oauthId || !email) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'OAuth ID and email are required',
      });
    }

    if (!['google', 'facebook', 'apple'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_provider',
        message: `Unsupported OAuth provider: ${provider}`,
      });
    }

    const deviceInfo = req.headers['user-agent'];
    const ipAddress = req.ip || req.headers['x-forwarded-for'] as string;

    const result = await customerAuthService.oauthLogin(
      provider,
      oauthId,
      email,
      firstName,
      lastName,
      deviceInfo,
      ipAddress
    );

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'oauth_failed',
        message: result.error,
      });
    }

    // Set session cookie
    res.cookie('customer_session_id', result.customer!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      customer: result.customer,
      isNewCustomer: result.isNewCustomer,
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] OAuth error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to authenticate with OAuth',
    });
  }
});

/**
 * POST /api/customer-auth/verify-email
 * 
 * Verify email with token
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'missing_token',
        message: 'Verification token is required',
      });
    }

    const result = await customerAuthService.verifyEmail(token);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'verification_failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Verify email error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to verify email',
    });
  }
});

/**
 * POST /api/customer-auth/request-reset
 * 
 * Request password reset
 */
router.post('/request-reset', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'missing_email',
        message: 'Email is required',
      });
    }

    const result = await customerAuthService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email, you will receive a reset link.',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Request reset error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to request password reset',
    });
  }
});

/**
 * POST /api/customer-auth/reset-password
 * 
 * Reset password with token
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Token and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'invalid_password',
        message: 'Password must be at least 8 characters',
      });
    }

    const result = await customerAuthService.resetPassword(token, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'reset_failed',
        message: result.error,
      });
    }

    // Set session cookie
    res.cookie('customer_session_id', result.customer!.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({
      success: true,
      customer: result.customer,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to reset password',
    });
  }
});

/**
 * POST /api/customer-auth/logout
 * 
 * Logout and clear session cookie
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const customerId = req.cookies?.customer_session_id;

    if (customerId) {
      await customerAuthService.logout(customerId);
    }

    // Clear session cookie
    res.clearCookie('customer_session_id', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Logout error:', error);
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

/**
 * GET /api/customer-auth/me
 * 
 * Get current customer profile from session cookie
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const customerId = req.cookies?.customer_session_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authenticated',
      });
    }

    const customer = await customerAuthService.getCustomer(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Customer not found',
      });
    }

    res.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to get customer profile',
    });
  }
});

/**
 * PUT /api/customer-auth/profile
 * 
 * Update customer profile (name, phone)
 */
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const customerId = req.cookies?.customer_session_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authenticated',
      });
    }

    const { firstName, lastName, phone } = req.body;

    const result = await customerAuthService.updateProfile(customerId, {
      firstName,
      lastName,
      phone,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'update_failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      customer: result.customer,
      message: 'Profile updated successfully',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to update profile',
    });
  }
});

/**
 * PUT /api/customer-auth/password
 * 
 * Change customer password
 */
router.put('/password', async (req: Request, res: Response) => {
  try {
    const customerId = req.cookies?.customer_session_id;

    if (!customerId) {
      return res.status(401).json({
        success: false,
        error: 'unauthorized',
        message: 'Not authenticated',
      });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'missing_fields',
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'invalid_password',
        message: 'Password must be at least 8 characters',
      });
    }

    const result = await customerAuthService.changePassword(customerId, currentPassword, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'change_failed',
        message: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('[CustomerAuth API] Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to change password',
    });
  }
});

export default router;
