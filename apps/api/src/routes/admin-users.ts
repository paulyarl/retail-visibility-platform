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
import { UserRole, UserTenantRole } from '@prisma/client';
import { requirePlatformAdmin, requirePlatformUser } from '../middleware/auth';

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
    console.log('[ADMIN USERS] Request received from user:', {
      userId: requestingUser?.userId,
      email: requestingUser?.email,
      role: requestingUser?.role,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer
    });
    let users;

    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all users
      console.log('[ADMIN USERS] Platform admin detected, fetching all users...');
      users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          lastLogin: true,
          userTenants: {
            select: {
              tenantId: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see only users in their tenants (SECURE APPROACH)
      // This prevents exposure of all user emails to tenant owners
      const ownerTenants = await prisma.userTenant.findMany({
        where: {
          userId: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenantId: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenantId);

      users = await prisma.user.findMany({
        where: {
          userTenants: {
            some: {
              tenantId: {
                in: tenantIds,
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          createdAt: true,
          lastLogin: true,
          userTenants: {
            where: {
              tenantId: {
                in: tenantIds,
              },
            },
            select: {
              tenantId: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
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
    
    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || null,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      lastLoginAt: user.lastLogin, // Alias for compatibility
      tenantCount: user.userTenants?.length || 0,
      tenant: user.userTenants?.length || 0, // Alias for compatibility
      tenantRoles: user.userTenants?.map((ut: any) => ({
        tenantId: ut.tenantId,
        role: ut.role,
      })) || [],
    }));

    console.log('[ADMIN USERS] Formatted users for response:', formattedUsers?.length || 0, 'users');
    console.log('[ADMIN USERS] Sample user data:', formattedUsers[0] ? {
      id: formattedUsers[0].id,
      email: formattedUsers[0].email,
      role: formattedUsers[0].role,
      tenantCount: formattedUsers[0].tenant
    } : 'No users found');

    res.json({ 
      success: true, 
      users: formattedUsers,
      user_tenants: formattedUsers, // Keep for backward compatibility
      total: formattedUsers.length 
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
    const existing = await prisma.user.findUnique({
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

    // Parse name into firstName and lastName
    const nameParts = name?.trim().split(' ') || [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ') || null;

    // Create user (snake_case Prisma fields)
    const user = await prisma.user.create({
      data: {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email,
        passwordHash: hashedPassword,
        firstName: firstName,
        lastName: lastName,
        role: role as UserRole,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Audit
    await audit({
      tenantId: 'platform',
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.create',
      payload: { userId: user.id, email: user.email, role: user.role },
    });

    res.status(201).json({
      success: true,
      users: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        createdAt: user.createdAt,
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
 * PUT /api/admin/users/:userId/password
 * Reset user password
 */
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
    const user = await prisma.user.findUnique({
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
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword, updatedAt: new Date() },
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
    const user = await prisma.user.findUnique({
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
    await prisma.user.delete({
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
      tenants = await prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    } else if (requestingUser.role === 'OWNER') {
      // Tenant owners see only their owned tenants
      tenants = await prisma.tenant.findMany({
        where: {
          userTenants: {
            some: {
              userId: requestingUser.userId,
              role: 'OWNER',
            },
          },
        },
        select: {
          id: true,
          name: true,
          createdAt: true,
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
 * POST /api/admin/users/create
 * Create a new user and automatically assign to tenant (for tenant owners)
 */
router.post('/users/create', requirePlatformUser, async (req: Request, res: Response) => {
  try {
    const requestingUser = (req as any).user;
    const { email, password, firstName, lastName, tenantId, role } = req.body;

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
        const ownershipCheck = await prisma.userTenant.findFirst({
          where: {
            userId: requestingUser.userId,
            tenantId: tenantId,
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
    const existingUser = await prisma.user.findUnique({
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
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user and tenant assignment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the user
      const newUser = await tx.user.create({
        data: {
          id: crypto.randomUUID(),
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: 'USER', // Default platform role
          updatedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Automatically assign to the tenant
      await tx.userTenant.create({
        data: {
          id: crypto.randomUUID(),
          userId: newUser.id,
          tenantId: tenantId,
          role: role,
          updatedAt: new Date(),
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
        createdUserId: result.id,
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
        name: result.firstName && result.lastName ? `${result.firstName} ${result.lastName}` : result.firstName || result.lastName || result.email,
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
        const ownershipCheck = await prisma.userTenant.findFirst({
          where: {
            userId: requestingUser.userId,
            tenantId: tenantId,
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
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, firstName: true, lastName: true },
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
    const existingAssignment = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: tenantId,
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
    await prisma.userTenant.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tenantId: tenantId,
        role: role,
        updatedAt: new Date(),
      },
    });

    // Audit log
    await audit({
      action: 'USER_TENANT_ASSIGNED',
      actor: requestingUser.userId,
      tenantId: tenantId,
      payload: {
        assignedUserId: user.id,
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
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || user.email,
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
        const ownershipCheck = await prisma.userTenant.findFirst({
          where: {
            userId: requestingUser.userId,
            tenantId: tenantId,
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
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      const existingAssignment = await prisma.userTenant.findUnique({
        where: {
          userId_tenantId: {
            userId: existingUser.id,
            tenantId: tenantId,
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
    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: tenantId,
        acceptedAt: null,
        expiresAt: {
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

    const invitation = await prisma.invitation.create({
      data: {
        email: email.toLowerCase(),
        token,
        tenantId,
        role,
        invitedBy: requestingUser.userId,
        expiresAt,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
        inviterName: invitation.user.firstName && invitation.user.lastName 
          ? `${invitation.user.firstName} ${invitation.user.lastName}`
          : invitation.user.email,
        tenantName: invitation.tenant.name,
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
      tenantId: tenantId,
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
        expiresAt: invitation.expiresAt,
        tenant: invitation.tenant,
        user: {
          name: invitation.user.firstName && invitation.user.lastName 
            ? `${invitation.user.firstName} ${invitation.user.lastName}`
            : invitation.user.email,
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
      const ownerTenants = await prisma.userTenant.findMany({
        where: {
          userId: requestingUser.userId,
          role: 'OWNER',
        },
        select: {
          tenantId: true,
        },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenantId);
      whereClause = {
        tenantId: {
          in: tenantIds,
        },
      };
    } else {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to view invitations',
      });
    }

    const invitations = await prisma.invitation.findMany({
      where: whereClause,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedInvitations = invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      status: inv.acceptedAt ? 'accepted' : (inv.expiresAt < new Date() ? 'expired' : 'pending'),
      tenant: inv.tenant,
      user: {
        name: inv.user.firstName && inv.user.lastName 
          ? `${inv.user.firstName} ${inv.user.lastName}`
          : inv.user.email,
      },
      createdAt: inv.createdAt,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
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
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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
    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'invitation_expired',
        message: 'This invitation has expired',
        expiredAt: invitation.expiresAt,
      });
    }

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      return res.status(409).json({
        success: false,
        error: 'invitation_already_accepted',
        message: 'This invitation has already been accepted',
        acceptedAt: invitation.acceptedAt,
      });
    }

    res.json({
      success: true,
      invitations: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        tenant: invitation.tenant,
        user: {
          name: invitation.user.firstName && invitation.user.lastName 
            ? `${invitation.user.firstName} ${invitation.user.lastName}`
            : invitation.user.email,
        },
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
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
    const { password, firstName, lastName } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing invitation token',
      });
    }

    // Find invitation by token
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        tenant: {
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
    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({
        success: false,
        error: 'invitation_expired',
        message: 'This invitation has expired',
      });
    }

    // Check if invitation is already accepted
    if (invitation.acceptedAt) {
      return res.status(409).json({
        success: false,
        error: 'invitation_already_accepted',
        message: 'This invitation has already been accepted',
      });
    }

    // Check if user already exists
    let user = await prisma.user.findUnique({
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
      const passwordHash = await bcrypt.hash(password, 12);

      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: invitation.email.toLowerCase(),
          passwordHash: passwordHash,
          firstName: firstName,
          lastName: lastName,
          role: 'USER', // Default platform role
          updatedAt: new Date(),
        },
      });

      userCreated = true;
    }

    // Check if user is already assigned to this tenant
    const existingAssignment = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: invitation.tenantId,
        },
      },
    });

    if (existingAssignment) {
      // Mark invitation as accepted anyway
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
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
      await tx.userTenant.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          tenantId: invitation.tenantId,
          role: invitation.role,
          updatedAt: new Date(),
        },
      });

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
    });

    // Audit log
    await audit({
      action: 'INVITATION_ACCEPTED',
      actor: user.id,
      tenantId: invitation.tenantId,
      payload: {
        invitationId: invitation.id,
        userEmail: user.email,
        role: invitation.role,
        userCreated: userCreated,
        invitedBy: invitation.invitedBy,
      },
    });

    res.json({
      success: true,
      message: `Successfully ${userCreated ? 'created account and ' : ''}joined ${invitation.tenant.name}`,
      users: {
        id: user.id,
        email: user.email,
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`
          : user.email,
      },
      tenant: invitation.tenant,
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
    const user = await prisma.user.findUnique({
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
    const tenantAssignments = await prisma.userTenant.findMany({
      where: { userId: userId },
      select: {
        tenantId: true,
        role: true,
      },
    });

    // Get tenant names for the assignments
    const tenantIds = tenantAssignments.map(assignment => assignment.tenantId);
    const tenants = tenantIds.length > 0 ? await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    }) : [];

    // Create a map for quick lookup
    const tenantNameMap = new Map(tenants.map(tenant => [tenant.id, tenant.name]));

    // Format response with actual tenant names
    const formattedTenants = tenantAssignments.map(assignment => ({
      tenantId: assignment.tenantId,
      tenantName: tenantNameMap.get(assignment.tenantId) || 'Unknown Tenant',
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
 * POST /api/admin/users/:userId/tenants
 * Assign user to a tenant with a role
 */
router.post('/users/:userId/tenants', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { tenantId: tenantIdParam, role: roleParam } = req.body;

    // Validate input
    const schema = z.object({
      tenantId: z.string().min(1, 'Tenant ID is required'),
      role: z.nativeEnum(UserTenantRole),
    });

    const validation = schema.safeParse(req.body as any);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.issues,
      });
    }

    const { tenantId, role } = validation.data;

    // Check if user exists
    const user = await prisma.user.findUnique({
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
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: userId,
          tenantId: tenantId,
        },
      },
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        error: 'User is already assigned to this tenant',
      });
    }

    // Create assignment
    await prisma.userTenant.create({
      data: {
        id: `ut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: userId,
        tenantId: tenantId,
        role,
        updatedAt: new Date(),
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
      role: z.nativeEnum(UserTenantRole),
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
    const assignment = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      include: {
        user: { select: { email: true } },
        tenant: { select: { name: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'User is not assigned to this tenant',
      });
    }

    // Update role
    await prisma.userTenant.update({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      data: { role },
    });

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
        userEmail: assignment.user.email,
        tenantName: assignment.tenant.name,
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
    const assignment = await prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
      include: {
        user: { select: { email: true } },
        tenant: { select: { name: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'User is not assigned to this tenant',
      });
    }

    // Remove assignment
    await prisma.userTenant.delete({
      where: {
        userId_tenantId: {
          userId,
          tenantId,
        },
      },
    });

    // Audit
    await audit({
      tenantId,
      actor: (req as any).user?.userId || 'system',
      action: 'admin.user.tenant.remove',
      payload: { 
        userId, 
        tenantId, 
        role: assignment.role,
        userEmail: assignment.user.email,
        tenantName: assignment.tenant.name,
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
