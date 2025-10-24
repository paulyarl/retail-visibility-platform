// Organization Management API Routes
import { Router } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();

// GET /organizations - List all organizations
router.get('/', async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                items: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats for each organization
    const orgsWithStats = organizations.map(org => {
      const totalSKUs = org.tenants.reduce((sum, t) => sum + t._count.items, 0);
      return {
        ...org,
        stats: {
          totalLocations: org.tenants.length,
          totalSKUs,
          utilizationPercent: (totalSKUs / org.maxTotalSKUs) * 100,
        },
      };
    });

    res.json(orgsWithStats);
  } catch (error: any) {
    console.error('[Organizations] List error:', error);
    res.status(500).json({ error: 'failed_to_list_organizations' });
  }
});

// GET /organizations/:id - Get single organization
router.get('/:id', async (req, res) => {
  try {
    const organization = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
            metadata: true,
            _count: {
              select: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found' });
    }

    res.json(organization);
  } catch (error: any) {
    console.error('[Organizations] Get error:', error);
    res.status(500).json({ error: 'failed_to_get_organization' });
  }
});

// POST /organizations - Create organization
const createOrgSchema = z.object({
  name: z.string().min(1),
  ownerId: z.string().min(1),
  subscriptionTier: z.string().default('chain_starter'),
  maxLocations: z.number().int().positive().default(5),
  maxTotalSKUs: z.number().int().positive().default(2500),
});

router.post('/', async (req, res) => {
  try {
    const parsed = createOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const organization = await prisma.organization.create({
      data: {
        name: parsed.data.name,
        ownerId: parsed.data.ownerId,
        subscriptionTier: parsed.data.subscriptionTier,
        subscriptionStatus: 'trial',
        maxLocations: parsed.data.maxLocations,
        maxTotalSKUs: parsed.data.maxTotalSKUs,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    res.status(201).json(organization);
  } catch (error: any) {
    console.error('[Organizations] Create error:', error);
    res.status(500).json({ error: 'failed_to_create_organization' });
  }
});

// PUT /organizations/:id - Update organization
const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  maxLocations: z.number().int().positive().optional(),
  maxTotalSKUs: z.number().int().positive().optional(),
  subscriptionTier: z.string().optional(),
  subscriptionStatus: z.string().optional(),
});

router.put('/:id', async (req, res) => {
  try {
    const parsed = updateOrgSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const organization = await prisma.organization.update({
      where: { id: req.params.id },
      data: parsed.data,
    });

    res.json(organization);
  } catch (error: any) {
    console.error('[Organizations] Update error:', error);
    res.status(500).json({ error: 'failed_to_update_organization' });
  }
});

// DELETE /organizations/:id - Delete organization
router.delete('/:id', async (req, res) => {
  try {
    // First, unlink all tenants from this organization
    await prisma.tenant.updateMany({
      where: { organizationId: req.params.id },
      data: { organizationId: null },
    });

    // Then delete the organization
    await prisma.organization.delete({
      where: { id: req.params.id },
    });

    res.status(204).end();
  } catch (error: any) {
    console.error('[Organizations] Delete error:', error);
    res.status(500).json({ error: 'failed_to_delete_organization' });
  }
});

// POST /organizations/:id/tenants - Add tenant to organization
const addTenantSchema = z.object({
  tenantId: z.string().min(1),
});

router.post('/:id/tenants', async (req, res) => {
  try {
    const parsed = addTenantSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const tenant = await prisma.tenant.update({
      where: { id: parsed.data.tenantId },
      data: {
        organization: {
          connect: { id: req.params.id },
        },
      },
    });

    res.json(tenant);
  } catch (error: any) {
    console.error('[Organizations] Add tenant error:', error);
    res.status(500).json({ error: 'failed_to_add_tenant' });
  }
});

// DELETE /organizations/:id/tenants/:tenantId - Remove tenant from organization
router.delete('/:id/tenants/:tenantId', async (req, res) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: req.params.tenantId },
      data: { organizationId: null },
    });

    res.json(tenant);
  } catch (error: any) {
    console.error('[Organizations] Remove tenant error:', error);
    res.status(500).json({ error: 'failed_to_remove_tenant' });
  }
});

export default router;
