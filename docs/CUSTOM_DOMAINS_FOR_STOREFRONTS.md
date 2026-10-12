# Custom Domains for Tenant Storefronts

## 🎯 Overview & Mission Alignment

**Mission anchor:**
- "Empowering Local Retailers to Compete Online"
- "Be the Shopify for brick-and-mortar retail - the single source of truth for local retailers' online presence, Google visibility, and in-store marketing."

**Platform context:**
- Web app: Next.js app deployed exclusively on **Vercel**.
- Database: **Supabase** (Postgres) as the source of truth for multi-tenant data, including domain → tenant mappings.

Custom domains will lean on **Vercel's Domains / Project Domains APIs** for verification and TLS management, with Supabase storing the lifecycle state and mappings.

Today, tenants have storefronts on the Retail Visibility Platform, but many of them also own **brand domains** that currently point nowhere. This is a missed opportunity: serious retailers expect their online presence to live at **their domain**, not at a shared platform URL.

This spec defines a **combined product/master spec and technical spec** for adding **custom domain support** so that tenant-owned domains (e.g. `shop.mylocalstore.com` or `mybrand.com`) can be pointed directly at tenant storefronts hosted on this platform.

The goal is to:
- Make the platform feel like **their store, not our tool**.
- Remove friction between offline brand identity and online presence.
- Provide an implementation-ready blueprint for when engineering capacity is available.

---

## 1. Problem & Opportunity

### 1.1 Problem

- Tenants already have or are buying their own domains.
- Those domains are often **unused or underused** ("pointing nowhere").
- Storefronts currently live only under platform-controlled URLs (e.g. tenant or slug-based paths/subdomains).
- This disconnect:
  - Weakens the perceived professionalism of the storefront.
  - Creates friction in marketing: staff must explain non-intuitive URLs.
  - Leaves SEO value fragmented between tenant domains and platform domains.

### 1.2 Opportunity

Custom domains are a **core expectation** for any serious e-commerce or presence platform.

By supporting tenant-owned domains we:

- **Strengthen brand identity**
  - Customers see the retailer's own domain, not a shared SaaS domain.
  - Better alignment with signage, printed materials, and QR codes.

- **Increase perceived value of the platform**
  - Moves perception closer to "my website" vs "a page on someone else's site".
  - Supports upsell and tier differentiation (e.g., custom domains for Pro/Org tiers).

- **Improve SEO and long-term durability**
  - Retailers accrue SEO under **their** domain.
  - Platform can change its own domain without breaking tenant URLs.

- **Reduce friction in omnichannel flows**
  - QR codes and marketing assets can use the retailer domain, consistent across storefront, Google, and directory.

---

## 2. Scope & Non-Goals

### 2.1 In Scope

- Allow tenants to map **one or more custom domains** to their storefront.
- Handle **DNS ownership verification** so only real owners can map domains.
- Provision and renew **HTTPS certificates** automatically for each custom domain.
- Route incoming requests based on the **Host header** to the correct tenant storefront.
- Provide a **tenant-facing UI** to add, verify, and manage custom domains.
- Provide an **admin/ops view** for support and debugging.

### 2.2 Explicit Non-Goals (Initial Version)

- Full white-labeling of **all** platform surfaces (e.g., removing platform branding everywhere).
- Advanced multi-store routing (e.g. different domains for different departments or languages) beyond mapping to a single storefront per domain.
- Complex SEO migration tooling (e.g. automatic 301 mapping import from external platforms).
- Email hosting or DNS hosting for tenants.

These can be layered on later if needed.

---

## 3. High-Level Requirements

### 3.1 Functional Requirements

1. **Domain Registration & Management**
   - Tenants can add a custom domain (e.g., `shop.mylocalstore.com` or `mybrand.com`) in their settings.
   - Tenants can have multiple domains per tenant (configurable via tier/limits).
   - Tenants can remove or disable a domain.

2. **Domain Ownership Verification (Vercel-managed)**
   - When a domain is added, the backend calls the **Vercel Domains / Project Domains API** to attach it to the storefront project.
   - Vercel returns DNS verification instructions (TXT and/or CNAME records) required to prove ownership.
   - Tenant is given those Vercel-provided DNS instructions in the UI.
   - The backend periodically checks the domain's verification state via Vercel APIs.
   - Only after Vercel reports the domain as verified (and TLS is ready) can the domain be activated in Supabase.

3. **DNS Configuration Guidance**
   - Clear, non-technical instructions for:
     - **Subdomains** (recommended first): `CNAME` → platform domain.
     - **Apex domains** (optional later): ALIAS/ANAME/A record → platform endpoint.
   - Copy should be written for non-technical retail staff, with examples.

4. **HTTPS / TLS**
   - All custom domains must serve traffic over **HTTPS**.
   - Certificates are **automatically issued and renewed by Vercel** (Let's Encrypt under the hood).
   - Tenants do not manage certificates directly; the platform integrates only with Vercel's domain lifecycle.

5. **Routing**
   - Incoming request: `Host: custom-domain.com`.
   - Resolve `custom-domain.com` → `tenantId` or `storefrontId` via a mapping table.
   - Render the tenant storefront as if visiting the canonical tenant storefront URL.
   - Unknown or inactive custom domains:
     - Return a safe 404 or a generic "domain not configured" page (never another tenant's store).

6. **Canonical URLs & SEO**
   - For active custom domains, storefront pages should expose **canonical tags** consistent with chosen primary domain (platform vs tenant domain policy to be decided).
   - Avoid duplicate content penalties where possible.

7. **Permissions & Tiering**
   - Only tenants with certain **tiers** (e.g., Professional/Organization) can use custom domains, if desired.
   - Only users with appropriate **roles** (OWNER/ADMIN/MANAGER) can configure domains.
   - Platform admin/support users can see and assist with configuration.

8. **Observability & Support**
   - Admins can see domain status, verification results, certificate status, and recent errors.
   - Logs are available for failed verifications and TLS provisioning issues.

### 3.2 Non-Functional Requirements

- **Security**: Must ensure domain ownership before routing traffic.
- **Reliability**: Auto-renew certs without manual intervention; robust against DNS propagation delays.
- **Scalability**: Design to support at least hundreds to low thousands of custom domains without manual ops.
- **Latency**: Minimal additional latency for host-based routing.
- **Operational Simplicity**: Prefer provider-managed solutions where possible (e.g., Vercel/Netlify/Cloudflare) to avoid bespoke TLS management.

---

## 4. User Flows

### 4.1 Tenant Flow: Adding a Custom Domain

1. Tenant navigates to **Storefront Settings → Custom Domain**.
2. Tenant clicks **"Add Custom Domain"**.
3. Tenant enters domain (e.g. `shop.mylocalstore.com`).
4. Platform (API + Supabase + Vercel):
   - Validates basic formatting.
   - Creates a `custom_domains` record in Supabase with status `pending_verification`.
   - Calls Vercel's Domains / Project Domains API to attach the domain to the storefront project.
   - Receives DNS verification records (TXT and/or CNAME) from Vercel.
   - Displays those DNS instructions as **two distinct records**:
     - Step 1: Log into your domain provider.
     - Step 2 (routing): add the **CNAME** (subdomain) or **A/ALIAS** (apex) record that points traffic at Vercel — use the Vercel-recommended value if returned, else the standard target (`cname.vercel-dns.com` / apex A).
     - Step 3 (ownership, only if Vercel returned a TXT challenge): add the **TXT** record exactly as shown.
5. Tenant updates DNS and clicks **"Check DNS"** or waits for automatic background verification.
6. Backend verification job:
   - Calls the Vercel project-domain get/verify endpoints for that domain.
   - Reads Vercel's `verified` flag and the TXT `verification` challenge — **not** certificate state (Vercel exposes none).
   - When `verified && !misconfigured`, our own HTTPS probe of the host confirms TLS before flipping to `active`; updates `custom_domains.status` and the probe-derived `certificate_status`.
7. On success:
   - Status transitions to `active` once Vercel reports the domain verified/configured **and** our probe confirms TLS.
   - Tenant sees status: **Active**, with a preview link `https://shop.mylocalstore.com`.

### 4.2 Tenant Flow: Removing / Disabling a Domain

1. Tenant opens custom domain list.
2. Tenant clicks **"Disable"** or **"Remove"** on a specific domain.
3. Platform sets status to `disabled` (soft delete recommended).
4. Routing for that host now returns an appropriate 404 or generic page.
5. Optional: After grace period, revoke/cleanup certificates.

### 4.3 Platform Admin Flow: Troubleshooting

- View a list of all custom domains, filterable by status and tenant.
- See:
  - Domain
  - Tenant
  - Status (`pending_verification`, `verified`, `active`, `disabled`, `error` — `cert_provisioning` is not API-observable, see §5.1)
  - Verification token
  - Last verification attempt + error (if any)
  - Certificate status and expiry

---

## 5. Data Model & Domain Mapping

### 5.1 Proposed Database Schema

New table (Supabase): `custom_domains`

```sql
custom_domains (
  id uuid primary key,
  tenant_id uuid not null references tenants(id) on delete cascade, -- keep the cascade; detach from Vercel in a pre-delete step (§8.3) so a tenant delete can't orphan a live project domain
  domain text not null unique, -- e.g. 'shop.mylocalstore.com'
  status text not null check (status in (
    'pending_verification',
    'verified',
    'active',
    'disabled',
    'error'
  )), -- 'cert_provisioning' is NOT an API-observable state — Vercel exposes no cert field (see note below)
  verification_token text, -- optional: only needed if we ever add our own TXT-flow on top of Vercel
  vercel_domain_id text, -- ID or name reference returned by Vercel Domains/Project Domains API
  verification_checked_at timestamptz,
  verification_error text,
  certificate_status text, -- PROBE-DERIVED ONLY (our own HTTPS probe) — Vercel exposes no issued/expiry field
  certificate_error text,
  is_primary boolean not null default false, -- present for the multi-domain future; v1 caps at one domain per tenant
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:
- `domain` should be stored normalized (lowercase, no trailing dot).
- Index on `domain` for fast host lookup.
- Store a `primary` flag (`is_primary`) for the multi-domain future; **v1 caps at one domain per tenant** (sprint plan D4) and enforces it with a partial unique index on `tenant_id where status <> 'disabled'`.
- **Status is limited to what Vercel can tell us:** the project-domain object exposes `verified` (boolean) + the TXT `verification` challenge; there is **no certificate field**, and `GET /v6/domains/{domain}/config` exposes only `misconfigured` + recommended records + `acceptedChallenges` (issuance *capability*, not issued status). `certificate_status` therefore comes from our own HTTPS probe, not the API — hence no `cert_provisioning` state.
- **Resolution path:** the platform resolves `host → tenant_id` via an API endpoint (`GET /api/tenants/resolve-custom-domain/:host`), not Supabase-from-edge — see the sprint plan D5; §5.3 Option A and §14.4 are superseded.

If we decide to support custom domains in multiple environments (e.g., staging and production), we may add an `environment` column (e.g., `env text check (env in ('staging','production'))`) and include it in uniqueness constraints. For v1, the recommendation is to treat **custom domains as production-only** to avoid confusion.

### 5.2 Host → Tenant Resolution

At request time (web app or edge/middleware layer):

1. Read `Host` header, normalize (lowercase, strip port).
2. Query `custom_domains` by `domain` where `status = 'active'`.
3. If match found → extract `tenant_id` and set tenant context.
4. If no match found → fall back to existing tenant routing scheme (e.g. `/t/{tenantId}/...` under platform domain) or return safe 404 for unknown custom domains.

This logic is centralized in the API (`CustomDomainService.resolveHostToTenant`) behind `GET /api/tenants/resolve-custom-domain/:host`, consumed by the Next.js proxy (`proxy.ts`) — not queried from the edge (sprint plan D5).

### 5.3 RLS & Host-Resolution Access Pattern

- Writes to `custom_domains` (create/update/delete) happen only via backend services (Prisma / service role); the base table has RLS enabled with **no anon policy**.
- **Superseded (sprint plan D5):** the original recommendation here was Option A — a `public_custom_domains` view readable by the edge middleware with the anon key. The resolution path is now **Option B-style**: an internal API endpoint (`GET /api/tenants/resolve-custom-domain/:host`) that the Next.js proxy fetches. The proxy never holds a Supabase key, and the view is dropped (§14.1.2 / §14.1.3 / §14.4 are superseded). Reintroduce the view only if a concrete edge consumer is named.

---

## 6. Infrastructure & TLS Strategy (Vercel + Supabase)

### 6.1 Vercel as Exclusive Host

- The web app (Next.js) is deployed on **Vercel**; all storefront traffic (platform and tenant domains) terminates at Vercel.
- Custom domains are attached to the storefront project via **Vercel Domains / Project Domains APIs**.
- Vercel is responsible for:
  - DNS validation challenges for custom domains.
  - TLS certificate issuance and automatic renewal (Let's Encrypt).
- The application is responsible for:
  - Storing domain → tenant mappings and lifecycle state in Supabase.
  - Using the `Host` header to resolve tenant context and render the correct storefront.

### 6.2 Domain Lifecycle with Vercel

- When a tenant adds a domain:
  - Backend inserts a row in Supabase `custom_domains` with status `pending_verification`.
  - Backend calls `POST /v10/projects/{projectId}/domains` (or equivalent) to add the domain to the Vercel project.
  - Vercel returns a domain object with verification information (TXT and/or CNAME records).
- Verification flow:
  - UI surfaces the Vercel-provided DNS records to the tenant.
  - Tenant updates DNS.
  - A background job or "Check DNS" API endpoint calls `GET /v9/projects/{projectId}/domains/{name}` (the project-domain object), optionally followed by `POST /v9/projects/{projectId}/domains/{name}/verify` to complete a TXT challenge. (`GET /v10/domains/{name}` is **not** in the REST reference — do not rely on it.)
  - When Vercel reports `verified && !misconfigured` **and** our HTTPS probe confirms TLS, the backend updates Supabase:
    - `status = 'active'`
    - `certificate_status` = probe-derived (`'issued'`-ish)
- Error states from Vercel (e.g. verification failed) are surfaced to tenants and admins via `verification_error` and `certificate_error` fields.

Idempotency & removal considerations:

- The backend must treat Vercel domain operations as **idempotent**:
  - If a domain is already attached to the project, we should re-use that association rather than failing hard where possible.
  - Any Vercel errors indicating duplicates/limits should be surfaced as friendly messages to tenants and logged for admin review.
- When a domain is **removed or disabled** in Supabase (see lifecycle section), we should decide whether to:
  - Also call Vercel's delete domain endpoint to fully detach it from the project, or
  - Keep it attached but ignore it at routing level. For v1, the recommendation is to **detach from Vercel** when a domain is permanently removed to avoid surprises.

### 6.3 Supabase Responsibilities

- Persist `custom_domains` records as the system of record.
- Provide an efficient lookup for `domain → tenant_id` at request time.
- Store Vercel domain references and status mirrors for support/debugging.
- Enforce any tier-based limits (domains per tenant) and permissions at the API level.

### 6.4 DNS Recommendations

- **Phase 1 (MVP)**: Support **subdomains only** (e.g. `shop.mylocalstore.com`).
  - Instruct tenants to create a `CNAME` pointing at the Vercel-provided target host (e.g. a `cname.vercel-dns.com` target from the Domains API).
  - Simpler instructions; fewer registrar-specific edge cases.

- **Phase 2 (Advanced)**: Add support for **apex domains** (e.g. `mybrand.com`).
  - Tenants will use ALIAS/ANAME or A records as per their DNS provider's guidance, pointing at Vercel's apex target.
  - More registrar-specific edge cases; Phase 2 only if needed.

---

## 7. Application Changes (Web + API)

### 7.1 Backend / API

New APIs (examples, adapt to existing conventions):

- `GET /api/tenants/{tenantId}/custom-domains`
- `POST /api/tenants/{tenantId}/custom-domains`
- `POST /api/tenants/{tenantId}/custom-domains/{id}/check` (verify/refresh; the sprint plan uses `check`)
- `DELETE /api/tenants/{tenantId}/custom-domains/{id}`
- `GET /api/tenants/resolve-custom-domain/:host` (public, rate-limited — the proxy's host→tenant resolution; sprint plan D5)

Responsibilities:

- Validate domain format.
- Insert or update `custom_domains` rows in Supabase.
- Call Vercel Domains / Project Domains APIs to attach domains to the storefront project.
- Store any Vercel domain identifiers and verification metadata.
- Return DNS instructions payload (TXT/CNAME records from Vercel) to the frontend.
- Trigger or schedule background verification checks.
- Poll Vercel for updated **verification** state (there is no certificate state to poll), probe TLS ourselves, and update Supabase `status`, `certificate_status`, and error fields.

Background job(s):

- Periodic **verification sweeper** for domains in `pending_verification`.
  - Reads all such domains from Supabase.
  - Calls Vercel APIs to check verification/certificate state.
  - Updates Supabase accordingly.

- Optional **certificate status sync** for long-lived monitoring (e.g. ensuring `certificate_status` stays in sync with Vercel over time).

### 7.2 Frontend / Web App

New UI components / pages:

- **Tenant Settings → Storefront → Custom Domains**
  - List existing custom domains (domain, status, last checked, errors).
  - "Add Custom Domain" modal.
  - Show DNS instructions and status.
  - "Check DNS" button.

- **Admin / Support View** (could be under existing admin panel)
  - Global list of custom domains with tenant info and statuses.
  - Simple filters and search.

### 7.3 Middleware / Routing

- Add a **host-based tenant resolution** layer in the Next.js app running on Vercel. **Superseded (sprint plan D5):** this runs in `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the function is exported as `proxy`) and resolves via the **API endpoint**, not a Supabase query from the edge:
  - In `proxy.ts`, after the platform-subdomain branch misses, classify the remaining host (excluding `*.vercel.app`, `localhost`/IP hosts, and platform apexes) and fetch `GET /api/tenants/resolve-custom-domain/:host`.
  - Maintain a configuration of **platform root domains** (`visibleshelf.com`, `visibleshelf.store`). For these hosts, continue using the existing subdomain/apex routing.
  - Attach tenant context by rewriting to the storefront path (`/tenant/{id}`) and setting the `tcx` cookie — the same rewrite mechanics the live `*.visibleshelf.com` subdomain branch uses.

- Routing safeguards:
  - If a non-platform host is **not** found in `custom_domains` with `status = 'active'`, return a 404 or a generic "domain not configured" page.
  - Never attempt to "guess" a tenant from the path when the host is unknown; unknown hosts should not be mapped to arbitrary tenants.

- Ensure that **directory / storefront routes** are able to operate purely from `tenantId` set by host-based resolution (without always relying on `/t/{tenantId}` paths in the URL the user sees).

### 7.4 Directory, QR Codes, and External Links

- Introduce the concept of an optional **primary custom domain** per tenant:
  - If a primary custom domain exists and is `active`, public links should prefer it.
  - If not, fall back to the platform domain + tenant path.
- Update link generation logic to use the primary custom domain where appropriate:
  - **Directory listings** (public directory pages linking to storefronts).
  - **QR code generation** for marketing materials.
  - "View Storefront" links in dashboards and tenant headers.
- This ensures a consistent customer experience and maximizes the value of custom domains while keeping platform-domain fallbacks intact.

---

## 8. Permissions, Tiers, and Limits

### 8.1 Tier Gating (Optional but Recommended)

- **Starter / Trial**: No custom domains.
- **Professional**: 1 custom domain.
- **Enterprise / Organization**: Multiple custom domains (post-v1).

> **Sprint-plan D4 (v1):** gate to the `professional` + `organization` **tier_keys** (the DB uses `professional` / `organization` / `enterprise` — not the Starter/Pro/Enterprise wording above), **1 domain per tenant**, with apex + `www` counting as one logical domain (D9). This deliberately narrows the multi-domain expectation at the top tier; `is_primary` is schema-ready so multi-domain lands later.

This aligns with the mission of providing **enterprise features at small business pricing** while still making higher tiers feel materially more powerful.

Implementation:
- Add custom domain limits to existing tier system (similar to SKU/location capacity).
- Enforce limits within the API when creating new `custom_domains` entries — **and** with a partial unique index on `tenant_id where status <> 'disabled'`.

### 8.2 Role-Based Permissions

- Only tenant roles with `canManage` or `canAdmin` permissions (per existing permission system) can:
  - Add/remove domains.
  - Trigger verification.

- Platform roles (e.g., `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`) can view and override for support.

### 8.3 Tenant & Domain Lifecycle

- **Tenant deletion**:
  - When a tenant is deleted or deactivated, all associated custom domains should be moved to `disabled` in Supabase.
  - As part of deletion, the backend should, after a configurable grace period, detach these domains from Vercel (if they were active) to avoid routing to a non-existent storefront.
  - Requests to previously active custom domains should show a safe generic/offline page or 404.

- **Tier downgrade**:
  - If a tenant downgrades to a tier that allows fewer or no custom domains, domains beyond the allowed limit should be marked `disabled` after a grace period.
  - Tenants should be clearly notified in-app and via email (optional) about which domains will be disabled if the downgrade proceeds.

- **Domain transfer between tenants**:
  - For v1, direct transfer of a custom domain from one tenant to another is **not supported**.
  - To move a domain between tenants, it must first be removed/disabled from the original tenant (and detached from Vercel), then added anew under the new tenant's settings.

---

## 9. Risks, Edge Cases & Mitigations

### 9.1 DNS Propagation Delays

- **Risk**: Tenant expects "instant" verification, but DNS can take minutes to hours.
- **Mitigation**:
  - Clearly communicate that DNS changes can take time.
  - Provide retry capability and show last-checked timestamp.

### 9.2 Misconfigured DNS

- **Risk**: Tenant misconfigures records, causing verification to fail or routing to bypass the platform.
- **Mitigation**:
  - Provide concrete examples for major registrars.
  - Show precise error messages when verification fails (e.g., "TXT record not found", "CNAME pointing to wrong target").

### 9.3 Host Header Spoofing / Security

- **Risk**: Incorrect handling of `Host` header could route to wrong tenant.
- **Mitigation**:
  - Only treat domains **present in `custom_domains` with `active` status** as valid multi-tenant hostnames.
  - Do not allow arbitrary hosts to be interpreted as tenants.

### 9.4 Certificate Rate Limits

- **Risk**: Let's Encrypt rate limits if too many cert requests fail or are requested for the same domain.
- **Mitigation**:
  - Use provider-managed solutions when possible.
  - Implement backoff and reuse existing certs.

### 9.5 SEO Duplication

- **Risk**: Same content accessible via both platform domain and custom domain.
- **Mitigation**:
  - Designate a **primary domain** per tenant and use canonical tags.
  - Optionally redirect platform-hosted storefront URLs to primary domain.

---

## 10. Implementation Phasing Plan

### Phase 1  Design & Data Model

- Finalize UX copy for tenant and admin flows.
- Add `custom_domains` table and migrations.
- Implement backend models and basic CRUD APIs (without TLS integration).
- Add host → tenant resolution utility (no external routing changes yet).

### Phase 2  Tenant UI & Verification

- Build Custom Domains section in tenant settings.
- Implement "Add domain" and DNS instruction UI.
- Build verification endpoints and background job.
- Validate verification end-to-end (without public TLS yet, can be staged).

### Phase 3  TLS & Routing Integration

- Integrate with **Vercel Domains / Project Domains APIs** for end-to-end domain lifecycle management (verification + TLS is handled by Vercel).
- Wire Supabase `custom_domains` lifecycle to Vercel's domain states (pending → verified → active).
- Update edge/middleware to route custom domains to storefronts in production based on `Host` header and Supabase mapping.

### Phase 4  Observability, Limits, and Polish

- Add tier-based limits (domains per tenant) and role-based controls.
- Add admin/support tools for visibility.
- Add telemetry: number of active custom domains, errors, verification durations.
- Improve copy and help content based on early usage.

---

## 11. Open Questions for Finalization

> **Resolved by the sprint plan's Decisions table (D1–D11).** These are kept for history; see `docs/CUSTOM_DOMAINS_SPRINT_PLAN.md` for the settled outcomes (production-only; canonical tags only, no redirect; `professional`+`organization` 1-domain; apex accepted; public-surface URL preference deferred past v1; API resolution path).

Before implementation, the following decisions should be made explicitly:

1. **Vercel Project & Environment Strategy**
   - Single Vercel project vs multiple projects per environment (staging/production) for storefronts.
   - Whether custom domains are **production-only** or also supported in other environments.

2. **Primary Domain Policy**
   - When a custom domain is active, should the platform domain redirect to it?
   - Or should both be supported with canonical tags only?

3. **Tier & Pricing Strategy**
   - Which tiers get custom domain access, and how many domains per tier?
   - Is this a key differentiator for Pro/Org tiers?

4. **Apex Domains Support**
   - MVP: subdomains only, or include apex domains from day one?

5. **Directory & External Links**
   - Should public directory links prefer the custom domain when present?
   - If yes, update directory and QR code generation logic accordingly.

---

## 12. Success Criteria

- **Functional**:
  - Tenants can configure a custom domain end-to-end (DNS → verification → HTTPS → live storefront) without internal intervention.
  - Custom domain traffic is correctly routed to the appropriate storefront across all routes.

- **User Experience**:
  - Non-technical staff can follow the DNS instructions with minimal confusion.
  - Support tickets related to "my domain points nowhere" are significantly reduced.

- **Business Impact**:
  - Custom domains drive perceived value and are highlighted as part of higher tiers.
  - At least X% of Pro/Org tenants adopt custom domains within N months.

This document should serve as the **master product spec and technical blueprint** for implementing custom domain support when the platform is ready to prioritize it.

---

## 13. Testing & Rollout

### 13.1 Testing Matrix

- **Role coverage**:
  - Test with tenant roles: VIEWER (should be blocked), MEMBER, MANAGER, OWNER/ADMIN.
  - Test with platform roles: PLATFORM_ADMIN (full access), PLATFORM_SUPPORT (support tools), PLATFORM_VIEWER (read-only).
- **Tier coverage**:
  - Trial/Starter (no domains): ensure UI shows gating and appropriate upsell messaging.
  - Professional/Organization (1 domain, v1): ensure limit enforcement and clear errors when exceeding — including the apex + `www` "one logical domain" rule (sprint plan D4/D9).
  - Multi-domain + primary-domain selection: post-v1 (schema-ready, UI later).
- **Lifecycle scenarios**:
  - Add → verify → active → disable → re-add.
  - Tenant deletion and tier downgrade flows.
  - Vercel API failure and rate-limit handling.

### 13.2 Rollout Strategy

- Gate custom domains behind the platform flag system: platform flag `custom_domains` (`allow_tenant_override=true`) + per-tenant `tenant_feature_flags_list` rows for the beta cohort; the proxy reads `NEXT_PUBLIC_FF_CUSTOM_DOMAINS` (sprint plan D10/H7).
- Start with a small set of **internal tenants** or friendly beta customers.
- Monitor:
  - Vercel domain/SSL errors.
  - Verification failure rates.
  - Support tickets mentioning DNS or custom domains.
- Once stable, progressively enable for broader tiers (e.g., Professional/Organization) and update marketing/feature pages accordingly.

---

## 14. Implementation Appendix (SQL & TypeScript Scaffolding)

These snippets are **reference implementations** to accelerate future work. They should be adapted to the actual project structure, module paths, and conventions, but are designed to be close to drop-in.

### 14.1 Supabase Migration (SQL)

#### 14.1.1 `custom_domains` Table

```sql
-- 001_create_custom_domains.sql

create table if not exists public.custom_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade, -- keep the cascade; detach from Vercel pre-delete (sprint plan D11)
  domain text not null unique,
  status text not null check (status in (
    'pending_verification',
    'verified',
    'active',
    'disabled',
    'error'
  )), -- no 'cert_provisioning': Vercel exposes no cert state (sprint plan H4)
  verification_token text,
  vercel_domain_id text,
  verification_checked_at timestamptz,
  verification_error text,
  certificate_status text, -- probe-derived only
  certificate_error text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_domains_domain
  on public.custom_domains (lower(domain));

-- v1 one-domain cap (sprint plan D4/M7)
create unique index if not exists uq_custom_domains_tenant_live
  on public.custom_domains (tenant_id)
  where status <> 'disabled';
```

> Note: if you later support multiple environments, add an `env` column and include it in uniqueness/indexing as discussed earlier.

#### 14.1.2 Public View for Host Resolution — **superseded (sprint plan D5/M1)**

> The API endpoint is the only resolution path; this view has no consumer. Kept for history — do not create it.

```sql
-- 002_create_public_custom_domains_view.sql

create or replace view public.public_custom_domains as
select
  lower(domain) as domain,
  tenant_id
from public.custom_domains
where status = 'active';

alter view public.public_custom_domains set (security_invoker = true);
```

#### 14.1.3 RLS Policies (Example) — base table only; view-based resolution dropped

> Keep RLS + the service-role/no-anon policies on the **base table** (defense in depth). The view-based resolution policy below is **superseded** (sprint plan D5) — there is no anon read path.

```sql
-- Enable RLS on base table
alter table public.custom_domains enable row level security;

-- Service role (backend) policy for full access
create policy custom_domains_service_role_all
  on public.custom_domains
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Optional: no direct anon access to base table
create policy custom_domains_no_direct_anon
  on public.custom_domains
  for select
  using (false);

-- View-based resolution for anon (middleware)
alter view public.public_custom_domains set (security_invoker = true);

-- For Supabase pgjwt auth, we can allow anon read via a dedicated function or keep it open
-- if the only exposed fields are domain + tenant_id.
-- Example (simplest): no RLS on view, rely on limited columns + where clause.
```

You can tighten the view access further via a dedicated function or more specific policies if needed.

---

### 14.2 Vercel Domain Service (Backend, TypeScript)

Assuming a Node/TypeScript backend (Next.js API routes or a separate API service) with access to Supabase **service role** and `VERCEL_API_TOKEN`.

#### 14.2.1 Environment Variables

```bash
VERCEL_API_TOKEN="..."
VERCEL_PROJECT_ID="..."           # storefront project
VERCEL_TEAM_ID="..."              # optional, if using a team
SUPABASE_SERVICE_ROLE_KEY="..."   # for backend-only Supabase client
SUPABASE_URL="..."
```

#### 14.2.2 `vercelDomainsService.ts`

```ts
// apps/api/src/services/vercelDomainsService.ts

import fetch from 'node-fetch';

const VERCEL_API_BASE = 'https://api.vercel.com';

interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: Array<{
    type: 'TXT' | 'CNAME';
    domain: string;
    value: string;
  }>;
  // ...other fields not exhaustively typed here
}

const projectId = process.env.VERCEL_PROJECT_ID!;
const teamId = process.env.VERCEL_TEAM_ID;
const token = process.env.VERCEL_API_TOKEN!;

function vercelHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function withTeam(query: URLSearchParams) {
  if (teamId) query.set('teamId', teamId);
  return query;
}

export async function addDomainToProject(domain: string): Promise<VercelDomainResponse> {
  const url = new URL(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: vercelHeaders(),
    body: JSON.stringify({ name: domain }),
  });

  // A duplicate add returns 400 (not 409) — treat as "already attached, reuse".
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel addDomain failed (${res.status}): ${body}`);
  }

  return (await res.json()) as VercelDomainResponse;
}

// Get a project domain (v9 — NOT /v10/domains/{name}, which is not in the REST reference)
export async function getProjectDomain(domain: string): Promise<VercelDomainResponse> {
  const url = new URL(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), { method: 'GET', headers: vercelHeaders() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel getProjectDomain failed (${res.status}): ${body}`);
  }

  return (await res.json()) as VercelDomainResponse;
}

// Complete a TXT verification challenge (v9). Safe to call when already verified.
export async function verifyProjectDomain(domain: string): Promise<VercelDomainResponse> {
  const url = new URL(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}/verify`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), { method: 'POST', headers: vercelHeaders() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel verifyProjectDomain failed (${res.status}): ${body}`);
  }

  return (await res.json()) as VercelDomainResponse;
}

// Domain config (v6): `misconfigured` + recommendedCNAME/recommendedIPv4 (may be empty) +
// acceptedChallenges. No issued-cert field — TLS is confirmed by our own HTTPS probe, not here.
export async function getDomainConfig(domain: string): Promise<{
  misconfigured: boolean;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  acceptedChallenges?: string[];
}> {
  const url = new URL(`${VERCEL_API_BASE}/v6/domains/${domain}/config`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), { method: 'GET', headers: vercelHeaders() });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel getDomainConfig failed (${res.status}): ${body}`);
  }

  return (await res.json()) as any;
}

export async function removeDomainFromProject(domain: string): Promise<void> {
  const url = new URL(`${VERCEL_API_BASE}/v9/projects/${projectId}/domains/${domain}`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), {
    method: 'DELETE',
    headers: vercelHeaders(),
  });

  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Vercel removeDomain failed (${res.status}): ${body}`);
  }
}
```

You can extend the response typing and error handling as you integrate.

---

### 14.3 Supabase-backed Domain Service (Backend, TypeScript)

Example of a backend service using Supabase service-role client + the Vercel service above.

```ts
// apps/api/src/services/customDomainService.ts

import { createClient } from '@supabase/supabase-js';
import { addDomainToProject, getProjectDomain, getDomainConfig, verifyProjectDomain, removeDomainFromProject } from './vercelDomainsService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type CustomDomainStatus =
  | 'pending_verification'
  | 'verified'
  | 'active'
  | 'disabled'
  | 'error';

export async function createCustomDomain(tenantId: string, domain: string) {
  const normalizedDomain = domain.trim().toLowerCase();

  // 1) Insert row in Supabase
  const { data: row, error } = await supabase
    .from('custom_domains')
    .insert({ tenant_id: tenantId, domain: normalizedDomain, status: 'pending_verification' })
    .select('*')
    .single();

  if (error) throw error;

  // 2) Attach to Vercel project
  const vercelDomain = await addDomainToProject(normalizedDomain);

  // 3) Store Vercel id/info (if needed) and return instructions
  const { data: updated, error: updateError } = await supabase
    .from('custom_domains')
    .update({ vercel_domain_id: vercelDomain.name })
    .eq('id', row.id)
    .select('*')
    .single();

  if (updateError) throw updateError;

  return {
    domain: updated.domain,
    status: updated.status as CustomDomainStatus,
    verificationRecords: vercelDomain.verification ?? [],
  };
}

export async function refreshCustomDomainStatus(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase();

  // Vercel tells us verification + DNS configuration — NOT certificate state.
  const vercelDomain = await getProjectDomain(normalizedDomain);
  const config = await getDomainConfig(normalizedDomain);

  // `verified && !misconfigured` = ready to route. TLS is then confirmed by our own
  // HTTPS probe of the host before we flip to `active` (Vercel exposes no cert field).
  let status: CustomDomainStatus = 'pending_verification';
  if (vercelDomain.verified && !config.misconfigured) {
    const tlsReady = await probeHttps(normalizedDomain); // our own probe
    status = tlsReady ? 'active' : 'verified';
  }

  const { data, error } = await supabase
    .from('custom_domains')
    .update({
      status,
      certificate_status: status === 'active' ? 'issued' : null, // probe-derived
      verification_checked_at: new Date().toISOString(),
      verification_error: null,
    })
    .eq('domain', normalizedDomain)
    .select('*')
    .single();

  if (error) throw error;

  return {
    domain: data.domain,
    status: data.status as CustomDomainStatus,
    verified: vercelDomain.verified,
  };
}

// Our own HTTPS probe — the only source of certificate state (sprint plan H4).
async function probeHttps(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/`, { method: 'HEAD' });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

export async function disableCustomDomain(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase();

  await removeDomainFromProject(normalizedDomain);

  const { data, error } = await supabase
    .from('custom_domains')
    .update({ status: 'disabled' })
    .eq('domain', normalizedDomain)
    .select('*')
    .single();

  if (error) throw error;

  return data;
}
```

These functions can back your `POST /custom-domains`, `POST /custom-domains/{id}/check`, and `DELETE /custom-domains/{id}` endpoints.

---

### 14.4 Next.js Middleware for Host-based Tenant Resolution — **superseded (sprint plan D5)**

> Superseded: resolution runs in `proxy.ts` (Next.js 16) via the **API endpoint**, not a Supabase anon query from the edge. Kept for history.

Below is the original example `middleware.ts` for the web app on Vercel using a Supabase anon client to resolve `host → tenantId` via `public_custom_domains`.

```ts
// apps/web/src/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PLATFORM_HOSTS = new Set([
  'app.retailvisibility.com',
  'localhost:3000',
]);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const host = (req.headers.get('host') || '').toLowerCase();

  // Platform domains use existing routing (e.g., /t/{tenantId}/...)
  if (PLATFORM_HOSTS.has(host)) {
    return NextResponse.next();
  }

  // Attempt to resolve as custom domain
  const { data, error } = await supabase
    .from('public_custom_domains')
    .select('tenant_id')
    .eq('domain', host)
    .maybeSingle();

  if (error) {
    // In production, log error and fall back to 404
    return NextResponse.rewrite(new URL('/404', url));
  }

  if (!data?.tenant_id) {
    // Unknown custom host → generic not configured page or 404
    return NextResponse.rewrite(new URL('/domain-not-configured', url));
  }

  const tenantId = data.tenant_id as string;

  // Rewrite to tenant storefront route while preserving original host
  url.pathname = `/t/${tenantId}/storefront`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

Adjust `PLATFORM_HOSTS`, the target path (`/t/{tenantId}/storefront`), and error routes (`/404`, `/domain-not-configured`) to match your app.

---

These SQL and TypeScript snippets, combined with the earlier sections, should provide a near-complete blueprint to implement custom domains end-to-end on Vercel + Supabase when you are ready.

---

## 15. Implementation Update — Platform wildcard `*.visibleshelf.com` landed (2026-10-11)

The platform-side half of this architecture shipped as part of the Marketing Ops project-phase sprint. This is a **different feature** from tenant-owned custom domains (§1–§14, still unbuilt) — it is the platform wildcard that powers opt-in `tenant.visibleshelf.com` storefront subdomains — but it used the same Vercel-DNS mechanics this spec leans on, and it de-risks them.

### What shipped

- `*.visibleshelf.com` is a **Valid Configuration / Production** domain entry on `retail-visibility-platform-web` with an issued wildcard cert.
- The app resolves `{subdomain}.visibleshelf.com` to a tenant via `tenants.subdomain` (opt-in; mirrors `slug`) and **rewrites** — not redirects — to the public storefront, so the canonical URL stays branded (`proxy.ts`, production + localhost paths).
- Verified live: `baraka.visibleshelf.com` → 200 + storefront HTML, hostname preserved.

### DNS move: Cloudflare → Vercel nameservers

Vercel on the Pro plan requires the domain itself on **Vercel nameservers** for a wildcard + its cert — a `*` CNAME at an external DNS provider is not accepted. `visibleshelf.com` was moved from Cloudflare to `ns1/ns2.vercel-dns.com` (registrar: Namecheap).

- Cloudflare was only a DNS host in practice — every record was "DNS only", so no proxy/CDN features were lost.
- **Carried (13 records)**: Zoho `MX` ×3 (10/20/50), `TXT` ×5 (SPF, `_dmarc`, zoho-verification, google-site-verification, `zmail._domainkey` DKIM), `CNAME` ×5 (`api` → Railway, `mt49`/`mt-link`/`rwmt1._domainkey`/`rwmt2._domainkey` → Mailtrap).
- **Deliberately not carried**: stale `NS` records, the apex `A` record, and the `www` CNAME — Vercel auto-manages apex/`www`/`*` records for its own domain entries (`*` and `@` exist as managed `ALIAS` rows in the zone).
- The irreplaceable set is **mail**: MX + DKIM + SPF + DMARC must be copied character-for-character; a truncated DKIM `p=` silently breaks signing.

### Wildcard-override behavior (worth knowing)

Adding an explicit record under a branch **disables wildcard matching for that branch** — Vercel warns "Overriding the wildcard may make subdomains under these domains inaccessible if not explicitly configured." Creating `rwmt1._domainkey` meant `*._domainkey.visibleshelf.com` no longer matched the `*`. Harmless here (DKIM selectors always need explicit records anyway), but the same warning fires for any explicit subdomain record — an explicitly-created `x.visibleshelf.com` record overrides, never merges with, the wildcard.

### Other learnings

- An "Invalid Configuration" project-domain entry can silently disappear from the project Domains list after delegation state changes — if the wildcard resolves at DNS but TLS handshake fails at the edge, check that the **project-level** `*` entry still exists; re-adding it once DNS is on Vercel verifies near-instantly.
- Resolvers negative-cache NXDOMAIN aggressively — a name queried *before* the wildcard existed can show NXDOMAIN locally while Google/authoritative resolve it fine.
- A specific subdomain record for an *inactive* tenant still resolves at DNS — tenant state is an app-layer concern, not a DNS one.
- DNS record management lives at **team-level** Domains (`vercel.com` → Domains → domain → DNS Records), not in the project's Domains list.
- Staging (`visibleshelf.store`) was **not** moved — it stays at Cloudflare with hand-managed per-subdomain CNAMEs; if staging ever needs tenant subdomains it needs the same procedure or per-tenant records.

### Implications for the custom-domains spec (§1–§14)

- `visibleshelf.com` DNS is now **Vercel-managed**, which is the ideal posture for this spec: every future tenant-owned custom domain gets attached via the same project Domains mechanism the wildcard uses, and the DNS-verification flow in §6.2 is unchanged (it targets tenant-owned DNS, not ours).
- The phantom `SubdomainService` methods noted in the sprint's Phase 0 audit (`reserveSubdomain`, `verifySubdomainOwnership`, `getSubdomainConfig`, `updateSubdomainConfig`, and the `Subdomain` interface's `isVerified`/`sslEnabled`/`customDomain` fields) describe **this** unbuilt feature — they were stubbed with explicit errors so a future implementation lands against this spec rather than an accidental caller.
- Wildcard cert issuance timing: after delegation is detected, the `*` cert took on the order of minutes to issue and propagate to the edge.

### Operator quick-reference — giving a tenant a subdomain

- **No infra work per tenant.** The wildcard covers every name — setting a subdomain is purely an app-layer write: demo-tenant create modal (`subdomain` field), `PUT /api/admin/subdomains/:tenantId`, or tenant self-service `PUT /api/tenants/:id/subdomain`. Never create DNS records or Vercel domain entries for a tenant subdomain — an explicit record would *override* the wildcard for that name and need its own cert.
- **`subdomain` mirrors `slug`.** Assigning one writes the slug through `SlugSingletonService`, which rewrites `directory_settings_list` and `directory_listings_list` — the tenant's public slug URLs change everywhere. Treat it as a rename, not a cosmetic flag.
- **Clearing leaves the slug.** `DELETE` removes only `subdomain`; the storefront falls back to the `/tenant/{id}` path URL and slug URLs stay live.
- **Availability is shared across namespaces.** A name taken as another tenant's `slug` or a `directory_settings_list.slug` refuses assignment — one tenant's slug can never be another's subdomain. Reserved names (`www`, `api`, `admin`, …) are refused.
- **Production only.** The wildcard exists on `visibleshelf.com`; `visibleshelf.store` (staging) has none — subdomain URLs only resolve in production.
- **Verify with the real URL, not DNS.** `nslookup` will resolve *any* name under the wildcard, including names assigned to no tenant — resolution proves nothing. The check is `https://{subdomain}.visibleshelf.com` returning the storefront (app-layer tenant state applies — an inactive tenant 404s at the app even though DNS answers).

---

## 16. Sprint-plan alignment (2026-10-11)

Corrections folded in from the review of `docs/CUSTOM_DOMAINS_SPRINT_PLAN.md` so this spec matches the settled decisions and the live platform. Intent in §1–§13 is unchanged; the deltas are technical accuracy plus the D-table outcomes.

- **Data model (§5.1, §14.1.1):** dropped `cert_provisioning` from the status enum (Vercel exposes no certificate state — H4); `certificate_status` is **probe-derived only**; added `is_primary`; kept `ON DELETE CASCADE` with a pre-delete Vercel detach (D11); added the v1 partial unique index on `tenant_id where status <> 'disabled'` (D4/M7).
- **Resolution path (§5.2, §5.3, §7.3, §14.1.2, §14.1.3, §14.4):** the `public_custom_domains` view + Supabase-from-edge middleware are **superseded** (D5) — resolution is `GET /api/tenants/resolve-custom-domain/:host`, consumed by `proxy.ts` (Next.js 16). RLS stays on the base table only.
- **Vercel endpoints (§6.2, §7.1, §14.2.2):** project-domain get/verify/remove are **v9** (add is v10); `GET /v10/domains/{name}` is not in the REST reference — use `getProjectDomain` + `verifyProjectDomain` + `getDomainConfig`; a duplicate add returns 400 (H9). `getDomainConfig`'s `recommendedCNAME`/`recommendedIPv4` may be empty — fall back to constants (H10).
- **Lifecycle (§4.1, §14.3):** `active` requires `verified && !misconfigured` **plus** our HTTPS probe; the routing record (A/CNAME) and the ownership TXT are presented as separate steps (H4/H10).
- **Tiers & flags (§8.1, §13.1, §13.2):** v1 gates `professional` + `organization` (DB `tier_key`s), 1 domain, apex + `www` = one logical domain (D4/D9); beta rides the platform flag system, not `custom_domains_beta` (D10/H7).
- **Open questions (§11):** resolved by the sprint plan's D-table.
- **Phasing (§10):** sequenced by the sprint plan's Phase 0–6.

See `docs/CUSTOM_DOMAINS_SPRINT_PLAN.md` (second-pass findings B5–B7 / H7–H11 / M8–M14) for the evidence.
