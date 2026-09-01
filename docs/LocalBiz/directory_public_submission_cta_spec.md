# Directory Public Submission & Suggestion CTA Spec

## Context

The `directory_presence` seed/claim flow is currently operator-driven:

1. Operators create unclaimed seeds from migrations, CSV batches, manual entry, or marketing campaigns.
2. Seeds are published and become public directory/place pages.
3. Owners discover the listing and claim it via a one-time claim token.
4. On claim, the tenant is promoted from `org_standing_mode = 'directory_seed'` to `independent` and remains on the free `directory_presence` tier.

The public surfaces (`/directory/[slug]`, `/place/[slug]`, category listing, and city/location listing pages) already expose a **claim** CTA for unclaimed seeds via `UnclaimedDirectoryBanner.tsx`. There is no public path for:

- An owner whose business has **not yet been seeded** to request its inclusion.
- A shopper or friend to **suggest a business** that is missing from a category or city.

This spec defines owner-driven and public-driven submission CTAs across the directory surfaces and their handoff into the existing operator seed/claim lifecycle.

## Goals

1. Reduce operator dependency for listing discovery by letting owners and visitors surface missing businesses.
2. Keep the existing `directory_presence` seed quality bar — every published listing still requires operator review and provenance.
3. Reuse existing intake and CRM patterns rather than inventing a parallel queue.
4. Make the distinction between **claiming an existing seed**, **requesting a new listing as an owner**, and **suggesting a business as a visitor** crystal clear to the user.

## CTA Inventory and Definitions

Three CTAs must coexist on the directory surfaces. Each serves a different lifecycle stage.

### CTA 1 — "Claim this listing" (existing)

- **Audience:** Owner of an already published, unclaimed `directory_seed` listing.
- **Copy:** "Are you the owner? Claim this listing."
- **Flow:** Visit public page → click claim → `/directory/claim/[token]` or `/place/claim/[token]` → customer auth → accept claim.
- **Backend:** `DirectoryClaimService.acceptClaim` consumes `directory_claim_tokens` and flips `org_standing_mode` to `independent`.
- **Placement:** Inside `UnclaimedDirectoryBanner.tsx` on the place/directory entry page. Not on category or city listing pages (they are browse pages with no single business).

### CTA 2 — "Add your business" (owner-driven submission)

- **Audience:** Business owner whose business is not yet in the directory.
- **Primary copy:** "Have a business that is not listed? Click here to add it."
- **Alt copy:** "Own a business in [category / city]? Add it."
- **Flow:** Click CTA → public submission form → owner email verification or customer auth → submission becomes a `directory_presence_seed` in `submitted` (or `draft`) status → operator review → publish → invite owner to claim.
- **Backend:** Creates a tenant/seed with `listing_origin = 'owner_submitted'`. The owner is optionally pre-linked as the `customer` on the seed so the operator can mint the first claim token immediately on approval.
- **Placement:** Footer or bottom-of-list on category and city listing pages. Secondary placement below the unclaimed banner on entry pages, but only when the entry is not the owner's business.

### CTA 3 — "Suggest a business" (public-driven suggestion)

- **Audience:** Any visitor (shopper, friend, employee, competitor, city worker) who notices a missing business.
- **Primary copy:** "Suggest a business to add."
- **Alt copy:** "Don't see a business you know? Suggest it."
- **Flow:** Click CTA → lightweight suggestion form (name, address, city, state, category, optional comment, optional submitter email) → creates a `directory_presence_suggestions` row or a CRM `crm_support_tickets`/`mkt_dispute_intake` queue item → operator triages → if approved, converts to `directory_presence_seed` and publishes.
- **Backend:** Suggestions are never published automatically. They become operator-facing triage items.
- **Placement:** Persistent bottom-of-page CTA on category listing, city listing, and the directory home. Optionally on the place entry page as a tertiary link.

## Placement Matrix

| Page | CTA 1 "Claim" | CTA 2 "Add your business" | CTA 3 "Suggest a business" |
|---|---|---|---|
| `/place/[slug]` (unclaimed seed) | Primary, inside `UnclaimedDirectoryBanner` | Tertiary footer link | Tertiary footer link |
| `/directory/[slug]` (claimed/standard) | N/A | Tertiary footer link | Tertiary footer link |
| `/directory/categories` (all categories) | N/A | Not shown (too broad) | Global footer / bottom strip |
| `/directory/categories/[categorySlug]` | N/A | "Own a [category] business? Add it" | "Suggest a missing [category] business" |
| `/place/category/[categorySlug]` | N/A | "Own a [category] business? Add it" | "Suggest a missing [category] business" |
| `/directory/location/[location]` or `/place` city pages | N/A | "Own a business in [city]? Add it" | "Suggest a business in [city]" |
| `/directory` (home) | N/A | "Add your business" (general) | "Suggest a business" (general) |

**Priority rules:**
- On an unclaimed entry, the claim banner is the dominant CTA. The other two must be visually subordinate so the owner does not mistake them for the claim path.
- On browse pages, "Add your business" and "Suggest a business" should not be the visual center but should be easy to find at the bottom of the results or in a dedicated bottom-of-page card.

## Iconography

Public directory surfaces use `lucide-react` components; admin/Mantine surfaces use `@tabler/icons-react` icons. Assign an appropriate icon to each CTA, form field, and suggestion status so the intent is immediately recognizable.

### CTA icons

| CTA | Icon (lucide) | Icon (tabler) | Rationale |
|---|---|---|---|
| **Claim this listing** | `ShieldCheck` | `IconShieldCheck` | Ownership, trust, and verification. Keeps it visually distinct from the plus/lightbulb icons. |
| **Add your business** | `Store` or `Building2` | `IconBuildingStore` | The actor is the business owner; the icon should read as "my business." |
| **Suggest a business** | `Lightbulb` | `IconBulb` | A public idea or tip, not an ownership action. Soft and inviting. |

**Placement rules:**
- Keep the claim CTA icon at `size={18}` inside `UnclaimedDirectoryBanner` (Mantine `Alert`) so it matches the existing `IconInfoCircle` pattern.
- Use `CirclePlus` as a secondary accent for "Add your business" on browse-page cards, paired with the `Store`/`Building2` icon in the form header.
- Use `Lightbulb` for the suggestion CTA at the bottom of category/city listings; do not use `Send` there, because the form still requires review before anything is "sent" to the directory.

### Form field icons

| Field | Icon (lucide) | Icon (tabler) |
|---|---|---|
| Business name | `Building` | `IconBuilding` |
| Address | `MapPin` | `IconMapPin` |
| City | `MapPin` (with a city label) or `Landmark` | `IconMapPin` |
| State | `Flag` | `IconFlag` |
| ZIP code | `Mailbox` | `IconMailbox` |
| Phone | `Phone` | `IconPhone` |
| Email | `Mail` | `IconMail` |
| Primary category | `Tag` or `Package` | `IconTag` |
| Comment / why this business | `MessageSquare` | `IconMessage` |
| Source page (read-only) | `Link` | `IconLink` |

### Suggestion status icons (admin queue)

| Status | Icon (lucide) | Icon (tabler) | Color hint |
|---|---|---|---|
| `submitted` | `Inbox` | `IconInbox` | blue |
| `under_review` | `Search` | `IconSearch` | yellow |
| `approved` | `CheckCircle` | `IconCircleCheck` | green |
| `rejected` | `XCircle` | `IconCircleX` | red |
| `duplicate` | `Copy` | `IconCopy` | neutral |

### Admin action icons

| Action | Icon (lucide) | Icon (tabler) |
|---|---|---|
| Approve + create seed | `Check` | `IconCheck` |
| Reject | `X` | `IconX` |
| Mark duplicate | `Copy` | `IconCopy` |
| View on map | `Map` | `IconMap` |
| Contact submitter | `Mail` | `IconMail` |

## Lifecycle and Statuses

The existing `directory_presence_seeds` lifecycle is `draft → published → invited → claimed → suppressed`. This spec adds two upstream sources, not new statuses.

```
Operator seed creation  ──►  directory_presence_seeds (draft/published)
         │
         │  owner submission  ──►  directory_presence_seeds (draft)
         │      listing_origin = 'owner_submitted'
         │
         │  public suggestion  ──►  directory_presence_suggestions  ──►  operator triage
         │      (queue, not a published tenant)                        (approved) ──► seed
```

### `listing_origin` values

The `listing_origin` column on the seed/listing should be extended to include:

- `directory_seed` — existing operator-created seeds (migrations, CSV, manual, campaign).
- `owner_submitted` — owner submitted the business themselves and has been pre-associated.
- `public_suggestion` — originally surfaced by a public suggestion, later converted by ops.
- `claimed` — post-claim (existing, derived at `org_standing_mode` flip).

### New table: `directory_presence_suggestions`

Proposed schema:

| Column | Type | Notes |
|---|---|---|
| `id` | text | `dsug-` prefix generated via `generateDirectoryPresenceSuggestionId` |
| `business_name` | text | Required. Suggested business name. |
| `address` | text | Optional. Street address. |
| `city` | text | Optional. Filter for city browse. |
| `state` | text | Optional. |
| `zip_code` | text | Optional. |
| `phone` | text | Optional. |
| `primary_category` | text | Optional. Filter for category browse. |
| `submitter_email` | text | Optional. For follow-up if approved. |
| `submitter_comment` | text | Optional. Why they think it should be listed. |
| `source_page` | text | URL path where the CTA was clicked (e.g. `/directory/categories/african-grocery`). |
| `status` | enum | `submitted`, `under_review`, `approved`, `rejected`, `duplicate`. |
| `reviewed_by` | text | Platform admin user ID. |
| `reviewed_at` | timestamp | When an operator acted on it. |
| `seed_id` | text | FK to `directory_presence_seeds.id` once approved. |
| `created_at` | timestamp | |

### New table or extension: `directory_presence_owner_submissions`

An alternative to separate table: owner submissions can write directly into `directory_presence_seeds` with `status = 'draft'` and `listing_origin = 'owner_submitted'`, plus a new `submitter_customer_id` column on the seed. This is preferred because an owner submission is semantically a seed from the start and can move through the same operator review → publish → invite → claim flow.

**Recommendation:** Use `directory_presence_seeds` for owner submissions. Use `directory_presence_suggestions` for public suggestions.

## Public API Endpoints

### Owner submission

`POST /api/public/directory/submissions`

Request body:

```json
{
  "businessName": " string",
  "address": "string",
  "city": "string",
  "state": "string",
  "zipCode": "string",
  "phone": "string",
  "primaryCategory": "string",
  "submitterEmail": "string",
  "submitterIsOwner": true,
  "agreeToTerms": true
}
```

Behavior:
- Validates required fields and email/phone format.
- Performs a deduplication check against `directory_presence_seeds` and `tenants` by normalized name + city + state.
- If a seed already exists for that business, return `409` with a message pointing the owner to the claim flow (include the published slug if available).
- If not a duplicate, create a `directory_presence_seed` with `status = 'draft'`, `listing_origin = 'owner_submitted'`, and `submitter_email`.
- Send an operator notification (email or CRM alert).
- Return `201` with a submission reference number and a "we'll review" message.

### Public suggestion

`POST /api/public/directory/suggestions`

Request body:

```json
{
  "businessName": "string",
  "address": "string",
  "city": "string",
  "state": "string",
  "zipCode": "string",
  "phone": "string",
  "primaryCategory": "string",
  "submitterEmail": "string",
  "comment": "string",
  "sourcePage": "string"
}
```

Behavior:
- Validates required fields.
- Performs a deduplication check; if already seeded, return `409` with the public slug.
- Creates a `directory_presence_suggestions` row with `status = 'submitted'`.
- Rate-limited by IP and email to prevent spam.
- Return `201` with a reference number.

### Admin endpoints

- `GET /api/admin/directory-presence/suggestions` — list suggestions with filters `status`, `city`, `category`.
- `GET /api/admin/directory-presence/suggestions/:id` — suggestion detail.
- `POST /api/admin/directory-presence/suggestions/:id/approve` — convert suggestion to `directory_presence_seed` and publish; notify submitter if email captured.
- `POST /api/admin/directory-presence/suggestions/:id/reject` — mark `rejected`; notify submitter.
- `POST /api/admin/directory-presence/suggestions/:id/duplicate` — mark `duplicate`; optionally merge with existing seed.
- `GET /api/admin/directory-presence/submissions` — list owner submissions (seeds with `listing_origin = 'owner_submitted'` and `status = 'draft'`).
- `POST /api/admin/directory-presence/submissions/:id/approve` — publish and optionally mint a claim token for the submitter.

## Frontend Pages and Components

### New public pages

- `apps/web/src/app/directory/add-business/page.tsx` — owner submission form.
- `apps/web/src/app/directory/suggest/page.tsx` — public suggestion form.
- `apps/web/src/app/directory/add-business/success/page.tsx` — post-submission success.
- `apps/web/src/app/directory/suggest/success/page.tsx` — post-suggestion success.

### New shared components

- `apps/web/src/components/directory/AddBusinessCta.tsx` — bottom card for category/city pages.
- `apps/web/src/components/directory/SuggestBusinessCta.tsx` — bottom card for category/city pages.
- `apps/web/src/components/directory/DirectorySubmissionForm.tsx` — form for owner submission.
- `apps/web/src/components/directory/DirectorySuggestionForm.tsx` — form for public suggestion.

### Modifications to existing components

- `apps/web/src/components/directory/UnclaimedDirectoryBanner.tsx` — add a tertiary "Not your business? Add your own" or "Suggest a business" link below the claim copy.
- `apps/web/src/app/directory/categories/[categorySlug]/CategoryViewClient.tsx` — render `AddBusinessCta` and `SuggestBusinessCta` below results.
- `apps/web/src/app/place/category/[categorySlug]/PlaceCategoryClient.tsx` — same.
- City/location clients — same pattern with city-injected copy.
- `apps/web/src/app/directory/page.tsx` (home) — add global footer strip or bottom section with both CTAs.

## Operator Admin UI

Add a new section under `/settings/admin/directory/submissions` and `/settings/admin/directory/suggestions`.

- List view with status badges and quick actions.
- Detail view with the raw submitted data, map preview, and deduplication hints (matching seeds/tenants).
- One-click approve/reject/duplicate.
- Approve should pre-populate the existing "Create seed" form so the operator can correct/complete fields before publishing.

## Deduplication, Provenance, and Anti-Spam

### Deduplication

Both public endpoints must normalize `businessName`, `city`, `state`, and `address` and check against:

- `directory_presence_seeds` (all statuses)
- `tenants` with `directory_visible = true` or `subscription_tier = 'directory_presence'`

If a match is found, respond with the existing public slug and the appropriate next action:
- If unclaimed seed → link to `/directory/claim/[token]` or to the seed page.
- If claimed → "This business is already listed."

### Provenance

The `directory_presence` skill requires every field rendered publicly to have a `directory_field_provenance` row with `show_on_public = true`. Owner submissions and approved suggestions must create provenance rows for the fields they provide:

- `name` — from `owner_submission` or `public_suggestion`
- `address` — from `owner_submission` or `public_suggestion`
- `phone` — from `owner_submission` or `public_suggestion`
- `snap_ebt` — only if independently sourced; never inferred from category.
- `hours` — only if provided and verifiable.

**Important:** Provenance source must be the submitter, not a public scrape, so it is reviewable by operators.

### Anti-spam and rate limiting

- Public suggestions are rate-limited per IP (e.g., 5 per hour, 20 per day) and per email (1 per hour).
- Owner submissions require email verification or customer account before creating the seed.
- `honey_pot` field and basic bot detection on both forms.
- Submissions never auto-publish.

## Data Model Changes

### `directory_presence_seeds`

- Add optional `submitter_email` text.
- Add optional `submitter_customer_id` text (FK to `customers.id`).
- Add `listing_origin` text if not already present, with new allowed values: `directory_seed`, `owner_submitted`, `public_suggestion`.
- No change to `subscription_tier`, `org_standing_mode`, or claim-token logic.

### New `directory_presence_suggestions`

- Proposed schema above.
- Add migration `251_directory_presence_suggestions.sql`.
- Use `dsug-` IDs from `id-generator.ts`.

### `directory_field_provenance`

- Source values can include `owner_submission` and `public_suggestion`.

## Phased Rollout

### Phase 1 — Suggestion only (lowest risk)

- Add the "Suggest a business" CTA to category, city, and directory home pages.
- Add `POST /api/public/directory/suggestions` and admin review UI.
- Suggestions live in the queue; operators manually convert to seeds.

### Phase 2 — Owner submission

- Add "Add your business" CTAs and `POST /api/public/directory/submissions`.
- Creates `directory_presence_seeds` directly in `draft` status.
- Operator approves and publishes, then mints claim token for the owner.

### Phase 3 — Self-service claim on approval

- After operator approves an owner submission, auto-mint a claim token and email the owner.
- Owner clicks and claims with reduced friction (pre-verified email).

## Migration and Verification

1. Add migration `251_directory_presence_suggestions.sql`.
2. Run `doppler run --config local -- pnpm prisma db pull` and `pnpm prisma generate`.
3. Add `generateDirectoryPresenceSuggestionId` to `apps/api/src/lib/id-generator.ts`.
4. Run `pnpm checkapi` and `pnpm checkweb`.

## Acceptance Criteria

1. Every public directory/place/category/city page has a visible but non-dominant path to either "Add your business" or "Suggest a business".
2. The existing "Claim this listing" CTA on unclaimed entries remains the primary action and is not visually displaced.
3. Owner submission creates a `directory_presence_seed` in `draft` with `listing_origin = 'owner_submitted'`.
4. Public suggestion creates a `directory_presence_suggestions` row in `submitted` status.
5. Duplicate name/address/city/state submissions return a helpful response that points the user to an existing claim or listing URL.
6. Public suggestion endpoint is rate-limited by IP and email.
7. Approved suggestions create a seed with proper `directory_field_provenance` rows for every field published.
8. Operator can view, approve, reject, and mark-duplicate suggestions and submissions from the admin UI.
9. No field is rendered on the public directory without a provenance row (`show_on_public = true`).
10. All new API routes have validation, `pnpm checkapi` passes, and `pnpm checkweb` passes.

## Related Documents

- `.devin/skills/directory-presence-seed-claim` — seed/claim workflow and provenance rules
- `docs/LocalBiz/directory_presence_claim_handoff_spec.md` — post-claim upgrade handoff
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — progressive upgrade ladder
- `apps/web/src/components/directory/UnclaimedDirectoryBanner.tsx` — existing claim CTA
