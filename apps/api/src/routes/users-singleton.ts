/**
 * Users API Routes - UniversalSingleton Implementation
 * Integrates UserService with Express API
 */

import { Router } from 'express';
import UserService from '../services/UserService';

const router = Router();

// Get singleton instance
const userService = UserService.getInstance();

/**
 * Get user statistics
 * GET /api/users-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if user has permission to view user statistics
    const userRole = req.user?.role;
    if (!['admin', 'platform_admin', 'PLATFORM_ADMIN', 'support'].includes(userRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const stats = await userService.getUserStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'User statistics retrieved successfully'
    });
  } catch (error) {
    console.error('User statistics retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user statistics',
      error: (error as Error).message
    });
  }
});

/**
 * Get user by ID
 * GET /api/users-singleton/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to access this user
    const userRole = req.user?.role;
    const isOwner = req.user?.userId === id;
    const isAdmin = ['admin', 'platform_admin', 'PLATFORM_ADMIN', 'support'].includes(userRole || '');
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const user = await userService.getUser(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        user,
        timestamp: new Date().toISOString()
      },
      message: 'User retrieved successfully'
    });
  } catch (error) {
    console.error('User retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user',
      error: (error as Error).message
    });
  }
});

/**
 * Create new user
 * POST /api/users-singleton
 */
router.post('/', async (req, res) => {
  try {
    // Check if user has permission to create users
    const userRole = req.user?.role;
    if (!['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(userRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to create users'
      });
    }
    
    const userData = req.body;
    
    const user = await userService.createUser(userData);
    
    res.status(201).json({
      success: true,
      data: {
        user,
        timestamp: new Date().toISOString()
      },
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('User creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: (error as Error).message
    });
  }
});

/**
 * Update user
 * PUT /api/users-singleton/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to update this user
    const userRole = req.user?.role;
    const isOwner = req.user?.userId === id;
    const isAdmin = ['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(userRole || '');
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to update user'
      });
    }
    
    const updates = req.body;
    
    // Regular users can only update their own limited fields
    if (isOwner && !isAdmin) {
      const allowedUpdates = ['name', 'metadata'];
      const updateKeys = Object.keys(updates);
      const hasInvalidUpdates = updateKeys.some(key => !allowedUpdates.includes(key));
      
      if (hasInvalidUpdates) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: cannot update these fields'
        });
      }
    }
    
    const user = await userService.updateUser(id, updates);
    
    res.json({
      success: true,
      data: {
        user,
        timestamp: new Date().toISOString()
      },
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('User update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: (error as Error).message
    });
  }
});

/**
 * Delete user
 * DELETE /api/users-singleton/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user has permission to delete users
    const userRole = req.user?.role;
    if (!['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(userRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to delete user'
      });
    }
    
    // Prevent self-deletion
    if (req.user?.userId === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    await userService.deleteUser(id);
    
    res.json({
      success: true,
      data: {
        userId: id,
        timestamp: new Date().toISOString()
      },
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('User deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: (error as Error).message
    });
  }
});

/**
 * List users
 * GET /api/users-singleton
 */
router.get('/', async (req, res) => {
  try {
    // Check if user has permission to list users
    const userRole = req.user?.role;
    if (!['admin', 'platform_admin', 'PLATFORM_ADMIN', 'support'].includes(userRole || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions to list users'
      });
    }
    
    const filters = {
      role: req.query.role as 'user' | 'admin' | 'platform_admin' | 'support' | 'tenant_admin' | undefined,
      status: req.query.status as 'pending' | 'active' | 'inactive' | 'suspended' | undefined,
      tenantId: req.query.tenantId as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined
    };
    
    const { users, total } = await userService.listUsers(filters);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          limit: filters.limit || users.length,
          offset: filters.offset || 0,
          total,
          hasMore: (filters.offset || 0) + (filters.limit || users.length) < total
        },
        timestamp: new Date().toISOString()
      },
      message: 'Users retrieved successfully'
    });
  } catch (error) {
    console.error('User listing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list users',
      error: (error as Error).message
    });
  }
});

/**
 * Get user activity
 * GET /api/users-singleton/:id/activity
 */
router.get('/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    
    // Check if user has permission to access this user's activity
    const userRole = req.user?.role;
    const isOwner = req.user?.userId === id;
    const isAdmin = ['admin', 'platform_admin', 'support'].includes(userRole || '');
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const activities = await userService.getUserActivity(id, limit);
    
    res.json({
      success: true,
      data: {
        activities,
        userId: id,
        limit,
        count: activities.length,
        timestamp: new Date().toISOString()
      },
      message: 'User activity retrieved successfully'
    });
  } catch (error) {
    console.error('User activity retrieval failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user activity',
      error: (error as Error).message
    });
  }
});

/**
 * Record user activity
 * POST /api/users-singleton/:id/activity
 */
router.post('/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const activityData = req.body;
    
    // Users can record their own activity, or admins can record any activity
    const userRole = req.user?.role;
    const isOwner = req.user?.userId === id;
    const isAdmin = ['admin', 'platform_admin', 'PLATFORM_ADMIN'].includes(userRole || '');
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions'
      });
    }
    
    const activity = await userService.recordActivity({
      userId: id,
      ...activityData,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      tenantId: req.user?.tenantIds?.[0]
    });
    
    res.status(201).json({
      success: true,
      data: {
        activity,
        timestamp: new Date().toISOString()
      },
      message: 'User activity recorded successfully'
    });
  } catch (error) {
    console.error('User activity recording failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record user activity',
      error: (error as Error).message
    });
  }
});

export default router;
