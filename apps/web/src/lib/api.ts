/**
 * Authenticated API client
 * Automatically includes JWT token in requests
 * Works with both Next.js API routes (/api/*) and direct backend calls
 * Includes request deduplication for GET requests
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;

/**
 * Request deduplication cache
 * Prevents duplicate GET requests within a short time window
 */
interface CachedRequest {
  promise: Promise<Response>;
  timestamp: number;
}

const requestCache = new Map<string, CachedRequest>();
const CACHE_TTL_MS = 2000; // 2 second deduplication window

function getCacheKey(url: string, token: string | null): string {
  return `${url}:${token || 'anonymous'}`;
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, cached] of requestCache.entries()) {
    if (now - cached.timestamp > CACHE_TTL_MS) {
      requestCache.delete(key);
    }
  }
}

/**
 * Get access token from localStorage or cookies
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // Try localStorage first (legacy)
  const localToken = localStorage.getItem('access_token');
  if (localToken) return localToken;
  
  // Fall back to cookie (current auth system)
  return getCookie('auth_token');
}

function getLastTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('lastTenantId');
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Make an authenticated API request with centralized auth handling.
 * - Injects bearer token from localStorage
 * - On 401: clears token and redirects to /login?next=
 * - Deduplicates identical GET requests within 2 second window
 * Supports both relative URLs (/api/tenants) and absolute URLs (http://...)
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit & { skipAuthRedirect?: boolean; skipCache?: boolean } = {}
): Promise<Response> {
  const token = getAccessToken();
  const tenantId = getLastTenantId();
  const csrf = getCookie('csrf');
  
  const method = (options.method || 'GET').toString().toUpperCase();
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  const isGet = method === 'GET';
  
  // Start with any provided headers, but avoid adding headers that trigger CORS preflight unnecessarily
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  // Only set Content-Type when sending a body on non-GET methods
  if (isWrite && options.body && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach tenant and CSRF headers on write operations
  if (isWrite) {
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  // Handle relative URLs (Next.js API routes) and absolute URLs
  // - Absolute http(s): use as-is
  // - /api/*: backend API calls (prefix with API_BASE_URL)
  // - Other / paths: Next.js API routes (use as-is)
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api/')
    ? `${API_BASE_URL}${endpoint}`
    : endpoint;
  
  // Request deduplication for GET requests
  // Skip cache for write operations or if explicitly disabled
  if (isGet && !options.skipCache) {
    cleanExpiredCache();
    const cacheKey = getCacheKey(url, token);
    const cached = requestCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      // Return cloned response from cache (Response can only be read once)
      return cached.promise.then(resp => resp.clone());
    }
    
    // Create the request promise and cache it
    const requestPromise = executeRequest(url, options, headers, token);
    requestCache.set(cacheKey, { promise: requestPromise, timestamp: Date.now() });
    return requestPromise.then(resp => resp.clone());
  }
  
  return executeRequest(url, options, headers, token);
}

/**
 * Execute the actual fetch request with retry logic
 */
async function executeRequest(
  url: string,
  options: RequestInit & { skipAuthRedirect?: boolean },
  headers: Record<string, string>,
  token: string | null
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
      credentials: 'include', // Include cookies for cross-origin requests
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
  
  // Centralized 401 handling (non-destructive)
  if (resp.status === 401 && typeof window !== 'undefined' && !(options as any).skipAuthRedirect) {
    try {
      const pathname = window.location.pathname;
      const alreadyRedirecting = sessionStorage.getItem('auth_redirecting') === '1';
      if (!alreadyRedirecting && pathname !== '/login') {
        sessionStorage.setItem('auth_redirecting', '1');
        const next = encodeURIComponent(pathname + window.location.search);
        window.location.href = `/login?next=${next}`;
      }
    } catch {}
  }

  return resp;
}

/**
 * Convenience methods
 */
export const api = {
  get: (endpoint: string, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, { ...options, method: 'GET' }),

  post: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean }) => {
    console.log('[api.put] Endpoint:', endpoint, 'Data:', data);
    const body = data ? JSON.stringify(data) : undefined;
    console.log('[api.put] Body:', body);
    return apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body,
    });
  },

  patch: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint: string, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
