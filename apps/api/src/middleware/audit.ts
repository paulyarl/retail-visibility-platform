// v3.5 Audit Middleware - Auto-log all write operations
import { Context, Next } from 'hono';
import { prisma } from '../lib/prisma';
import { nanoid } from 'nanoid';

export async function auditMiddleware(c: Context, next: Next) {
  // Generate request ID if not present
  const requestId = c.req.header('x-request-id') || nanoid();
  c.set('requestId', requestId);

  // Skip audit for GET requests
  if (c.req.method === 'GET') {
    return next();
  }

  // Capture request details
  const user = c.get('user');
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  const userAgent = c.req.header('user-agent');

  // Continue with request
  await next();

  // After response, log if it was a write operation
  if (c.req.method !== 'GET' && c.res.status < 400) {
    try {
      const path = new URL(c.req.url).pathname;
      
      // Determine entity type and ID from path
      let entityType: string = 'other';
      let entityId: string = 'unknown';
      let action: string = 'update';

      if (path.includes('/inventory')) {
        entityType = 'inventory_item';
        if (c.req.method === 'POST') action = 'create';
        if (c.req.method === 'DELETE') action = 'delete';
        if (c.req.method === 'PUT' || c.req.method === 'PATCH') action = 'update';
        
        // Extract ID from path if present
        const match = path.match(/\/inventory\/([^\/]+)/);
        if (match) entityId = match[1];
      } else if (path.includes('/policy')) {
        entityType = 'policy';
        action = 'policy_apply';
      } else if (path.includes('/oauth') || path.includes('/google')) {
        entityType = 'oauth';
        if (path.includes('/connect')) action = 'oauth_connect';
        if (path.includes('/refresh')) action = 'oauth_refresh';
      }

      // Create audit log entry
      await prisma.auditLog.create({
        data: {
          actorType: user ? 'user' : 'system',
          actorId: user?.id || 'anonymous',
          tenantId: user?.tenantId || 'system',
          entityType: entityType as any,
          entityId,
          action: action as any,
          requestId,
          ip,
          userAgent,
          diff: {
            method: c.req.method,
            path,
            status: c.res.status,
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        },
      }).catch(err => {
        // Log error but don't fail the request
        console.error('Audit log failed:', err);
      });
    } catch (err) {
      console.error('Audit middleware error:', err);
    }
  }
}

// Helper to create audit log manually (for specific operations)
export async function createAuditLog(data: {
  actorType: 'user' | 'system' | 'integration';
  actorId: string;
  tenantId: string;
  entityType: 'inventory_item' | 'tenant' | 'policy' | 'oauth' | 'other';
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'sync' | 'policy_apply' | 'oauth_connect' | 'oauth_refresh';
  requestId?: string;
  ip?: string;
  userAgent?: string;
  diff: any;
  metadata?: any;
}) {
  return prisma.auditLog.create({
    data: {
      ...data,
      metadata: data.metadata || {},
    },
  });
}
