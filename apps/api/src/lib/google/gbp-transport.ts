/**
 * GBP transport seam — the single place the platform talks to Google Business Profile.
 *
 * Why this exists: the Business Profile APIs are not public. A Google Cloud project
 * has 0 QPM until Google allowlists it via the "Application for Basic API Access"
 * form, and Google ships **no sandbox** for these APIs ("There's no Sandbox
 * environment for the Business Profile APIs"; fake listings are moderated away).
 * So before approval every call fails with `429 RATE_LIMIT_EXCEEDED` +
 * `quota_limit_value: '0'`, and the whole connect → list → link → sync flow is
 * untestable end-to-end.
 *
 * Google's own advice in that situation is "use mock API responses". This module is
 * that: one seam, three modes, off by default.
 *
 *   GBP_TRANSPORT=live     (default) — real fetch. Zero behaviour change.
 *   GBP_TRANSPORT=fixture  — serve recorded JSON from GBP_FIXTURE_DIR. Never
 *                            touches Google, so it works with quota 0.
 *   GBP_TRANSPORT=record   — passthrough to Google AND write each response into
 *                            GBP_FIXTURE_DIR, so fixtures can be refreshed from a
 *                            real (approved) account.
 *
 * A fixture miss is a loud 501, never a silent fall-through to Google: in fixture
 * mode you must always be able to tell what came from the harness.
 *
 * This module also owns the Google hostnames. Call sites build URLs from the
 * exported base constants and send them through `gbpFetch`, so `gbp-transport.ts`
 * is the only file in `src/` that names a mybusiness host — enforced by
 * `gbp-transport.guard.test.ts`. That guard is what stops a new call site from
 * silently bypassing fixtures (and re-introducing the quota error in dev).
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../logger';

// ─── Hosts ──────────────────────────────────────────────────────────────

/** My Business Business Information API (v1) — locations, categories, attributes. */
export const GBP_BUSINESS_INFORMATION_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

/** My Business Account Management API (v1) — accounts, location groups. */
export const GBP_ACCOUNT_MANAGEMENT_BASE = 'https://mybusinessaccountmanagement.googleapis.com/v1';

/** Legacy My Business API (v4) — media, reviews, posts, insights, verifications. */
export const GBP_V4_BASE = 'https://mybusiness.googleapis.com/v4';

/** Every host the transport intercepts. Kept as data so the guard test can assert on it. */
export const GBP_API_HOSTS = [
  'mybusinessbusinessinformation.googleapis.com',
  'mybusinessaccountmanagement.googleapis.com',
  'mybusiness.googleapis.com',
] as const;

/**
 * True for the Business Profile *API* hosts.
 *
 * Deliberately excludes the upload/CDN hosts the media flow PUTs bytes to: those
 * are storage endpoints, not API calls, so `gbpFetch` passes them straight through
 * instead of demanding a fixture for every uploaded byte range.
 */
export function isGbpApiHost(host: string): boolean {
  return (GBP_API_HOSTS as readonly string[]).includes(host);
}

// ─── Mode resolution ────────────────────────────────────────────────────

export type GbpTransportMode = 'live' | 'fixture' | 'record';

/**
 * Read the mode per call rather than snapshotting it at module load.
 * `unifiedConfig` copies `process.env` in its constructor, which makes it the wrong
 * shape for a toggle a developer flips mid-process — and untestable without a
 * separate setter. Reading here keeps the seam testable with a plain env assignment.
 */
export function gbpTransportMode(): GbpTransportMode {
  const raw = String(process.env.GBP_TRANSPORT || 'live').trim().toLowerCase();
  return raw === 'fixture' || raw === 'record' ? raw : 'live';
}

/**
 * Fixture directory. Defaults to the `approved` profile — the happy path — so
 * `GBP_TRANSPORT=fixture` alone is enough to exercise the real flow. Point it at
 * `fixtures/gbp/pending` to reproduce today's live `api_not_approved` 503 instead.
 *
 * Resolved from `__dirname` so it works identically under tsx (`src/lib/google`)
 * and the compiled build (`dist/lib/google`) — both land on `apps/api/fixtures/gbp`.
 */
export function gbpFixtureDir(): string {
  const configured = process.env.GBP_FIXTURE_DIR;
  if (configured && configured.trim()) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);
  }
  return path.resolve(__dirname, '../../../fixtures/gbp/approved');
}

/** Refuse to serve fixtures in a real production process — see module docstring. */
function assertFixtureModeAllowed(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (String(process.env.GBP_FIXTURE_ALLOW_PROD || '').toLowerCase() === 'true') return;
  throw new Error(
    'GBP_TRANSPORT=fixture is refused under NODE_ENV=production. ' +
      'Set GBP_FIXTURE_ALLOW_PROD=true only if you are deliberately running a staging process with NODE_ENV=production.'
  );
}

// ─── Fixture matching ───────────────────────────────────────────────────

interface GbpFixture {
  /** Human label used in logs. Defaults to the filename. */
  name: string;
  match: {
    method?: string;
    host?: string;
    /** Glob against the URL pathname. `*` = one segment, `**` = any. */
    path: string;
    /** Optional substring that must appear in the query string. */
    queryIncludes?: string;
  };
  status?: number;
  body: unknown;
}

let fixtureCache: { dir: string; fixtures: GbpFixture[] } | null = null;

function loadFixtures(dir: string): GbpFixture[] {
  if (fixtureCache && fixtureCache.dir === dir) return fixtureCache.fixtures;

  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    throw new Error(
      `GBP_TRANSPORT=fixture but no fixture directory at ${dir}. ` +
        'Create it, or point GBP_FIXTURE_DIR at one.'
    );
  }

  const fixtures: GbpFixture[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    let parsed: GbpFixture;
    try {
      parsed = JSON.parse(raw) as GbpFixture;
    } catch (error) {
      throw new Error(`GBP fixture ${file} is not valid JSON: ${(error as Error).message}`);
    }
    if (!parsed?.match?.path) {
      throw new Error(`GBP fixture ${file} is missing match.path`);
    }
    fixtures.push({ ...parsed, name: parsed.name || file });
  }

  fixtureCache = { dir, fixtures };
  return fixtures;
}

/** Clear the fixture cache. Test seam, mirroring `clearCorsOriginCache()`. */
export function clearGbpFixtureCache(): void {
  fixtureCache = null;
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${pattern}$`);
}

function matchFixture(
  fixtures: GbpFixture[],
  method: string,
  host: string,
  pathname: string,
  search: string
): GbpFixture | null {
  const hits = fixtures.filter((f) => {
    if (f.match.method && f.match.method.toUpperCase() !== method) return false;
    if (f.match.host && f.match.host !== host) return false;
    if (f.match.queryIncludes && !search.includes(f.match.queryIncludes)) return false;
    return globToRegExp(f.match.path).test(pathname);
  });

  if (hits.length > 1) {
    // Ambiguity means the fixture set is wrong — fail rather than let file order decide.
    throw new Error(
      `GBP fixtures are ambiguous for ${method} ${host}${pathname}: ` +
        hits.map((h) => h.name).join(', ')
    );
  }
  return hits[0] ?? null;
}

// ─── Request normalisation ──────────────────────────────────────────────

function toUrl(input: string | URL | Request): URL {
  if (typeof input === 'string') return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

function toRequestInit(input: string | URL | Request, init?: RequestInit): RequestInit {
  if (init) return init;
  if (typeof input === 'string' || input instanceof URL) return {};
  return input;
}

// ─── Record mode ────────────────────────────────────────────────────────

function recordFixture(dir: string, url: URL, method: string, status: number, body: string): void {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const slug = `${method.toLowerCase()}-${url.pathname.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
    const file = path.join(dir, `${slug}.json`);
    // Never overwrite: recorded fixtures are hand-reviewed before they replace authored ones.
    if (fs.existsSync(file)) return;

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(body);
    } catch {
      parsedBody = { _raw: body };
    }

    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          name: `Recorded from ${method} ${url.pathname}`,
          match: { method, host: url.host, path: url.pathname },
          status,
          body: parsedBody,
        },
        null,
        2
      ) + '\n'
    );
    logger.info(`[GBPTransport] Recorded fixture ${file}`);
  } catch (error) {
    logger.warn('[GBPTransport] Failed to record fixture', undefined, {
      error: { name: (error as Error)?.name || 'Error', message: String(error) },
    });
  }
}

// ─── The seam ───────────────────────────────────────────────────────────

/**
 * Send a request to a Google Business Profile endpoint.
 *
 * Interception is scoped to the three Business Profile API hosts; anything else
 * (upload references, CDNs) is passed straight through in every mode.
 *
 * In `live` mode this is a transparent passthrough to the global `fetch` — note it
 * is resolved at call time, not captured, so the existing tests that do
 * `global.fetch = mockFetch` keep intercepting exactly as they did before.
 */
export async function gbpFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const mode = gbpTransportMode();

  // Live is a pure passthrough — no URL parsing, so a non-absolute input behaves
  // exactly as it did before this seam existed.
  if (mode === 'live') {
    return fetch(input as any, init as any);
  }

  const url = toUrl(input);

  if (mode === 'fixture') {
    // Non-API hosts (media upload references) are storage endpoints — pass them
    // through rather than forcing a fixture for every byte range.
    if (!isGbpApiHost(url.host)) {
      return fetch(input as any, init as any);
    }

    assertFixtureModeAllowed();

    const dir = gbpFixtureDir();
    const fixtures = loadFixtures(dir);
    const method = String(toRequestInit(input, init).method || 'GET').toUpperCase();
    const hit = matchFixture(fixtures, method, url.host, url.pathname, url.search);

    if (!hit) {
      // Loud, and never a fall-through to Google — a silent passthrough here would
      // surface as the very quota error the fixture mode exists to avoid.
      logger.warn(
        `[GBPTransport] No fixture for ${method} ${url.host}${url.pathname} in ${dir} — returning 501. ` +
          'Add a fixture to continue.'
      );
      return jsonResponse(501, {
        error: {
          code: 501,
          status: 'FIXTURE_MISSING',
          message: `No GBP fixture for ${method} ${url.host}${url.pathname}`,
          fixtureDir: dir,
        },
      });
    }

    return jsonResponse(hit.status ?? 200, hit.body);
  }

  // record: hit Google for real, then capture the response for later use.
  const response = await fetch(input as any, init as any);
  if (!isGbpApiHost(url.host)) return response;

  const dir = gbpFixtureDir();
  const method = String(toRequestInit(input, init).method || 'GET').toUpperCase();
  const body = await response.clone().text();
  recordFixture(dir, url, method, response.status, body);
  return response;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
