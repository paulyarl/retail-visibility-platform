/**
 * AdminUserService
 *
 * Business logic for admin user management.
 * Encapsulates all Prisma queries so route files contain zero direct database access.
 *
 * Per docs/API_ROUTE_ARCHITECTURE_SPRINT_PLAN.md Sprint 4.2/4.3 and
 * .agents/skills/backend-dev-guidelines (§3 Controllers Coordinate, Services Decide).
 */

import { prisma } from '../../prisma';

interface RequestingUser {
  userId: string;
  role: string;
  email?: string;
}

interface FormattedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  role: string;
  created_at: Date;
  last_login: Date | null;
  last_login_at: Date | null;
  lastActive: Date | null;
  is_active: boolean;
  email_verified: boolean;
  status: string;
  tenantCount: number;
  tenant: number;
  tenantRoles: Array<{ tenantId: string; tenantName: string; role: string }>;
  isPending?: boolean;
  invitationId?: string;
  expiresAt?: Date;
}

class AdminUserService {
  /**
   * List users based on requesting user's permissions.
   * - Platform admins see all users
   * - Tenant owners see only users in their tenants
   * - Other roles get null (insufficient permissions)
   *
   * Also fetches pending invitations for the same scope and merges them.
   */
  async listUsers(requestingUser: RequestingUser): Promise<FormattedUser[] | null> {
    let users: any[];

    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
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
              tenants: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else if (requestingUser.role === 'OWNER') {
      const ownerTenants = await prisma.user_tenants.findMany({
        where: { user_id: requestingUser.userId, role: 'OWNER' },
        select: { tenant_id: true },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);

      users = await prisma.users.findMany({
        where: {
          user_tenants: {
            some: {
              tenant_id: { in: tenantIds },
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
            where: { tenant_id: { in: tenantIds } },
            select: {
              tenant_id: true,
              role: true,
              tenants: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      });
    } else {
      return null;
    }

    // Fetch pending invitations for the same scope
    let invitations: any[] = [];
    if (requestingUser.role === 'PLATFORM_ADMIN' || requestingUser.role === 'ADMIN') {
      invitations = await prisma.invitations.findMany({
        where: {
          accepted_at: null,
          expires_at: { gt: new Date() },
        },
        include: {
          tenants: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    } else if (requestingUser.role === 'OWNER') {
      const ownerTenants = await prisma.user_tenants.findMany({
        where: { user_id: requestingUser.userId, role: 'OWNER' },
        select: { tenant_id: true },
      });

      const tenantIds = ownerTenants.map(ut => ut.tenant_id);

      invitations = await prisma.invitations.findMany({
        where: {
          tenant_id: { in: tenantIds },
          accepted_at: null,
          expires_at: { gt: new Date() },
        },
        include: {
          tenants: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
    }

    // Format real users
    const formattedUsers: FormattedUser[] = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      name:
        user.first_name && user.last_name
          ? `${user.first_name} ${user.last_name}`
          : user.first_name || user.last_name || null,
      role: user.role,
      created_at: user.created_at,
      last_login: user.last_login,
      last_login_at: user.last_login,
      lastActive: user.last_login,
      is_active: user.is_active,
      email_verified: user.email_verified,
      status: user.is_active ? 'active' : 'inactive',
      tenantCount: user.user_tenants?.length || 0,
      tenant: user.user_tenants?.length || 0,
      tenantRoles:
        user.user_tenants?.map((ut: any) => ({
          tenantId: ut.tenant_id,
          tenantName: ut.tenants?.name || 'Unknown Tenant',
          role: ut.role,
        })) || [],
    }));

    // Format pending invitations
    const pendingUsers: FormattedUser[] = invitations.map((inv: any) => ({
      id: `pending-${inv.id}`,
      email: inv.email,
      first_name: null,
      last_name: null,
      name: null,
      role: inv.role,
      created_at: inv.created_at,
      last_login: null,
      last_login_at: null,
      lastActive: null,
      is_active: false,
      email_verified: false,
      status: 'pending',
      tenantCount: 1,
      tenant: 1,
      tenantRoles: [
        {
          tenantId: inv.tenant_id,
          tenantName: inv.tenants?.name || 'Unknown Tenant',
          role: inv.role,
        },
      ],
      isPending: true,
      invitationId: inv.id,
      expiresAt: inv.expires_at,
    }));

    return [...formattedUsers, ...pendingUsers];
  }
}

export const adminUserService = new AdminUserService();
