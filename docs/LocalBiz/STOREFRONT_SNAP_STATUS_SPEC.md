# Storefront SNAP Status Badge — Capability Spec

| | |
|---|---|
| **Status** | Spec — ready for implementation |
| **Capability type** | `storefront_options` (existing) |
| **New feature key** | `storefront_opt_snap_status` |
| **Merchant gate** | `tenant_storefront_options_settings.snap_status_display` (new column) |
| **Sibling feature** | `directory_visibility_snap_ebt` (directory entry badge — existing) |
| **Reference resolvers** | `DirectoryEntryOptionsResolver.ts` (SNAP pattern), `GbpManagementResolver.ts` (`can_show_*` vs `*_enabled` naming), `StorefrontOptionsResolver.ts` (host domain) |
| **Governing rules** | `capability-data-flow-rules.md` R13, R15, R16, R17, R23 (flexible), R23-data-flow (subscription override), R30, R32, R33, R34, R35; `add-capability-feature.md` Step 0 |

---

## 1. Summary

Surface the SNAP/EBT status badge on the **storefront page**, mirroring the existing
directory-entry badge. Today the badge renders only on the directory entry
(`snap_ebt_badge_enabled` / `snap_ebt_visible`, merchant pref `snap_ebt_display`). This
spec adds a parallel feature key in the `storefront_options` capability so the merchant's
own storefront page can display the same sourced, as-of-dated SNAP status.

**Core principle: one evidence layer, two render surfaces.** The directory badge and the
storefront badge must never disagree. Both consume the same sourced-evidence layer and
the same merchant suppression intent; only the capability keys are per-surface.

This is a **VISIBILITY BADGE only, not a payment capability** (same contract as the
directory entry badge).

---

## 2. Background — what exists today

### Directory entry badge (existing)

- Feature key: `directory_visibility_snap_ebt` (single-key, no group)
- Resolver: `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts`
  ```ts
  const snapEbtBadgeEnabled = mainOn && (!!features.directory_visibility_snap_ebt || flexible); // tier-level
  const snapEbtVisible = snapEbtBadgeEnabled && (merchantPrefs?.snap_ebt_display !== false);    // effective
  ```
- Merchant pref: `snap_ebt_display` on `DirectoryEntryMerchantSettings`
  (`types.ts`), stored via the directory-entry options settings route
- Expired fallback: `public-tenant-capabilities.ts` returns both fields `false`
- Evidence layer (separate from capability): sourced SNAP evidence — SNAP retailer list,
  owner confirmation after claim, or ops-reviewed in-store photo — recorded with provenance
  and an `as_of` date (see `directory-presence` seed/claim workflow). **SNAP is never
  inferred from category labels** (African, halal, international).

### Storefront options domain (host)

- Resolver: `apps/api/src/services/resolvers/StorefrontOptionsResolver.ts`
- Legacy key prefix: `storefront_opt_*` (master keys `storefront_opt_enabled` /
  `storefront_opt_disabled` / `storefront_opt_flexible`)
- **Master-gate caveat:** `enabled = !disabled && !!features.storefront_opt_enabled` —
  this domain does **not** implement R17 implicit-enable. A tier must carry the master
  key AND the feature key for anything to resolve true.
- Merchant settings table: `tenant_storefront_options_settings`
- Extracted sub-resolvers (QR, Gallery, Hours, Layouts) are unaffected; this spec touches
  only the core resolver.

---

## 3. Design decisions

### 3.1 Feature key: `storefront_opt_snap_status`

Single key, mirroring the directory side's single-key pattern
(`directory_visibility_snap_ebt`) — one key per surface, shared evidence layer.

**Naming note (R15 tension, accepted):** R15's canonical prefix for this capability would
be `storefront_options_snap_status`. However, the entire `storefront_options` domain runs
on the legacy `storefront_opt_*` prefix (`storefront_opt_enabled`,
`storefront_opt_recently_viewed`, …), and R15 also forbids **mixing prefixes within a
capability**. Sibling consistency wins: the new key uses the domain's legacy prefix.
Documented here so a future domain-wide key migration can pick it up.

**Group-gate note (R16 tension, accepted):** R16 prefers grouping new features, but the
domain's established precedent for single display features is the flat standalone key
(`storefront_opt_recently_viewed`), and cross-surface symmetry with the directory side's
flat key is the stronger design constraint. If USDA SNAP **online** purchasing ever ships
as a storefront capability, add `storefront_opt_snap_online` as a sibling standalone key
at that point (it requires separate USDA approval and must never be implied by this badge).

### 3.2 Resolver field naming (R33 / GbpManagement pattern)

Public-surfacing capability → use the explicit two-gate naming:

| Field | Kind | Derivation |
|---|---|---|
| `can_show_snap_status` | tier-level | `features` only (+ `flexible`) — never `merchantPrefs` |
| `snap_status_enabled` | effective | tier-level AND merchant pref |

This matches `GbpManagementResolver`'s `can_show_reviews` / `reviews_enabled` pattern and
keeps the R33 boundary visible in the type signature. (The directory side uses
`snap_ebt_badge_enabled` / `snap_ebt_visible` — same shape, older names; left as-is.)

### 3.3 Evidence is data, not capability (R18)

The resolvers stay pure functions of `(features, merchantPrefs)`. Whether the merchant
actually **has** sourced SNAP evidence is a data question resolved at render time by a
shared evidence helper (§7). Capability says "may show"; evidence says "has something to
show"; merchant pref says "wants to show."

---

## 4. Step 0 — Migration (seed feature keys FIRST)

Create `database/migrations/210_storefront_snap_status_feature.sql`
(confirm current max migration number before committing):

```sql
-- 1. Seed the feature key
INSERT INTO features_list (key, name, description, category, is_active, sort_order, created_at, updated_at)
VALUES
  ('storefront_opt_snap_status', 'SNAP/EBT Status Badge (Storefront)',
   'Show the sourced SNAP/EBT status badge on the storefront page. Visibility badge only — not a payment capability.',
   NULL, true, 0, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();

-- 2. Link to the storefront_options capability type
DO $$
DECLARE
  v_cap_id TEXT;
  v_feat_id TEXT;
BEGIN
  SELECT id INTO v_cap_id FROM capability_type_list WHERE key = 'storefront_options';
  IF v_cap_id IS NULL THEN RAISE NOTICE 'Capability type storefront_options not found'; RETURN; END IF;
  SELECT id INTO v_feat_id FROM features_list WHERE key = 'storefront_opt_snap_status';
  IF v_feat_id IS NOT NULL THEN
    INSERT INTO capability_features_list (capability_type_id, feature_id)
    VALUES (v_cap_id, v_feat_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 3. Merchant gate column (mirrors directory side's snap_ebt_display default-visible semantics)
ALTER TABLE tenant_storefront_options_settings
  ADD COLUMN IF NOT EXISTS snap_status_display boolean DEFAULT true;
```

Then: `pnpm prisma db pull && pnpm prisma generate` (from `apps/api`) and add to the
Prisma model:

```prisma
snap_status_display Boolean? @default(true)
```

**Verify in Admin UI** (`/settings/admin/capabilities`): the key appears under
`storefront_options` and is assignable to tiers. Do not proceed until this is true (R31).

---

## 5. Tier assignment strategy (product decision)

**Recommended — mirror the directory badge:** every tier that grants
`directory_visibility_snap_ebt` AND any storefront type also grants
`storefront_opt_snap_status` **plus the `storefront_opt_enabled` master key** (required —
see §2 master-gate caveat). This includes `directory_presence`: seeded storefronts are
`storefront_retail`, and the badge rendering on the merchant's own page pre-claim
strengthens the seed→claim funnel (the sourced evidence already exists for seeded rows).

```sql
-- Per tier (repeat for each tier in the mirror set):
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, capability_type_id, is_enabled)
VALUES
  (gen_random_uuid()::text,
   (SELECT id FROM subscription_tiers_list WHERE key = '<tier_key>'),
   'storefront_opt_snap_status', 'SNAP/EBT Status Badge (Storefront)',
   (SELECT id FROM capability_type_list WHERE key = 'storefront_options'),
   true);
-- AND ensure the tier has storefront_opt_enabled (master) — required for resolution.
```

**R35 consequence (accepted):** adding `storefront_opt_*` keys to `directory_presence`
makes the Storefront Options card appear on PlanSummaryPanel for that tier (currently
hidden because the tier defines no `storefront_opt_*` keys). This is correct — the tier
genuinely gains a storefront option. Flag in release notes.

**Alternative (rejected for now):** higher tiers only, making the storefront badge an
upgrade nudge. Rejected because it breaks the cross-surface consistency contract (§8) on
`directory_presence`, where the directory badge shows but the storefront badge cannot.

---

## 6. Resolver changes

`apps/api/src/services/resolvers/StorefrontOptionsResolver.ts`:

```ts
// SNAP/EBT status badge — tier-gated availability + merchant-gated effective state.
// VISIBILITY BADGE only, not a payment capability. Sourced-evidence gate is applied at
// render time (shared helper, §7) — the resolver stays a pure (features, merchantPrefs) function.
const snapStatusTierAllowed = mainOn && (flexible || !!features.storefront_opt_snap_status); // R23: flexible ||

// in the return object:
can_show_snap_status: snapStatusTierAllowed,                                              // tier-level (R33)
snap_status_enabled: snapStatusTierAllowed && (merchantPrefs?.snap_status_display !== false), // effective
```

And in `merchant_preferences`:

```ts
snap_status_display: merchantPrefs?.snap_status_display !== false,
```

Checklist against the rules:

- [x] **R23** — `flexible ||` prefixes the feature check
- [x] **R33** — `can_show_snap_status` derives from `features` only; merchant pref lives
      in `effective` + `merchant_preferences`
- [x] Types — add both fields to `EffectiveStorefrontOptions` in
      `apps/api/src/services/resolvers/types.ts`; add `snap_status_display` to
      `StorefrontOptionsMerchantSettings`
- [x] **R23-data-flow** — storefront options is a read-only display capability: no change
      needed in the Step 6 `isReadOnly`/`isLimited` override blocks (stays `enabled` for
      frozen tenants so the page renders read-only)
- [x] **R13** — add `can_show_snap_status: false` / `snap_status_enabled: false` to the
      `storefront_options` entries in `buildExpiredCapabilitiesResponse()`
      (`tenant-capabilities.ts`) and the expired fallback in
      `public-tenant-capabilities.ts`

---

## 7. Evidence layer (shared, render-time)

Extract (or reuse) a single evidence helper so both surfaces read the same source:

```
resolveSnapEvidence(tenantId) →
  { hasEvidence: boolean, sourceType: 'registry' | 'owner_confirmed' | 'ops_photo', asOf: date }
```

Backed by the existing sourced-evidence storage (SNAP retailer list match, owner
confirmation post-claim, ops-reviewed photo — per the directory-presence evidence
contract). **Never infer from category labels.**

**Badge render condition (both surfaces):**

```
capability.can_show_* && capability.*_enabled && evidence.hasEvidence
```

**Copy tiers (identical on directory + storefront):**

| Evidence source | Badge copy |
|---|---|
| `registry` | "SNAP/EBT reported · as of <date>" |
| `owner_confirmed` | "We accept SNAP/EBT · as of <date>" |
| `ops_photo` | "SNAP/EBT reported · as of <date>" |

Copy-tier upgrade (reported → accepted) is derived from `sourceType`, not a separate
setting. If product later wants merchant control over copy strength, add it as a new
merchant pref — do not overload `snap_status_display`.

**Online-vs-in-store guardrail:** the badge asserts **in-store** EBT acceptance only. It
must never render in checkout payment-method rows or imply EBT as an online tender unless
a future USDA SNAP-online capability exists (`storefront_opt_snap_online` — out of scope).

---

## 8. Cross-surface consistency contract

Given the same tenant, the following must always hold:

```
directory badge visible  ⟺  storefront badge visible
```

Both surfaces gate on: (per-surface tier key) AND (merchant display pref) AND (shared
evidence). Enforcement is procedural — the tier-assignment migration (§5) must grant
`directory_visibility_snap_ebt` and `storefront_opt_snap_status` (+ master key) as a set.
Add an assertion to the migration review checklist: no tier may carry one SNAP badge key
without the other.

Merchant suppression semantics: `snap_status_display = false` hides the storefront badge
only; `snap_ebt_display = false` hides the directory badge only. (Per-surface prefs are
intentional — an owner may want the badge on their own page but not the directory, or
vice versa. The *evidence* is shared; the *display* is per-surface. If product wants a
single master suppression later, add a `snap_suppress_all` pref — out of scope.)

---

## 9. API route + frontend wiring

### Settings route (R32 — all four places)

`apps/api/src/routes/storefront-options-settings.ts`:

1. Zod schema: add `snap_status_display: z.boolean().optional()`
2. `DEFAULT_SETTINGS`: add `snap_status_display: true`
3. All-false fallback (tier-disabled return): add `snap_status_display: false`
4. Tier-filtered settings (GET): if `!tierState.can_show_snap_status` → force `false`;
   else pass through merchant value with default fallback

### Frontend mapper + state (R9, R30)

- `apps/web/src/services/UnifiedCapabilityService.ts`: add `can_show_snap_status` /
  `snap_status_enabled` to `BackendEffectiveStorefrontOptions` and map to
  `canShowSnapStatus` / `snapStatusEnabled` in `mapStorefrontOptions`
- `apps/web/src/services/CapabilityResolutionService.ts`: add both fields to
  `StorefrontOptionsState`; update the fallback resolver
  (`resolveStorefrontOptionsState`) with identical logic (R30 parity), including
  `merchantPreferences`

### Merchant settings toggle (R5 — the most-skipped step)

Add a toggle row to the storefront options settings client: tier-gated `Switch` driven by
`isTierAllowed` → `tierState.can_show_snap_status` (R25 — use the tier-level field, never
the effective flag), with "Not included in your plan" when the tier doesn't allow it.

### Dashboard surfaces

No new capability type → no `CAPABILITY_META` / `CAPABILITY_DISPLAY` /
CapabilityShowcase / TierFeaturesClient entries required (the feature rides the existing
`storefront_options` module). Verify the existing storefront options entries still render
correctly on a tier that has only this feature newly added.

---

## 10. Storefront page render

Integrate the badge into the storefront page's store-info section (the block that renders
hours/contact/location — reuse the directory badge component or extract a shared
`SnapStatusBadge` consumed by both surfaces). Data source: public effective capabilities
(`GET /api/public/tenants/:tenantId/effective-capabilities` →
`effective.storefront_options`) + the shared evidence helper.

Render condition: `canShowSnapStatus && snapStatusEnabled && evidence.hasEvidence`.
Placement: store-info block only — never checkout/payment rows (§7 guardrail).

---

## 11. Tests (R34)

`StorefrontOptionsResolver.test.ts` — new cases mirroring the canonical R33/R34 pattern:

1. **Tier allows + merchant pref default/null:** `can_show_snap_status === true`,
   `snap_status_enabled === true`
2. **Tier allows + `snap_status_display: false`:** `can_show_snap_status === true`
   (tier wins — R33), `snap_status_enabled === false`,
   `merchant_preferences.snap_status_display === false` (pref preserved)
3. **Tier does not allow:** both fields `false` (with and without merchant pref true)
4. **Flexible tier:** both fields `true` regardless of individual key (R23)
5. **Master gate off** (`storefront_opt_enabled` absent): both fields `false` even with
   the feature key present — documents the domain's no-implicit-enable behavior

Also update the expired-fallback expectations (R13) if fallback shape tests exist.

---

## 12. Verification checklist

```bash
pnpm checkapi   # backend types (Prisma model, resolver, route)
pnpm checkweb   # frontend types (mapper, state, settings client)
```

```bash
# Resolved state from the single source of truth (public, summary):
curl -s "http://localhost:3001/api/public/tenants/<tenantId>/effective-capabilities" \
  | jq '.data.effective.storefront_options | {can_show_snap_status, snap_status_enabled}'

# Expired fallback shape:
# confirm both new fields present and false in buildExpiredCapabilitiesResponse output
```

Admin UI: `/settings/admin/capabilities` → `storefront_options` shows
`storefront_opt_snap_status`; tier management UI can assign it.

Manual: on a tier-enabled tenant with sourced evidence — badge renders on storefront AND
directory entry with identical copy and as_of date; merchant toggle off hides storefront
badge only; tier without the key shows the settings toggle as "Not included in your plan."

---

## 13. Rollout order

1. Migration (§4) → run → verify Admin UI (R31)
2. Tier assignment migration (§5) — grant SNAP badge key sets together
3. Resolver + types (§6) + unit tests (§11)
4. Settings route (§9, R32) + merchant toggle
5. Frontend mapper/state/fallback (§9, R30)
6. Evidence helper + `SnapStatusBadge` component + storefront render (§7, §10)
7. `pnpm checkapi && pnpm checkweb` + curl verification (§12)
8. Release notes: R35 panel consequence on `directory_presence`
