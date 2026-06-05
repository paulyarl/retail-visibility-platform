# 🚀 Sprint Checklist: v3.6.1 Visibility Alignment Pack
**Sprint Duration:** 2 weeks (10 working days)  
**Feature Branch:** `feature/visibility-alignment-pack-v3.6.1`  
**Target Release:** 2025-11-05  
**Status:** 🔴 Not Started

---

## 📊 Sprint Objectives

- ✅ Land Tenant Category Management & Alignment (ENH-2026-045; REQ-2025-911/912)
- ✅ Complete Business Profile module (REQ-2026-010)
- ✅ Wire Google Connect Suite foundations (ENH-2026-044)
- ✅ Maintain SWIS-ready SKU schema (v3.4)
- ✅ Ship SSR Tenant Context & Routing + CSRF/Admin audience (TR-905/906/907)

---

## 🎯 Day-by-Day Sprint Plan

### **Day 1-2: Database Foundation (CRITICAL PATH)**
**Owner:** API Lead  
**Blocker:** Must complete before API work

#### Database Migrations
- [ ] **M1.1** Run `001_enums.sql` - Create enum types
  - [ ] `availability_status` (in_stock, out_of_stock, preorder)
  - [ ] `product_condition` (new, refurbished, used)
  - [ ] `item_visibility` (public, private)
  - [ ] `sync_status` (pending, success, error)

- [ ] **M1.2** Run `002_table_alter.sql` - Alter `inventory_item` table
  - [ ] Add all SWIS-ready columns (tenant_id, sku, title, brand, etc.)
  - [ ] Create indexes: `uniq_inventory_item_tenant_sku`, `idx_updated_at`, `idx_availability`, `gin_category_path`
  - [ ] Add constraints: `price_nonnegative`, `qty_nonnegative`, `currency_len`

- [ ] **M1.3** Run `003_backfill_and_notnull.sql` - Data backfill
  - [ ] Backfill `merchant_name` from `tenant_business_profile`
  - [ ] Derive `availability` from `quantity`
  - [ ] Set NOT NULL constraints on required fields

- [ ] **M1.4** Run `004_triggers.sql` - Automation triggers
  - [ ] `touch_updated_at()` - Auto-update timestamp
  - [ ] `derive_availability_from_qty()` - Auto-derive availability

- [ ] **M1.5** Run `005_rls.sql` - Row Level Security
  - [ ] Enable RLS on `inventory_item`
  - [ ] Create `inventory_item_tenant_isolation` policy

- [ ] **M1.6** Run `006_view_swis_feed.sql` - Feed view
  - [ ] Create `swis_feed_view` for public items

- [ ] **M1.7** Run `007_diagnostics.sql` - Quality monitoring
  - [ ] Create `swis_feed_quality_report` view

#### Business Profile Schema
- [ ] **M2.1** Create `tenant_business_profile` table
  - [ ] Fields: business_name, address (line1/2, city, state, postal, country), phone, email, website
  - [ ] Fields: contact_person, hours (jsonb), social_links (jsonb), seo_tags (jsonb)
  - [ ] Fields: latitude, longitude, updated_at
  - [ ] Primary key: tenant_id (FK to tenant)

#### Category Management Schema
- [ ] **M3.1** Create `tenant_category` table
  - [ ] Fields: id, tenant_id, name, slug, parent_id, google_category_id, is_active
  - [ ] Indexes: tenant_id, slug, google_category_id
  - [ ] FK to tenants and google_taxonomy

- [ ] **M3.2** Create `google_taxonomy` table
  - [ ] Fields: id, category_id, category_path, parent_id, level, is_active, version
  - [ ] Indexes: category_id, parent_id, version
  - [ ] Seed with latest Google Product Taxonomy

- [ ] **M3.3** Create `v_feed_category_resolved` view
  - [ ] Join tenant_category + google_taxonomy
  - [ ] Output: tenant_category_path, google_category_path, mapping_status

- [ ] **M3.4** Create `category_alignment_audit` table
  - [ ] Fields: id, tenant_id, category_id, action, old_mapping, new_mapping, user_id, timestamp

#### Google Connect Schema
- [ ] **M4.1** Create Google OAuth tables
  - [ ] `google_oauth_accounts` - Account links
  - [ ] `google_oauth_tokens` - Encrypted tokens with rotation
  - [ ] `google_merchant_links` - Merchant Center connections
  - [ ] `gbp_locations` - Business Profile locations
  - [ ] `gbp_insights_daily` - Analytics data

- [ ] **M4.2** Add `source` column to `feed_sync_jobs`

**✅ Day 1-2 Exit Criteria:**
- All migrations run successfully on staging
- No data loss or corruption
- RLS policies tested and working
- Views return expected data

---

### **Day 3-4: Core API Endpoints**
**Owner:** API Lead

#### Business Profile API (REQ-2026-010)
- [ ] **API1.1** `POST /tenant/profile` - Create profile during onboarding
  - [ ] Validation: E.164 phone, email/URL normalization
  - [ ] Duplicate guard: business_name + postal_code
  - [ ] Return: 201 with tenant_id + profile data

- [ ] **API1.2** `GET /tenant/profile` - Fetch current profile
  - [ ] Auth: tenant_scope
  - [ ] Return: 200 with full profile or 404

- [ ] **API1.3** `PATCH /tenant/profile` - Update profile fields
  - [ ] Support partial updates
  - [ ] Fields: display_map, map_privacy_mode
  - [ ] Validation on all fields

#### Category Management API (ENH-2026-045)
- [ ] **API2.1** `GET /api/v1/tenants/:tenantId/categories` - List categories
  - [ ] Query params: filter (mapped/unmapped), sort, search
  - [ ] Return: categories with mapping status

- [ ] **API2.2** `POST /api/v1/tenants/:tenantId/categories` - Create category
  - [ ] Validation: unique slug per tenant
  - [ ] Auto-generate slug from name

- [ ] **API2.3** `PUT /api/v1/tenants/:tenantId/categories/:id` - Update category
  - [ ] Support name, parent_id changes
  - [ ] Audit trail logging

- [ ] **API2.4** `DELETE /api/v1/tenants/:tenantId/categories/:id` - Soft delete
  - [ ] Check for products using category
  - [ ] Cascade to children if needed

- [ ] **API2.5** `POST /api/v1/tenants/:tenantId/categories/:id/align` - Map to Google
  - [ ] Validate google_category_id exists
  - [ ] Log to audit trail
  - [ ] Return: updated category with mapping

- [ ] **API2.6** `GET /api/v1/tenants/:tenantId/categories/alignment-status` - Coverage metrics
  - [ ] Return: total, mapped, unmapped counts, percentage

- [ ] **API2.7** `GET /api/v1/tenants/:tenantId/categories/unmapped` - List unmapped
  - [ ] Return: categories without google_category_id

#### Google Taxonomy API
- [ ] **API3.1** `GET /api/v1/google-taxonomy` - List taxonomy (paginated)
  - [ ] Query params: search, level, parent_id
  - [ ] Return: taxonomy entries with paths

- [ ] **API3.2** `GET /api/v1/google-taxonomy/search?q={query}` - Search
  - [ ] Full-text search on category_path
  - [ ] Return: ranked results

- [ ] **API3.3** `GET /api/v1/google-taxonomy/version` - Current version
  - [ ] Return: version, updated_at, entry_count

#### Feed Validation API (REQ-2025-911)
- [ ] **API4.1** `POST /api/v1/tenants/:tenantId/feed/precheck` - Validate feed
  - [ ] Check all products have mapped categories
  - [ ] Check image URLs (HTTPS)
  - [ ] Check price/currency validity
  - [ ] Return: validation report with issues

- [ ] **API4.2** Update feed serializer
  - [ ] Add `productType` field (tenant category path)
  - [ ] Add `googleProductCategory` field (resolved Google path)
  - [ ] Use `v_feed_category_resolved` view

- [ ] **API4.3** Feed submission validation
  - [ ] Block when `FF_FEED_ALIGNMENT_ENFORCE=true` and unmapped categories
  - [ ] Return 400 with detailed error

#### Google Connect API (ENH-2026-044)
- [ ] **API5.1** `POST /google/oauth/link` - Initiate OAuth
  - [ ] Scopes: content, business.manage, openid, email, profile
  - [ ] Return: OAuth URL

- [ ] **API5.2** `GET /google/oauth/callback` - Handle OAuth return
  - [ ] Exchange code for tokens
  - [ ] Encrypt and store tokens
  - [ ] Return: success + linked accounts

- [ ] **API5.3** `POST /google/feeds/push` - Push feed to Merchant
  - [ ] Queue job for async processing
  - [ ] Return: 202 accepted with job_id

**✅ Day 3-4 Exit Criteria:**
- All API endpoints implemented and tested
- OpenAPI/Swagger docs updated
- Postman collection created
- Unit tests passing (>80% coverage)

---

### **Day 5-6: UI Foundation & Routing**
**Owner:** UX Lead

#### SSR Tenant Context & Routing (TR-905/906/907)
- [ ] **UI1.1** Implement tenant routing middleware
  - [ ] Pattern: `/t/{tenantId}/...`
  - [ ] Resolve tenant from ID
  - [ ] Return 404 if tenant not found
  - [ ] Set tenant context in request

- [ ] **UI1.2** CSRF Protection
  - [ ] Implement double-submit pattern
  - [ ] Generate `x-csrf-token` header
  - [ ] Set `csrf` cookie (HttpOnly)
  - [ ] Validate on all mutations

- [ ] **UI1.3** Admin Audience Controls
  - [ ] Check `aud=admin` for console routes
  - [ ] Implement step-up token flow (amr=step_up)
  - [ ] 5-minute expiry for sensitive ops
  - [ ] Return 403 if insufficient privileges

- [ ] **UI1.4** Cookie Strategy
  - [ ] HttpOnly session cookies on `app.` subdomain
  - [ ] Marketing cookies only on `www.` subdomain
  - [ ] Secure flag in production
  - [ ] SameSite=Lax

#### Business Profile UI (REQ-2026-010)
- [ ] **UI2.1** Create `/t/{tenant}/settings/profile` page
  - [ ] Form layout: 2-column responsive
  - [ ] Sections: Business Info, Address, Contact, SEO

- [ ] **UI2.2** Profile Form Component
  - [ ] Fields: business_name, address_line1/2, city, state, postal_code, country_code
  - [ ] Fields: phone_number, email, website, contact_person
  - [ ] Live validation: E.164 phone, email format, URL format
  - [ ] Inline error messages with aria-describedby

- [ ] **UI2.3** Map Preview Component (FF_MAP_CARD)
  - [ ] Display map with marker at lat/lng
  - [ ] Toggle: display_map (show/hide on public page)
  - [ ] Privacy mode: exact location vs neighborhood
  - [ ] Lazy load map library

- [ ] **UI2.4** Profile States
  - [ ] Empty: Helper copy + examples
  - [ ] Invalid: Disabled save button, field errors
  - [ ] Saved: Success toast, "NAP complete" badge
  - [ ] Loading: Skeleton UI

- [ ] **UI2.5** Onboarding Flow Integration
  - [ ] Step 2 of onboarding wizard
  - [ ] Progress indicator
  - [ ] "Skip for now" option
  - [ ] Next step CTA to Categories

**✅ Day 5-6 Exit Criteria:**
- Tenant routing working on staging
- CSRF protection tested
- Business Profile form functional
- Validation working correctly

---

### **Day 7-8: Category Management UI**
**Owner:** UX Lead

#### Category Management Page (ENH-2026-045)
- [ ] **UI3.1** Create `/t/{tenant}/categories` route
  - [ ] Add to settings navigation
  - [ ] Icon: folder/category icon
  - [ ] Badge: unmapped count if > 0

- [ ] **UI3.2** Category List View
  - [ ] Table columns: Name, Path, Google Mapping, Status, Products, Actions
  - [ ] Sorting: Name, Status, Product count
  - [ ] Filtering: Mapped/Unmapped, Active/Inactive
  - [ ] Search: By category name
  - [ ] Pagination: 50 per page

- [ ] **UI3.3** Category Overview Tab
  - [ ] Mapping coverage card: percentage + chart
  - [ ] Unmapped categories alert
  - [ ] Recent alignment activity list
  - [ ] "Review & Align" CTA button

- [ ] **UI3.4** Alignment Drawer Component
  - [ ] Slide-out from right (600px width)
  - [ ] Left panel: Tenant category details
  - [ ] Right panel: Google taxonomy search
  - [ ] Search with autocomplete (debounced 300ms)
  - [ ] Hierarchical tree browser
  - [ ] "Map Category" button
  - [ ] Preview: affected products count
  - [ ] Close: X button + Escape key

- [ ] **UI3.5** Category CRUD
  - [ ] Create: Modal with name + parent selector
  - [ ] Edit: Inline or modal
  - [ ] Delete: Confirmation dialog with impact warning
  - [ ] Bulk actions: Select multiple, align/delete

- [ ] **UI3.6** Deep-Link Support (REQ-2025-912)
  - [ ] `/t/{tenant}/categories?tab=overview` → Overview tab
  - [ ] `/t/{tenant}/categories?tab=unmapped` → Unmapped filter
  - [ ] `/t/{tenant}/categories/:id/align` → Open alignment drawer

- [ ] **UI3.7** Keyboard Navigation
  - [ ] Tab order: logical flow
  - [ ] Alt+G: Open alignment drawer
  - [ ] Alt+N: New category
  - [ ] Escape: Close drawer/modal
  - [ ] Arrow keys: Navigate tree

**✅ Day 7-8 Exit Criteria:**
- Category management page functional
- Alignment drawer working
- Deep-links tested
- Keyboard navigation smooth

---

### **Day 9: Quick Actions Footer & Google Connect**
**Owner:** UX Lead

#### Quick Actions Footer (REQ-2025-912A)
- [ ] **UI4.1** Create `QuickActionsFooter` component
  - [ ] Props: `{state, pendingChangesCount, onAlign(), onValidate(), onSave()}`
  - [ ] Position: Fixed bottom, z-index 1000
  - [ ] Width: Full width, max-width container
  - [ ] Height: 60px, responsive collapse on mobile

- [ ] **UI4.2** Footer States & Visibility
  - [ ] Show when: state = unmapped | stale | dirty
  - [ ] Hide when: state = compliant && !dirty
  - [ ] Animate: Slide up/down (200ms ease)
  - [ ] Persist: Sticky across page navigation

- [ ] **UI4.3** Footer CTAs
  - [ ] "Align Category" button (primary) → onAlign()
  - [ ] "Preview SKUs" button (secondary) → Show modal with affected products
  - [ ] "Validate Feed" button (secondary) → onValidate()
  - [ ] "Save & Return" button (success) → onSave()

- [ ] **UI4.4** Keyboard Shortcuts
  - [ ] Alt+G → Align Category
  - [ ] Alt+V → Validate Feed
  - [ ] Alt+S → Save & Return
  - [ ] Display shortcuts in tooltips

- [ ] **UI4.5** Footer Integration
  - [ ] Product edit page: `/t/{tenant}/inventory/{sku}`
  - [ ] Category management page
  - [ ] Bulk product edit page

- [ ] **UI4.6** Event Tracking
  - [ ] `qa_footer_shown` - Footer displayed
  - [ ] `qa_footer_align_clicked` - Align clicked
  - [ ] `qa_footer_preview_clicked` - Preview clicked
  - [ ] `qa_footer_validate_clicked` - Validate clicked
  - [ ] `qa_footer_save_clicked` - Save clicked
  - [ ] `qa_footer_dismissed` - Footer closed

#### Google Connect UI (ENH-2026-044)
- [ ] **UI5.1** Create `/t/{tenant}/integrations/google` page
  - [ ] Google card component
  - [ ] Status: Not linked | Linked | Error

- [ ] **UI5.2** GoogleCard Component
  - [ ] Props: `{linked, scopes[], onLink(), onUnlink(), onRefreshToken()}`
  - [ ] Linked state: Show connected accounts, scopes, last sync
  - [ ] Not linked: "Connect Google" CTA
  - [ ] Error state: Actionable error message + retry

- [ ] **UI5.3** OAuth Flow
  - [ ] Click "Connect" → Open OAuth popup
  - [ ] Handle callback → Show locations picker
  - [ ] Select locations → Save
  - [ ] Success: Toast + refresh UI

- [ ] **UI5.4** Sync Settings
  - [ ] Toggle: Merchant feed push
  - [ ] Toggle: GBP posting
  - [ ] "Test Sync" button → Show result

**✅ Day 9 Exit Criteria:**
- Quick Actions Footer working on product edit
- Google Connect flow functional
- OAuth tested end-to-end
- Event tracking verified

---

### **Day 10: Testing, QA & Documentation**
**Owner:** QA Lead + All

#### Testing
- [ ] **T1** Unit Tests (>80% coverage)
  - [ ] API endpoints: All CRUD operations
  - [ ] Feed serializer: Mapping resolution
  - [ ] Validation logic: Precheck rules
  - [ ] Components: UI components

- [ ] **T2** Integration Tests
  - [ ] End-to-end: Create profile → Add category → Align → Validate feed
  - [ ] OAuth flow: Link → Callback → Sync
  - [ ] Quick Actions: Show → Align → Save
  - [ ] Deep-links: All URL patterns

- [ ] **T3** QA Matrix (26+ Test Cases)
  - [ ] Happy paths: All primary flows
  - [ ] Edge cases: Empty states, errors, conflicts
  - [ ] Validation: Feed blocking, unmapped categories
  - [ ] Permissions: Tenant isolation, admin access
  - [ ] Accessibility: Keyboard nav, screen readers, ARIA
  - [ ] Performance: Page load <2s, API <500ms

- [ ] **T4** Manual QA
  - [ ] Staging environment smoke test
  - [ ] Cross-browser: Chrome, Firefox, Safari, Edge
  - [ ] Mobile: iOS Safari, Android Chrome
  - [ ] Responsive: 320px, 768px, 1024px, 1440px

- [ ] **T5** Accessibility Audit
  - [ ] Run AXE DevTools: 0 critical issues
  - [ ] Keyboard navigation: All interactive elements reachable
  - [ ] Color contrast: ≥4.5:1 ratio
  - [ ] Screen reader: Announce all state changes

#### Documentation
- [ ] **D1** API Documentation
  - [ ] Update OpenAPI/Swagger specs
  - [ ] Add request/response examples
  - [ ] Document error codes

- [ ] **D2** User Documentation
  - [ ] Business Profile setup guide
  - [ ] Category alignment guide
  - [ ] Google Connect guide
  - [ ] Quick Actions workflow

- [ ] **D3** Technical Documentation
  - [ ] Database schema diagrams
  - [ ] Architecture overview
  - [ ] Feature flag documentation
  - [ ] Rollback procedures

- [ ] **D4** Runbook
  - [ ] Deployment steps
  - [ ] Migration checklist
  - [ ] Monitoring setup
  - [ ] Troubleshooting guide

**✅ Day 10 Exit Criteria:**
- All tests passing
- QA sign-off received
- Documentation complete
- Ready for deployment

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] **PRE1** Database backup: `pg_dump` production
- [ ] **PRE2** Set `FF_SCHEMA_V34_READY=false`
- [ ] **PRE3** Verify disk space and index budget
- [ ] **PRE4** Review rollback plan with team

### Migration Execution
- [ ] **MIG1** Apply migrations 001-007 on staging
- [ ] **MIG2** Validate data integrity
- [ ] **MIG3** Run migrations on production (off-peak)
- [ ] **MIG4** Backfill in batches (<30s transactions)
- [ ] **MIG5** Create concurrent indexes

### Application Deployment
- [ ] **DEP1** Deploy app image with new code
- [ ] **DEP2** Flip `FF_SCHEMA_V34_READY=true`
- [ ] **DEP3** Smoke test: Create profile, add category, align
- [ ] **DEP4** Monitor error rates and performance

### Pilot Rollout
- [ ] **PIL1** Enable `FF_BUSINESS_PROFILE` for pilot cohort (10 tenants)
- [ ] **PIL2** Enable `FF_GOOGLE_CONNECT_SUITE` for pilot cohort
- [ ] **PIL3** Start `FF_SWIS_PREVIEW` A/B test at 20%
- [ ] **PIL4** Monitor pilot tenant engagement

### Enforcement
- [ ] **ENF1** Wait for 100% category mapping coverage
- [ ] **ENF2** Set `FF_FEED_ALIGNMENT_ENFORCE=true`
- [ ] **ENF3** Monitor feed blocking events
- [ ] **ENF4** Communicate with affected tenants

### Validation
- [ ] **VAL1** Run `swis_feed_quality_report` query
- [ ] **VAL2** Check Datadog dashboards
- [ ] **VAL3** Review Sentry errors
- [ ] **VAL4** Triage alerts

---

## 📊 Feature Flags Configuration

| Flag | Default | Pilot | Production | Purpose |
|------|---------|-------|------------|---------|
| `FF_SCHEMA_V34_READY` | false | true | true | Enable new schema |
| `FF_BUSINESS_PROFILE` | false | true | staged | Business Profile module |
| `FF_GOOGLE_CONNECT_SUITE` | false | true | staged | Google OAuth & sync |
| `FF_MAP_CARD` | false | true | staged | Map preview on profile |
| `FF_SWIS_PREVIEW` | false | 20% | A/B test | SWIS preview pane |
| `FF_CATEGORY_MANAGEMENT_PAGE` | false | true | true | Category UI |
| `FF_TENANT_CATEGORY_OVERRIDE` | false | false | false | Tenant mapping writes |
| `FF_FEED_ALIGNMENT_ENFORCE` | warn | warn | true | Block unmapped feeds |
| `FF_CATEGORY_QUICK_ACTIONS` | false | true | staged | Quick Actions Footer |
| `FF_TENANT_URLS` | false | true | staged | Tenant routing |
| `FF_APP_SHELL_NAV` | false | true | staged | New navigation |

---

## 📈 Success Metrics & KPIs

### Backend KPIs
- **feed_push_success_rate** ≥ 95%
- **oauth_error_rate** < 10%
- **swis_preview_p95_ms** ≤ 300ms
- **time_to_alignment_median_ms** ≤ 90,000ms (90s)
- **category_mapping_coverage_pct** = 100%

### Frontend RUM
- **LCP p75** ≤ 2.2s (Largest Contentful Paint)
- **INP p75** ≤ 200ms (Interaction to Next Paint)
- **CLS p75** ≤ 0.06 (Cumulative Layout Shift)
- **qa_footer_engagement_rate** ≥ 60%

### Business Metrics
- **feed_approval_rate** ≥ 95%
- **feed_blocked_due_to_unmapped** = 0
- **profile_completion_rate** ≥ 80%
- **google_connect_adoption** ≥ 50% (pilot)

---

## 🚨 Rollback Plan

### Immediate Actions (if critical issues)
1. **Disable Feature Flags**
   - Set `FF_CATEGORY_MANAGEMENT_PAGE=false`
   - Set `FF_CATEGORY_QUICK_ACTIONS=false`
   - Set `FF_FEED_ALIGNMENT_ENFORCE=warn`
   - Set `FF_GOOGLE_CONNECT_SUITE=false`

2. **Revert Application**
   - Deploy previous app version
   - Clear Redis cache
   - Restart services

3. **Database Rollback (if needed)**
   - Drop views: `swis_feed_view`, `swis_feed_quality_report`, `v_feed_category_resolved`
   - Drop triggers: `trg_inventory_item_touch`, `trg_inventory_item_qty_avail`
   - Relax NOT NULL constraints (if data issues)
   - Restore from backup (last resort)

4. **Communication**
   - Notify affected tenants via email
   - Update status page
   - Post incident in Slack
   - Schedule post-mortem

---

## 📝 Daily Standup Template

**What I completed yesterday:**
- [ ] List completed tasks

**What I'm working on today:**
- [ ] List planned tasks

**Blockers:**
- [ ] List any blockers

**Risks:**
- [ ] List any risks or concerns

---

## 🔗 Resources

- **Spec:** `specs/retail_visibility_master_spec_v_3_6_1_stable.md`
- **Feature Branch:** `feature/visibility-alignment-pack-v3.6.1`
- **Staging:** [staging-url]
- **Datadog:** [dashboard-url]
- **Figma:** [design-url]
- **Jira Epic:** [epic-url]

---

**Created:** 2025-10-31  
**Sprint Start:** TBD  
**Sprint End:** TBD  
**Last Updated:** 2025-10-31
