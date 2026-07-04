---
description: Complete guide for the Social Proof / UGC feature — covers data model, backend API, frontend service, moderation UI, storefront display, capability gating, and product-level badges
---

# Social Proof / UGC Guide

> **Read this before working on any social proof or UGC feature.** This guide covers the moderation pipeline, storefront display, capability gating, and product-level badges.

## Feature Overview

Social Proof is a UGC (User-Generated Content) curation system that lets tenants collect, moderate, and display social media mentions (Instagram, TikTok, Twitter, Facebook, YouTube) on their storefront and product pages.

**Three distinct surfaces:**

1. **Moderation settings page** (`/t/[tenantId]/settings/social-proof`) — Tenant admin reviews incoming mentions, approves/rejects, features standout content, views summary dashboard
2. **Storefront social proof section** — Public-facing widget on the storefront page showing platform badges and share buttons (all layout variants: classic, editorial, immersive)
3. **Product-level social proof badges** — View/like/trending badges on product pages, pulled from product metadata (not from the `social_mentions` table)

---

## 1. Data Model

### `social_mentions` Table

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(255) | Tenant-scoped ID via `generateSocialMentionId` |
| `tenant_id` | VARCHAR(255) | FK to `tenants` |
| `product_id` | VARCHAR(255)? | Optional — ties mention to a specific product |
| `platform` | VARCHAR(50) | `instagram`, `tiktok`, `twitter`, `facebook`, `youtube` |
| `mention_id` | VARCHAR(255) | Platform-native post ID (unique per platform) |
| `author_username` | VARCHAR(255) | Required |
| `author_display_name` | VARCHAR(255)? | Optional display name |
| `author_avatar_url` | VARCHAR(1000)? | Optional avatar |
| `content` | TEXT | Post text/caption |
| `media_urls` | TEXT[] | Array of image/video URLs, default `[]` |
| `like_count` | INT? | Default 0 |
| `comment_count` | INT? | Default 0 |
| `share_count` | INT? | Default 0 |
| `view_count` | INT? | Default 0 |
| `posted_at` | TIMESTAMPTZ | When the original post was created |
| `moderation_status` | VARCHAR(20) | `pending` (default), `approved`, `rejected` |
| `moderated_by` | VARCHAR(255)? | User ID of moderator |
| `moderated_at` | TIMESTAMPTZ? | When moderated |
| `is_featured` | BOOLEAN? | Default false — featured mentions sort first in public display |
| `created_at` | TIMESTAMPTZ? | Default now() |
| `updated_at` | TIMESTAMPTZ? | Default now() |

### Unique Constraints

- `@@unique([platform, mention_id])` — prevents duplicate imports of the same post
- Indexes on `tenant_id + posted_at`, `tenant_id + moderation_status`, `tenant_id + is_featured + posted_at`

### Moderation Status Flow

```
created → pending → approved (publicly visible)
                  → rejected (hidden from public)
```

Any approved mention can also be flagged `is_featured = true` to pin it to the top of public display.

---

## 2. Backend API

### Routes

**File**: `apps/api/src/routes/social-proof.ts`

Mounted at both `/api` and `/api/tenants` in `index.ts`:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/public/social-proof/:tenantId` | Public — approved mentions only, for storefront display |
| GET | `/api/tenants/:tenantId/social-proof` | Admin — all mentions (any status), with filters |
| POST | `/api/tenants/:tenantId/social-proof` | Create a new mention |
| PUT | `/api/tenants/:tenantId/social-proof/:id` | Update moderation status / featured flag |
| DELETE | `/api/tenants/:tenantId/social-proof/:id` | Delete a mention |
| GET | `/api/tenants/:tenantId/social-proof/summary` | Moderation summary counts |

### Query Parameters

**Public endpoint** (`GET /api/public/social-proof/:tenantId`):
- `productId` — filter by product
- `platform` — filter by platform
- `featured` — `true`/`false` to filter featured only
- `limit` (default 20), `offset` (default 0)

**Admin endpoint** (`GET /api/tenants/:tenantId/social-proof`):
- `status` — filter by moderation status (`pending`, `approved`, `rejected`)
- `productId`, `platform`, `featured` — same as public
- `limit` (default 50), `offset` (default 0)

### Service

**File**: `apps/api/src/services/SocialProofService.ts`

Singleton extending `BaseService`. Key methods:
- `createMention(input)` — creates mention, returns `null` on duplicate (unique constraint)
- `getMentions(tenantId, options)` — admin query, returns `{ mentions, total }`
- `getPublicMentions(tenantId, options)` — public query (approved only, featured sorted first), returns `{ mentions, total }`
- `updateMention(tenantId, id, update, moderatedBy)` — updates status/featured/notes
- `deleteMention(tenantId, id)` — hard delete
- `getModerationSummary(tenantId)` — returns `{ pending, approved, rejected, featured, total }`

### API Response Shape

All endpoints return `{ success: true, data: <payload> }`. The frontend service must unwrap via `(result.data as any).data ?? result.data` because `makeDefaultRequest` wraps the response again.

---

## 3. Frontend Service

**File**: `apps/web/src/services/SocialProofService.ts`

Singleton extending `TenantApiSingleton` (via `FlexibleApiSingleton`).

```typescript
class SocialProofServiceClass extends TenantApiSingleton {
  async listMentions(tenantId, options?) → { mentions: SocialMention[], total: number }
  async getSummary(tenantId) → ModerationSummary | null
  async createMention(tenantId, data) → SocialMention
  async updateMention(tenantId, mentionId, data) → boolean
  async deleteMention(tenantId, mentionId) → boolean
}
```

### Response Unwrapping Pattern

The `makeDefaultRequest` method returns `ApiResult<T>` where `data` is the raw API response body. Since the API wraps responses in `{ success, data }`, the actual payload is at `result.data.data`. All methods use:

```typescript
const payload = (result.data as any).data ?? result.data;
```

This handles both the wrapped and unwrapped response shapes defensively.

### Cache Invalidation

After any mutation (create/update/delete), `invalidateServiceCaches(tenantId)` is called to clear the list and summary caches.

---

## 4. Moderation Settings Page

### Route

`/t/[tenantId]/settings/social-proof`

### Files

- `apps/web/src/app/t/[tenantId]/settings/social-proof/page.tsx` — Server component, wraps in `TenantGuard`
- `apps/web/src/app/t/[tenantId]/settings/social-proof/SocialProofClient.tsx` — Client component

### UI Features

- **Summary dashboard** — Pending/approved/rejected/featured counts
- **Filter tabs** — All, Pending, Approved, Rejected
- **Mention cards** — Platform badge, author info, content preview, media thumbnails, engagement stats (likes/comments/shares/views)
- **Moderation actions** — Approve, Reject, Feature/Unfeature, Delete
- **Loading/error/empty states** — `LoadingSpinner`, error message, `EmptyState` component

### Navigation

Linked from `TenantSettings.tsx` in the Social Commerce settings group.

---

## 5. Storefront Display

### Section Visibility Logic

**File**: `apps/web/src/lib/storefront-sections.ts`

```typescript
showSocialProof: !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStore
```

**Any storefront type** can display social proof, not just social storefronts:

- **Social storefront** (`storefrontType === 'social'`) — always shows it
- **Flexible storefront** (`storefrontType === 'flexible'`) — always shows it (gets `isSocialStore = true`)
- **Retail / Online / Service storefronts** — shows it only if `socialCommerceFlags.enabled && socialCommerceFlags.canUseSocialProof` are both true (capability-gated)

### SocialProofSection Component

**File**: `apps/web/src/components/storefront/sections/SocialProofSection.tsx`

Three layout variants (classic, editorial, immersive) — all show:
- "Follow {businessName}" heading
- `SocialPlatformBadges` — links to tenant's social profiles
- `SocialShareButtons` — gated by `canUseShareButtons` capability flag

**Note**: This component does NOT currently fetch from the `social_mentions` UGC table. It displays platform follow links and share buttons only. The public API endpoint (`/api/public/social-proof/:tenantId`) exists but is not yet consumed by a storefront component for UGC gallery display.

### Storefront Integration

**File**: `apps/web/src/app/tenant/[id]/StorefrontClientWrapper.tsx`

The `SocialProofSection` is rendered when `showSocialProof` is true and the storefront is not in a disabled/panel state.

---

## 6. Product-Level Social Proof Badges

### Component

**File**: `apps/web/src/components/products/type-sections/SocialProofBadges.tsx`

Displays view count, like count, and trending rank badges on product pages. Data comes from **product metadata** (not the `social_mentions` table):

- `product.metadata.viewCount` / `product.metadata.view_count` / `product.viewCount`
- `product.metadata.likeCount` / `product.metadata.like_count` / `product.likeCount`
- `product.metadata.trendingRank` / `product.metadata.trending_rank`

### Gating

Same logic as storefront: `showSocialProof = !!(socialCommerceFlags?.enabled && socialCommerceFlags?.canUseSocialProof) || isSocialStorefront`

### Layout Variants

- `classic` — standard badge size with icon + value + label
- `quick-commerce` — compact pill badges for dense layouts
- `showcase` — same as classic

### Integration Point

**File**: `apps/web/src/components/products/sections/ProductHeaderSection.tsx`

`SocialProofBadges` is rendered in the product page header next to the business name when `showSocialProof` is true.

---

## 7. Capability Gating

### Feature Flag

`social_commerce_social_proof` — part of the `SocialCommerceExperienceType` capability group.

### Tier Resolution

**File**: `apps/web/src/services/CapabilityResolutionService.ts`

- Listed under the "Social Commerce Experience" capability group with icon `Eye`
- Default: `false` (must be explicitly enabled)
- Tier-gated via `allowedExperienceTypes.includes('social_commerce_social_proof')`
- Merchant can toggle in Social Commerce settings (`/t/[tenantId]/settings/social-commerce`)

### Flag Resolution

The `socialCommerceFlags` object resolved by `CapabilityResolutionService` includes:
- `enabled` — social commerce capability is active
- `canUseSocialProof` — the `social_commerce_social_proof` sub-flag is allowed by tier and enabled by merchant
- `canUseShareButtons` — separate sub-flag for share buttons

---

## 8. Key Architecture Decisions

1. **Manual curation, not automated scraping** — Mentions are created via the POST endpoint (from integrations or manual entry). No automated social media scraping exists.

2. **Two separate "social proof" concepts** — The `social_mentions` UGC table (moderation pipeline) and the product metadata badges (view/like counts) are independent systems that share the "social proof" label but have different data sources.

3. **Public vs admin split** — Public endpoint only returns `moderation_status = 'approved'`; admin endpoint returns all statuses. Featured mentions sort first in public queries.

4. **Platform-agnostic** — The `platform` field is a free-form string, but the UI has predefined color mappings for `instagram`, `tiktok`, `twitter`, `facebook`, `youtube`.

5. **Product association is optional** — `product_id` is nullable, allowing both product-specific and store-level UGC.

6. **Storefront section is a follow/share widget** — The current `SocialProofSection` on storefronts shows platform badges and share buttons, not UGC from the `social_mentions` table. A UGC gallery component for storefronts is a future enhancement.

---

## 9. Common Tasks

### Add a new platform

1. Add the platform name to the `PLATFORM_COLORS` map in `SocialProofClient.tsx`
2. Add a `SocialPlatformBadges` entry if it should appear in the storefront follow section
3. No schema change needed — `platform` is a VARCHAR(50) string

### Display UGC on the storefront

The public API endpoint exists but no storefront component consumes it yet. To add a UGC gallery:

1. Create a `UgcGallery` client component that fetches from `/api/public/social-proof/:tenantId`
2. Render it inside `SocialProofSection` or as a new section
3. Gate by `showSocialProof` (already resolved in `StorefrontClientWrapper`)
4. Use the frontend `SocialProofService` or fetch directly from the public endpoint

### Add engagement stat fields

1. Add column to `social_mentions` in Prisma schema
2. Update `SocialProofService.ts` backend (create + get methods)
3. Update `SocialProofService.ts` frontend (types + methods)
4. Update `SocialProofClient.tsx` to display the new stat
