/**
 * Authenticated API client
 * Automatically includes JWT token in requests
 * Works with both Next.js API routes (/api/*) and direct backend calls
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

/**
 * Get access token from localStorage
 */
function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
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
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Handle relative URLs (Next.js API routes) and absolute URLs
  const url = endpoint.startsWith('http') || endpoint.startsWith('/') 
    ? endpoint 
    : `${API_BASE_URL}${endpoint}`;

  const resp = await fetch(url, {
    ...options,
    headers,
  });
  
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
