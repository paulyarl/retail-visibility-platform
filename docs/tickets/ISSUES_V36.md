# v3.6 Issues Pack (Spec→Tech→Ticket)

- Repo: retail-visibility-platform
- Base: main
- Branch: develop
- Labels suggested: v3.6, spec-sync, backend, frontend, security, devops, a11y, feature-flag

---

## REQ‑2025‑905 — TR‑905‑CSRF‑COOKIES — CSRF & Cookie Isolation
- Labels: v3.6, security, backend
- Owner: Security Eng
- Summary: Enforce CSRF for all write ops and restrict cookies to app.* domain.
- Scope
  - Double-submit or synchronizer token via cookie `csrf` + header `x-csrf-token`
  - Scope app cookies to `app.retailvisibility.com`; block on `www.`
- Tasks
  - Add CSRF middleware and token issuer
  - Require `x-csrf-token` on `POST/PATCH/DELETE`
  - Response middleware to scope cookies; block app cookies on `www`
  - Tests: write routes happy/negative; www cookie checks
- Acceptance
  - All write routes reject missing/invalid CSRF with 403 `error=csrf_missing_or_invalid`
  - No app cookies are set on `www` responses

## REQ‑2025‑906 — TR‑906‑ADMIN‑AUD — Admin Audience & Step‑Up Auth
- Labels: v3.6, security, backend, frontend
- Owner: Security Eng
- Summary: Separate admin audience and add step-up authorization for sensitive actions.
- Scope
  - JWT `aud=user|admin`, step-up `amr=step_up` ≤5min
  - Sensitive endpoints: `/api/admin/export/*`, `/api/admin/policies/*`, `/api/admin/tenants/*` (PATCH|DELETE)
- Tasks
  - Token issuance for admin `aud` + short-lived step-up
  - Client: intercept 401 `error=step_up_required` → modal → exchange → retry
  - Remove NextAuth route residues for clarity
- Acceptance
  - 403 when `aud=user` on admin routes
  - Step-up tokens expire after 5m; audit entries recorded

## REQ‑2025‑907 — TR‑907‑TENANT‑CTX — SSR Tenant Context & Routing
- Labels: v3.6, backend, frontend, feature-flag
- Owner: Backend Lead
- Summary: URL-driven tenant routing with SSR context; localStorage only a hint.
- Scope
  - Canonical routes: `/t/{tenantId}/...`
  - Edge middleware `tenantResolver` sets signed HttpOnly cookie `tcx`
  - Inject `tenantContext` server-side; client hook
  - Redirects from legacy: `/items` → `/t/{id}/items`, etc.
  - Flags: `FF_TENANT_URLS`, `FF_APP_SHELL_NAV`
- Tasks
  - Implement resolver + `tcx` cookie
  - Provide context provider/hook
  - Add redirect map and guards
  - E2E: single vs multi-tenant bootstrapping
- Acceptance
  - 403 without `tcx`; SSR renders correct tenant data with no flicker
  - URL is source of truth; localStorage only preselect hint

## REQ‑2025‑908 — TR‑908‑ISR‑REVAL — Event-Driven Revalidation
- Labels: v3.6, platform, edge
- Owner: Platform Eng
- Summary: Revalidate public pages within 60s on relevant updates.
- Scope
  - On item/profile change → publish event → revalidate `/t/{tenant}`
- Tasks
  - Domain event publisher on write paths
  - Edge revalidate route handler
  - Observability for TTL
- Acceptance
  - p95 revalidation ≤ 60s in pilot

## REQ‑2026‑010 — TR‑010‑BUSINESS‑PROFILE — Tenant Business Profile
- Labels: v3.6, backend, frontend
- Owner: Backend/API
- Summary: Business profile schema + APIs; wire onboarding + settings.
- Scope
  - Table `tenant_business_profile` (columns per spec)
  - APIs: `POST/GET/PATCH /api/tenant/profile` with Zod validation
  - Wire OnboardingWizard POST + Settings CRUD
- Tasks
  - DB migration + RLS (tenant-scoped)
  - Implement handlers and validations (E.164, URL, email)
  - Frontend integration for wizard and settings
- Acceptance
  - Wizard persists; settings reflect; duplicate prevention rules enforced

## ENH‑2026‑041 — TR‑041‑MAPCARD — Map Location Card
- Labels: v3.6, frontend, feature-flag
- Owner: Frontend
- Summary: Render map with privacy mode; enable via `FF_MAP_CARD`.
- Scope
  - Internal geocode action; cache lat/lng
  - PATCH profile accepts `display_map`, `map_privacy_mode`
  - Component with static-map fallback, accessibility baked in
- Tasks
  - Geocode endpoint and caching
  - Extend PATCH schema
  - Implement `<MapCard />` + tests
- Acceptance
  - p95 load < 250ms; keyboard accessible; alt text present

## ENH‑2026‑042 — TR‑042‑SWIS‑PREVIEW — Public Preview Widget
- Labels: v3.6, frontend, feature-flag, performance
- Owner: Frontend
- Summary: Public-safe SWIS preview API + component, A/B at 20%.
- Scope
  - GET `/tenant/swis/preview` with `limit<=24`, `sort`; signed route backed by view
  - `<SwisPreview limit=12 />`
- Tasks
  - Implement API route and view
  - Component and experiment wiring via `FF_SWIS_PREVIEW`
- Acceptance
  - p95 render < 300ms; CTR ≥ 25%

## ENH‑2026‑044 — TR‑044‑GOOGLE‑CONNECT — GMC/GBP OAuth Suite
- Labels: v3.6, integrations, backend, jobs
- Owner: API Lead
- Summary: Unified Google connect with scope governance, rotation, and rollback.
- Scope
  - Migrations: oauth accounts/tokens/links, insights tables
  - Scopes: `content`, `business.manage`, `openid email profile`
  - Rotation every 90d; revoke on unlink; alerts on expiry
- Tasks
  - Data models + migrations
  - OAuth flow + token store + jobs
  - Metrics/dashboards; rollback script
- Acceptance
  - Feed success ≥95%; insights failure <10%; rollback validated

## REQ‑2025‑910 — TR‑910‑A11y — Accessibility Baseline
- Labels: v3.6, a11y, qa
- Owner: QA Lead
- Summary: WCAG 2.1 AA baseline across new components/pages.
- Tasks
  - AXE critical=0; Lighthouse ≥ 95; keyboard/focus/contrast fixes
  - Screen reader pass (VoiceOver/NVDA)
- Acceptance
  - All thresholds met; report attached

## GAP‑2025‑004 — TR‑CI‑DRIFT‑004 — Schema Drift Detection
- Labels: v3.6, devops
- Owner: DevOps
- Summary: Nightly diff against production snapshot; block release on drift.
- Tasks
  - Job `schema-drift-nightly` compares head → PROD snapshot
  - Artifact + Slack summary; block release branch creation on fail (override with approver)
- Acceptance
  - Pipeline active; failing diff blocks as specified

## GAP‑2025‑005 — TR‑RUM‑WEIGHT‑005 — Tenant-Weighted RUM
- Labels: v3.6, web-obs
- Owner: Frontend/DevOps
- Summary: Weighted sampling to avoid small-tenant starvation.
- Tasks
  - Implement sampling logic and dashboards/alerts
- Acceptance
  - Uniform coverage dashboard; error budgets per tenant populated

## GAP‑2025‑001 — TR‑AUDIT‑CHAIN‑001 — Structured Logs & Audit Chain
- Labels: v3.6, sre, backend
- Owner: SRE
- Summary: 99%+ write-path auditability with PII scrubbing.
- Tasks
  - Create `audit_log` table per spec
  - Ensure write-path coverage; include `request_id` + `tenant_id`
- Acceptance
  - ≥99% of write actions emit audit row with required fields

---

# How to import
- Option A: Paste each section as a new GitHub Issue (title = first line, body = rest), apply labels/assignees.
- Option B: Keep this file in `docs/tickets/` and open a tracking issue “v3.6 — Implementation Umbrella” linking each section.
