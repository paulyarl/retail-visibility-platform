/**
 * Tier contract — Phase 1.6 (api side): the `trial_*` → base proxy maps.
 *
 * Five private copies existed; each answered a different question but none was
 * exported or pinned, and they had already drifted —
 *
 *   - `tier-limits` was missing `trial_enterprise`/`trial_presence`/
 *     `trial_directory_presence`: an unmapped key fell through to the
 *     'discovery' 75-SKU default (under-limit for enterprise, over-limit for
 *     presence's 0).
 *   - `TierService` was missing `trial_presence`/`trial_directory_presence`/
 *     `trial_organization`: an unmapped key looked up a literal
 *     `trial_*` tier row that does not exist → zero features.
 *   - `commerce-capabilities` had two identical copies each missing six keys,
 *     including `trial_ecommerce` — commerce silently disabled for those
 *     trials.
 *
 * `expired_trial` is the deliberate asymmetry (H2): limits proxies it to
 * `presence` (maxSkus 0); every other site leaves it unmapped so an expired
 * trial presents as itself. The fixture's `site_exceptions` is where that
 * lives — it is the ONLY place a map may disagree with `canonical`.
 *
 * The MV's `trial_map` CTE (migration 332) is a sixth copy in SQL — the
 * Phase 3.7/DB mechanism owns it, not this suite.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md
 */
import { describe, it, expect } from 'vitest';
import contract from '../../../../../shared/tier-contract.json';
import { PRESENTATION_TRIAL_BASE_TIERS } from '../../utils/trial-tier-transparency';
import { LIMIT_TRIAL_BASE_TIERS } from '../../utils/tier-limits';
import { FEATURE_TRIAL_BASE_TIERS } from '../TierService';
import { COMMERCE_TRIAL_BASE_TIERS } from '../../utils/commerce-capabilities';

const CANONICAL = contract.trial_map.canonical as Record<string, string>;
const SITE_EXCEPTIONS = contract.trial_map.site_exceptions as unknown as Record<
  string,
  Record<string, string>
>;

/** Site names match the keys the fixture uses under `site_exceptions`. */
const COPIES: Array<[string, Record<string, string>]> = [
  ['trial-tier-transparency', PRESENTATION_TRIAL_BASE_TIERS],
  ['tier-limits', LIMIT_TRIAL_BASE_TIERS],
  ['TierService', FEATURE_TRIAL_BASE_TIERS],
  ['commerce-capabilities', COMMERCE_TRIAL_BASE_TIERS],
];

describe('tier contract — trial_* proxy maps', () => {
  it.each(COPIES)('%s covers every canonical trial key', (site, map) => {
    const missing = Object.keys(CANONICAL).filter((k) => !(k in map));
    expect(missing, `${site} missing ${missing.join(', ')} — unmapped keys fall through to a literal lookup or a wrong-tier default`).toEqual([]);
  });

  it.each(COPIES)('%s agrees with canonical or a declared site exception', (site, map) => {
    const exceptions = SITE_EXCEPTIONS[site] ?? {};
    for (const [k, v] of Object.entries(map)) {
      const allowed = [CANONICAL[k], exceptions[k]].filter(Boolean);
      expect(
        allowed,
        `${site}: ${k} → ${v} is neither canonical (${CANONICAL[k] ?? 'unmapped'}) nor a declared exception`,
      ).toContain(v);
    }
  });

  it.each(COPIES)('%s maps nothing outside canonical + its declared exceptions', (site, map) => {
    const exceptions = SITE_EXCEPTIONS[site] ?? {};
    for (const k of Object.keys(map)) {
      expect(
        k in CANONICAL || k in exceptions,
        `${site} maps '${k}' — keys outside canonical (expired_trial is limits-only, H2) need a fixture site_exceptions entry`,
      ).toBe(true);
    }
  });

  it('expired_trial is mapped ONLY where the fixture declares it', () => {
    for (const [site, map] of COPIES) {
      const declared = site in SITE_EXCEPTIONS && 'expired_trial' in SITE_EXCEPTIONS[site];
      expect(
        'expired_trial' in map,
        `${site}: expired_trial ${declared ? 'must be mapped (declared exception)' : 'must stay unmapped (H2)'}`,
      ).toBe(declared);
    }
  });
});

describe('tier contract — the fixture trial_map is internally consistent', () => {
  it('canonical is exactly the pseudo_tier trial_* set → strip-prefix base', () => {
    const trialPseudos = contract.tier_classes.pseudo_tiers.filter((k) =>
      k.startsWith('trial_'),
    );
    expect(Object.keys(CANONICAL).sort()).toEqual([...trialPseudos].sort());
    for (const [k, v] of Object.entries(CANONICAL)) {
      expect(k).toBe(`trial_${v}`);
      expect(contract.tier_order).toContain(v);
    }
  });
});
