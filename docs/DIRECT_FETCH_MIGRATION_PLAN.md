# Direct Fetch to Services Migration Plan

## Goal

Eliminate all direct `fetch()` calls in components and pages, replacing them with singleton service methods that extend the platform's domain base classes (`PublicApiSingleton`, `TenantApiSingleton`, `AdminApiSingleton`, etc.). This provides automatic caching, auth header injection, error handling, and cache invalidation.

Reference: [deploy-service-extending-base-singleton.md](../.devin/skills/deploy-service-extending-base-singleton.md)

---

## Scope: 21 Active Fetch Calls (excluding infrastructure)

### Excluded (no action needed)

| Category | Files | Reason |
|---|---|---|
| **Infrastructure** | `lib/api-cache.ts`, `lib/api.ts`, `providers/api/ApiSingletonBase.tsx`, `providers/base/FlexibleApiSingleton.ts` | These ARE the base layer — `fetch` is correct here |
| **Existing services** | `services/OAuthService.ts` (3 calls), `services/ImageFetchService.ts`, `services/downloads/PublicDownloadService.ts` | Already in service layer; OAuth calls external Auth0 endpoints |
| **Disabled/backup** | `*.disabled`, `*.backup` files | Not active code |
| **Commented out** | `ServiceChargesTab.tsx:130`, `DirectoryClient.tsx:401` | Already removed |
| **Test/example** | `test-telemetry-client.ts`, `sentry-example-page/page.tsx` | Test scaffolding |

### Active migration targets

| # | File | Line(s) | Endpoint(s) | Domain |
|---|---|---|---|---|
| 1 | `app/t/[tenantId]/settings/integrations/meta/page.tsx` | 78, 96, 111, 135, 160, 189 | `/api/meta/oauth/*`, `/api/meta/catalog/*` | Tenant |
| 2 | `app/t/[tenantId]/settings/integrations/pixels/page.tsx` | 48, 72 | `/api/social-pixels/:tenantId` (GET, PUT) | Tenant |
| 3 | `components/tracking/SocialPixels.tsx` | 42 | `/api/social-pixels/public/:tenantId` | Public |
| 4 | `components/bot/BotOptionsPage.tsx` | 89, 116 | `/api/tenants/:tenantId/chatbot-options` (GET, PUT) | Tenant |
| 5 | `components/faq/FaqControlPanel.tsx` | 49 | `/api/tenants/:tenantId/faqs/coverage` | Tenant |
| 6 | `components/faq/FaqBotPreview.tsx` | 41 | `/api/public/bot/preview` | Public |
| 7 | `app/checkout/page.tsx` | 416 | `/api/tax/calculate` | Customer |
| 8 | `app/privacy/ccpa/page.tsx` | 24 | `/api/ccpa/opt-out-sale` | Public |
| 9 | `lib/cart/cartManager.ts` | 18 | `/api/cart/track` | Customer |
| 10 | `lib/directory-helpers.ts` | 23 | `/api/directory/tenant/:tenantId` | Public |
| 11 | `lib/error-reporter.ts` | 121 | Configurable error endpoint | System |
| 12 | `utils/universal-transform.ts` | 92 | Configurable transform URL | External |
| 13 | `providers/StoreProviderSingleton.tsx` | 126 | `/api/stores/batch` | Tenant |
| 14 | `services/PlatformHomeSingletonService.ts` | 696 | `/api/revalidate` | System |

---

## Phase 1: Social Commerce Integration Services

**Target:** Items #1, #2, #3 (9 fetch calls — the largest cluster)

### 1A: `MetaIntegrationService.ts` (new)

- **Base class:** `TenantApiSingleton`
- **Singleton key:** `meta-integration-service`
- **TTL:** 5 min (OAuth status changes should be fresh)
- **Methods:**
  - `getOAuthStatus(tenantId)` → GET `/api/meta/oauth/status?tenantId=`
  - `getCatalogSyncStatus(tenantId)` → GET `/api/meta/catalog/sync-status?tenantId=`
  - `getBusinesses(tenantId)` → GET `/api/meta/oauth/businesses?tenantId=`
  - `disconnectOAuth(tenantId)` → POST `/api/meta/oauth/disconnect` (invalidates cache)
  - `linkCatalog(tenantId, payload)` → POST `/api/meta/oauth/link-catalog` (invalidates cache)
  - `syncCatalog(tenantId)` → POST `/api/meta/catalog/sync` (invalidates cache)
- **Cache patterns:** `meta-oauth-status-*`, `meta-sync-status-*`, `meta-businesses-*`
- **Migration target:** `app/t/[tenantId]/settings/integrations/meta/page.tsx`
- **Estimated effort:** ~2 hours

### 1B: `SocialPixelsService.ts` (new)

- **Base class:** `TenantApiSingleton`
- **Singleton key:** `social-pixels-service`
- **TTL:** 10 min
- **Methods:**
  - `getPixelConfig(tenantId)` → GET `/api/social-pixels/:tenantId`
  - `updatePixelConfig(tenantId, payload)` → PUT `/api/social-pixels/:tenantId` (invalidates cache)
  - `getPublicPixelConfig(tenantId)` → GET `/api/social-pixels/public/:tenantId` (public, no auth)
- **Cache patterns:** `social-pixels-*`, `social-pixels-public-*`
- **Migration targets:**
  - `app/t/[tenantId]/settings/integrations/pixels/page.tsx` (authenticated methods)
  - `components/tracking/SocialPixels.tsx` (public method)
- **Note:** The public endpoint method can use `makePublicRequest` even within a `TenantApiSingleton` by overriding the request type per-call, or split into a separate `PublicSocialPixelsService` extending `PublicApiSingleton`. Recommend the latter for clean separation.
- **Estimated effort:** ~1.5 hours

### Phase 1 verification
- `npx tsc --noEmit --project apps/web/tsconfig.json` — zero new errors
- Manual test: Meta integration page load, connect/disconnect, catalog sync
- Manual test: Pixels settings page load, save config
- Manual test: Storefront page loads with SocialPixels component

---

## Phase 2: Bot & FAQ Services

**Target:** Items #4, #5, #6 (4 fetch calls)

### 2A: Extend `BotService.ts` (existing)

- **Current base:** Already extends a singleton base
- **Add methods:**
  - `getChatbotOptions(tenantId)` → GET `/api/tenants/:tenantId/chatbot-options`
  - `updateChatbotOptions(tenantId, payload)` → PUT `/api/tenants/:tenantId/chatbot-options`
- **Migration target:** `components/bot/BotOptionsPage.tsx`
- **Estimated effort:** ~30 min

### 2B: Extend `FaqService.ts` (existing)

- **Add methods:**
  - `getCoverageMetrics(tenantId)` → GET `/api/tenants/:tenantId/faqs/coverage`
- **Migration target:** `components/faq/FaqControlPanel.tsx`
- **Estimated effort:** ~20 min

### 2C: Extend `PublicBotService.ts` (existing)

- **Add methods:**
  - `previewBot(payload)` → POST `/api/public/bot/preview`
- **Migration target:** `components/faq/FaqBotPreview.tsx`
- **Estimated effort:** ~20 min

### Phase 2 verification
- `npx tsc --noEmit --project apps/web/tsconfig.json`
- Manual test: Bot options page toggle/save
- Manual test: FAQ coverage panel loads
- Manual test: FAQ bot preview sends message

---

## Phase 3: Checkout & Cart Services

**Target:** Items #7, #9 (2 fetch calls)

### 3A: Extend `CheckoutService.ts` (existing)

- **Add methods:**
  - `calculateTax(payload)` → POST `/api/tax/calculate`
- **Migration target:** `app/checkout/page.tsx`
- **Note:** Tax calculation should NOT be cached (real-time). Use `makeDefaultRequest` with no cache key.
- **Estimated effort:** ~30 min

### 3B: Cart tracking

- **Options:**
  - **A (preferred):** Add `trackEvent(eventType, payload)` to existing cart service or `BehaviorTrackingService.ts`
  - **B (minimal):** Keep as-is — fire-and-forget tracking call that doesn't need caching/auth headers
- **Recommendation:** Option A if a cart service exists; Option B if the call is truly fire-and-forget
- **Migration target:** `lib/cart/cartManager.ts`
- **Estimated effort:** ~20 min

### Phase 3 verification
- `npx tsc --noEmit --project apps/web/tsconfig.json`
- Manual test: Checkout page tax calculation
- Manual test: Add to cart fires tracking

---

## Phase 4: Privacy & Public Services

**Target:** Items #8, #10 (2 fetch calls)

### 4A: `CcpaService.ts` (new) or extend `GDPRSingletonService.ts`

- **Base class:** `PublicApiSingleton` (no auth required for opt-out submission)
- **Methods:**
  - `submitOptOutSale(payload)` → POST `/api/ccpa/opt-out-sale`
- **Migration target:** `app/privacy/ccpa/page.tsx`
- **Estimated effort:** ~20 min

### 4B: `directory-helpers.ts` → use existing `DirectorySingletonService`

- **Current state:** `fetchTenantDirectorySlug()` is a standalone function in `lib/`
- **Migration:** Replace internal `fetch()` with `DirectorySingletonService.getInstance().getTenantBySlug(tenantId)` or equivalent
- **Note:** This function is used in SSR/middleware contexts. Verify the singleton is SSR-safe (base classes guard `localStorage`/`window`). If SSR-unsafe, keep the raw fetch but wrap with `lib/api.ts` helper instead.
- **Estimated effort:** ~30 min

### Phase 4 verification
- `npx tsc --noEmit --project apps/web/tsconfig.json`
- Manual test: CCPA opt-out form submission
- Manual test: Directory slug resolution in SSR

---

## Phase 5: Internal Infrastructure Fetches

**Target:** Items #11, #12, #13, #14 (4 fetch calls)

These are lower priority because they're in lib/provider layers, not user-facing components.

### 5A: `error-reporter.ts`

- **Assessment:** Error reporter is infrastructure — it needs to work even when services fail. Wrapping in a singleton that might itself fail is risky.
- **Recommendation:** Keep as direct `fetch()` but route through `lib/api.ts` helper for consistency. Add a comment explaining why this stays outside the singleton pattern.
- **Estimated effort:** ~10 min

### 5B: `universal-transform.ts`

- **Assessment:** Fetches from external/transform URLs. Already has its own URL parameter.
- **Recommendation:** Migrate to `ExternalApiSingleton` if it's called from multiple places, or keep as-is if isolated.
- **Estimated effort:** ~30 min

### 5C: `StoreProviderSingleton.tsx`

- **Assessment:** Provider-level singleton that fetches store batch data. Should use `TenantApiSingleton` pattern.
- **Recommendation:** Replace internal `fetch()` with `makeDefaultRequest`. The provider already manages its own state; just swap the fetch mechanism.
- **Estimated effort:** ~30 min

### 5D: `PlatformHomeSingletonService.ts` revalidate call

- **Assessment:** Internal cache invalidation call to `/api/revalidate`. This is a system-to-system call within an existing singleton.
- **Recommendation:** Use `makeSystemRequest` or `makeDefaultRequest` with system request type instead of raw `fetch()`.
- **Estimated effort:** ~15 min

### Phase 5 verification
- `npx tsc --noEmit --project apps/web/tsconfig.json`
- Manual test: Error reporting still works (trigger a client error)
- Manual test: Store provider loads data correctly
- Manual test: Platform home revalidation triggers

---

## Execution Strategy

### Ordering

1. **Phase 1** first — largest cluster (9 calls), all in one feature domain, clear new-service boundaries
2. **Phase 2** second — extends existing services, low effort, quick wins
3. **Phase 3** third — checkout is critical path, needs careful testing
4. **Phase 4** fourth — low-traffic pages, low risk
5. **Phase 5** last — infrastructure layer, highest risk of regression

### Per-phase checklist

For each migration item:

1. Create or extend the service method
2. Replace `fetch()` call in the component with `Service.getInstance().method()`
3. Remove `API_BASE_URL` import if no longer needed
4. Remove inline response parsing (`.json()`, `res.ok` checks) — base class handles this
5. Remove inline `credentials: 'include'` — base class injects auth headers
6. Run `npx tsc --noEmit --project apps/web/tsconfig.json`
7. Manual test the affected page/component

### Anti-patterns to avoid

- **Don't** create a service that just wraps `fetch()` with no caching — use `makeDefaultRequest` with cache keys
- **Don't** cache mutation endpoints (POST/PUT/DELETE) — pass no cache key for writes
- **Don't** forget `invalidateServiceCaches()` after mutations in `TenantApiSingleton` services
- **Don't** remove error handling in components — services return data, but UI still needs loading/error states
- **Don't** migrate `lib/api.ts` or `providers/base/` — these are the foundation

---

## Summary

| Phase | Fetch calls | New services | Extended services | Effort |
|---|---|---|---|---|
| 1: Social Commerce | 9 | 2 | 0 | ~3.5 hrs |
| 2: Bot & FAQ | 4 | 0 | 3 | ~1.2 hrs |
| 3: Checkout & Cart | 2 | 0 | 1-2 | ~50 min |
| 4: Privacy & Public | 2 | 0-1 | 1 | ~50 min |
| 5: Infrastructure | 4 | 0 | 2-3 | ~1.5 hrs |
| **Total** | **21** | **2-3** | **7-9** | **~8 hrs** |
