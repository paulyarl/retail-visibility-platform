/**
 * MarketingOpsService — admin calls must go through the AdminApiSingleton
 *
 * Regression: ~38 methods (cascade, signals/triage, playbooks, checklist,
 * project plan) called `fetch` directly with only `credentials: 'include'`.
 * A bare fetch never picks up the AdminApiSingleton's identity headers, so
 * those calls authenticated only by the incidental non-httpOnly `auth0_email`
 * marker cookie instead of the documented `x-auth0-id` / `x-auth0-email`
 * bridge the API's `authenticateToken` actually reads.
 *
 * These tests pin the routing (every call reaches the network through
 * `makeDefaultRequest`) and the header contract (the request that leaves the
 * singleton carries the Auth0 identity + admin context headers). See
 * `.devin/skills/deploy-service-extending-base-singleton.md` rule 2.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import marketingOpsService from './MarketingOpsService';

const BASE_URL = '/api/admin/marketing-ops';

/** Stub global fetch and capture the single request the singleton issues. */
function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown) => {
      calls.push({ url: String(url), init: (init as RequestInit) ?? {} });
      return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
  return calls;
}

describe('MarketingOpsService — converted methods route through makeDefaultRequest', () => {
  const service = marketingOpsService as any;

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  const cases: Array<{
    name: string;
    run: () => Promise<unknown>;
    url: string;
    method?: string;
  }> = [
    { name: 'listSignals', run: () => service.listSignals(), url: `${BASE_URL}/signals` },
    {
      name: 'getCascadeStatus',
      run: () => service.getCascadeStatus('mcamp-1'),
      url: `${BASE_URL}/mcamp-1/cascade/status`,
    },
    {
      name: 'enableCascade',
      run: () => service.enableCascade('mcamp-1', { steps: 2 }),
      url: `${BASE_URL}/mcamp-1/cascade/enable`,
      method: 'POST',
    },
    { name: 'listPlaybooks', run: () => service.listPlaybooks(), url: `${BASE_URL}/playbooks` },
    {
      name: 'deleteSignal',
      run: () => service.deleteSignal('sig-1'),
      url: `${BASE_URL}/signals/sig-1`,
      method: 'DELETE',
    },
    {
      name: 'getCampaignChecklist',
      run: () => service.getCampaignChecklist('mcamp-1'),
      url: `${BASE_URL}/mcamp-1/checklist`,
    },
    {
      name: 'getProjectPlan',
      run: () => service.getProjectPlan('mprospect-1'),
      url: `${BASE_URL}/prospects/mprospect-1/project-plan`,
    },
  ];

  it.each(cases)('$name goes through makeDefaultRequest, not bare fetch', async ({ run, url, method }) => {
    const request = vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: { ok: true } },
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await run();

    expect(request).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = request.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(url);
    expect((options?.method ?? 'GET').toUpperCase()).toBe(method ?? 'GET');
    // The whole point of the conversion: nothing reaches the network unauthenticated.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('unwraps the { success, data } envelope like the rest of the service', async () => {
    vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: true,
      data: { success: true, data: { id: 'sig-1' } },
    });

    await expect(service.createSignal({ code: 'X', family: 'f', label: 'l' })).resolves.toEqual({
      id: 'sig-1',
    });
  });

  it('surfaces the API error message on failure', async () => {
    vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: false,
      error: { status: 400, message: 'playbook code already taken', code: 'invalid_input' },
    });

    await expect(service.createPlaybook({} as any)).rejects.toThrow('playbook code already taken');
  });

  it('treats a 404 triage lookup as "no triage yet" rather than an error', async () => {
    vi.spyOn(service, 'makeDefaultRequest').mockResolvedValue({
      success: false,
      error: { status: 404, message: 'not found', code: 'not_found' },
    });

    await expect(service.getTriage('mcamp-1')).resolves.toBeNull();
  });

  it('declares no direct fetch() call anywhere in the service source', () => {
    const source = readFileSync(path.join(__dirname, 'MarketingOpsService.ts'), 'utf8');
    // `makeDefaultRequest` is the only sanctioned egress; a bare `fetch(` means
    // a call that bypasses the singleton's auth + cache handling.
    expect(source).not.toMatch(/(?<![.\w])fetch\s*\(/);
  });
});

describe('MarketingOpsService — singleton attaches the Auth0 identity + admin headers', () => {
  const service = marketingOpsService as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    // Auth0's SDK sets these non-httpOnly marker cookies at login; the base
    // class reads them to build the x-auth0-* headers.
    (globalThis as any).document = {
      cookie: 'auth0_id=google-oauth2|101197082777619041667; auth0_email=operator@example.com',
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).document;
  });

  it('sends x-auth0-id / x-auth0-email and the admin context headers', async () => {
    const calls = captureFetch();

    await service.getCascadeStatus('mcamp-1');

    expect(calls).toHaveLength(1);
    const headers = new Headers(calls[0].init.headers as HeadersInit);
    expect(headers.get('x-auth0-id')).toBe('google-oauth2|101197082777619041667');
    expect(headers.get('x-auth0-email')).toBe('operator@example.com');
    expect(headers.get('x-request-context')).toBe('admin');
    expect(headers.get('x-admin-roles')).toBe('PLATFORM_ADMIN');
    expect(headers.get('x-audit-id')).toMatch(/^admin_/);
    expect(calls[0].init.credentials).toBe('include');
  });
});
