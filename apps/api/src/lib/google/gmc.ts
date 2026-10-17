/**
 * Google Merchant Center (GMC) Integration
 * ENH-2026-043
 * 
 * Read-only access to GMC data (v1)
 * Uses Merchant API (replaces deprecated Content API for Shopping)
 */

import { getValidGoogleAccessToken } from './token-store';
import { prisma } from '../../prisma';
import { generateQuickStart } from '../id-generator';
import { logger } from '../../logger';

// Content API for Shopping v2.1 (stable, widely used)
const GMC_API_BASE = 'https://shoppingcontent.googleapis.com';
const CONTENT_API_VERSION = 'v2.1';
const MERCHANT_API_VERSION = 'v2.1';

/**
 * Get valid access token (refresh if expired)
 */
async function getValidAccessToken(account_id: string): Promise<string | null> {
  const token = await getValidGoogleAccessToken('gmc', { accountId: account_id });
  if (!token) {
    logger.error('[GMC] No valid access token for account:', undefined, { error: { name: 'Error', message: String(account_id) } });
  }
  return token;
}

/**
 * List merchant accounts using Content API authinfo endpoint
 * This returns all merchant accounts the authenticated user has access to
 */
export async function listMerchantAccounts(account_id: string): Promise<any[]> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('merchant_accounts_failed: no valid access token for account');
  }

  // Content API authinfo endpoint returns all accounts the user has access to
  const response = await fetch(`${GMC_API_BASE}/content/${CONTENT_API_VERSION}/accounts/authinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error('[GMC] Failed to fetch merchant accounts:', undefined, {
      status: response.status,
      body: body.slice(0, 500),
    });
    // Surface the failure. Returning [] here is indistinguishable from "this
    // Google account has no Merchant Center account", which sent us chasing the
    // account itself when the call had never succeeded — a Merchant Center
    // account (6311349) was linked the whole time.
    throw new Error(`merchant_accounts_failed: ${response.status} ${body.slice(0, 300)}`);
  }

  const data = await response.json() as { accountIdentifiers?: any[] };

  // authinfo returns accountIdentifiers array with accountId
  const accountIds = data.accountIdentifiers || [];

  // Return formatted accounts
  return accountIds.map((acc: any) => ({
    accountId: acc.aggregatorId || acc.merchantId,
    name: `Merchant ${acc.aggregatorId || acc.merchantId}`,
    accountName: `Merchant Account ${acc.aggregatorId || acc.merchantId}`,
  }));
}

/**
 * Get merchant account details
 * Uses Merchant API accounts.get endpoint
 */
export async function getMerchantAccount(
  account_id: string,
  merchantId: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(account_id);
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
      logger.error('[GMC] Failed to fetch merchant account:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('[GMC] Error getting merchant account:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/**
 * List products in merchant account
 * Uses Merchant API products.list endpoint
 */
export async function listProducts(
  account_id: string,
  merchantId: string,
  maxResults: number = 50
): Promise<any[]> {
  try {
    const accessToken = await getValidAccessToken(account_id);
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
      logger.error('[GMC] Failed to fetch products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return [];
    }

    const data = await response.json() as { products?: any[] };
    return data.products || [];
  } catch (error) {
    logger.error('[GMC] Error listing products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

/**
 * Get product details
 * Uses Merchant API products.get endpoint
 */
export async function getProduct(
  account_id: string,
  merchantId: string,
  productId: string
): Promise<any | null> {
  try {
    const accessToken = await getValidAccessToken(account_id);
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
      logger.error('[GMC] Failed to fetch product:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }

    return await response.json();
  } catch (error) {
    logger.error('[GMC] Error getting product:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/**
 * Sync merchant account to database
 * Uses Merchant API response format
 */
export async function syncMerchantAccount(
  account_id: string,
  merchantId: string
): Promise<boolean> {
  try {
    const merchantData = await getMerchantAccount(account_id, merchantId);
    if (!merchantData) {
      return false;
    }

    // Merchant API returns different field names
    const merchantName = merchantData.accountName || merchantData.name || 'Unknown';
    const websiteUrl = merchantData.homepageUri || merchantData.websiteUrl || null;

    // Upsert merchant link (schema has no composite unique on [account_id, merchant_id])
    // Find existing by (account_id, merchant_id), then update by id; else create
    const existing = await prisma.google_merchant_links_list.findFirst({
      where: { account_id: account_id, merchant_id: merchantId }, 
      select: { id: true },
    });

    if (existing) {
      await prisma.google_merchant_links_list.update({
        where: { id: existing.id },
        data: {
          merchant_name: merchantName, 
          website_url: websiteUrl,
          last_sync_at: new Date(),
          sync_status: 'success',
          sync_error: null,
          updated_at: new Date(),
        },
      });
    } else {
      await prisma.google_merchant_links_list.create({
        data: {
          id: generateQuickStart("gmcid"),
          account_id: account_id,
          merchant_id: merchantId,
          merchant_name: merchantName,
          website_url: websiteUrl,
          is_active: true,
          last_sync_at: new Date(),
          sync_status: 'success', 
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log('[GMC] Synced merchant account:', merchantId);
    return true;
  } catch (error) {
    logger.error('[GMC] Error syncing merchant account:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    
    // Update sync status to error
    await prisma.google_merchant_links_list.updateMany({
      where: { account_id: account_id, merchant_id: merchantId },
      data: {
        sync_status: 'error',
        sync_error: error instanceof Error ? error.message : 'Unknown error',
        updated_at: new Date(),
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
  account_id: string,
  merchantId: string
): Promise<{
  total: number;
  active: number;
  pending: number;
  disapproved: number;
} | null> {
  try {
    const accessToken = await getValidAccessToken(account_id);
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

    const data = await response.json() as { products?: any[] };
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
    logger.error('[GMC] Error getting product stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}
