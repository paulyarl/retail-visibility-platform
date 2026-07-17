import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireOrgAdmin, requireOrgOwner } from '../middleware/permissions';
import { isPlatformAdmin } from '../utils/platform-admin';
import { generateUserOrgId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

const VALID_ORG_ROLES = ['ORG_OWNER', 'ORG_ADMIN', 'ORG_MEMBER', 'ORG_VIEWER'];

// GET /api/organizations/:orgId/users — List org users (requires org admin)
router.get('/:orgId/users', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const { orgId } = req.params;

    const orgUsers = await prisma.user_organizations.findMany({
      where: { organization_id: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            picture: true,
            last_login: true,
            user_tenants: {
              select: {
                tenant_id: true,
                role: true,
                tenants: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const result = orgUsers.map((uo) => ({
      id: uo.id,
      userId: uo.user_id,
      role: uo.role,
      createdAt: uo.created_at,
      updatedAt: uo.updated_at,
      email: uo.user.email,
      firstName: uo.user.first_name,
      lastName: uo.user.last_name,
      picture: uo.user.picture,
      lastLogin: uo.user.last_login,
      tenants: uo.user.user_tenants.map((ut) => ({
        tenantId: ut.tenant_id,
        tenantName: ut.tenants?.name || ut.tenant_id,
        role: ut.role,
      })),
    }));

    res.json({ users: result });
  } catch (error) {
    logger.error('[GET /:orgId/users] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list organization users' });
  }
});

// POST /api/organizations/:orgId/users — Add user to org (requires org admin)
router.post('/:orgId/users', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { email, role = 'ORG_MEMBER' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email_required', message: 'Email is required' });
    }

    if (!VALID_ORG_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role', message: `Role must be one of: ${VALID_ORG_ROLES.join(', ')}` });
    }

    // ORG_ADMIN can add members but not owners
    if (role === 'ORG_OWNER') {
      const requesterUserId = req.user!.userId || req.user!.user_id;
      if (!requesterUserId) {
        return res.status(401).json({ error: 'authentication_required', message: 'User ID is required' });
      }
      const explicitRole = await prisma.user_organizations.findUnique({
        where: { user_id_organization_id: { user_id: requesterUserId, organization_id: orgId } },
        select: { role: true },
      }).catch(() => null);

      if (!isPlatformAdmin(req.user) && explicitRole?.role !== 'ORG_OWNER') {
        return res.status(403).json({ error: 'org_owner_required', message: 'Only organization owners can add ORG_OWNER users' });
      }
    }

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, first_name: true, last_name: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'user_not_found', message: 'User not found. They must create an account first.' });
    }

    const existing = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: user.id, organization_id: orgId } },
    });

    if (existing) {
      return res.status(409).json({ error: 'already_member', message: 'User is already a member of this organization' });
    }

    const userOrg = await prisma.user_organizations.create({
      data: {
        id: generateUserOrgId(orgId),
        user_id: user.id,
        organization_id: orgId,
        role,
      },
    });

    res.status(201).json({
      id: userOrg.id,
      userId: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: userOrg.role,
      createdAt: userOrg.created_at,
    });
  } catch (error) {
    logger.error('[POST /:orgId/users] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to add user to organization' });
  }
});

// PUT /api/organizations/:orgId/users/:userId — Update org role (requires org owner)
router.put('/:orgId/users/:userId', authenticateToken, requireOrgOwner, async (req, res) => {
  try {
    const { orgId, userId } = req.params;
    const { role } = req.body;

    if (!VALID_ORG_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role', message: `Role must be one of: ${VALID_ORG_ROLES.join(', ')}` });
    }

    const existing = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_member', message: 'User is not a member of this organization' });
    }

    // Prevent self-demotion from ORG_OWNER
    const requesterId = req.user!.userId || req.user!.user_id;
    if (userId === requesterId && existing.role === 'ORG_OWNER' && role !== 'ORG_OWNER') {
      return res.status(400).json({ error: 'cannot_demote_self', message: 'You cannot demote yourself from ORG_OWNER' });
    }

    const updated = await prisma.user_organizations.update({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
      data: { role },
    });

    res.json({
      id: updated.id,
      userId: updated.user_id,
      role: updated.role,
      updatedAt: updated.updated_at,
    });
  } catch (error) {
    logger.error('[PUT /:orgId/users/:userId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to update user role' });
  }
});

// DELETE /api/organizations/:orgId/users/:userId — Remove user from org (requires org owner)
router.delete('/:orgId/users/:userId', authenticateToken, requireOrgOwner, async (req, res) => {
  try {
    const { orgId, userId } = req.params;

    const existing = await prisma.user_organizations.findUnique({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_member', message: 'User is not a member of this organization' });
    }

    // Prevent self-removal if ORG_OWNER
    const requesterId = req.user!.userId || req.user!.user_id;
    if (userId === requesterId && existing.role === 'ORG_OWNER') {
      return res.status(400).json({ error: 'cannot_remove_self', message: 'Organization owners cannot remove themselves. Transfer ownership first.' });
    }

    await prisma.user_organizations.delete({
      where: { user_id_organization_id: { user_id: userId, organization_id: orgId } },
    });

    res.json({ message: 'User removed from organization' });
  } catch (error) {
    logger.error('[DELETE /:orgId/users/:userId] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to remove user from organization' });
  }
});

// POST /api/organizations/:orgId/users/invite — Send org invitation email (requires org admin)
router.post('/:orgId/users/invite', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const { orgId } = req.params;
    const { email, role = 'ORG_MEMBER' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email_required', message: 'Email is required' });
    }

    if (!VALID_ORG_ROLES.includes(role)) {
      return res.status(400).json({ error: 'invalid_role', message: `Role must be one of: ${VALID_ORG_ROLES.join(', ')}` });
    }

    const organization = await prisma.organizations_list.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'organization_not_found', message: 'Organization not found' });
    }

    // Check if user already exists and is already a member
    const existingUser = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      const existingMembership = await prisma.user_organizations.findUnique({
        where: { user_id_organization_id: { user_id: existingUser.id, organization_id: orgId } },
      });

      if (existingMembership) {
        return res.status(409).json({ error: 'already_member', message: 'User is already a member of this organization' });
      }
    }

    // TODO: Send invitation email via notification service
    // For now, return success — the email sending will be wired in Phase 8

    res.status(201).json({
      message: 'Invitation queued',
      email,
      role,
      organizationName: organization.name,
    });
  } catch (error) {
    logger.error('[POST /:orgId/users/invite] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to send invitation' });
  }
});

// GET /api/organizations/:orgId/invitations — List pending org invitations (requires org admin)
router.get('/:orgId/invitations', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const { orgId } = req.params;

    // TODO: When invitation table is added, query pending invitations
    // For now, return empty list
    res.json({ invitations: [] });
  } catch (error) {
    logger.error('[GET /:orgId/invitations] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to list invitations' });
  }
});

// DELETE /api/organizations/:orgId/invitations/:id — Cancel org invitation (requires org admin)
router.delete('/:orgId/invitations/:id', authenticateToken, requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // TODO: When invitation table is added, cancel the invitation
    // For now, return success
    res.json({ message: 'Invitation cancelled', id });
  } catch (error) {
    logger.error('[DELETE /:orgId/invitations/:id] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ error: 'internal_error', message: 'Failed to cancel invitation' });
  }
});

export default router;
