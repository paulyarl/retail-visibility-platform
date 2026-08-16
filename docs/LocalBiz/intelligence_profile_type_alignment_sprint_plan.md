# Sprint Plan — Intelligence Profile Type Alignment

**Status:** Draft
**Date:** 2026-08-15
**Spec lineage:** Extends `marketing_ops_seek_intelligence_scope_sprint_plan.md` (Sprint 1–3) and the focus-block work shipped in commit `f67eedad` ("Seek Intelligence Sprint Plan").
**Goal:** Close the profile-type alignment gap so that emerging and competitive intelligence campaigns for the same category automatically resolve to the correct type-specific profile.

---

## 1. Problem Statement

An operator can establish an intelligence profile for a category by running an Intelligence Profile Establishment campaign. Every intelligence campaign carries an `intelligence_focus` of `emerging` or `competitive` (Migration 200, `mkt_campaigns_list.intelligence_focus`).

The operator's mental model is:

> "I establish an **emerging** profile for Restaurants. I establish a **competitive** profile for Restaurants. Now both an emerging-focus discovery campaign and a competitive-focus discovery campaign for Restaurants should automatically pick up the right profile."

The current implementation does not support this. There is **one active profile slot per category**, shared by both focus types. Establishing the competitive profile retires the emerging profile, and both campaign types then resolve to whichever profile happens to be active.

### Root cause (concrete)

1. **Schema:** `mkt_intelligence_profiles` has no `intelligence_focus` column. The partial unique index `idx_mkt_intel_profiles_active_category` enforces one active row per `category_key` only (Migration 195, lines 41–43).
2. **Resolver:** `IntelligenceProfileService.resolve(category)` matches on `category_key` alone and never receives `focus` (`IntelligenceProfileService.ts:114`).
3. **Composer:** `PromptComposerService.composeIntelligencePrompt({ category, focus })` resolves the profile by category, then layers a focus *fragment* on top — both focus types load the **same** profile row (`PromptComposerService.ts:104–117`).
4. **Activation:** `activateDraft(profileId, version)` retires **all** active rows for the `category_key` before activating the new draft — so activating a competitive profile destroys the active emerging profile (`IntelligenceProfileService.ts:349–356`).
5. **Import hook:** `MarketingPromptService.importExternalResult` calls `importAsDraft({ categoryKey, categoryName, configurationJson })` with no focus, so the imported draft has no type lineage (`MarketingPromptService.ts:602–607`).

### Ghost-bug risk

This is a *ghost bug* class: the system appears to work (a profile resolves, a focus fragment is appended, the prompt runs), but the profile block is the **wrong type** for one of the two campaign types. The operator has no signal that the competitive campaign is loading an emerging-biased profile (or vice versa). Discovery quality degrades silently.

---

## 2. Design Principles

1. **One active profile per (category, focus) pair.** The unique constraint moves from `(category_key) WHERE status = 'active'` to `(category_key, intelligence_focus) WHERE status = 'active'`.
2. **Focus-aware resolution with safe fallback.** `resolve(category, focus)` first tries an exact `(category_key, intelligence_focus)` match. If no focus-specific profile exists, it falls back to a category-only match (legacy single-profile behavior) so the change is **non-breaking** for categories that only have one profile. The fallback is logged so we can detect when a campaign is running on a mismatched-type profile.
3. **Type-scoped activation.** `activateDraft` retires only the active row matching the **same** `(category_key, intelligence_focus)` as the draft being activated — not all active rows for the category.
4. **Type-scoped version lineage.** `importAsDraft` and `publishVersion` carry the focus so versions stay within their focus lineage. A profile id's versions are all the same focus.
5. **Establishment campaign carries focus into the import.** The establishment campaign's `intelligence_focus` is read at import time and stamped onto the draft, so the operator does not need to re-tag the profile after import.
6. **No byte-identical regression for business-scope §1B.** Business-scope amplification (`MarketingExecutionService.resolvePrompt` business path) calls `resolve(category)` with no focus. The fallback path preserves the existing behavior: the single active profile for the category is returned regardless of its focus. This is acceptable because business §1B amplification is category-aware, not focus-aware — the profile block is the same for both focus types when only one profile exists.

---

## 3. Schema Changes

### Migration 202: `202_intelligence_profiles_focus.sql`

```sql
BEGIN;

-- 1. Add the focus column, defaulting to 'emerging' for backfill.
ALTER TABLE mkt_intelligence_profiles
  ADD COLUMN IF NOT EXISTS intelligence_focus VARCHAR(20) NOT NULL DEFAULT 'emerging';

-- 2. Backfill: every existing profile is treated as 'emerging' focus.
--    This is the conservative default — the hand-seeded auto_repair_us
--    profile is emerging-biased (CARFAX vertical discovery), and any
--    operator-established profile from before this sprint was produced
--    by an establishment campaign whose focus defaulted to 'emerging'.
UPDATE mkt_intelligence_profiles
SET intelligence_focus = 'emerging'
WHERE intelligence_focus IS NULL OR intelligence_focus = '';

-- 3. Drop the old per-category unique index and replace it with a
--    per-(category, focus) unique index. This allows one active
--    emerging profile AND one active competitive profile for the same
--    category_key.
DROP INDEX IF EXISTS idx_mkt_intel_profiles_active_category;
CREATE UNIQUE INDEX idx_mkt_intel_profiles_active_category_focus
  ON mkt_intelligence_profiles (category_key, intelligence_focus)
  WHERE status = 'active';

-- 4. Lookup by (category_key, focus) for the resolver.
CREATE INDEX IF NOT EXISTS idx_mkt_intel_profiles_category_focus
  ON mkt_intelligence_profiles (category_key, intelligence_focus);

COMMIT;
```

**After running:** `cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate`

### Prisma schema update (`apps/api/prisma/schema.prisma`)

Add `intelligence_focus String @default("emerging") @db.VarChar(20)` to the `mkt_intelligence_profiles` model and update the index list to reflect the new partial unique index. The `@@index([status], ...)` and `@@index([id], ...)` indexes remain.

---

## 4. Backend Service Changes

### 4.1 `IntelligenceProfileService.ts`

**Type changes:**

```ts
export interface IntelligenceProfile {
  id: string;
  category_key: string;
  category_name: string;
  version: number;
  intelligence_focus: IntelligenceFocus; // NEW
  configuration_json: any;
  status: IntelligenceProfileStatus;
  created_at: Date;
  updated_at: Date;
}
```

Import `IntelligenceFocus` from `PromptComposerService` (or move the type to a shared `intelligence/types.ts` to avoid a circular import — preferred).

**`resolve(category, focus?, ctx?)` — focus-aware with fallback:**

```ts
async resolve(
  category: string,
  focus?: IntelligenceFocus,
  ctx?: RequestCtx,
): Promise<IntelligenceProfile | null> {
  const key = normalizeCategoryKey(category);
  // 1. Try exact (category_key, focus) match if focus is provided.
  if (focus) {
    const exact = await this.prisma.mkt_intelligence_profiles.findFirst({
      where: { category_key: key, intelligence_focus: focus, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (exact) return exact as IntelligenceProfile;
    // 2. Fallback: category-only match (legacy single-profile behavior).
    //    Logged so operators can detect mismatched-type resolution.
    const fallback = await this.prisma.mkt_intelligence_profiles.findFirst({
      where: { category_key: key, status: 'active' },
      orderBy: { version: 'desc' },
    });
    if (fallback) {
      logger.warn('Intelligence profile resolved via focus fallback — type mismatch possible', ctx, {
        categoryKey: key,
        requestedFocus: focus,
        resolvedFocus: (fallback as any).intelligence_focus,
        profileId: (fallback as any).id,
      });
    }
    return fallback as IntelligenceProfile | null;
  }
  // 3. No focus requested (business §1B path) — category-only match.
  const profile = await this.prisma.mkt_intelligence_profiles.findFirst({
    where: { category_key: key, status: 'active' },
    orderBy: { version: 'desc' },
  });
  return profile as IntelligenceProfile | null;
}
```

**`createProfile` / `importAsDraft` / `publishVersion` — accept `intelligenceFocus`:**

All three methods gain an `intelligenceFocus: IntelligenceFocus` parameter (default `'emerging'`). The focus is written to the new column on every create/version row.

**`activateDraft(profileId, version, ctx?)` — type-scoped retirement:**

The retirement `updateMany` inside the transaction changes from:

```ts
where: { category_key: draft.category_key, status: 'active' }
```

to:

```ts
where: {
  category_key: draft.category_key,
  intelligence_focus: draft.intelligence_focus,
  status: 'active',
}
```

So activating a competitive draft retires only the prior active competitive profile — the active emerging profile for the same category is untouched.

**`listActive` / `listDrafts` — unchanged signature, but results now include `intelligence_focus`.** Optionally add a `focus?` filter param for the admin UI to request one focus type.

### 4.2 `PromptComposerService.ts`

`composeIntelligencePrompt` already has `focus` in its input. The only change is passing it through to the resolver:

```ts
const profile = await profileService.resolve(input.category, input.focus, ctx);
```

No other composer changes — the focus fragment layering is unchanged and correct (the fragment is the *posture* modifier; the profile block is the *category knowledge*).

### 4.3 `MarketingExecutionService.ts`

**Intelligence-scope composition path (line 302–325):** already passes `focus` to `composeIntelligencePrompt`. No change — the focus flows through to `resolve` inside the composer.

**Intelligence Profile Establishment path (line 334–349):** already reads `input.campaign.intelligence_focus` and appends the focus block. No change to the prompt rendering. The focus is now also stamped onto the imported draft via the import hook (§4.4).

**Business-scope §1B path (line 362–393):** calls `profileService.resolve(category)` with no focus. This preserves the existing behavior — business audits are category-aware, not focus-aware. The fallback in `resolve` returns the single active profile for the category regardless of focus, which is the correct behavior for §1B (the profile block is the same category knowledge either way).

### 4.4 `MarketingPromptService.importExternalResult` (the establishment import hook)

The hook currently calls `importAsDraft({ categoryKey, categoryName, configurationJson })`. It needs to pass the focus from the establishment campaign:

```ts
// Fetch the campaign to read its intelligence_focus.
const campaign = await this.prisma.mkt_campaigns_list.findUnique({
  where: { id: input.campaignId },
  select: { intelligence_focus: true },
});
const focus = (campaign?.intelligence_focus || 'emerging') as IntelligenceFocus;

const profile = await IntelligenceProfileService.getInstance().importAsDraft({
  categoryKey: parsedJson.category_key,
  categoryName: parsedJson.category_name,
  configurationJson: parsedJson,
  intelligenceFocus: focus, // NEW
}, ctx);
```

This is the key fix for the ghost-bug: when the operator runs an emerging-focus establishment campaign and imports the result, the draft is tagged `emerging`. When they run a competitive-focus establishment campaign for the same category, the draft is tagged `competitive`. Activating each draft retires only the prior active profile of the same focus.

---

## 5. Route Changes (`marketing-ops.ts`)

### 5.1 Validation schemas

`intelligenceProfileCreateSchema` and `intelligenceProfilePublishSchema` gain:

```ts
intelligenceFocus: z.enum(['emerging', 'competitive']).default('emerging'),
```

### 5.2 `GET /intelligence-profiles/resolve/:category`

Add optional `?focus=emerging|competitive` query param:

```ts
router.get('/intelligence-profiles/resolve/:category', async (req, res) => {
  const focus = req.query.focus as IntelligenceFocus | undefined;
  const profile = await IntelligenceProfileService.getInstance().resolve(
    req.params.category,
    focus,
    getCtx(req),
  );
  res.json({ success: true, data: profile });
});
```

### 5.3 `POST /intelligence-profiles` and `POST /intelligence-profiles/:id/publish`

Pass `intelligenceFocus` from the parsed body into `createProfile` / `publishVersion`.

### 5.4 `POST /intelligence-profiles/:id/:version/activate`

No body change — the focus is read from the draft row itself inside `activateDraft` (the retirement `where` clause uses `draft.intelligence_focus`).

---

## 6. Frontend Changes

### 6.1 `MarketingOpsService.ts` (frontend service)

- `IntelligenceProfile` interface: add `intelligence_focus: IntelligenceFocus`.
- `resolveIntelligenceProfile(category, focus?)`: add optional `focus` param, append `?focus=` to the URL when provided.
- `createIntelligenceProfile` / `publishIntelligenceProfile`: accept and send `intelligenceFocus`.

### 6.2 `IntelligenceProfilesClient.tsx` (admin UI)

- Render a focus badge on each profile card (next to the version badge): `Emerging` (blue) or `Competitive` (violet).
- Group active profiles by `(category, focus)` so the operator sees both slots per category.
- Update the "Activating a draft retires the previously active version for the same category" help text to "...for the same category **and focus type**."
- Optional: add a focus filter chip at the top (All / Emerging / Competitive).

### 6.3 Campaign form (`CampaignFormClient.tsx`)

No change — the focus radio already exists for intelligence-scope campaigns. The operator's existing workflow (pick focus at campaign creation) now flows end-to-end into the profile that the campaign resolves.

---

## 7. Seed Script Update

### 7.1 `seed-intelligence-profile-auto-repair.ts`

The hand-seeded `auto_repair_us` profile is emerging-biased (CARFAX vertical discovery, hidden-trust signals). Add `intelligenceFocus: 'emerging'` to the `createProfile` call so the seed is explicit about its type. The backfill in Migration 202 already defaults existing rows to `'emerging'`, so this is a no-op for already-seeded environments but correct for fresh seeds.

### 7.2 `seed-intelligence-profile-establishment-template.ts`

No change to the template body. The focus is read from the campaign at import time (§4.4), not from the template.

---

## 8. Test Plan

### 8.1 Update existing tests

**`IntelligenceProfileService.test.ts`:**
- `sampleProfile` gains `intelligence_focus: 'emerging'`.
- Add a `renderProfileBlock` assertion that the focus is NOT rendered into the block (the focus is a campaign-level concern, not a profile-block concern — the block is category knowledge).

**`PromptComposerService.test.ts`:**
- `mockProfileService.resolve` mock signature changes to `resolve(category, focus?)`. Update the mock to assert the focus is passed through:
  - emerging campaign → `resolve('Auto Repair', 'emerging')`
  - competitive campaign → `resolve('Plumbing', 'competitive')`
- Add a test: focus-specific profile exists → composer returns it (no fallback).
- Add a test: no focus-specific profile, but a category-only profile exists → composer falls back and logs the mismatch.

**`ResolvePrompt.test.ts`:**
- Business-scope path: `resolve` is called with `(category, undefined)` — update the mock assertion from `toHaveBeenCalledWith('  Auto Repair  ', undefined)` to `toHaveBeenCalledWith('  Auto Repair  ', undefined, undefined)` (or just verify it was called with the category and no focus).

### 8.2 New tests

**`IntelligenceProfileService.focus-alignment.test.ts` (new file, integration-style with mocked Prisma):**
- `resolve(category, 'emerging')` with an emerging active profile → returns it.
- `resolve(category, 'competitive')` with a competitive active profile → returns it.
- `resolve(category, 'emerging')` with no emerging profile but a competitive active profile → falls back to competitive, logs mismatch.
- `resolve(category, 'emerging')` with both an emerging and competitive active profile → returns emerging (exact match wins).
- `activateDraft` for a competitive draft retires only the active competitive profile; the active emerging profile for the same category remains active.
- `importAsDraft` with `intelligenceFocus: 'competitive'` creates a draft with `intelligence_focus: 'competitive'`.
- `publishVersion` preserves the focus from the latest version (all versions of a profile id share the same focus).

**`ResolvePrompt.establishment-focus.test.ts` (new, or extend the existing file):**
- Establishment campaign with `intelligence_focus: 'competitive'` → `renderEstablishmentFocusBlock` receives `'competitive'` (already tested implicitly, but make it explicit).

---

## 9. Migration & Rollout

1. **Apply Migration 202** (`202_intelligence_profiles_focus.sql`) in all environments.
2. **Regenerate Prisma Client:** `doppler run --config local -- pnpm prisma db pull && pnpm prisma:generate`.
3. **Deploy backend** — service + route changes are backward-compatible:
   - `resolve(category)` with no focus still works (business §1B path unchanged).
   - Existing single-profile categories continue to resolve via the fallback path.
4. **Deploy frontend** — the focus badge is additive; no breaking UI change.
5. **Re-seed `auto_repair_us`** with explicit `intelligenceFocus: 'emerging'` (no-op for existing environments, correct for fresh seeds).

No data migration beyond the column add + backfill is required. The backfill defaults all existing profiles to `'emerging'`, which matches the historical behavior (the establishment campaign focus defaulted to `'emerging'` per Migration 200).

---

## 10. Out of Scope

- **Profile-level focus splitting of the configuration JSON.** The profile block (specialized sources, discovery patterns, evidence rules) is category knowledge. The focus *fragment* is the posture modifier. We are not splitting the profile JSON into emerging/competitive halves — the operator authors two separate profiles if they want different source lists per focus.
- **Business-scope §1B focus awareness.** Business audits are category-aware, not focus-aware. The §1B amplification uses the category-only fallback and does not need a focus.
- **Cross-category profile inheritance.** Still prohibited (§1B normative rule). The focus column does not change the category-exact-match rule.

---

## 11. File Touch List

| File | Change |
|------|--------|
| `database/migrations/202_intelligence_profiles_focus.sql` | NEW — schema migration |
| `apps/api/prisma/schema.prisma` | Add `intelligence_focus` to `mkt_intelligence_profiles` |
| `apps/api/src/services/intelligence/IntelligenceProfileService.ts` | Focus-aware `resolve`, type-scoped `activateDraft`, focus param on create/import/publish |
| `apps/api/src/services/intelligence/PromptComposerService.ts` | Pass `focus` to `resolve` |
| `apps/api/src/services/MarketingPromptService.ts` | Read campaign focus in import hook, pass to `importAsDraft` |
| `apps/api/src/services/MarketingExecutionService.ts` | No functional change (focus already flows through composer); update import of `IntelligenceFocus` if moved to shared types |
| `apps/api/src/routes/marketing-ops.ts` | `intelligenceFocus` in create/publish schemas; `?focus=` on resolve endpoint |
| `apps/api/src/scripts/seed-intelligence-profile-auto-repair.ts` | Explicit `intelligenceFocus: 'emerging'` |
| `apps/web/src/services/MarketingOpsService.ts` | `intelligence_focus` on type; `focus` param on resolve/create/publish |
| `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` | Focus badge, grouping, help text |
| `apps/api/src/services/__tests__/IntelligenceProfileService.test.ts` | Update `sampleProfile`, add focus assertions |
| `apps/api/src/services/__tests__/PromptComposerService.test.ts` | Update mock signature, add focus-pass-through + fallback tests |
| `apps/api/src/services/__tests__/ResolvePrompt.test.ts` | Update `resolve` mock assertions |
| `apps/api/src/services/__tests__/IntelligenceProfileService.focus-alignment.test.ts` | NEW — focus-aware resolution + type-scoped activation tests |

---

## 12. Verification Checklist

- [ ] `pnpm checkapi` passes
- [ ] `pnpm checkweb` passes
- [ ] `vitest run apps/api/src/services/__tests__/IntelligenceProfileService` passes
- [ ] `vitest run apps/api/src/services/__tests__/PromptComposerService` passes
- [ ] `vitest run apps/api/src/services/__tests__/ResolvePrompt` passes
- [ ] New `IntelligenceProfileService.focus-alignment.test.ts` passes
- [ ] Migration 202 applies cleanly in a fresh DB and an existing DB
- [ ] `prisma db pull && prisma generate` produces the `intelligence_focus` field on the model
- [ ] Manual: create an emerging establishment campaign for a category, import a profile, activate → emerging profile active. Create a competitive establishment campaign for the same category, import, activate → competitive profile active, emerging profile still active. Run an emerging discovery campaign → resolves to emerging profile. Run a competitive discovery campaign → resolves to competitive profile.
