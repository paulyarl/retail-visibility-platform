/**
 * Contract test for the Intelligence Profile Establishment template seed.
 *
 * The category-independent discovery substrate lives in the template BODY as
 * prose — there is no runtime type that enforces it. That makes it easy for a
 * future edit to silently drop the substrate requirements and reintroduce the
 * "name does not self-identify with the category" blind spot for every category
 * (African Grocery, Asian Grocery, Middle Eastern Grocery, Beauty Supply, …).
 *
 * This test reads the seed source and pins the load-bearing markers so the
 * authoring contract cannot regress unnoticed. (Pattern mirrors the repo's
 * constraint-parity tests, which parse SQL rather than trusting the writer.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SEED_SOURCE = readFileSync(
  new URL('../../scripts/seed-intelligence-profile-establishment-template.ts', import.meta.url),
  'utf8',
);

describe('intelligence-profile establishment template — discovery substrate contract', () => {
  it('declares the category-independent substrate section', () => {
    expect(SEED_SOURCE).toContain('DISCOVERY SUBSTRATE');
    expect(SEED_SOURCE).toContain('CATEGORY-INDEPENDENT');
  });

  it('names all three structured substrate fields', () => {
    expect(SEED_SOURCE).toContain('geography_grid');
    expect(SEED_SOURCE).toContain('generic_label_set');
    expect(SEED_SOURCE).toContain('label_independent_sweeps');
    expect(SEED_SOURCE).toContain('sweep_key');
  });

  it('scopes the grid to the retail catchment, not the administrative city', () => {
    expect(SEED_SOURCE).toContain('RETAIL CATCHMENT, NOT THE ADMINISTRATIVE CITY');
    expect(SEED_SOURCE).toContain('adjacent_municipalities');
    expect(SEED_SOURCE).toContain('share ZIPs');
  });

  it('carries the geography-keyed hard rule (no token-keying)', () => {
    expect(SEED_SOURCE).toContain('GEOGRAPHY-KEYED');
    expect(SEED_SOURCE).toContain('Do NOT implement it as a name-token query');
  });

  it('carries coverage self-test classes (6) and (7)', () => {
    expect(SEED_SOURCE).toContain('(6) A business whose name contains NO category token and NO endonym');
    expect(SEED_SOURCE).toContain('(7) A business reachable ONLY by sweeping a ZIP');
  });

  it('generalizes the class across categories (not African-Grocery-only)', () => {
    expect(SEED_SOURCE).toContain('Asian grocery');
    expect(SEED_SOURCE).toContain('beauty-supply store');
  });

  it('stamps the signal-weights seed version', () => {
    expect(SEED_SOURCE).toContain("'intel-profile-establishment-2026-09-18-signal-weights'");
    expect(SEED_SOURCE).toContain('seed-version: intel-profile-establishment-2026-09-18-signal-weights');
  });

  it('requires the local platform-signal-weight estimate', () => {
    expect(SEED_SOURCE).toContain('PLATFORM SIGNAL WEIGHTS');
    expect(SEED_SOURCE).toContain('platform_signal_weights');
    expect(SEED_SOURCE).toContain('confidence');
  });
});
