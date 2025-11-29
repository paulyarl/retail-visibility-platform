// Permission Matrix Management Routes
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { generateQuickStart } from '../lib/id-generator';

const router = Router();

// All routes require platform admin
router.use(authenticateToken, requireAdmin);

/**
 * GET /permissions - Get all permissions in the matrix
 */
router.get('/', async (req, res) => {
  try {
    const permissions = await prisma.permissionMatrix.findMany({
      orderBy: [{ role: 'asc' }, { action: 'asc' }],
    });

    // Group by role for easier frontend consumption
    const grouped = permissions.reduce((acc: Record<string, typeof permissions>, perm) => {
      if (!acc[perm.role]) {
        acc[perm.role] = [];
      }
      acc[perm.role].push(perm);
      return acc;
    }, {} as Record<string, typeof permissions>);

    res.json({
      permissions,
      grouped,
      roles: Object.keys(grouped),
    });
  } catch (error) {
    console.error('[GET /permissions] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_permissions' });
  }
});

/**
 * GET /permissions/:role - Get permissions for a specific role
 */
router.get('/:role', async (req, res) => {
  try {
    const permissions = await prisma.permissionMatrix.findMany({
      where: { role: req.params.role },
      orderBy: { action: 'asc' },
    });

    res.json(permissions);
  } catch (error) {
    console.error('[GET /permissions/:role] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_role_permissions' });
  }
});

/**
 * PUT /permissions/:id - Update a permission
 */
const updatePermissionSchema = z.object({
  allowed: z.boolean(),
  reason: z.string().optional(),
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = updatePermissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    // Get current permission
    const current = await prisma.permissionMatrix.findUnique({
      where: { id: req.params.id },
    });

    if (!current) {
      return res.status(404).json({ error: 'permission_not_found' });
    }

    // Update permission
    const updated = await prisma.permissionMatrix.update({
      where: { id: req.params.id },
      data: { allowed: parsed.data.allowed },
    });

    // Log the change
    await prisma.permissionAuditLog.create({
      data: {
        id: generateQuickStart("audit"),
        tenantId: (req.user as any)?.tenantId || 'system',
        role: current.role,
        action: current.action,
        oldValue: current.allowed,
        newValue: parsed.data.allowed,
        changedBy: req.user!.userId || req.user!.user_id || 'system',
        reason: parsed.data.reason,
      } as any,
    });

    res.json(updated);
  } catch (error) {
    console.error('[PUT /permissions/:id] Error:', error);
    res.status(500).json({ error: 'failed_to_update_permission' });
  }
});

/**
 * POST /permissions/bulk-update - Update multiple permissions at once
 */
const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string(),
      allowed: z.boolean(),
    })
  ),
  reason: z.string().optional(),
});

router.post('/bulk-update', async (req, res) => {
  try {
    const parsed = bulkUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const results = [];
    const auditLogs = [];

    for (const update of parsed.data.updates) {
      // Get current permission
      const current = await prisma.permissionMatrix.findUnique({
        where: { id: update.id },
      });

      if (!current) continue;

      // Update permission
      const updated = await prisma.permissionMatrix.update({
        where: { id: update.id },
        data: { allowed: update.allowed },
      });

      results.push(updated);

      // Prepare audit log
      auditLogs.push({
        id: generateQuickStart("audit"),
        tenantId: (req.user as any)?.tenantId || 'system',
        role: current.role,
        action: current.action,
        oldValue: current.allowed,
        newValue: update.allowed,
        changedBy: req.user!.userId || req.user!.user_id,
        reason: parsed.data.reason,
      });
    }

    // Create audit logs
    await prisma.permissionAuditLog.createMany({
      data: auditLogs as any,
    });

    res.json({
      updated: results.length,
      permissions: results,
    });
  } catch (error) {
    console.error('[POST /permissions/bulk-update] Error:', error);
    res.status(500).json({ error: 'failed_to_bulk_update_permissions' });
  }
});

/**
 * GET /permissions/audit - Get permission change history
 */
router.get('/audit/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const [logs, total] = await Promise.all([
      prisma.permissionAuditLog.findMany({
        take: limit,
        skip: offset,
        orderBy: { changedAt: 'desc' },
      }),
      prisma.permissionAuditLog.count(),
    ]);

    res.json({
      logs,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /permissions/audit/history] Error:', error);
    res.status(500).json({ error: 'failed_to_fetch_audit_logs' });
  }
});

/**
 * POST /permissions/check - Check if a role has a specific permission
 */
const checkPermissionSchema = z.object({
  role: z.string(),
  action: z.string(),
});

router.post('/check', async (req, res) => {
  try {
    const parsed = checkPermissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_payload',
        details: parsed.error.flatten(),
      });
    }

    const permission = await prisma.permissionMatrix.findFirst({
      where: {
        role: parsed.data.role,
        action: parsed.data.action as any,
      },
    });

    res.json({
      allowed: permission?.allowed || false,
      permission,
    });
  } catch (error) {
    console.error('[POST /permissions/check] Error:', error);
    res.status(500).json({ error: 'failed_to_check_permission' });
  }
});

export default router;
