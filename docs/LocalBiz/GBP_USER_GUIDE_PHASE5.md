# GBP Authorized Management Suite — Operational User Guide

**Version:** Phase 5 (covers Phases/Sprints 1–4)
**Audience:** Operators (Marketing Ops) and Administrators (Platform Admins)
**Last updated:** 2025

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Operator Guide — Phase 1: Claim & Verification](#3-operator-guide--phase-1-claim--verification)
4. [Operator Guide — Phase 2: Review Intelligence & Replies](#4-operator-guide--phase-2-review-intelligence--replies)
5. [Operator Guide — Phase 3: Posts & Media](#5-operator-guide--phase-3-posts--media)
6. [Operator Guide — Phase 4: Public Surfacing & Upgrades](#6-operator-guide--phase-4-public-surfacing--upgrades)
7. [Admin Guide — Capability & BSaaS Management](#7-admin-guide--capability--bsaas-management)
8. [Admin Guide — Merchant Gate Settings](#8-admin-guide--merchant-gate-settings)
9. [Admin Guide — Scheduled Job Monitoring](#9-admin-guide--scheduled-job-monitoring)
10. [Admin Guide — Entitlement & Cache Troubleshooting](#10-admin-guide--entitlement--cache-troubleshooting)
11. [Admin Guide — Public Data Safety & Escalation](#11-admin-guide--public-data-safety--escalation)
12. [Deployment Verification & Rollback](#12-deployment-verification--rollback)

---

## 1. Overview

The GBP Authorized Management Suite is a capability module (`gbp_management`) within the Retail Visibility Platform that allows operators to convert Marketing Ops prospects into claimed, verified, paying tenants with full Google Business Profile management.

### What the suite does

- **Phase 1:** Customer claim and GBP verification workflows
- **Phase 2:** Hourly review ingestion, AI draft replies (Tier A), review dispute intake
- **Phase 3:** Scheduled post publishing, media upload, Gold Standard benchmarking
- **Phase 4:** Capability monetization, merchant gate toggles, public directory/place surfacing, upgrade funnels, POS/GMC CTAs

### Who does what

| Role | Responsibilities |
|------|------------------|
| **Operator** | Prospect diagnostics, claim invitations, verification support, review monitoring, draft review, post scheduling, media management |
| **Admin** | Capability registration, BSaaS catalog, tier assignments, merchant gate settings, scheduled job monitoring, cache troubleshooting, public data safety |

---

## 2. Architecture Summary

### Two-Gate Model (Canon)

Every GBP feature passes through two gates:

1. **Hard Gate (Entitlement):** Tier grants, BSaaS purchases, individual feature grants, admin complimentary grants. Resolved by `EffectiveCapabilityResolver` → `GbpManagementResolver`.
2. **Soft Gate (Merchant Preference):** Tenant-scoped toggles in `tenant_gbp_options_settings`. Determines whether an entitled feature is displayed or active.

**R33 Rule:** Merchant preference fields must never become tier-level entitlements. The hard gate determines *availability*; the soft gate determines *visibility*.

### Capability Keys

| Feature Key | Description |
|-------------|-------------|
| `gbp_ai_response` | AI review response (Tier A drafts + future Tier B autopilot) |
| `gbp_posts_scheduler` | Scheduled post queue + lifecycle |
| `gbp_directory_reviews` | Surface GBP reviews on public pages |
| `gbp_directory_content` | Surface GBP posts + photos on public pages |
| `gbp_management_flexible` | Flexible bundle — auto-unlocks all four features above |

### Key Files

| Component | Path |
|-----------|------|
| Resolver | `apps/api/src/services/resolvers/GbpManagementResolver.ts` |
| Effective resolver wiring | `apps/api/src/services/EffectiveCapabilityResolver.ts` |
| Settings route | `apps/api/src/routes/gbp-options-settings.ts` |
| Public surface routes | `apps/api/src/routes/directory-gbp-public.ts` |
| Customer GBP routes | `apps/api/src/routes/gbp-customer.ts` |
| Review ingestion job | `apps/api/src/jobs/gbpReviewIngestion.ts` |
| Post scheduler job | `apps/api/src/jobs/gbpPostScheduler.ts` |
| GBP Advanced Sync | `apps/api/src/services/GBPAdvancedSync.ts` |
| Frontend capability mapping | `apps/web/src/services/UnifiedCapabilityService.ts` |
| GBP dashboard | `apps/web/src/app/account/marketing/gbp/page.tsx` |
| Public GBP components | `apps/web/src/components/gbp/` |

---

## 3. Operator Guide — Phase 1: Claim & Verification

### 3.1 Sending a Claim Invite

**When:** A prospect has been diagnosed and is ready to claim their business.

**Steps:**

1. Navigate to the campaign detail page in Marketing Ops admin.
2. Click **"Send Claim Invite"** in the Customer Account section.
3. The system generates a claim token and sends an email to the prospect.
4. The prospect receives a link to `/marketing/claim/[token]` where they can register or log in.
5. After registration/login, the claim is automatically consumed via `registrationClaimSweep`.

**Troubleshooting:**

- **Claim link expired:** Use the "Reissue Link" button on the campaign detail page. This generates a new token with a fresh expiry.
- **Prospect didn't receive email:** Check the CRM alerts log. Resend from the campaign detail.
- **Prospect already registered but claim not consumed:** Verify the prospect's email matches the claim token email. If different, manually associate via admin.

### 3.2 GBP Verification

**When:** After a customer has claimed their business and connected their Google Business Profile.

**Steps:**

1. The customer navigates to **Account → Marketing → Google Business Profile**.
2. If connected but unverified, the **Verification Status Card** appears.
3. The customer clicks **"Start Verification"** to fetch available verification methods.
4. Available methods (e.g., postcard, phone, email) are displayed as options.
5. The customer selects a method and initiates verification.
6. For postcard verification, a PIN dialog appears when the customer receives their postcard.
7. The customer enters the PIN to complete verification.

**Operator support:**

- Monitor verification status from the campaign detail page.
- If verification fails repeatedly, escalate to admin to check GBP API connectivity.
- Verification state transitions are audited via the `audit()` helper with `actorType: 'customer'`.

**Verification states:**

| State | Meaning |
|-------|---------|
| `UNVERIFIED` | GBP connected but not verified |
| `VERIFIED` | Verification completed |
| `VERIFICATION_FAILED` | PIN was incorrect |
| `PENDING` | Verification initiated, awaiting PIN |

### 3.3 Directory Seed Standing Transition

When a prospect completes claim + verification:

1. Their directory presence seed transitions from `unclaimed` to `claimed`.
2. The tenant record is created or updated.
3. A bridge provisioning step connects the directory listing to the tenant.
4. CRM alerts are fired to notify operators of the successful conversion.

---

## 4. Operator Guide — Phase 2: Review Intelligence & Replies

### 4.1 Review Ingestion

**Cadence:** Hourly via `gbpReviewIngestion.ts` job.

**What it does:**

- Fetches new reviews from Google Business Profile API for all connected + verified tenants.
- Stores reviews in `gbp_reviews` table.
- Refreshes cached aggregate rating (`cached_average_rating`, `cached_review_count`) on `gbp_locations_list`.
- Applies rule-based sentiment tagging (positive, negative, neutral, mixed).
- Fires CRM alerts for new reviews.

**Monitoring:**

- Check job logs for API errors (rate limits, token expiry).
- If reviews stop appearing, check:
  1. Google OAuth tokens are valid (`google_oauth_accounts_list`).
  2. GBP location is still connected (`mkt_customer_gbp_links`).
  3. GBP API is reachable (check `unifiedConfig` for API endpoints).

### 4.2 Tier A AI Draft Replies

**What it does:**

- For each new review without a reply, the system generates 3 draft replies using AI.
- Drafts are constructed with owner-voice and category-aware tone.
- Drafts are stored in the review's `ai_drafts` field.

**Entitlement:**

- Requires `gbp_ai_response` feature (hard gate).
- If not entitled, no drafts are generated. The customer sees an upgrade prompt instead.

**Operator workflow:**

1. Customer navigates to **Account → Marketing → GBP → Reviews**.
2. New reviews appear in the review inbox.
3. For entitled customers, 3 AI draft replies are shown.
4. The customer selects a draft, edits if needed, and publishes.
5. The reply is posted to Google via the GBP API.
6. If the customer disputes a review (inappropriate content, fake, etc.), they can submit a dispute intake form.

### 4.3 Review Dispute Intake

**When:** A customer believes a review violates Google's policies.

**Steps:**

1. In the review inbox, the customer clicks **"Dispute"** on a review.
2. A registry-driven intake form appears (kind: `review_response_setup` or `gbp_optimization`).
3. The customer fills in the form with evidence (screenshots, context, etc.).
4. The submission is stored in `mkt_dispute_intake` with `intake_kind`.
5. Operators are notified via CRM alerts.
6. The operator reviews the dispute and takes action on Google's side if warranted.

---

## 5. Operator Guide — Phase 3: Posts & Media

### 5.1 Creating & Scheduling Posts

**Prerequisites:**

- GBP connected and verified.
- `gbp_posts_scheduler` feature entitled (hard gate).

**Steps:**

1. Navigate to **Account → Marketing → GBP → Posts**.
2. Click **"Create Post"**.
3. Choose post type: Standard, Offer, or Event.
4. Fill in content:
   - **Summary:** Main text of the post.
   - **Media:** Optional photo attachment.
   - **Call to Action:** Button type (ORDER, LEARN_MORE, SIGN_UP, etc.) + URL.
   - **Offer fields:** Coupon code, redeem URL, terms (for Offer posts).
   - **Event fields:** Title, start/end dates (for Event posts).
5. Choose: **Publish Now** or **Schedule** for a future date/time.
6. Scheduled posts are published automatically by `gbpPostScheduler.ts` (runs every 15 minutes).

**Post lifecycle:**

| Status | Meaning |
|--------|---------|
| `DRAFT` | Created but not published or scheduled |
| `SCHEDULED` | Scheduled for future publication |
| `PUBLISHING` | Being published to Google |
| `PUBLISHED` | Successfully published |
| `FAILED` | Publication failed (see logs) |
| `EXPIRED` | Post has passed its Google expiry window |

**Troubleshooting:**

- **Post stuck in SCHEDULED:** Check `gbpPostScheduler.ts` job is running. Check `scheduled_for` timestamp is in the past.
- **Post FAILED:** Check job logs for GBP API errors. Common causes: token expiry, media upload failure, invalid CTA URL.
- **Post expired quickly:** Google posts typically expire after 7 days (standard) or 14 days (offers). This is expected behavior.

### 5.2 Media Upload & Gallery Management

**Prerequisites:**

- GBP connected and verified.

**Steps:**

1. Navigate to **Account → Marketing → GBP → Media**.
2. Click **"Upload Photo"**.
3. Select a category: Cover, Profile, Exterior, Interior, Product, Team, Food & Drink, Menu, At Work, Additional.
4. Drag & drop or browse for a photo file.
5. Add an optional description.
6. The photo is uploaded via binary upload to Google's GBP Media API.

**Gold Standard benchmarking:**

- The media page displays a Gold Standard benchmark indicator.
- This compares the tenant's photo count against the expected count for their business category.
- Benchmark data comes from `IntelligenceProfileService` → `configuration_json.expected_fields.platforms.google`.
- Use this to guide merchants toward completing their photo profile.

**Troubleshooting:**

- **Upload fails:** Check file size (max 5MB recommended). Check GBP API connectivity.
- **Photos not appearing on Google:** Google may take several minutes to process uploaded photos.

---

## 6. Operator Guide — Phase 4: Public Surfacing & Upgrades

### 6.1 Public GBP Content on Directory/Place Pages

**What customers see:**

When a tenant has both gates passing (entitlement + merchant preference), their public directory and place pages display:

- **GbpReviewsSection:** Aggregate rating badge + review list with owner replies.
- **GbpPostsSection:** Latest published posts (offers, events, updates) in a card grid.
- **GbpPhotoGallerySection:** Category-filtered photo gallery.

**When content does NOT appear:**

- Tenant lacks `gbp_directory_reviews` or `gbp_directory_content` entitlement (hard gate).
- Merchant has disabled `gbp_reviews_display` or `gbp_content_display` in settings (soft gate).
- No reviews/posts/photos exist yet.

**Operator guidance:**

- If a customer asks why their reviews aren't showing on their directory page:
  1. Check if they have `gbp_directory_reviews` or `gbp_management_flexible` in their tier/purchases.
  2. Check if `gbp_reviews_display` is enabled in their merchant settings.
  3. Check if they have any reviews in `gbp_reviews` (ingestion may not have run yet).

### 6.2 Upgrade Funnels

**Where:** GBP dashboard at **Account → Marketing → Google Business Profile**.

**What appears for unentitled customers:**

- **AI Review Response upsell:** Blue gradient card with "Upgrade" link to `/settings/feature-store?feature=gbp_ai_response`.
- **Post Scheduler upsell:** Purple gradient card with "Upgrade" link to `/settings/feature-store?feature=gbp_posts_scheduler`.
- **POS Connection CTA:** Link to `/settings/integration-options` for Square/Clover connection.
- **GMC Sync CTA:** Link to `/settings/integration-options` for Google Merchant Center sync.

**Operator guidance:**

- When a customer asks about AI review responses or post scheduling, direct them to the GBP dashboard.
- The upgrade links go to the existing BSaaS feature store, which handles checkout via the standard payment flow.

---

## 7. Admin Guide — Capability & BSaaS Management

### 7.1 Capability Module Registration

The `gbp_management` capability type is registered via migration `243_gbp_management_capability.sql`.

**To verify registration:**

```sql
SELECT * FROM capability_type_list WHERE key = 'gbp_management';
SELECT * FROM features_list WHERE key LIKE 'gbp_%';
SELECT * FROM capability_features_list cf
  JOIN capability_type_list ct ON cf.capability_type_id = ct.id
  JOIN features_list f ON cf.feature_id = f.id
  WHERE ct.key = 'gbp_management';
```

**Expected:** 1 capability type, 5 feature keys, 5 capability-feature links.

### 7.2 Tier Assignments

The `full_retail_visibility` tier has `gbp_management_flexible` assigned via migration `244_gbp_management_tier_bsaas.sql`.

**To verify:**

```sql
SELECT * FROM tier_features_list WHERE feature_key = 'gbp_management_flexible';
```

**To add to another tier:**

```sql
INSERT INTO tier_features_list (id, tier_id, feature_key, feature_name, is_enabled)
SELECT 'tfl_gbp_' || st.id, st.id, 'gbp_management_flexible', 'GBP Management (Flexible)', true
FROM subscription_tiers_list st
WHERE st.tier_key = 'YOUR_TIER_KEY'
ON CONFLICT DO NOTHING;
```

### 7.3 BSaaS Catalog

Five BSaaS catalog entries are created via migration `244`:

| Feature Key | Marketing Name | Price (monthly) |
|-------------|---------------|-----------------|
| `gbp_ai_response` | GBP AI Review Response | $29.00 |
| `gbp_posts_scheduler` | GBP Post Scheduler | $19.00 |
| `gbp_directory_reviews` | GBP Reviews on Directory | $9.00 |
| `gbp_directory_content` | GBP Posts + Photos on Directory | $9.00 |
| `gbp_management_flexible` | GBP Pro (Complete) | $49.00 |

**To verify:**

```sql
SELECT feature_key, marketing_name, price_cents, billing_cycle, is_active
FROM bsaas_catalog
WHERE feature_key LIKE 'gbp_%'
ORDER BY sort_order;
```

**To manage:** Navigate to **Settings → Admin → BSaaS Catalog** in the platform dashboard.

### 7.4 Individual Feature Grants

To grant a single GBP feature to a tenant without a tier or BSaaS purchase:

```sql
INSERT INTO tenant_feature_grants (tenant_id, feature_key, granted_by, reason)
VALUES ('tid-xxx', 'gbp_ai_response', 'admin@example.com', 'Complimentary grant for pilot');
```

This is the "admin complimentary grant" path — one of the four hard entitlement sources.

---

## 8. Admin Guide — Merchant Gate Settings

### 8.1 Understanding the Two Gates

| Gate | Source | Scope | Effect |
|------|--------|-------|--------|
| Hard | Tier/BSaaS/Grant/Admin | Tenant | Feature is *available* |
| Soft | `tenant_gbp_options_settings` | Tenant | Feature is *displayed/active* |

**R33 enforcement:** The `GbpManagementResolver` ensures:
- `can_show_reviews` / `can_show_content` are hard-gate only (R33: tier-level).
- `reviews_enabled` / `content_enabled` are the effective state (hard AND soft gate).

### 8.2 Viewing & Updating Merchant Settings

**API endpoints:**

- `GET /api/tenants/:tenantId/gbp-options` — fetch current settings.
- `PUT /api/tenants/:tenantId/gbp-options` — update settings (requires tenant admin).
- `GET /api/tenants/:tenantId/gbp-options/capability` — resolved capability state.

**Default values:**

| Setting | Default |
|---------|---------|
| `gbp_reviews_display` | `true` |
| `gbp_content_display` | `true` |

**To update via API:**

```bash
curl -X PUT https://api.example.com/api/tenants/tid-xxx/gbp-options \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"gbp_reviews_display": false}'
```

**Cache invalidation:** The PUT handler calls `invalidateEffectiveCapabilities(tenantId)` which clears both the in-memory cache and the MV cache. The next capability resolution will re-fetch from the database.

### 8.3 Direct Database Inspection

```sql
SELECT * FROM tenant_gbp_options_settings WHERE tenant_id = 'tid-xxx';
```

---

## 9. Admin Guide — Scheduled Job Monitoring

### 9.1 GBP Review Ingestion Job

**File:** `apps/api/src/jobs/gbpReviewIngestion.ts`
**Cadence:** Hourly
**What it does:**

- Iterates all connected + verified tenants.
- Fetches new reviews from GBP API.
- Stores in `gbp_reviews`.
- Refreshes cached aggregate rating.
- Applies sentiment tagging.
- Fires CRM alerts for new reviews.

**Health checks:**

- Check job execution logs for errors.
- Monitor `gbp_reviews` table for recent entries:
  ```sql
  SELECT tenant_id, COUNT(*), MAX(google_create_time) as latest
  FROM gbp_reviews
  GROUP BY tenant_id
  ORDER BY latest DESC;
  ```
- If a tenant has no recent reviews, check:
  1. OAuth token validity (`google_oauth_accounts_list`).
  2. GBP link status (`mkt_customer_gbp_links`).
  3. GBP location verification state.

### 9.2 GBP Post Scheduler Job

**File:** `apps/api/src/jobs/gbpPostScheduler.ts`
**Cadence:** Every 15 minutes
**What it does:**

- Finds posts with `status = 'SCHEDULED'` and `scheduled_for <= NOW()`.
- Publishes each post to Google via GBP API.
- Updates status to `PUBLISHED` or `FAILED`.

**Health checks:**

- Check for stuck posts:
  ```sql
  SELECT * FROM gbp_posts
  WHERE status = 'SCHEDULED' AND scheduled_for < NOW()
  ORDER BY scheduled_for;
  ```
- If posts are stuck, check job logs for API errors.
- For `FAILED` posts, check the error in job logs and retry by resetting status:
  ```sql
  UPDATE gbp_posts SET status = 'SCHEDULED' WHERE id = 'post-xxx' AND status = 'FAILED';
  ```

---

## 10. Admin Guide — Entitlement & Cache Troubleshooting

### 10.1 Checking a Tenant's Effective GBP Capabilities

**Via API:**

```bash
curl https://api.example.com/api/tenants/tid-xxx/effective-capabilities?detail=full
```

Look for `effective.gbp_management` in the response:

```json
{
  "effective": {
    "gbp_management": {
      "enabled": true,
      "is_flexible": true,
      "can_show_reviews": true,
      "can_show_content": true,
      "can_use_ai_response": true,
      "can_use_posts_scheduler": true,
      "reviews_enabled": true,
      "content_enabled": true,
      "merchant_preferences": {
        "gbp_reviews_display": true,
        "gbp_content_display": true
      }
    }
  }
}
```

### 10.2 Common Entitlement Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `enabled: false` | No tier grant, no BSaaS purchase, no feature grant | Add tier feature or purchase BSaaS or grant feature |
| `can_show_reviews: true` but `reviews_enabled: false` | Merchant gate disabled | Update `tenant_gbp_options_settings.gbp_reviews_display = true` |
| `is_flexible: false` but individual features on | Individual feature grants or BSaaS purchases | This is expected — flexible is only from tier grant |
| Capabilities not updating after settings change | Cache not invalidated | Call `invalidateEffectiveCapabilities(tenantId)` or restart API |

### 10.3 Cache Invalidation

The effective capability resolver uses two caches:

1. **In-memory cache** (`MEMORY_CACHE`) — 5 minute TTL.
2. **MV cache** (`MV_CACHE`) — for public endpoint resolution.

Both are invalidated by `invalidateEffectiveCapabilities(tenantId)`, which is called automatically by:

- `PUT /api/tenants/:tenantId/gbp-options` (merchant settings update).
- All other options-settings PUT handlers.
- BSaaS purchase completion.

**Manual cache clear:** If needed, restart the API process or wait 5 minutes for TTL expiry.

---

## 11. Admin Guide — Public Data Safety & Escalation

### 11.1 Public Endpoint Field Filtering

The public GBP endpoints at `/api/public/directory/:slug/gbp-*` expose ONLY public-safe fields:

| Endpoint | Public Fields | Excluded Internal Fields |
|----------|--------------|-------------------------|
| `gbp-reviews` | id, reviewerName, starRating, comment, reviewReply, createTime | sentiment, sentiment_score, reply_status, ai_drafts, dispute_status |
| `gbp-posts` | id, topicType, summary, mediaUrl, callToAction*, event*, offer*, publishedAt | status, scheduled_for, post_name, tenant_id |
| `gbp-photos` | id, category, sourceUrl, googleUrl, description | view_count, tenant_id, is_active |

**Verification:** The test suite at `apps/api/src/tests/directory-gbp-public-routes.test.ts` includes a dedicated test (test #7) that verifies internal fields are not present in the public response.

### 11.2 Gate Enforcement on Public Endpoints

All three public endpoints enforce both gates:

1. Resolve slug → tenant ID (via `resolveTenantIdentifier`).
2. Resolve effective capabilities via MV cache (`resolveEffectiveCapabilitiesFromMV`).
3. Check `reviews_enabled` or `content_enabled` (both gates).
4. If either gate fails → return `{ success: true, data: { enabled: false } }`.
5. If both gates pass → return public-safe data.

### 11.3 Escalation Procedures

| Issue | Escalation Path |
|-------|----------------|
| Public endpoint exposing internal fields | **Critical** — immediately check the route's `select` clause and add a test. Escalate to engineering. |
| Reviews/posts appearing for unentitled tenant | Check tier features + BSaaS purchases + feature grants. If entitlement is correct, check resolver logic. |
| Public content appearing after merchant gate disabled | Check if cache was invalidated. Run `invalidateEffectiveCapabilities(tenantId)`. |
| GBP API rate limiting or token expiry | Check `google_oauth_accounts_list` for token status. Refresh tokens if needed. |
| Post scheduler not publishing | Check job is running. Check for FAILED posts. Reset to SCHEDULED after fixing root cause. |

---

## 12. Deployment Verification & Rollback

### 12.1 Phase 4 Deployment Verification Checklist

After deploying Phase 4 migrations and code:

- [ ] **`gbp_management` capability type exists:**
  ```sql
  SELECT * FROM capability_type_list WHERE key = 'gbp_management';
  ```
- [ ] **4 feature keys exist and are linked:**
  ```sql
  SELECT f.key, cf.is_active
  FROM features_list f
  JOIN capability_features_list cf ON cf.feature_id = f.id
  JOIN capability_type_list ct ON ct.id = cf.capability_type_id
  WHERE ct.key = 'gbp_management';
  ```
  Expected: 5 rows (4 features + flexible key).
- [ ] **Full Retail Visibility Tenant has `gbp_management_flexible`:**
  ```sql
  SELECT * FROM tier_features_list WHERE feature_key = 'gbp_management_flexible';
  ```
- [ ] **5 BSaaS catalog entries visible:**
  ```sql
  SELECT feature_key, marketing_name, is_active FROM bsaas_catalog WHERE feature_key LIKE 'gbp_%';
  ```
- [ ] **`tenant_gbp_options_settings` table exists:**
  ```sql
  SELECT count(*) FROM tenant_gbp_options_settings;
  ```
- [ ] **R33 merchant-gate boundary holds:** Run `GbpManagementResolver.test.ts` (7 tests).
- [ ] **Settings update invalidates cache:** Run `gbp-options-settings` PUT and verify `invalidateEffectiveCapabilities` is called.
- [ ] **Public endpoints enforce both gates:** Run `directory-gbp-public-routes.test.ts` (7 tests).
- [ ] **Public responses exclude internal fields:** Verify via test #7 in the public routes test suite.
- [ ] **GBP components self-gate:** Visit a directory page for a tenant without GBP entitlement — sections should not render.
- [ ] **Directory/place integrations work:** Visit a directory page for an entitled tenant — GBP sections should render.
- [ ] **Upgrade funnels appear for unentitled merchants:** Visit GBP dashboard as unentitled customer — upsell cards should appear.
- [ ] **`pnpm checkapi` passes with zero errors.**
- [ ] **`pnpm checkweb` passes with zero errors.**
- [ ] **7 resolver tests pass.**
- [ ] **7 public-route tests pass.**
- [ ] **All existing GBP regression tests pass** (59+ tests).

### 12.2 Rollback Procedure

If Phase 4 needs to be rolled back:

1. **Revert code:** `git revert` the Phase 4 commit.
2. **Revert migrations (safe — additive only):**
   ```sql
   -- Migration 245: Drop settings table
   DROP TABLE IF EXISTS tenant_gbp_options_settings;

   -- Migration 244: Remove BSaaS catalog entries
   DELETE FROM bsaas_catalog WHERE feature_key LIKE 'gbp_%';

   -- Migration 244: Remove tier assignment
   DELETE FROM tier_features_list WHERE feature_key = 'gbp_management_flexible';

   -- Migration 243: Remove capability-feature links
   DELETE FROM capability_features_list
   WHERE feature_id IN (SELECT id FROM features_list WHERE key LIKE 'gbp_%');

   -- Migration 243: Remove feature keys
   DELETE FROM features_list WHERE key LIKE 'gbp_%';

   -- Migration 243: Remove capability type
   DELETE FROM capability_type_list WHERE key = 'gbp_management';
   ```
3. **Restart API** to clear in-memory caches.
4. **Verify** the effective capabilities response no longer includes `gbp_management`.

**Note:** Migrations 243-245 are purely additive (new tables, new rows). Rolling them back will not affect existing data. The `tenant_gbp_options_settings` table has `ON DELETE CASCADE` on the tenant FK, so dropping it is safe.

---

## Appendix A: Quick Reference — API Endpoints

### Customer-Authenticated (requires customer JWT + platform context)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/customer/marketing/gbp/status` | GBP connection + verification status |
| GET | `/api/customer/marketing/gbp/verification/options` | Available verification methods |
| POST | `/api/customer/marketing/gbp/verification/start` | Initiate verification |
| POST | `/api/customer/marketing/gbp/verification/complete` | Complete verification with PIN |
| GET | `/api/customer/marketing/gbp/reviews` | Review inbox |
| POST | `/api/customer/marketing/gbp/reviews/:id/reply` | Publish reply to review |
| POST | `/api/customer/marketing/gbp/reviews/:id/dispute` | Submit dispute intake |
| GET | `/api/customer/marketing/gbp/posts` | List posts |
| POST | `/api/customer/marketing/gbp/posts` | Create/schedule post |
| DELETE | `/api/customer/marketing/gbp/posts/:id` | Delete post |
| GET | `/api/customer/marketing/gbp/media` | List media |
| POST | `/api/customer/marketing/gbp/media/upload` | Upload photo |

### Tenant-Authenticated (requires tenant admin JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/tenants/:tenantId/gbp-options` | Get merchant gate settings |
| PUT | `/api/tenants/:tenantId/gbp-options` | Update merchant gate settings |

### Public (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/public/directory/:slug/gbp-reviews` | Public GBP reviews |
| GET | `/api/public/directory/:slug/gbp-posts` | Public GBP posts |
| GET | `/api/public/directory/:slug/gbp-photos` | Public GBP photos |

---

## Appendix B: Database Tables

| Table | Migration | Purpose |
|-------|-----------|---------|
| `gbp_locations_list` | Phase 0 | GBP location metadata + cached ratings |
| `gbp_reviews` | Phase 0 (enhanced Phase 2) | Reviews with sentiment + AI drafts |
| `gbp_posts` | Phase 0 (enhanced Phase 3) | Posts with lifecycle fields |
| `gbp_media` | Phase 0 (enhanced Phase 3) | Media with location + view count |
| `mkt_customer_gbp_links` | Phase 1 | Customer-to-GBP bridge links |
| `tenant_gbp_options_settings` | Phase 4 (245) | Merchant gate toggles |
| `capability_type_list` (gbp_management) | Phase 4 (243) | Capability type registration |
| `features_list` (gbp_*) | Phase 4 (243) | Feature key registration |
| `bsaas_catalog` (gbp_*) | Phase 4 (244) | BSaaS purchase catalog |
| `tier_features_list` (gbp_management_flexible) | Phase 4 (244) | Tier assignment |
