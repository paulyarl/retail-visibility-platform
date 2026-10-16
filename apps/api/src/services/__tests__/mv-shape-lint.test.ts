/**
 * Tier contract — Phase 3.7(b): the MV's SQL is a second implementation of
 * the merge semantics, and it is where drift breeds — the repo's own history:
 * 14/18 flexible keys pattern-guessed wrong (090), dead vetoes + phantom
 * vetoes (332). This lint reads the LATEST migration that recreates
 * `mv_tenant_effective_capabilities` and pins its structural contract:
 *
 *   - `trial_map` exists and every mapped pair agrees with the fixture's
 *     `trial_map.canonical` (coverage gaps are recorded there, not hidden)
 *   - `flexible_key_map` looks flexible keys up via features_list — no
 *     `{cap}_flexible` string-guessing (the 090 defect class)
 *   - each flexible_*_features CTE excludes `%_disabled` AND `%_off`
 *     (expansion emits only non-negative keys — the 332 BUG-2 fix)
 *   - NO gate-key filter on the output — `NOT LIKE '%_disabled'` appears
 *     exactly once per flexible CTE and nowhere else (the 332 BUG-1 fix)
 *   - `override_features` requires `granted = true` (3.5 parity)
 *   - `purchase_features` statuses match the resolver's
 *     ['active','past_due','trial']
 *   - `tenant_type_gates` suppresses flexible expansion on 'disabled'
 *     (D7 veto parity — the MV does not expand a module the tier vetoed)
 *
 * It follows the newest `CREATE MATERIALIZED VIEW` migration automatically —
 * a later rebuild inherits this lint.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 3.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import contract from '../../../../../shared/tier-contract.json';

const MIGRATIONS_DIR = path.resolve(process.cwd(), '../../database/migrations');

/** The newest migration file that recreates the MV is the definition we lint. */
function latestMvMigration(): { file: string; sql: string } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const candidates = files
    .map((f) => ({ file: f, sql: readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }))
    .filter(({ sql }) => sql.includes('CREATE MATERIALIZED VIEW mv_tenant_effective_capabilities'));
  if (candidates.length === 0) {
    throw new Error('No migration creates mv_tenant_effective_capabilities — MV deleted?');
  }
  return candidates[candidates.length - 1];
}

const { file: MV_FILE, sql } = latestMvMigration();

const count = (haystack: string, needle: RegExp) => (haystack.match(needle) ?? []).length;

describe(`MV shape lint — ${MV_FILE}`, () => {
  it('trial_map exists and every pair agrees with the fixture canonical map', () => {
    const canonical = contract.trial_map.canonical as Record<string, string>;
    const pairs = [...sql.matchAll(/\('(trial_[a-z_]+)'\s*,\s*'([a-z_]+)'\)/g)].map(
      (m) => [m[1], m[2]] as const,
    );
    expect(pairs.length, 'trial_map CTE has no pairs').toBeGreaterThan(0);
    for (const [trial, baseKey] of pairs) {
      expect(
        canonical[trial],
        `MV maps ${trial} → ${baseKey}; canonical is '${canonical[trial] ?? 'unmapped'}'`,
      ).toBe(baseKey);
    }
    // Coverage note: the MV may carry FEWER keys than canonical (it lacks
    // trial_presence / trial_directory_presence / trial_organization today) —
    // agreement-where-mapped is the pin; coverage is the DB leg's job (0.2).
  });

  it('looks flexible keys up via flexible_key_map + features_list, not string-guessing', () => {
    expect(sql).toContain('flexible_key_map');
    expect(sql).toMatch(/fl\.key LIKE '%_flexible'/);
    expect(sql).not.toMatch(/'_flexible'|"_flexible"|'_enabled' \|\|/);
  });

  it('each flexible_*_features CTE excludes %_disabled and %_off', () => {
    const ctes = ['flexible_tier_features', 'flexible_purchase_features', 'flexible_override_features'];
    for (const cte of ctes) {
      const start = sql.indexOf(`${cte} AS (`);
      expect(start, `${cte} missing`).toBeGreaterThan(-1);
      const end = sql.indexOf('),', start);
      const body = sql.slice(start, end === -1 ? undefined : end);
      expect(body, `${cte} does not exclude %_disabled`).toMatch(/NOT LIKE '%\\_disabled'/);
      expect(body, `${cte} does not exclude %_off`).toMatch(/NOT LIKE '%\\_off'/);
    }
  });

  it('has NO gate-key filter on the output — the exclusions exist only inside expansion CTEs', () => {
    // Exactly 3 disabled/off exclusions: one per flexible CTE. More = a
    // gate-key filter crept back onto a source or the output (332 BUG 1).
    expect(count(sql, /NOT LIKE '%\\_disabled'/g)).toBe(3);
    expect(count(sql, /NOT LIKE '%\\_off'/g)).toBe(3);
  });

  it('override_features requires granted = true', () => {
    const start = sql.indexOf('override_features AS (');
    const end = sql.indexOf('),', start);
    expect(sql.slice(start, end), 'overrides not granted-filtered').toMatch(/granted = true/);
  });

  it('purchase_features matches the resolver status set', () => {
    const start = sql.indexOf('purchase_features AS (');
    const end = sql.indexOf('),', start);
    expect(sql.slice(start, end)).toMatch(/status IN \('active', 'past_due', 'trial'\)/);
  });

  it('tenant_type_gates suppresses flexible expansion on a disabled gate', () => {
    expect(sql).toContain('tenant_type_gates');
    expect(count(sql, /gate_status = 'disabled'/g)).toBe(3);
  });
});

/**
 * Phase 6.2 — D5's testable half: the MV staleness window is BOUNDED by a
 * committed schedule, not an operator ritual. The refresh job lived for
 * months as a comment-only snippet in migration 089 — a fresh env built
 * from migrations would serve a permanently stale view. 339 commits it.
 */
describe('MV refresh schedule is committed and guarded (D5)', () => {
  const JOB = 'refresh-mv_tenant_effective_capabilities';
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const cronMigrations = files
    .map((f) => ({ file: f, sql: readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }))
    .filter(({ sql }) => sql.includes(JOB) && sql.includes('cron.schedule'));

  it('a migration schedules the refresh job via cron.schedule', () => {
    expect(
      cronMigrations.length,
      `no migration schedules '${JOB}' — the MV never refreshes on a fresh env`,
    ).toBeGreaterThan(0);
  });

  it('the committed schedule bounds the staleness window at ≤10 minutes', () => {
    const all = cronMigrations.map((m) => m.sql).join('\n');
    expect(all).toMatch(/'\*\/10 \* \* \* \*'/);
  });

  it('the schedule is guarded — pg_cron existence + NOT EXISTS jobname (re-runnable)', () => {
    const all = cronMigrations.map((m) => m.sql).join('\n');
    expect(all, 'unscheduled write must check pg_cron is installed').toMatch(
      /pg_extension WHERE extname = 'pg_cron'/,
    );
    expect(all, 'must not duplicate an operator-scheduled job').toMatch(
      new RegExp(`NOT EXISTS[^;]*cron\\.job WHERE jobname = '${JOB}'`),
    );
  });

  it('the refresh runs CONCURRENTLY — readers are never blocked', () => {
    const all = cronMigrations.map((m) => m.sql).join('\n');
    expect(all).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY');
  });
});
