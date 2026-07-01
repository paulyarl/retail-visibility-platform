import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';

export interface OrgUser {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  lastLogin?: string;
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    role: string;
  }>;
}

export interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export class OrganizationUsersService extends AuthenticatedApiSingleton {
  private static instance: OrganizationUsersService;

  private constructor() {
    super('OrganizationUsersService');
  }

  static getInstance(): OrganizationUsersService {
    if (!OrganizationUsersService.instance) {
      OrganizationUsersService.instance = new OrganizationUsersService();
    }
    return OrganizationUsersService.instance;
  }

  async getUsers(orgId: string): Promise<OrgUser[]> {
    if (!orgId) throw new Error('Organization ID is required');

    const result = await this.makeDefaultRequest<{ users: OrgUser[] }>(
      `/api/organizations/${orgId}/users`,
      {},
      `org-users-${orgId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to get users:', result.error);
      return [];
    }

    return result.data?.users || [];
  }

  async addUser(orgId: string, data: { email: string; role: string }): Promise<OrgUser | null> {
    if (!orgId) throw new Error('Organization ID is required');

    const result = await this.makeDefaultRequest<OrgUser>(
      `/api/organizations/${orgId}/users`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      `org-add-user-${orgId}`
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to add user:', result.error);
      throw result.error;
    }

    await this.invalidateCache(`org-users-${orgId}*`);
    return result.data || null;
  }

  async updateUserRole(orgId: string, userId: string, role: string): Promise<OrgUser | null> {
    if (!orgId || !userId) throw new Error('Organization ID and User ID are required');

    const result = await this.makeDefaultRequest<OrgUser>(
      `/api/organizations/${orgId}/users/${userId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ role }),
      },
      `org-update-role-${orgId}-${userId}`
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to update role:', result.error);
      throw result.error;
    }

    await this.invalidateCache(`org-users-${orgId}*`);
    return result.data || null;
  }

  async removeUser(orgId: string, userId: string): Promise<void> {
    if (!orgId || !userId) throw new Error('Organization ID and User ID are required');

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${orgId}/users/${userId}`,
      { method: 'DELETE' },
      `org-remove-user-${orgId}-${userId}`
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to remove user:', result.error);
      throw result.error;
    }

    await this.invalidateCache(`org-users-${orgId}*`);
  }

  async inviteUser(orgId: string, data: { email: string; role: string }): Promise<any> {
    if (!orgId) throw new Error('Organization ID is required');

    const result = await this.makeDefaultRequest<any>(
      `/api/organizations/${orgId}/users/invite`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
      `org-invite-user-${orgId}`
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to invite user:', result.error);
      throw result.error;
    }

    return result.data;
  }

  async getPendingInvitations(orgId: string): Promise<OrgInvitation[]> {
    if (!orgId) throw new Error('Organization ID is required');

    const result = await this.makeDefaultRequest<{ invitations: OrgInvitation[] }>(
      `/api/organizations/${orgId}/invitations`,
      {},
      `org-invitations-${orgId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to get invitations:', result.error);
      return [];
    }

    return result.data?.invitations || [];
  }

  async cancelInvitation(orgId: string, invitationId: string): Promise<void> {
    if (!orgId || !invitationId) throw new Error('Organization ID and Invitation ID are required');

    const result = await this.makeDefaultRequest<void>(
      `/api/organizations/${orgId}/invitations/${invitationId}`,
      { method: 'DELETE' },
      `org-cancel-invite-${orgId}-${invitationId}`
    );

    if (!result.success) {
      console.error('[OrganizationUsersService] Failed to cancel invitation:', result.error);
      throw result.error;
    }

    await this.invalidateCache(`org-invitations-${orgId}*`);
  }
}

export const organizationUsersService = OrganizationUsersService.getInstance();
