/**
 * GBP transport seam tests.
 *
 * Covers the fixture harness that lets the Business Profile flow run end-to-end
 * while Google's project quota is still 0 QPM, plus the guard that keeps future
 * call sites from bypassing it.
 *
 * Spec context: `docs/GOOGLE_READINESS_SPRINT_PLAN.md` §0.6 — GBP API access is
 * gated on Google's allowlisting, and Google ships no sandbox for these APIs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  gbpFetch,
  gbpTransportMode,
  gbpFixtureDir,
  clearGbpFixtureCache,
  isGbpApiHost,
  GBP_BUSINESS_INFORMATION_BASE,
  GBP_ACCOUNT_MANAGEMENT_BASE,
  GBP_V4_BASE,
} from '../gbp-transport';

const ACCOUNTS_URL = `${GBP_ACCOUNT_MANAGEMENT_BASE}/accounts`;
const LOCATIONS_URL = `${GBP_BUSINESS_INFORMATION_BASE}/accounts/123/locations?readMask=name`;

let tempDir: string;
let originalFetch: typeof globalThis.fetch;

function writeFixture(dir: string, file: string, fixture: unknown): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(fixture));
}

/** A stand-in for the real global fetch, so passthrough is observable. */
function stubGlobalFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  (globalThis as unknown as { fetch: unknown }).fetch = fn;
  return fn;
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gbp-fixtures-'));
  delete process.env.GBP_TRANSPORT;
  delete process.env.GBP_FIXTURE_DIR;
  delete process.env.GBP_FIXTURE_ALLOW_PROD;
  clearGbpFixtureCache();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.GBP_TRANSPORT;
  delete process.env.GBP_FIXTURE_DIR;
  delete process.env.GBP_FIXTURE_ALLOW_PROD;
  clearGbpFixtureCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ─── Mode resolution ────────────────────────────────────────────────────

describe('gbpTransportMode', () => {
  it('defaults to live', () => {
    expect(gbpTransportMode()).toBe('live');
  });

  it('accepts fixture and record, case-insensitively', () => {
    process.env.GBP_TRANSPORT = 'FIXTURE';
    expect(gbpTransportMode()).toBe('fixture');
    process.env.GBP_TRANSPORT = ' Record ';
    expect(gbpTransportMode()).toBe('record');
  });

  it('treats an unknown value as live rather than throwing', () => {
    process.env.GBP_TRANSPORT = 'banana';
    expect(gbpTransportMode()).toBe('live');
  });
});

describe('isGbpApiHost', () => {
  it('recognises the three API hosts', () => {
    expect(isGbpApiHost('mybusinessaccountmanagement.googleapis.com')).toBe(true);
    expect(isGbpApiHost('mybusinessbusinessinformation.googleapis.com')).toBe(true);
    expect(isGbpApiHost('mybusiness.googleapis.com')).toBe(true);
  });

  it('rejects the media upload/CDN hosts', () => {
    expect(isGbpApiHost('mybusiness.googleusercontent.com')).toBe(false);
    expect(isGbpApiHost('shoppingcontent.googleapis.com')).toBe(false);
  });
});

// ─── Live mode ──────────────────────────────────────────────────────────

describe('live mode', () => {
  it('passes straight through to the global fetch', async () => {
    const expected = new Response('{"accounts":[]}', { status: 200 });
    const mock = stubGlobalFetch(expected);

    const response = await gbpFetch(ACCOUNTS_URL);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(response).toBe(expected);
  });

  it('forwards method and body untouched', async () => {
    const mock = stubGlobalFetch(new Response('{}', { status: 200 }));

    await gbpFetch(ACCOUNTS_URL, { method: 'PATCH', body: '{"title":"x"}' });

    expect(mock).toHaveBeenCalledWith(ACCOUNTS_URL, { method: 'PATCH', body: '{"title":"x"}' });
  });
});

// ─── Fixture mode ───────────────────────────────────────────────────────

describe('fixture mode', () => {
  beforeEach(() => {
    process.env.GBP_TRANSPORT = 'fixture';
    process.env.GBP_FIXTURE_DIR = tempDir;
  });

  it('serves a matching fixture without touching the network', async () => {
    writeFixture(tempDir, 'accounts.json', {
      match: { method: 'GET', path: '/v1/accounts' },
      status: 200,
      body: { accounts: [{ name: 'accounts/1' }] },
    });
    const mock = stubGlobalFetch(new Response('live!', { status: 200 }));

    const response = await gbpFetch(ACCOUNTS_URL);

    expect(mock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accounts: [{ name: 'accounts/1' }] });
  });

  it('matches a single-segment glob in the path', async () => {
    writeFixture(tempDir, 'locations.json', {
      match: { method: 'GET', path: '/v1/accounts/*/locations' },
      status: 200,
      body: { locations: [{ name: 'locations/9' }] },
    });

    const response = await gbpFetch(LOCATIONS_URL);

    await expect(response.json()).resolves.toEqual({ locations: [{ name: 'locations/9' }] });
  });

  it('does not let a glob span path segments', async () => {
    writeFixture(tempDir, 'accounts.json', {
      match: { method: 'GET', path: '/v1/accounts/*/locations' },
      status: 200,
      body: {},
    });

    const response = await gbpFetch(`${GBP_BUSINESS_INFORMATION_BASE}/accounts/1/2/locations`);

    expect(response.status).toBe(501);
  });

  it('honours the method, so a PATCH does not match a GET fixture', async () => {
    writeFixture(tempDir, 'read.json', {
      match: { method: 'GET', path: '/v1/accounts' },
      status: 200,
      body: { accounts: [] },
    });

    const response = await gbpFetch(ACCOUNTS_URL, { method: 'PATCH' });

    expect(response.status).toBe(501);
  });

  it('honours queryIncludes', async () => {
    writeFixture(tempDir, 'hours.json', {
      match: { method: 'PATCH', path: '/v1/locations/*', queryIncludes: 'updateMask=regularHours' },
      status: 200,
      body: { ok: true },
    });

    const hit = await gbpFetch(`${GBP_BUSINESS_INFORMATION_BASE}/locations/9?updateMask=regularHours`, {
      method: 'PATCH',
    });
    expect(hit.status).toBe(200);

    const miss = await gbpFetch(`${GBP_BUSINESS_INFORMATION_BASE}/locations/9?updateMask=title`, {
      method: 'PATCH',
    });
    expect(miss.status).toBe(501);
  });

  it('returns a loud 501 on a miss instead of falling through to Google', async () => {
    const mock = stubGlobalFetch(new Response('live!', { status: 200 }));

    const response = await gbpFetch(ACCOUNTS_URL);

    // The whole point: a miss must never reach Google, because reaching Google
    // is what surfaces the quota-0 error this mode exists to avoid.
    expect(mock).not.toHaveBeenCalled();
    expect(response.status).toBe(501);
    const body = await response.json() as { error: { status: string; fixtureDir: string } };
    expect(body.error.status).toBe('FIXTURE_MISSING');
    expect(body.error.fixtureDir).toBe(tempDir);
  });

  it('passes non-API hosts (media upload references) straight through', async () => {
    const uploadUrl = 'https://mybusiness.googleusercontent.com/upload/abc123';
    const mock = stubGlobalFetch(new Response('ok', { status: 200 }));

    const response = await gbpFetch(uploadUrl, { method: 'PUT', body: 'bytes' });

    expect(mock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it('throws when two fixtures match the same request', async () => {
    writeFixture(tempDir, 'a.json', { match: { path: '/v1/accounts' }, body: {} });
    writeFixture(tempDir, 'b.json', { match: { path: '/v1/accounts' }, body: {} });

    await expect(gbpFetch(ACCOUNTS_URL)).rejects.toThrow(/ambiguous/i);
  });

  it('names the fixture directory when the directory is missing', async () => {
    process.env.GBP_FIXTURE_DIR = path.join(tempDir, 'does-not-exist');

    await expect(gbpFetch(ACCOUNTS_URL)).rejects.toThrow(/no fixture directory/i);
  });

  it('refuses to serve fixtures in a production process', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(gbpFetch(ACCOUNTS_URL)).rejects.toThrow(/refused under NODE_ENV=production/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it('allows production when explicitly overridden', async () => {
    writeFixture(tempDir, 'accounts.json', {
      match: { method: 'GET', path: '/v1/accounts' },
      status: 200,
      body: { accounts: [] },
    });
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.GBP_FIXTURE_ALLOW_PROD = 'true';
    try {
      const response = await gbpFetch(ACCOUNTS_URL);
      expect(response.status).toBe(200);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

// ─── The committed fixtures ─────────────────────────────────────────────

describe('committed fixture profiles', () => {
  beforeEach(() => {
    process.env.GBP_TRANSPORT = 'fixture';
    // Default dir resolution (no GBP_FIXTURE_DIR) — exercises the real path.
    delete process.env.GBP_FIXTURE_DIR;
    clearGbpFixtureCache();
  });

  it('resolves the approved profile by default', async () => {
    const response = await gbpFetch(ACCOUNTS_URL);
    expect(response.status).toBe(200);
    const body = await response.json() as { accounts: Array<{ name: string }> };
    expect(body.accounts[0].name).toMatch(/^accounts\//);
  });

  it('drives the locations read the link-location flow depends on', async () => {
    const accounts = await (await gbpFetch(ACCOUNTS_URL)).json() as { accounts: Array<{ name: string }> };
    const accountName = accounts.accounts[0].name;

    const response = await gbpFetch(`${GBP_BUSINESS_INFORMATION_BASE}/${accountName}/locations`);

    expect(response.status).toBe(200);
    const body = await response.json() as { locations: Array<{ title: string; metadata: { hasVoiceOfMerchant: boolean } }> };
    expect(body.locations[0].title).toBeTruthy();
    expect(body.locations[0].metadata.hasVoiceOfMerchant).toBe(true);
  });

  it('reproduces the live quota-0 error from the pending profile', async () => {
    process.env.GBP_FIXTURE_DIR = path.resolve(__dirname, '../../../../fixtures/gbp/pending');
    clearGbpFixtureCache();

    const response = await gbpFetch(ACCOUNTS_URL);

    expect(response.status).toBe(429);
    const body = await response.json() as {
      error: { code: number; details: Array<{ reason: string; metadata: { quota_limit_value: string } }> };
    };
    // Exactly the shape google-business-oauth.ts keys off to emit its 503.
    expect(body.error.code).toBe(429);
    expect(body.error.details[0].reason).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.details[0].metadata.quota_limit_value).toBe('0');
  });
});

describe('gbpFixtureDir', () => {
  it('resolves to apps/api/fixtures/gbp/approved by default', () => {
    expect(gbpFixtureDir()).toBe(path.resolve(__dirname, '../../../../fixtures/gbp/approved'));
  });

  it('resolves a relative GBP_FIXTURE_DIR against cwd', () => {
    process.env.GBP_FIXTURE_DIR = 'some/relative/dir';
    expect(gbpFixtureDir()).toBe(path.resolve(process.cwd(), 'some/relative/dir'));
  });

  it('honours an absolute GBP_FIXTURE_DIR', () => {
    process.env.GBP_FIXTURE_DIR = tempDir;
    expect(gbpFixtureDir()).toBe(tempDir);
  });
});

// ─── Record mode ────────────────────────────────────────────────────────

describe('record mode', () => {
  beforeEach(() => {
    process.env.GBP_TRANSPORT = 'record';
    process.env.GBP_FIXTURE_DIR = tempDir;
  });

  it('passes through to Google and captures the response', async () => {
    stubGlobalFetch(new Response('{"accounts":[{"name":"accounts/1"}]}', { status: 200 }));

    const response = await gbpFetch(ACCOUNTS_URL);

    expect(response.status).toBe(200);
    const written = fs.readdirSync(tempDir).filter((f) => f.endsWith('.json'));
    expect(written).toHaveLength(1);

    const recorded = JSON.parse(fs.readFileSync(path.join(tempDir, written[0]), 'utf8'));
    expect(recorded.match).toMatchObject({
      method: 'GET',
      host: 'mybusinessaccountmanagement.googleapis.com',
      path: '/v1/accounts',
    });
    expect(recorded.body).toEqual({ accounts: [{ name: 'accounts/1' }] });
  });

  it('never overwrites an existing fixture', async () => {
    writeFixture(tempDir, 'get-v1-accounts.json', { match: { path: '/v1/accounts' }, body: { hand: 'authored' } });
    stubGlobalFetch(new Response('{"accounts":[]}', { status: 200 }));

    await gbpFetch(ACCOUNTS_URL);

    const recorded = JSON.parse(fs.readFileSync(path.join(tempDir, 'get-v1-accounts.json'), 'utf8'));
    expect(recorded.body).toEqual({ hand: 'authored' });
  });

  it('does not record non-API hosts', async () => {
    stubGlobalFetch(new Response('bytes', { status: 200 }));

    await gbpFetch('https://mybusiness.googleusercontent.com/upload/abc', { method: 'PUT' });

    expect(fs.readdirSync(tempDir)).toHaveLength(0);
  });
});

// ─── Host guard ─────────────────────────────────────────────────────────

describe('GBP host guard', () => {
  /**
   * The seam only works if every call site goes through it. A new `fetch(` with a
   * hardcoded mybusiness URL would silently bypass fixtures — and in dev that
   * surfaces as the quota-0 error, which is the exact failure this harness exists
   * to remove. So: `gbp-transport.ts` is the only file allowed to name these hosts.
   */
  const SRC_ROOT = path.resolve(__dirname, '../../..');
  const ALLOWED = path.join(SRC_ROOT, 'lib', 'google', 'gbp-transport.ts');
  const HOST_PATTERN = /mybusiness(?:businessinformation|accountmanagement)?\.googleapis\.com/;

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === 'node_modules' || entry.name === '__tests__' ? [] : walk(full);
      }
      return entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')
        ? [full]
        : [];
    });
  }

  it('names a mybusiness host only in the transport module', () => {
    const offenders = walk(SRC_ROOT)
      .filter((file) => file !== ALLOWED)
      .filter((file) => HOST_PATTERN.test(fs.readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });

  it('exports the base constants call sites are expected to use', () => {
    expect(GBP_BUSINESS_INFORMATION_BASE).toContain('mybusinessbusinessinformation.googleapis.com');
    expect(GBP_ACCOUNT_MANAGEMENT_BASE).toContain('mybusinessaccountmanagement.googleapis.com');
    expect(GBP_V4_BASE).toContain('mybusiness.googleapis.com');
  });
});
