// Auth middleware for Express
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tenantId: string;
        email: string;
        role: 'ADMIN' | 'STAFF' | 'VIEWER';
      };
    }
  }
}

/**
 * Basic auth middleware - checks for user in request
 * TODO: Implement proper JWT validation
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // For now, accept any request (MVP)
  // In production, validate JWT token from Authorization header
  
  // Mock user for development
  if (!req.user) {
    req.user = {
      id: 'dev-user',
      tenantId: req.query.tenantId as string || 'unknown',
      email: 'dev@example.com',
      role: 'STAFF',
    };
  }

  next();
}

/**
 * Admin-only middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'admin_required' });
    }
    next();
  });
}

/**
 * Extract tenant ID from query or user context
 */
export function getTenantId(req: Request): string | null {
  return (req.query.tenantId as string) || req.user?.tenantId || null;
}
