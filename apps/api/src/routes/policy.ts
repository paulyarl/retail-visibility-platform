// v3.5 Policy Versioning API - Express version
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireAdmin } from '../middleware/auth';
import { getComplianceReport } from '../middleware/policy-enforcement';

const router = Router();

// Policy schema
const policySchema = z.object({
  scope: z.string().default('global'),
  countActivePrivate: z.boolean(),
  countPreorder: z.boolean(),
  countZeroPrice: z.boolean(),
  requireImage: z.boolean(),
  requireCurrency: z.boolean(),
  notes: z.string().optional(),
  effectiveFrom: z.string().datetime().optional(),
});

// GET /admin/policy-history - List policy versions
router.get('/admin/policy-history', requireAdmin, async (req, res) => {
  try {
    const { scope } = req.query;
    
    const history = await prisma.sku_billing_policy_history.findMany({
      where: scope ? { scope: scope as string } : undefined,
      orderBy: { effectiveFrom: 'desc' },
      take: 100,
    });

    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_fetch_history' });
  }
});

// GET /admin/policy-history/:id - Get single policy version
router.get('/admin/policy-history/:id', requireAdmin, async (req, res) => {
  try {
    const version = await prisma.sku_billing_policy_history.findUnique({
      where: { id: req.params.id },
    });

    if (!version) {
      return res.status(404).json({ error: 'policy_version_not_found' });
    }

    res.json(version);
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_fetch_version' });
  }
});

// POST /admin/policy-history - Create new policy version
router.post('/admin/policy-history', requireAdmin, async (req, res) => {
  try {
    const body = policySchema.parse(req.body);
    const user = req.user!;
    
    const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
    
    // Check for overlaps
    const overlapping = await prisma.sku_billing_policy_history.findFirst({
      where: {
        scope: body.scope,
        effectiveFrom: { lte: effectiveFrom },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gt: effectiveFrom } },
        ],
      },
    });

    if (overlapping) {
      return res.status(400).json({ error: 'overlapping_policy_period' });
    }

    // Create new version
    const version = await prisma.sku_billing_policy_history.create({
      data: {
        scope: body.scope,
        effectiveFrom,
        countActivePrivate: body.countActivePrivate,
        countPreorder: body.countPreorder,
        countZeroPrice: body.countZeroPrice,
        requireImage: body.requireImage,
        requireCurrency: body.requireCurrency,
        notes: body.notes,
        updatedBy: (user as any).id,
      },
    });

    res.status(201).json(version);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'invalid_payload', details: error.flatten() });
    }
    res.status(500).json({ error: 'failed_to_create_version' });
  }
});

// PATCH /admin/policy-history/:id - Update policy version
router.patch('/admin/policy-history/:id', requireAdmin, async (req, res) => {
  try {
    const { effectiveTo, notes } = req.body;
    
    const version = await prisma.sku_billing_policy_history.update({
      where: { id: req.params.id },
      data: {
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
        notes: notes,
      },
    });

    res.json(version);
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_update_version' });
  }
});

// DELETE /admin/policy-history/:id - Delete policy version
router.delete('/admin/policy-history/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.sku_billing_policy_history.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_delete_version' });
  }
});

// GET /admin/policy/effective - Get current effective policy
router.get('/admin/policy/effective', requireAdmin, async (req, res) => {
  try {
    const { scope = 'global' } = req.query;

    // For global scope, get the global policy from sku_billing_policy table
    if (scope === 'global') {
      const result = await prisma.$queryRaw<any[]>`
        SELECT
          scope,
          count_active_private,
          count_preorder,
          count_zero_price,
          require_image,
          require_currency,
          updated_at
        FROM sku_billing_policy
        WHERE scope = 'global'
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      return res.json(result[0] || null);
    }

    // For tenant-specific scope, get from the view
    const result = await prisma.$queryRaw<any[]>`
      SELECT
        tenantId as scope,
        count_active_private,
        count_preorder,
        count_zero_price,
        require_image,
        require_currency,
        updated_at
      FROM v_effective_sku_billing_policy
      WHERE tenantId = ${scope}
      LIMIT 1
    `;

    res.json(result[0] || null);
  } catch (error: any) {
    res.status(500).json({ error: 'failed_to_fetch_effective_policy' });
  }
});

// GET /admin/exports/policy-snapshot.json - Export policy snapshot
router.get('/admin/exports/policy-snapshot.json', requireAdmin, async (req, res) => {
  try {
    const history = await prisma.sku_billing_policy_history.findMany({
      orderBy: { effectiveFrom: 'desc' },
    });

    const snapshot = {
      exportedAt: new Date().toISOString(),
      versions: history,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="policy-snapshot-${Date.now()}.json"`);
    res.json(snapshot);
  } catch (error: any) {
    res.status(500).json({ error: 'export_failed' });
  }
});

// GET /admin/policy/compliance - Get compliance report for tenant
router.get('/admin/policy/compliance', requireAdmin, async (req, res) => {
  try {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId_required' });
    }

    const report = await getComplianceReport(tenantId as string);
    res.json(report);
  } catch (error: any) {
    console.error('[Compliance Report] Error:', error);
    res.status(500).json({ error: 'failed_to_generate_report' });
  }
});

export default router;
