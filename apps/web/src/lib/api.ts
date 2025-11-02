/**
 * Authenticated API client
 * Automatically includes JWT token in requests
 * Works with both Next.js API routes (/api/*) and direct backend calls
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
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
 * Supports both relative URLs (/api/tenants) and absolute URLs (http://...)
 */
export async function apiRequest(
  endpoint: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {}
): Promise<Response> {
  const token = getAccessToken();
  const tenantId = getLastTenantId();
  const csrf = getCookie('csrf');
  const requestId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto as any).randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': requestId,
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Attach tenant and CSRF headers on write operations
  const method = (options.method || 'GET').toString().toUpperCase();
  const isWrite = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  if (isWrite) {
    if (tenantId) headers['x-tenant-id'] = tenantId;
    if (csrf) headers['x-csrf-token'] = csrf;
  }

  // Handle relative URLs (Next.js API routes) and absolute URLs
  // - Absolute http(s): use as-is
  // - Leading '/': use as-is (hit Next.js API/proxy routes)
  // - Bare path: prefix with API_BASE_URL
  const url = endpoint.startsWith('http') || endpoint.startsWith('/') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;

  // Simple retry/backoff for 429/5xx (max 2 retries)
  const maxRetries = 2;
  let attempt = 0;
  let resp: Response;
  while (true) {
    resp = await fetch(url, {
      ...options,
      headers,
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

  put: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: (endpoint: string, data?: any, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (endpoint: string, options?: RequestInit & { skipAuthRedirect?: boolean }) =>
    apiRequest(endpoint, { ...options, method: 'DELETE' }),
};
