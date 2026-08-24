# Directory Presence Seed & Claim

## Purpose

The Directory Presence light tier (`directory_presence`) lets the platform seed unclaimed directory listings from public information, publish them as shopper-facing entries, and let business owners claim them — converting a seed tenant into a normal customer relationship without losing NAP (name/address/phone) identity.

This skill covers the seed/claim workflow: creating seed tenants, publishing listings, minting claim tokens, and the public claim flow.

## Architecture

### Tier

- `tier_key`: `directory_presence`
- Invite-only, zero-price, visibility-only
- Below `discovery`/`starter` in the tier hierarchy
- `max_skus`: 0, `max_locations`: 1
- No Stripe customer or billing flow
- Enabled capabilities: `directory_entry_enabled`, `directory_entry_layout_classic`, `directory_entry_hours_on`, `directory_entry_map_on`, `directory_entry_contact_on`, `directory_entry_qr_on`, `storefront_enabled`, `storefront_retail`, `directory_visibility_snap_ebt`
- Disabled: `storefront_online`, `storefront_flexible`, `storefront_policies`, checkout, coupons, product types/options

### Tenant Model

Seed tenants use real tenant rows (not demo flags):
- `org_standing_mode = 'directory_seed'`
- `subscription_tier = 'directory_presence'`
- `subscription_status = 'trial'`
- `directory_visible = true`
- `tenants.is_demo` is NOT set (reserved for demo-store clones)

On claim, `org_standing_mode` flips from `directory_seed` to `independent`. The tenant keeps its `directory_presence` tier until the owner upgrades.

### Seed/Provenance/Claim Tables

- `directory_presence_seeds` — operator-facing seed record per unclaimed listing
- `directory_field_provenance` — per-field source evidence (name, address, phone, snap_ebt, hours)
- `directory_claim_tokens` — single-use tokens for claiming a seed

### ID Prefixes

- `dll-` — directory listing IDs
- `dps-` — directory presence seed IDs
- `dfp-` — directory field provenance IDs
- `dct-` — directory claim token IDs

### SNAP/EBT Contract

- Feature key: `directory_visibility_snap_ebt`
- `snap_ebt_badge_enabled`: tier capability
- `snap_ebt_visible`: tier capability AND sourced evidence AND merchant has not suppressed
- Public copy: "SNAP/EBT reported" with an `as_of` date
- Never infer SNAP/EBT from category labels (African, halal, international)
- Allowed evidence: SNAP retailer list, owner confirmation after claim, in-store photo reviewed by ops

## Key Files

### Migrations (gitignored, applied manually)

- `database/migrations/206_directory_presence_tier.sql` — tier + capability features
- `database/migrations/207_directory_visibility_snap_ebt.sql` — SNAP columns + feature
- `database/migrations/208_directory_presence_seed.sql` — seed/provenance/claim-token tables
- `database/migrations/209_indianapolis_african_grocery_seeds.sql` — initial 10 Indianapolis seeds

### Backend

- `apps/api/src/lib/id-generator.ts` — `generateDirectoryListingId`, `generateDirectoryPresenceSeedId`, `generateDirectoryFieldProvenanceId`, `generateDirectoryClaimTokenId`, `generateDirectoryClaimTokenString`
- `apps/api/src/services/DirectoryPresenceSeedService.ts` — admin seed CRUD, publish, invite, update fields
- `apps/api/src/services/DirectoryClaimService.ts` — public claim token summary + accept
- `apps/api/src/routes/directory-presence-admin.ts` — admin routes at `/api/admin/directory-presence`
- `apps/api/src/routes/directory-presence-public.ts` — public routes at `/api/public/directory`
- `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` — SNAP badge resolution
- `apps/api/src/routes/directory-entry-options-settings.ts` — `snap_ebt_display` setting

### Frontend

- `apps/web/src/services/DirectoryClaimPublicService.ts` — public claim service
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — admin seed management service
- `apps/web/src/app/directory/claim/[token]/` — public claim page
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/` — admin seeds page
- `apps/web/src/components/directory/UnclaimedDirectoryBanner.tsx` — unclaimed listing banner

## API Endpoints

### Admin (requires PLATFORM_ADMIN)

- `GET /api/admin/directory-presence/presence-seeds` — list seeds (filters: seedBatch, status, city, category)
- `GET /api/admin/directory-presence/presence-seeds/:id` — seed detail with provenance + tokens (includes the raw `token` string for each claim token so operators can recover a claim link after issuing)
- `POST /api/admin/directory-presence/presence-seeds` — create seed (tenant + listing + provenance)
- `POST /api/admin/directory-presence/presence-seeds/:id/publish` — publish listing
- `POST /api/admin/directory-presence/presence-seeds/:id/invite` — mint claim token (90-day default)
- `PATCH /api/admin/directory-presence/presence-seeds/:id/fields` — update sourced fields + provenance
- `PATCH /api/admin/directory-presence/presence-seeds/:id/status` — directly change seed status (body: `{ status: 'draft' | 'published' | 'invited' | 'claimed' | 'suppressed' }`). Does NOT consume tokens or flip `org_standing_mode`; use `DirectoryClaimService.acceptClaim` for the real claim flow.
- `POST /api/admin/directory-presence/presence-seeds/:id/tokens/:tokenId/revoke` — revoke a claim token (marks `consumed_at = now()`, `consumed_by = 'platform:revoked:<actorId>'`). If the seed was `invited` and no other active tokens remain, auto-flips the seed back to `published`.

### Public (no auth for GET, auth for POST)

- `GET /api/public/directory/claim/:token` — public token summary
- `POST /api/public/directory/claim/:token/accept` — bind owner (requires customer auth)

## Seed Statuses

- `draft` — created but not published
- `published` — listing is_published = true
- `invited` — claim token minted
- `claimed` — owner has accepted the claim
- `suppressed` — operator has hidden the listing

## Provenance Field Keys

- `name`
- `address`
- `phone`
- `snap_ebt`
- `hours`
- `specialty_line`

A field must not render publicly without a provenance row with `show_on_public = true`. Hours are omitted unless sourced.

## Claim Flow

1. Operator creates a seed (tenant + listing + provenance)
2. Operator publishes the seed (listing `is_published = true`)
3. Operator invites the owner (mints a claim token, shares `/directory/claim/:token`)
4. Owner visits the claim page, sees the listing summary
5. Owner registers/logs in
6. Owner accepts the claim
7. Backend consumes the token, flips `org_standing_mode` to `independent`, sets seed status to `claimed`
8. Owner can now manage the listing from their dashboard and upgrade tiers

## Post-Claim GBP Public Surfacing

After a seed is claimed and the owner connects + verifies their Google Business Profile, the directory and place pages can surface GBP content (reviews, posts, photos) if the tenant has the `gbp_management` capability:

- **Hard gate:** `gbp_directory_reviews` or `gbp_directory_content` feature key (from tier, BSaaS purchase, or grant)
- **Soft gate:** `tenant_gbp_options_settings.gbp_reviews_display` / `gbp_content_display` (merchant toggle, default true)

When both gates pass, the directory/place pages render `GbpReviewsSection`, `GbpPostsSection`, and `GbpPhotoGallerySection` components. When either gate fails, the components render nothing (self-gating).

Public GBP endpoints: `GET /api/public/directory/:slug/gbp-reviews`, `gbp-posts`, `gbp-photos` (see `apps/api/src/routes/directory-gbp-public.ts`).

See `docs/LocalBiz/GBP_USER_GUIDE_PHASE5.md` for the full operational guide.

## Operator Invite Copy

> You're already listed on the Indianapolis African grocery directory from public information (address, phone, and SNAP where reported). Claim the listing to fix hours or phone and add a photo. This is not an online store.

## Non-Goals

- No catalog, cart, checkout, or EBT payment processing
- No contested identity seeding
- No invented hours, ratings, or EBT claims from category labels
- No `tenants.is_demo` for seeded prospects
- No direct `schema.prisma` edits (use `prisma db pull` after migrations)

## Verification

After applying migrations 206-209:

```bash
doppler run --config local -- pnpm prisma db pull
pnpm prisma generate
pnpm checkapi
pnpm checkweb
```

Verify:
- `directory_presence` exists in `subscription_tiers_list`
- 10 seeds in `directory_presence_seeds` with `seed_batch = 'indianapolis-african-grocery-2026'`
- Each listing has `listing_origin = 'directory_seed'` and `is_published = true`
- Each seed has provenance rows for `name` and `address` with `show_on_public = true`
- No SNAP/EBT values are set unless sourced (none in the initial batch)
- Higher tiers retain all existing capabilities
