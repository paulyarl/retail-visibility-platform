# GBP Authorized Management Suite — Sprint Plan: Phase 3

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 3 — Local Post Publisher & Media Manager
**Prerequisite:** Phase 2 complete (review ingestion running, `gbp_reviews` populated, customer portal review inbox live)
**Status:** Planning

---

## Sprint Goal

Deliver the **post publishing + media management** capabilities so a merchant can compose local posts (offers, events, what's new), schedule them for later publication, and upload/manage photos — all through the customer portal.

Phase 3 produces:
1. `gbpPostScheduler.ts` cron — publishes due `SCHEDULED` posts, marks failures
2. Post composer UI at `/account/marketing/gbp/posts`
3. Two-step binary media upload (`uploadPhotoBinary`)
4. Media manager UI at `/account/marketing/gbp/media`
5. Offer post builder wiring coupon short links (`/s/{autoId}`)
6. Photo gallery sync + Gold Standard benchmark indicators
7. 4 customer-facing API endpoints (posts list, create, delete, media list/upload)

---

## Pre-Flight Checklist

### Skills to read
| Skill | Why |
|---|---|
| `diagnostic-gallery-user-guide.md` | Diagnostic gallery → GBP media handoff pattern |
| `bsaas-coupons-private-features.md` | Coupon short link (`/s/{autoId}`) wiring for offer posts |
| `capability-deployment-flow.md` | `gbp_posts_scheduler` entitlement gate |

### Phase 2 handoff verification
- [ ] `gbp_posts` has `location_id`, `status`, `scheduled_for`, `published_at`, `post_name` columns (migration 239)
- [ ] `gbp_media` has `location_id`, `view_count` columns (migration 240)
- [ ] `GBPAdvancedSync.createPost` / `listPosts` / `deletePost` exist (tenant-side)
- [ ] `GBPAdvancedSync.listMedia` / `uploadPhoto` exist (tenant-side, `sourceUrl` only)

---

## Task Breakdown

### Task 1: `gbpPostScheduler.ts` Cron Job
**File:** `apps/api/src/jobs/gbpPostScheduler.ts`
**Spec ref:** §4 Subsystem 3 + §10 quality gate #5

**Pattern:** model after existing job patterns (`gbpHoursSync.ts`)

**Behavior:**
1. Query `gbp_posts` where `status = 'SCHEDULED'` AND `scheduled_for <= NOW()`
2. For each due post:
   - Call `GBPAdvancedSync.createPost(tenantId, post)` — publishes to Google
   - On success: set `status = 'PUBLISHED'`, `published_at = NOW()`, store `post_name` (Google resource ID)
   - On Google API error: set `status = 'FAILED'`, log error
3. Never double-publish: only process `status = 'SCHEDULED'` rows; the status flip to `PUBLISHED` prevents reprocessing

**Schedule:** runs every 5 minutes (frequent enough for scheduled posts without long delay)

**Entitlement gate:** only process posts for tenants with `gbp_posts_scheduler` capability. Tenants without the entitlement can still create immediate-publish posts (no scheduling).

---

### Task 2: Wire 4 Customer Endpoints
**File:** `apps/api/src/routes/gbp-customer.ts` (modify — replace Phase 2 stubs)
**Spec ref:** §8.1 rows 9–12

| Method | Route | Delegates to | Gate |
|---|---|---|---|
| `GET` | `/posts` | `gbp_posts` query (paginated, filter by status/type) | Customer JWT + Platform Context |
| `POST` | `/posts` | `GBPAdvancedSync.createPost` (immediate) OR insert as `SCHEDULED` (when `scheduled_for` present) | Customer JWT + Platform Context + `gbp_posts_scheduler` for scheduling |
| `DELETE` | `/posts/:id` | `GBPAdvancedSync.deletePost` + delete `gbp_posts` row | Customer JWT + Platform Context |
| `GET` | `/media` | `GBPAdvancedSync.listMedia` + `IntelligenceProfileService` benchmark | Customer JWT + Platform Context |
| `POST` | `/media/upload` | `GBPAdvancedSync.uploadPhoto` (sourceUrl) OR `uploadPhotoBinary` (binary) | Customer JWT + Platform Context |

**Post creation flow:**
- `scheduled_for` absent → immediate publish via `GBPAdvancedSync.createPost` → store result in `gbp_posts` with `status = 'PUBLISHED'`
- `scheduled_for` present → insert into `gbp_posts` with `status = 'SCHEDULED'` → scheduler cron picks it up

---

### Task 3: Two-Step Binary Media Upload
**File:** `apps/api/src/services/GBPAdvancedSync.ts` (modify — add `uploadPhotoBinary`)
**Spec ref:** §4 Subsystem 4

**Google's two-step upload flow:**
1. `POST {GBP_API}/v1/accounts/{accountId}/locations/{locationId}/media:startUpload` — returns an upload reference
2. `PUT {upload_reference}` — write binary bytes to the reference
3. `POST {GBP_API}/v1/accounts/{accountId}/locations/{locationId}/media` — create the media item from the upload reference

**New method:**
```ts
async function uploadPhotoBinary(
  tenantId: string,
  binary: Buffer,
  mimeType: string,
  category: string,
  description?: string
): Promise<MediaUploadResult>;
```

**Existing `uploadPhoto` (sourceUrl) remains unchanged** — both paths are available.

---

### Task 4: Offer Post Builder + Coupon Short Links
**File:** `apps/web/src/app/account/marketing/gbp/posts/OfferPostBuilder.tsx`
**Spec ref:** §4 Subsystem 3 + `bsaas-coupons-private-features.md`

**When composing an OFFER-type post:**
- Merchant can select an existing coupon from their coupon wallet
- The coupon's short link (`/s/{autoId}`) is wired into the offer post's `call_to_action_url`
- The offer post's `offer_coupon_code` and `offer_redeem_url` are populated from the coupon
- This creates cross-traffic: Google post → platform coupon funnel → redemption

---

### Task 5: Frontend Service Methods
**File:** `apps/web/src/services/MarketingCustomerService.ts` (modify)
**New methods:**
```ts
listPosts(params?: { page?, status?, topicType? }): Promise<PostsListResponse>;
createPost(payload: CreatePostPayload): Promise<PostResult>;
deletePost(postId: string): Promise<{ success: boolean }>;
listMedia(): Promise<MediaListResponse>;
uploadMedia(payload: UploadMediaPayload): Promise<MediaUploadResult>;
```

---

### Task 6: Post Composer UI
**Files:**
- `apps/web/src/app/account/marketing/gbp/posts/page.tsx` — post list + composer
- `apps/web/src/app/account/marketing/gbp/posts/PostComposer.tsx` — post creation form
- `apps/web/src/app/account/marketing/gbp/posts/PostCard.tsx` — post card display

**Post composer features:**
- **Post type selector:** STANDARD (What's New), EVENT, OFFER
- **STANDARD:** summary text + media URL + CTA
- **EVENT:** event title + start/end date + summary + media + CTA
- **OFFER:** summary + coupon code + redeem URL + start/end date + media + CTA (wires to `OfferPostBuilder` for coupon selection)
- **Scheduling:** "Publish Now" or "Schedule for Later" (date picker) — scheduling requires `gbp_posts_scheduler` entitlement
- **Media attachment:** select from existing GBP photos or upload new

**Post list:**
- Filter by status (PUBLISHED, SCHEDULED, FAILED) and type (STANDARD, EVENT, OFFER)
- Post cards show type badge, summary, scheduled/published date, status
- Actions: delete (published), cancel (scheduled)

---

### Task 7: Media Manager UI
**Files:**
- `apps/web/src/app/account/marketing/gbp/media/page.tsx` — media gallery
- `apps/web/src/app/account/marketing/gbp/media/MediaUploader.tsx` — upload modal

**Media gallery features:**
- **Category-grouped display:** COVER, EXTERIOR, INTERIOR, PRODUCT, FOOD_AND_DRINK, etc.
- **Gold Standard benchmark indicator:** shows the category's benchmark photo count vs. the merchant's current count (from `IntelligenceProfileService`)
- **Upload modal:** drag-and-drop or file picker → binary upload via `uploadPhotoBinary`; or URL input → `uploadPhoto`
- **Photo metadata:** category, description, view count (if available)

---

### Task 8: Unit Tests
**File:** `apps/api/src/tests/gbpPostScheduler.test.ts`
**Spec ref:** §10 quality gate #5

**Test cases:**
1. Publishes due `SCHEDULED` rows (past `scheduled_for`) → `status = 'PUBLISHED'`
2. Does not publish future-scheduled rows (`scheduled_for > NOW()`)
3. Marks `FAILED` on Google API error
4. Never double-publishes (once `PUBLISHED`, the row is skipped)
5. Respects `gbp_posts_scheduler` entitlement (skips tenants without it)

**File:** `apps/api/src/tests/gbp-customer-routes.test.ts` (extend)
**New test cases:**
6. `GET /posts` — returns 200 with paginated posts
7. `POST /posts` (immediate) — returns 200, status = PUBLISHED
8. `POST /posts` (scheduled) — returns 200, status = SCHEDULED (requires `gbp_posts_scheduler`)
9. `DELETE /posts/:id` — returns 200, post deleted
10. `GET /media` — returns 200 with media list + benchmark
11. `POST /media/upload` (sourceUrl) — returns 200
12. `POST /media/upload` (binary) — returns 200

---

## Task Dependency Graph

```
Task 1 (scheduler cron) ───────────────────────────── Task 8 (scheduler tests)
Task 2 (wire endpoints) ──── Task 5 (frontend methods) ── Task 8 (route tests)
Task 3 (binary upload) ─────┘                              │
Task 4 (offer post builder) ── Task 6 (post composer UI) ─┤
                              ── Task 7 (media manager UI)─┘
```

**Critical path:** Task 3 → Task 2 → Task 5 → Task 6/7 → Task 8

---

## Verification Gates

| Gate | Must pass |
|---|---|
| Scheduler publishes due posts | `SCHEDULED` rows with past `scheduled_for` → `PUBLISHED` |
| No double-publishing | `PUBLISHED` rows are never reprocessed |
| Google errors mark FAILED | API error → `status = 'FAILED'`, error logged |
| Entitlement gate | Scheduling requires `gbp_posts_scheduler`; immediate publish works without it |
| Binary upload | Two-step `startUpload` → `PUT binary` → `create media` flow works |
| Offer post coupon wiring | Offer post CTA URL points to `/s/{autoId}` coupon short link |
| Gold Standard benchmark | Media page shows category benchmark vs. current count |
| `pnpm checkapi` + `pnpm checkweb` | Zero new errors |
| Scheduler tests | All 5 tests pass |
| Route tests | All 7 new tests pass (22 total with Phase 0–2) |
| Post composer UI | `/account/marketing/gbp/posts` renders with composer + list |
| Media manager UI | `/account/marketing/gbp/media` renders with gallery + uploader |

---

## Files Created

| File | Task |
|---|---|
| `apps/api/src/jobs/gbpPostScheduler.ts` | 1 |
| `apps/web/src/app/account/marketing/gbp/posts/page.tsx` | 6 |
| `apps/web/src/app/account/marketing/gbp/posts/PostComposer.tsx` | 6 |
| `apps/web/src/app/account/marketing/gbp/posts/PostCard.tsx` | 6 |
| `apps/web/src/app/account/marketing/gbp/posts/OfferPostBuilder.tsx` | 4 |
| `apps/web/src/app/account/marketing/gbp/media/page.tsx` | 7 |
| `apps/web/src/app/account/marketing/gbp/media/MediaUploader.tsx` | 7 |
| `apps/api/src/tests/gbpPostScheduler.test.ts` | 8 |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/src/routes/gbp-customer.ts` | Replace 5 stubs with real endpoints | 2 |
| `apps/api/src/services/GBPAdvancedSync.ts` | Add `uploadPhotoBinary` | 3 |
| `apps/web/src/services/MarketingCustomerService.ts` | Add 5 post/media methods | 5 |
| `apps/api/src/index.ts` (or job registration) | Wire `gbpPostScheduler.ts` cron | 1 |

---

## Out of Scope

- Capability registration / BSaaS catalog / directory surfacing (Phase 4)
- Tier B autopilot (Phase 2.5 — may run in parallel if Tier A validation is complete)
- Multi-location support (post-v1)
