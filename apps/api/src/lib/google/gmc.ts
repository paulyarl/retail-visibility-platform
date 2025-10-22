/**
 * Google Merchant Center (GMC) Integration
 * ENH-2026-043
 * 
 * Read-only access to GMC data (v1)
 */

import { decryptToken, refreshAccessToken, encryptToken } from './oauth';
import { prisma } from '../../prisma';

const GMC_API_BASE = 'https://shoppingcontent.googleapis.com/content/v2.1';

/**
 * Get valid access token (refresh if expired)
 */
async function getValidAccessToken(accountId: string): Promise<string | null> {
  try {
    const tokenRecord = await prisma.googleOAuthToken.findUnique({
      where: { accountId },
    });

    if (!tokenRecord) {
      console.error('[GMC] No token found for account:', accountId);
      return null;
    }

    // Check if token is expired
    const now = new Date();
    if (tokenRecord.expiresAt <= now) {
      console.log('[GMC] Token expired, refreshing...');
      
      // Decrypt refresh token
      const refreshToken = decryptToken(tokenRecord.refreshTokenEncrypted);
      
      // Get new access token
      const newTokens = await refreshAccessToken(refreshToken);
      if (!newTokens) {
        console.error('[GMC] Failed to refresh token');
        return null;
      }

      // Update in database
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await prisma.googleOAuthToken.update({
        where: { accountId },
        data: {
          accessTokenEncrypted: encryptToken(newTokens.access_token),
          expiresAt: newExpiresAt,
          scopes: newTokens.scope.split(' '),
        },
      });

      return newTokens.access_token;
    }

    // Token still valid
    return decryptToken(tokenRecord.accessTokenEncrypted);
  } catch (error) {
    console.error('[GMC] Error getting valid token:', error);
    return null;
  }
}

/**
 * List merchant accounts
 */
export async function listMerchantAccounts(accountId: string): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(`${GMC_API_BASE}/accounts/authinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GMC] Failed to fetch merchant accounts:', error);
      return [];
    }

    const data = await response.json();
    return data.accountIdentifiers || [];
  } catch (error) {
    console.error('[GMC] Error listing merchant accounts:', error);
    return [];
  }
}

/**
 * Get merchant account details
 */
export async function getMerchantAccount(
  accountId: string,
  merchantId: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(`${GMC_API_BASE}/${merchantId}/accounts/${merchantId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[GMC] Failed to fetch merchant account:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GMC] Error getting merchant account:', error);
    return null;
  }
}

/**
 * List products in merchant account
 */
export async function listProducts(
  accountId: string,
  merchantId: string,
  maxResults: number = 50
): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(
      `${GMC_API_BASE}/${merchantId}/products?maxResults=${maxResults}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GMC] Failed to fetch products:', error);
      return [];
    }

    const data = await response.json();
    return data.resources || [];
  } catch (error) {
    console.error('[GMC] Error listing products:', error);
    return [];
  }
}

/**
 * Get product details
 */
export async function getProduct(
  accountId: string,
  merchantId: string,
  productId: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(
      `${GMC_API_BASE}/${merchantId}/products/${productId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[GMC] Failed to fetch product:', error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[GMC] Error getting product:', error);
    return null;
  }
}

/**
 * Sync merchant account to database
 */
export async function syncMerchantAccount(
  accountId: string,
  merchantId: string
): Promise<boolean> {
  try {
    const merchantData = await getMerchantAccount(accountId, merchantId);
    if (!merchantData) {
      return false;
    }

    // Upsert merchant link
    await prisma.googleMerchantLink.upsert({
      where: {
        accountId_merchantId: {
          accountId,
          merchantId,
        },
      },
      create: {
        accountId,
        merchantId,
        merchantName: merchantData.name,
        websiteUrl: merchantData.websiteUrl,
        isActive: true,
        lastSyncAt: new Date(),
        syncStatus: 'success',
      },
      update: {
        merchantName: merchantData.name,
        websiteUrl: merchantData.websiteUrl,
        lastSyncAt: new Date(),
        syncStatus: 'success',
        syncError: null,
      },
    });

    console.log('[GMC] Synced merchant account:', merchantId);
    return true;
  } catch (error) {
    console.error('[GMC] Error syncing merchant account:', error);
    
    // Update sync status to error
    await prisma.googleMerchantLink.updateMany({
      where: { accountId, merchantId },
      data: {
        syncStatus: 'error',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    return false;
  }
}

/**
 * Get product statistics
 */
export async function getProductStats(
  accountId: string,
  merchantId: string
): Promise<{
  total: number;
  active: number;
  pending: number;
  disapproved: number;
} | null> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    const response = await fetch(
      `${GMC_API_BASE}/${merchantId}/productstatuses?maxResults=250`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const statuses = data.resources || [];

    const stats = {
      total: statuses.length,
      active: 0,
      pending: 0,
      disapproved: 0,
    };

    statuses.forEach((status: any) => {
      const destinations = status.destinationStatuses || [];
      const hasApproved = destinations.some((d: any) => d.status === 'approved');
      const hasPending = destinations.some((d: any) => d.status === 'pending');
      const hasDisapproved = destinations.some((d: any) => d.status === 'disapproved');

      if (hasApproved) stats.active++;
      else if (hasPending) stats.pending++;
      else if (hasDisapproved) stats.disapproved++;
    });

    return stats;
  } catch (error) {
    console.error('[GMC] Error getting product stats:', error);
    return null;
  }
}
