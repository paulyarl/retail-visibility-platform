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
import { UserRole } from '@prisma/client';
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
    let users;

    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      // Platform admins see all users
      users = await prisma.users.findMany({
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          role: true,
          created_at: true,
          last_login: true,
          user_tenants: {
            select: {
              tenant_id: true,
              role: true,
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
          user_tenants: {
            where: {
              tenant_id: {
                in: tenantIds,
              },
            },
            select: {
              tenant_id: true,
              role: true,
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

    // Format response
    const formattedUsers = users.map(user => ({
      ...user,
      name: user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name || user.last_name || null,
      firstName: user.first_name,
      lastName: user.last_name,
      lastLoginAt: user.last_login,
      createdAt: user.created_at,
      tenants: user.user_tenants?.length || 0,
      tenantRoles: user.user_tenants?.map((ut: any) => ({
        tenantId: ut.tenant_id,
        role: ut.role,
      })) || [],
    }));

    res.json({ success: true, users: formattedUsers });
  } catch (error: any) {
    console.error('[Admin Users] Error listing users:', error);
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

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        firstName,
        lastName,
        role: role as UserRole,
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
      user,
      message: 'User created successfully',
    });
  } catch (error: any) {
    console.error('[Admin Users] Error creating user:', error);
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
      data: { passwordHash: hashedPassword },
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
    console.error('[Admin Users] Error deleting user:', error);
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
          users: {
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
    console.error('[Admin Users] Error listing tenants:', error);
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
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: 'USER', // Default platform role
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
          userId: newUser.id,
          tenantId: tenantId,
          role: role,
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
      user: {
        id: result.id,
        email: result.email,
        name: result.firstName && result.lastName ? `${result.firstName} ${result.lastName}` : result.firstName || result.lastName || result.email,
        role: result.role,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error creating user:', error);
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
        userId: user.id,
        tenantId: tenantId,
        role: role,
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
      user: {
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
        inviter: {
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
        inviterName: invitation.inviter.firstName && invitation.inviter.lastName 
          ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
          : invitation.inviter.email,
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
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        tenant: invitation.tenant,
        inviter: {
          name: invitation.inviter.firstName && invitation.inviter.lastName 
            ? `${invitation.inviter.firstName} ${invitation.inviter.lastName}`
            : invitation.inviter.email,
        },
        // Include acceptance URL for development/testing
        acceptUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error sending invitation:', error);
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
        inviter: {
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
      inviter: {
        name: inv.inviter.firstName && inv.inviter.lastName 
          ? `${inv.inviter.firstName} ${inv.inviter.lastName}`
          : inv.inviter.email,
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
    const invitation = await prisma.invitations.findUnique({
      where: { token },
      include: {
        tenant: {
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
        acceptedAt: invitation.accepted_at,
      });
    }

    res.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        tenant: invitation.tenant,
        inviter: {
          name: invitation.users.first_name && invitation.users.last_name 
            ? `${invitation.users.first_name} ${invitation.users.last_name}`
            : invitation.users.email,
        },
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      },
    });
  } catch (error: any) {
    console.error('[Admin Users] Error getting invitation:', error);
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
    const invitation = await prisma.invitations.findUnique({
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
      const passwordHash = await bcrypt.hash(password, 12);

      user = await prisma.users.create({
        data: {
          email: invitation.email.toLowerCase(),
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role: 'USER', // Default platform role
        },
      });

      userCreated = true;
    }

    // Check if user is already assigned to this tenant
    const existingAssignment = await prisma.userTenant.findUnique({
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
      await tx.userTenant.create({
        data: {
          user_id: user.id,
          tenant_id: invitation.tenant_id,
          role: invitation.role,
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
      message: `Successfully ${userCreated ? 'created account and ' : ''}joined ${invitation.tenant.name}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}`
          : user.email,
      },
      tenant: invitation.tenant,
      role: invitation.role,
      userCreated,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error accepting invitation:', error);
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
    const tenants = tenantIds.length > 0 ? await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    }) : [];

    // Create a map for quick lookup
    const tenantNameMap = new Map(tenants.map(tenant => [tenant.id, tenant.name]));

    // Format response with actual tenant names
    const formattedTenants = tenantAssignments.map(assignment => ({
      tenantId: assignment.tenant_id,
      tenantName: tenantNameMap.get(assignment.tenant_id) || 'Unknown Tenant',
      role: assignment.role,
    }));

    res.json({
      success: true,
      tenants: formattedTenants,
    });
  } catch (error: any) {
    console.error('[Admin Users] Error getting user tenants:', error);
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
    const { tenantId, role } = req.body;

    // Validate input
    const schema = z.object({
      tenantId: z.string().min(1, 'Tenant ID is required'),
      role: z.enum(['OWNER', 'ADMIN', 'SUPPORT', 'MEMBER', 'VIEWER'], {
        errorMap: () => ({ message: 'Invalid role' }),
      }),
    });

    const validation = schema.safeParse({ tenantId, role });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

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
        error: 'User is already assigned to this tenant',
      });
    }

    // Create assignment
    await prisma.user_tenants.create({
      data: {
        id: `ut_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        tenant_id: tenantId,
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
    const { role } = req.body;

    // Validate input
    const schema = z.object({
      role: z.enum(['OWNER', 'ADMIN', 'SUPPORT', 'MEMBER', 'VIEWER'], {
        errorMap: () => ({ message: 'Invalid role' }),
      }),
    });

    const validation = schema.safeParse({ role });
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.error.errors,
      });
    }

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
