/**
 * Ticker Messages API Routes
 * 
 * Provides endpoints for managing platform-wide ticker messages
 * for administrators
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/ticker-messages - Get all ticker messages
router.get('/', async (req: Request, res: Response) => {
  try {
    const messages = await prisma.ticker_messages.findMany({
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ]
    });

    return res.json({
      success: true,
      data: messages.map((msg: any) => ({
        id: msg.id,
        message: msg.message,
        type: msg.type,
        icon: msg.icon,
        scrolling: msg.is_scrolling,
        dismissible: msg.is_dismissible,
        targetAudience: msg.target_audience,
        targetTiers: msg.target_tiers || [],
        targetTenants: msg.target_tenants || [],
        startDate: msg.start_date,
        endDate: msg.end_date,
        priority: msg.priority,
        isActive: msg.is_active,
        createdBy: msg.created_by,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching ticker messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ticker messages',
      userMessage: 'Unable to load ticker messages'
    });
  }
});

// GET /api/admin/ticker-messages/active - Get active ticker messages
router.get('/active', async (req: Request, res: Response) => {
  try {
    const { tenantId, tier } = req.query;

    const now = new Date();
    const whereClause: any = {
      is_active: true,
      AND: [
        // Date range: (start_date is null OR start_date <= now) AND (end_date is null OR end_date >= now)
        {
          OR: [
            { start_date: null },
            { start_date: { lte: now } }
          ]
        },
        {
          OR: [
            { end_date: null },
            { end_date: { gte: now } }
          ]
        }
      ]
    };

    // Add tenant and tier filtering
    if (tenantId || tier) {
      const orConditions: any[] = [
        { target_audience: 'all' }
      ];

      // Only add tier condition if tier is provided
      if (tier) {
        orConditions.push({ 
          target_audience: 'specific_tiers', 
          target_tiers: { has: tier as string } 
        });
      }

      // Only add tenant condition if tenantId is provided
      if (tenantId) {
        orConditions.push({ 
          target_audience: 'specific_tenants', 
          target_tenants: { has: tenantId as string } 
        });
      }

      whereClause.AND.push({
        OR: orConditions
      });
    }

    const messages = await prisma.ticker_messages.findMany({
      where: whereClause,
      orderBy: [
        { priority: 'desc' },
        { created_at: 'desc' }
      ],
      take: 10 // Limit to prevent excessive data
    });

    return res.json({
      success: true,
      data: messages.map((msg: any) => ({
        id: msg.id,
        message: msg.message,
        type: msg.type,
        icon: msg.icon,
        scrolling: msg.is_scrolling,
        dismissible: msg.is_dismissible,
        targetAudience: msg.target_audience,
        targetTiers: msg.target_tiers || [],
        targetTenants: msg.target_tenants || [],
        startDate: msg.start_date,
        endDate: msg.end_date,
        priority: msg.priority,
        isActive: msg.is_active,
        createdBy: msg.created_by,
        createdAt: msg.created_at,
        updatedAt: msg.updated_at
      }))
    });
  } catch (error) {
    console.error('Error fetching active ticker messages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch active ticker messages',
      userMessage: 'Unable to load active messages'
    });
  }
});

// POST /api/admin/ticker-messages - Create new ticker message
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      message,
      type,
      icon,
      scrolling,
      dismissible,
      targetAudience,
      targetTiers,
      targetTenants,
      startDate,
      endDate,
      priority,
      isActive
    } = req.body;

    // Validate required fields
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        userMessage: 'Message text is required'
      });
    }

    if (!type || !['info', 'warning', 'success', 'error'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message type',
        userMessage: 'Please select a valid message type'
      });
    }

    if (!targetAudience || !['all', 'specific_tiers', 'specific_tenants'].includes(targetAudience)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid target audience',
        userMessage: 'Please select a valid target audience'
      });
    }

    // Validate target-specific requirements
    if (targetAudience === 'specific_tiers' && (!targetTiers || !Array.isArray(targetTiers) || targetTiers.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Target tiers are required when targeting specific tiers',
        userMessage: 'Please select at least one tier'
      });
    }

    if (targetAudience === 'specific_tenants' && (!targetTenants || !Array.isArray(targetTenants) || targetTenants.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Target tenants are required when targeting specific tenants',
        userMessage: 'Please select at least one tenant'
      });
    }

    // Create the message
    const newMessage = await prisma.ticker_messages.create({
      data: {
        message: message.trim(),
        type: type,
        icon: icon || 'info',
        is_scrolling: scrolling || false,
        is_dismissible: dismissible !== false,
        target_audience: targetAudience,
        target_tiers: targetAudience === 'specific_tiers' ? targetTiers : [],
        target_tenants: targetAudience === 'specific_tenants' ? targetTenants : [],
        start_date: startDate ? new Date(startDate) : null,
        end_date: endDate ? new Date(endDate) : null,
        priority: priority || 1,
        is_active: isActive !== false,
        created_by: req.user?.id || 'system'
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        id: newMessage.id,
        message: newMessage.message,
        type: newMessage.type,
        icon: newMessage.icon,
        scrolling: newMessage.is_scrolling,
        dismissible: newMessage.is_dismissible,
        targetAudience: newMessage.target_audience,
        targetTiers: newMessage.target_tiers,
        targetTenants: newMessage.target_tenants,
        startDate: newMessage.start_date,
        endDate: newMessage.end_date,
        priority: newMessage.priority,
        isActive: newMessage.is_active,
        createdBy: newMessage.created_by,
        createdAt: newMessage.created_at,
        updatedAt: newMessage.updated_at
      },
      userMessage: 'Ticker message created successfully'
    });
  } catch (error) {
    console.error('Error creating ticker message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create ticker message',
      userMessage: 'Unable to create ticker message'
    });
  }
});

// PUT /api/admin/ticker-messages/:id - Update ticker message
router.put('/:id', async (req: Request, res: Response) => {
  console.log('[ADMIN TICKER MESSAGES PUT] Request received for ID:', req.params.id);
  console.log('[ADMIN TICKER MESSAGES PUT] Update data:', req.body);

  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message ID',
        userMessage: 'Message ID is required'
      });
    }

    // Check if message exists
    const existingMessage = await prisma.ticker_messages.findUnique({
      where: { id }
    });

    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        userMessage: 'Ticker message not found'
      });
    }

    // Validate and prepare update data
    const validFields = ['message', 'type', 'icon', 'scrolling', 'dismissible', 'targetAudience', 'targetTiers', 'targetTenants', 'startDate', 'endDate', 'priority', 'isActive'];
    const filteredData: any = {};

    for (const field of validFields) {
      if (updateData[field] !== undefined) {
        switch (field) {
          case 'message':
            if (typeof updateData[field] !== 'string' || updateData[field].trim().length === 0) {
              return res.status(400).json({
                success: false,
                error: 'Message is required',
                userMessage: 'Message text is required'
              });
            }
            filteredData.message = updateData[field].trim();
            break;
          case 'type':
            if (!['info', 'warning', 'success', 'error'].includes(updateData[field])) {
              return res.status(400).json({
                success: false,
                error: 'Invalid message type',
                userMessage: 'Please select a valid message type'
              });
            }
            filteredData.type = updateData[field];
            break;
          case 'icon':
            filteredData.icon = updateData[field] || 'info';
            break;
          case 'scrolling':
            filteredData.is_scrolling = updateData[field];
            break;
          case 'dismissible':
            filteredData.is_dismissible = updateData[field];
            break;
          case 'targetAudience':
            if (!['all', 'specific_tiers', 'specific_tenants'].includes(updateData[field])) {
              return res.status(400).json({
                success: false,
                error: 'Invalid target audience',
                userMessage: 'Please select a valid target audience'
              });
            }
            filteredData.target_audience = updateData[field];
            break;
          case 'targetTiers':
            filteredData.target_tiers = updateData[field] || [];
            break;
          case 'targetTenants':
            filteredData.target_tenants = updateData[field] || [];
            break;
          case 'startDate':
            filteredData.start_date = updateData[field] ? new Date(updateData[field]) : null;
            break;
          case 'endDate':
            filteredData.end_date = updateData[field] ? new Date(updateData[field]) : null;
            break;
          case 'priority':
            filteredData.priority = updateData[field];
            break;
          case 'isActive':
            filteredData.is_active = updateData[field];
            console.log('[ADMIN TICKER MESSAGES PUT] Filtered data:', filteredData);
            break;
        }
      }
    }

    // Update the message
    console.log('[ADMIN TICKER MESSAGES PUT] About to update message in database');
    const updatedMessage = await prisma.ticker_messages.update({
      where: { id },
      data: {
        ...filteredData,
        updated_at: new Date()
      }
    });

    console.log('[ADMIN TICKER MESSAGES PUT] Updated message from database:', updatedMessage);

    return res.json({
      success: true,
      data: {
        id: updatedMessage.id,
        message: updatedMessage.message,
        type: updatedMessage.type,
        icon: updatedMessage.icon,
        scrolling: updatedMessage.is_scrolling,
        dismissible: updatedMessage.is_dismissible,
        targetAudience: updatedMessage.target_audience,
        targetTiers: updatedMessage.target_tiers,
        targetTenants: updatedMessage.target_tenants,
        startDate: updatedMessage.start_date,
        endDate: updatedMessage.end_date,
        priority: updatedMessage.priority,
        isActive: updatedMessage.is_active,
        createdBy: updatedMessage.created_by,
        createdAt: updatedMessage.created_at,
        updatedAt: updatedMessage.updated_at
      },
      userMessage: 'Ticker message updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticker message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update ticker message',
      userMessage: 'Unable to update ticker message'
    });
  }
});

// DELETE /api/admin/ticker-messages/:id - Delete ticker message
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || id === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'Invalid message ID',
        userMessage: 'Message ID is required'
      });
    }

    // Check if message exists
    const existingMessage = await prisma.ticker_messages.findUnique({
      where: { id }
    });

    if (!existingMessage) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
        userMessage: 'Ticker message not found'
      });
    }

    // Delete the message
    await prisma.ticker_messages.delete({
      where: { id }
    });

    return res.json({
      success: true,
      userMessage: 'Ticker message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticker message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete ticker message',
      userMessage: 'Unable to delete ticker message'
    });
  }
});

export default router;
