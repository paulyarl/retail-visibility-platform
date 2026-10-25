# Tier Inheritance + Capability Value Pricing

## Purpose

Two things landed together and they depend on each other:

1. **Tier inheritance has a runtime.** Order, inheritance and closure used to exist only as codebase assertions (fixture, static `TIER_HIERARCHY`, contract suites). The capability layer resolved *what a tenant has* and had no idea what a tier *should* have — so the admin UI could empty a tier and nothing objected, while the web path still gated on the static copy.
2. **Capability value has a model.** `bsaas_catalog` prices predate the capability architecture and read as hand-set round numbers. `docs/CAPABILITY_VALUE_ANCHOR_SPEC.md` defines the value layer prices should derive from.

Use this skill when: adding a tier, editing tier bags in the capability admin UI, changing inheritance, pricing or re-pricing a module/tier, or debugging "this tenant should have X but doesn't".

---

## What is new

### The graph (`tier_inheritance_edges`)

- Migration **`database/migrations/361_tier_inheritance_edges.sql`** — table + 66 edges seeded from `shared/tier-contract.json` `inheritance.edges`. The fixture arrays are already the transitive **closure**, so storing them verbatim is idempotent under the resolver's union walk.
- Apply manually (never auto-run):
  ```bash
  cd apps/api && doppler run --config prd -- node scripts/apply-sql-file.cjs ../../database/migrations/361_tier_inheritance_edges.sql
  ```

### `TierInheritanceService` (`apps/api/src/services/`)

| Export | Behaviour |
|---|---|
| `computeClosure(edges, seeds)` | pure; every ancestor, seeds excluded; cycle-safe |
| `wouldCreateCycle(edges, child, parents)` | write-time guard; catches loops that price direction allows |
| `loadEdges()` | raw SQL + 60s cache; **degrades to no inheritance with a warning if the table is missing** (never crashes) |
| `getTierClosure(tierKeys)` | ancestors of the tenant's tier(s) |
| `listInheritance()` | **all** tiers with `price`, `sortOrder`, `parents` — a tier with no inherited set is visible as such |
| `setTierParents(child, parents)` | replaces the set; validates direction + cycles; invalidates cache |

Raw SQL rather than a Prisma model: the table ships via `apply-sql-file`, so the service works before the client is regenerated.

### Resolver closure

`fetchRawCapabilities` in `EffectiveCapabilityResolver.ts` expands the tier id set with ancestors **before** reading `tier_features_list`:

```ts
const ancestorKeys = await getTierClosure(tierKeys);
const ancestorTiers = ancestorKeys.length ? await prisma.subscription_tiers_list.findMany({ … }) : [];
const allTierIds = [...tiers, ...ancestorTiers].map((t) => t.id);
```

A higher tier consumes a lower one **because of its position in the graph**, not because rows were copied down. Tier identity is preserved for display; only the feature read widens. **Effective capability remains the source of truth.**

### Admin UI

`/settings/admin/capabilities` → **Inheritance** tab (`TierInheritancePanel` in `CapabilityManagement.tsx`):

- every tier, its price, and its inherited chips
- add via a dropdown limited to tiers that **cost no more**
- remove per chip, Save enabled only when dirty, server errors surfaced inline
- API: `GET /api/admin/tier-inheritance` (staff), `PUT /api/admin/tier-inheritance/:tierKey` (admin)

### Pricing model

`docs/CAPABILITY_VALUE_ANCHOR_SPEC.md` — read it before touching prices.

- **Anchors**: every value-bearing feature family gets a 0–1 anchor (load-bearing 1.0 · major 0.7 · supporting 0.4 · presentation 0.2 · variant 0.1). Absolute across modules, so a 0.7 means the same everywhere.
- **Filters**: drop state keys (`_enabled/_disabled/_flexible/_on/_off`), drop presence markers, collapse enumerated choices into one family, route quantity keys (`flyer_items_*`, `gallery_limit_*`) to a separate capacity axis.
- **Buckets**: configuration (soft-gated, never priced) · separation-controlled (tier is the boundary, e.g. `storefront_types` `_enabled`) · tier-included (priced from the tier) · discretionary (own perceived-value anchor; any tier may buy; outside tier pricing).
- **Tier price** is a single-parameter fit, not a per-delta solve: `k = Σ(P_t·V_t)/Σ(V_t²)`, `w_m = k·value(m)`, `p_f = w_m·share(f)`. Deltas only work on a strict superset chain — unbalance is allowed (§5.2).

---

## Rules that are easy to get wrong

1. **Direction is measured in PRICE, not `sort_order`.** The chain ladder carries *lower* sort orders than the retail ladder it mirrors (`chain_professional` is sort 8 at $1,999, inheriting `professional` at sort 70 / $199). A sort-order rule rejects 13 of the 66 seeded edges as false positives; price rejects 0.
2. **A tier may only inherit from tiers that cost no more.** A tier exists to be an upgrade over the ones beneath it, so an emptied tier falls back to its immediate *lower* tier — never to a more expensive one it didn't pay for.
3. **Price direction alone doesn't prevent cycles.** `google_only` and `discovery` are both $29, so each may legally link to the other. `wouldCreateCycle` is the second guard.
4. **State decides economics.** `storefront_types` `_enabled` is separation (unpriced); `_flexible` (all four operating models at once) is a priced premium capability. Economic treatment attaches to **(module, state)**.
5. **A config option that differs by tier is a hard gate in disguise.** Soft gating is only honest if the option set is identical at every tier.
6. **Vetoes need a declared reason.** `incompatibility` or `separation` — never `price_wall`. An upgrade wall masquerading as compliance is the mirror of a gate masquerading as configuration.

---

## Verification

```bash
pnpm checkapi
pnpm checkweb
cd apps/api && npx vitest run src/services/__tests__/tier-inheritance.test.ts   # closure, cycles, direction
cd apps/api && npx vitest run src/services/__tests__/tier-db-witness.test.ts    # witness is prd-stamped
```

After editing bags or inheritance in prod, refresh the witness:

```bash
cd apps/api && doppler run --config prd -- node scripts/dump-tier-contract.cjs
```

The script stamps `DOPPLER_CONFIG`, and `tier-db-witness.test.ts` asserts `env === 'prd'` — a `--config local` dump now fails loudly instead of silently overwriting the artifact.

---

## Known gaps

- **The MV path is not inheritance-aware.** `resolveEffectiveCapabilitiesFromMV` reads `mv_tenant_effective_capabilities`, built from raw rows — the fast path still answers without the closure. The MV needs a rebuild that joins the edges.
- **Web gating still uses the static `TIER_HIERARCHY`.** Both paths now have a graph, but only the API reads the table. A behavioural test resolving one tier through both and diffing would close the split-brain.
- **The guard is write-time only.** The resolver trusts the table, and the SQL seed bypasses validation. A `CHECK` constraint or a validation query over seeded rows would make it structural.
- **`platform_services`** (one-off design services, ~$1,794) probably doesn't belong in a monthly capability catalog at all.

---

## Gotchas

- `npx next build` from `apps/web` resolves the **root's** unpatched Next (16.4.2) and dies on `/api/*` prerender with `InvariantError: Response cache requires a source route`. Use `pnpm build` (app's pinned 16.3.6, patched).
- The fixture's `inheritance.edges` lists the tiers a tier **inherits from** — the *lower* tiers. Read "parent" in that file as "inherited from", not "tier above".
- Tier bags can now hold only their **differentiators**; inherited capabilities don't need copying down. A thin bag is legitimate — `professional` going 211 → 48 keys lost no capability, it dropped duplicated inherited rows.
