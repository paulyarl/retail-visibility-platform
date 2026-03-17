/**
 * Auth User Sync Endpoint
 * 
 * Syncs Auth0 users to the local database on login
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { user_role } from '@prisma/client';
import { generateUserId } from '../lib/id-generator';
import { audit } from '../audit';

const router = Router();

/**
 * POST /api/auth/sync-user
 * 
 * Syncs an Auth0 user to the local database
 * Called by the web app after successful Auth0 login
 * 
 * Headers:
 *   X-Service-Key: Service authentication key
 * 
 * Body:
 *   auth0Id: string - Auth0 user ID (e.g., "google-oauth2|123456")
 *   email: string - User email
 *   emailVerified: boolean - Whether email is verified
 *   firstName: string | null - User's first name
 *   lastName: string | null - User's last name
 *   name: string | null - User's full name (fallback)
 *   picture: string | null - User's profile picture URL
 */
router.post('/sync-user', async (req: Request, res: Response) => {
  try {
    // Verify service key
    const serviceKey = req.headers['x-service-key'];
    const expectedKey = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    
    if (!serviceKey || serviceKey !== expectedKey) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const { auth0Id, email, emailVerified, firstName, lastName, name, picture } = req.body;

    if (!auth0Id || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: auth0Id, email',
      });
    }

    console.log('[AuthSync] Syncing user:', { auth0Id, email });

    // Check if user exists by email
    let user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Update existing user
      user = await prisma.users.update({
        where: { id: user.id },
        data: {
          email_verified: emailVerified,
          last_login: new Date(),
          updated_at: new Date(),
          // Update name if provided and not already set
          first_name: firstName || user.first_name || (name ? name.split(' ')[0] : user.first_name),
          last_name: lastName || user.last_name || (name ? name.split(' ').slice(1).join(' ') : user.last_name),
        },
      });

      console.log('[AuthSync] Updated existing user:', user.id);
      
      // Audit log
      await audit({
        tenantId: 'platform',
        actor: user.id,
        action: 'auth.login',
        payload: { 
          auth0Id, 
          email, 
          method: auth0Id.includes('google') ? 'google' : 'auth0',
          userId: user.id 
        },
      });

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role,
          email_verified: user.email_verified,
          is_active: user.is_active,
          last_login: user.last_login,
          created_at: user.created_at,
          onboarding_completed: user.onboarding_completed,
          onboarding_step: user.onboarding_step,
        },
        isNewUser: false,
      });
    }

    // Create new user
    const parsedFirstName = firstName || (name ? name.split(' ')[0] : null);
    const parsedLastName = lastName || (name ? name.split(' ').slice(1).join(' ') : null);

    user = await prisma.users.create({
      data: {
        id: generateUserId(),
        email: email.toLowerCase(),
        password_hash: '', // No password for OAuth users - they authenticate via Auth0
        first_name: parsedFirstName,
        last_name: parsedLastName,
        role: user_role.USER,
        email_verified: emailVerified,
        last_login: new Date(),
        is_active: true,
        updated_at: new Date(),
      },
    });

    console.log('[AuthSync] Created new user:', user.id);

    // Audit log
    await audit({
      tenantId: 'platform',
      actor: user.id,
      action: 'auth.register',
      payload: { 
        auth0Id, 
        email, 
        method: auth0Id.includes('google') ? 'google' : 'auth0',
        userId: user.id 
      },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        email_verified: user.email_verified,
        is_active: user.is_active,
        last_login: user.last_login,
        created_at: user.created_at,
        onboarding_completed: user.onboarding_completed,
        onboarding_step: user.onboarding_step,
      },
      isNewUser: true,
    });
  } catch (error: any) {
    console.error('[AuthSync] Error syncing user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync user',
      message: error.message,
    });
  }
});

/**
 * GET /api/auth/lookup
 * 
 * Look up a user by email or Auth0 ID
 */
router.get('/lookup', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.query;

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Missing identifier parameter',
      });
    }

    // Try to find by email
    const user = await prisma.users.findUnique({
      where: { email: identifier.toLowerCase() },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        email_verified: true,
        is_active: true,
        last_login: true,
        created_at: true,
        onboarding_completed: true,
        onboarding_step: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('[AuthSync] Error looking up user:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to lookup user',
    });
  }
});

export default router;
