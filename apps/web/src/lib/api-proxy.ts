/**
 * Utility for Next.js API routes that proxy to the backend
 * Automatically forwards Authorization headers
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

/**
 * Get headers with Authorization forwarded from the request
 */
export function getProxyHeaders(req: Request, additionalHeaders?: Record<string, string>): HeadersInit {
  const authHeader = req.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  return headers;
}

/**
 * Proxy a GET request to the backend with auth
 */
export async function proxyGet(req: Request, path: string): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, { headers });
}

/**
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
 * Proxy a DELETE request to the backend with auth
 */
export async function proxyDelete(req: Request, path: string): Promise<Response> {
  const headers = getProxyHeaders(req);
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'DELETE',
    headers,
  });
}
