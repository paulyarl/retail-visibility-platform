# Navigation Alignment Plan — File-Based ↔ Database

> Created: June 2026
> Status: **DRAFT — Pending approval before execution**
> Skill doc: `.devin/skills/database-navigation-system.md`

---

## Executive Summary

The platform has two navigation systems that are severely out of sync. The **database** (active) contains only **7 seed links**, while the **file-based fallbacks** contain **50+ links** across three sidebars. Because each sidebar uses an **all-or-nothing** switch (`if injectedItems.length > 0 → use database, else → use fallback`), even a single database link hides the entire fallback. This means most navigation items are currently invisible to users.

This plan aligns both systems in 5 phases, preserving fragile dynamic templates while ensuring the database becomes the comprehensive source of truth.

---

## Current State Analysis

### The All-or-Nothing Switch

Each sidebar component uses this pattern:

```typescript
// AdminNavContent.tsx:821, UniversalNavContent.tsx:735, DynamicTenantSidebar.tsx:723
if (injectedItems.length > 0) {
  processedItems = await processDynamicTemplates(injectedItems, user);
} else {
  processedItems = buildAdminNavItems(); // or buildNavItems(), or buildTenantNav()
}
```

**Consequence**: If the database returns even ONE link for a given target, the entire file-based fallback is bypassed.

### Database SEED_LINKS (7 links total)

| ID | Label | Targets | Notes |
|---|---|---|---|
| `built-in-home` | Platform Home | all, tenant, admin | Root link |
| `built-in-tenant-dashboard` | Tenant Dashboard | tenant | |
| `built-in-tenant-inventory` | Tenant Inventory | tenant | Has 2 children |
| `built-in-tenant-inventory-manager` | Product Manager | tenant | Child of inventory |
| `built-in-tenant-inventory-create` | Add Product | tenant | Child of inventory |
| `built-in-security` | Security & Privacy | all, tenant | |
| `built-in-admin` | Admin Panel | admin | |
| `dynamic-tenant-locations` | My Locations | all, tenant | **Dynamic template** |
| `dynamic-organization-locations` | Organization | all, tenant | **Dynamic template** |

### File-Based Fallback Inventory

#### Admin Sidebar (`buildAdminNavItems()` — 16 root items, 40+ children)

| # | Label | Href | Children |
|---|---|---|---|
| 1 | Admin Dashboard | /settings/admin | — |
| 2 | Users | /settings/admin/users | All Users, Deletion Requests |
| 3 | Tenants | /settings/admin/tenants | All Tenants, Tenant Limits |
| 4 | Capacity | /settings/admin/capacity/overview | Overview, Location Limits, Alerts |
| 5 | Quick Start | (no href) | Seed Categories, Seed Products |
| 6 | Subscriptions | /settings/admin/tier-system | Tier Mgmt, Subscription Mgmt, Billing Mgmt, BSaaS Catalog, BSaaS Analytics, BSaaS Promotions, Email Logs |
| 7 | Catalog | /settings/admin/categories | Categories Quick Start, Product Categories, Platform Categories, Enrichment |
| 8 | Inventory | /settings/admin/inventory-dashboard | Dashboard, Transfers, Universal Catalog, Slug Registry |
| 9 | Directory | /settings/admin/directory/listings | Listings, Featured, Featured Products, Appearance |
| 10 | Content | /settings/admin/reviews | Reviews, Analytics |
| 11 | Security & Platform | /settings/admin/security | Security, Platform Settings, Sentry, Feature Overrides, Subdomain Mgmt, Ticker |
| 12 | Analytics | /settings/admin/scan-metrics | Scan Metrics |
| 13 | CRM | /settings/admin/crm | Dashboard, Requests Hub, Tenants, Tickets, Tasks |
| 14 | Bot Platform | /settings/admin/bot | Dashboard, Guardrails, Intents, Skills, Knowledge, Tenants |
| 15 | Navigation Control | /settings/admin/navigation | — (badge: Admin) |
| 16 | Account Settings | /settings | — |

#### Universal Sidebar (`buildNavItems()` — 7 root items, 8 children)

| # | Label | Href | Children | RBAC |
|---|---|---|---|---|
| 1 | Platform Home | / | — | |
| 2 | My Account | (no href) | Profile, Subscription, Feature Store | |
| 3 | Security & Privacy | (no href) | Security, Multi-Factor Auth, Privacy | |
| 4 | Preferences | (no href) | Appearance, Language | |
| 5 | Contact & Support | /settings/contact | — | |
| 6 | My Locations | (dynamic) | tenant list | IS_TENANT_USER |
| 7 | Admin Panel | /settings/admin | — | IS_PLATFORM_ADMIN |

#### Tenant Sidebar (`buildTenantNav()` — 9 root items, 40+ children)

| # | Label | Href | Children | RBAC |
|---|---|---|---|---|
| 1 | Dashboard | /t/{id}/dashboard | — | |
| 2 | Inventory | /t/{id}/items | Product Manager, Add Product, Product Catalog, Barcode Scan, Quick Start, Categories, Featured Products | |
| 3 | Orders | /t/{id}/orders | Order Management, Payment Gateways, Fulfillment Options | IS_TENANT_MANAGER |
| 4 | Directory & Storefront | /t/{id}/settings/directory | View in Directory (conditional), Directory Settings, Branding, Store Hours, Business Category, Location Status, Review Management, My Storefront (conditional) | |
| 5 | FAQ | /t/{id}/faq | FAQ Hub, FAQ Options | |
| 6 | Bot | /t/{id}/bot | Dashboard, Configuration, Skills, Analytics, Widget Setup, Chatbot Options | |
| 7 | Integrations | /t/{id}/settings/integrations | Integration Options, Google Merchant Center, Feed Validation, Clover POS, Square POS | IS_TENANT_ADMIN |
| 8 | Settings | /t/{id}/settings | Store Profile, Team Members, Appearance, Language & Region, Subscription, Digital Downloads, Onboarding, Organization Dashboard, Propagation Settings, Propagation Center | IS_TENANT_MANAGER |
| 9 | Platform | / | Platform Home, My Account, My Locations, Subscription, Support | |

### Discrepancy Summary

| Sidebar | DB Links | File-Based Links | Missing from DB |
|---|---|---|---|
| **Admin** | 1 (Admin Panel) | 16 roots, 40+ children | **15 root groups, 40+ children** |
| **Universal** | 4 (Home, Security, 2 dynamic) | 7 roots, 8 children | **3 root groups, 8 children** (My Account, Preferences, Contact & Support) |
| **Tenant** | 5 (Dashboard, Inventory+2 children, Security, 2 dynamic) | 9 roots, 40+ children | **7 root groups, 35+ children** (Orders, Directory, FAQ, Bot, Integrations, Settings, Platform) |

### Fragile Dynamic Templates (Preserve Carefully)

Two database links use dynamic templates that generate children at runtime:

1. **`tenant-locations`** — Expands to show each user's tenant as a nested group with Dashboard, Profile, Inventory, Orders, Google, Settings children. Controlled by `metadata.dynamicTemplate: 'tenant-locations'`. Processed by `DynamicNavTemplates.processTenantLocationsTemplate()`.

2. **`organization-locations`** — Expands to show organization-grouped tenants with Dashboard, Organization Dashboard, Propagation Settings, Propagation Center children. Controlled by `metadata.dynamicTemplate: 'organization-locations'`. Processed by `DynamicNavTemplates.processOrganizationLocationsTemplate()`.

**These must not be altered or deleted during alignment.** Their `metadata.dynamicTemplate` field is the trigger for client-side expansion. The hardcoded children in `DynamicNavTemplates.tsx` are NOT in the database — they're generated in memory.

---

## Phased Alignment Plan

### Phase 1: Database Extraction & Audit (Read-Only)

**Goal**: Extract the actual current state of the `navigation_links` table and produce a diff report.

**Steps**:

1. Run a SQL query to extract all current database links:
   ```sql
   SELECT id, label, href, icon, badge, badge_variant, targets, sort_order,
          is_enabled, is_divider_before, required_permission, required_group,
          required_role, metadata
   FROM navigation_links
   ORDER BY sort_order ASC;
   ```

2. Compare the database output against the SEED_LINKS in `page.tsx` (lines 489-690):
   - Are there any links in the database that are NOT in SEED_LINKS? (i.e., an admin has added custom links)
   - Are there any SEED_LINKS not in the database? (i.e., seeds were never inserted)
   - Have any links been disabled, reordered, or modified?

3. Produce a diff report documenting:
   - Database-only links (custom additions by admin)
   - SEED-only links (never inserted into DB)
   - Modified links (order, RBAC, enabled state differs)

**Deliverable**: `docs/navigation-audit-report.md` with the full diff

**Risk**: None (read-only)

---

### Phase 2: Database Structure Redesign

**Goal**: Design a comprehensive database navigation structure that encompasses all links from both sources, organized sensibly.

**Design Principles**:

1. **Preserve built-in IDs** — Existing `built-in-*` links keep their IDs (they can't be deleted from admin panel)
2. **Use consistent ID naming** — New links use descriptive IDs like `admin-users`, `tenant-orders`, `universal-account`
3. **Sensible sort_order spacing** — Use increments of 10 (10, 20, 30...) for root items, then 11, 12, 13 for children
4. **Preserve dynamic templates** — Keep `dynamic-tenant-locations` and `dynamic-organization-locations` exactly as-is
5. **Apply RBAC gates** — Port all `requiredGroup`, `requiredPermission`, `requiredRole` from file-based links
6. **Use template variables** — Tenant links use `{tenantId}` in href (e.g., `/t/{tenantId}/orders`)
7. **Icon coverage** — Map all file-based icons to database icon names. May need to add new icon names to `IconComponents` and `ICON_OPTIONS` in the admin page

**Icon Gap Analysis**:

The admin page's `IconComponents` map (page.tsx:365-394) has these icons:
`home, user, shield, lock, building, palette, globe, credit-card, chat, admin, bell, crown, shield-role, star, briefcase, users, eye, dashboard, products, categories, quickstart, alerts, capacity, chart, cog, inventory`

The file-based sidebars use additional icons that may not have database equivalents:
- `Icon.Navigation` (used for Navigation Control, Content) → **Need to add `navigation` icon**
- `Icon.Cube` (used for admin Inventory) → **Need to add `cube` icon** or map to `inventory`
- `Icon.Headset` (used for CRM) → **Need to add `headset` icon**
- `Icon.Store` (used for Store) → **Need to add `store` icon**
- `Icon.Google` (used for Google integrations) → **Need to add `google` icon**
- `Icon.FAQ` (used for FAQ) → **Need to add `faq` icon**
- `Icon.Bot` (used for Bot) → **Need to add `bot` icon**
- `Icon.Orders` (used for Orders) → **Need to add `orders` icon or map to existing**
- `Icon.Directory` (used for Directory) → **Need to add `directory` icon or map to `globe`**
- `Icon.Integrations` (used for Integrations) → **Need to add `integrations` icon**

**Proposed Database Structure**:

#### Admin Sidebar (target: `admin`)

| sort_order | ID | Label | Href | Icon | RBAC | Children |
|---|---|---|---|---|---|---|
| 10 | `built-in-admin` | Admin Panel | /settings/admin | admin | CAN_ADMIN_PLATFORM, IS_PLATFORM_ADMIN | — |
| 20 | `admin-dashboard` | Dashboard | /settings/admin | dashboard | | — |
| 30 | `admin-users` | Users | /settings/admin/users | users | | All Users, Deletion Requests |
| 40 | `admin-tenants` | Tenants | /settings/admin/tenants | building | | All Tenants, Tenant Limits |
| 50 | `admin-capacity` | Capacity | /settings/admin/capacity/overview | capacity | | Overview, Location Limits, Alerts |
| 60 | `admin-quickstart` | Quick Start | (none) | quickstart | | Seed Categories, Seed Products |
| 70 | `admin-subscriptions` | Subscriptions | /settings/admin/tier-system | credit-card | | Tier Mgmt, Subscription Mgmt, Billing Mgmt, BSaaS Catalog, BSaaS Analytics, BSaaS Promotions, Email Logs |
| 80 | `admin-catalog` | Catalog | /settings/admin/categories | categories | | Categories Quick Start, Product Categories, Platform Categories, Enrichment |
| 90 | `admin-inventory` | Inventory | /settings/admin/inventory-dashboard | inventory | | Dashboard, Transfers, Universal Catalog, Slug Registry |
| 100 | `admin-directory` | Directory | /settings/admin/directory/listings | globe | | Listings, Featured, Featured Products, Appearance |
| 110 | `admin-content` | Content | /settings/admin/reviews | chart | | Reviews, Analytics |
| 120 | `admin-security` | Security & Platform | /settings/admin/security | shield | | Security, Platform Settings, Sentry, Feature Overrides, Subdomain Mgmt, Ticker |
| 130 | `admin-analytics` | Analytics | /settings/admin/scan-metrics | chart | | Scan Metrics |
| 140 | `admin-crm` | CRM | /settings/admin/crm | headset | CAN_VIEW_CRM | Dashboard, Requests Hub, Tenants, Tickets, Tasks |
| 150 | `admin-bot` | Bot Platform | /settings/admin/bot | bot | | Dashboard, Guardrails, Intents, Skills, Knowledge, Tenants |
| 160 | `admin-nav-control` | Navigation Control | /settings/admin/navigation | navigation | | — (badge: Admin) |
| 170 | `admin-account` | Account Settings | /settings | admin | | — (dividerBefore: true) |

#### Universal Sidebar (target: `all`)

| sort_order | ID | Label | Href | Icon | RBAC | Children |
|---|---|---|---|---|---|---|
| 0 | `built-in-home` | Platform Home | / | home | | — |
| 10 | `universal-account` | My Account | (none) | user | | Profile, Subscription, Feature Store |
| 20 | `built-in-security` | Security & Privacy | /settings/security | shield | | Security, Multi-Factor Auth, Privacy |
| 30 | `universal-preferences` | Preferences | (none) | palette | | Appearance, Language |
| 40 | `universal-contact` | Contact & Support | /settings/contact | chat | | — |
| 50 | `universal-admin-panel` | Admin Panel | /settings/admin | admin | IS_PLATFORM_ADMIN | — (badge: Admin, dividerBefore: true) |
| 60 | `dynamic-tenant-locations` | My Locations | # | building | IS_TENANT_USER | **DYNAMIC** (dividerBefore: true) |
| 70 | `dynamic-organization-locations` | Organization | # | building | IS_TENANT_USER | **DYNAMIC** |

#### Tenant Sidebar (target: `tenant`)

| sort_order | ID | Label | Href | Icon | RBAC | Children |
|---|---|---|---|---|---|---|
| 10 | `built-in-tenant-dashboard` | Dashboard | /t/{tenantId}/dashboard | dashboard | | — (dividerBefore: true) |
| 20 | `built-in-tenant-inventory` | Inventory | /t/{tenantId}/items | inventory | | Product Manager, Add Product, Product Catalog, Barcode Scan, Quick Start, Categories, Featured Products |
| 30 | `tenant-orders` | Orders | /t/{tenantId}/orders | orders | IS_TENANT_MANAGER | Order Management, Payment Gateways, Fulfillment Options |
| 40 | `tenant-directory` | Directory & Storefront | /t/{tenantId}/settings/directory | directory | | Directory Settings, Branding, Store Hours, Business Category, Location Status, Review Management |
| 50 | `tenant-faq` | FAQ | /t/{tenantId}/faq | faq | | FAQ Hub, FAQ Options |
| 60 | `tenant-bot` | Bot | /t/{tenantId}/bot | bot | | Dashboard, Configuration, Skills, Analytics, Widget Setup, Chatbot Options |
| 70 | `tenant-integrations` | Integrations | /t/{tenantId}/settings/integrations | integrations | IS_TENANT_ADMIN | Integration Options, Google Merchant Center, Feed Validation, Clover POS, Square POS |
| 80 | `tenant-settings` | Settings | /t/{tenantId}/settings | cog | IS_TENANT_MANAGER | Store Profile, Team Members, Appearance, Language & Region, Subscription, Digital Downloads, Onboarding, Organization Dashboard, Propagation Settings, Propagation Center |
| 90 | `tenant-platform` | Platform | / | dashboard | | Platform Home, My Account, My Locations, Subscription, Support (dividerBefore: true) |
| 100 | `built-in-security` | Security & Privacy | /settings/security | shield | | — (also target: all) |
| 110 | `dynamic-tenant-locations` | My Locations | # | building | IS_TENANT_USER | **DYNAMIC** |
| 120 | `dynamic-organization-locations` | Organization | # | building | IS_TENANT_USER | **DYNAMIC** |

**Note**: Some links appear in multiple targets (e.g., `built-in-security` targets both `all` and `tenant`; `built-in-home` targets `all`, `tenant`, and `admin`). The `targets` array handles this.

**Deliverable**: This design document approved by user

---

### Phase 3: Add Missing Icons to Admin Panel

**Goal**: Ensure all icons referenced in the database structure have corresponding components in the admin navigation page.

**Files to modify**:

1. **`apps/web/src/app/(platform)/settings/admin/navigation/page.tsx`**:
   - Add icon components for: `navigation`, `headset`, `bot`, `orders`, `directory`, `integrations`, `faq`, `store`, `cube`
   - Add them to `IconComponents` map (line ~365)
   - Add them to `ICON_OPTIONS` array (line ~402)

2. **`apps/web/src/hooks/useNavLinks.tsx`**:
   - Check `getIconComponent` function — ensure it can resolve all new icon names
   - This may use a different icon map than the admin page

3. **`apps/web/src/components/navigation/AdminNavContent.tsx`** and **`UniversalNavContent.tsx`** and **`DynamicTenantSidebar.tsx`**:
   - These components have their own `Icon` objects with SVG components
   - The `getIconComponent` function in each (if present) needs to map database icon strings to the correct SVG
   - Verify that `typeof item.icon === 'string' ? getIconComponent(item.icon) : item.icon` handles all new icons

**Risk**: Low. Adding icons is additive. Existing icons remain unaffected.

---

### Phase 4: Sync Database — Insert Missing Links

**Goal**: Insert all missing links into the `navigation_links` table, bringing the database to the full designed structure from Phase 2.

**Approach**: Generate a SQL migration script that:

1. **Preserves** all existing `built-in-*` links (update their sort_order/children if needed)
2. **Preserves** dynamic template links exactly as-is
3. **Inserts** all new links with proper nesting metadata
4. **Updates** parent links' `metadata.childrenKeys` to reference their children

**Execution method**: A SQL script run against the database, OR a one-time API call using the POST bulk-replace endpoint (fetching all existing + adding new).

**Prefered method**: SQL script for precision and auditability. The POST endpoint does bulk-replace which risks deleting custom admin-added links discovered in Phase 1.

**SQL script structure**:

```sql
-- Phase 4: Navigation Alignment Sync
-- Preserves built-in-* and dynamic-* links
-- Inserts missing links from file-based fallbacks

BEGIN;

-- === ADMIN SIDEBAR LINKS (target: admin) ===

-- Admin Dashboard
INSERT INTO navigation_links (id, label, href, icon, targets, sort_order, is_enabled, metadata, created_by)
VALUES ('admin-dashboard', 'Dashboard', '/settings/admin', 'dashboard', ARRAY['admin'], 20, true,
  '{"nestingLevel": 0, "parentKey": null, "hasChildren": false, "childrenKeys": []}'::json, 'alignment-sync')
ON CONFLICT (id) DO UPDATE SET sort_order = 20, updated_at = now();

-- ... (all other admin links with children)

-- === UNIVERSAL SIDEBAR LINKS (target: all) ===

-- ... (universal links)

-- === TENANT SIDEBAR LINKS (target: tenant) ===

-- ... (tenant links with {tenantId} template vars)

-- Update parent metadata for all links with children
UPDATE navigation_links SET metadata = jsonb_set(metadata::jsonb, '{hasChildren}', 'true'::jsonb)::json WHERE id = 'admin-users';
-- ... etc.

COMMIT;
```

**Important considerations**:

- Links with `href: '#` or empty href are "group-only" items (expandable parents with no page of their own)
- Children must have `metadata.parentKey` set to parent's `id`
- Children must have `metadata.nestingLevel` set to 1 (or 2 for grandchildren)
- Parent's `metadata.childrenKeys` must list all child IDs
- The `targets` array on children should match their parent's targets

**Risk**: Medium. Direct DB modification. Mitigations:
- Run in a transaction (BEGIN/COMMIT)
- Test on staging first
- Backup the table before: `CREATE TABLE navigation_links_backup AS SELECT * FROM navigation_links;`
- The script uses `ON CONFLICT (id) DO UPDATE` so it's idempotent

---

### Phase 5: Harmonize File-Based Fallbacks

**Goal**: Update the file-based fallback functions to match the database structure, so that if the database is unavailable, the fallback provides the same navigation experience.

**Two approaches**:

#### Option A: Keep fallbacks as-is (Recommended)

The fallbacks already have comprehensive link sets. After Phase 4 syncs them to the database, the fallbacks and database will be aligned in content (though not in structure — fallbacks use hardcoded arrays while database uses flat rows with nesting metadata).

**Pros**: No code changes, no risk of breaking fallback behavior
**Cons**: Future drift possible if someone adds to one but not the other

#### Option B: Generate fallbacks from database structure

Replace `buildAdminNavItems()`, `buildNavItems()`, and `buildTenantNav()` with functions that return a hardcoded snapshot matching the database structure exactly.

**Pros**: Perfect alignment, easier to maintain
**Cons**: Code changes, risk of introducing bugs in fallback path

#### Option C: Remove fallbacks entirely

If the database is reliable enough, remove the fallback path and show an error/loading state if the database is unreachable.

**Pros**: Eliminates drift entirely, simplifies code
**Cons**: No resilience if API is down

**Recommendation**: **Option A** for now. The fallbacks serve as disaster recovery. After Phase 4, both systems will have the same links. Add a comment in each fallback function: `// NOTE: This fallback should mirror the database navigation_links table. See .devin/skills/database-navigation-system.md`

---

### Phase 6: Verification & Testing

**Goal**: Verify all three sidebars render correctly with database links and match the previous file-based experience.

**Test checklist**:

- [ ] **Admin sidebar** — Navigate to `/settings/admin` and verify all 16 root items appear with correct children
- [ ] **Admin sidebar RBAC** — Verify CRM link only shows for users with `CAN_VIEW_CRM`
- [ ] **Universal sidebar** — Navigate to `/settings` and verify all 7 root items appear
- [ ] **Universal sidebar RBAC** — Verify Admin Panel link only shows for platform admins
- [ ] **Universal sidebar dynamic** — Verify My Locations expands to show user's tenants
- [ ] **Tenant sidebar** — Navigate to `/t/{tenantId}/dashboard` and verify all 9 root items appear
- [ ] **Tenant sidebar RBAC** — Verify Orders/Settings hidden for non-managers, Integrations hidden for non-admins
- [ ] **Tenant sidebar templates** — Verify `{tenantId}` resolves correctly in all hrefs
- [ ] **Tenant sidebar dynamic** — Verify My Locations and Organization expand correctly
- [ ] **Admin nav panel** — Verify all links appear in the admin navigation control panel at `/settings/admin/navigation`
- [ ] **Admin nav panel edit** — Verify links can be toggled, reordered, edited
- [ ] **Cache invalidation** — After publishing from admin panel, verify changes appear without hard refresh
- [ ] **Fallback test** — Temporarily break API connection and verify fallback nav still renders

**Automated verification**:

```sql
-- Verify link counts match expected
SELECT targets[1] as sidebar, count(*) as link_count
FROM navigation_links
WHERE is_enabled = true
GROUP BY targets[1]
ORDER BY sidebar;
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Dynamic templates broken | **High** | Don't modify `dynamic-*` links. Test expansion after sync. |
| Missing icons render as blank | Medium | Phase 3 adds all icons before Phase 4 inserts links |
| RBAC gates hide links unexpectedly | Medium | Port exact RBAC values from file-based. Test with different roles. |
| Template variables not resolving | Medium | Use `{tenantId}` format consistently. Test `NavTemplateParser` |
| Database transaction fails mid-insert | Low | Use BEGIN/COMMIT. Backup table first. |
| Fallback drift after sync | Low | Option A keeps fallbacks. Add comments. |

---

## Execution Order

```
Phase 1 (Audit) → Phase 2 (Design Approval) → Phase 3 (Icons) → Phase 4 (DB Sync) → Phase 5 (Fallbacks) → Phase 6 (Verification)
```

**Phase 2 requires user approval** before proceeding to Phase 3+.

**Phase 4 should be tested on staging** before production.

---

## Files Involved

| File | Phase | Changes |
|---|---|---|
| `docs/navigation-audit-report.md` | 1 | New — audit report |
| `apps/web/src/app/(platform)/settings/admin/navigation/page.tsx` | 3 | Add icon components + icon options |
| `apps/web/src/hooks/useNavLinks.tsx` | 3 | Verify icon resolution covers new icons |
| `apps/web/src/components/navigation/AdminNavContent.tsx` | 3, 5 | Verify icon resolution; optionally update fallback comment |
| `apps/web/src/components/navigation/UniversalNavContent.tsx` | 3, 5 | Verify icon resolution; optionally update fallback comment |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | 3, 5 | Verify icon resolution; optionally update fallback comment |
| `database/migrations/0NN_navigation_alignment_sync.sql` | 4 | New — SQL migration script |
| `apps/web/src/services/DynamicNavTemplates.tsx` | — | **No changes** — dynamic templates preserved |
| `apps/web/src/services/NavigationLinksService.ts` | — | **No changes** |
| `apps/web/src/components/navigation/SettingsLayoutRouter.tsx` | — | **No changes** |
| `apps/api/src/routes/admin/navigation-links.ts` | — | **No changes** |
