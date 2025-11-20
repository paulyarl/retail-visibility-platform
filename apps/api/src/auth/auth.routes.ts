import { Router, Request, Response } from 'express';
import { authService } from './auth.service';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const user = await authService.register(validatedData);
    
    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input data',
        details: error.issues,
      });
    }
    
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'user_exists',
          message: error.message,
        });
      }
      return res.status(400).json({
        error: 'registration_failed',
        message: error.message,
      });
    }
    
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);
    
    res.json({
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid input data',
        details: error.issues,
      });
    }
    
    if (error instanceof Error) {
      // Database connection errors - critical for login
      if (
        error.name === 'PrismaClientInitializationError' ||
        error.message?.includes("Can't reach database server") ||
        error.message?.includes('Connection refused')
      ) {
        console.error('[Login Critical] Database connection failed:', error.message);
        return res.status(503).json({
          error: 'service_unavailable',
          message: 'Authentication service is temporarily unavailable. Please try again in a moment.',
        });
      }
      
      if (error.message.includes('Invalid email or password') || error.message.includes('deactivated')) {
        return res.status(401).json({
          error: 'authentication_failed',
          message: error.message,
        });
      }
      
      console.error('[Login Error]', error.message);
      return res.status(400).json({
        error: 'login_failed',
        message: error.message,
      });
    }
    
    console.error('[Login Critical] Unexpected error:', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'refresh_token_required',
        message: 'Refresh token is required',
      });
    }
    
    const result = await authService.refreshAccessToken(refreshToken);
    
    res.json({
      message: 'Token refreshed successfully',
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(401).json({
        error: 'invalid_refresh_token',
        message: error.message,
      });
    }
    
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Not authenticated',
      });
    }
    
    // Universal transform middleware converts user_id to userId
    const userId = (req.user as any).userId || req.user.user_id;
    console.log('[Auth Route] Using userId:', userId);
    const user = await authService.getUserById(userId);
    
    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      return res.status(404).json({
        error: 'user_not_found',
        message: error.message,
      });
    }
    
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'authentication_required',
        message: 'Not authenticated',
      });
    }
    
    const result = await authService.logout(req.user.user_id);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'internal_error',
      message: 'An unexpected error occurred',
    });
  }
});

export default router;
