// v3.5 Audit Log API (RVP-API-2401)
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';

const audit = new Hono();

// Query schema
const auditQuerySchema = z.object({
  tenantId: z.string().optional(),
  entityType: z.enum(['inventory_item', 'tenant', 'policy', 'oauth', 'other']).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// GET /admin/audit - List audit logs
audit.get('/admin/audit', requireAdmin, async (c) => {
  const query = auditQuerySchema.parse(c.req.query());
  
  const where: any = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.since || query.until) {
    where.occurredAt = {};
    if (query.since) where.occurredAt.gte = new Date(query.since);
    if (query.until) where.occurredAt.lte = new Date(query.until);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: query.limit + 1,
    skip: query.cursor ? 1 : 0,
    cursor: query.cursor ? { id: query.cursor } : undefined,
  });

  const hasMore = logs.length > query.limit;
  const items = hasMore ? logs.slice(0, -1) : logs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return c.json({
    items,
    nextCursor,
    hasMore,
  });
});

// GET /admin/audit/:id - Get single audit log
audit.get('/admin/audit/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  
  const log = await prisma.auditLog.findUnique({
    where: { id },
  });

  if (!log) {
    return c.json({ error: 'Audit log not found' }, 404);
  }

  return c.json(log);
});

// POST /internal/audit - Create audit log (internal service-to-service)
audit.post('/internal/audit', async (c) => {
  // TODO: Add service token auth
  const body = await c.req.json();
  
  const log = await prisma.auditLog.create({
    data: {
      actorType: body.actorType || 'system',
      actorId: body.actorId,
      tenantId: body.tenantId,
      entityType: body.entityType,
      entityId: body.entityId,
      action: body.action,
      requestId: body.requestId,
      ip: body.ip,
      userAgent: body.userAgent,
      diff: body.diff,
      metadata: body.metadata || {},
    },
  });

  return c.json(log, 201);
});

// GET /admin/exports/audit.csv - Export audit logs as CSV
audit.get('/admin/exports/audit.csv', requireAdmin, async (c) => {
  const query = auditQuerySchema.parse(c.req.query());
  
  const where: any = {};
  if (query.tenantId) where.tenantId = query.tenantId;
  if (query.entityType) where.entityType = query.entityType;
  if (query.since || query.until) {
    where.occurredAt = {};
    if (query.since) where.occurredAt.gte = new Date(query.since);
    if (query.until) where.occurredAt.lte = new Date(query.until);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: 10000, // Max export size
  });

  // Convert to CSV
  const headers = ['id', 'occurredAt', 'actorType', 'actorId', 'tenantId', 'entityType', 'entityId', 'action', 'requestId'];
  const rows = logs.map(log => [
    log.id,
    log.occurredAt.toISOString(),
    log.actorType,
    log.actorId,
    log.tenantId,
    log.entityType,
    log.entityId,
    log.action,
    log.requestId || '',
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

  c.header('Content-Type', 'text/csv');
  c.header('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
  return c.body(csv);
});

export default audit;
