/**
 * Customer Auth Token Fallback
 * 
 * Alternative authentication using tokens instead of cookies
 * for cross-port localhost development
 */

import { Router, Request, Response } from 'express';
import { CustomerAuthService } from '../services/CustomerAuthService';

const router = Router();
const customerAuthService = CustomerAuthService.getInstance();

// Token storage (in production, use Redis)
const tokenStorage = new Map<string, { customerId: string; expires: Date }>();

// Generate simple token
const generateToken = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Middleware to extract token from header
const getCustomerIdFromToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const tokenData = tokenStorage.get(token);
  
  if (!tokenData || tokenData.expires < new Date()) {
    return null;
  }
  
  return tokenData.customerId;
};

// Middleware to require token authentication
const requireTokenAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerIdFromToken(req);

  if (!customerId) {
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Token authentication required',
    });
  }

  (req as any).customerId = customerId;
  next();
};

/**
 * POST /api/customer-auth-token/login
 * Login with token instead of cookie
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

    const result = await customerAuthService.login({
      email,
      password,
    });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        error: 'login_failed',
        message: result.error,
      });
    }

    // Generate and store token
    const token = generateToken();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    
    tokenStorage.set(token, {
      customerId: result.customer!.id,
      expires,
    });

    console.log('[CustomerAuth Token] Token generated:', { token, customerId: result.customer!.id });

    res.json({
      success: true,
      customer: result.customer,
      token, // Return token to frontend
    });
  } catch (error: any) {
    console.error('[CustomerAuth Token] Login error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
      message: 'Failed to log in',
    });
  }
});

/**
 * GET /api/customer-auth-token/me
 * Get current customer using token
 */
router.get('/me', requireTokenAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    
    const customer = await customerAuthService.getCustomer(customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'customer_not_found',
      });
    }

    res.json({
      success: true,
      customer,
    });
  } catch (error: any) {
    console.error('[CustomerAuth Token] Get customer error:', error);
    res.status(500).json({
      success: false,
      error: 'server_error',
    });
  }
});

export default router;
