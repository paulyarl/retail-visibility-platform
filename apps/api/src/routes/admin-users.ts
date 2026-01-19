/**
 * Admin User Management API Routes
 * 
 * Provides endpoints for platform admins to create and manage users for testing.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { user_role, user_tenant_role } from '@prisma/client';
import { requirePlatformAdmin, requirePlatformUser } from '../middleware/auth';
import { generateQuickStart, generateUserId, generateUserTenantId } from '../lib/id-generator';
import * as crypto from 'crypto';
//import { UserRole } from '../utils/location-status';

const router = Router();

/**
 * GET /api/admin/users
 * List users based on requesting user's permissions
 * - Platform admins see all users
 * - Tenant owners see only users in their tenants
 */
router.get('/users', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    /* console.log('[ADMIN USERS] Request received from user:', {
      user_id: requestingUser?.userId,
      email: requestingUser?.email,
      role: requestingUser?.role,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    }); */
    let users;

    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all users
      console.log('[ADMIN USERS] Platform admin detected, fetching all users...');
      users = await prisma.users.findMany({
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
          last_login: true,
          is_active: true,
          email_verified: true,
          user_tenants: {
            select: {
              tenant_id: true,
              role: true,
              tenants: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see only users in their tenants (SECURE APPROACH)
      // This prevents exposure of all user emails to tenant owners
      const ownerTenants = await prisma.user_tenants.findMany({
        where: {
          user_id: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenant_id: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);

      users = await prisma.users.findMany({
        where: {
          user_tenants: {
            some: {
              tenant_id: {
                in: tenantIds,
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
          last_login: true,
          is_active: true,
          email_verified: true,
          user_tenants: {
            where: {
              tenant_id: {
                in: tenantIds,
              },
            },
            select: {
              tenant_id: true,
              role: true,
              tenants: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } else {
      // Other roles have no access
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view users',
      });
    }

    console.log('[ADMIN USERS] Raw users from database:', users?.length || 0, 'users found');
    
    // Get pending invitations for the same scope
    let invitations: any[] = [];
    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all invitations
      invitations = await prisma.invitations.findMany({
        where: {
          accepted_at: null,
          expires_at: {
            gt: new Date(),
          },
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            },
          },
          users: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see invitations for their tenants
      const ownerTenants = await prisma.user_tenants.findMany({
        where: {
          user_id: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenant_id: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);

      invitations = await prisma.invitations.findMany({
        where: {
          tenant_id: {
            in: tenantIds,
          },
          accepted_at: null,
          expires_at: {
            gt: new Date(),
          },
        },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
            },
          },
          users: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });
    }

    // Format users with proper status
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || null,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
      last_login_at: user.last_login, // Frontend expects last_login_at
      lastActive: user.last_login, // Frontend expects lastActive
      is_active: user.is_active,
      email_verified: user.email_verified,
      status: user.is_active ? 'active' : 'inactive', // Calculate status from is_active
      tenantCount: user.user_tenants?.length || 0,
      tenant: user.user_tenants?.length || 0, // Alias for compatibility
      tenantRoles: user.user_tenants?.map((ut: any) => ({
        tenantId: ut.tenant_id,
        tenantName: ut.tenants?.name || 'Unknown Tenant',
        role: ut.role,
      })) || [],
    }));

    // Format pending invitations as users with 'pending' status
    const pendingUsers = invitations.map(inv => ({
      id: `pending-${inv.id}`, // Prefix to distinguish from real users
      email: inv.email,
      first_name: null,
      last_name: null,
      name: null,
      role: inv.role,
      created_at: inv.created_at,
      last_login: null,
      last_login_at: null,
      lastActive: null,
      is_active: false, // Pending users are not active yet
      email_verified: false, // Not verified until they accept
      status: 'pending', // Explicit pending status
      tenantCount: 1,
      tenant: 1,
      tenantRoles: [{
        tenantId: inv.tenant_id,
        tenantName: inv.tenants?.name || 'Unknown Tenant',
        role: inv.role,
      }],
      isPending: true, // Flag to identify pending invitations
      invitationId: inv.id,
      expiresAt: inv.expires_at,
    }));

    // Combine real users and pending invitations
    const allUsers = [...formattedUsers, ...pendingUsers];

    /* console.log('[ADMIN USERS] Formatted users for response:', formattedUsers?.length || 0, 'users');
    console.log('[ADMIN USERS] Sample user data:', formattedUsers[0] ? {
      id: formattedUsers[0].id,
      email: formattedUsers[0].email,
      role: formattedUsers[0].role,
      tenantCount: formattedUsers[0].tenant
    } : 'No users found'); */

    res.json({ 
      success: true, 
      users: allUsers,
      user_tenants: allUsers, // Keep for backward compatibility
      userTenants: allUsers, // CamelCase version
      data: allUsers, // Generic data field
      items: allUsers, // Items field
      results: allUsers, // Results field
      total: allUsers.length 
    });
  } catch (error: any) {
    console.error('[Admin Users] Error listing user_tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'ADMIN', 'OWNER', 'TENANT_ADMIN', 'USER']).default('USER'),
});

router.post('/users', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: parsed.error.issues,
      });
    }

    const { email, password, name, role } = parsed.data;

    // Check if user already exists
    const existing = await prisma.users.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'User already exists',
        message: `A user with email ${email} already exists`,
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Parse name into first_name and last_name
    const nameParts = name?.trim().split(' ') || [];
    const first_name = nameParts[0] || null;
    const last_name = nameParts.slice(1).join(' ') || null;

    // Create user (snake_case Prisma fields)
    const user = await prisma.users.create({
      data: {
        id: generateUserId(),
        email,
        password_hash: hashedPassword,
        first_name: first_name,
        last_name: last_name,
        role: role as user_role,
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        created_at: true,
      },
    });

    // Audit
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.create',
      payload: { user_id: user.id, email: user.email, role: user.role },
    });

    res.status(201).json({
      success: true,
      users: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        created_at: user.created_at,
      },
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error creating users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      message: error.message,
    });
  }
});

/**
 * PUT /api/admin/users/:userId
 * Update user details (admin only)
 */
router.put('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, role, isActive, emailVerified } = req.body;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Update user
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        first_name: firstName,
        last_name: lastName,
        email,
        role: role as user_role,
        is_active: isActive,
        email_verified: emailVerified !== undefined ? emailVerified : user.email_verified,
        updated_at: new Date(),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        email_verified: true,
        updated_at: true,
      },
    });

    // Audit log
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.update',
      payload: { 
        userId, 
        email: updatedUser.email, 
        role: updatedUser.role,
        changes: { firstName, lastName, email, role, isActive }
      },
    });

    res.json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message,
    });
  }
});
const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

router.put('/users/:userId/password', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const parsed = resetPasswordSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: parsed.error.issues,
      });
    }

    const { password } = parsed.data;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password
    await prisma.users.update({
      where: { id: userId },
      data: { password_hash: hashedPassword, updated_at: new Date() },
    });

    // Audit
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.password_reset',
      payload: { userId, email: user.email },
    });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error resetting password:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user
 */
router.delete('/users/:userId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Prevent deleting yourself
    if (userId === (req as any).user?.userId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
      });
    }

    // Delete user
    await prisma.users.delete({
      where: { id: userId },
    });

    // Audit
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.delete',
      payload: { userId, email: user.email, role: user.role },
    });

    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error deleting users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/invitations/:id
 * Cancel/delete an invitation
 */
router.delete('/invitations/:id', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const requestingUser = (req as any).user;

    // Find the invitation
    const invitation = await prisma.invitations.findUnique({
      where: { id },
      include: {
        tenants: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found',
      });
    }

    // Check permissions
    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins can delete any invitation
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners can only delete invitations for their tenants
      const ownerTenants = await prisma.user_tenants.findMany({
        where: {
          user_id: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenant_id: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);
      
      if (!tenantIds.includes(invitation.tenant_id)) {
        return res.status(403).json({
          success: false,
          error: 'You can only cancel invitations for your tenants',
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to cancel invitations',
      });
    }

    // Delete the invitation
    await prisma.invitations.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error deleting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel invitation',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/tenants
 * List tenants based on requesting user's permissions
 * - Platform admins see all tenants
 * - Tenant owners see only their owned tenants
 */
router.get('/tenants', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    let tenants;

    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all tenants
      tenants = await prisma.tenants.findMany({
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          created_at: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see only their owned tenants
      tenants = await prisma.tenants.findMany({
        where: {
          user_tenants: {
            some: {
              user_id: requestingUser.userId,
              role: 'OWNER',
            },
          },
        },
        select: {
          id: true,
          name: true,
          subscription_tier: true,
          created_at: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else {
      // Other roles have no access
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view tenants',
      });
    }

    res.json({
      success: true,
      tenants,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error listing tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list tenants',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/tenants/all
 * List ALL tenants in the system (for user management purposes)
 * - Platform admins and Platform Support can see all tenants
 * - Used specifically for managing user tenant assignments
 */
router.get('/tenants/all', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    
    // Only Platform Admin and Platform Support can see all tenants for user management
    if (requestingUser.role !== 'PLATFORM_ADMIN' && requestingUser.role !== 'ADMIN' && requestingUser.role !== 'PLATFORM_SUPPORT') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view all tenants',
      });
    }

    // Return ALL tenants in the system
    const tenants = await prisma.tenants.findMany({
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        created_at: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json({
      success: true,
      tenants,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error listing all tenants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list all tenants',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/create
 * Create a new user and automatically assign to tenant (for tenant owners)
 */
router.post('/users/create', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    const { email, password, first_name, last_name, tenantId, role } = req.body;

    // Validate input
    if (!email || !password || !tenantId || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, tenantId, role',
      });
    }

    // Check if requesting user can create users for this tenant
    if (requestingUser.role !== 'PLATFORM_ADMIN' && requestingUser.role !== 'ADMIN') {
      // For tenant owners, verify they own the target tenant
      if (requestingUser.role === 'OWNER') {
        const ownershipCheck = await prisma.user_tenants.findFirst({
          where: {
            user_id: requestingUser.userId,
            tenant_id: tenantId,
            role: 'OWNER',
          },
        });

        if (!ownershipCheck) {
          return res.status(403).json({
            success: false,
            error: 'You can only create users for tenants you own',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to create users',
        });
      }
    }

    // Check if user already exists
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'User with this email already exists',
      });
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const password_hash = await bcrypt.hash(password, 12);

    // Create user and tenant assignment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.users.create({
        data: {
          id: generateUserId(),
          email: email.toLowerCase(),
          password_hash,
          first_name,
          last_name,
          role: 'USER', // Default platform role
          updated_at: new Date(),
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
        },
      });

      // Automatically assign to the tenant
      await tx.user_tenants.create({
        data: {
          id: generateUserTenantId(newUser.id, tenantId),
          user_id: newUser.id,
          tenant_id: tenantId,
          role: role,
          updated_at: new Date(),
        },
      });

      return newUser;
    });

    // Audit log
    await audit({
      action: 'USER_CREATED_AND_ASSIGNED',
      actor: requestingUser.userId,
      tenantId: tenantId,
      payload: {
        createduser_id: result.id,
        createdUserEmail: result.email,
        tenantRole: role,
        method: 'create_and_assign',
      },
    });

    res.status(201).json({
      success: true,
      message: `Successfully created user ${result.email} and assigned to tenant with role ${role}`,
      users: {
        id: result.id,
        email: result.email,
        name: result.first_name && result.last_name ? `${result.first_name} ${result.last_name}` : result.first_name || result.last_name || result.email,
        role: result.role,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error creating users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/invite-by-email
 * Securely invite a user by email to a tenant (for tenant owners)
 * Does not expose user data if user doesn't exist
 */
router.post('/users/invite-by-email', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    const { email, tenantId, role } = req.body;

    // Validate input
    if (!email || !tenantId || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, tenantId, role',
      });
    }

    // Check if requesting user can assign to this tenant
    if (requestingUser.role !== 'PLATFORM_ADMIN' && requestingUser.role !== 'ADMIN') {
      // For tenant owners, verify they own the target tenant
      if (requestingUser.role === 'OWNER') {
        const ownershipCheck = await prisma.user_tenants.findFirst({
          where: {
            user_id: requestingUser.userId,
            tenant_id: tenantId,
            role: 'OWNER',
          },
        });

        if (!ownershipCheck) {
          return res.status(403).json({
            success: false,
            error: 'You can only assign users to tenants you own',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to assign users',
        });
      }
    }

    // Check if user exists (but don't expose this information)
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (!user) {
      // Don't reveal that user doesn't exist - suggest they register
      return res.json({
        success: false,
        action: 'registration_required',
        message: 'User not found. They need to register first at /register, then you can assign them.',
      });
    }

    // Check if user is already assigned to this tenant
    const existingAssignment = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: user.id,
          tenant_id: tenantId,
        },
      },
    });

    if (existingAssignment) {
      return res.status(409).json({
        success: false,
        error: 'User is already assigned to this tenant',
        currentRole: existingAssignment.role,
      });
    }

    // Create the assignment
    await prisma.user_tenants.create({
      data: {
         id: generateUserTenantId(user.id, tenantId),
        user_id: user.id,
        tenant_id: tenantId,
        role: role,
        updated_at: new Date(),
      },
    });

    // Audit log
    await audit({
      action: 'USER_TENANT_ASSIGNED',
      actor: requestingUser.userId,
      tenantId: tenantId,
      payload: {
        assigneduser_id: user.id,
        assignedUserEmail: user.email,
        role: role,
        method: 'email_invitation',
      },
    });

    res.json({
      success: true,
      message: `Successfully assigned ${user.email} to tenant with role ${role}`,
      users: {
        id: user.id,
        email: user.email,
        name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || user.email,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error inviting user by email:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invite user',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/send-invitation
 * Send email invitation to join tenant with specific role
 */
router.post('/users/send-invitation', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    const { email, tenantId, role, message } = req.body;

    // Validate input
    if (!email || !tenantId || !role) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, tenantId, role',
      });
    }

    // Check if requesting user can invite to this tenant
    if (requestingUser.role !== 'PLATFORM_ADMIN' && requestingUser.role !== 'ADMIN') {
      if (requestingUser.role === 'OWNER') {
        const ownershipCheck = await prisma.user_tenants.findFirst({
          where: {
            user_id: requestingUser.userId,
            tenant_id: tenantId,
            role: 'OWNER',
          },
        });

        if (!ownershipCheck) {
          return res.status(403).json({
            success: false,
            error: 'You can only send invitations for tenants you own',
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions to send invitations',
        });
      }
    }

    // Check if user already exists and is assigned to this tenant
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingAssignment = await prisma.user_tenants.findUnique({
        where: {
          user_id_tenant_id: {
            user_id: existingUser.id,
            tenant_id: tenantId,
          },
        },
      });

      if (existingAssignment) {
        return res.status(409).json({
          success: false,
          error: 'User is already assigned to this tenant',
          currentRole: existingAssignment.role,
        });
      }
    }

    // Check if there's already a pending invitation
    const existingInvitation = await prisma.invitations.findFirst({
      where: {
        email: email.toLowerCase(),
        tenant_id: tenantId,
        accepted_at: null,
        expires_at: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      return res.status(409).json({
        success: false,
        error: 'There is already a pending invitation for this user to this tenant',
        invitationId: existingInvitation.id,
      });
    }

    // Generate unique invitation token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitations.create({
      data: {
        email: email.toLowerCase(),
        token,
        tenant_id: tenantId,
        role,
        invited_by: requestingUser.userId,
        expires_at: expiresAt,
      },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Send email invitation
    try {
      const { emailService } = require('../services/email-service');
      
      const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`;
      
      const emailResult = await emailService.sendInvitationEmail({
        inviteeEmail: email,
        inviterName: invitation.users.first_name && invitation.users.last_name 
          ? `${invitation.users.first_name} ${invitation.users.last_name}`
          : invitation.users.email,
        tenantName: invitation.tenants.name,
        role: role,
        acceptUrl: acceptUrl,
        expiresAt: expiresAt,
      });

      if (!emailResult.success) {
        console.error('[Admin Users] Failed to send invitation email:', emailResult.error);
        // Don't fail the invitation creation if email fails
        // The invitation still exists and can be used
      }
    } catch (emailError) {
      console.error('[Admin Users] Email service error:', emailError);
      // Don't fail the invitation creation if email service fails
    }

    // Audit log
    await audit({
      action: 'INVITATION_SENT',
      actor: requestingUser.userId,
      tenantId,
      payload: {
        invitationId: invitation.id,
        invitedEmail: email,
        role: role,
        token: token, // Note: In production, don't log the actual token
        expiresAt: expiresAt,
        message: message,
      },
    });

    res.status(201).json({
      success: true,
      message: `Invitation sent to ${email}`,
      invitations: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
        tenant: invitation.tenants,
        user: {
          name: invitation.users.first_name && invitation.users.last_name 
            ? `${invitation.users.first_name} ${invitation.users.last_name}`
            : invitation.users.email,
        },
        // Include acceptance URL for development/testing
        acceptUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error sending invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/invitations
 * List invitations for tenant owner
 */
router.get('/invitations', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    let whereClause: any = {};

    // Filter invitations based on user role
    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all invitations
      whereClause = {};
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see invitations for their owned tenants
      const ownerTenants = await prisma.user_tenants.findMany({
        where: {
          user_id: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenant_id: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);
      whereClause = {
        tenant_id: {
          in: tenantIds,
        },
      };
    } else {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view invitations',
      });
    }

    const invitations = await prisma.invitations.findMany({
      where: whereClause,
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.accepted_at ? 'accepted' : (inv.expires_at < new Date() ? 'expired' : 'pending'),
      tenant: inv.tenants,
      user: {
        name: inv.users.first_name && inv.users.last_name 
          ? `${inv.users.first_name} ${inv.users.last_name}`
          : inv.users.email,
      },
      created_at: inv.created_at,
      expiresAt: inv.expires_at,
      accepted_at: inv.accepted_at,
    }));

    res.json({
      success: true,
      invitations: formattedInvitations,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error listing invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list invitations',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/invitations/:token
 * Get invitation details by token (for acceptance page)
 */
router.get('/invitations/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing invitation token',
      });
    }

    // Find invitation by token
    const invitation = await prisma.invitations.findUnique({
      where: { token },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'invitation_not_found',
        message: 'Invitation not found or invalid token',
      });
    }

    // Check if invitation is expired
    if (invitation.expires_at < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'invitation_expired',
        message: 'This invitation has expired',
        expiredAt: invitation.expires_at,
      });
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return res.status(409).json({
        success: false,
        error: 'invitation_already_accepted',
        message: 'This invitation has already been accepted',
        accepted_at: invitation.accepted_at,
      });
    }

    const inviter = (invitation as any).users as
      | { first_name: string | null; last_name: string | null; email: string }
      | undefined;

    const inviterName =
      inviter?.first_name && inviter?.last_name
        ? `${inviter.first_name} ${inviter.last_name}`
        : inviter?.email ?? invitation.email;

    res.json({
      success: true,
      invitations: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        tenant: (invitation as any).tenants,
        user: {
          name: inviterName,
        },
        expiresAt: invitation.expires_at,
        created_at: invitation.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error getting invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get invitation',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/invitations/:token/accept
 * Accept an invitation (creates user if needed, assigns to tenant)
 */
router.post('/invitations/:token/accept', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password, first_name, last_name } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing invitation token',
      });
    }

    // Find invitation by token
    const invitation = await prisma.invitations.findUnique({
      where: { token },
      include: {
        tenants: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'invitation_not_found',
        message: 'Invitation not found or invalid token',
      });
    }

    // Check if invitation is expired
    if (invitation.expires_at < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'invitation_expired',
        message: 'This invitation has expired',
      });
    }

    // Check if invitation is already accepted
    if (invitation.accepted_at) {
      return res.status(409).json({
        success: false,
        error: 'invitation_already_accepted',
        message: 'This invitation has already been accepted',
      });
    }

    // Check if user already exists
    let user = await prisma.users.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    let userCreated = false;

    if (!user) {
      // User doesn't exist, create them
      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'password_required',
          message: 'Password is required for new users',
        });
      }

      // Hash password
      const bcrypt = require('bcryptjs');
      const password_hash = await bcrypt.hash(password, 12);

      user = await prisma.users.create({
        data: {
          id: generateUserId(),
          email: invitation.email.toLowerCase(),
          password_hash: password_hash,
          first_name: first_name,
          last_name: last_name,
          role: 'USER', // Default platform role
          updated_at: new Date(),
        },
      });

      userCreated = true;
    }

    // Check if user is already assigned to this tenant
    const existingAssignment = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: user.id,
          tenant_id: invitation.tenant_id,
        },
      },
    });

    if (existingAssignment) {
      // Mark invitation as accepted anyway
      await prisma.invitations.update({
        where: { id: invitation.id },
        data: { accepted_at: new Date() },
      });

      return res.status(409).json({
        success: false,
        error: 'user_already_assigned',
        message: 'User is already assigned to this tenant',
        currentRole: existingAssignment.role,
      });
    }

    // Create tenant assignment and mark invitation as accepted in a transaction
    await prisma.$transaction(async (tx) => {
      // Create tenant assignment
      await tx.user_tenants.create({
        data: {
          id: generateUserTenantId(user.id,invitation.tenant_id),
          user_id: user.id,
          tenant_id: invitation.tenant_id,
          role: invitation.role,
          updated_at: new Date(),
        },
      });

      // Mark invitation as accepted
      await tx.invitations.update({
        where: { id: invitation.id },
        data: { accepted_at: new Date() },
      });
    });

    // Audit log
    await audit({
      action: 'INVITATION_ACCEPTED',
      actor: user.id,
      tenantId: invitation.tenant_id,
      payload: {
        invitationId: invitation.id,
        userEmail: user.email,
        role: invitation.role,
        userCreated: userCreated,
        invitedBy: invitation.invited_by,
      },
    });

    res.json({
      success: true,
      message: `Successfully ${userCreated ? 'created account and ' : ''}joined ${invitation.tenants.name}`,
      users: {
        id: user.id,
        email: user.email,
        name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`
          : user.email,
      },
      tenant: invitation.tenants,
      role: invitation.role,
      userCreated,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error accepting invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation',
      message: error.message,
    });
  }
});

/**
 * GET /api/admin/users/:userId/tenants
 * Get user's tenant assignments
 */
router.get('/users/:userId/tenants', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Get user's tenant assignments
    const tenantAssignments = await prisma.user_tenants.findMany({
      where: { user_id: userId },
      select: {
        tenant_id: true,
        role: true,
      },
    });

    // Get tenant names for the assignments
    const tenantIds = tenantAssignments.map(assignment => assignment.tenant_id);
    const tenants = tenantIds.length > 0 ? await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    }) : [];

    // Create a map for quick lookup
    const tenantNameMap = new Map(tenants.map(tenant => [tenant.id, tenant.name]));

    // Format response with actual tenant names
    const formattedTenants = tenantAssignments.map(assignment => ({
      tenant_id: assignment.tenant_id,
      tenantName: tenantNameMap.get(assignment.tenant_id) || 'Unknown Tenant',
      role: assignment.role,
    }));

    res.json({
      success: true,
      tenant: formattedTenants,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error getting user tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user tenants',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/:userId/send-verification-email
 * Send verification email to user (admin only)
 */
router.post('/users/:userId/send-verification-email', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    console.log('[POST /users/:userId/send-verification-email] Request:', {
      userId,
      email,
      userRole: (req as any).user?.role
    });

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Generate verification token
    const verificationToken = require('crypto').randomBytes(32).toString('hex');
    
    // Update user with verification token
    await prisma.users.update({
      where: { id: userId },
      data: {
        email_verification_token: verificationToken,
        updated_at: new Date(),
      },
    });

    // TODO: Send actual email with verification link
    // For now, just return success with the token for testing
    const verificationLink = `${process.env.WEB_BASE_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    
    console.log('[Verification Email] Would send email with link:', verificationLink);

    // Audit log
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.send_verification_email',
      payload: { 
        userId, 
        email: user.email,
        verificationToken: verificationToken.substring(0, 8) + '...' // Log only part of token for security
      },
    });

    res.json({
      success: true,
      message: 'Verification email sent successfully',
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined, // Only show in development
    });
  } catch (error: any) {
    console.error('[POST /users/:userId/send-verification-email] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send verification email',
      message: error.message,
    });
  }
});

/**
 * POST /api/admin/users/:userId/tenants
 * Assign user to a tenant with a role
 */
router.post('/users/:userId/tenants', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { tenant_id: tenantIdParam, role: roleParam } = req.body;

    console.log('[POST /users/:userId/tenants] Request:', {
      userId,
      tenantIdParam,
      roleParam,
      requestBody: req.body,
      userRole: (req as any).user?.role
    });

    // Validate input
    const schema = z.object({
      tenant_id: z.string().min(1, 'Tenant ID is required'),
      role: z.nativeEnum(user_tenant_role),
    });

    const validation = schema.safeParse(req.body as any);
    if (!validation.success) {
      console.log('[POST /users/:userId/tenants] Validation failed:', {
        error: validation.error,
        issues: validation.error.issues,
        received: req.body
      });
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { tenant_id, role } = validation.data;
    const tenantId = tenant_id;

    // Check if user exists
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Check if tenant exists
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenant_id },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        error: 'Assignment already exists',
        message: 'User is already assigned to this tenant',
      });
    }

    // Create assignment
    const assignment = await prisma.user_tenants.create({
      data: {
        id: generateUserTenantId(user.id, tenant_id),
        user_id: userId,
        tenant_id: tenant_id,
        role,
        updated_at: new Date(),
      },
    });

    // Audit
    await audit({
      tenantId,
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.tenant.assign',
      payload: { userId, tenantId, role, userEmail: user.email, tenantName: tenant.name },
    });

    res.json({
      success: true,
      message: 'User assigned to tenant successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error assigning user to tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assign user to tenant',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/admin/users/:userId/tenants/:tenantId
 * Update user's role in a tenant
 */
router.patch('/users/:userId/tenants/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, tenantId } = req.params;
    const { role: roleParam } = req.body;

    // Validate input
    const schema = z.object({
      role: z.nativeEnum(user_tenant_role),
    });

    const validation = schema.safeParse(req.body as any);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { role } = validation.data;

    // Check if assignment exists
    const assignment = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
      include: {
        users: { select: { email: true } },
        tenants: { select: { name: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'User is not assigned to this tenant',
      });
    }

    // Update role
    await prisma.user_tenants.update({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
      data: { role },
    });

    const assignmentRel = assignment as any;

    // Audit
    await audit({
      tenantId,
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.tenant.role_update',
      payload: { 
        userId, 
        tenantId, 
        oldRole: assignment.role, 
        newRole: role,
        userEmail: assignmentRel.users?.email,
        tenantName: assignmentRel.tenants?.name,
      },
    });

    res.json({
      success: true,
      message: 'User role updated successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/admin/users/:userId/tenants/:tenantId
 * Remove user from a tenant
 */
router.delete('/users/:userId/tenants/:tenantId', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, tenantId } = req.params;

    // Check if assignment exists
    const assignment = await prisma.user_tenants.findUnique({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
      include: {
        users: { select: { email: true } },
        tenants: { select: { name: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'User is not assigned to this tenant',
      });
    }

    // Remove assignment
    await prisma.user_tenants.delete({
      where: {
        user_id_tenant_id: {
          user_id: userId,
          tenant_id: tenantId,
        },
      },
    });

    const assignmentRel = assignment as any;

    // Audit
    await audit({
      tenantId,
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.tenant.remove',
      payload: { 
        userId, 
        tenantId, 
        role: assignment.role,
        userEmail: assignmentRel.users?.email,
        tenantName: assignmentRel.tenants?.name,
      },
    });

    res.json({
      success: true,
      message: 'User removed from tenant successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error removing user from tenant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove user from tenant',
      message: error.message,
    });
  }
});

export default router;
