# Directory Presence Claim → Upgrade Handoff Spec

## Context

After an owner successfully claims a `directory_presence` seed, the tenant remains on the free `directory_presence` tier. On claim, the listing's `listing_origin` flips from `directory_seed` to `claimed`, so the canonical public URL is `/directory/{slug}` (the `/place/{slug}` route serves unclaimed seeds). The next strategic goal is to move the owner into a paid **Presence Mode** (`presence` / `discovery` / `storefront`) and, eventually, into the full platform capability universe (commerce, scale, BSaaS add-ons).

The current post-claim success screen (`DirectoryClaimClient.tsx`, `state === 'success'`) only shows a vague, secondary "Choose Your Presence Mode" button. It does not explain what the owner currently has, what they are missing, or why they should upgrade. This spec defines a stronger, benefit-driven handoff.

**Scope and supersession:** this spec supersedes §6.2 ("Claim success") of `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` for this screen. Dashboard `TierUpgradeCard` copy and the operator-approval cohort are out of scope (see "Operator-approval claims" below).

## What's already free

The free `directory_presence` claim gives the owner (verified against the tier feature set in `apps/web/src/lib/tiers/tier-features.ts`):

- A public directory listing at `/directory/{slug}` — the canonical public URL after claim.
- Core business details: name, address, phone.
- Business hours with timezone (rendered only when sourced).
- A map and contact block.
- A basic QR code to share the page.
- The SNAP/EBT "reported" badge (when sourced and not suppressed).

This is the **free visibility baseline**. No checkout, no online store, no product catalog, no enriched branding.

**Boundary rule (both directions):** logo, about/bio, photo gallery, social links, and the website/external link are `presence` (paid) unlocks (`directory_entry_logo_on`, `directory_entry_about_on`, `directory_entry_gallery_on`, `directory_entry_social_on`, `directory_entry_external_link`) — never present them as free. Conversely, hours, map, contact, QR, and the SNAP badge are already free — never present them as paid benefits.

## What the owner should see immediately after claim

### 1. Success heading

Replace the generic "Listing Claimed!" with something that sets up the upgrade:

> **You own the listing for {businessName}.**
> Your free directory listing is live. Shoppers can find you, but it’s still a basic listing. Choose a Presence Mode to unlock your full directory entry.

This makes the free state explicit and frames the next step as a natural upgrade, not a hidden setting.

Copy notes: say "basic listing", not "text-only" — the free tier already renders map, hours, and QR, and the owner can add a photo after claiming. Say "directory listing", not "place page" — post-claim the canonical public URL is `/directory/{slug}`.

### 2. Presence Mode choice cards

Render three peer-choice cards on the success screen. The default/recommended mode is `presence` (Starter). Card content renders from the `upgradeOptions` embedded in the claim accept response (see "Data source"); the static copy below is the fallback.

| Mode | Tier key | Price | Headline | What it unlocks |
|---|---|---|---|---|
| **Own your directory listing** | `presence` | $19/mo | Enriched, branded directory entry | Business logo, about/bio, photo gallery, social links, and richer directory layouts (classic / editorial / immersive) on your `/directory/{slug}` page. **Recommended first step.** |
| **Get found on Google** | `discovery` | $29/mo | Google SWIS integration | Google Shopping / Search / Maps visibility for your products and store, plus thin directory chrome. Best if Google discoverability is the priority. |
| **Open your platform store** | `storefront` | $59/mo | Branded marketplace storefront | A full, branded `/shops/{slug}` browse experience with product catalog and Google inherit — browsing only, checkout arrives with Commerce tiers. Best if you want shoppers browsing your store on the platform. |

Copy accuracy rules (verified against the tier feature sets — do not deviate):

- No "premium" layout on the `presence` card — `directory_entry_layout_premium` is an à la carte Feature Store item, not a Presence inclusion.
- No "featured products" on the `presence` card — the tier has `max_skus: 0` (no catalog).
- No "cart" or checkout language on the `storefront` card — storefront grants browse; checkout starts at Commerce tiers.
- Discovery gets "thin directory chrome", not full gallery/layout polish — that is Presence's differentiator.
- Reference `/shops/{slug}` for the storefront surface (the `/tenant/{id}` route is id-param, not slug).

Note: hours, map, contact, the basic share QR code, and the SNAP badge are already included in the free `directory_presence` tier and must **not** be listed as paid upgrade benefits.

Fallback pricing caveat: $19 / $29 / $59 are launch-locked but DB-adjustable (`subscription_tiers_list`; progressive spec T14). Render fallback prices as "from $X/mo" and re-verify this table whenever tier pricing changes.

### 3. Primary vs. secondary CTAs

Re-order the action group so the upgrade is the obvious next step:

1. **Primary** — `Upgrade to Starter` (`presence`) → session-aware href (below)
2. **Secondary** — `Go to Dashboard` → session-aware href (below)
3. **Tertiary** — `View Listing` → `/directory/{slug}`
4. **Tertiary** — `Back to Directory`

The primary button should be visually dominant (filled, not `variant="light"`). The dashboard and listing buttons are escape hatches, not the main story.

**Session-aware hrefs (login interstitial).** `/t/{tenantId}/*` pages are server-gated on an Auth0 session — the layout (`apps/web/src/app/t/[tenantId]/layout.tsx`) redirects unauthenticated visitors to `/auth/login` (Auth0 universal login, auto-mounted via `src/proxy.ts`). A freshly-claimed owner who registered through the customer funnel has no Auth0 session — the platform JWTs returned by the claim promotion are written to `platform_access_token` in localStorage and read by nothing in the app. Therefore:

- Platform session present → link directly to `/t/{tenantId}/settings/subscription/upgrade` (dashboard CTA: `/t/{tenantId}/dashboard`).
- No platform session → link to `/auth/login?returnTo=` + `encodeURIComponent('/t/{tenantId}/settings/subscription/upgrade')`. Build this href explicitly: the `/t/[tenantId]` layout hardcodes its own `returnTo` to the dashboard, so relying on the layout's redirect silently drops the upgrade context.
- Detect the session via the same auth0-cookie check `AuthContext` uses, or via the existing `useAuth()` import if an AuthProvider wraps this route (verify before relying on it — `useAuth` throws outside a provider). When detection is inconclusive, default to the login-routed href.
- After login the owner must land on the upgrade page (primary path) or the dashboard (secondary path) — never a generic home.
- Do not carry `?welcome=true` forward: nothing in the dashboard consumes it today. Link the bare `/t/{tenantId}/dashboard` unless a welcome experience ships in the same change.

### 4. Full platform capability ladder

Below the three cards, add a short, future-looking paragraph that connects the first upgrade to the rest of the platform:

> Start with a Presence Mode. Later, add checkout with **Commitment**, **E-commerce**, or **Omnichannel**, then scale with **Professional**, **Organization**, or **Enterprise** tools. You can also buy individual features à la carte from the Feature Store at any time.

This sets the expectation that the platform is a ladder, not a one-time purchase, and that the first paid tier is the on-ramp to the full capability universe.

## Implementation notes

### File to modify

`apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx`, in the `state === 'success'` block (currently around lines 520–650).

### Data source

- `claimResult.tenantId` builds the upgrade and dashboard hrefs; `summary.slug` builds the View Listing href (the accept response does not return a slug).
- **Primary — embed `upgradeOptions` in the claim accept response.** `DirectoryClaimService.acceptClaim` and the accept route (`apps/api/src/routes/directory-presence-public.ts`) should return the gateway triad: `currentTier`, `isGatewayUpgrade: true`, and `upgradeOptions[]` (`tierKey`, `displayName`, `priceMonthly`, `mode`, `surface`, `tagline`, `isPrimary`, `newFeatures`). Extract the option-building logic from `GET /api/tenant/:tenantId/upgrade/options` (`apps/api/src/routes/directory-presence-upgrade.ts`) into a shared helper used by both routes.
  - Rationale: the claimant authenticates with a customer JWT, but platform `/api/tenant/*` routes require an Auth0 session (`authenticateToken` reads Auth0 cookies/headers only). Calling `getUpgradeOptions` from the success screen 401s for every newly-promoted owner — without this change the static fallback would be the norm, not the exception. Embedding the options in the accept response needs no extra auth round-trip.
- **Secondary — `directoryPresenceUpgradeService.getUpgradeOptions(tenantId)`**: only works when the visitor already has a platform (Auth0) session (e.g., an existing platform user claiming from a logged-in browser). Use it to refresh cards on re-render when available.
- **Fallback** — the static copy in the table above, rendered only when no options are available (see the fallback pricing caveat).
- Cleanup while in this block: the `platform_access_token` / `platform_refresh_token` localStorage keys are written here but read nowhere in the app — do not build new behavior on them (remove the writes or leave them untouched), and correct the misleading "tokens are already in localStorage — go straight to the dashboard" comment.

### Component approach

Keep everything inside `DirectoryClaimClient.tsx` for the first pass. A new `ClaimUpgradeTeaser` helper function can be defined at the bottom of the file if the JSX becomes too large. Avoid creating new top-level component files until the copy and layout are validated.

### Password-setup interaction

The success block currently hides the entire action group while `requiresPasswordSetup` is pending (`{!needsPasswordSetup && ...}`). Keep that behavior: a promoted OAuth-only owner sees the password-setup form first; the mode cards and CTA group render only after the password is set (or when setup was never required). Never place upgrade CTAs above the password form.

### Layout and responsive behavior

- The success screen renders inside a Mantine `Container size="sm"` (narrow single column). Widen the success state only (e.g., `size="lg"`) so the three cards can sit three-across on desktop; keep a single stacked column below ~992px.
- Give the cards stable min-heights so the "Recommended" marker and price lines do not shift layout between cards.
- At 320px the primary CTA must wrap, not clip; tertiary links may wrap to a second row. No horizontal overflow.
- Keep the mode language continuous with the destination page (`/t/{tenantId}/settings/subscription/upgrade` renders the same triad with mode badges): same mode names, same "Recommended" marker. The destination page is Tailwind + lucide while this page is Mantine — match structure and copy, not exact styling.

### Design constraints

- Do not gate wording on tier keys. Use the resolved upgrade options (per `capability-architecture-platform-engine.md`).
- Do not hide the free state. Explicitly say the current listing is free so the owner understands the value ladder.
- Do not list hours, map, contact, the basic QR code, or the SNAP badge as paid benefits; they are already in the free `directory_presence` tier.
- Do not list logo, about/bio, gallery, social links, or the website/external link as free; they are `presence` unlocks.
- Card copy must stay within each tier's actual feature set (see the copy accuracy rules above).
- "Recommended" must not be color-only — include the text marker. Cards must be keyboard-navigable with visible focus states (Mantine defaults are acceptable).
- Keep the "full platform universe" copy short; the immediate goal is choosing the first Presence Mode.

## Operator-approval claims (out of scope)

Claims routed through operator approval (`operator_approval_required`) never render the success screen in-browser: the owner sees the `pending_approval` state and leaves, and `approveClaimRequest` completes the claim server-side (token consumed, tenant flipped, customer promoted) without notifying the owner. This cohort gets no upgrade handoff from this spec.

Named follow-up (separate change): an approval notification email to the claimant containing the upgrade link, plus alignment of the dashboard `TierUpgradeCard` copy with this spec's card copy. Until then, the dashboard `TierUpgradeCard` is the only in-product handoff for approved claimants.

## Measurement

- Primary metric: upgrade-within-14-days-of-claim rate — join the existing audit events `directory_claim.accept` → `directory_tier_upgrade` on `tenantId` within the window. No new instrumentation is required for this.
- Optional secondary: a `src=claim_success` query param on the primary CTA href for upgrade-page attribution; do not let it block shipping.
- Run a pre-change baseline window and a post-change window (minimum 2 weeks each, or until ~100 claims per arm). Rollback criterion: if completed-upgrade conversion drops below the pre-change baseline, revert to the single secondary upgrade button and re-test the copy.

## Acceptance criteria

1. When the accept response includes `upgradeOptions`, the three cards render `displayName`, `tagline`, `priceMonthly`, `mode`, and the primary marker from that data.
2. When no options are available, the static fallback renders with "from $X/mo" pricing.
3. Free-tier items (hours, map, contact, QR, SNAP badge) never appear in paid-card copy; paid-gated items (logo, about, gallery, social, website link) never appear in the free list.
4. Card copy contains no "premium" layout, no "featured products", and no "cart"/checkout language.
5. The primary button is filled (not `variant="light"`) and is the first action in the group.
6. With no platform session, the primary and dashboard CTAs link through `/auth/login?returnTo=...` (upgrade page / dashboard respectively); with a session, they link directly.
7. Mode cards render only after password setup completes (or when not required); the password-setup form is unchanged.
8. No horizontal overflow at 320px; cards stack on mobile and sit three-across on desktop in the widened container.
9. Backend change (options embedded in the accept response) passes `pnpm checkapi`; frontend passes `pnpm checkweb`.

## Related documents

- `docs/PLATFORM_STRATEGY_V3.md` — tier hierarchy and presence-mode strategy
- `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md` — progressive upgrade ladder from `directory_presence` (§6.2 superseded by this spec for the claim-success screen)
- `.devin/skills/tier-hierarchy.md` — V3.1 tier ordering and recommended CTA defaults
- `.devin/skills/directory-presence-seed-claim` — seed/claim workflow and free-tier capabilities
- `.devin/skills/capability-architecture-platform-engine.md` — capability-based gating principles
- `apps/web/src/components/dashboard/TierUpgradeCard.tsx` — dashboard-side handoff for gateway tenants; align copy as a follow-up
