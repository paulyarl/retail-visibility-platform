# Database-Driven Navigation System

> **CRITICAL READ FOR ALL AGENTS**: Before adding sidebar links, read this document in full.
> The active navigation system is **database-driven**, not file-based. Adding links to file-based nav arrays will NOT appear in the UI unless they are also synced to the database.

---

## The Two Navigation Systems

There are **two** navigation architectures in this codebase. Only one is active.

### 1. Database-Driven Navigation (ACTIVE)

This is the **live system**. Sidebar links are stored in the `navigation_links` PostgreSQL table and managed via the Admin Navigation Control Panel at `/settings/admin/navigation`.

**Data flow:**

```
navigation_links (DB table)
  → GET /api/admin/navigation-links (backend API)
    → /api/admin/navigation-links/route.ts (Next.js proxy)
      → NavigationLinksService.getLinks() (frontend singleton service)
        → useNavLinks() hook (fetches, caches, decodes nested structure)
          → SettingsLayoutRouter (passes adminLinks/allLinks to sidebars)
            → AdminNavContent / UniversalNavContent (renders injectedItems)
          → DynamicTenantSidebar (uses tenantLinks directly)
```

**Key files:**

| File | Role |
|---|---|
| `apps/api/prisma/schema.prisma` (model `navigation_links`) | Database table definition |
| `apps/api/src/routes/admin/navigation-links.ts` | Backend CRUD API (GET, POST bulk-replace, PUT, DELETE) |
| `apps/web/src/app/api/admin/navigation-links/route.ts` | Next.js API proxy (auth-gated) |
| `apps/web/src/services/NavigationLinksService.ts` | Frontend singleton service with caching + template parser |
| `apps/web/src/hooks/useNavLinks.tsx` | React hook: fetches links, decodes flat→nested, filters by target |
| `apps/web/src/components/navigation/SettingsLayoutRouter.tsx` | Routes adminLinks/allLinks to the correct sidebar |
| `apps/web/src/app/(platform)/settings/admin/navigation/page.tsx` | Admin UI for managing links (CRUD, reorder, toggle, RBAC gates) |
| `apps/web/src/services/DynamicNavTemplates.tsx` | Processes dynamic templates (tenant-locations, organization-locations) |
| `apps/web/src/components/navigation/UniversalNavContent.tsx` | Settings sidebar — receives `injectedItems` (links with target `all`) |
| `apps/web/src/components/navigation/AdminNavContent.tsx` | Admin sidebar — receives `injectedItems` (links with target `admin`) |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` | Tenant sidebar — uses `tenantLinks` from `useNavLinks()` directly |

### 2. File-Based Navigation (LEGACY / FALLBACK)

These are **hardcoded nav arrays** in component files. They serve as **fallbacks only** — used when the database returns no links (e.g., API unavailable, first run before seeding).

**Do NOT add new links here expecting them to appear in the UI.** They will be invisible because the database links override them.

| File | Status |
|---|---|
| `apps/web/src/components/navigation/SidebarTemplates.tsx` | **DEPRECATED** — `TenantSidebarTemplate`, `AdminSidebarTemplate`, `PlatformSidebarTemplate`. Not used by any layout. |
| `apps/web/src/components/navigation/DynamicTenantSidebar.tsx` (`buildTenantNav` function) | **FALLBACK** — hardcoded tenant nav items. Only used if `processedTenantLinks` from database is empty. See line ~720: `if (processedTenantLinks.length > 0) { ... } else { /* fallback not shown */ }` |
| `apps/web/src/components/navigation/AdminNavContent.tsx` (`buildAdminNavItems` function) | **FALLBACK** — hardcoded admin nav. Only used if `injectedItems` prop is empty. |
| `apps/web/src/components/navigation/UniversalNavContent.tsx` (`buildNavItems` function) | **FALLBACK** — hardcoded settings nav. Only used if `injectedItems` prop is empty. |
| `apps/web/src/components/app-shell/hooks/useAppNavigation.ts` | **UNRELATED** — computes top-level redirect URLs (dashboard, directory, settings). Not a sidebar link system. |

---

## How the Database Navigation Works

### Database Schema (`navigation_links` table)

```
id                  String   (PK, UUID or custom like 'built-in-*')
label               String
href                String   (supports template variables like {tenantId})
icon                String   (icon name key: 'home', 'dashboard', 'inventory', etc.)
badge               String   (badge text, e.g. "NEW", "Admin")
badge_variant       String   ('default' | 'success' | 'warning' | 'error' | 'new')
targets             String[] ('all', 'tenant', 'admin' — can have multiple)
sort_order          Int      (ordering)
is_enabled          Boolean  (disabled links are hidden)
is_divider_before   Boolean  (renders a divider line above the link)
required_permission String   (RBAC gate, e.g. 'CAN_ADMIN_PLATFORM')
required_group      String   (RBAC gate, e.g. 'IS_TENANT_USER')
required_role       String   (RBAC gate, e.g. 'PLATFORM_ADMIN')
metadata            Json     (nestingLevel, parentKey, hasChildren, childrenKeys, dynamicTemplate)
```

### Sidebar Target Routing

| Target | Sidebar Component | Who sees it |
|---|---|---|
| `all` | `UniversalNavContent` | Every authenticated user in `/settings/*` |
| `tenant` | `DynamicTenantSidebar` | Store owners/members in `/t/[tenantId]/*` |
| `admin` | `AdminNavContent` | Platform admins in `/settings/admin/*` |

A single link can target multiple sidebars (e.g., `targets: ['all', 'tenant']`).

### Nested Links (Parent-Child)

The database stores links **flat**. Nesting is encoded in the `metadata` JSON field:

```json
{
  "nestingLevel": 0,        // 0 = root, 1 = child, 2 = grandchild
  "parentKey": null,        // null = root, or the ID of the parent link
  "hasChildren": true,      // whether this link has children
  "childrenKeys": ["child-id-1", "child-id-2"]
}
```

The `useNavLinks` hook decodes flat → nested at fetch time using `decodeNestedStructure()`.

### Template Variables

URLs support `{tenantId}`, `{slug}`, `{organizationId}`, `{userId}` placeholders. The `NavTemplateParser` class resolves these at runtime using context from the URL path and localStorage.

Example: `href: '/t/{tenantId}/dashboard'` → resolved to `/t/abc123/dashboard`

### Dynamic Templates

Two special template types auto-generate children:

| Template | Behavior |
|---|---|
| `tenant-locations` | Generates children for each tenant the user belongs to (Dashboard, Profile, Inventory, Orders, Google, Settings) |
| `organization-locations` | Generates organization-grouped tenant links for users in organizations |

Set via `metadata.dynamicTemplate` field. Processed by `DynamicNavTemplates.processDynamicTemplates()`.

### Built-in Links

Links with IDs prefixed `built-in-` (e.g., `built-in-home`, `built-in-admin`) cannot be deleted from the admin panel. They can be toggled/enabled/disabled but not removed. The backend POST endpoint preserves them during bulk-replace operations.

### Caching

- `NavigationLinksService` caches links for 5 minutes (TTL: `5 * 60 * 1000`)
- `useNavLinks` hook has an in-memory cache (one fetch per browser session)
- `invalidateNavLinksCache()` clears both caches — called after admin panel saves

---

## How to Add a New Sidebar Link

### Option A: Via the Admin UI (Recommended for manual/one-off changes)

1. Navigate to `http://localhost:3000/settings/admin/navigation`
2. Click "Add Link"
3. Fill in: label, href, icon, badge, sidebar targets, RBAC gates
4. Click "Publish Changes"

### Option B: Via Database Query (For programmatic/agent-driven changes)

**Insert a single link:**

```sql
INSERT INTO navigation_links (
  id, label, href, icon, badge, badge_variant,
  targets, sort_order, is_enabled, is_divider_before,
  required_permission, required_group, required_role,
  metadata, created_by
) VALUES (
  'custom-my-feature',                    -- unique ID (don't use 'built-in-' prefix)
  'My Feature',                           -- label
  '/t/{tenantId}/my-feature',             -- href (supports template vars)
  'cog',                                  -- icon name
  'NEW',                                  -- badge text (empty string for none)
  'new',                                  -- badge_variant
  ARRAY['tenant'],                        -- targets: 'all', 'tenant', 'admin'
  100,                                    -- sort_order (controls position)
  true,                                   -- is_enabled
  false,                                  -- is_divider_before
  '',                                     -- required_permission (empty = no gate)
  'IS_TENANT_USER',                       -- required_group (empty = no gate)
  '',                                     -- required_role (empty = no gate)
  '{"nestingLevel": 0, "parentKey": null, "hasChildren": false, "childrenKeys": []}'::json,
  'agent'
);
```

**Insert a nested child link (under a parent):**

```sql
INSERT INTO navigation_links (
  id, label, href, icon, badge, badge_variant,
  targets, sort_order, is_enabled, is_divider_before,
  required_permission, required_group, required_role,
  metadata, created_by
) VALUES (
  'custom-my-feature-child1',
  'Child Item',
  '/t/{tenantId}/my-feature/child',
  'cog',
  '',
  'default',
  ARRAY['tenant'],
  101,
  true,
  false,
  '', '', '',
  '{"nestingLevel": 1, "parentKey": "custom-my-feature", "hasChildren": false, "childrenKeys": []}'::json,
  'agent'
);
```

**Update the parent's metadata to reflect it has children:**

> **CRITICAL**: You cannot assign to the same column twice in one UPDATE. Nest `jsonb_set` calls instead.

```sql
-- CORRECT: nested jsonb_set
UPDATE navigation_links
SET metadata = jsonb_set(
  jsonb_set(metadata::jsonb, '{hasChildren}', 'true'::jsonb),
  '{childrenKeys}',
  '["custom-my-feature-child1"]'::jsonb
)
WHERE id = 'custom-my-feature';

-- WRONG: double assignment to same column — will ERROR
-- SET metadata = jsonb_set(metadata, '{hasChildren}', 'true'::jsonb),
--     metadata = jsonb_set(metadata, '{childrenKeys}', '[]'::jsonb)
```

**Available icon names:** `home`, `user`, `shield`, `lock`, `building`, `palette`, `globe`, `credit-card`, `chat`, `admin`, `bell`, `dashboard`, `products`, `categories`, `quickstart`, `alerts`, `capacity`, `chart`, `cog`, `inventory`, `navigation`, `headset`, `bot`, `faq`, `cube`, `store`, `orders`, `directory`, `integrations`, `support`, `star`, `map-pin`, `tag`, `external-link`, `package`, `settings`, `users`, `credit-card`, `layout`, `eye`, `zap`, `truck`, `barcode`

> **Note:** Icons must be registered in **three places** to work end-to-end:
> 1. `apps/web/src/hooks/useNavLinks.tsx` — `IconComponents` map (used by `decodeNestedStructure`)
> 2. `apps/web/src/app/(platform)/settings/admin/navigation/page.tsx` — `IconComponents` map + `ICON_OPTIONS` array (for admin UI)
> 3. `apps/web/src/components/navigation/NavItemRow.tsx` — `IconComponents` map (for admin nav management UI)
>
> If an icon string is not in these maps, the link will render without an icon.

**Available RBAC permissions:** `CAN_ADMIN_PLATFORM`, `CAN_SUPPORT_PLATFORM`, `CAN_VIEW_PLATFORM_LOGS`, `CAN_MANAGE_PLATFORM_USERS`, `CAN_ACCESS_SYSTEM_TOOLS`, `CAN_VIEW_SENSITIVE_DATA`, `CAN_DELETE_DATA`, `CAN_BULK_OPERATIONS`, `CAN_MANAGE_TENANT_USERS`, `CAN_MANAGE_TENANT_BILLING`, `CAN_MANAGE_TENANT_SETTINGS`, `CAN_MANAGE_TENANT_ANALYTICS`, `CAN_MANAGE_TENANT_INVENTORY`, `CAN_EXPORT_TENANT_DATA`

**Available RBAC groups:** `IS_PLATFORM_ADMIN`, `IS_PLATFORM_SUPPORT`, `IS_TENANT_ADMIN`, `IS_TENANT_OWNER`, `IS_TENANT_MANAGER`, `IS_TENANT_USER`

**Available RBAC roles:** `PLATFORM_ADMIN`, `PLATFORM_SUPPORT`, `TENANT_ADMIN`, `TENANT_OWNER`, `OWNER`, `USER`, `ADMIN`

### Option C: Via the API (for scripts)

```bash
# Bulk-replace all links (preserves built-in-* links)
curl -X POST http://localhost:4000/api/admin/navigation-links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"links": [{"id": "custom-1", "label": "My Link", "href": "/my-page", "icon": "cog", "badge": "", "badgeVariant": "default", "targets": ["all"], "order": 50, "enabled": true, "dividerBefore": false, "requiredPermission": "", "requiredGroup": "", "requiredRole": "", "metadata": {"nestingLevel": 0, "parentKey": null, "hasChildren": false, "childrenKeys": []}}]}'

# Update a single link
curl -X PUT http://localhost:4000/api/admin/navigation-links/custom-1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"label": "Updated Label", "enabled": false}'

# Delete a link (built-in-* blocked)
curl -X DELETE http://localhost:4000/api/admin/navigation-links/custom-1 \
  -H "Authorization: Bearer <token>"
```

**Important:** The POST endpoint does a **bulk-replace** — it deletes all non-built-in links NOT in the payload, then upserts all submitted links. To add a single link without affecting others, use PUT on a specific ID, or fetch all existing links first, append the new one, and POST the full list.

---

## Syncing File-Based Links to Database

If an agent has added links to the file-based nav arrays (e.g., `buildAdminNavItems()` in `AdminNavContent.tsx` or `buildTenantNav()` in `DynamicTenantSidebar.tsx`), those links will **not appear in the UI** because the database links take priority.

To sync them:

1. **Identify the file-based links** that are missing from the database
2. **Insert them into `navigation_links`** using the SQL or API approach above
3. **Verify** by checking the admin panel at `/settings/admin/navigation`
4. **Clear cache** — the frontend caches for 5 minutes. Either wait, or call `invalidateNavLinksCache()` from the admin panel (Publish button does this automatically)

### Quick sync checklist

- [ ] Read the file-based nav array (e.g., `buildAdminNavItems()`)
- [ ] Query the database: `SELECT id, label FROM navigation_links ORDER BY sort_order;`
- [ ] Compare: which file-based links have no database equivalent?
- [ ] For each missing link, INSERT into `navigation_links` with appropriate `targets`, `sort_order`, and RBAC gates
- [ ] Verify in admin panel
- [ ] Hard refresh the browser (or wait 5 minutes for cache expiry)

---

## Common Mistakes to Avoid

1. **Adding links to `buildAdminNavItems()` or `buildTenantNav()` and expecting them to show up** — They won't. These are fallbacks only. Add to the database instead.

2. **Using the POST endpoint to add a single link** — POST does bulk-replace. It will delete all other non-built-in links not in your payload. Use PUT for single-link updates, or fetch-then-append-then-POST for additions.

3. **Forgetting to set `targets`** — A link with no targets won't appear in any sidebar. Always specify at least one of: `all`, `tenant`, `admin`.

4. **Not setting `sort_order` correctly** — Links are ordered by `sort_order` ascending. Use the **hierarchical integer scheme** (see below). Do NOT use decimal sort orders — the `sort_order` column is `Int`, not `Float`.

### Hierarchical Sort Order Scheme

The `sort_order` column is `Int` (no decimals). Use a hierarchical scheme to ensure correct ordering and avoid collisions:

```
Root items:     0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 105, 110, 120, 130, 140
Children:       <root_sort_order> * 100 + 1, +2, +3 ...
                e.g., root at 10 → children at 1001, 1002, 1003
Grandchildren:  <child_sort_order> * 100 + 1, +2, +3 ...
                e.g., child at 3004 → grandchildren at 300401, 300402
```

**Collision rule:** No two links with the same `sort_order` value should share the same `targets` array value. The API sorts by `sort_order ASC, created_at ASC`, so collisions result in non-deterministic ordering (whichever was inserted first wins).

**Verification query:**
```sql
SELECT sort_order, array_agg(DISTINCT targets) as tgt, count(*)
FROM navigation_links GROUP BY sort_order, targets HAVING count(*) > 1;
-- Should return 0 rows
```

5. **Using `built-in-` prefix for custom links** — This prefix is reserved. Built-in links cannot be deleted from the admin panel. Use any other unique ID.

6. **Ignoring RBAC gates** — If a link has `requiredGroup: 'IS_PLATFORM_ADMIN'`, non-admin users won't see it. Leave gates empty (`''`) for links visible to everyone.

7. **Forgetting template variables** — For tenant-scoped links, use `{tenantId}` in the href (e.g., `/t/{tenantId}/my-page`). The `NavTemplateParser` resolves this at runtime. **Never use `${tenantId}`** (dollar-brace syntax) — the parser only recognizes `{tenantId}` (curly-brace without dollar).

8. **Using label-based UPDATEs in migration scripts** — Labels can differ between staging and production databases. Always use **ID-based** UPDATEs (`WHERE id = '...'`) in migration scripts, not label-based (`WHERE label = '...'`).

9. **Not updating parent metadata after inserting children** — When you INSERT a child link, you must also UPDATE the parent's `metadata.childrenKeys` array and `metadata.hasChildren` flag. Otherwise `decodeNestedStructure()` may not build the tree correctly. Use nested `jsonb_set` (see above) or the recursive CTE recompute approach from the migration script.

10. **Altering fragile dynamic templates** — Two template types (`tenant-locations`, `organization-locations`) generate children client-side via `DynamicNavTemplates.tsx`. Their children are NOT stored in the database. Do not insert database links as children of these template parents — they will be duplicated or conflict.

11. **Forgetting to register icons in all 3 places** — A new icon string must be added to `useNavLinks.tsx`, `page.tsx` (IconComponents + ICON_OPTIONS), and `NavItemRow.tsx`. Missing any of these causes broken icon rendering.

12. **Using `to_jsonb(null::text)` to set parentKey to JSON null** — This returns SQL NULL, which makes `jsonb_set()` return NULL for the entire metadata field. The link then disappears from the sidebar tree and its children become orphans. **Correct approach:** `COALESCE(metadata, '{}'::jsonb)` first, then `jsonb_set(metadata, '{parentKey}', 'null'::jsonb)`. The recursive CTE checks `metadata->>'parentKey' IS NULL OR metadata->>'parentKey' = '' OR metadata->>'parentKey' = 'null'`, so JSON null (which `->>` extracts as SQL NULL) works correctly.

13. **Universal links leaking into admin sidebar** — Links with `'admin'` in their `targets` array appear in the admin sidebar even if they're primarily universal/tenant links (e.g., My Locations, Platform). When restructuring sidebars, use `array_remove(targets, 'admin')` to remove links that shouldn't appear in admin. Always verify with `SELECT ... WHERE 'admin' = ANY(targets)` after migration.

14. **Sort order collisions across different parents** — Children of different parents can collide if they use the same sort_order range. Assign distinct ranges per parent (e.g., Bot Platform children at 10001-10006, Security & Platform children at 12001-12004). Always verify with `SELECT sort_order, count(*) ... HAVING count(*) > 1` filtered by target.

15. **`built-in-` links can be deleted via direct SQL** — The API blocks deletion of `built-in-*` links, but direct SQL DELETE bypasses this. This is sometimes necessary when restructuring the admin sidebar hierarchy (e.g., deleting `built-in-admin` when reparenting its children to top-level). Use with caution and always backup first.

16. **Orphaned children from NULL metadata** — If a parent link's metadata becomes NULL (e.g., from the `to_jsonb(null::text)` bug), its children become invisible orphans — they exist in the database with `parentKey` pointing to the parent, but the parent doesn't appear in the sidebar tree. Recovery: re-insert or fix the parent's metadata, then recompute metadata with the recursive CTE.

17. **File-based fallbacks should stay in sync with database** — Even though the DB is the active system, keeping `buildAdminNavItems()`, `buildNavItems()`, and `buildTenantNav()` updated ensures: (a) fallback works correctly if API is down, (b) serves as a reference for what the DB structure should look like, (c) new agents can read the fallback to understand intended nav structure. When restructuring the DB, update the fallback arrays too.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    navigation_links (DB)                     │
│  id | label | href | icon | targets | sort_order | metadata │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
              GET /api/admin/navigation-links
                           │
                           ▼
              Next.js proxy (auth-gated route.ts)
                           │
                           ▼
              NavigationLinksService.getLinks()
              (5-min cache, singleton pattern)
                           │
                           ▼
              useNavLinks() hook
              (decodes flat→nested, filters by target)
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         allLinks    tenantLinks    adminLinks
              │            │            │
              ▼            ▼            ▼
   UniversalNavContent  DynamicTenant  AdminNavContent
   (settings sidebar)   Sidebar       (admin sidebar)
                         (tenant scope)
```

---

## File-Based Fallback Behavior

Each sidebar component has a hardcoded fallback that activates when database links are empty:

- **`UniversalNavContent`**: If `injectedItems` is empty, calls `buildNavItems(user.role, tenants)` — shows Platform Home, My Account, Security, Preferences, Contact, My Locations, Admin Panel
- **`AdminNavContent`**: If `injectedItems` is empty, calls `buildAdminNavItems()` — shows Admin Dashboard, Users, Tenants, Subscriptions & Plans, Payments & Billing, Platform Capacity, Catalog, Directory, Platform Inventory, Content & Analytics, Bot Platform, CRM Hub, Logs & Audit, Security & Platform, Help & Onboarding, Account Settings
- **`DynamicTenantSidebar`**: If `processedTenantLinks` is empty, falls back to `buildTenantNav()` — shows Dashboard, Inventory, Orders, Directory, Integrations, Settings, Platform

**These fallbacks exist for resilience** (API down, first run, etc.). They are NOT the primary nav source. Do not rely on them for new features.

---

## Migration Script Best Practices

When writing SQL migration scripts to restructure navigation_links:

1. **Always backup first**: `CREATE TABLE IF NOT EXISTS navigation_links_backup AS SELECT * FROM navigation_links;`

2. **Use idempotent INSERTs**: `INSERT ... SELECT ... WHERE NOT EXISTS (SELECT 1 FROM navigation_links WHERE id = '...')`

3. **Use ID-based UPDATEs**: Never use `WHERE label = '...'` — labels can differ between staging and production.

4. **COALESCE metadata before jsonb_set**: `UPDATE ... SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{key}', value)` — prevents NULL metadata from propagating.

5. **Use `'null'::jsonb` for JSON null**: Never use `to_jsonb(null::text)` — it returns SQL NULL. Use `'null'::jsonb` to set a JSON null value.

6. **Recompute metadata with recursive CTEs after structural changes**: The nestingLevel, hasChildren, and childrenKeys should be recomputed using the recursive CTE approach (see `nav-phase2-fixup.sql` Steps 5a-5c).

7. **Remove targets from links that changed scope**: If a link moves from admin to universal/tenant, use `array_remove(targets, 'admin')` to prevent it from appearing in the wrong sidebar.

8. **Verify after migration**: Run the verification queries (admin roots, sort_order collisions, metadata consistency) on both staging and production.

9. **Run on staging first, then production**: Always test on staging, verify results, then run on production.

10. **Watch for orphaned children**: If a parent is deleted or its metadata becomes NULL, children with `parentKey` pointing to it become invisible. Always check for orphans after structural changes.
