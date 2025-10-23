// v3.5 Audit Log API - Express version
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin } from '../middleware/auth';

const router = Router();

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
router.get('/admin/audit', requireAdmin, async (req, res) => {
  try {
    const query = auditQuerySchema.parse(req.query);
    
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

    res.json({
      items,
      nextCursor,
      hasMore,
    });
  } catch (error: any) {
    res.status(400).json({ error: 'invalid_query', details: error.message });
  }
});

// GET /admin/audit/:id - Get single audit log
router.get('/admin/audit/:id', requireAdmin, async (req, res) => {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id: req.params.id },
    });

    if (!log) {
      return res.status(404).json({ error: 'audit_log_not_found' });
    }

    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_fetch_audit_log' });
  }
});

// GET /admin/exports/audit.csv - Export audit logs as CSV
router.get('/admin/exports/audit.csv', requireAdmin, async (req, res) => {
  try {
    const query = auditQuerySchema.parse(req.query);
    
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

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${Date.now()}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: 'export_failed', details: error.message });
  }
});

export default router;
