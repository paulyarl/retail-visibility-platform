import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { audit } from '../audit';
import { optionalAuth } from '../middleware/auth';
import { USER_ROLES } from '../config/role-groups';
import { generateTenantId, generateUserTenantId } from '../lib/id-generator';
import slugSingletonService from '../services/SlugSingletonService';

const router = Router();

/**
 * POST /api/auth/onboarding
 * Complete user onboarding and update profile
 * Uses optionalAuth to support Auth0 session cookies
 */
router.post('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, businessName, businessType, phone } = req.body;
    
    // Get user from session (set by auth middleware) or try to get from Auth0
    let userId = req.user?.id;
    
    // If no user from JWT, try to get from Auth0 session via auth0_id, email header, or cookie
    if (!userId) {
      // First try by auth0_id (most reliable)
      const auth0Id = req.headers['x-auth0-id'] as string;
      if (auth0Id) {
        const user = await prisma.users.findUnique({
          where: { auth0_id: auth0Id },
          select: { id: true }
        });
        userId = user?.id;
      }
      
      // Then try by email
      if (!userId) {
        const auth0Email = req.headers['x-auth0-email'] as string || req.cookies?.auth0_email as string;
        if (auth0Email) {
          const user = await prisma.users.findUnique({
            where: { email: auth0Email.toLowerCase() },
            select: { id: true }
          });
          userId = user?.id;
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Update user with onboarding data
    const user = await prisma.users.update({
      where: { id: userId },
      data: {
        first_name: firstName,
        last_name: lastName,
        business_name: businessName,
        business_type: businessType,
        phone: phone,
        role: USER_ROLES.OWNER,
        onboarding_completed: true,
        onboarding_step: 'complete',
        onboarding_data: {
          businessName,
          businessType,
          phone,
          completedAt: new Date().toISOString(),
        },
        updated_at: new Date(),
      },
    });

    // Log the onboarding completion
    await audit({
      tenantId: 'system',
      actor: userId,
      action: 'user.onboarding.completed',
      payload: {
        entityType: 'user',
        entityId: userId,
        businessName,
        businessType,
      },
    });

    // Create a default tenant for the user if they don't have one
    const existingTenant = await prisma.user_tenants.findFirst({
      where: { user_id: userId },
    });

    let tenant = null;
    if (!existingTenant && businessName) {
      // Create tenant with the business name
      const tenantId = generateTenantId();
      const tenantSlug = await slugSingletonService.generateSlug(businessName, {}, tenantId);
      tenant = await prisma.tenants.create({
        data: {
          id: tenantId,
          name: businessName,
          slug: tenantSlug,
          subscription_tier: 'discovery',
          subscription_status: 'trial',
        },
      });

      // Link user to tenant
      // const userTenantId = generateUserTenantId(userId, tenantId);

      await prisma.user_tenants.create({
        data: {
          id: generateUserTenantId(userId, tenantId),
          user_id: userId,
          tenant_id: tenantId,
          role: 'OWNER',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await audit({
        tenantId: tenantId,
        actor: userId,
        action: 'tenant.created',
        payload: {
          entityType: 'tenant',
          entityId: tenantId,
          name: businessName,
          source: 'onboarding',
        },
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        businessName: user.business_name,
        businessType: user.business_type,
        phone: user.phone,
        onboardingCompleted: user.onboarding_completed,
      },
      tenant: tenant ? {
        id: tenant.id,
        name: tenant.name,
      } : null,
    });
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete onboarding' 
    });
  }
});

/**
 * GET /api/auth/onboarding
 * Check onboarding status for current user
 * Uses optionalAuth to support Auth0 session cookies
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    let userId = req.user?.id;
    
    // If no user from JWT, try to get from Auth0 session via auth0_id, email header, or cookie
    if (!userId) {
      // First try by auth0_id (most reliable)
      const auth0Id = req.headers['x-auth0-id'] as string;
      if (auth0Id) {
        const user = await prisma.users.findUnique({
          where: { auth0_id: auth0Id },
          select: { id: true }
        });
        userId = user?.id;
      }
      
      // Then try by email
      if (!userId) {
        const auth0Email = req.headers['x-auth0-email'] as string || req.cookies?.auth0_email as string;
        if (auth0Email) {
          const user = await prisma.users.findUnique({
            where: { email: auth0Email.toLowerCase() },
            select: { id: true }
          });
          userId = user?.id;
        }
      }
    }
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        onboarding_completed: true,
        onboarding_step: true,
        onboarding_data: true,
      },
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      onboarding: {
        completed: user.onboarding_completed,
        step: user.onboarding_step,
        data: user.onboarding_data,
      },
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get onboarding status' 
    });
  }
});

export default router;
