/**
 * Correlation ID utilities for client-side request tracing.
 *
 * Generates and propagates correlation IDs between client and server.
 * The ID is stored in sessionStorage and sent on every outgoing API request
 * via the `x-correlation-id` header. The server's `X-Correlation-Id` response
 * header is adopted as the new authoritative ID.
 *
 * Format: corr-CL-{tenantKey}-{nanoid} when tenantId is available, corr-CL-{nanoid} otherwise.
 * (CL = client, distinguishes from server-generated IDs)
 */
import { generateTenantKey } from '@/lib/sku-generator';

const STORAGE_KEY = 'vs_correlation_id';
const TENANT_KEY_STORAGE = 'vs_correlation_tenant_key';
const HEADER_NAME = 'x-correlation-id';
const RESPONSE_HEADER_NAME = 'x-correlation-id';

function generateNanoid(length: number = 8): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz';
  let id = '';
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      id += alphabet[array[i] % alphabet.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return id;
}

function generateCorrelationId(tenantKey?: string): string {
  if (tenantKey) {
    return `corr-CL-${tenantKey}-${generateNanoid(8)}`;
  }
  return `corr-CL-${generateNanoid(8)}`;
}

/**
 * Get the current correlation ID from sessionStorage, or generate a new one.
 * Safe to call during SSR — returns undefined on the server.
 */
export function getOrCreateCorrelationId(tenantId?: string): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const tenantKey = tenantId ? generateTenantKey(tenantId) : undefined;

  try {
    const storedTenantKey = sessionStorage.getItem(TENANT_KEY_STORAGE);
    let id = sessionStorage.getItem(STORAGE_KEY);

    // Regenerate if tenant changed or no existing ID
    if (!id || (tenantKey && storedTenantKey !== tenantKey)) {
      id = generateCorrelationId(tenantKey);
      sessionStorage.setItem(STORAGE_KEY, id);
      if (tenantKey) {
        sessionStorage.setItem(TENANT_KEY_STORAGE, tenantKey);
      }
    }
    return id;
  } catch {
    return generateCorrelationId(tenantKey);
  }
}

/**
 * Get the current correlation ID without generating a new one.
 */
export function getCorrelationId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return sessionStorage.getItem(STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Set the correlation ID (e.g., from an API response header).
 * Overwrites the stored ID with the server's authoritative value.
 */
export function setCorrelationId(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, id);
  } catch {
    // sessionStorage may be unavailable (private mode, etc.)
  }
}

/**
 * Clear the correlation ID (e.g., on logout).
 */
export function clearCorrelationId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(TENANT_KEY_STORAGE);
  } catch {
    // ignore
  }
}

/**
 * The header name to use for outgoing requests.
 */
export const CORRELATION_ID_HEADER = HEADER_NAME;

/**
 * The response header name to read from API responses.
 */
export const CORRELATION_ID_RESPONSE_HEADER = RESPONSE_HEADER_NAME;
