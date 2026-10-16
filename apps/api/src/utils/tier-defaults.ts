/**
 * Tier Defaults
 *
 * The ONE shared answer to "tenant with no/unknown tier" (sprint plan 1.7).
 * `directory_presence` — the free gateway, least privilege.
 *
 * Pinned by `shared/tier-contract.json` → `default_tier` and asserted in
 * `services/__tests__/tier-defaults.test.ts`. Before this existed, five call
 * sites each guessed: `starter` (an INACTIVE legacy tier — over-grant),
 * `discovery`, and `professional` (a *high* gate for unknown features).
 *
 * Do NOT add per-site defaults. If a site needs a different answer, it is a
 * declared exception in the fixture, not a literal here.
 */
export const DEFAULT_TIER = 'directory_presence' as const;
