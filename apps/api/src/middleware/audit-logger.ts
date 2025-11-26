// Audit logging middleware for Express
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { randomUUID } from 'crypto';
import { generateQuickStart } from '../lib/id-generator';

/**
 * Middleware to log all write operations to audit_log table
 */
export async function auditLogger(req: Request, res: Response, next: NextFunction) {
  // Generate request ID if not present
  const requestId = req.headers['x-request-id'] as string || randomUUID();
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
    let entityType: 'inventoryItem' | 'tenant' | 'policy' | 'oauth' | 'other' = 'other';
    let action: 'create' | 'update' | 'delete' | 'sync' | 'policyApply' | 'oauthConnect' | 'oauthRefresh' = 'update';

    if (path.includes('/inventory') || path.includes('/items')) {
      entityType = 'inventoryItem';
      if (req.method === 'POST') action = 'create';
      if (req.method === 'DELETE') action = 'delete';
      if (req.method === 'PUT' || req.method === 'PATCH') action = 'update';
    } else if (path.includes('/tenant')) {
      entityType = 'tenant';
    } else if (path.includes('/policy')) {
      entityType = 'policy';
      action = 'policyApply';
    } else if (path.includes('/google') || path.includes('/oauth')) {
      entityType = 'oauth';
      if (path.includes('/connect')) action = 'oauthConnect';
      if (path.includes('/refresh')) action = 'oauthRefresh';
    }

    // Extract entity ID from path
    const idMatch = path.match(/\/([a-zA-Z0-9_-]+)(?:\/|$)/);
    const entityId = idMatch ? idMatch[1] : 'unknown';

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        id: generateQuickStart("al"),
        tenantId: (user as any)?.tenantId || 'system',
        actorId: (user as any)?.id || 'anonymous',
        actorType: user ? 'user' : 'system',
        entityType: entityType,
        entityId: entityId,
        action,
        requestId: requestId,
        ip: req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown',
        userAgent: (req.headers['user-agent'] as string) || null,
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
