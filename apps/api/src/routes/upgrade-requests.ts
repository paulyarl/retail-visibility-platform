import { Router } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { authenticateToken, requireTenantOwner } from '../middleware/auth';
import { generateQuickStart } from '../lib/id-generator';

const router = Router();

// Schema for creating upgrade request
const createUpgradeRequestSchema = z.object({
  tenantId: z.string().min(1),
  business_name: z.string().min(1),
  currentTier: z.string().min(1),
  requestedTier: z.string().min(1),
  notes: z.string().optional(),
});

// Schema for updating upgrade request status
const updateUpgradeRequestSchema = z.object({
  status: z.enum(['new', 'pending', 'waiting', 'complete', 'denied']),
  adminNotes: z.string().optional(),
  processedBy: z.string().optional(),
});

// GET /upgrade-requests - List all upgrade requests with filters
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = '1', limit = '20', tenantId } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (status && status !== 'all') {
      // Support multiple statuses separated by comma (e.g., "new,pending")
      const statuses = (status as string).split(',').map(s => s.trim());
      if (statuses.length > 1) {
        where.status = { in: statuses };
      } else {
        where.status = status;
      }
    }
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    const [requests, total] = await Promise.all([
      prisma.upgrade_requests.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.upgrade_requests.count({ where }),
    ]);

    res.json({
      data: requests,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching upgrade requests:', error);
    res.status(500).json({ error: 'failed_to_fetch_requests' });
  }
});

// GET /upgrade-requests/:id - Get single upgrade request
router.get('/:id', async (req, res) => {
  try {
    const request = await prisma.upgrade_requests.findUnique({
      where: { id: req.params.id },
    });

    if (!request) {
      return res.status(404).json({ error: 'request_not_found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching upgrade request:', error);
    res.status(500).json({ error: 'failed_to_fetch_request' });
  }
});

// POST /upgrade-requests - Create new upgrade request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const parsed = createUpgradeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        details: parsed.error.flatten() 
      });
    }

    const request = await prisma.upgrade_requests.create({
      data: {
        id: generateQuickStart("upgrade"),
        tenant_id: parsed.data.tenantId,
        business_name: parsed.data.business_name,
        current_tier: parsed.data.currentTier,
        requested_tier: parsed.data.requestedTier,
        notes: parsed.data.notes,
        updated_at: new Date(),
      },
    });

    // TODO: Send email notification to admin
    console.log('[Upgrade Request] New request created:', request.id);

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating upgrade request:', error);
    res.status(500).json({ error: 'failed_to_create_request' });
  }
});

// PATCH /upgrade-requests/:id - Update upgrade request status
router.patch('/:id', async (req, res) => {
  try {
    const parsed = updateUpgradeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ 
        error: 'invalid_payload', 
        details: parsed.error.flatten() 
      });
    }

    const updateData: any = {
      status: parsed.data.status,
    };

    if (parsed.data.adminNotes !== undefined) {
      updateData.admin_notes = parsed.data.adminNotes;
    }

    if (parsed.data.processedBy) {
      updateData.processed_by = parsed.data.processedBy;
      updateData.processed_at = new Date();
    }

    const request = await prisma.upgrade_requests.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // If status is 'complete', update the tenant's subscription tier
    if (parsed.data.status === 'complete') {
      try {
        await prisma.tenants.update({
          where: { id: request.tenant_id },
          data: { 
            subscription_tier: request.requested_tier,
            subscription_status: 'active',
          },
        });
        console.log(`[Upgrade Request] Updated tenant ${request.tenant_id} to tier ${request.requested_tier}`);
      } catch (tenantError) {
        console.error('[Upgrade Request] Failed to update tenant tier:', tenantError);
        // Don't fail the request update, but log the error
      }
    }

    res.json(request);
  } catch (error) {
    console.error('Error updating upgrade request:', error);
    res.status(500).json({ error: 'failed_to_update_request' });
  }
});

// DELETE /upgrade-requests/:id - Delete upgrade request
router.delete('/:id', async (req, res) => {
  try {
    await prisma.upgrade_requests.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting upgrade request:', error);
    res.status(500).json({ error: 'failed_to_delete_request' });
  }
});

export default router;