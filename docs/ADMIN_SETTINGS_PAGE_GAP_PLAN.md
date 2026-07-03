# Admin Settings Page Gap Closure Plan

## Problem

The admin dashboard at `/settings/admin/page.tsx` lists ~30 sections across 14 groups, but **42+ admin route pages exist** under `apps/web/src/app/(platform)/settings/admin/`. **22 top-level pages and ~15 subpages are missing** from the dashboard. Additionally, 3 dashboard links point to non-existent routes, and Branding is duplicated across two groups.

---

## Gap Analysis

### Missing Pages (routes exist, not on dashboard)

| # | Route | Description | Priority |
|---|-------|-------------|----------|
| 1 | `admin/analytics` | Platform analytics dashboard | P1 |
| 2 | `admin/billing/manual-billing` | Manual billing, invoices, payment methods, service charges | P1 |
| 3 | `admin/bot` | Bot management dashboard | P1 |
| 4 | `admin/bot/guardrails` | Bot guardrail rules management | P1 |
| 5 | `admin/bot/intents` | Bot intent management | P2 |
| 6 | `admin/bot/knowledge` | Bot knowledge embeddings management | P2 |
| 7 | `admin/bot/skills` | Bot skill toggles per tenant | P2 |
| 8 | `admin/bot/tenants` | Bot tenant configuration | P2 |
| 9 | `admin/bsaas-analytics` | BSAAS analytics dashboard | P2 |
| 10 | `admin/bsaas-catalog` | BSAAS catalog management | P2 |
| 11 | `admin/bsaas-promotions` | BSAAS promotions management | P2 |
| 12 | `admin/capabilities` | Capability management dashboard | P1 |
| 13 | `admin/catalog` | Platform catalog management | P2 |
| 14 | `admin/crm` | CRM dashboard (admin) | P1 |
| 15 | `admin/crm/requests` | CRM requests hub | P2 |
| 16 | `admin/crm/tasks` | CRM tasks (Kanban) | P2 |
| 17 | `admin/crm/tenants` | CRM tenant list | P2 |
| 18 | `admin/crm/tenants/[tenantId]` | CRM tenant detail (6 tabs) | P2 |
| 19 | `admin/crm/tickets` | CRM global tickets | P2 |
| 20 | `admin/crm/tickets/[ticketId]` | CRM ticket detail | P2 |
| 21 | `admin/demo-tenants` | Demo tenant management | P3 |
| 22 | `admin/directory` | Directory management dashboard | P1 |
| 23 | `admin/directory/appearance` | Directory appearance settings | P3 |
| 24 | `admin/directory/featured` | Directory featured stores management | P2 |
| 25 | `admin/directory/listings` | Directory listings management | P2 |
| 26 | `admin/enrichment` | Data enrichment dashboard | P2 |
| 27 | `admin/featured-placement-revenue` | Featured placement revenue dashboard | P2 |
| 28 | `admin/inventory` | Platform inventory overview | P2 |
| 29 | `admin/inventory-dashboard` | Inventory analytics dashboard | P2 |
| 30 | `admin/limits` | Tenant limits management | P2 |
| 31 | `admin/navigation` | Navigation links management | P1 |
| 32 | `admin/notification-logs` | Notification log viewer | P2 |
| 33 | `admin/platform-revenue` | Platform revenue dashboard | P1 |
| 34 | `admin/reviews` | Review moderation dashboard | P2 |
| 35 | `admin/slug-registry` | Slug registry management | P3 |
| 36 | `admin/suppliers` | Supplier management | P2 |
| 37 | `admin/suppliers/health` | Supplier health monitoring | P3 |
| 38 | `admin/suppliers/[id]/catalog` | Supplier catalog detail | P3 |

### Broken Links (dashboard links to non-existent routes)

| # | Dashboard Link | Issue |
|---|----------------|-------|
| 1 | `/settings/admin/upgrade-requests` | No route page exists |
| 2 | `/settings/admin/organization-requests` | No route page exists |
| 3 | `/settings/admin/gbp-sync` | No route page exists |

### Other Issues

- **Branding duplicate**: Listed in both "Platform Configuration" and "Security & Compliance" groups
- **"Tier & Feature Matrix" self-link**: Points to `/settings/admin` (the dashboard itself)

---

## Phased Implementation Plan

### Phase 1: Critical Missing Pages (P1 — 10 cards)

**Goal:** Add the highest-value admin pages that are fully built but invisible to admins.

**New group: "Bot Management"**
- Bot Dashboard (`admin/bot`)
- Bot Guardrails (`admin/bot/guardrails`)
- Bot Intents (`admin/bot/intents`)
- Bot Knowledge (`admin/bot/knowledge`)
- Bot Skills (`admin/bot/skills`)
- Bot Tenants (`admin/bot/tenants`)

**New group: "CRM"**
- CRM Dashboard (`admin/crm`)
- CRM Tickets (`admin/crm/tickets`)
- CRM Tasks (`admin/crm/tasks`)
- CRM Requests (`admin/crm/requests`)

**Add to existing groups:**
- "Analytics" → existing "Platform Configuration" or new group: Platform Analytics (`admin/analytics`)
- "Capabilities" → existing "Feature Flags & Overrides": Capability Management (`admin/capabilities`)
- "Navigation" → existing "Platform Configuration": Navigation Links (`admin/navigation`)
- "Directory" → new group or existing "Content & Data": Directory Management (`admin/directory`)
- "Platform Revenue" → existing "Billing & Subscriptions": Platform Revenue Dashboard (`admin/platform-revenue`)
- "Manual Billing" → existing "Billing & Subscriptions": Manual Billing (`admin/billing/manual-billing`)

**Estimated changes:** ~25 new section entries in `adminGroups` array, 2 new groups.

### Phase 2: Operational Pages (P2 — 18 cards)

**Goal:** Add operational/monitoring admin pages.

**Add to existing or new groups:**
- BSAAS Analytics (`admin/bsaas-analytics`)
- BSAAS Catalog (`admin/bsaas-catalog`)
- BSAAS Promotions (`admin/bsaas-promotions`)
- Catalog Management (`admin/catalog`)
- CRM Tenant List (`admin/crm/tenants`)
- Directory Featured (`admin/directory/featured`)
- Directory Listings (`admin/directory/listings`)
- Data Enrichment (`admin/enrichment`)
- Featured Placement Revenue (`admin/featured-placement-revenue`)
- Inventory Overview (`admin/inventory`)
- Inventory Dashboard (`admin/inventory-dashboard`)
- Tenant Limits (`admin/limits`)
- Notification Logs (`admin/notification-logs`)
- Review Moderation (`admin/reviews`)
- Supplier Management (`admin/suppliers`)

**Estimated changes:** ~15 new section entries, possible new "Suppliers" and "Inventory" groups.

### Phase 3: Cleanup & Fixes (P3 — quick wins)

**Goal:** Fix broken links, remove duplicates, add remaining low-priority pages.

**Fixes:**
1. Remove duplicate Branding from "Security & Compliance" group
2. Fix or remove 3 broken links (upgrade-requests, organization-requests, gbp-sync) — either create stub pages or remove the cards
3. Fix "Tier & Feature Matrix" self-link (points to `/settings/admin`)

**Remaining low-priority pages:**
- Demo Tenants (`admin/demo-tenants`)
- Directory Appearance (`admin/directory/appearance`)
- Slug Registry (`admin/slug-registry`)
- Supplier Health (`admin/suppliers/health`)
- Supplier Catalog Detail (`admin/suppliers/[id]/catalog`)

**Estimated changes:** Remove 2-3 cards, fix 3 hrefs, add 5 new section entries.

### Phase 4: Group Reorganization (optional)

**Goal:** Reorganize groups for better information architecture now that all pages are listed.

**Proposed group structure (14 → 12 groups):**

1. **Platform Configuration** — Ticker, Branding, Subdomain, Payment, Navigation, Platform Settings
2. **Security & Compliance** — Security, Sentry, Deletion Requests
3. **Feature & Capability Management** — Feature Overrides, Capabilities, Tier System, Tier Management
4. **User & Tenant Management** — Users, Tenants, Organizations, Demo Tenants
5. **Bot Management** — Bot Dashboard, Guardrails, Intents, Knowledge, Skills, Bot Tenants
6. **CRM** — Dashboard, Tickets, Tasks, Requests, Tenant List
7. **Billing & Revenue** — Billing Dashboard, Manual Billing, Platform Revenue, Featured Placement Revenue, Platform Offerings
8. **BSAAS** — Catalog, Promotions, Analytics
9. **Content & Directory** — Categories, Platform Categories, Catalog, Directory, Directory Featured, Directory Listings, Directory Appearance
10. **Inventory & Suppliers** — Inventory, Inventory Dashboard, Suppliers, Supplier Health
11. **Featured Products** — Featured Products Overview
12. **Analytics & Monitoring** — Platform Analytics, Scan Metrics, Enrichment, Notification Logs, Reviews, Slug Registry, Limits, Capacity (Overview, Alerts, Location Limits)
13. **Quick Start Tools** — Product Quick Start, Category Quick Start

---

## Implementation Notes

- All changes are in a single file: `apps/web/src/app/(platform)/settings/admin/page.tsx`
- Each new section entry follows the existing `AdminSection` type pattern (title, description, href, icon, color, stats, badge?)
- Icons: reuse SVG patterns from existing sections or use Lucide icons if already imported
- No new dependencies needed — this is purely adding array entries to `adminGroups`
- The `TenantSettings.tsx` file (tenant-facing settings) is separate and not affected
- Per memory: navigation is database-driven, but the admin dashboard page is a standalone page with hardcoded cards — it does NOT use the `navigation_links` table

## Verification

After each phase:
1. Run `checkweb` to confirm zero TS errors
2. Navigate to `/settings/admin` and verify all new cards render
3. Click each new card to verify it links to a working page
4. Verify no broken links remain
