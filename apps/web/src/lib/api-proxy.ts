/**
 * @deprecated This module is legacy. The platform has standardized on the
 * FlexibleApiSingleton / ApiSystemSingleton hierarchy for all API requests.
 * Use ServerProxySingleton (extends ApiSystemSingleton) for server-side proxying.
 *
 * This file has zero imports in the codebase and is kept only for backward compatibility.
 */

const API_BASE_URL = process.env.API_BASE_URL ||
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://aps.visibleshelf.store' : 'http://localhost:4000');

/**
 * Get headers with Authorization and Cookie forwarded from the request
 */
export function getProxyHeaders(req: Request, additionalHeaders?: Record<string, string>): HeadersInit {
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }
  
  return headers;
}

/**
 * @deprecated Use ServerProxySingleton.proxyGet() instead.
 * Proxy a GET request to the backend with auth
 */
export async function proxyGet(req: Request, path: string): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, { headers });
}

/**
 * @deprecated Use ServerProxySingleton.proxyPost() instead.
 * Proxy a POST request to the backend with auth
 */
export async function proxyPost(req: Request, path: string, body?: any): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @deprecated Use ServerProxySingleton.proxyPut() instead.
 * Proxy a PUT request to the backend with auth
 */
export async function proxyPut(req: Request, path: string, body?: any): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @deprecated Use ServerProxySingleton.proxyPatch() instead.
 * Proxy a PATCH request to the backend with auth
 */
export async function proxyPatch(req: Request, path: string, body?: any): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * @deprecated Use ServerProxySingleton.proxyDelete() instead.
 * Proxy a DELETE request to the backend with auth
 */
export async function proxyDelete(req: Request, path: string): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
}
