// v3.5 Policy Versioning API (RVP-API-2402)
import { Hono } from 'hono';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';

const policy = new Hono();

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
policy.get('/admin/policy-history', requireAdmin, async (c) => {
  const { scope } = c.req.query();
  
  const history = await prisma.skuBillingPolicyHistory.findMany({
    where: scope ? { scope } : undefined,
    orderBy: { effectiveFrom: 'desc' },
    take: 100,
  });

  return c.json(history);
});

// GET /admin/policy-history/:id - Get single policy version
policy.get('/admin/policy-history/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  
  const version = await prisma.skuBillingPolicyHistory.findUnique({
    where: { id },
  });

  if (!version) {
    return c.json({ error: 'Policy version not found' }, 404);
  }

  return c.json(version);
});

// POST /admin/policy-history - Create new policy version
policy.post('/admin/policy-history', requireAdmin, async (c) => {
  const body = policySchema.parse(await c.req.json());
  const user = c.get('user'); // From auth middleware
  
  // Check for overlaps (basic check, DB has exclusion constraint as backup)
  const effectiveFrom = body.effectiveFrom ? new Date(body.effectiveFrom) : new Date();
  
  const overlapping = await prisma.skuBillingPolicyHistory.findFirst({
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
    return c.json({ error: 'Overlapping policy period detected' }, 400);
  }

  // Create new version
  const version = await prisma.skuBillingPolicyHistory.create({
    data: {
      scope: body.scope,
      effectiveFrom,
      countActivePrivate: body.countActivePrivate,
      countPreorder: body.countPreorder,
      countZeroPrice: body.countZeroPrice,
      requireImage: body.requireImage,
      requireCurrency: body.requireCurrency,
      notes: body.notes,
      updatedBy: user.id,
    },
  });

  return c.json(version, 201);
});

// PATCH /admin/policy-history/:id - Update policy version
policy.patch('/admin/policy-history/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  
  const version = await prisma.skuBillingPolicyHistory.update({
    where: { id },
    data: {
      effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
      notes: body.notes,
    },
  });

  return c.json(version);
});

// DELETE /admin/policy-history/:id - Delete policy version
policy.delete('/admin/policy-history/:id', requireAdmin, async (c) => {
  const { id } = c.req.param();
  
  await prisma.skuBillingPolicyHistory.delete({
    where: { id },
  });

  return c.json({ success: true });
});

// GET /admin/policy/effective - Get current effective policy
policy.get('/admin/policy/effective', requireAdmin, async (c) => {
  const { scope = 'global' } = c.req.query();
  
  // Query the v_effective_sku_billing_policy view
  const result = await prisma.$queryRaw`
    SELECT * FROM v_effective_sku_billing_policy
    WHERE scope = ${scope}
    LIMIT 1
  `;

  return c.json(result[0] || null);
});

// GET /admin/exports/policy-snapshot.json - Export policy snapshot
policy.get('/admin/exports/policy-snapshot.json', requireAdmin, async (c) => {
  const history = await prisma.skuBillingPolicyHistory.findMany({
    orderBy: { effectiveFrom: 'desc' },
  });

  const snapshot = {
    exportedAt: new Date().toISOString(),
    versions: history,
  };

  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', `attachment; filename="policy-snapshot-${Date.now()}.json"`);
  return c.json(snapshot);
});

export default policy;
