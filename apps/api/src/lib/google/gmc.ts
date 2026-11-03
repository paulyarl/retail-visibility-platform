/**
 * Google Merchant Center (GMC) read module — Merchant API.
 *
 * Spec: docs/LocalBiz/GMC_MERCHANT_API_SWIS_SPEC.md §5
 * Reads go through lib/google/merchant-api.ts (merchantapi.googleapis.com).
 * The only remaining Content API call is listMerchantAccounts' authinfo
 * endpoint — no verified Merchant API equivalent for account discovery yet
 * (spec open decision #2; interim until confirmed).
 */

import { getValidGoogleAccessToken } from './token-store';
import { prisma } from '../../prisma';
import { generateQuickStart } from '../id-generator';
import { logger } from '../../logger';
import {
  getMerchantAccount as apiGetMerchantAccount,
  getProcessedProduct,
  listProcessedProducts,
} from './merchant-api';

// Content API for Shopping — INTERIM for account discovery only.
const GMC_API_BASE = 'https://shoppingcontent.googleapis.com'; // completion-gate-allow: authinfo interim
const CONTENT_API_VERSION = 'v2.1'; // completion-gate-allow: authinfo interim

async function getValidAccessToken(account_id: string): Promise<string | null> {
  const token = await getValidGoogleAccessToken('gmc', { accountId: account_id });
  if (!token) {
    logger.error('[GMC] No valid access token for account:', undefined, { error: { name: 'Error', message: String(account_id) } });
  }
  return token;
}

/**
 * List merchant accounts the authenticated user can access.
 * INTERIM: still on Content API authinfo — Merchant API has no confirmed
 * non-MCA discovery endpoint. See spec open decision.
 */
export async function listMerchantAccounts(account_id: string): Promise<any[]> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('merchant_accounts_failed: no valid access token for account');
  }

  const response = await fetch(`${GMC_API_BASE}/content/${CONTENT_API_VERSION}/accounts/authinfo`, { // completion-gate-allow: authinfo interim
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
  const accountIds = data.accountIdentifiers || [];

  return accountIds.map((acc: any) => ({
    accountId: acc.aggregatorId || acc.merchantId,
    name: `Merchant ${acc.aggregatorId || acc.merchantId}`,
    accountName: `Merchant Account ${acc.aggregatorId || acc.merchantId}`,
  }));
}

/** Get a merchant account — Merchant API accounts.get. */
export async function getMerchantAccount(
  account_id: string,
  merchantId: string,
): Promise<any | null> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('merchant_account_failed: no valid access token for account');
  }
  return apiGetMerchantAccount(accessToken, merchantId);
}

/** List processed products — Merchant API products.list (paginated). */
export async function listProducts(
  account_id: string,
  merchantId: string,
  maxResults: number = 50,
): Promise<any[]> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('products_failed: no valid access token for account');
  }
  const products = await listProcessedProducts(accessToken, merchantId, maxResults);
  return products.slice(0, maxResults);
}

/** Get one processed product by offerId — Merchant API products.get. */
export async function getProduct(
  account_id: string,
  merchantId: string,
  productId: string,
): Promise<any | null> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('product_failed: no valid access token for account');
  }
  return getProcessedProduct(accessToken, merchantId, productId);
}

/** Sync merchant account row — Merchant API accounts.get + link upsert. */
export async function syncMerchantAccount(
  account_id: string,
  merchantId: string,
): Promise<boolean> {
  try {
    const merchantData = await getMerchantAccount(account_id, merchantId);
    if (!merchantData) {
      return false;
    }

    const merchantName = merchantData.accountName || merchantData.name || 'Unknown';
    const websiteUrl = merchantData.homepageUri || merchantData.websiteUrl || null;

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
 * Product stats from processed products — Merchant API products.list.
 * productStatus.itemLevelIssues exists on the processed product (unlike the
 * old Content API products.list read), so error/warning counts are real now.
 */
export async function getProductStats(
  account_id: string,
  merchantId: string,
): Promise<{
  total: number;
  active: number;
  pending: number;
  disapproved: number;
} | null> {
  const accessToken = await getValidAccessToken(account_id);
  if (!accessToken) {
    throw new Error('product_stats_failed: no valid access token for account');
  }

  const products = await listProcessedProducts(accessToken, merchantId, 250);

  const stats = { total: products.length, active: 0, pending: 0, disapproved: 0 };
  for (const product of products) {
    const issues = product.productStatus?.itemLevelIssues || [];
    const hasErrors = issues.some((i: any) => i.severity === 'error');
    const hasWarnings = issues.some((i: any) => i.severity === 'warning');
    if (hasErrors) stats.disapproved++;
    else if (hasWarnings) stats.pending++;
    else stats.active++;
  }
  return stats;
}
