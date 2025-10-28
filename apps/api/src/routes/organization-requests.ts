import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// GET /organization-requests - List all requests (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, tenantId, userId, organizationId } = req.query;

    const where: any = {};
    
    if (status) {
      where.status = status as string;
    }
    
    if (tenantId) {
      where.tenantId = tenantId as string;
    }
    
    if (userId) {
      where.requestedBy = userId as string;
    }

    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    const requests = await prisma.organizationRequest.findMany({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(requests);
  } catch (error) {
    console.error('[Organization Requests] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch organization requests' });
  }
});

// GET /organization-requests/:id - Get a specific request
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const organizationRequest = await prisma.organizationRequest.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    if (!organizationRequest) {
      return res.status(404).json({ error: 'Organization request not found' });
    }

    res.json(organizationRequest);
  } catch (error) {
    console.error('[Organization Request] GET error:', error);
    res.status(500).json({ error: 'Failed to fetch organization request' });
  }
});

// POST /organization-requests - Create a new request
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { tenantId, organizationId, requestedBy, requestType, notes, estimatedCost, costCurrency } = req.body;

    if (!tenantId || !organizationId || !requestedBy) {
      return res.status(400).json({
        error: 'Missing required fields: tenantId, organizationId, requestedBy'
      });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.organizationRequest.findFirst({
      where: {
        tenantId,
        organizationId,
        status: 'pending',
      },
    });

    if (existingRequest) {
      return res.status(409).json({
        error: 'A pending request already exists for this tenant and organization'
      });
    }

    const organizationRequest = await prisma.organizationRequest.create({
      data: {
        tenantId,
        organizationId,
        requestedBy,
        requestType: requestType || 'join',
        notes,
        estimatedCost,
        costCurrency: costCurrency || 'USD',
        status: 'pending',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    res.status(201).json(organizationRequest);
  } catch (error) {
    console.error('[Organization Requests] POST error:', error);
    res.status(500).json({ error: 'Failed to create organization request' });
  }
});

// PATCH /organization-requests/:id - Update request (approve/reject/agree to cost)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, processedBy, costAgreed, estimatedCost } = req.body;

    const updateData: any = {};

    if (status) {
      updateData.status = status;
      updateData.processedAt = new Date();
      if (processedBy) {
        updateData.processedBy = processedBy;
      }
    }

    if (adminNotes !== undefined) {
      updateData.adminNotes = adminNotes;
    }

    if (estimatedCost !== undefined) {
      updateData.estimatedCost = estimatedCost;
    }

    if (costAgreed !== undefined) {
      updateData.costAgreed = costAgreed;
      if (costAgreed) {
        updateData.costAgreedAt = new Date();
      }
    }

    const organizationRequest = await prisma.organizationRequest.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
          },
        },
      },
    });

    // If approved and cost agreed, assign tenant to organization
    if (status === 'approved' && organizationRequest.costAgreed) {
      await prisma.tenant.update({
        where: { id: organizationRequest.tenantId },
        data: {
          organizationId: organizationRequest.organizationId,
        },
      });
    }

    res.json(organizationRequest);
  } catch (error) {
    console.error('[Organization Request] PATCH error:', error);
    res.status(500).json({ error: 'Failed to update organization request' });
  }
});

// DELETE /organization-requests/:id - Cancel/delete a request
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.organizationRequest.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Organization Request] DELETE error:', error);
    res.status(500).json({ error: 'Failed to delete organization request' });
  }
});

export default router;
