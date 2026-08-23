# GBP Authorized Management Suite — Sprint Plan: Phase 0

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 0 only — Identity Bridge & Schema
**Status:** Planning
**Branch:** `staging` → feature branch at sprint start

---

## Sprint Goal

Deliver the **identity bridge + schema foundation** that unblocks all subsequent GBP Management Suite phases. Phase 0 produces:

1. Five SQL migrations (237–241) applied to the database
2. Prisma schema introspected + client regenerated
3. `CustomerGBPAccessService` with bridge resolution + cross-customer isolation
4. `gbp-customer.ts` route scaffold registered in `routeRegistry.ts`
5. `mkt_customer_gbp_links` provisioning on campaign claim
6. Unit tests for bridge resolution, cross-customer 404, and tenant_id drift reconciliation

**Phase 0 does NOT produce:** OAuth flows, verification, review ingestion, reply engine, post scheduler, media upload, capability registration, BSaaS catalog entries, or any frontend pages. Those are Phase 1+.

---

## Pre-Flight Checklist (per `start-of-phase-sprint-checklist.md`)

### Skills to read before starting
| Skill | Why |
|---|---|
| `manual-sql-migration-policy.md` | 5 SQL migrations — must follow idempotency + naming conventions |
| `tenant-scoped-id-generation.md` | New `mkt_customer_gbp_links` table needs ID prefix planning |
| `deploy-service-extending-base-singleton.md` | `CustomerGBPAccessService` backend service — pick base class |
| `capability-deployment-flow.md` | Phase 0 does NOT register capabilities, but the bridge must be capability-aware for Phase 4 |
| `directory-presence-seed-claim.md` | Bridge provisioning hooks into campaign claim flow |

### TypeScript gate (non-negotiable)
```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```
Sprint is NOT complete until both pass with zero new errors.

---

## Task Breakdown

### Task 1: Migration 237 — `237_gbp_locations_verification.sql`
**File:** `database/migrations/237_gbp_locations_verification.sql`
**Spec ref:** §7 migration table + §7 Prisma model block

**Columns to add on `gbp_locations_list`:**
- `tenant_id VARCHAR` — denormalized from `google_oauth_accounts_list.tenant_id`; backfilled
- `business_name VARCHAR`
- `verification_state VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED'` — UNVERIFIED | PENDING | COMPLETED | FAILED
- `voice_of_merchant JSONB` — cached getVoiceOfMerchantState payload
- `cached_average_rating DOUBLE PRECISION` — Google aggregate averageRating (e.g., 4.5)
- `cached_review_count INTEGER` — Google aggregate totalReviewCount
- `rating_cache_updated TIMESTAMPTZ` — last refresh timestamp

**Backfill:**
```sql
UPDATE gbp_locations_list l
SET tenant_id = a.tenant_id
FROM google_oauth_accounts_list a
WHERE l.account_id = a.id AND l.tenant_id IS NULL;
```

**Index:** `idx_gbp_locations_tenant ON gbp_locations_list (tenant_id)`

**Idempotency:** all DDL wrapped in `ADD COLUMN IF NOT EXISTS`; backfill uses `WHERE tenant_id IS NULL`

**Verification:**
```sql
SELECT count(*) FROM gbp_locations_list WHERE tenant_id IS NOT NULL;
SELECT count(*) FROM gbp_locations_list WHERE tenant_id IS NULL;  -- should be 0 or only orphaned rows
```

---

### Task 2: Migration 238 — `238_gbp_reviews_intelligence.sql`
**File:** `database/migrations/238_gbp_reviews_intelligence.sql`
**Spec ref:** §7 migration table + §7 Prisma model block + §10 quality gate #6

**Columns to add on `gbp_reviews`:**
- `location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE`
- `reply_status VARCHAR(16) NOT NULL DEFAULT 'NONE'` — NONE | AI_DRAFTED | PUBLISHED | DISPUTED
- `ai_drafts JSONB`
- `sentiment VARCHAR(12)`

**Type change on `gbp_reviews.star_rating`:** `VarChar(10)` → `INTEGER`

**CRITICAL — enum mapping (not numeric string cast):**
Google API returns `starRating` as enum string (`'ONE'`..`'FIVE'`), stored directly by `GBPAdvancedSync.storeReviews` (line ~860). The migration MUST map enum→int:

```sql
ALTER TABLE gbp_reviews ALTER COLUMN star_rating TYPE INTEGER
  USING (
    CASE star_rating
      WHEN 'ONE'   THEN 1
      WHEN 'TWO'   THEN 2
      WHEN 'THREE' THEN 3
      WHEN 'FOUR'  THEN 4
      WHEN 'FIVE'  THEN 5
      WHEN '1' THEN 1  WHEN '2' THEN 2  WHEN '3' THEN 3  WHEN '4' THEN 4  WHEN '5' THEN 5
      ELSE NULL
    END
  );
```

**Backfill reply_status:**
```sql
UPDATE gbp_reviews SET reply_status = 'PUBLISHED' WHERE is_replied = true AND reply_status = 'NONE';
```

**Indexes:**
- `idx_gbp_reviews_tenant_rating ON gbp_reviews (tenant_id, star_rating)`
- `idx_gbp_reviews_tenant_reply ON gbp_reviews (tenant_id, reply_status)`

**Code-path update (MUST happen before merge — §10 gate #6):**
- Update `GBPAdvancedSync.storeReviews` (line ~860) to write `Int` (1–5) instead of enum string
- Update `Review` interface `starRating` type from `'ONE'|'TWO'|'THREE'|'FOUR'|'FIVE'` to `number` (or add mapping step at storage boundary)
- Grep all `star_rating` consumers in `apps/api` and `apps/web` for enum-string comparisons (`=== 'FIVE'`, `=== 'ONE'`) and update to numeric (`=== 5`, `=== 1`)
- Verify `pnpm checkapi` + `pnpm checkweb` pass against flipped Prisma type (`String?` → `Int?`)

---

### Task 3: Migration 239 — `239_gbp_posts_lifecycle.sql`
**File:** `database/migrations/239_gbp_posts_lifecycle.sql`
**Spec ref:** §7 migration table + §7 Prisma model block

**Columns to add on `gbp_posts`:**
- `location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE`
- `post_name VARCHAR` — Google resource ID (e.g., `accounts/{accountId}/locations/{locationId}/localPosts/{postId}`)
- `status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED'` — SCHEDULED | PUBLISHED | FAILED
- `scheduled_for TIMESTAMPTZ`
- `published_at TIMESTAMPTZ`

**Indexes:**
- `idx_gbp_posts_tenant_status ON gbp_posts (tenant_id, status)`
- `idx_gbp_posts_scheduled ON gbp_posts (scheduled_for) WHERE status = 'SCHEDULED'`

---

### Task 4: Migration 240 — `240_gbp_media_location.sql`
**File:** `database/migrations/240_gbp_media_location.sql`
**Spec ref:** §7 migration table + §7 Prisma model block

**Columns to add on `gbp_media`:**
- `location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE`
- `view_count INTEGER DEFAULT 0`

**Index:** `idx_gbp_media_tenant_location ON gbp_media (tenant_id, location_id)`

---

### Task 5: Migration 241 — `241_mkt_customer_gbp_links.sql`
**File:** `database/migrations/241_mkt_customer_gbp_links.sql`
**Spec ref:** §7 migration table + §7 Prisma model block + Subsystem 0

**New table — customer↔tenant identity bridge (NO `gbp_location_id`):**
```sql
CREATE TABLE IF NOT EXISTS mkt_customer_gbp_links (
  id                 VARCHAR PRIMARY KEY,
  customer_id        VARCHAR NOT NULL,
  tenant_id          VARCHAR NOT NULL,
  origin_campaign_id VARCHAR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_customer_gbp_links
  ON mkt_customer_gbp_links (customer_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mkt_customer_gbp_links_tenant
  ON mkt_customer_gbp_links (tenant_id);
```

**ID prefix:** `gbpl` (GBP link) — add `generateQuickStart('gbpl')` at the service layer.

---

### Task 6: Prisma Introspection
**Run after all 5 migrations are applied to the database.**

```bash
cd apps/api
doppler run --config local -- pnpm prisma db pull
doppler run --config local -- pnpm prisma generate
```

**Verify:**
- `schema.prisma` now shows new columns on `gbp_locations_list`, `gbp_reviews`, `gbp_posts`, `gbp_media`
- `schema.prisma` now shows new model `mkt_customer_gbp_links`
- `star_rating` on `gbp_reviews` is `Int?` (not `String?`)
- `cached_average_rating` on `gbp_locations_list` is `Float?`
- Prisma Client types compile

**Per `manual-sql-migration-policy.md`:** NEVER edit `schema.prisma` directly. All schema changes come from SQL migrations applied to DB first, then introspected.

---

### Task 7: `CustomerGBPAccessService`
**File:** `apps/api/src/services/CustomerGBPAccessService.ts`
**Spec ref:** §4 Subsystem 0

**Base class:** `BaseService` (stateless CRUD — no caching needed for bridge resolution)

**Methods:**

```ts
class CustomerGBPAccessService extends BaseService {
  /**
   * Resolve the tenant for a given customer via the bridge.
   * Throws 404 if no bridge link exists.
   */
  async resolveTenant(customerId: string): Promise<{ tenantId: string; linkId: string }>;

  /**
   * Resolve all GBP locations for a customer's tenant.
   * Reconciles tenant_id drift on gbp_locations_list against google_oauth_accounts_list.
   */
  async resolveLocations(customerId: string): Promise<GbpLocation[]>;

  /**
   * v1 convenience: resolve the single location for a customer.
   * Throws if 0 or >1 locations exist (v1 = single-location only).
   */
  async resolveLocation(customerId: string): Promise<GbpLocation>;
}
```

**Tenant ID drift reconciliation (Subsystem 0 step 6):**
```ts
// On resolveLocations, check for drift between gbp_locations_list.tenant_id
// and google_oauth_accounts_list.tenant_id. If drifted, update gbp_locations_list.
const oauthAccount = await prisma.google_oauth_accounts_list.findFirst({
  where: { tenant_id: tenantId }
});
if (oauthAccount) {
  await prisma.gbp_locations_list.updateMany({
    where: { account_id: oauthAccount.id, tenant_id: { not: tenantId } },
    data: { tenant_id: tenantId }
  });
}
```

**Cross-customer isolation:** every method starts with `resolveTenant(customerId)` which queries `mkt_customer_gbp_links` for the customer↔tenant pair. If no link exists, throws 404. This prevents customer A from accessing customer B's tenant resources.

---

### Task 8: `gbp-customer.ts` Route Scaffold
**File:** `apps/api/src/routes/gbp-customer.ts`
**Spec ref:** §8.1

**Pattern:** mirror `marketing-customer.ts` — same `requireCustomerAuth` + `requirePlatformContext` middleware, same double-wrap response contract.

**Registration in `routeRegistry.ts`:**
```ts
import gbpCustomerRoutes from '../routes/gbp-customer';
// ...
{
  path: '/api/customer/marketing/gbp',
  router: gbpCustomerRoutes,
  domain: 'customer',
  authLevel: 'public', // auth handled by requireCustomerAuth middleware inside
  comment: 'GBP customer portal routes — authenticated, platform-context-gated (Phase 0 scaffold)',
},
```

**Phase 0 scaffold — one health-check endpoint only:**
```ts
router.get('/status', requireCustomerAuth, requirePlatformContext, async (req, res) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = await customerGbpAccessService.resolveTenant(customerId);
    res.json({ success: true, data: { tenantId, connected: true, phase: 'scaffold' } });
  } catch (error: any) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'no_gbp_link' });
    }
    res.status(500).json({ success: false, error: 'status_failed' });
  }
});
```

The remaining 11 endpoints from §8.1 are stubs that return 501 `not_implemented` — they'll be filled in Phase 1+.

---

### Task 9: Bridge Provisioning on Campaign Claim
**File:** `apps/api/src/services/MarketingCustomerService.ts` (modify existing)
**Spec ref:** §4 Subsystem 0 + Subsystem 0 provisioning

**Hook into existing claim flow:** when a customer claims a GBP-scoped campaign, provision a `mkt_customer_gbp_links` row linking the customer to the campaign's tenant.

```ts
// In claimAllEligible or registrationClaimSweep, after successful claim:
if (campaignHasGbpScope(campaign)) {
  await prisma.mkt_customer_gbp_links.upsert({
    where: { customer_id_tenant_id: { customer_id: customerId, tenant_id: campaign.tenant_id } },
    create: {
      id: generateQuickStart('gbpl'),
      customer_id: customerId,
      tenant_id: campaign.tenant_id,
      origin_campaign_id: campaign.id,
    },
    update: {}, // idempotent — no-op if link already exists
  });
}
```

**Detection:** a campaign is "GBP-scoped" if its archetype or deliverable type includes GBP management. The exact detection logic depends on the campaign's `campaign_type` / `archetype` fields — verify against `multi-archetype-campaigns` skill doc at implementation time.

---

### Task 10: Unit Tests
**File:** `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts`
**Spec ref:** §10 quality gate #1

**Test cases:**
1. `resolveTenant` — returns tenantId when bridge link exists
2. `resolveTenant` — throws 404 when no bridge link exists (customer has no GBP tenant)
3. `resolveTenant` — throws 404 for foreign customer (customer A cannot resolve customer B's tenant)
4. `resolveLocations` — returns locations for linked tenant
5. `resolveLocations` — reconciles tenant_id drift (gbp_locations_list.tenant_id updated to match google_oauth_accounts_list.tenant_id)
6. `resolveLocation` — returns single location when exactly 1 exists
7. `resolveLocation` — throws when 0 locations exist
8. `resolveLocation` — throws when >1 locations exist (v1 = single-location only)

**File:** `apps/api/src/tests/gbp-customer-routes.test.ts`
**Spec ref:** §10 quality gate #3

**Test cases (mirror `marketing-customer-routes.test.ts` 7-test pattern):**
1. No auth → 401
2. Invalid token → 401
3. Storefront-only context → 403 `context_required`
4. Zero context → 403
5. Platform context → 200 (returns tenantId + connected status)
6. Cross-customer isolation → 404 (customer A hits /status, no bridge link → 404)
7. Double-wrap contract — response shape is `{ success: true, data: { ... } }`

---

## Task Dependency Graph

```
Task 1 (migration 237) ─┐
Task 2 (migration 238) ─┤
Task 3 (migration 239) ─┼── Task 6 (prisma db pull + generate) ──┐
Task 4 (migration 240) ─┤                                        ├── Task 7 (CustomerGBPAccessService) ── Task 8 (route scaffold) ── Task 10b (route tests)
Task 5 (migration 241) ─┘                                        │
                                                                  └── Task 10a (service tests)
Task 2 code-path update (GBPAdvancedSync.storeReviews) ──────────┘  (must complete before Task 6 prisma generate)
Task 9 (bridge provisioning) — depends on Task 5 + Task 7
```

**Critical path:** Tasks 1–5 (migrations) → Task 2 code-path update → Task 6 (prisma) → Task 7 (service) → Task 8 (route) → Task 10 (tests)

**Parallelizable:** Tasks 1–5 can be written in parallel (independent SQL files). Task 9 can be written in parallel with Task 8 (different files).

---

## Verification Gates (sprint exit criteria)

| Gate | Command / Check | Must pass |
|---|---|---|
| Migrations applied | All 5 migration files run against DB without error | ✅ |
| Prisma introspected | `schema.prisma` shows new columns + new model + `star_rating: Int?` | ✅ |
| `star_rating` code-path audit | No `=== 'FIVE'` / `=== 'ONE'` enum comparisons remain in `apps/api` or `apps/web` | ✅ |
| `GBPAdvancedSync.storeReviews` updated | Writes `Int` (1–5) instead of enum string | ✅ |
| TypeScript — API | `cd apps/api && npx tsc --noEmit` — zero new errors | ✅ |
| TypeScript — Web | `cd apps/web && npx tsc --noEmit` — zero new errors | ✅ |
| Unit tests — service | `CustomerGBPAccessService.test.ts` — all 8 tests pass | ✅ |
| Unit tests — routes | `gbp-customer-routes.test.ts` — all 7 tests pass | ✅ |
| Route registered | `GET /api/customer/marketing/gbp/status` returns 200 with platform context | ✅ |
| Bridge provisioning | Claiming a GBP-scoped campaign creates a `mkt_customer_gbp_links` row | ✅ |
| Double-wrap contract | All responses are `{ success: true, data: { ... } }` | ✅ |

---

## Files Created

| File | Type | Task |
|---|---|---|
| `database/migrations/237_gbp_locations_verification.sql` | New | 1 |
| `database/migrations/238_gbp_reviews_intelligence.sql` | New | 2 |
| `database/migrations/239_gbp_posts_lifecycle.sql` | New | 3 |
| `database/migrations/240_gbp_media_location.sql` | New | 4 |
| `database/migrations/241_mkt_customer_gbp_links.sql` | New | 5 |
| `apps/api/src/services/CustomerGBPAccessService.ts` | New | 7 |
| `apps/api/src/routes/gbp-customer.ts` | New | 8 |
| `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts` | New | 10a |
| `apps/api/src/tests/gbp-customer-routes.test.ts` | New | 10b |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Introspected (not hand-edited) — new columns + new model | 6 |
| `apps/api/src/services/GBPAdvancedSync.ts` | `storeReviews` writes `Int` instead of enum string; `Review.starRating` type → `number` | 2 |
| `apps/api/src/routes/routeRegistry.ts` | Register `gbp-customer.ts` at `/api/customer/marketing/gbp` | 8 |
| `apps/api/src/services/MarketingCustomerService.ts` | Bridge provisioning on GBP-scoped campaign claim | 9 |
| Any `star_rating` consumers in `apps/api` + `apps/web` | Enum-string comparisons → numeric | 2 |

---

## Out of Scope (Phase 1+)

- OAuth flow reuse / in-app verification (Phase 1)
- `GBPVerificationService` (Phase 1)
- Customer portal GBP dashboard / pages (Phase 1)
- Review ingestion cron / `GBPReviewReplyService` / Tier A drafts (Phase 2)
- Post scheduler / media upload (Phase 3)
- Capability module registration / BSaaS catalog / directory surfacing (Phase 4)
- Any frontend work (all frontend is Phase 1+)
- Tier B autopilot (Phase 2.5)

---

## Skills to Update After Sprint

Per `end-of-phase-sprint-checklist.md`, after Phase 0 completes:

- `google-integration-and-demo-qr.md` — add note about `CustomerGBPAccessService` bridge resolution pattern for customer-portal GBP access
- `manual-sql-migration-policy.md` — if any migration idempotency issues surfaced, document them
- `tenant-scoped-id-generation.md` — add `gbpl` prefix to the ID catalog
- Consider creating `gbp-customer-bridge.md` if the bridge resolution + drift reconciliation pattern is reusable enough to warrant a dedicated skill
