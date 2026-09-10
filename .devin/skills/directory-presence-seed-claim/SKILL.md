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
- `subscription_status = 'active'` (free-forever gateway — never 'trial', which would enter the paid-trial 14-day auto-expiry machinery)
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
- `apps/api/src/services/DirectoryPresenceSeedService.ts` — admin seed CRUD, publish, invite, update fields; `composeCampaignSeoPacket` (shared SEO packet composer) + `previewCampaignSeo` (form prefill)
- `apps/api/src/services/directory/SeedSeoComposer.ts` — pure deterministic SEO packet composer (meta title, description, keywords, secondary categories, same_as, schema hint) shared by `createFromCampaign` and the manual form's seo-preview
- `apps/api/src/services/directory/listingAttributes.ts` — shared sourced-attribute normalize/extract/dedupe pipeline (one `DirectoryListingAttribute` shape across every attribute surface)
- `apps/api/src/services/DirectoryClaimService.ts` — public claim token summary + accept (accept embeds the gateway upgrade preview)
- `apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts` — shared builder for the Entry Presence gateway triad / tier-ladder options (used by both the upgrade-options route and the claim accept response)
- `apps/api/src/routes/directory-presence-upgrade.ts` — `GET/POST /api/tenant/:tenantId/upgrade(/options)` (GET is a thin auth + membership wrapper around the shared builder)
- `apps/api/src/routes/directory-presence-admin.ts` — admin routes at `/api/admin/directory-presence`
- `apps/api/src/routes/directory-presence-public.ts` — public routes at `/api/public/directory`
- `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` — SNAP badge resolution
- `apps/api/src/routes/directory-entry-options-settings.ts` — `snap_ebt_display` setting

### Frontend

- `apps/web/src/services/DirectoryClaimPublicService.ts` — public claim service (accept result carries the embedded upgrade preview)
- `apps/web/src/services/DirectoryPresenceUpgradeService.ts` — authenticated upgrade options/upgrade wrapper (only usable with a platform Auth0 session)
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — admin seed management service
- `apps/web/src/app/directory/claim/[token]/` — public claim page
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/` — admin seeds page
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/new/page.tsx` — Create Seed form with load-from-prospect picker + SEO Enrichment section
- `apps/web/src/components/directory/UnclaimedDirectoryBanner.tsx` — unclaimed listing banner

## API Endpoints

### Admin (requires PLATFORM_ADMIN)

- `GET /api/admin/directory-presence/presence-seeds` — list seeds (filters: seedBatch, status, city, category)
- `GET /api/admin/directory-presence/presence-seeds/seo-preview?campaignId=<id>` — compose the SEO packet (meta title, description, keywords, secondary categories, same_as) from the campaign's latest `business_analysis` audit without creating anything. Degrades to Tier A campaign facts when no audit exists (`seoEnrichment` null). Declared before `/presence-seeds/:id` so `seo-preview` is not swallowed as an id. Used by the Create Seed form.
- `GET /api/admin/directory-presence/presence-seeds/:id` — seed detail with provenance + tokens (includes the raw `token` string for each claim token so operators can recover a claim link after issuing)
- `POST /api/admin/directory-presence/presence-seeds` — create seed (tenant + listing + provenance). Also accepts optional SEO enrichment fields: `description` (≤500), `keywords` (≤15), `sameAs` (≤50), `seoEnrichment` (stored on the seed's `seo_enrichment` JSON)
- `POST /api/admin/directory-presence/presence-seeds/:id/publish` — publish listing
- `POST /api/admin/directory-presence/presence-seeds/:id/invite` — mint claim token (90-day default)
- `PATCH /api/admin/directory-presence/presence-seeds/:id/fields` — update sourced fields + provenance
- `PATCH /api/admin/directory-presence/presence-seeds/:id/status` — directly change seed status (body: `{ status: 'draft' | 'published' | 'invited' | 'claimed' | 'suppressed' }`). Does NOT consume tokens or flip `org_standing_mode`; use `DirectoryClaimService.acceptClaim` for the real claim flow.
- `POST /api/admin/directory-presence/presence-seeds/:id/tokens/:tokenId/revoke` — revoke a claim token (marks `consumed_at = now()`, `consumed_by = 'platform:revoked:<actorId>'`). If the seed was `invited` and no other active tokens remain, auto-flips the seed back to `published`.

### Public (no auth for GET, auth for POST)

- `GET /api/public/directory/claim/:token` — public token summary
- `POST /api/public/directory/claim/:token/accept` — bind owner (requires customer auth). Response embeds the gateway upgrade preview (`currentTier`, `isGatewayUpgrade`, `upgradeOptions[]`) so the success screen can render Entry Presence mode cards without a platform (Auth0) session.

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
- `description` — composed SEO description (SeedSeoComposer, spec §4.4.6)
- `keywords` — composed SEO keywords (SeedSeoComposer, spec §4.4.6)
- `same_as` — sameAs URLs from directory/social profiles + audit platforms
- `secondary_categories` — union of audit additional_categories + profile subcategories
- `attributes` — sourced attribute chips (payments accepted, accessibility, ownership, service options)

A field must not render publicly without a provenance row with `show_on_public = true`. Hours are omitted unless sourced.

## Sourced Attributes Display

- Feature key: `directory_visibility_attributes` (migration 267) — mirrors the SNAP/EBT badge pattern
- `attributes_badge_enabled`: tier capability
- `attributes_visible`: tier capability AND merchant has not suppressed (`attributes_display !== false` in `tenant_directory_entry_settings`)
- Storage: `directory_listings_list.attributes` JSONB — array of `{ key, label, sourcePlatform, sourceUrl, asOf }`
- Each attribute carries its own evidence (source platform + URL + as_of date); never inferred from category labels
- SNAP/EBT stays in its dedicated `snap_ebt_*` columns (migration 207) — do NOT fold it into generic attributes
- Natural data source: gold-standard scan candidates' `platform_config.attributes` (Apple Maps card payment attributes, Google profile attributes, Yelp amenities)
- Renders as a chip row on the directory entry classic layout, next to category chips, gated by `attributesVisible`
- Attribute picker (migration 268): `directory_attribute_definitions` table — predefined, category-aware chips (grouped payments / accessibility / ownership / service_options / certifications / other; `applies_to_categories` NULL = universal, otherwise lowercase category names or `platform_categories` slugs). Served by `GET /api/admin/directory-presence/attribute-definitions?category=<name>`; the seed detail edit drawer renders them as toggle chips with per-attribute evidence fields plus a custom-attribute escape hatch (replaces the old raw-JSON textarea)

## Manual Seed Creation (Load from Prospect)

The Create Seed form (`presence-seeds/new`) can prefill itself from an existing prospect instead of retyping — bridging audits → seeds without retyping NAP.

**Two load sources** (picker at the top of the form):

- **Prospect Queue** — auto-loads non-dismissed `mkt_prospect_queue` entries on mount (skips rows with `seed_id` already set); client-side filter by name/category/city. Prefills from the entry: `business_name` (falls back to `title`), NAP from `business_snapshot` with `verified_nap` taking precedence (mirrors the queue → campaign promotion path), full street addresses auto-split via `addressParser`, lat/lng, SNAP fields, sourced attributes from `business_snapshot.attributes` (normalized string-or-object entries), provenance rows from `discovery_provenance` (source `prospect_queue:<source_kind>`), identity confidence / category fit from the discovery columns, seed batch `from-queue-<entryId>`.
- **Campaign Prospect** — searches business-scope campaigns (`GET /api/admin/marketing-ops?scope=business&search=`). Prefills from the campaign record's NAP columns (`address_line1/2`, `address_city/state/zip`, `phone`, `website_url`, `category`), `same_as` provenance from `directory_profiles` + `social_profiles`, seed batch `from-campaign-<display_id>`.

**SEO Enrichment section** — when the loaded prospect has a source campaign (campaign path always; queue path via `source_campaign_id`), the form fetches `seo-preview` and prefills description / keywords / same-as (plus secondary categories if the form has none), and upserts the spec §4.4.6 provenance rows (`description`/`keywords` ← `seed_seo_composer`, `same_as` ← `business_analysis_audit`). This is the same `SeedSeoComposer` packet the automated `createFromCampaign` path writes — both paths produce identical enrichment. Tier A degradation (no audit) still prefills the template description; `seoEnrichment` is only sent when an audit exists.

**Post-create campaign link** — when the seed was loaded from a campaign, the form auto-links it (`POST .../campaign-links`, primary role) after creation so funnel analytics + the seed detail attribute-suggestion miner can find it. Link failures are logged, never blocking.

Nothing is saved on load — the operator reviews/edits every prefilled field and the seed is only created on submit. Queue entries are not mutated by loading; dismiss them separately after seeding.

## Claim Flow

1. Operator creates a seed (tenant + listing + provenance)
2. Operator publishes the seed (listing `is_published = true`)
3. Operator invites the owner (mints a claim token, shares `/directory/claim/:token`)
4. Owner visits the claim page, sees the listing summary
5. Owner registers/logs in
6. Owner accepts the claim
7. Backend consumes the token, flips `org_standing_mode` to `independent`, sets `subscription_status = 'active'` (free-forever gateway), sets seed status to `claimed`, and embeds the gateway upgrade preview in the accept response
8. Owner sees the claim success screen: free-state heading, three Entry Presence mode cards (live from the embedded options; static fallback with "from $X/mo" pricing), and a primary "Upgrade to Starter" CTA with session-aware hrefs (routes through `/auth/login?returnTo=` when no platform session exists — see `docs/LocalBiz/directory_presence_claim_handoff_spec.md`)

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
