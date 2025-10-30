# 🛠️ Retail Visibility Platform — v3.6 Technical Requirements (Implementation‑Ready)
**Date:** 2025‑10‑29  
**Version:** v3.6‑TR‑Draft‑1  
**Editor:** Retail Spec & Outreach GPT  
**Purpose:** Convert v3.6 Retrofit Canvas into concrete, testable technical requirements with API contracts, migration plans, RLS policies, flags, observability, and acceptance criteria.

---

## 0) Traceability & Scope
```yaml
source:
  master_spec: v3.6-prelaunch
  retrofit_canvas: v3.6-Retrofit-Draft-1
coverage:
  critical: [REQ-2025-905, REQ-2025-906, REQ-2025-907]
  high: [REQ-2025-908, ENH-2026-041, ENH-2026-042, ENH-2026-044]
  medium: [REQ-2026-010, REQ-2025-910, GAP-2025-004, GAP-2025-005, GAP-2025-001]
```

**Spec→Tech→Ticket Matrix**
| Spec ID | Technical Requirement ID | Ticket Key (placeholder) | Owner |
|---|---|---|---|
| REQ‑2025‑905 | TR‑905‑CSRF‑COOKIES | API‑SEC‑401 | Security Eng |
| REQ‑2025‑906 | TR‑906‑ADMIN‑AUD | AUTH‑521 | Security Eng |
| REQ‑2025‑907 | TR‑907‑TENANT‑CTX | WEB‑PLAT‑312 | Backend Lead |
| REQ‑2025‑908 | TR‑908‑ISR‑REVAL | PLAT‑EDGE‑144 | Platform Eng |
| REQ‑2026‑010 | TR‑010‑BUSINESS‑PROFILE | API‑TNT‑233 | Backend/API |
| ENH‑2026‑041 | TR‑041‑MAPCARD | FE‑COMP‑189 | Frontend |
| ENH‑2026‑042 | TR‑042‑SWIS‑PREVIEW | FE‑COMP‑190 | Frontend |
| ENH‑2026‑044 | TR‑044‑GOOGLE‑CONNECT | INT‑GGL‑277 | API Lead |
| REQ‑2025‑910 | TR‑910‑A11Y | QA‑A11Y‑118 | QA Lead |
| GAP‑2025‑004 | TR‑CI‑DRIFT‑004 | DEVOPS‑CI‑072 | DevOps |
| GAP‑2025‑005 | TR‑RUM‑WEIGHT‑005 | WEB‑OBS‑054 | Frontend/DevOps |
| GAP‑2025‑001 | TR‑AUDIT‑CHAIN‑001 | API‑LOG‑266 | SRE |

---

## 1) TR‑907‑TENANT‑CTX — SSR Tenant Context & Routing
**Goal:** Replace client storage context with SSR resolution and request‑scoped tenant context.

### 1.1 Requirements
- Routes use canonical pattern: `/t/{tenantId}/...`.
- Middleware resolves `tenant_id` by `tenantId` (DB lookup, 404 if missing).
- Set signed, HttpOnly session cookie `tcx` containing `{tenant_id, tenant_slug, aud}`.
- Prohibit localStorage as source of truth for tenant context; keep only as *hint* for preselecting in switcher.
- Inject `tenantContext` via Next.js server components; provide React context for client components.
- Header **Tenant Switcher** updates URL and persists preference to localStorage as hint.

### 1.2 Routing & Redirect Map
| Old Route | New Canonical | Notes |
|---|---|---|
| `/items` | `/t/{tenantId}/items` | Redirect 301 with tenant resolution guard |
| `/settings/tenant` | `/t/{tenantId}/settings/tenant` | Guarded: requires valid `tcx` |
| `/tenants/users` | `/t/{tenantId}/users` | Replace legacy push logic |
| `/onboarding?tenantId=tid` | `/onboarding?tenantId={tid}` → on complete → `/t/{tid}/settings/tenant` | Backward compatible |

### 1.3 API/Infra
- **Middleware:** `src/middleware/tenantResolver.ts` (Edge‑safe).
- **Header Contract:** `x-tenant-id` added to internal API calls by central client.
- **RLS Binding:** Postgres `auth.tenant_id` set from session on API gateway.
- **Feature Flags:**
  - `FF_TENANT_URLS` — enable canonical URL routing.
  - `FF_APP_SHELL_NAV` — enable new App Shell (header/switcher/nav) variants.

### 1.4 Default Tenant Resolution
- Single tenant → auto‑redirect to `/t/{id}/` on generic pages.
- Multiple tenants → route to `/tenants` selector; on choose, push to `/t/{id}/...`.

### 1.5 Acceptance
- All protected endpoints return 403 without valid `tcx`.
- SSR pages render correct tenant data on first paint; no flicker.
- E2E: cross‑tenant access blocked (negative tests).
- URL becomes the authoritative context; localStorage used only as hint.
- All protected endpoints return 403 without valid `tcx`.
- SSR pages render correct tenant data on first paint; no flicker.
- E2E: cross‑tenant access blocked (negative tests).

---

## 2) TR‑906‑ADMIN‑AUD — Admin Audience & Step‑Up Auth
**Goal:** Separate JWT audiences and add step‑up auth for sensitive admin actions.

### 2.1 Auth Model
- JWT `aud` values: `user`, `admin`.
- Admin console routes gated by `aud = admin` claim.
- Step‑up flow: on sensitive endpoints, require fresh `amr=step_up` token issued ≤5 min.

### 2.2 Sensitive Endpoints (min set)
- `/api/admin/export/*`, `/api/admin/policies/*`, `/api/admin/tenants/*` `PATCH|DELETE`.

### 2.3 Token Issuance
```json
{
  "aud": "admin",
  "amr": ["pwd","step_up"],
  "nonce": "<uuid>",
  "iat": 1730160000,
  "exp": 1730160300
}
```

### 2.4 Client Implementation
- Central API client intercepts 401 with `error=step_up_required`, prompts step‑up modal, exchanges for fresh admin token, replays request.
- Remove unused NextAuth route to reduce confusion.

### 2.5 Acceptance
- Admin routes reject `aud=user` with 403.
- Step‑up expires after 5 minutes; audit entries recorded.
- 401 step‑up flow succeeds via client re‑try path.
- Admin routes reject `aud=user` with 403.
- Step‑up expires after 5 minutes; audit entries recorded.

---

## 3) TR‑905‑CSRF‑COOKIES — CSRF & Cookie Isolation
**Goal:** Enforce CSRF tokens for all write operations and scope cookies to `app.`.

### 3.1 Cookies
- `session` cookie: `Domain=app.retailvisibility.com; Secure; HttpOnly; SameSite=Lax`.
- Marketing cookies only on `www.`; enforcement in response middleware.

### 3.2 CSRF
- Double‑submit or synchronizer token pattern via `x-csrf-token` header and cookie `csrf`.
- All `POST|PATCH|DELETE` validate CSRF; fail with 403 and `error=csrf_missing_or_invalid`.

### 3.3 Acceptance
- Automated test suite covers all write routes.
- Spot‑check confirms no cookies set on `www.` from app responses.

---

## 4) TR‑010‑BUSINESS‑PROFILE — Tenant Business Profile Module
**Goal:** Provide NAP and SEO‑ready data at onboarding and in settings.

### 4.1 Schema
```sql
CREATE TABLE IF NOT EXISTS tenant_business_profile (
  tenant_id uuid PRIMARY KEY REFERENCES tenant(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text,
  postal_code text NOT NULL,
  country_code char(2) NOT NULL,
  phone_number text,
  email text,
  website text,
  contact_person text,
  hours jsonb,
  social_links jsonb,
  seo_tags jsonb,
  latitude numeric,
  longitude numeric,
  display_map boolean NOT NULL DEFAULT false,
  map_privacy_mode text NOT NULL DEFAULT 'precise',
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 4.2 APIs
| Method | Path | Auth | Body (Zod) | Notes |
|---|---|---|---|---|
| POST | `/api/tenant/profile` | tenant | `BusinessProfileCreate` | Create/Upsert |
| GET | `/api/tenant/profile` | tenant | — | Read 1:1 |
| PATCH | `/api/tenant/profile` | tenant | `BusinessProfileUpdate` | Partial update |

### 4.3 Validation
- Phone E.164, email RFC 5322, website `https://` enforced.
- Duplicate prevention: `(business_name, postal_code)` unique per country.

### 4.4 Acceptance
- Wizard step persists profile and advances; settings page syncs same API.

---

## 5) TR‑041‑MAPCARD — Map Location Card
**Goal:** Render location with privacy control.

### 5.1 APIs
- `POST /tenant/profile/geocode` (internal) — triggers geocode & caches `lat,lng`.
- `PATCH /tenant/profile` accepts `display_map`, `map_privacy_mode` (`precise|neighborhood`).

### 5.2 Frontend
- Component `<MapCard />` with static‑map fallback; CTA "Get Directions".
- Feature Flag: `FF_MAP_CARD`.

### 5.3 Acceptance
- p95 load < 250 ms with cached static map.
- Keyboard accessible; alt text & focus outline present.

---

## 6) TR‑042‑SWIS‑PREVIEW — Public SWIS Preview Widget
**Goal:** Read‑only, sanitized inventory preview for tenant page.

### 6.1 API
| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/tenant/swis/preview` | `limit<=24`, `sort` | `[{ sku, title, brand, price, currency, image_url, availability, updated_at, category_path? }]` |

- Public‑safe via signed route; no cost/PII.
- Backed by `swis_feed_view`.

### 6.2 Frontend
- Component `<SwisPreview limit=12 />`; cards mirror public catalog.
- Feature Flag: `FF_SWIS_PREVIEW` (A/B at 20%).

### 6.3 Acceptance
- p95 render < 300 ms, CTR ≥ 25% to catalog.

---

## 7) TR‑044‑GOOGLE‑CONNECT — GMC/GBP OAuth Suite
**Goal:** Unified Google connect with scope governance and rollback.

### 7.1 Data & Migrations
- Tables: `google_oauth_accounts`, `google_oauth_tokens`, `google_merchant_links`, `gbp_locations`, `gbp_insights_daily`, `feed_sync_jobs.source`.

### 7.2 OAuth
- Scopes: `content`, `business.manage`, `openid email profile`.
- Token rotation every 90d; revoke on unlink; alerts on expiry.

### 7.3 Acceptance
- Feed success ≥95%; insights fetch failure <10%.
- Rollback script validated end‑to‑end.

---

## 8) TR‑908‑ISR‑REVAL — Event‑Driven Revalidation
**Goal:** Revalidate public pages within 60 s of relevant data changes.

### 8.1 Mechanism
- On `inventory_item` or `tenant_business_profile` change → publish domain event → edge revalidate route `/t/{tenant}`.

### 8.2 Acceptance
- TTL ≤ 60 s from write to visible change on public page in pilot env.

---

## 9) TR‑910‑A11y — Accessibility Baseline
**Goal:** Achieve WCAG 2.1 AA across new components and pages.

### 9.1 Checks
- Labels, roles, focus management; color contrast ≥ 4.5:1.
- Screen reader pass (VoiceOver/NVDA). Lighthouse ≥ 95; AXE critical = 0.

---

## 10) TR‑CI‑DRIFT‑004 — Schema Drift Detection
**Goal:** Nightly diff against production snapshot.

### 10.1 Pipeline
- Job `schema-drift-nightly` compares migration head to `PROD_DB_SNAPSHOT_URL`; uploads artifact & posts Slack summary.

### 10.2 Acceptance
- Failing diff blocks release branch creation; manual override requires approver.

---

## 11) TR‑RUM‑WEIGHT‑005 — Tenant‑Weighted RUM
**Goal:** Weighted sampling to avoid small‑tenant starvation.

### 11.1 Logic
- Minimum floor samples per tenant/day; weight by traffic tiers.

### 11.2 Acceptance
- Dashboard shows uniform coverage; error budgets per tenant populated.

---

## 12) TR‑AUDIT‑CHAIN‑001 — Structured Logs & Audit Chain
**Goal:** 99%+ write‑path auditability with PII scrubbing.

### 12.1 Table
```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_type text CHECK (actor_type IN ('user','system','integration')) NOT NULL,
  actor_id text NOT NULL,
  tenant_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text CHECK (action IN ('create','update','delete','sync','policy_apply')) NOT NULL,
  request_id text,
  ip inet,
  user_agent text,
  diff jsonb NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  pii_scrubbed boolean NOT NULL DEFAULT true
);
```

### 12.2 Acceptance
- ≥99% of write actions emit audit row with `request_id` and `tenant_id`.

---

## 13) Central API Client & Error Handling (Cross‑cutting)
**Goal:** Single client with retry, auth refresh, and toast errors.

### 13.1 Requirements
- Exponential backoff; circuit breaker for OAuth dependencies.
- Attaches `x-tenant-id`, `x-request-id`, `x-csrf-token` automatically.

### 13.2 Acceptance
- Contract tests simulate 429/5xx with retries and user feedback.

---

## 14) Feature Flags & Config
```yaml
flags:
  FF_MAP_CARD: default=false
  FF_SWIS_PREVIEW: default=false
  FF_GOOGLE_CONNECT_SUITE: default=false
  FF_TENANT_URLS: default=false
  FF_APP_SHELL_NAV: default=false
  FF_SCHEMA_V34_READY: default=true (post‑migration)
rollout:
  strategy: pilot → percentage → 100%
  cohorts:
    - name: Pilot-20
      filters: [region: us-east-1]
      flags: [FF_TENANT_URLS, FF_APP_SHELL_NAV, FF_GOOGLE_CONNECT_SUITE]
```yaml
flags:
  FF_MAP_CARD: default=false
  FF_SWIS_PREVIEW: default=false
  FF_GOOGLE_CONNECT_SUITE: default=false
  FF_SCHEMA_V34_READY: default=true (post‑migration)
```

---

## 15) Observability & Dashboards
```yaml
metrics:
  swis_preview_p95_ms: timer
  feed_push_success_rate: counter
  oauth_error_rate: counter
  business_profiles_created: counter
  profiles_completed_pct: gauge
  audit_coverage_pct: gauge
  rum_coverage_by_tenant: gauge
```
Dashboards: `rvp_google_connect_suite_v1`, `rvp_swis_quality`, `rvp_rum_weighted`.

Alerts: warn/crit thresholds aligned to spec (e.g., OAuth 5%/10%).

---

## 16) Test Plan (Summary)
| Suite | Key Cases |
|---|---|
| Unit | token issuance, CSRF middleware, API validation schemas |
| Integration | `/tenant/profile` CRUD, SWIS preview signed route, SSR tenant resolver |
| E2E | Tenant switching, admin step‑up, public page ISR refresh |
| Security | CSRF bypass attempts, origin spoofing, JWT audience mixing |
| A11y | Keyboard traversal, screen reader, contrast |
| Perf | p95 preview render, ISR invalidation latency |

---

## 17) Rollout & Recovery
**Canary:** Pilot‑20 with flags on → monitor 48h → Wave‑1.  
**Rollback:** Flip flags off → revoke Google tokens → reverse migrations set → cache purge → smoke tests.

---

## 18) Definition of Done (Global)
- All Acceptance Criteria (per TR) pass.
- Dashboards & alerts live; evidence exported to audit vault.
- Changelog created; tickets closed with links to PRs and test artifacts.

---

### Next Step
Create implementation tickets from the Spec→Tech→Ticket Matrix and attach this document to each epic. Populate owners/due dates and start canary build preparation.


---

## 19) Central API Client Standardization (Target Auth Consolidation)
**ID:** TR‑API‑CLIENT‑STD  
**Goal:** Single fetch client that injects bearer token, handles 401 refresh, and centralizes error handling.

### 19.1 Requirements
- Auto‑attach `Authorization: Bearer <access_token>`.
- On 401: try refresh once; if `step_up_required`, trigger step‑up modal.
- Always attach `x-tenant-id`, `x-request-id`, and (for writes) `x-csrf-token`.
- Max retries for 429/5xx: 2 with exponential backoff.

### 19.2 Acceptance
- Contract tests cover 401 refresh and step‑up retry.
- Error toasts and inline form errors standardized.

---

## 20) OpenAPI Contracts (New & Updated)
```yaml
openapi: 3.0.3
info:
  title: RVP Public App APIs
  version: v3.6
paths:
  /api/tenant/profile:
    get:
      summary: Get tenant business profile
      parameters:
        - in: header
          name: x-tenant-id
          required: true
          schema: { type: string, format: uuid }
      responses:
        '200': { description: OK }
        '401': { description: Unauthorized }
        '403': { description: Forbidden }
        '404': { description: Not Found }
    post:
      summary: Create/Upsert tenant profile
      parameters:
        - in: header
          name: x-csrf-token
          required: true
          schema: { type: string }
        - in: header
          name: x-tenant-id
          required: true
          schema: { type: string, format: uuid }
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/BusinessProfile' }
      responses:
        '200': { description: OK }
        '422': { description: Validation error }
  /tenant/swis/preview:
    get:
      summary: Public SWIS preview
      parameters:
        - in: query
          name: limit
          schema: { type: integer, maximum: 24, default: 12 }
        - in: query
          name: sort
          schema: { type: string, enum: [updated_desc, price_asc, alpha_asc] }
      responses:
        '200': { description: OK }
        '429': { description: Rate limited }
components:
  schemas:
    BusinessProfile:
      type: object
      required: [business_name, address_line1, city, postal_code, country_code]
      properties:
        business_name: { type: string }
        address_line1: { type: string }
        address_line2: { type: string }
        city: { type: string }
        state: { type: string }
        postal_code: { type: string }
        country_code: { type: string, minLength: 2, maxLength: 2 }
        phone_number: { type: string }
        email: { type: string }
        website: { type: string }
        contact_person: { type: string }
        hours: { type: object }
        social_links: { type: object }
        seo_tags: { type: object }
        latitude: { type: number }
        longitude: { type: number }
        display_map: { type: boolean }
        map_privacy_mode: { type: string, enum: [precise, neighborhood] }
```

---

## 21) Phased Migration Plan (from Current → Target UX)
1. Introduce **API client abstraction** with token injection and 401 refresh.
2. Implement **Tenant Switcher** in App Shell; persist selected tenant as URL (source‑of‑truth) + hint to localStorage.
3. Ship parallel routes under `/t/{tenantId}/...`; add redirects from legacy paths.
4. Migrate key pages: `/items`, `/settings/tenant`, `/tenants/[id]/users` to URL‑driven context.
5. Implement onboarding POST save → redirect to `/t/{id}/settings/tenant`.
6. Remove NextAuth route; update docs/config.
7. Enable `FF_TENANT_URLS`, then `FF_APP_SHELL_NAV` cohort rollout.

**Acceptance:** No broken deep links; e2e tests green for auth/tenant bootstrapping; 404 fallbacks present.

---

## 22) Page→API Contract Guardrails
- All tenant‑scoped endpoints accept `tenantId` explicitly (path/header/query).
- Standard error codes: 401 (auth), 403 (permission), 404 (tenant not found), 422 (validation).
- Client retries: backoff with max 2 retries on 429/5xx.

---

## 23) Test Suites Update (from Target & Current UX)
- **Auth & Bootstrapping:** visit app → session check → single vs multi‑tenant redirects.
- **Inventory flow:** `/t/{id}/items` uses header `x-tenant-id` and returns correct items.
- **Onboarding wizard:** POST profile → 200 → redirect `/t/{id}/settings/tenant`.
- **Switcher parity:** selecting tenant updates URL + server data with no flicker.
- **Legacy Redirects:** `/items`, `/settings/tenant`, `/tenants/users` all 301 to canonical.

---

## 24) Risks & Mitigations (Refined)
- **Deep links:** maintain redirect map; monitor 404s.
- **Mixed contexts:** URL authoritative; guard against stale localStorage.
- **Auth drift:** consolidate to custom JWT; remove NextAuth artifacts; add e2e refresh/logout tests.

