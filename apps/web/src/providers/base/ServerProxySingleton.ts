/**
 * ServerProxySingleton — Server-side singleton for Next.js API route proxying.
 * Extends ApiSystemSingleton (which extends FlexibleApiSingleton) but overrides
 * URL resolution and fetch to work in a server context (no window, no localStorage,
 * no browser credentials).
 *
 * Uses process.env.API_BASE_URL (server-only) with a production-aware fallback
 * matching next.config.ts rewrites logic.
 */

import { ApiSystemSingleton } from './ApiSystemSingleton';
import { RequestTarget } from './FlexibleApiSingleton';

function getServerApiBaseUrl(): string {
  return process.env.API_BASE_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000';
}

export interface ProxyResult<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export abstract class ServerProxySingleton extends ApiSystemSingleton {
  protected defaultIncludeCredentials: boolean = false;

  constructor(singletonKey: string) {
    super(singletonKey, { ttl: 0 });
  }

  /**
   * Override buildUrl to use server-side env var for API target.
   * On the server, relative URLs won't work with fetch — we need absolute URLs.
   */
  protected resolveServerUrl(path: string, target?: RequestTarget): string {
    if (path.startsWith('http')) return path;
    const t = target || this.defaultRequestTarget;
    switch (t) {
      case RequestTarget.API:
        return `${getServerApiBaseUrl()}${path}`;
      case RequestTarget.WEB:
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL ||
          process.env.FRONTEND_URL ||
          (process.env.NODE_ENV === 'production'
            ? 'https://visibleshelf.store'
            : 'http://localhost:3000');
        return `${webUrl}${path}`;
      default:
        return `${getServerApiBaseUrl()}${path}`;
    }
  }

  /**
   * Server-side proxy GET with auth header forwarding.
   */
  async proxyGet<T = any>(path: string, headers?: Record<string, string>): Promise<ProxyResult<T>> {
    const url = this.resolveServerUrl(path);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      return this.handleResponse<T>(response);
    } catch (err: any) {
      return { ok: false, status: 502, error: err?.message || 'Server proxy error' };
    }
  }

  /**
   * Server-side proxy POST with auth header forwarding.
   */
  async proxyPost<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ProxyResult<T>> {
    const url = this.resolveServerUrl(path);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (err: any) {
      return { ok: false, status: 502, error: err?.message || 'Server proxy error' };
    }
  }

  /**
   * Server-side proxy PUT with auth header forwarding.
   */
  async proxyPut<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ProxyResult<T>> {
    const url = this.resolveServerUrl(path);
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (err: any) {
      return { ok: false, status: 502, error: err?.message || 'Server proxy error' };
    }
  }

  /**
   * Server-side proxy PATCH with auth header forwarding.
   */
  async proxyPatch<T = any>(path: string, body?: any, headers?: Record<string, string>): Promise<ProxyResult<T>> {
    const url = this.resolveServerUrl(path);
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return this.handleResponse<T>(response);
    } catch (err: any) {
      return { ok: false, status: 502, error: err?.message || 'Server proxy error' };
    }
  }

  /**
   * Server-side proxy DELETE with auth header forwarding.
   */
  async proxyDelete<T = any>(path: string, headers?: Record<string, string>): Promise<ProxyResult<T>> {
    const url = this.resolveServerUrl(path);
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
      });
      return this.handleResponse<T>(response);
    } catch (err: any) {
      return { ok: false, status: 502, error: err?.message || 'Server proxy error' };
    }
  }

  private async handleResponse<T>(response: Response): Promise<ProxyResult<T>> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { ok: false, status: response.status, error: errorText };
    }
    const data = await response.json().catch(() => null);
    return { ok: true, status: response.status, data };
  }
}
