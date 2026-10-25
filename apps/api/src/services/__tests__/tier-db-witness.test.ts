/**
 * Tier contract — 0.2 witness leg: the fixture faces the DATABASE, not just
 * the two code copies. `scripts/dump-tier-contract.cjs` produces
 * `shared/tier-contract-db-witness.json` from `subscription_tiers_list`,
 * `tier_features_list`, and `capability_features_list`/`features_list`/
 * `capability_type_list` (run per env via doppler). These tests pin the
 * DB↔contract invariants that can be checked from the artifact:
 *
 *   - every DB tier_key is classified in the contract (no orphan rows)
 *   - every fixture `active` tier exists in DB with is_active = true
 *   - the critical order invariants hold on DB `sort_order`
 *   - active-tier prices match the fixture, modulo the recorded divergences
 *   - 3.6 REALITY CHECK: the doc's "restricted tiers carry zero keys / never
 *     _disabled" premise is FALSE in prd — see the veto baseline below. The
 *     test pins the current veto set so new vetoes surface loudly; whether
 *     the existing ones are intended is a pending ruling (plan, 3.6 note)
 *   - trial_* DB rows: every one maps in fixture `trial_map.canonical` —
 *     and their feature bags are recorded as DEAD DATA (resolve paths proxy
 *     trial→base before reading tier_features_list)
 *   - module key lists: every `{cap}_disabled` veto assigned to a tier is a
 *     real linked feature of that capability type
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, rows 0.2 / 3.3 / 3.6.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import contract from '../../../../../shared/tier-contract.json';

const WITNESS_PATH = path.resolve(process.cwd(), '../../shared/tier-contract-db-witness.json');

interface WitnessRow { tier_key: string; is_active: boolean; sort_order: number; price_monthly: number }
const witness = JSON.parse(readFileSync(WITNESS_PATH, 'utf8')) as {
  generated_at: string;
  env: string;
  tiers: WitnessRow[];
  tier_features: Record<string, Array<{ feature_key: string; is_enabled: boolean }>>;
  capability_features: Record<string, string[]>;
};

const tierByKey = new Map(witness.tiers.map((t) => [t.tier_key, t]));
const enabledKeys = (tierKey: string) =>
  new Set((witness.tier_features[tierKey] ?? []).filter((f) => f.is_enabled).map((f) => f.feature_key));

const KNOWN_CLASSES = new Set([
  ...(contract.tier_classes.active as string[]),
  ...(contract.tier_classes.inactive_legacy as string[]),
  ...(contract.tier_classes.pseudo_tiers as string[]),
]);

/**
 * DB→fixture price divergences recorded 2026-10-16 (prd dump). `organization`
 * is the live one the code fix already exposed (tier-access said $399, code
 * elsewhere said $499 — the DB row itself is $399). `enterprise` is a
 * $0.99 rounding artifact. Chain-tier prices disagree three ways (code /
 * DB / doc) but the whole dormant-price question is 0.4's ruling, so
 * inactive-legacy rows are exempt from price parity until then.
 */
const KNOWN_PRICE_DIVERGENCES: Record<string, { db: number; fixture: number }> = {
  organization: { db: 399, fixture: 499 },
  enterprise: { db: 499.99, fixture: 499 },
};

/**
 * Enabled `{*}_disabled` keys per tier in the prd dump — the 3.6 premise
 * ("presence / seed_preview / chain_* / trial_* carry zero keys, never
 * _disabled") is falsified by the data. Pinning current state as a drift
 * guard: a NEW veto on any tier fails this test and needs a ruling.
 */
const TIER_VETO_BASELINE: Record<string, string[]> = {
  directory_presence: ['storefront_opt_disabled'],
  // Triad redesign (migration 352): all three Entry Presence modes carry the
  // same six upgrade-gated vetoes — every other module is silent (off but
  // open à-la-carte), commerce/gateway/integration are open market.
  discovery: [
    'chatbot_disabled', 'coupon_disabled', 'funnel_options_disabled',
    'org_disabled', 'social_commerce_disabled', 'wholesale_matching_disabled',
  ],
  storefront: [
    'chatbot_disabled', 'coupon_disabled', 'funnel_options_disabled',
    'org_disabled', 'social_commerce_disabled', 'wholesale_matching_disabled',
  ],
  commitment: ['coupon_disabled'],
  chain_starter: ['coupon_disabled'],
  chain_professional: ['wholesale_matching_disabled'],
  organization: ['wholesale_matching_disabled'],
  enterprise: ['wholesale_matching_disabled'],
  seed_preview: ['payment_gateway_disabled'],
  expired_trial: [],
  // Triad redesign: presence is now the deposit-commerce mode — its old
  // dormant veto rows were deleted and it carries the same six gates.
  presence: [
    'chatbot_disabled', 'coupon_disabled', 'funnel_options_disabled',
    'org_disabled', 'social_commerce_disabled', 'wholesale_matching_disabled',
  ],
  // Trial-tier rows carry vetoes too — but the bags are DEAD DATA on resolve
  // paths (both MV and resolver proxy trial→base first). Pinned regardless —
  // a raw-key read path would observe them.
  trial_chain_starter: ['coupon_disabled', 'funnel_options_disabled'],
  trial_commitment: ['coupon_disabled', 'funnel_options_disabled'],
  trial_discovery: ['coupon_disabled', 'funnel_options_disabled'],
  trial_ecommerce: ['funnel_options_disabled'],
  trial_omnichannel: ['funnel_options_disabled'],
  trial_professional: ['funnel_options_disabled'],
  trial_storefront: ['coupon_disabled', 'funnel_options_disabled'],
};

describe('0.2 witness — dump sanity', () => {
  it('the artifact exists, is stamped, and covers the contract tables', () => {
    expect(witness.generated_at).toMatch(/^\d{4}-/);
    expect(witness.tiers.length).toBeGreaterThan(15);
    expect(Object.keys(witness.capability_features).length).toBeGreaterThan(0);
  });

  // The artifact is the PRD witness (AGENTS.md: dump with `--config prd`). A
  // local dump overwrites it with a different database and nothing else here
  // notices — that happened 2026-10-25 (local `professional` had 236 enabled
  // keys vs prd's 48, and the migration-360 names were un-swapped). The dump
  // script now stamps DOPPLER_CONFIG, so a wrong-env artifact fails loudly.
  it('was dumped from prd, not a local or staging database', () => {
    expect(witness.env, 're-dump with: doppler run --config prd -- node scripts/dump-tier-contract.cjs').toBe('prd');
  });
});

describe('0.2 witness — tier universe parity', () => {
  it('every DB tier_key is a classified contract member', () => {
    for (const t of witness.tiers) {
      expect(
        KNOWN_CLASSES.has(t.tier_key),
        `DB tier '${t.tier_key}' is not in fixture tier_classes — classify or remove`,
      ).toBe(true);
    }
  });

  it('every fixture active tier exists in DB with is_active = true', () => {
    for (const key of contract.tier_classes.active as string[]) {
      const row = tierByKey.get(key);
      expect(row, `active tier '${key}' missing from DB`).toBeTruthy();
      expect(row!.is_active, `active tier '${key}' is is_active=false in DB`).toBe(true);
    }
  });

  it('every purchasable-order tier has a DB row — except `custom`', () => {
    // `custom` is the assigned/override tier — it lives in code, not the
    // catalog. Any other order member missing from subscription_tiers_list
    // resolves to zero features via TierService (a silent under-gate).
    for (const key of contract.tier_order as string[]) {
      if (key === 'custom') continue;
      expect(tierByKey.has(key), `order member '${key}' has no DB row`).toBe(true);
    }
    expect(tierByKey.has('custom'), "'custom' acquired a DB row — reclassify or keep it code-only").toBe(false);
  });

  it('DB sort_order honors the critical order invariants', () => {
    const so = (k: string) => tierByKey.get(k)!.sort_order;
    expect(so('directory_presence')).toBeLessThan(so('presence'));
    expect(so('commitment')).toBeLessThan(so('ecommerce'));
    expect(so('ecommerce')).toBeLessThan(so('omnichannel'));
    expect(so('professional')).toBeLessThan(so('organization'));
    expect(so('organization')).toBeLessThan(so('enterprise'));
    // NOTE: full-order equality is NOT asserted — DB sort_order interleaves
    // chain tiers (7–9) before presence (10) and trials at 101+, a different
    // axis than the capability-ranking tier_order. The invariants are the
    // contract; the rest of DB sort_order is a pending classification.
  });
});

describe('0.2 witness — pricing parity (active class only; dormant rows await 0.4)', () => {
  it('active-tier DB prices match the fixture, except recorded divergences', () => {
    const pricing = contract.pricing as Record<string, number>;
    for (const key of contract.tier_classes.active as string[]) {
      const row = tierByKey.get(key)!;
      const expected = pricing[key];
      const recorded = KNOWN_PRICE_DIVERGENCES[key];
      if (recorded) {
        expect(row.price_monthly, `${key} DB price diverged from the recorded value`).toBe(recorded.db);
        continue;
      }
      expect(row.price_monthly, `${key}: DB $${row.price_monthly} vs fixture $${expected}`).toBe(expected);
    }
  });
});

describe('3.6 witness — veto-key reality (premise falsified; current set pinned as drift guard)', () => {
  it('no tier carries an enabled _disabled veto outside the recorded baseline', () => {
    for (const t of witness.tiers) {
      const vetoes = [...enabledKeys(t.tier_key)].filter((k) => k.endsWith('_disabled')).sort();
      const baseline = (TIER_VETO_BASELINE[t.tier_key] ?? []).sort();
      expect(vetoes, `${t.tier_key} carries vetoes not in the baseline`).toEqual(baseline);
    }
  });
});

describe('3.6 witness — trial tier rows', () => {
  it('every DB trial_* tier maps in fixture trial_map.canonical', () => {
    const canonical = contract.trial_map.canonical as Record<string, string>;
    for (const t of witness.tiers.filter((r) => r.tier_key.startsWith('trial_'))) {
      expect(canonical[t.tier_key], `DB trial tier '${t.tier_key}' unmapped in fixture`).toBeTruthy();
    }
  });

  it('records that trial_* feature bags are dead data on resolve paths', () => {
    // Both the MV and the resolver proxy trial→base BEFORE reading
    // tier_features_list — these bags are never consulted for gating.
    // They exist (some quite large, e.g. trial_omnichannel 123 keys) and are
    // misleading on any raw-key read path. Ruling pending; pinned here so
    // the fact is not silently lost.
    const trialRowsWithFeatures = witness.tiers.filter(
      (t) => t.tier_key.startsWith('trial_') && enabledKeys(t.tier_key).size > 0,
    );
    expect(trialRowsWithFeatures.length).toBeGreaterThan(0);
  });
});

describe('3.3 witness — module key lists', () => {
  it('every enabled *_disabled veto is a linked feature of SOME capability type', () => {
    // Cap key cannot be derived from the veto key name — legacy names diverge
    // (`storefront_opt_disabled` lives in `storefront_options`; `coupon_disabled`
    // in `coupon_options`). The contract pin is membership in the linked
    // feature universe: a veto key linked to no capability type is dead data
    // that no resolver grouping can reach.
    const allLinked = new Set(Object.values(witness.capability_features).flat());
    const orphans: string[] = [];
    for (const t of witness.tiers) {
      for (const key of enabledKeys(t.tier_key)) {
        if (key.endsWith('_disabled') && !allLinked.has(key)) orphans.push(`${t.tier_key}:${key}`);
      }
    }
    expect(orphans, 'veto keys not linked to any capability type').toEqual([]);
  });
});
