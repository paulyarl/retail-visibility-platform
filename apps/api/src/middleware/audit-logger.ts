// Audit logging middleware for Express
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { nanoid } from 'nanoid';

/**
 * Middleware to log all write operations to audit_log table
 */
export async function auditLogger(req: Request, res: Response, next: NextFunction) {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || nanoid();
  req.headers['x-request-id'] = requestId;

  // Skip audit for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Capture original json method
  const originalJson = res.json.bind(res);

  // Override json method to log after response
  res.json = function (body: any) {
    // Only log successful write operations
    if (res.statusCode < 400) {
      // Don't await - log asynchronously
      logAudit(req, res, requestId).catch(err => {
        console.error('[Audit] Failed to log:', err.message);
      });
    }
    return originalJson(body);
  };

  next();
}

async function logAudit(req: Request, res: Response, requestId: string) {
  try {
    const path = req.path;
    const user = req.user;

    // Determine entity type and action from path
    let entityType: 'inventory_item' | 'tenant' | 'policy' | 'oauth' | 'other' = 'other';
    let action: 'create' | 'update' | 'delete' | 'sync' | 'policy_apply' | 'oauth_connect' | 'oauth_refresh' = 'update';

    if (path.includes('/inventory') || path.includes('/items')) {
      entityType = 'inventory_item';
      if (req.method === 'POST') action = 'create';
      if (req.method === 'DELETE') action = 'delete';
      if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
    } else if (path.includes('/tenant')) {
      entityType = 'tenant';
    } else if (path.includes('/policy')) {
      entityType = 'policy';
      action = 'policy_apply';
    } else if (path.includes('/google') || path.includes('/oauth')) {
      entityType = 'oauth';
      if (path.includes('/connect')) action = 'oauth_connect';
      if (path.includes('/refresh')) action = 'oauth_refresh';
    }

    // Extract entity ID from path
    const idMatch = path.match(/\/([a-zA-Z0-9_-]+)(?:\/|$)/);
    const entityId = idMatch ? idMatch[1] : 'unknown';

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        actorType: user ? 'user' : 'system',
        actorId: user?.id || 'anonymous',
        tenantId: user?.tenantId || 'system',
        entityType,
        entityId,
        action,
        requestId,
        ip: req.ip || req.headers['x-forwarded-for'] as string || 'unknown',
        userAgent: req.headers['user-agent'] || null,
        diff: {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          body: req.body,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (err: any) {
    // Don't fail the request if audit logging fails
    console.error('[Audit] Error:', err.message);
  }
}
