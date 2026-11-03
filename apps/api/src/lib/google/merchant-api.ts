/**
 * Google Merchant API client (replaces Content API for Shopping)
 *
 * Spec: docs/LocalBiz/GMC_MERCHANT_API_SWIS_SPEC.md §5
 *
 * - Host: https://merchantapi.googleapis.com  (NOT shoppingcontent.googleapis.com — completion-gate-allow: doc reference)
 * - Resource identity: `name` fields, e.g. accounts/{account}/products/{product}
 *   where {product} = contentLanguage~feedLabel~offerId (or local~... for
 *   local-only products). Product inputs are written via productInputs:insert
 *   with a required `dataSource` query param.
 * - Prices are { amountMicros: int64-string, currencyCode }.
 * - No custombatch: callers run a concurrency-limited loop themselves. completion-gate-allow: doc reference
 *
 * Auth: same OAuth 'gmc' token as the Content API path (scope auth/content
 * covers Merchant API). Token/merchant-link resolution mirrors
 * services/GMCProductSync.ts getValidAccessToken.
 */

import { prisma } from '../../prisma';
import { findGoogleToken, resolveGoogleAccessToken } from './token-store';
import { logger } from '../../logger';

const MERCHANT_API_BASE = 'https://merchantapi.googleapis.com';
const ACCOUNTS_V = 'accounts/v1';
const PRODUCTS_V = 'products/v1';
const INVENTORIES_V = 'inventories/v1';
const DATASOURCES_V = 'datasources/v1';

export interface MerchantContext {
  token: string;
  merchantId: string;
  /** google_oauth_accounts_list.id — for developerRegistration bookkeeping */
  oauthAccountId: string;
}

/**
 * Resolve the GMC access token + active merchant link for a tenant.
 * Mirrors the legacy getValidAccessToken in GMCProductSync.ts.
 */
export async function getMerchantContext(tenantId: string): Promise<MerchantContext | null> {
  try {
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    const tokenRecord = await findGoogleToken('gmc', { tenantId });
    if (!tokenRecord) {
      logger.warn(`[MerchantAPI] No OAuth token for tenant ${tenantId}`, undefined);
      return null;
    }

    const merchantLink = account?.google_merchant_links_list[0];
    if (!merchantLink) {
      logger.warn(`[MerchantAPI] No merchant link for tenant ${tenantId}`, undefined);
      return null;
    }

    const token = await resolveGoogleAccessToken('gmc', tokenRecord);
    if (!token) {
      logger.error('[MerchantAPI] Failed to refresh token', undefined);
      return null;
    }

    return { token, merchantId: merchantLink.merchant_id, oauthAccountId: account!.id };
  } catch (error) {
    logger.error('[MerchantAPI] Error resolving context:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

export class MerchantApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `merchant_api_failed: ${status} ${body.slice(0, 300)}`);
    this.name = 'MerchantApiError';
  }
}

/**
 * Authenticated request to the Merchant API. Throws MerchantApiError on any
 * non-2xx — callers must not swallow (fail-loud contract, spec §4.3).
 * One retry on 429/5xx with a short backoff.
 */
export async function merchantRequest<T = any>(
  token: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  attempt = 0,
): Promise<T | null> {
  const response = await fetch(`${MERCHANT_API_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 429 || (response.status >= 500 && attempt < 1)) {
    await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    return merchantRequest<T>(token, method, path, body, attempt + 1);
  }

  if (!response.ok) {
    const text = await response.text();
    logger.error(`[MerchantAPI] ${method} ${path} failed`, undefined, {
      status: response.status,
      body: text.slice(0, 500),
    });
    throw new MerchantApiError(response.status, text);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T | null;
}

// ─── Product identity helpers ───────────────────────────────────────────────

/**
 * Encode a product identifier segment for resource names.
 * Plain `contentLanguage~feedLabel~offerId` when URL-safe; unpadded
 * base64url otherwise (required when offerId contains / % or ~).
 */
export function encodeProductSegment(contentLanguage: string, feedLabel: string, offerId: string): string {
  const plain = `${contentLanguage}~${feedLabel}~${offerId}`;
  if (/[~/%]/.test(plain)) {
    return Buffer.from(plain, 'utf8').toString('base64url').replace(/=+$/, '');
  }
  return plain;
}

export function productInputName(merchantId: string, contentLanguage: string, feedLabel: string, offerId: string): string {
  return `accounts/${merchantId}/productInputs/${encodeProductSegment(contentLanguage, feedLabel, offerId)}`;
}

export function productName(merchantId: string, contentLanguage: string, feedLabel: string, offerId: string): string {
  return `accounts/${merchantId}/products/${encodeProductSegment(contentLanguage, feedLabel, offerId)}`;
}

// ─── Data sources ───────────────────────────────────────────────────────────

/**
 * Ensure a primary product data source exists and return its resource name.
 * productInputs:insert requires `dataSource` — the merchant's UI-created feed
 * is reused when present; otherwise we provision `platform-feed`.
 */
export async function ensurePrimaryDataSource(
  token: string,
  merchantId: string,
  contentLanguage = 'en',
  feedLabel = 'US',
): Promise<string> {
  const parent = `accounts/${merchantId}`;
  const list = await merchantRequest<{ dataSources?: any[] }>(
    token, 'GET', `${DATASOURCES_V}/${parent}/dataSources`,
  );

  const primary = (list?.dataSources || []).find(
    (ds: any) => ds.primaryProductDataSource || ds.dataSourceType === 'PRIMARY_PRODUCT_DATA_SOURCE',
  );
  if (primary?.name) return primary.name as string;

  const created = await merchantRequest<{ name?: string }>(
    token, 'POST', `${DATASOURCES_V}/${parent}/dataSources`,
    {
      displayName: 'platform-feed',
      primaryProductDataSource: {
        channel: 'ONLINE_PRODUCTS',
        contentLanguage,
        feedLabel,
        countries: ['US'],
      },
    },
  );
  if (!created?.name) throw new MerchantApiError(500, '', 'data_source_provision_failed');
  return created.name;
}

// ─── Product inputs (write path) ────────────────────────────────────────────

export async function insertProductInput(
  token: string,
  merchantId: string,
  dataSource: string,
  productInput: Record<string, unknown>,
): Promise<any> {
  const parent = `accounts/${merchantId}`;
  return merchantRequest(
    token, 'POST',
    `${PRODUCTS_V}/${parent}/productInputs:insert?dataSource=${encodeURIComponent(dataSource)}`,
    productInput,
  );
}

/** Delete a product input; idempotent — 404 is success (already gone). */
export async function deleteProductInput(
  token: string,
  merchantId: string,
  offerId: string,
  contentLanguage = 'en',
  feedLabel = 'US',
): Promise<void> {
  const name = productInputName(merchantId, contentLanguage, feedLabel, offerId);
  try {
    await merchantRequest(token, 'DELETE', `${PRODUCTS_V}/${name}`);
  } catch (err) {
    if (err instanceof MerchantApiError && err.status === 404) return;
    throw err;
  }
}

// ─── Processed products (read-back path) ────────────────────────────────────

export async function getProcessedProduct(
  token: string,
  merchantId: string,
  offerId: string,
  contentLanguage = 'en',
  feedLabel = 'US',
): Promise<any | null> {
  const name = productName(merchantId, contentLanguage, feedLabel, offerId);
  try {
    return await merchantRequest(token, 'GET', `${PRODUCTS_V}/${name}`);
  } catch (err) {
    if (err instanceof MerchantApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listProcessedProducts(
  token: string,
  merchantId: string,
  pageSize = 250,
): Promise<any[]> {
  const parent = `accounts/${merchantId}`;
  const products: any[] = [];
  let pageToken: string | undefined;
  do {
    const qs = `pageSize=${pageSize}` + (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '');
    const page = await merchantRequest<{ products?: any[]; nextPageToken?: string }>(
      token, 'GET', `${PRODUCTS_V}/${parent}/products?${qs}`,
    );
    products.push(...(page?.products || []));
    pageToken = page?.nextPageToken || undefined;
  } while (pageToken);
  return products;
}

export async function getMerchantAccount(token: string, merchantId: string): Promise<any> {
  return merchantRequest(token, 'GET', `${ACCOUNTS_V}/accounts/${merchantId}`);
}

// ─── Local inventories (SWIS path — Phase 2 callers) ────────────────────────

export interface LocalInventoryInput {
  storeCode: string;
  price?: { amountMicros: string; currencyCode: string };
  salePrice?: { amountMicros: string; currencyCode: string };
  availability?: 'IN_STOCK' | 'OUT_OF_STOCK' | 'LIMITED_AVAILABILITY' | 'ON_DISPLAY_TO_ORDER';
  quantity?: number;
  pickupMethod?: string;
  pickupSla?: string;
  instoreProductLocation?: string;
}

export async function insertLocalInventory(
  token: string,
  merchantId: string,
  offerId: string,
  inventory: LocalInventoryInput,
  contentLanguage = 'en',
  feedLabel = 'US',
): Promise<any> {
  const parent = productName(merchantId, contentLanguage, feedLabel, offerId);
  return merchantRequest(
    token, 'POST',
    `${INVENTORIES_V}/${parent}/localInventories:insert`,
    inventory,
  );
}

/** Idempotent — 404 is success. */
export async function deleteLocalInventory(
  token: string,
  merchantId: string,
  offerId: string,
  storeCode: string,
  contentLanguage = 'en',
  feedLabel = 'US',
): Promise<void> {
  const parent = productName(merchantId, contentLanguage, feedLabel, offerId);
  try {
    await merchantRequest(
      token, 'DELETE',
      `${INVENTORIES_V}/${parent}/localInventories/${encodeURIComponent(storeCode)}`,
    );
  } catch (err) {
    if (err instanceof MerchantApiError && err.status === 404) return;
    throw err;
  }
}

// ─── Bootstrap ──────────────────────────────────────────────────────────────

/**
 * One-time developer registration per GCP project (required before any
 * Merchant API call). Safe to re-call — Google treats it as upsert-ish; a
 * 409/already-registered is treated as success.
 */
export async function registerDeveloper(
  token: string,
  merchantId: string,
  developerEmail: string,
): Promise<boolean> {
  try {
    await merchantRequest(
      token, 'POST',
      `${ACCOUNTS_V}/accounts/${merchantId}/developerRegistration:registerGcp`,
      { developerEmail },
    );
    return true;
  } catch (err) {
    if (err instanceof MerchantApiError && err.status === 409) return true;
    logger.error('[MerchantAPI] developerRegistration failed:', undefined, { error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err), stack: (err as any)?.stack } });
    return false;
  }
}
