/**
 * Admin Invitations Service
 * 
 * Handles admin invitation management operations
 * Extends AdminApiSingleton for proper caching and context management
 * 
 * MIGRATION: Replaces direct fetch calls in:
 * - /src/app/accept-invitation/page.tsx
 * - /src/app/api/admin/invitations/route.ts
 * - /src/app/api/admin/invitations/[token]/route.ts
 * - /src/app/api/admin/invitations/[token]/accept/route.ts
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface Invitation {
  id: string;
  token: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId?: string;
  organizationName?: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  invitedBy: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  organization?: {
    id: string;
    name: string;
  };
}

export interface CreateInvitationRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  organizationId?: string;
  organizationName?: string;
  customMessage?: string;
  expiresAt?: string;
}

export interface InvitationListResponse {
  invitations: Invitation[];
  total: number;
  page: number;
  limit: number;
}

export class AdminInvitationsService extends AdminApiSingleton {
  private static instance: AdminInvitationsService;

  private constructor() {
    super('AdminInvitationsService');
  }

  static getInstance(): AdminInvitationsService {
    if (!AdminInvitationsService.instance) {
      AdminInvitationsService.instance = new AdminInvitationsService();
    }
    return AdminInvitationsService.instance;
  }

  /**
   * PILOT: Declare cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'admin-invitations-*',
      'admin-invitation-*',
      'admin-invitation-stats-*'
    ];
  }

  /**
   * PILOT: Implement cache invalidation contract
   */
  public async invalidateServiceCaches(...params: any[]): Promise<void> {
    // Invalidate all invitation-related caches
    await this.invalidateCache('admin-invitations-*');
    await this.invalidateCache('admin-invitation-*');
    await this.invalidateCache('admin-invitation-stats-*');
  }

  /**
   * Get all invitations (paginated)
   */
  async getInvitations(options?: { page?: number; limit?: number; status?: string }): Promise<InvitationListResponse> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    
    const result = await this.makeDefaultRequest<InvitationListResponse>(
      `/api/admin/invitations${params.toString() ? `?${params.toString()}` : ''}`,
      {},
      'admin-invitations-list'
    );
    
    if (!result.success) {
      console.log(`Failed to get invitations: ${result.error}`);
      return { invitations: [], total: 0, page: 1, limit: 20 };
    }
    
    return result.data || { invitations: [], total: 0, page: 1, limit: 20 };
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<Invitation | null> {
    const result = await this.makeDefaultRequest<Invitation>(
      `/api/admin/invitations/${token}`,
      {},
      `admin-invitation-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to get invitation: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Create new invitation
   */
  async createInvitation(invitation: CreateInvitationRequest): Promise<Invitation | null> {
    const result = await this.makeDefaultRequest<Invitation>(
      '/api/admin/invitations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invitation),
      },
      'admin-invitations-create'
    );
    
    if (!result.success) {
      console.log(`Failed to create invitation: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after creation
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string, acceptData?: { firstName?: string; lastName?: string; password?: string }): Promise<Invitation | null> {
    const result = await this.makeDefaultRequest<Invitation>(
      `/api/admin/invitations/${token}/accept`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(acceptData || {}),
      },
      `admin-invitation-accept-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to accept invitation: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after acceptance
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Revoke invitation
   */
  async revokeInvitation(token: string): Promise<Invitation | null> {
    const result = await this.makeDefaultRequest<Invitation>(
      `/api/admin/invitations/${token}/revoke`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-invitation-revoke-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to revoke invitation: ${result.error}`);
      return null;
    }
    
    // Invalidate cache after revocation
    await this.invalidateServiceCaches();
    
    return result.data || null;
  }

  /**
   * Delete invitation
   */
  async deleteInvitation(token: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/invitations/${token}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-invitation-delete-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to delete invitation: ${result.error}`);
      return false;
    }
    
    // Invalidate cache after deletion
    await this.invalidateServiceCaches();
    
    return result.data?.success || false;
  }

  /**
   * Resend invitation
   */
  async resendInvitation(token: string): Promise<Invitation | null> {
    const result = await this.makeDefaultRequest<Invitation>(
      `/api/admin/invitations/${token}/resend`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      `admin-invitation-resend-${token}`
    );
    
    if (!result.success) {
      console.log(`Failed to resend invitation: ${result.error}`);
      return null;
    }
    
    return result.data || null;
  }

  /**
   * Get invitation statistics
   */
  async getInvitationStats(): Promise<{
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    revoked: number;
  }> {
    const result = await this.makeDefaultRequest<{
      total: number;
      pending: number;
      accepted: number;
      expired: number;
      revoked: number;
    }>(
      '/api/admin/invitations/stats',
      {},
      'admin-invitation-stats'
    );
    
    if (!result.success) {
      console.log(`Failed to get invitation stats: ${result.error}`);
      return { total: 0, pending: 0, accepted: 0, expired: 0, revoked: 0 };
    }
    
    return result.data || { total: 0, pending: 0, accepted: 0, expired: 0, revoked: 0 };
  }
}

// Export singleton instance
export default AdminInvitationsService.getInstance();
