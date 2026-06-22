# Navigation Audit Report — Phase 1

> Date: June 21, 2026
> Method: Direct SQL query against both staging and production Supabase databases
> Table: `navigation_links`
> Staging project: `nbwsiobosqawrugnqddo` (us-east-1)
> Production project: `pzxiurmwgkqhghxydazt` (us-east-2)

---

## Executive Summary

**Both databases are far more populated than expected.** An admin has been actively using the Navigation Control Panel to build out a comprehensive navigation structure. However, **staging and production have drifted** — they share the same base structure but have diverged in link IDs, labels, parent assignments, and some links exist only in one database.

This **inverts the alignment problem**: the databases are now the comprehensive source (not the 7 SEED_LINKS), and the file-based fallbacks are the ones missing links. The primary concern shifts to **"reconcile staging vs production, clean up structure, then update fallbacks to match."**

---

## Staging vs Production Comparison

### Link Counts

| Database | Total Links | Built-in | Custom | Dynamic Templates |
|---|---|---|---|---|
| Staging | 137 | 4 | 133 | 2 |
| Production | 136 | 4 | 132 | 2 |

### Shared Links (same ID in both): ~125 links

The vast majority of links share the same ID and are identical in both databases. These include all `built-in-*` links and most `custom-*` links created before the databases diverged.

### Key Differences

#### 1. Different IDs for Same Logical Links (created independently)

| Staging ID | Staging Label | Production ID | Production Label | Notes |
|---|---|---|---|---|
| `custom-1779213549441` | Capability Management | `custom-1779362194902` | Capability Management | Same label, different ID, same parent |
| `custom-1779510947187` | Product Options | `custom-1779511241216` | Product Options | Same label, different ID, same parent |
| `custom-1779648283963` | Featured Options | `custom-1779646378093` | Featured Options | Same label, different ID, same parent |
| `custom-1780042359659` | Capability Control | `custom-1780338476006` | Capability Center | **Different label too**, same parent |
| `custom-1781233908557` | CRM Hub | `custom-1781237640281` | CRM Hub | Different parent (see below) |
| `custom-1781821981706` | Directory Appearance | `custom-1781821812396` | Directory Appearance | Same label, different ID, same parent |

#### 2. Same ID, Different Content

| ID | Staging | Production | Difference |
|---|---|---|---|
| `custom-1776299086423` | Label: "Orders", href: `/my-orders` | Label: "Customer Portal", href: `/account` | **Completely different link** |
| `custom-1777951998195` | Icon: `products`, targets: `{admin,all}`, parent: none (root) | Icon: `inventory`, targets: `{admin}`, parent: `built-in-admin` | Different icon, targets, and parent |

#### 3. Links Only in Staging (not in production)

| ID | Label | Sort | Notes |
|---|---|---|---|
| `custom-1779711517144` | Subscriptions Home | 131 | Under Subscriptions parent |
| `custom-1779745466404` | Integration Options | 132 | Under My Integrations |
| `custom-1780263588847` | Payment Settings | 134 | Under Platform group |
| `custom-1781233908557` | CRM Hub | 135 | Under `built-in-admin` (staging structure) |

#### 4. Links Only in Production (not in staging)

| ID | Label | Sort | Notes |
|---|---|---|---|
| `custom-1781237735609` | CRM Center | 133 | Under Control Panel — production has **two** CRM links |
| `custom-1780338476006` | Capability Center | 131 | Under Control Panel (staging has "Capability Control" under same parent) |

#### 5. CRM Structure Divergence

| Database | CRM Link(s) | Parent |
|---|---|---|
| Staging | CRM Hub (`custom-1781233908557`) | `built-in-admin` (Admin Panel) |
| Production | CRM Hub (`custom-1781237640281`) | `custom-1776195589149` (Platform Capacity) |
| Production | CRM Center (`custom-1781237735609`) | `custom-1776236817068` (Control Panel) |

Production has CRM split across two parents with two separate links. Staging has a single CRM link under Admin Panel.

#### 6. Platform Inventory Structure Divergence

| Database | Icon | Targets | Parent |
|---|---|---|---|
| Staging | `products` | `{admin,all}` | None (root-level) |
| Production | `inventory` | `{admin}` | `built-in-admin` (child of Admin Panel) |

### Structural Issues (Same in Both Databases)

These issues exist identically in both staging and production:

1. **Template variable format mismatch**: DB uses `${tenantId}`, parser expects `{tenantId}` — **all tenant template URLs are broken**
2. **Sort order collisions**: Same collisions in both (sort 69, 97, 98, 100, 110, 111)
3. **Stale metadata**: `hasChildren` always `false`, `childrenKeys` always `[]`, `nestingLevel` always `0`
4. **Duplicate labels**: Same duplicates in both (Appearance, Branding, Payment Settings, Featured Products, Onboarding)
5. **3-level nesting**: Same deep nesting in both
6. **Missing from both DBs**: Bot Platform (admin), FAQ (tenant), Account Settings (admin)

---

## Database State (Staging — 137 links)

### Link Count by Target

| Target | Root Links | Child Links | Total |
|---|---|---|---|
| `admin` | ~20 | ~50 | ~70 |
| `tenant` | ~15 | ~40 | ~55 |
| `all` | ~10 | ~15 | ~25 |
| **Total unique** | | | **137** |

*(Links can target multiple sidebars, so column totals overlap)*

### Built-in Links (4 in DB)

| ID | Label | Href | Targets | Sort |
|---|---|---|---|---|
| `built-in-home` | Platform Home | / | all, tenant, admin | 0 |
| `built-in-account` | My Account | /settings/account | all, tenant | 5 |
| `built-in-security` | Security & Privacy | /settings/security | all, tenant | 15 |
| `built-in-admin` | Admin Panel | /settings/admin | admin | 67 |

### Dynamic Template Links (2 in DB, custom IDs)

| ID | Label | Template | Targets | Sort |
|---|---|---|---|---|
| `custom-1776145918511` | My Locations | `tenant-locations` | tenant, admin, all | 7 |
| `custom-1776158068432` | My Organizations | `organization-locations` | tenant, admin | 8 |

---

## SEED_LINKS vs Database Comparison

### SEED_LINKS in `page.tsx` (9 entries)

| SEED ID | In DB? | Notes |
|---|---|---|
| `built-in-home` | ✅ Yes | Matches exactly |
| `built-in-tenant-dashboard` | ❌ **Missing** | Replaced by `custom-1776242834569` ("My Dashboard") |
| `built-in-tenant-inventory` | ❌ **Missing** | Replaced by `custom-1776272500698` ("My Inventory") |
| `built-in-tenant-inventory-manager` | ❌ **Missing** | Replaced by `custom-1776272632908` ("Inventory Center") |
| `built-in-tenant-inventory-create` | ❌ **Missing** | Replaced by `custom-1776272675558` ("Product Wizard") |
| `built-in-security` | ✅ Yes | Matches |
| `built-in-admin` | ✅ Yes | Matches |
| `dynamic-tenant-locations` | ❌ **Missing ID** | Template exists as `custom-1776145918511` |
| `dynamic-organization-locations` | ❌ **Missing ID** | Template exists as `custom-1776158068432` |

**Result**: Only 3 of 9 SEED_LINKS exist in the database. The admin replaced the tenant seed links with custom equivalents and the dynamic template links have custom IDs.

### Additional DB Links Not in SEED_LINKS

- `built-in-account` (My Account) — exists in DB but not in SEED_LINKS
- **133 custom-* links** — all admin-added via the Navigation Control Panel

---

## Structural Issues Found

### 1. Metadata Inconsistencies

**`hasChildren` always `false`**: Every single link has `"hasChildren": false` and `"childrenKeys": []` in metadata, even parent links that clearly have children (referenced by other links' `parentKey`). The `decodeNestedStructure` function must reconstruct the tree solely from `parentKey` — the `hasChildren`/`childrenKeys` fields are stale/unused.

**`nestingLevel` always `0`**: All child links have `"nestingLevel": 0` even though they have a `parentKey`. The nesting level is not being set correctly when links are created via the admin panel.

**Impact**: These fields are technically dead metadata. The system works because `decodeNestedStructure` in `page.tsx` reconstructs the tree from `parentKey` alone. But the metadata is misleading for any tooling that reads it.

### 2. Sort Order Collisions

Multiple links share the same `sort_order`, which could cause inconsistent rendering order:

| Sort Order | Links |
|---|---|
| 69 | `custom-1776297048858` (Limits Configuration), `custom-1776195918418` (Capacity Center) |
| 70 | `custom-1776288440862` (Directory Featured) |
| 97 | `custom-1776298840870` (Category Discovery), `custom-1776334713623` (Catalog) |
| 98 | `custom-1776299086423` (Orders), `custom-1776334770670` (Categories Quick Start) |
| 100 | `custom-1776334967107` (Directory), `custom-1776334272647` (Contact & Support) |
| 110 | `custom-1776728709882` (Platform Revenue), `custom-1776335667603` (Subdomain Mgmt), `custom-1776335396360` (Security) |
| 111 | `custom-1776416917164` (My Catalog), `custom-1776336009181` (Analytics), `custom-1776335577818` (Feature Overrides) |

### 3. Template Variable Format Mismatch

- **Database**: Uses `${tenantId}` format (e.g., `/t/${tenantId}/dashboard`)
- **SEED_LINKS in page.tsx**: Uses `{tenantId}` format (e.g., `/t/{tenantId}/dashboard`)
- **NavTemplateParser**: Need to verify which format it expects

This could cause template variables to not resolve if the parser expects `{tenantId}` but receives `${tenantId}`.

### 4. Orphaned Parent References

Some links reference `parentKey` values that are themselves children, creating deeply nested structures that may not render correctly if `decodeNestedStructure` only looks for root-level items:

- `custom-1776272982768` (Featured Products) → parentKey: `custom-1776416917164` (My Catalog) → which itself has parentKey: `custom-1776274025839` (My Storefront)
- `custom-1776274165052` (Branding) → parentKey: `custom-1777434333697` (Store Setup) → which itself has parentKey: `custom-1776274025839` (My Storefront)

This creates 3-level nesting. Need to verify `decodeNestedStructure` handles this.

### 5. Duplicate Links / Conflicting Entries

Several links have similar labels or hrefs but different IDs:

| Label | IDs | Issue |
|---|---|---|
| Appearance | `custom-1776116345419`, `custom-1776277108746` | Two different Appearance links (one under Preferences, one under My Settings) |
| Branding | `custom-1776274165052`, `custom-1776296199759` | Two different Branding links (one under Store Setup, one under Platform) |
| Payment Settings | `custom-1777953239409`, `custom-1780263588847` | Two different Payment Settings (one under Security & Platform, one under Platform) |
| Featured Products | `custom-1776272982768`, `custom-1776296949090`, `custom-1776335113409` | Three different Featured Products links |
| Inventory Transfers | `custom-1777729297512`, `custom-1777952195197` | One tenant, one admin |
| My Locations | `custom-1776145918511`, `custom-1776277535097` | One is dynamic template, one is a plain link |
| Security | `built-in-security`, `custom-1776120095619`, `custom-1776335396360` | Multiple Security links at different levels |
| Onboarding | `custom-1776277240097`, `custom-1776281861024`, `custom-1776284172107` | Three different Onboarding links |

### 6. Missing Href on Non-Group Links

Some links have empty href but are NOT clearly group-only items (no children reference them as parent):

- `custom-1776272500698` (My Inventory) — has empty href but has children. This is a group-only item. ✅ OK
- `custom-1776274025839` (My Storefront) — has empty href but has children. ✅ OK
- `custom-1776276917946` (My Settings) — has empty href but has children. ✅ OK
- `custom-1776277320507` (Platform) — has empty href but has children. ✅ OK

These are all legitimate group-only containers. No issue.

### 7. RBAC Gate Coverage

Many links have RBAC gates applied. Summary of gate usage:

| Gate Type | Count | Example |
|---|---|---|
| `requiredGroup: IS_PLATFORM_ADMIN` | ~30 | Admin panel links |
| `requiredGroup: IS_TENANT_USER` | ~25 | Tenant links |
| `requiredGroup: IS_TENANT_MANAGER` | ~15 | Settings, orders |
| `requiredGroup: IS_TENANT_ADMIN` | ~10 | Integrations, subscription |
| `requiredGroup: IS_PLATFORM_SUPPORT` | ~20 | Admin sub-links |
| `requiredPermission: CAN_*` | ~15 | Various admin actions |
| No gate (everyone) | ~40 | Platform Home, Contact, etc. |

---

## Database vs File-Based Fallback Comparison

### Admin Sidebar

| File-Based (buildAdminNavItems) | Database Equivalent | Match? |
|---|---|---|
| Admin Dashboard | `custom-1776194976236` (Admin Dashboard) | ✅ |
| Users | `custom-1776195164826` (Users) | ✅ |
| Tenants | `custom-1776195589149` (Platform Capacity) + `custom-1776236817068` (Control Panel) | ⚠️ Split differently |
| Capacity | `custom-1776195589149` (Platform Capacity) + `custom-1776195918418` (Capacity Center) | ⚠️ Restructured |
| Quick Start | `custom-1776196158480` (Quick Start Center) | ✅ |
| Subscriptions | `custom-1776198129531` (Subscriptions) | ✅ |
| Catalog | `custom-1776334713623` (Catalog) | ✅ |
| Inventory | `custom-1777951998195` (Platform Inventory) | ✅ |
| Directory | `custom-1776334967107` (Directory) | ✅ |
| Content | `custom-1776335203414` (Content) | ✅ |
| Security & Platform | `custom-1776335347363` (Security & Platform) | ✅ |
| Analytics | `custom-1776336009181` (Analytics) | ✅ |
| CRM | `custom-1781233908557` (CRM Hub) | ✅ |
| Bot Platform | **❌ Missing from DB** | Not in database |
| Navigation Control | `custom-1776119637659` (Navigation Control) | ✅ (child of built-in-admin) |
| Account Settings | **❌ Missing from DB** | Not in database |

**DB-only admin links not in fallback**: Control Panel (`custom-1776236817068`), Platform Revenue, Notification Emails, Capability Management, Capability Control, Subscriptions Home, Admin Settings, Directory Appearance, Payment Settings (x2)

### Universal Sidebar

| File-Based (buildNavItems) | Database Equivalent | Match? |
|---|---|---|
| Platform Home | `built-in-home` | ✅ |
| My Account | `built-in-account` | ✅ (DB-only, not in fallback as root) |
| Security & Privacy | `built-in-security` + children | ✅ |
| Preferences | `custom-1776114966134` (Preferences) | ✅ |
| Contact & Support | `custom-1776334272647` (Contact & Support) | ✅ |
| My Locations | `custom-1776145918511` (dynamic) | ✅ |
| Admin Panel | `built-in-admin` | ✅ |

**DB-only universal links**: Platform (`custom-1776277320507`) with children (Dashboard, My Profile, My Locations, Support, Directory, Shops, Onboarding, All Settings, Orders, Category Discovery, Branding, Payment Settings)

### Tenant Sidebar

| File-Based (buildTenantNav) | Database Equivalent | Match? |
|---|---|---|
| Dashboard | `custom-1776242834569` (My Dashboard) | ✅ |
| Inventory | `custom-1776272500698` (My Inventory) | ✅ |
| Orders | `custom-1776269092634` (My Orders) | ✅ |
| Directory & Storefront | `custom-1776274025839` (My Storefront) + `custom-1777368780403` (My Directory) | ⚠️ Split differently |
| FAQ | **❌ Missing from DB** | Not in database |
| Bot | **❌ Missing from DB** | Not in database |
| Integrations | `custom-1776274655551` (My Integrations) | ✅ |
| Settings | `custom-1776276917946` (My Settings) | ✅ |
| Platform | `custom-1776277320507` (Platform) | ✅ |

**DB-only tenant links**: My Storefront (with children: Store Profile, Store Reviews, Store Onboarding, My Catalog, My Directory, Store Setup, Quick Inventory), My Subscription (with Billing Dashboard), Commerce Settings, Digital Downloads, Inventory Transfers, Product Options, Featured Options, Barcode Scanner

---

## Key Findings

### What the DB has that fallbacks don't:
1. **Bot Platform** — in admin fallback but NOT in DB
2. **FAQ** — in tenant fallback but NOT in DB
3. **Account Settings** — in admin fallback but NOT in DB
4. **Platform** mega-group — DB has a large "Platform" group with 12+ children that doesn't exist in any fallback
5. **My Subscription** — DB has a tenant subscription section not in fallback
6. **My Storefront** — DB has a comprehensive storefront section not in fallback
7. **Quick Inventory** — DB has a quick inventory section not in fallback
8. **Platform Revenue, Capability Management, Notification Emails** — DB admin links not in fallback
9. **Commerce Settings, Product Options, Featured Options** — DB tenant links not in fallback
10. **Category Discovery, Shops, Directory** (as platform-level links) — DB universal links not in fallback

### What fallbacks have that DB doesn't:
1. **Bot Platform** (admin) — 6 children (Dashboard, Guardrails, Intents, Skills, Knowledge, Tenants)
2. **FAQ** (tenant) — 2 children (FAQ Hub, FAQ Options)
3. **Account Settings** (admin) — simple link to /settings

### Template Variable Format:
- DB uses `${tenantId}` — need to verify `NavTemplateParser` handles this format
- SEED_LINKS use `{tenantId}` — may be the expected format

---

## Recommendations for Phase 2

1. **Reconcile staging and production first** — decide which database is the source of truth, then:
   - Identify the ~6 links with different IDs for the same logical item and pick one canonical ID
   - Resolve the 2 same-ID-different-content conflicts (`custom-1776299086423` and `custom-1777951998195`)
   - Decide which staging-only and production-only links to keep or discard
   - Apply the reconciled structure to both databases

2. **Fix the template variable format** (critical, affects both DBs):
   - Either update both DBs to use `{tenantId}` or update `NavTemplateParser` to also handle `${tenantId}`
   - This affects ~30+ tenant links that currently show literal `${tenantId}` in URLs

3. **Fix metadata inconsistencies** (both DBs):
   - Update `hasChildren` and `childrenKeys` for all parent links
   - Set correct `nestingLevel` values (0 for roots, 1 for children, 2 for grandchildren)
   - This could be done with a single UPDATE query per database

4. **Fix sort order collisions** (both DBs):
   - Reassign sort_order with proper increments of 10 for roots, 1 for children

5. **Resolve duplicate links** (both DBs):
   - Decide which "Appearance", "Branding", "Payment Settings", "Featured Products", "Onboarding" to keep
   - Remove or merge duplicates

6. **Add missing links** (both DBs):
   - Bot Platform (admin) with 6 children
   - FAQ (tenant) with 2 children
   - Account Settings (admin) — simple link

7. **Any migration script must be designed to run against both databases** — parameterized for connection string, not hardcoded to one project
