# Navigation Reconciliation Design — Phase 2

> Date: June 21, 2026
> Goal: Define the canonical navigation structure that reconciles staging DB, production DB, and file-based fallbacks into one aligned system.

---

## Design Principles

1. **Database is the source of truth** — file-based fallbacks are disaster recovery only
2. **Staging and production must match** — same IDs, same structure, same content
3. **Fragile dynamic templates are preserved** — `tenant-locations` and `organization-locations` are not altered
4. **Template variable format** — normalize to `{tenantId}` (what the parser expects) across both DBs
5. **Sort orders are unique** — no collisions; roots increment by 10, children by 1
6. **Metadata is accurate** — `hasChildren`, `childrenKeys`, and `nestingLevel` reflect actual tree structure
7. **Icons map to available components** — every icon string has a matching entry in both `IconComponents` maps

---

## Part A: Staging ↔ Production Reconciliation

### A1. Links with Different IDs (same logical link)

For each pair, we pick the **earlier-created ID** (lower timestamp) as canonical and delete the other.

| Keep ID (canonical) | Delete ID | Label | Action |
|---|---|---|---|
| `custom-1779213549441` | `custom-1779362194902` | Capability Management | Delete prod ID, update prod to use staging ID |
| `custom-1779510947187` | `custom-1779511241216` | Product Options | Delete prod ID, update prod to use staging ID |
| `custom-1779648283963` | `custom-1779646378093` | Featured Options | Delete prod ID, update prod to use staging ID |
| `custom-1780042359659` | `custom-1780338476006` | Capability Control / Capability Center | **Decision: rename to "Capability Center"** (prod label is better), keep staging ID, delete prod ID |
| `custom-1781233908557` | `custom-1781237640281` | CRM Hub | **Decision: keep staging structure** (single CRM under Admin Panel), delete both prod CRM links |
| `custom-1781821981706` | `custom-1781821812396` | Directory Appearance | Delete prod ID, update prod to use staging ID |

### A2. Same ID, Different Content

| ID | Resolution |
|---|---|
| `custom-1776299086423` | **Keep "Customer Portal"** (production). The `/account` href is more useful as a platform-level link than `/my-orders`. Staging updated to match. |
| `custom-1777951998195` | **Keep production structure**: icon `inventory`, targets `{admin}`, parent `built-in-admin`. Staging updated to match. Root-level placement in staging is incorrect. |

### A3. Links Only in Staging

| ID | Label | Decision |
|---|---|---|
| `custom-1779711517144` | Subscriptions Home | **Delete** — redundant with `custom-1776198129531` (Subscriptions) which already has children |
| `custom-1779745466404` | Integration Options | **Keep** — add to production. Under My Integrations parent. |
| `custom-1780263588847` | Payment Settings | **Delete** — duplicate of `custom-1777953239409` (Payment Settings under Security & Platform) |
| `custom-1781233908557` | CRM Hub | **Keep** — this becomes the canonical CRM link (see A1) |

### A4. Links Only in Production

| ID | Label | Decision |
|---|---|---|
| `custom-1781237735609` | CRM Center | **Delete** — redundant with CRM Hub. Merging to single CRM link. |
| `custom-1780338476006` | Capability Center | **Delete** — replaced by staging ID `custom-1780042359659` (renamed to "Capability Center") |

### A5. CRM Structure Decision

**Canonical**: Single CRM group under `built-in-admin` (Admin Panel), matching staging structure.

```
built-in-admin (Admin Panel)
  └── CRM Hub (custom-1781233908557)
      ├── Dashboard → /settings/admin/crm
      ├── Requests Hub → /settings/admin/crm/requests
      ├── Tenants → /settings/admin/crm/tenants
      ├── Tickets → /settings/admin/crm/tickets
      └── Tasks → /settings/admin/crm/tasks
```

Production's `custom-1781237640281` (CRM Hub under Platform Capacity) and `custom-1781237735609` (CRM Center under Control Panel) are both deleted. The 5 children are added as new links under the canonical CRM Hub.

---

## Part B: New Links to Add (from file-based fallbacks)

### B1. Bot Platform (admin sidebar)

| ID | Label | Href | Icon | Targets | Sort | Parent | RBAC |
|---|---|---|---|---|---|---|---|
| `nav-bot-platform` | Bot Platform | | `bot` | `{admin}` | 136 | none | `requiredGroup: IS_PLATFORM_ADMIN` |
| `nav-bot-dashboard` | Dashboard | /settings/admin/bot | | `{admin}` | 136.1 | `nav-bot-platform` | |
| `nav-bot-guardrails` | Guardrails | /settings/admin/bot/guardrails | | `{admin}` | 136.2 | `nav-bot-platform` | |
| `nav-bot-intents` | Intents | /settings/admin/bot/intents | | `{admin}` | 136.3 | `nav-bot-platform` | |
| `nav-bot-skills` | Skills | /settings/admin/bot/skills | | `{admin}` | 136.4 | `nav-bot-platform` | |
| `nav-bot-knowledge` | Knowledge | /settings/admin/bot/knowledge | | `{admin}` | 136.5 | `nav-bot-platform` | |
| `nav-bot-tenants` | Tenants | /settings/admin/bot/tenants | | `{admin}` | 136.6 | `nav-bot-platform` | |

### B2. FAQ (tenant sidebar)

| ID | Label | Href | Icon | Targets | Sort | Parent | RBAC |
|---|---|---|---|---|---|---|---|
| `nav-faq` | FAQ | | `faq` | `{tenant}` | 118 | none | `requiredGroup: IS_TENANT_USER` |
| `nav-faq-hub` | FAQ Hub | /t/{tenantId}/faq | | `{tenant}` | 118.1 | `nav-faq` | |
| `nav-faq-options` | FAQ Options | /t/{tenantId}/faq/options | | `{tenant}` | 118.2 | `nav-faq` | |

### B3. Account Settings (admin sidebar)

| ID | Label | Href | Icon | Targets | Sort | Parent | RBAC |
|---|---|---|---|---|---|---|---|
| `nav-account-settings` | Account Settings | /settings | `admin` | `{admin}` | 137 | none | `dividerBefore: true` |

### B4. CRM Children (admin sidebar)

| ID | Label | Href | Icon | Targets | Sort | Parent | RBAC |
|---|---|---|---|---|---|---|---|
| `nav-crm-dashboard` | Dashboard | /settings/admin/crm | | `{admin}` | 135.1 | `custom-1781233908557` | |
| `nav-crm-requests` | Requests Hub | /settings/admin/crm/requests | | `{admin}` | 135.2 | `custom-1781233908557` | |
| `nav-crm-tenants` | Tenants | /settings/admin/crm/tenants | | `{admin}` | 135.3 | `custom-1781233908557` | |
| `nav-crm-tickets` | Tickets | /settings/admin/crm/tickets | | `{admin}` | 135.4 | `custom-1781233908557` | |
| `nav-crm-tasks` | Tasks | /settings/admin/crm/tasks | | `{admin}` | 135.5 | `custom-1781233908557` | |

### B5. Integration Options (staging-only, add to production)

Already exists in staging as `custom-1779745466404`. Insert into production with same ID.

---

## Part C: Structural Fixes

### C1. Template Variable Format

**Problem**: DB contains `${tenantId}`, parser expects `{tenantId}`.

**Fix**: SQL UPDATE on both databases:
```sql
UPDATE navigation_links
SET href = REPLACE(href, '${tenantId}', '{tenantId}')
WHERE href LIKE '%${tenantId}%';
```

**Affected**: ~30+ tenant links with template URLs.

### C2. Sort Order Renumbering

**Strategy**: Roots get multiples of 10 (0, 10, 20, ...). Children get parent_sort + 0.1, 0.2, etc. Grandchildren get parent_sort + 0.01, 0.02, etc.

This eliminates all collisions while preserving relative ordering.

**Example**:
- Root: sort_order = 50
- Child: sort_order = 50.1, 50.2, 50.3
- Grandchild: sort_order = 50.11, 50.12

### C3. Metadata Fixes

For each link, update metadata JSON:

```sql
-- For parent links (links that have children referencing them via parentKey)
UPDATE navigation_links
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(metadata, '{hasChildren}', 'true'::jsonb),
    '{childrenKeys}', to_jsonb(children_arr)
  ),
  '{nestingLevel}', '0'::jsonb
)
WHERE id IN (SELECT DISTINCT metadata->>'parentKey' FROM navigation_links WHERE metadata->>'parentKey' IS NOT NULL AND metadata->>'parentKey' != '');
```

A more complete approach uses a recursive CTE to compute nesting levels:

```sql
WITH RECURSIVE tree AS (
  SELECT id, 0 AS level FROM navigation_links WHERE metadata->>'parentKey' IS NULL OR metadata->>'parentKey' = ''
  UNION ALL
  SELECT n.id, t.level + 1 FROM navigation_links n
  JOIN tree t ON n.metadata->>'parentKey' = t.id
)
UPDATE navigation_links n
SET metadata = jsonb_set(n.metadata, '{nestingLevel}', to_jsonb(t.level)::jsonb)
FROM tree t WHERE n.id = t.id;
```

### C4. Duplicate Link Resolution

| Label | Duplicates | Resolution |
|---|---|---|
| Appearance | `custom-1776116345419` (Preferences child), `custom-1776277108746` (My Settings child) | **Keep both** — they're in different parent groups and point to different hrefs (`/settings/appearance` vs `/t/{tenantId}/settings/appearance`) |
| Branding | `custom-1776274165052` (Store Setup child → tenant), `custom-1776296199759` (Platform child → admin) | **Keep both** — different scopes (tenant branding vs platform branding) |
| Payment Settings | `custom-1777953239409` (Security & Platform child), `custom-1780263588847` (Platform child, staging only) | **Delete `custom-1780263588847`** — staging-only duplicate |
| Featured Products | `custom-1776272982768` (My Catalog child), `custom-1776296949090` (Catalog child), `custom-1776335113409` (Directory child) | **Keep all three** — different parents, different scopes (tenant featured, admin catalog featured, directory featured) |
| Onboarding | `custom-1776277240097` (Store Setup child), `custom-1776281861024` (Platform child), `custom-1776284172107` (My Storefront child) | **Keep all three** — different scopes (tenant onboarding, platform onboarding, storefront onboarding) |
| Security | `built-in-security` (root), `custom-1776120095619` (built-in-security child), `custom-1776335396360` (Security & Platform child) | **Keep all three** — root is the universal link, child is the sub-page, admin one is under a different group |

**Conclusion**: Most "duplicates" are actually the same label in different parent contexts with different hrefs. Only `custom-1780263588847` (Payment Settings) is a true duplicate to delete.

---

## Part D: Icon Gap Analysis

### D1. Admin Panel IconComponents (page.tsx)

Currently has: `home, user, shield, lock, building, palette, globe, credit-card, chat, admin, bell, crown, shield-role, star, briefcase, users, eye, dashboard, products, categories, quickstart, alerts, capacity, chart, cog, inventory`

### D2. NavItemRow IconComponents (sidebars)

Currently has (after hyphen normalization): `dashboard, users, inventory, orders, google, settings, cog, store, integrations, home, user, shield, lock, building, palette, globe, creditcard, chat, admin, bell, products, categories, tags, barcode, scan, quickstart, featured, directory, help, platform, hours, review, team, onboarding, support`

### D3. Icons Used in DB Not in Admin Panel

| DB Icon | In Admin Panel? | In NavItemRow? | Action |
|---|---|---|---|
| `navigation` | ❌ | ❌ | **Add to both** — used by Navigation Control link |
| `headset` | ❌ | ❌ | **Add to both** — needed for CRM Hub |
| `bot` | ❌ | ❌ | **Add to both** — needed for Bot Platform |
| `orders` | ❌ | ✅ | **Add to admin panel** |
| `directory` | ❌ | ✅ | **Add to admin panel** |
| `integrations` | ❌ | ✅ | **Add to admin panel** |
| `faq` | ❌ | ❌ | **Add to both** — needed for FAQ link |
| `store` | ❌ | ✅ | **Add to admin panel** |
| `cube` | ❌ | ❌ (uses `inventory` for same shape) | **Add to both** — or map to `inventory` |
| `settings` | ❌ | ✅ | **Add to admin panel** |
| `tags` | ❌ | ✅ | **Add to admin panel** |
| `barcode` | ❌ | ✅ | **Add to admin panel** |
| `scan` | ❌ | ✅ | **Add to admin panel** |
| `featured` | ❌ | ✅ | **Add to admin panel** |
| `help` | ❌ | ✅ | **Add to admin panel** |
| `platform` | ❌ | ✅ | **Add to admin panel** |
| `hours` | ❌ | ✅ | **Add to admin panel** |
| `review` | ❌ | ✅ | **Add to admin panel** |
| `team` | ❌ | ✅ | **Add to admin panel** |
| `onboarding` | ❌ | ✅ | **Add to admin panel** |
| `support` | ❌ | ✅ | **Add to admin panel** |

### D4. Icons Needed for New Links

| New Link | Icon Needed | Exists? |
|---|---|---|
| Bot Platform | `bot` | ❌ Add to both |
| FAQ | `faq` | ❌ Add to both |
| CRM Hub | `headset` | ❌ Add to both |
| Account Settings | `admin` | ✅ Already exists |

### D5. Summary: Icons to Add

**To admin panel `IconComponents` (page.tsx)** — 21 new icons:
`navigation, headset, bot, orders, directory, integrations, faq, store, settings, tags, barcode, scan, featured, help, platform, hours, review, team, onboarding, support, cube`

**To NavItemRow `IconComponents`** — 5 new icons:
`navigation, headset, bot, faq, cube`

---

## Part E: File-Based Fallback Updates

### E1. Strategy

The fallbacks should mirror the reconciled database structure as a disaster-recovery snapshot. This means:

1. **Admin fallback** (`buildAdminNavItems`): Add all admin-targeted DB links as fallback items
2. **Universal fallback** (`buildNavItems`): Add all `all`-targeted DB links as fallback items
3. **Tenant fallback** (`buildTenantNav`): Add all `tenant`-targeted DB links as fallback items

### E2. What to Add to Each Fallback

**Admin fallback** — currently has 16 root groups. Needs ~90+ additional links to match DB:
- Platform group with 12+ children (Dashboard, My Profile, My Locations, Support, Directory, Shops, Onboarding, All Settings, Customer Portal, Category Discovery, Branding, Payment Settings)
- Control Panel group with children (All Tenants, Organizations, Feature Overrides, Alert Ticker, Admin Settings, Capability Center)
- Platform Inventory group with children (Inventory Dashboard, Inventory Transfers, Universal Product Catalog, Slug Registry)
- CRM children (Dashboard, Requests Hub, Tenants, Tickets, Tasks)
- Additional Subscriptions children (Platform Revenue, Notification Emails, Capability Management)
- Additional Security & Platform children (Platform Settings, Sentry Monitoring, Subdomain Mgmt, Security, Payment Settings)
- Additional Directory children (Listings, Featured, Featured Products, Directory Appearance)
- Additional Catalog children (Product Categories, Platform Categories, Enrichment, Store Categories, Featured Products)
- Additional Content children (Reviews, Analytics)
- Additional Analytics children (Scan Metrics, Product Intelligence)
- Additional Capacity children (Overview, Location Limits, Alerts, Limits Configuration)
- Additional Quick Start children (Categories Quick Start)
- Additional Users children (All Users, Deletion Requests)
- Additional Tenants children (Tenants Center)
- Store Setup, My Catalog, My Directory, Quick Inventory (tenant links that also target admin)

**Universal fallback** — currently has 7 root groups. Needs:
- Platform group with 12+ children
- Contact & Support as root
- Customer Portal link
- Additional Preferences children

**Tenant fallback** — currently has 9 root groups. Needs:
- My Storefront group with children (Store Profile, Store Reviews, Store Onboarding, My Catalog, My Directory, Store Setup, Quick Inventory)
- My Subscription group with children (Billing Dashboard, Subscription Center)
- Quick Inventory group with children (Barcode Scanner)
- Additional My Inventory children (Inventory Transfers, Digital Downloads)
- Additional My Orders children (Commerce Settings)
- Additional My Integrations children (Integration Options, Custom Subdomain)
- Additional My Settings children (Product Options, Featured Options)
- Bot group with children (Dashboard, Configuration, Analytics, Skills, Knowledge, Widget)

### E3. Implementation Approach

Given the volume (~90+ links), the fallback update should be done programmatically:
1. Generate the fallback arrays from the reconciled DB structure
2. Replace the `buildAdminNavItems()`, `buildNavItems()`, and `buildTenantNav()` functions
3. Use the same icon strings as the DB (mapped through `getIconComponent`)
4. Include RBAC gates matching the DB `requiredGroup`/`requiredPermission` fields

**Alternative**: Keep fallbacks minimal (current state) and accept that disaster recovery provides reduced navigation. This is simpler but riskier.

**Recommendation**: Update fallbacks to match DB. The all-or-nothing switch means if the DB has links, fallbacks aren't used — but if the DB is down, having comprehensive fallbacks prevents total navigation loss.

---

## Part F: Final Canonical Structure

### F1. Admin Sidebar (target: admin)

```
Platform Home (built-in-home, sort 0)
Admin Dashboard (custom-1776194976236, sort 10)
Users (custom-1776195164826, sort 20)
  ├── All Users (sort 20.1)
  └── Deletion Requests (sort 20.2)
Platform Capacity (custom-1776195589149, sort 30)
  ├── Capacity Center (sort 30.1)
  └── Limits Configuration (sort 30.2)
Quick Start Center (custom-1776196158480, sort 40)
  ├── Seed Categories (sort 40.1)
  ├── Seed Products (sort 40.2)
  └── Categories Quick Start (sort 40.3)
Subscriptions (custom-1776198129531, sort 50)
  ├── Tier Management (sort 50.1)
  ├── Tenant Subscription (sort 50.2)
  ├── Billing Dashboard (sort 50.3)
  ├── Manual Billing (sort 50.4)
  ├── Platform Revenue (sort 50.5)
  ├── Notification Emails (sort 50.6)
  ├── Capability Management (sort 50.7)
  └── Subscriptions Home (sort 50.8) [if kept]
Catalog (custom-1776334713623, sort 60)
  ├── Product Categories (sort 60.1)
  ├── Platform Categories (sort 60.2)
  ├── Store Categories (sort 60.3)
  ├── Featured Products (sort 60.4)
  └── Enrichment (sort 60.5)
Directory (custom-1776334967107, sort 70)
  ├── Listings (sort 70.1)
  ├── Featured (sort 70.2)
  ├── Featured Products (sort 70.3)
  └── Directory Appearance (sort 70.4)
Content (custom-1776335203414, sort 80)
  ├── Reviews (sort 80.1)
  └── Analytics (sort 80.2)
Analytics (custom-1776336009181, sort 90)
  ├── Scan Metrics (sort 90.1)
  └── Product Intelligence (sort 90.2)
Security & Platform (custom-1776335347363, sort 100)
  ├── Platform Settings (sort 100.1)
  ├── Sentry Monitoring (sort 100.2)
  ├── Subdomain Mgmt (sort 100.3)
  ├── Security (sort 100.4)
  └── Payment Settings (sort 100.5)
Control Panel (custom-1776236817068, sort 110)
  ├── All Tenants (sort 110.1)
  ├── Organizations (sort 110.2)
  ├── Feature Overrides (sort 110.3)
  ├── Alert Ticker (sort 110.4)
  ├── Admin Settings (sort 110.5)
  └── Capability Center (sort 110.6)
Bot Platform (nav-bot-platform, sort 120) [NEW]
  ├── Dashboard (sort 120.1)
  ├── Guardrails (sort 120.2)
  ├── Intents (sort 120.3)
  ├── Skills (sort 120.4)
  ├── Knowledge (sort 120.5)
  └── Tenants (sort 120.6)
Admin Panel (built-in-admin, sort 130)
  ├── Navigation Control (sort 130.1)
  ├── Tenants Center (sort 130.2)
  ├── Platform Inventory (sort 130.3) [moved under Admin Panel per decision]
  │   ├── Inventory Dashboard (sort 130.31)
  │   ├── Inventory Transfers (sort 130.32)
  │   ├── Universal Product Catalog (sort 130.33)
  │   └── Slug Registry (sort 130.34)
  └── CRM Hub (sort 130.4) [under Admin Panel per decision]
      ├── Dashboard (sort 130.41)
      ├── Requests Hub (sort 130.42)
      ├── Tenants (sort 130.43)
      ├── Tickets (sort 130.44)
      └── Tasks (sort 130.45)
Account Settings (nav-account-settings, sort 140) [NEW, dividerBefore]
```

### F2. Universal Sidebar (target: all)

```
Platform Home (built-in-home, sort 0)
My Account (built-in-account, sort 10)
My Locations (custom-1776145918511, sort 20) [dynamic: tenant-locations]
  └── View Locations (sort 20.1)
My Organizations (custom-1776158068432, sort 30) [dynamic: organization-locations]
Preferences (custom-1776114966134, sort 40)
  ├── Appearance (sort 40.1)
  └── Language (sort 40.2)
Security & Privacy (built-in-security, sort 50)
  ├── Security (sort 50.1)
  ├── Multi-Factor Auth (sort 50.2)
  └── Privacy (sort 50.3)
Contact & Support (custom-1776334272647, sort 60)
Platform (custom-1776277320507, sort 70)
  ├── Dashboard (sort 70.1)
  ├── My Profile (sort 70.2)
  ├── My Locations (sort 70.3)
  ├── Support (sort 70.4)
  ├── Directory (sort 70.5)
  ├── Shops (sort 70.6)
  ├── Onboarding (sort 70.7)
  ├── All Settings (sort 70.8)
  ├── Customer Portal (sort 70.9)
  ├── Category Discovery (sort 70.10)
  ├── Branding (sort 70.11)
  └── Payment Settings (sort 70.12)
Quick Inventory (custom-1777854451499, sort 80)
  └── Barcode Scanner (sort 80.1)
```

### F3. Tenant Sidebar (target: tenant)

```
My Dashboard (custom-1776242834569, sort 0)
My Inventory (custom-1776272500698, sort 10)
  ├── Inventory Center (sort 10.1)
  ├── Product Wizard (sort 10.2)
  ├── Quick Start (sort 10.3)
  ├── Barcode Scan (sort 10.4)
  ├── Categories (sort 10.5)
  ├── Inventory Transfers (sort 10.6)
  └── Digital Downloads (sort 10.7)
My Orders (custom-1776269092634, sort 20)
  ├── Order Management (sort 20.1)
  ├── Payment Gateways (sort 20.2)
  ├── Fulfillment Options (sort 20.3)
  └── Commerce Settings (sort 20.4)
My Storefront (custom-1776274025839, sort 30)
  ├── Store Profile (sort 30.1)
  ├── Store Reviews (sort 30.2)
  ├── Store Onboarding (sort 30.3)
  ├── My Catalog (sort 30.4)
  │   ├── Product Catalog (sort 30.41)
  │   └── Featured Products (sort 30.42)
  ├── My Directory (sort 30.5)
  │   ├── Directory Settings (sort 30.51)
  │   └── Directory Featured (sort 30.52)
  ├── Store Setup (sort 30.6)
  │   ├── Branding (sort 30.61)
  │   ├── Store Hours (sort 30.62)
  │   ├── Business Category (sort 30.63)
  │   ├── Location Status (sort 30.64)
  │   └── Onboarding (sort 30.65)
  └── Quick Inventory (sort 30.7)
      └── Barcode Scanner (sort 30.71)
My Locations (custom-1776145918511, sort 40) [dynamic: tenant-locations]
My Organizations (custom-1776158068432, sort 50) [dynamic: organization-locations]
My Integrations (custom-1776274655551, sort 60)
  ├── Google Merchant Center (sort 60.1)
  ├── Feed Validation (sort 60.2)
  ├── Clover POS (sort 60.3)
  ├── Square POS (sort 60.4)
  ├── Custom Subdomain (sort 60.5)
  └── Integration Options (sort 60.6)
My Subscription (custom-1777134991750, sort 70)
  ├── Subscription Center (sort 70.1)
  └── Billing Dashboard (sort 70.2)
My Settings (custom-1776276917946, sort 80)
  ├── Store Settings (sort 80.1)
  ├── Team Members (sort 80.2)
  ├── Appearance (sort 80.3)
  ├── Language & Region (sort 80.4)
  ├── Product Options (sort 80.5)
  └── Featured Options (sort 80.6)
FAQ (nav-faq, sort 90) [NEW]
  ├── FAQ Hub (sort 90.1)
  └── FAQ Options (sort 90.2)
Bot (from file-based, sort 100) [NEW — add to DB]
  ├── Dashboard (sort 100.1)
  ├── Configuration (sort 100.2)
  ├── Analytics (sort 100.3)
  ├── Skills (sort 100.4)
  ├── Knowledge (sort 100.5)
  └── Widget (sort 100.6)
Platform (custom-1776277320507, sort 110)
  ├── Dashboard (sort 110.1)
  ├── My Profile (sort 110.2)
  ├── My Locations (sort 110.3)
  ├── Support (sort 110.4)
  ├── Directory (sort 110.5)
  ├── Shops (sort 110.6)
  ├── Onboarding (sort 110.7)
  ├── All Settings (sort 110.8)
  ├── Customer Portal (sort 110.9)
  └── Category Discovery (sort 110.10)
```

---

## Part G: Migration Execution Plan

### Step 1: Fix template variables (both DBs)
```sql
UPDATE navigation_links
SET href = REPLACE(href, '${tenantId}', '{tenantId}')
WHERE href LIKE '%${tenantId}%';
```

### Step 2: Reconcile staging ↔ production
- Delete production-only links (`custom-1781237735609`, `custom-1780338476006`)
- Delete staging-only duplicates (`custom-1779711517144`, `custom-1780263588847`)
- Update production links to match staging IDs for the 6 divergent pairs
- Update staging `custom-1776299086423` to match production content (Customer Portal)
- Update staging `custom-1777951998195` to match production structure (under built-in-admin)
- Add staging-only `custom-1779745466404` (Integration Options) to production

### Step 3: Add new links (both DBs)
- Bot Platform group + 6 children
- FAQ group + 2 children
- Account Settings link
- CRM Hub children (5)
- Bot tenant group + 6 children (from file-based)

### Step 4: Fix sort orders (both DBs)
- Renumber all links using the decimal scheme

### Step 5: Fix metadata (both DBs)
- Compute hasChildren, childrenKeys, nestingLevel via recursive SQL

### Step 6: Add missing icons (code change)
- Add 21 icons to admin panel `IconComponents` in `page.tsx`
- Add 5 icons to `NavItemRow.tsx` `IconComponents`

### Step 7: Update file-based fallbacks (code change)
- Replace `buildAdminNavItems()`, `buildNavItems()`, `buildTenantNav()` with comprehensive versions matching the DB structure

---

## Confirmed Decisions (locked in)

1. **CRM placement** → **Admin Panel** (under `built-in-admin`)
2. **Customer Portal vs Orders** → **Customer Portal** at `/account`
3. **Platform Inventory placement** → **Under Admin Panel** (production structure)
4. **Fallback update strategy** → **Full mirror**
5. **Sort order scheme** → **Decimal hierarchy encoded as integers** (roots: 10, 20, 30...; children: parent*100+1; grandchildren: child*100+1) — DB column is Int, not float
6. **Bot tenant links** → **Yes**, add to DB from file-based
