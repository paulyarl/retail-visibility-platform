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

const router = Router();

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response
    const formattedUsers = users.map(user => ({
      ...user,
      name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || null,
      lastLoginAt: user.lastLogin,
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
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

router.post('/users', async (req: Request, res: Response) => {
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

router.put('/users/:userId/password', async (req: Request, res: Response) => {
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
router.delete('/users/:userId', async (req: Request, res: Response) => {
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

export default router;
