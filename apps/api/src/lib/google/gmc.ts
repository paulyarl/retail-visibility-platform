/**
 * Google Merchant Center (GMC) Integration
 * ENH-2026-043
 * 
 * Read-only access to GMC data (v1)
 * Uses Merchant API (replaces deprecated Content API for Shopping)
 */

import { decryptToken, refreshAccessToken, encryptToken } from './oauth';
import { prisma } from '../../prisma';

// Merchant API v1beta (replaces deprecated Content API v2.1)
const GMC_API_BASE = 'https://merchantapi.googleapis.com';
const MERCHANT_API_VERSION = 'v1beta';

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
 * Uses Merchant API accounts.list endpoint
 */
export async function listMerchantAccounts(accountId: string): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      throw new Error('No valid access token');
    }

    // Merchant API uses accounts.list instead of authinfo
    const response = await fetch(`${GMC_API_BASE}/${MERCHANT_API_VERSION}/accounts`, {
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
    return data.accounts || [];
  } catch (error) {
    console.error('[GMC] Error listing merchant accounts:', error);
    return [];
  }
}

/**
 * Get merchant account details
 * Uses Merchant API accounts.get endpoint
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

    // Merchant API uses accounts/{name} format
    const response = await fetch(`${GMC_API_BASE}/${MERCHANT_API_VERSION}/accounts/${merchantId}`, {
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
 * Uses Merchant API products.list endpoint
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

    // Merchant API uses accounts/{account}/products format with pageSize
    const response = await fetch(
      `${GMC_API_BASE}/${MERCHANT_API_VERSION}/accounts/${merchantId}/products?pageSize=${maxResults}`,
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
    return data.products || [];
  } catch (error) {
    console.error('[GMC] Error listing products:', error);
    return [];
  }
}

/**
 * Get product details
 * Uses Merchant API products.get endpoint
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

    // Merchant API uses accounts/{account}/products/{product} format
    const response = await fetch(
      `${GMC_API_BASE}/${MERCHANT_API_VERSION}/accounts/${merchantId}/products/${productId}`,
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
 * Uses Merchant API response format
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

    // Merchant API returns different field names
    const merchantName = merchantData.accountName || merchantData.name || 'Unknown';
    const websiteUrl = merchantData.homepageUri || merchantData.websiteUrl || null;

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
        merchantName,
        websiteUrl,
        isActive: true,
        lastSyncAt: new Date(),
        syncStatus: 'success',
      },
      update: {
        merchantName,
        websiteUrl,
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
 * Uses Merchant API products.list to calculate stats
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

    // Merchant API: fetch products with larger page size for stats
    const response = await fetch(
      `${GMC_API_BASE}/${MERCHANT_API_VERSION}/accounts/${merchantId}/products?pageSize=250`,
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
    const products = data.products || [];

    const stats = {
      total: products.length,
      active: 0,
      pending: 0,
      disapproved: 0,
    };

    // Merchant API uses different status structure
    products.forEach((product: any) => {
      const status = product.productStatus?.itemLevelIssues || [];
      const hasErrors = status.some((issue: any) => issue.severity === 'error');
      const hasWarnings = status.some((issue: any) => issue.severity === 'warning');

      if (hasErrors) stats.disapproved++;
      else if (hasWarnings) stats.pending++;
      else stats.active++;
    });

    return stats;
  } catch (error) {
    console.error('[GMC] Error getting product stats:', error);
    return null;
  }
}
