/**
 * Tier Defaults
 *
 * The ONE shared answer to "tenant with no/unknown tier" (sprint plan 1.7).
 * `directory_presence` — the free gateway, least privilege. Web twin of
 * `apps/api/src/utils/tier-defaults.ts`; both are pinned by
 * `shared/tier-contract.json` → `default_tier` and asserted in
 * `lib/tiers/tier-defaults.test.ts` (web) / `services/__tests__/tier-defaults.test.ts` (api).
 *
 * Do NOT add per-site defaults. If a site needs a different answer, it is a
 * declared exception in the fixture, not a literal here.
 */
export const DEFAULT_TIER = 'directory_presence' as const;
