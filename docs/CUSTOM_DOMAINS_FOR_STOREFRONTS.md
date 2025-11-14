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
   - Displays those DNS instructions:
     - Step 1: Log into your domain provider.
     - Step 2: Add the TXT and/or CNAME records exactly as shown (copied from Vercel's response).
5. Tenant updates DNS and clicks **"Check DNS"** or waits for automatic background verification.
6. Backend verification job:
   - Calls the relevant Vercel API endpoint for that domain.
   - Reads Vercel's `verified` and certificate state.
   - Updates `custom_domains.status` and certificate fields in Supabase.
7. On success:
   - Status transitions to `active` once Vercel reports the domain as verified and TLS-ready.
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
  - Status (`pending_verification`, `verified`, `cert_provisioning`, `active`, `disabled`, `error`)
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
  tenant_id uuid not null references tenants(id),
  domain text not null unique, -- e.g. 'shop.mylocalstore.com'
  status text not null check (status in (
    'pending_verification',
    'verified',
    'cert_provisioning',
    'active',
    'disabled',
    'error'
  )),
  verification_token text, -- optional: only needed if we ever add our own TXT-flow on top of Vercel
  vercel_domain_id text, -- ID or name reference returned by Vercel Domains/Project Domains API
  verification_checked_at timestamptz,
  verification_error text,
  certificate_status text, -- e.g. 'none', 'pending', 'issued', 'failed'
  certificate_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Notes:
- `domain` should be stored normalized (lowercase, no trailing dot).
- Index on `domain` for fast host lookup.
- Optionally store `primary` flag if multiple domains per tenant.

If we decide to support custom domains in multiple environments (e.g., staging and production), we may add an `environment` column (e.g., `env text check (env in ('staging','production'))`) and include it in uniqueness constraints. For v1, the recommendation is to treat **custom domains as production-only** to avoid confusion.

### 5.2 Host → Tenant Resolution

At request time (web app or edge/middleware layer):

1. Read `Host` header, normalize (lowercase, strip port).
2. Query `custom_domains` by `domain` where `status = 'active'`.
3. If match found → extract `tenant_id` and set tenant context.
4. If no match found → fall back to existing tenant routing scheme (e.g. `/t/{tenantId}/...` under platform domain) or return safe 404 for unknown custom domains.

This logic should be centralized (e.g., in a `resolveTenantFromHost` utility or middleware) to avoid duplication.

### 5.3 Supabase RLS & Public Access Pattern

- Writes to `custom_domains` (create/update/delete) should only be allowed via backend services using the **service role** key.
- For read access in Vercel Middleware (edge), we need a safe way to resolve `domain → tenant_id` without exposing sensitive data:
  - Option A: Create a **limited view** (e.g., `public_custom_domains`) that only exposes `domain` and `tenant_id`, with RLS allowing read access to anonymous clients.
  - Option B: Implement an internal API endpoint for host resolution (less ideal for latency at the edge).
- The recommended approach is Option A with a very small surface area and strict RLS, so Middleware can query Supabase directly using the public anon key while keeping write operations locked down.

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
  - A background job or "Check DNS" API endpoint calls `GET /v10/domains/{name}` or `GET /v10/projects/{projectId}/domains/{name}`.
  - When Vercel reports the domain as `verified` and TLS as ready, backend updates Supabase:
    - `status = 'active'`
    - `certificate_status = 'issued'` (or similar)
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
- `POST /api/tenants/{tenantId}/custom-domains/{id}/verify`
- `DELETE /api/tenants/{tenantId}/custom-domains/{id}`

Responsibilities:

- Validate domain format.
- Insert or update `custom_domains` rows in Supabase.
- Call Vercel Domains / Project Domains APIs to attach domains to the storefront project.
- Store any Vercel domain identifiers and verification metadata.
- Return DNS instructions payload (TXT/CNAME records from Vercel) to the frontend.
- Trigger or schedule background verification checks.
- Poll Vercel for updated verification and certificate status, and update Supabase `status`, `certificate_status`, and error fields.

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

- Add a **host-based tenant resolution** layer in the Next.js app running on Vercel:
  - Use `middleware.ts` (edge middleware) to read `headers().get('host')`, normalize it, and resolve `tenantId` via a Supabase query against `custom_domains`.
  - Maintain a configuration of **platform root domains** (e.g., `app.retailvisibility.com`). For these hosts, continue using existing path-based tenant routing (e.g. `/t/{tenantId}/...`).
  - For **non-platform hosts**, attempt to resolve them as custom domains via `custom_domains`.
  - Attach tenant context by rewriting to a tenant-scoped path (e.g. `/t/{tenantId}/storefront/...`) or by injecting a header (e.g. `x-tenant-id`) consumed by downstream handlers.

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
- **Enterprise / Organization**: Multiple custom domains.

This aligns with the mission of providing **enterprise features at small business pricing** while still making higher tiers feel materially more powerful.

Implementation:
- Add custom domain limits to existing tier system (similar to SKU/location capacity).
- Enforce limits within the API when creating new `custom_domains` entries.

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
  - Professional (1 domain): ensure limit enforcement and clear errors when exceeding.
  - Enterprise/Organization (multiple domains): ensure multiple domains and primary domain selection work.
- **Lifecycle scenarios**:
  - Add → verify → active → disable → re-add.
  - Tenant deletion and tier downgrade flows.
  - Vercel API failure and rate-limit handling.

### 13.2 Rollout Strategy

- Gate custom domains behind a feature flag (e.g., `custom_domains_beta`).
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
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  status text not null check (status in (
    'pending_verification',
    'verified',
    'cert_provisioning',
    'active',
    'disabled',
    'error'
  )),
  verification_token text,
  vercel_domain_id text,
  verification_checked_at timestamptz,
  verification_error text,
  certificate_status text,
  certificate_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_domains_domain
  on public.custom_domains (lower(domain));
```

> Note: if you later support multiple environments, add an `env` column and include it in uniqueness/indexing as discussed earlier.

#### 14.1.2 Public View for Host Resolution

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

#### 14.1.3 RLS Policies (Example)

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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel addDomain failed (${res.status}): ${body}`);
  }

  return (await res.json()) as VercelDomainResponse;
}

export async function getDomain(domain: string): Promise<VercelDomainResponse> {
  const url = new URL(`${VERCEL_API_BASE}/v10/domains/${domain}`);
  withTeam(url.searchParams);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: vercelHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel getDomain failed (${res.status}): ${body}`);
  }

  return (await res.json()) as VercelDomainResponse;
}

export async function removeDomainFromProject(domain: string): Promise<void> {
  const url = new URL(`${VERCEL_API_BASE}/v10/projects/${projectId}/domains/${domain}`);
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
import { addDomainToProject, getDomain, removeDomainFromProject } from './vercelDomainsService';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type CustomDomainStatus =
  | 'pending_verification'
  | 'verified'
  | 'cert_provisioning'
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

  const vercelDomain = await getDomain(normalizedDomain);

  const status: CustomDomainStatus = vercelDomain.verified ? 'active' : 'pending_verification';

  const { data, error } = await supabase
    .from('custom_domains')
    .update({
      status,
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

These functions can back your `POST /custom-domains`, `POST /custom-domains/{id}/verify`, and `DELETE /custom-domains/{id}` endpoints.

---

### 14.4 Next.js Middleware for Host-based Tenant Resolution

Below is an example `middleware.ts` for the web app on Vercel using Supabase anon client to resolve `host → tenantId` via `public_custom_domains`.

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
