/**
 * Shared two-step container publish for IG + Threads.
 *
 * Both APIs: create container → poll status → publish.
 * IG:      POST /{ig-user}/media          → POST /{ig-user}/media_publish
 * Threads: POST /{threads-user}/threads   → POST /{threads-user}/threads_publish
 * Meta recommends ~30s before publish; containers expire — poll max 5min.
 */

import type { PublishResult } from './types';

const POLL_INTERVAL_MS = 10_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

interface GraphCall {
  ok: boolean;
  status: number;
  json: any;
  retryAfterMs?: number;
}

export async function graphJson(
  base: string,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  token: string,
  body?: Record<string, unknown>,
): Promise<GraphCall> {
  const url = `${base}${path}${method === 'GET' ? `?${new URLSearchParams({ ...(body as any), access_token: token })}` : ''}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method !== 'GET' ? { body: JSON.stringify({ ...body, access_token: token }) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  const retryAfter = res.headers.get('Retry-After');
  return { ok: res.ok, status: res.status, json, retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : undefined };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Poll a container until FINISHED / ERROR / EXPIRED / timeout. */
export async function waitForContainer(
  base: string,
  containerId: string,
  token: string,
): Promise<{ ready: boolean; error?: string }> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const r = await graphJson(base, `/${containerId}`, 'GET', token, { fields: 'status,error_message' });
    const status = r.json?.status;
    if (status === 'FINISHED' || status === 'PUBLISHED') return { ready: true };
    if (status === 'ERROR' || status === 'EXPIRED') {
      return { ready: false, error: r.json?.error_message || `container ${status}` };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return { ready: false, error: 'container processing timed out' };
}

/** create container → wait → publish. `publishPath` e.g. /{ig}/media_publish. */
export async function publishContainer(
  base: string,
  containerIds: string[],
  publishPath: string,
  token: string,
  remoteIdField = 'id',
): Promise<PublishResult> {
  for (const id of containerIds) {
    const wait = await waitForContainer(base, id, token);
    if (!wait.ready) return { success: false, error: wait.error };
  }
  const r = await graphJson(base, publishPath, 'POST', token, { creation_id: containerIds.join(',') });
  if (!r.ok) return { success: false, error: `API error: ${r.status}`, status: r.status, retryAfterMs: r.retryAfterMs };
  return { success: true, remoteId: r.json?.[remoteIdField] ? String(r.json[remoteIdField]) : undefined };
}
