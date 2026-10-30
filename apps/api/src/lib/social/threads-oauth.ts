/**
 * Threads OAuth leg — separate token lifecycle from the FB user token.
 *
 * Spec: SOCIAL_POSTING_SUITE_SPEC.md §4.0
 * Authorize at threads.net/oauth/authorize → exchange at
 * graph.threads.net/oauth/access_token (1h) → th_exchange_token (60d) →
 * th_refresh_token (metaTokenRefresh job). Same Meta app credentials as the
 * commerce flow; the Threads use case must be enabled on the app.
 *
 * Build-time note: if the Meta app is configured for Facebook Login for
 * Business covering threads_* scopes, this leg can be replaced by a
 * scope-extended META_SCOPES grant — the surface-row token shape is identical.
 */

import { logger } from '../../logger';

const META_APP_ID = process.env.META_APP_ID || '';
const META_APP_SECRET = process.env.META_APP_SECRET || '';
const THREADS_REDIRECT_URI = process.env.META_THREADS_REDIRECT_URI || process.env.META_REDIRECT_URI || '';

const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';
const THREADS_GRAPH = 'https://graph.threads.net/v1.0';

export const THREADS_SCOPES = ['threads_basic', 'threads_content_publish'];

export function getThreadsAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: THREADS_REDIRECT_URI,
    response_type: 'code',
    scope: THREADS_SCOPES.join(','),
    state,
  });
  return `${THREADS_AUTH_URL}?${params.toString()}`;
}

/** code → short-lived token (~1h) + threads user id. */
export async function exchangeThreadsCode(code: string): Promise<{ access_token: string; user_id: string } | null> {
  try {
    const res = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: THREADS_REDIRECT_URI,
        code,
      }),
    });
    if (!res.ok) {
      logger.error('[Threads OAuth] code exchange failed:', undefined, { error: { name: 'Error', message: await res.text() } });
      return null;
    }
    return await res.json() as { access_token: string; user_id: string };
  } catch (error) {
    logger.error('[Threads OAuth] exchange error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/** short token → 60-day long-lived token. */
export async function getThreadsLongLivedToken(shortToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'th_exchange_token',
      client_secret: META_APP_SECRET,
      access_token: shortToken,
    });
    const res = await fetch(`${THREADS_GRAPH}/access_token?${params}`);
    if (!res.ok) return null;
    return await res.json() as { access_token: string; expires_in: number };
  } catch {
    return null;
  }
}

/** Refresh a 60-day token (valid once the token is ≥24h old). */
export async function refreshThreadsToken(longLivedToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'th_refresh_token',
      access_token: longLivedToken,
    });
    const res = await fetch(`${THREADS_GRAPH}/refresh_access_token?${params}`);
    if (!res.ok) return null;
    return await res.json() as { access_token: string; expires_in: number };
  } catch {
    return null;
  }
}

/** Threads profile for the authorized user (must be public to publish). */
export async function getThreadsProfile(accessToken: string): Promise<{ id: string; username?: string; threads_profile_picture_url?: string } | null> {
  try {
    const params = new URLSearchParams({
      fields: 'id,username,threads_profile_picture_url',
      access_token: accessToken,
    });
    const res = await fetch(`${THREADS_GRAPH}/me?${params}`);
    if (!res.ok) return null;
    return await res.json() as { id: string; username?: string; threads_profile_picture_url?: string };
  } catch {
    return null;
  }
}
