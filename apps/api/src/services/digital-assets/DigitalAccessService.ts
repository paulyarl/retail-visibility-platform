/**
 * Digital Access Service
 * Manages access grants for digital products including download tracking and expiration
 */

import { prisma } from '../../prisma';
import { digitalAssetService } from './DigitalAssetService';

export interface AccessGrant {
  id: string;
  orderId: string;
  orderItemId: string;
  inventoryItemId: string;
  customerEmail: string;
  accessToken: string;
  downloadCount: number;
  downloadLimit: number | null;
  expiresAt: Date | null;
  firstAccessedAt: Date | null;
  lastAccessedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: string | null;
}

export interface CreateAccessGrantParams {
  orderId: string;
  orderItemId: string;
  inventoryItemId: string;
  customerEmail: string;
  downloadLimit?: number | null;
  accessDurationDays?: number | null;
}

export class DigitalAccessService {
  /**
   * Create an access grant for a digital product purchase
   */
  async createAccessGrant(params: CreateAccessGrantParams): Promise<AccessGrant> {
    const accessToken = digitalAssetService.generateAccessToken();
    const now = new Date();
    
    // Calculate expiration date if access duration is specified
    let expiresAt: Date | null = null;
    if (params.accessDurationDays) {
      expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + params.accessDurationDays);
    }

    const grantId = `grant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const grant = await prisma.digital_access_grants.create({
      data: {
        id: grantId,
        order_id: params.orderId,
        order_item_id: params.orderItemId,
        inventory_item_id: params.inventoryItemId,
        customer_email: params.customerEmail,
        access_token: accessToken,
        download_count: 0,
        download_limit: params.downloadLimit,
        expires_at: expiresAt,
        created_at: now,
        updated_at: now,
      },
    });

    return this.mapToAccessGrant(grant);
  }

  /**
   * Get access grant by token
   */
  async getAccessGrantByToken(accessToken: string): Promise<AccessGrant | null> {
    const grant = await prisma.digital_access_grants.findUnique({
      where: { access_token: accessToken },
    });

    if (!grant) return null;
    return this.mapToAccessGrant(grant);
  }

  /**
   * Get all access grants for a customer
   */
  async getAccessGrantsByEmail(customerEmail: string): Promise<AccessGrant[]> {
    const grants = await prisma.digital_access_grants.findMany({
      where: { customer_email: customerEmail },
      orderBy: { created_at: 'desc' },
    });

    return grants.map(g => this.mapToAccessGrant(g));
  }

  /**
   * Get all access grants for an order
   */
  async getAccessGrantsByOrder(orderId: string): Promise<AccessGrant[]> {
    const grants = await prisma.digital_access_grants.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });

    return grants.map(g => this.mapToAccessGrant(g));
  }

  /**
   * Validate access grant and check if download is allowed
   */
  async validateAccess(accessToken: string): Promise<{
    valid: boolean;
    reason?: string;
    grant?: AccessGrant;
  }> {
    const grant = await this.getAccessGrantByToken(accessToken);

    if (!grant) {
      return { valid: false, reason: 'Access token not found' };
    }

    // Check if revoked
    if (grant.revokedAt) {
      return { 
        valid: false, 
        reason: grant.revokedReason || 'Access has been revoked',
        grant 
      };
    }

    // Check if expired
    if (grant.expiresAt && grant.expiresAt < new Date()) {
      return { 
        valid: false, 
        reason: 'Access has expired',
        grant 
      };
    }

    // Check download limit
    if (grant.downloadLimit && grant.downloadCount >= grant.downloadLimit) {
      return { 
        valid: false, 
        reason: 'Download limit reached',
        grant 
      };
    }

    return { valid: true, grant };
  }

  /**
   * Record a download attempt
   */
  async recordDownload(accessToken: string): Promise<void> {
    const now = new Date();
    
    await prisma.digital_access_grants.update({
      where: { access_token: accessToken },
      data: {
        download_count: { increment: 1 },
        last_accessed_at: now,
        first_accessed_at: {
          // Only set if null (first access)
          set: undefined,
        },
        updated_at: now,
      },
    });

    // Update first_accessed_at if it's null
    const grant = await prisma.digital_access_grants.findUnique({
      where: { access_token: accessToken },
      select: { first_accessed_at: true },
    });

    if (!grant?.first_accessed_at) {
      await prisma.digital_access_grants.update({
        where: { access_token: accessToken },
        data: { first_accessed_at: now },
      });
    }
  }

  /**
   * Revoke access grant
   */
  async revokeAccess(accessToken: string, reason: string): Promise<void> {
    await prisma.digital_access_grants.update({
      where: { access_token: accessToken },
      data: {
        revoked_at: new Date(),
        revoked_reason: reason,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Extend access duration
   */
  async extendAccess(accessToken: string, additionalDays: number): Promise<void> {
    const grant = await this.getAccessGrantByToken(accessToken);
    if (!grant) throw new Error('Access grant not found');

    const currentExpiry = grant.expiresAt || new Date();
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + additionalDays);

    await prisma.digital_access_grants.update({
      where: { access_token: accessToken },
      data: {
        expires_at: newExpiry,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Reset download count
   */
  async resetDownloadCount(accessToken: string): Promise<void> {
    await prisma.digital_access_grants.update({
      where: { access_token: accessToken },
      data: {
        download_count: 0,
        updated_at: new Date(),
      },
    });
  }

  /**
   * Get access grant statistics
   */
  async getAccessStats(inventoryItemId: string): Promise<{
    totalGrants: number;
    activeGrants: number;
    expiredGrants: number;
    revokedGrants: number;
    totalDownloads: number;
  }> {
    const grants = await prisma.digital_access_grants.findMany({
      where: { inventory_item_id: inventoryItemId },
    });

    const now = new Date();
    const stats = {
      totalGrants: grants.length,
      activeGrants: 0,
      expiredGrants: 0,
      revokedGrants: 0,
      totalDownloads: 0,
    };

    for (const grant of grants) {
      stats.totalDownloads += grant.download_count;

      if (grant.revoked_at) {
        stats.revokedGrants++;
      } else if (grant.expires_at && grant.expires_at < now) {
        stats.expiredGrants++;
      } else {
        stats.activeGrants++;
      }
    }

    return stats;
  }

  /**
   * Clean up expired grants (for maintenance)
   */
  async cleanupExpiredGrants(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.digital_access_grants.deleteMany({
      where: {
        expires_at: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Map database record to AccessGrant interface
   */
  private mapToAccessGrant(grant: any): AccessGrant {
    return {
      id: grant.id,
      orderId: grant.order_id,
      orderItemId: grant.order_item_id,
      inventoryItemId: grant.inventory_item_id,
      customerEmail: grant.customer_email,
      accessToken: grant.access_token,
      downloadCount: grant.download_count,
      downloadLimit: grant.download_limit,
      expiresAt: grant.expires_at,
      firstAccessedAt: grant.first_accessed_at,
      lastAccessedAt: grant.last_accessed_at,
      revokedAt: grant.revoked_at,
      revokedReason: grant.revoked_reason,
    };
  }
}

// Export singleton instance
export const digitalAccessService = new DigitalAccessService();
