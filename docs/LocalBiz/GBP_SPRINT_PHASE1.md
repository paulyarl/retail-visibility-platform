# GBP Authorized Management Suite — Sprint Plan: Phase 1

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 1 — OAuth & In-App Verification Flow
**Prerequisite:** Phase 0 complete (migrations 237–241 applied, `CustomerGBPAccessService` + `gbp-customer.ts` scaffold exist)
**Status:** Planning

---

## Sprint Goal

Deliver the **customer-facing OAuth + verification flow** so a customer can connect their Google Business Profile, see verification status, and complete PIN-based verification — all through the customer portal without touching tenant settings.

Phase 1 produces:
1. `GBPVerificationService` — fetchVerificationOptions / start / complete
2. OAuth connection reuse via the existing tenant OAuth stack (no parallel stack)
3. `/account/marketing/gbp/` dashboard shell with verification status indicator + PIN dialog
4. Verification milestone alert + `directory_seed` → `independent` standing flip
5. 4 customer-facing API endpoints (status, verification options/start/complete)

---

## Pre-Flight Checklist

### Skills to read
| Skill | Why |
|---|---|
| `google-integration-and-demo-qr.md` | Existing tenant OAuth flow + GBP API patterns |
| `directory-presence-seed-claim.md` | `directory_seed` → `independent` standing flip on verification |
| `alerts-and-notifications.md` | Verification milestone CRM alert |
| `deploy-service-extending-base-singleton.md` | Frontend `MarketingCustomerService` gains GBP methods |

### Phase 0 handoff verification
- [ ] `CustomerGBPAccessService.resolveTenant()` works — returns tenantId for bridged customers
- [ ] `gbp-customer.ts` registered at `/api/customer/marketing/gbp` with `/status` endpoint
- [ ] `gbp_locations_list` has `verification_state` column (migration 237)
- [ ] `gbp_locations_list.tenant_id` is populated (backfilled from `google_oauth_accounts_list`)

---

## Task Breakdown

### Task 1: `GBPVerificationService`
**File:** `apps/api/src/services/GBPVerificationService.ts`
**Spec ref:** §4 Subsystem 1

**Base class:** `BaseService` (stateless — delegates to Google API)

**Methods:**
```ts
class GBPVerificationService extends BaseService {
  // Fetch available verification options (SMS, CALL, MAIL, PIN)
  async fetchOptions(tenantId: string): Promise<VerificationOption[]>;

  // Trigger a verification request to Google
  async start(tenantId: string, option: VerificationOption): Promise<{ pending: boolean }>;

  // Submit PIN code to complete verification
  async complete(tenantId: string, pin: string): Promise<{ verified: boolean }>;
}
```

**State machine (stored on `gbp_locations_list.verification_state`):**
```
UNVERIFIED → PENDING (on start) → COMPLETED (on complete success) | FAILED (on complete failure)
```

**On `COMPLETED`:**
1. Update `gbp_locations_list.verification_state = 'COMPLETED'`
2. Elevate `directory_seed` → `independent` standing mode (if the tenant's `org_standing_mode` is `directory_seed`)
3. Fire `gbp_verification_milestone` CRM alert via `CrmAlertService`

**Google API endpoints (verified from existing `GBPAdvancedSync.ts` patterns):**
- `GET {GBP_API}/v1/verifications/{name}` — fetch options
- `POST {GBP_API}/v1/verifications` — start verification
- `POST {GBP_API}/v1/verifications/{name}:complete` — submit PIN

**Token reuse:** uses `getValidAccessToken(tenantId)` from `GBPAdvancedSync.ts` — same token store, no parallel OAuth.

---

### Task 2: Wire 4 Customer Endpoints in `gbp-customer.ts`
**File:** `apps/api/src/routes/gbp-customer.ts` (modify — replace Phase 0 stubs)
**Spec ref:** §8.1 rows 1–4

**Endpoints to implement (replacing 501 stubs):**
| Method | Route | Delegates to |
|---|---|---|
| `GET` | `/status` | `GBPBusinessInfoSync.getSyncStatus` + `gbp_locations_list` row (with `verification_state`, `cached_average_rating`, `cached_review_count`) |
| `GET` | `/verification/options` | `GBPVerificationService.fetchOptions` |
| `POST` | `/verification/start` | `GBPVerificationService.start` |
| `POST` | `/verification/complete` | `GBPVerificationService.complete` (fires milestone alert + standing flip) |

**Pattern:** every handler calls `customerGbpAccessService.resolveTenant(customerId)` first, then delegates to the service with the resolved `tenantId`. Same `requireCustomerAuth` + `requirePlatformContext` middleware as Phase 0.

**Double-wrap:** all responses are `{ success: true, data: { ... } }`.

---

### Task 3: Frontend Service Methods
**File:** `apps/web/src/services/MarketingCustomerService.ts` (modify existing)
**Spec ref:** §9 frontend deliverables

**New methods:**
```ts
getGbpStatus(): Promise<GbpStatusResponse>;
getVerificationOptions(): Promise<VerificationOption[]>;
startVerification(option: VerificationOption): Promise<{ pending: boolean }>;
completeVerification(pin: string): Promise<{ verified: boolean }>;
```

**Pattern:** extends `CustomerApiSingleton` (same as existing portal methods). Calls hit `/api/customer/marketing/gbp/*`. Unwrap via `result.data?.data ?? result.data`.

---

### Task 4: Customer Portal Dashboard Shell
**Files:**
- `apps/web/src/app/account/marketing/gbp/page.tsx` — dashboard shell
- `apps/web/src/app/account/marketing/gbp/VerificationStatusCard.tsx` — verification state indicator
- `apps/web/src/app/account/marketing/gbp/PinDialog.tsx` — PIN entry modal

**Spec ref:** §9 Phase 1 frontend

**Dashboard contents:**
- **Connection status card** — "Google Business Profile Connected" / "Not Connected" with link to OAuth
- **Verification status indicator** — `UNVERIFIED` (yellow), `PENDING` (blue), `COMPLETED` (green), `FAILED` (red)
- **PIN dialog** — triggered when verification is `PENDING`; customer enters PIN code → calls `completeVerification`
- **Location metadata** — business name, address, phone (read from `gbp_locations_list`)
- **Aggregate rating display** — `cached_average_rating` + `cached_review_count` (from migration 237)

**UI conventions:** Tailwind + `@/components/ui/*` (customer portal pattern, NOT Mantine).

---

### Task 5: Customer Sidebar Navigation
**File:** `apps/web/src/components/customer/CustomerSidebar.tsx` (modify existing)
**Spec ref:** §9 frontend deliverables

**Add "Google Business" nav group** under the platform-context section:
- "GBP Dashboard" → `/account/marketing/gbp/`
- Signal-gated: visible only when `hasPlatformContext` is true (same pattern as "My Services" group)

---

### Task 6: Verification Milestone Alert + Standing Flip
**Files:**
- `apps/api/src/services/GBPVerificationService.ts` (in `complete` method — Task 1)
- `apps/api/src/services/CrmAlertService.ts` (reuse existing — no new alert infrastructure)

**Alert type:** `gbp_verification_milestone`
**Target:** platform-scope alert visible to the customer in their portal alerts page
**Standing flip:** on `COMPLETED`, if `tenants.org_standing_mode = 'directory_seed'`, update to `'independent'`

---

### Task 7: Unit Tests
**File:** `apps/api/src/services/__tests__/GBPVerificationService.test.ts`
**Spec ref:** §10 quality gate #2

**Test cases:**
1. `fetchOptions` — returns verification options from Google API
2. `start` — transitions `UNVERIFIED` → `PENDING` on `gbp_locations_list.verification_state`
3. `complete` (success) — transitions `PENDING` → `COMPLETED`
4. `complete` (failure) — transitions `PENDING` → `FAILED`
5. `complete` (success) — fires `gbp_verification_milestone` CRM alert
6. `complete` (success) — flips `directory_seed` → `independent` standing mode
7. PIN retry limit — rejects after N failed attempts (Google API enforced)

**File:** `apps/api/src/tests/gbp-customer-routes.test.ts` (extend Phase 0 tests)
**New test cases:**
8. `GET /status` — returns 200 with verification_state + cached rating
9. `GET /verification/options` — returns 200 with options array
10. `POST /verification/start` — returns 200 with pending status
11. `POST /verification/complete` — returns 200 with verified status

---

## Task Dependency Graph

```
Task 1 (GBPVerificationService) ── Task 2 (wire endpoints) ── Task 7 (tests)
                                         │
Task 3 (frontend service methods) ──────┤
                                         │
Task 4 (dashboard shell) ───────────────┤
                                         │
Task 5 (sidebar nav) ───────────────────┘
                                         
Task 6 (alert + standing flip) ── integrated into Task 1
```

**Critical path:** Task 1 → Task 2 → Task 3 → Task 4 → Task 7

---

## Verification Gates

| Gate | Must pass |
|---|---|
| `GBPVerificationService` state machine tests | All 7 tests pass |
| Route tests | All 4 new tests pass (11 total with Phase 0) |
| `pnpm checkapi` | Zero new errors |
| `pnpm checkweb` | Zero new errors |
| `/account/marketing/gbp/` renders | Dashboard shell loads with connection + verification status |
| Sidebar nav | "Google Business" group visible with platform context |
| Verification flow | Customer can fetch options → start → enter PIN → see `COMPLETED` |
| Standing flip | `directory_seed` tenant flips to `independent` on verification |
| Alert fires | `gbp_verification_milestone` alert appears in customer portal alerts |
| Double-wrap contract | All responses are `{ success: true, data: { ... } }` |

---

## Files Created

| File | Task |
|---|---|
| `apps/api/src/services/GBPVerificationService.ts` | 1 |
| `apps/web/src/app/account/marketing/gbp/page.tsx` | 4 |
| `apps/web/src/app/account/marketing/gbp/VerificationStatusCard.tsx` | 4 |
| `apps/web/src/app/account/marketing/gbp/PinDialog.tsx` | 4 |
| `apps/api/src/services/__tests__/GBPVerificationService.test.ts` | 7 |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/src/routes/gbp-customer.ts` | Replace 4 stubs with real endpoints | 2 |
| `apps/web/src/services/MarketingCustomerService.ts` | Add 4 GBP methods | 3 |
| `apps/web/src/components/customer/CustomerSidebar.tsx` | Add "Google Business" nav group | 5 |

---

## Out of Scope (Phase 2+)

- Review ingestion / reply engine / Tier A drafts (Phase 2)
- Post scheduler / media upload (Phase 3)
- Capability registration / BSaaS / directory surfacing (Phase 4)
- Tier B autopilot (Phase 2.5)
