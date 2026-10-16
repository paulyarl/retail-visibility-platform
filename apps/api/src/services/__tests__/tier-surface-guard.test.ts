/**
 * Tier contract — Phase 4.4, the static guard.
 *
 * Two directions:
 *
 *   A) SWEEP — scan apps.api/src and apps.web/src for declaration markers of contract structures
 *      (tier orders, hierarchy maps, pricing/display maps, limit maps, trial
 *      maps, gate-level bands). Every file carrying one MUST be listed in the
 *      fixture's `surface_files` inventory — a NEW copy appearing anywhere is a
 *      test failure, not a silent eleventh copy. `.bak` files are excluded by
 *      pattern (0.6 ruling — the 496-file shadow tree is a separate decision).
 *
 *   B) MANIFEST — every file listed in `surface_files` must still exist and
 *      `asserted` files must still declare at least one marker (a refactor that
 *      removes the map must also update the inventory, or the guard fails).
 *
 *   C) STATIC PINS — runtime-importable surfaces are pinned in their own
 *      suites; the page/component/service maps that are fragile under vitest
 *      get their key sets extracted from SOURCE here and checked against the
 *      contract universe + relative order. Extraction is a declaration-level
 *      parse, not a regex guess: brace-balanced from `export const NAME =`.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 4.4.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import contract from '../../../../../shared/tier-contract.json';

const ROOT = path.resolve(process.cwd(), '../..'); // apps/api → repo root
const SCAN_DIRS = ['apps/api/src', 'apps/web/src'];

// Declaration-level markers: a file matching ANY of these is a contract surface.
const MARKERS: RegExp[] = [
  /\b(?:export\s+)?(?:const|let|var|function|private static)\s+\w*(?:TIER_ORDER|TIER_HIERARCHY|TIER_FEATURES|FEATURE_TIER_MAP|TIER_PRICING|TIER_DISPLAY_NAMES|TIER_LIMITS|TIER_UPGRADE_PATHS|TIER_LEVELS|TIER_BADGE_CLASSES|TRIAL_BASE_TIERS|TRIAL_ELIGIBLE_TIERS|TIER_FEATURES)\w*\s*[:=({]/,
  /\b(?:export\s+)?(?:const|let|var)\s+(?:ORG_TIER_ORDER|CATALOG_TIER_ORDER|CAPABILITY_TIER_SORT_ORDER|FALLBACK_TIER_ORDER|FEATURE_GATE_TIER_LEVELS|IMAGE_SEARCH_TIER_LIMITS|TRASH_TIER_LIMITS|LANDING_PAGE_TIER_FEATURES|QR_TIER_FEATURES|ECOMMERCE_TIER_FEATURES|DEFAULT_TIER)\s*[:=]/,
  /\b(?:const|let|var|function)\s+(?:tierIndex|mapTierLevel|getBaseTierForTrial|tierOrder|tierHierarchy)\b/,
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx') && !entry.endsWith('.bak')) {
      yield full;
    }
  }
}

const rel = (abs: string) => path.relative(ROOT, abs).split(path.sep).join('/');

const SURFACE = contract.surface_files as {
  asserted: Record<string, string>;
  covered: Record<string, string>;
  derived: Record<string, string>;
  documented: Record<string, string>;
  exempt: Record<string, string>;
};
const bucketKeys = (bucket: Record<string, string>) =>
  Object.keys(bucket).filter((k) => !k.startsWith('$'));
const LISTED = new Set([
  ...bucketKeys(SURFACE.asserted),
  ...bucketKeys(SURFACE.covered),
  ...bucketKeys(SURFACE.derived),
  ...bucketKeys(SURFACE.documented),
  ...bucketKeys(SURFACE.exempt),
]);

function fileMarkers(source: string): string[] {
  return MARKERS.filter((m) => m.test(source)).map((m) => m.source.slice(0, 40));
}

/**
 * Extract the declared keys of an `export const NAME = { ... }` object or
 * `= [...]` array from source text — brace-balanced, string-literal-aware.
 * Returns the top-level keys (object) or all string literals (arrays).
 */
function extractDeclared(source: string, name: string): string[] {
  const start = source.search(new RegExp(`\\b${name}\\s*[:=]`));
  if (start === -1) return [];
  // find the opening bracket after the '='
  const eq = source.indexOf('=', start);
  const openIdx = source.slice(eq).search(/[{[]/) + eq;
  const open = source[openIdx];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let i = openIdx;
  let inStr: string | null = null;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inStr) {
      if (ch === inStr && source[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) break; }
  }
  const body = source.slice(openIdx + 1, i);
  if (open === '[') {
    return [...body.matchAll(/['"]([a-z_]+)['"]/g)].map((m) => m[1]);
  }
  // top-level object keys only (depth-1 `key:` tokens)
  const keys: string[] = [];
  let d = 0; let s: string | null = null;
  for (let j = 0; j < body.length; j++) {
    const ch = body[j];
    if (s) { if (ch === s && body[j - 1] !== '\\') s = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { s = ch; continue; }
    if (ch === '{' || ch === '[') { d++; continue; }
    if (ch === '}' || ch === ']') { d--; continue; }
    if (d === 0) {
      const m = body.slice(j).match(/^([A-Za-z_$][\w$]*|'[^']+'|"[^"]+")\s*:/);
      if (m) { keys.push(m[1].replace(/^['"]|['"]$/g, '')); j += m[0].length - 1; }
    }
  }
  return keys;
}

const CONTRACT_KEYS = new Set([
  ...(contract.tier_order as string[]),
  ...(contract.tier_classes.pseudo_tiers as string[]),
]);

describe('4.4 guard — sweep: every declaration-marker file is inventoried', () => {
  const hits = new Map<string, string[]>();
  for (const dir of SCAN_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const source = readFileSync(file, 'utf8');
      const markers = fileMarkers(source);
      if (markers.length > 0) hits.set(rel(file), markers);
    }
  }

  it('no unlisted file declares a contract structure', () => {
    const unlisted = [...hits.keys()].filter((f) => !LISTED.has(f));
    expect(
      unlisted,
      `contract-surface files missing from fixture surface_files:\n${unlisted.join('\n')}`,
    ).toEqual([]);
  });
});

describe('4.4 guard — manifest: the inventory stays honest', () => {
  it('every listed file exists', () => {
    const missing = [...LISTED].filter((f) => !existsSync(path.join(ROOT, f)));
    expect(missing, 'listed files that no longer exist').toEqual([]);
  });

  it('every asserted file still declares a contract marker', () => {
    const stale = bucketKeys(SURFACE.asserted).filter((f) => {
      const abs = path.join(ROOT, f);
      if (!existsSync(abs) || /\.sql$/.test(f)) return false;
      return fileMarkers(readFileSync(abs, 'utf8')).length === 0;
    });
    expect(stale, 'asserted files with no marker found — update the inventory').toEqual([]);
  });
});

describe('4.4 guard — subset maps: keys ⊆ contract universe', () => {
  const SUBSET_MAPS: Array<[string, string]> = [
    ['apps/api/src/middleware/image-search-limits.ts', 'IMAGE_SEARCH_TIER_LIMITS'],
    ['apps/api/src/utils/trash-capacity.ts', 'TRASH_TIER_LIMITS'],
    ['apps/web/src/lib/features/FeatureGateSystem.ts', 'FEATURE_GATE_TIER_LEVELS'],
    ['apps/web/src/lib/landing-page-tiers.ts', 'LANDING_PAGE_TIER_FEATURES'],
    ['apps/web/src/lib/qr-tiers.ts', 'QR_TIER_FEATURES'],
    ['apps/web/src/components/tenants/types.ts', 'TENANT_TIER_DISPLAY_NAMES'],
  ];

  it.each(SUBSET_MAPS)('%s — %s keys are all contract tier keys', (file, name) => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    const keys = extractDeclared(source, name);
    expect(keys.length, `${name} not found in ${file}`).toBeGreaterThan(0);
    const unknown = keys.filter((k) => !CONTRACT_KEYS.has(k));
    expect(unknown, `${name} declares non-contract keys`).toEqual([]);
  });
});

describe('4.4 guard — order subsets keep fixture relative order', () => {
  const ORDER_SUBSETS: Array<[string, string]> = [
    ['apps/web/src/lib/growth-tips/orgTipEngine.ts', 'ORG_TIER_ORDER'],
  ];

  it.each(ORDER_SUBSETS)('%s — %s is fixture-order-consistent', (file, name) => {
    const source = readFileSync(path.join(ROOT, file), 'utf8');
    const keys = extractDeclared(source, name);
    const inFixture = (contract.tier_order as string[]).filter((k) => keys.includes(k));
    expect(keys, `${name} drifts from fixture order`).toEqual(inFixture);
  });

  it('TIER_UPGRADE_PATHS (TierFeaturesClient) — every rung is a contract key, each path is fixture-order-consistent', () => {
    const source = readFileSync(
      path.join(ROOT, 'apps/web/src/app/t/[tenantId]/settings/tier-features/TierFeaturesClient.tsx'),
      'utf8',
    );
    // string[][]: extract each inner path row separately.
    const rows = [...source.matchAll(/\[\s*'[^\]]+'\s*\]/g)].map((m) =>
      [...m[0].matchAll(/'([a-z_]+)'/g)].map((s) => s[1]),
    ).filter((r) => r.length > 1);
    expect(rows.length, 'no upgrade paths found').toBeGreaterThan(0);
    for (const row of rows) {
      for (const k of row) {
        expect(CONTRACT_KEYS.has(k), `${k} is not a contract tier`).toBe(true);
      }
      const inFixture = (contract.tier_order as string[]).filter((k) => row.includes(k));
      expect(row, `upgrade path ${row.join('→')} drifts from fixture order`).toEqual(inFixture);
    }
  });
});

describe('4.4 guard — FeatureGateSystem level bands (live-gate invariants)', () => {
  const source = readFileSync(path.join(ROOT, 'apps/web/src/lib/features/FeatureGateSystem.ts'), 'utf8');
  const levels = new Map(
    extractDeclared(source, 'FEATURE_GATE_TIER_LEVELS').map((k) => {
      const m = source.match(new RegExp(`${k}:\\s*(\\d+)`));
      return [k, m ? Number(m[1]) : NaN] as const;
    }),
  );
  const lvl = (k: string) => levels.get(k) ?? NaN;

  it('entry tiers sit at level 0 — no gated catalog features', () => {
    expect(lvl('directory_presence')).toBe(0);
    expect(lvl('presence')).toBe(0);
  });

  it('the fixed inversions hold: discovery ≥ starter, organization ≥ professional, enterprise ≥ organization', () => {
    expect(lvl('discovery')).toBeGreaterThanOrEqual(lvl('starter'));
    expect(lvl('organization')).toBeGreaterThanOrEqual(lvl('professional'));
    expect(lvl('enterprise')).toBeGreaterThanOrEqual(lvl('organization'));
  });

  it('chain tiers sit at-or-above their base bands', () => {
    expect(lvl('chain_starter')).toBeGreaterThanOrEqual(lvl('starter'));
    expect(lvl('chain_professional')).toBeGreaterThanOrEqual(lvl('professional'));
    expect(lvl('chain_enterprise')).toBeGreaterThanOrEqual(lvl('enterprise'));
  });
});

describe('4.4 guard — display-name subset agrees with canonical', () => {
  it('TENANT_TIER_DISPLAY_NAMES values match fixture display_names where present', () => {
    const source = readFileSync(path.join(ROOT, 'apps/web/src/components/tenants/types.ts'), 'utf8');
    // Scope to the map body — `discovery:` also appears in TIER_BADGE_CLASSES.
    const start = source.indexOf('TENANT_TIER_DISPLAY_NAMES');
    const body = source.slice(start, source.indexOf('};', start));
    const names = contract.display_names as Record<string, string>;
    for (const m of body.matchAll(/(\w+):\s*'([^']+)'/g)) {
      const [, k, v] = m;
      expect(v, `${k}: '${v}' vs canonical '${names[k]}'`).toBe(names[k]);
    }
  });
});
