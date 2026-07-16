import { getDeviceInfoHeader } from './device-info';
import { clientLogger } from '@/lib/client-logger';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || process.env.API_URL || '';

/**
 * Request deduplication cache
 * Prevents duplicate GET requests within a short time window
 */
interface CachedRequest {
  promise: Promise<Response>;
  timestamp: number;
}

const requestCache = new Map<string, CachedRequest>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for proper caching

function getCacheKey(url: string): string {
  // Auth0 uses HTTP-only cookies, so no token in cache key
  return url;
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, cached] of requestCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL_MS) {
      requestCache.delete(key);
    }
  }
}

function getLastTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lastTenantId') || localStorage.getItem('current_tenant_id');
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get Auth0 ID from cookie for API authentication
 */
function getAuth0Id(): string | null {
  return getCookie('auth0_id');
}

/**
 * Get Auth0 email from cookie for API authentication
 */
function getAuth0Email(): string | null {
  return getCookie('auth0_email');
}

/**
 * Make an authenticated API request with Auth0 session handling.
 * - Uses HTTP-only cookies for authentication (managed by Auth0 SDK)
 * - On 401: redirects to Auth0 login
 * - Deduplicates identical GET requests within cache window
 * Supports both relative URLs (/api/tenants) and absolute URLs (http://...)
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit & { skipAuthRedirect?: boolean; skipCache?: boolean; skipAuth?: boolean } = {}
): Promise<Response> {
  const tenantId = getLastTenantId();
  const csrf = getCookie('csrf');
  
  const method = (options.method || 'GET').toString().toUpperCase();
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const isGet = method === 'GET';
  
  // Start with any provided headers, but avoid adding headers that trigger CORS preflight unnecessarily
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Add Auth0 headers for API authentication (read from non-HTTP-only cookies)
  const auth0Id = getAuth0Id();
  const auth0Email = getAuth0Email();
  if (auth0Id) headers['x-auth0-id'] = auth0Id;
  if (auth0Email) headers['x-auth0-email'] = auth0Email;

  // Add device info header for session tracking
  if (typeof window !== 'undefined') {
    try {
      headers['x-device-info'] = getDeviceInfoHeader();
    } catch (error) {
      clientLogger.warn('[API] Failed to add device info header:', { detail: error });
    }
  }

  // Only set Content-Type when sending a body on non-GET methods
  if (isWrite && options.body && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach tenant and CSRF headers on write operations
  if (isWrite) {
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  // Handle relative URLs (Next.js API routes) and absolute URLs
  // - Absolute http(s): use as-is
  // - /api/*: backend API calls (prefix with API_BASE_URL)
  // - /public/*: backend API calls (prefix with API_BASE_URL)
  // - Other / paths: Next.js API routes (use as-is)
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api/') || endpoint.startsWith('/public/')
    ? `${API_BASE_URL}${endpoint}`
    : endpoint;
  
  // Request deduplication for GET requests
  // Skip cache for write operations or if explicitly disabled
  if (isGet && !options.skipCache) {
    cleanExpiredCache();
    const cacheKey = getCacheKey(url);
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Return cloned response from cache (Response can only be read once)
      return cached.promise.then(resp => resp.clone());
    }
    
    // Create the request promise and cache it
    const requestPromise = executeRequest(url, options, headers);
    requestCache.set(cacheKey, { promise: requestPromise, timestamp: Date.now() });
    return requestPromise.then(resp => resp.clone());
  }
  
  return executeRequest(url, options, headers);
}

/**
 * Execute the actual fetch request with retry logic
 * Auth0 session is passed via HTTP-only cookies (credentials: 'include')
 */
async function executeRequest(
  url: string,
  options: RequestInit & { skipAuthRedirect?: boolean },
  headers: Record<string, string>
): Promise<Response> {

  // Simple retry/backoff for 429/5xx (max 2 retries), but skip if x-no-retry header is set
  const shouldRetry = !headers['x-no-retry'];
  const maxRetries = shouldRetry ? 2 : 0;
  let attempt = 0;
  let resp: Response;
  while (true) {
    resp = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies for Auth0 session (HTTP-only)
    });
    if (attempt >= maxRetries) break;
    if (resp.status === 429 || (resp.status >= 500 && resp.status <= 599)) {
      const delay = Math.pow(2, attempt) * 300; // 300ms, 600ms
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
      continue;
    }
    break;
  }
  
  // Centralized 401 handling - redirect to Auth0 login
  if (resp.status === 401 && typeof window !== 'undefined' && !(options as any).skipAuthRedirect) {
    try {
      const pathname = window.location.pathname;
      const alreadyRedirecting = sessionStorage.getItem('auth_redirecting') === '1';
      if (!alreadyRedirecting && pathname !== '/login' && pathname !== '/auth/login') {
        sessionStorage.setItem('auth_redirecting', '1');
        // Redirect to Auth0 login with return path
        const returnTo = encodeURIComponent(pathname + window.location.search);
        window.location.href = `/auth/login?returnTo=${returnTo}`;
      }
    } catch {}
  }

  return resp;
}

/**
 * Convenience methods
 */
export const api = {
  get: (endpoint: string, options?: RequestInit & { skipAuthRedirect?: boolean; skipAuth?: boolean }) =>
    apiRequest(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean; skipAuth?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean; skipAuth?: boolean }) => {
    console.log('[api.put] Endpoint:', endpoint, 'Data:', data);
    const body = data ? JSON.stringify(data) : undefined;
    console.log('[api.put] Body:', body);
    return apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
  },

  patch: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean; skipAuth?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint: string, options?: RequestInit & { skipAuthRedirect?: boolean; skipAuth?: boolean }) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
