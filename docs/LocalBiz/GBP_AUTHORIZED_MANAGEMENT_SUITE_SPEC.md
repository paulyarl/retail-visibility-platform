# Google Business Profile (GBP) Authorized Management Suite & Prospect-to-Tenant Conversion Engine

**Document:** Functional Specification & Architecture Blueprint  
**Status:** Draft v3 — v1 scope narrowed to emerging single-location merchants; multi-location deferred to a UX-layer expansion (no schema change required) · **Owner:** Product & Engineering · **Date:** 2026-08-23  
**Current-State Baseline:** §11 records the verified implementation audit (2026-08-23). All §7 schema work is **extension of existing models** (`gbp_locations_list`, `gbp_posts`, `gbp_reviews`, `gbp_media` already exist), not greenfield.  
**Target Codebase:** `apps/api` (Backend / Express / Prisma), `apps/web` (Frontend / Next.js App Router)  
**Referenced Platform Specs:** 
- `docs/LocalBiz/PLATFORM_OFFERING_ARCHITECTURE.md`
- `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`
- `docs/LocalBiz/INTAKE_PORTAL_GENERALIZATION_PLAN.md`
- `docs/CAPABILITY_BASED_TIER_GATING.md`

**Referenced Platform Skills (`.devin/skills/`):**
- `google-integration-and-demo-qr.md` — Tabbed Google integration dashboard & demo QR analytics
- `directory-presence-seed-claim/SKILL.md` — `directory_presence` seed listing claim & NAP provenance
- `marketing-ops-scope-aware-campaigns.md` — Scope model & stage machines (`REVIEW_TRANSITIONS`, `RECOVERY_TRANSITIONS`)
- `multi-archetype-campaigns` — Sibling campaigns, multi-diagnostic gallery tokens, and prospect grouping
- `marketing-ops-category-tone.md` — Category tone injection for automated outreach and response drafting
- `diagnostic-gallery-user-guide.md` — Interactive diagnostic gallery & short URL resolution (`/g/{shortCode}`)
- `three-tier-feature-gating.md` — Flexible vs. explicit vs. BSaaS purchasable capability gating
- `bsaas-purchase-flow.md` & `bsaas-coupons-private-features.md` — Repeat checkout & wallet coupon redemption
- `alerts-and-notifications.md` — Context-gated CRM alerts (`mkt_broadcast`, `mkt_direct`, `mkt_campaign`)

---

## 1. Executive Summary & Strategic Vision

### 1.1 The Business Problem
Small and medium local retail and service businesses ("SMBs") suffer from severe digital visibility decay:
1. **Unanswered & Negative Reviews:** Over 75% of SMBs fail to respond to customer reviews within 48 hours, suppressing local 3-pack map ranking and eroding consumer trust.
2. **Stale Google Local Posts:** Google posts lose organic placement after 7–14 days. SMBs lack automated tooling to keep fresh offers and event announcements active.
3. **NAP & Attribute Discrepancies:** Inconsistent business hours, missing holiday schedules, and wrong primary/secondary categories cause dropped rank in competitive local search packs.
4. **Disconnected Product Catalogues:** Local searchers looking for items "near me" cannot see live in-store inventory because POS systems are decoupled from Google surfaces.

### 1.2 The Platform Opportunity
This platform is architected with a rare dual capability:
1. **Outbound Diagnostic & Acquisition Engine (Marketing Ops):** Automated audits, Gold Standard category benchmarking (`IntelligenceProfileService`), registry-driven evidence intake (`DisputeIntakeService`), and interactive diagnostic galleries (`DiagnosticGalleryService`).
2. **Multi-Tenant Local Commerce Platform (SaaS Core):** Encrypted OAuth credential vaults (`google_oauth_accounts_list`), layered capability gating (`isGBPSyncAllowed`, `isGMCSyncAllowed`), POS synchronization (Square, Clover), and Google Merchant Center product sync (`GMCProductSync`).

By productizing an **Authorized Third-Party Google Business Profile Management Suite**, the platform creates an automated **Prospect-to-Tenant Conversion Engine**:
* **Entry:** Prospects are diagnosed via automated Gold Standard scans and purchase an audit or profile fix.
* **Bridge:** Customers claim their marketing deliverables, enter the Customer Portal, and authenticate their Google Business Profile with one click.
* **Retention:** Customers subscribe to ongoing automated review responses, post publishing, and NAP protection.
* **Expansion (Tenant Conversion):** When merchants seek to display local in-store inventory and sync POS data to Google Shopping, the platform upgrades them to full **Retail Visibility SaaS Tenants**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGE 1: PROSPECT ACQUISITION                             │
│   Automated Gold Standard Audit ──► Diagnostic Gallery ──► One-Time Fix / Recovery     │
│   (Skills: marketing-ops-scope-aware-campaigns, diagnostic-gallery-user-guide)         │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           STAGE 2: CUSTOMER PORTAL & GBP AUTH                          │
│   Claim Account ──► In-App Google OAuth 2.0 ──► Auto Verification & Baseline NAP Sync  │
│   (Skills: directory-presence-seed-claim, google-integration-and-demo-qr)              │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        STAGE 3: RECURRING GBP MANAGEMENT SUITE                         │
│   • AI Review Responder & Alerting     • Scheduled Local Posts (Offers & Events)       │
│   • Categorized Photo Sync             • Holiday Hours & Attribute Guardian            │
│   (Skills: marketing-ops-category-tone, alerts-and-notifications, three-tier-gating)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   STAGE 4: FULL TENANT UPGRADE (Retail Visibility SaaS)                │
│   Connect POS (Clover/Square) ──► GMC Product Sync ──► "See What's in Store" Live Feeds│
│   (Skills: bsaas-purchase-flow, google-integration-and-demo-qr)                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 v1 Target Segment — Emerging Single-Location Merchants

**Scope decision (v3):** v1 of the GBP Management Suite targets **emerging, single-location local merchants** — owner-operators who have neither the time nor the staff to manage their Google Business Profile manually. Multi-location merchants (chains, multi-store cafés, franchisees with N locations) are an explicit **post-v1** target.

This is not a "start narrow to limit risk" decision; it is the **highest product-fit** decision:

1. **Highest value-per-merchant fit.** Automated review response + post scheduling delivers the most value to owners with no team. Multi-location merchants typically already have an agency or in-house capacity — the value curve is steeper at the small end.
2. **Verification flow (Subsystem 1) is most valuable for unverified listings.** Overwhelmingly a single-location emerging-business problem. Multi-location merchants have usually already claimed all their GBPs (table stakes for a chain).
3. **Conversion engine thesis is cleanest single-location.** Prospect audit → claim → GBP suite → tenant upgrade is a straight line. Multi-location introduces portfolio-level questions (which location first? per-location vs. portfolio subscription? bulk pricing?) that complicate monetization *before* the core operation is proven.
4. **The riskiest unknown is the identity bridge + verification flow.** That complexity is identical for 1 vs. N locations, but the *failure modes* multiply with N. Nail it on 1 first.
5. **`directory_presence` seed → `independent` flip machinery is purpose-built for the unverified single-listing case.** Building emerging-first means building *with* the grain of existing machinery, not against it.
6. **Google's GBP API is per-location anyway.** Every operation targets a `locationId`. The service layer doesn't change between 1 and N — what changes is portal UX (location switcher) and entitlement math. The *backend cost* of deferring multi-location is near zero; the *operational complexity* of supporting it now is real.

**Multi-location deferral is a UX-layer expansion, not a schema change.** The bridge model in §7 (migration 241) is **customer ↔ tenant**, not customer ↔ location — a tenant may own N `gbp_locations_list` rows. v1 portal surfaces `locations[0]`; post-v1 adds a location switcher. No migration is required to add multi-location support, only portal UI and (optionally) per-location entitlements.

**What v1 explicitly does not build:**
- Multi-location portal UX (location switcher, per-location dashboards)
- Tier B autopilot review replies (deferred past Phase 2 pending Tier A draft-quality validation — see §4 Subsystem 2 and §9 Phase 2.5)
- POS / GMC upsell flow (Phase 4; many emerging merchants will never need it — the platform should not force them up the ladder)
- Google Cloud Pub/Sub review ingestion (cron is sufficient for single-location volume)

---

## 2. Platform Skill Alignment & Connective Tissues

The table below maps the platform's registered architectural skills directly to the GBP Management Suite components:

| Platform Skill (`.devin/skills/`) | Architectural Function in Platform | Role in GBP Management Suite & Conversion Engine |
| :--- | :--- | :--- |
| `google-integration-and-demo-qr.md` | Tabbed dashboard pattern (`Overview`, `Products`, `BusinessProfile`, `Settings`), hero tenant capability resolution, and demo QR tracking. | **GBP Merchant Dashboard:** Directly informs the UI tab structure under `/account/marketing/gbp/` and `/settings/integrations/google/` (both build targets — neither page tree exists yet). Reuses the container + tab component pattern. |
| `directory-presence-seed-claim` | `directory_presence` light tier (`org_standing_mode = 'directory_seed'`), public directory claim flow, NAP provenance. | **Seed & Claim Funnel:** Unclaimed GBP listings can be ingested as `directory_presence` seed tenants; on claim, flips to `org_standing_mode = 'independent'` and triggers GBP OAuth verification. |
| `marketing-ops-scope-aware-campaigns` | Scope model (`business` \| `category` \| `city`) $\times$ Stage machines (`REVIEW_TRANSITIONS`, `RECOVERY_TRANSITIONS`). | **Pipeline Dispatch:** Drives GBP recovery vs. ongoing review management workflows and manages prompt variable injection per scope. |
| `multi-archetype-campaigns` | Multi-archetype cycling, sibling campaigns, and multi-diagnostic gallery tokens. | **Prospect Grouping:** Groups multi-location prospects and cycles from audit deliverable $\rightarrow$ GBP repair $\rightarrow$ review management. |
| `marketing-ops-category-tone` | Category tone resolution (Professional, Warm, Medical, Culinary, etc.). | **AI Review Responder:** Injects category-specific tone guidelines into LLM review response drafting for authentic local brand voice. |
| `diagnostic-gallery-user-guide` | Interactive side-by-side gap analysis and short URLs (`/g/{shortCode}`). | **Conversion Entry Point:** Delivers the interactive diagnostic audit showing competitors' Gold Standard vs. prospect's live GBP gaps with 1-click fix CTA. |
| `three-tier-feature-gating` | 3-tier capability gating (Flexible, Explicit, BSaaS purchasable) via `EffectiveCapabilityResolver`. | **Monetization Gates:** Gates GBP features (`gbp_ai_response`, `gbp_posts_scheduler`, `gmc_sync`) across subscription plans and self-serve add-ons. |
| `bsaas-purchase-flow` & `bsaas-coupons-private-features` | Saved card-on-file charges, SCA interactive fallbacks, wallet coupons. | **Repeat Billing:** Drives in-portal subscription checkout for GBP maintenance retainers and coupon redemption. |
| `alerts-and-notifications` | Signal-gated CRM alerts (`mkt_broadcast`, `mkt_direct`, `mkt_campaign`) and badge polling. | **Merchant Action Notifications:** Sends real-time alerts for negative reviews, post expirations, and Google verification milestones. |

> **Skill location note (verified 2026-08-23):** every referenced skill exists. `multi-archetype-campaigns` resolves at `.agents/skills/multi-archetype-campaigns/SKILL.md`; all others resolve under `.devin/skills/`.

---

## 3. Existing Codebase Connective Tissues

```
apps/api/src/
├── routes/
│   ├── google-business-oauth.ts      ◄── Tenant OAuth flow + 30 GBP mgmt endpoints (/api/google/business)
│   ├── marketing-customer.ts         ◄── Authenticated customer portal endpoints (/api/customer/marketing/*)
│   ├── marketing-ops.ts              ◄── Admin campaign, discovery, and diagnostic management
│   └── directory-presence-public.ts  ◄── Public seed claim endpoints (/api/public/directory/*)
├── lib/google/
│   └── capability-gate.ts            ◄── isGBPSyncAllowed / isGMCSyncAllowed (async, resolver-backed)
├── services/
│   ├── GBPBusinessInfoSync.ts        ◄── NAP, categories, regular + special/holiday hours, read-back & conflict compare
│   ├── GBPAdvancedSync.ts            ◄── Media CRUD (13 categories), Local Posts CRUD (STANDARD/EVENT/OFFER),
│   │                                     Reviews list/reply/delete-reply, Attributes CRUD
│   ├── GMCProductSync.ts             ◄── POS-to-Google Merchant Center product sync (variants, inventory, price)
│   ├── MarketingCategoryToneService.ts ◄── Category tone preset CRUD (input to the AI reply engine)
│   ├── CrmAlertService.ts            ◄── CRM alerts (order / abandoned_cart / featured_placement / app_store / mkt_*)
│   ├── MarketingCustomerService.ts   ◄── Portal claim token consumption & sweep logic
│   ├── DisputeIntakeService.ts       ◄── Registry-driven intake & write-behind adapters
│   ├── EffectiveCapabilityResolver.ts◄── Dynamic capability & tier resolution
│   └── intelligence/
│       └── IntelligenceProfileService.ts ◄── Gold standard benchmarking & gap discovery
├── jobs/
│   ├── gbpHoursSync.ts / gbpCategorySync.ts ◄── Existing scheduled GBP jobs (pattern for new ingestion jobs)
│   └── review-response-scheduler.ts  ◄── Internal response-pipeline scheduler (NOT GBP review ingestion)
apps/web/src/
├── app/
│   ├── (platform)/settings/tenant/   ◄── Hosts GoogleConnectCard (behind FF_GOOGLE_CONNECT_SUITE)
│   ├── account/marketing/            ◄── Authenticated customer portal (NO GBP surfaces yet — build target)
│   └── marketing/pay/                ◄── Public payment & card save flow
├── components/google/
│   └── GoogleConnectCard.tsx         ◄── Unified Google connect card (Merchant Center + GBP status)
└── services/
    ├── GoogleIntegrationService.ts   ◄── Tenant-side GBP reviews / sync / OAuth client
    └── GBPCategoryService.ts         ◄── Tenant GBP category mappings
```

**Verified corrections (2026-08-23 audit):**
- The Prisma models `gbp_locations_list`, `gbp_posts`, `gbp_reviews`, and `gbp_media` **already exist** (`apps/api/prisma/schema.prisma`, lines 1933–2021). §7 defines *extensions* to these models via migrations 237–241, not greenfield additions.
- `apps/web/src/app/(platform)/settings/integrations/google/` does **not** exist. The tabbed dashboard pattern from `google-integration-and-demo-qr.md` is a **build target**, not an existing page tree; today the tenant surface is the single `GoogleConnectCard` embedded in tenant settings.

---

## 4. Functional Architecture & Subsystems

```
                                ┌─────────────────────────────────────────┐
                                │          MERCHANT / OPERATOR UX         │
                                │   (Customer Portal & Tenant Dashboard)  │
                                └────────────────────┬────────────────────┘
                                                     │
                                                     ▼
                                ┌─────────────────────────────────────────┐
                                │       GBP MANAGEMENT CONTROLLER         │
                                │    (/api/customer/marketing/gbp/*)     │
                                └────────────────────┬────────────────────┘
                                                     │
          ┌──────────────────────────┬───────────────┴──────────────┬──────────────────────────┐
          ▼                          ▼                              ▼                          ▼
┌───────────────────┐      ┌───────────────────┐          ┌───────────────────┐      ┌───────────────────┐
│ 1. VERIFICATION   │      │ 2. REPUTATION &   │          │ 3. CONTENT &      │      │ 4. LISTING &      │
│ & CLAIMING        │      │ REVIEWS ENGINE    │          │ LOCAL POSTS       │      │ ATTRIBUTES        │
├───────────────────┤      ├───────────────────┤          ├───────────────────┤      ├───────────────────┤
│ • VoiceOfMerchant │      │ • Real-time Sync  │          │ • What's New Post │      │ • Core NAP Sync   │
│ • Fetch Options   │      │ • AI Draft/Reply  │          │ • Offer / Coupon  │      │ • Category Tuning │
│ • Trigger Verify  │      │ • Dispute Handoff │          │ • Event Sched     │      │ • Holiday Hours   │
│ • PIN Completion  │      │ • Sentiment Stats │          │ • Media Manager   │      │ • Service Areas   │
└─────────┬─────────┘      └─────────┬─────────┘          └─────────┬─────────┘      └─────────┬─────────┘
          │                          │                              │                          │
          └──────────────────────────┼──────────────────────────────┴──────────────────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │ CAPABILITY & TIER GATE  │
                        │ (isGBPSyncAllowed, RBAC)│
                        └────────────┬────────────┘
                                     ▼
                        ┌─────────────────────────┐
                        │ GOOGLE BUSINESS API v4  │
                        │ & MY BUSINESS REST v1   │
                        └─────────────────────────┘
```

---

### Subsystem 0: Customer → Tenant → GBP Identity Bridge (PREREQUISITE)
*(New — identified as the blocking gap in the 2026-08-23 audit; every §8 endpoint depends on it)*

**Problem (verified):** all existing GBP infrastructure is **tenant-scoped** — `google_oauth_accounts_list.tenant_id` owns the OAuth grant, and `gbp_locations_list` hangs off `account_id` (it has **no `tenant_id` column**). Marketing customers, by contrast, are **platform-scoped**: they authenticate with a customer JWT and pass `requirePlatformContext`, which computes contexts from marketing purchases. No mapping exists from a claimed marketing customer to the tenant row that owns a GBP OAuth account, and the §8 endpoint contract cannot be implemented until one does.

#### Design:
1. **Lightweight tenant provisioning:** when a marketing customer claims a campaign whose deliverable scope includes GBP management (or purchases any GBP-bearing SKU), the platform provisions — or reuses — a lightweight tenant row for the business. This reuses the existing `directory_presence` seed machinery: seed tenants carry `tenants.org_standing_mode = 'directory_seed'` and elevate to `'independent'` on claim/verification (see Subsystem 1, step 5).
2. **Mapping table `mkt_customer_gbp_links` (migration 241, §7):** records `(customer_id, tenant_id, origin_campaign_id)` — a **customer ↔ tenant** bridge, *not* customer ↔ location. The customer's GBP locations are whatever `gbp_locations_list` rows belong to the resolved tenant (via the `tenant_id` denormalized in migration 237). v1 merchants have exactly one location; post-v1 multi-location merchants have N — same code path, no migration required to add the second. Keeping `gbp_location_id` off the bridge avoids a single nullable FK that would preclude multi-location cleanly and a future unique-constraint change.
3. **Resolution service `CustomerGBPAccessService`:**
   * `resolveTenant(customerId)` → `{ tenantId }` — the **bridge entry point** used by every `/api/customer/marketing/gbp/*` handler. Enforces `requirePlatformContext` first, then proves the customer↔tenant link via `mkt_customer_gbp_links` (404 on foreign resources, matching the cross-customer isolation contract already tested in `marketing-customer-routes.test.ts`).
   * `resolveLocations(customerId)` → `gbp_locations_list[]` — all locations owned by the resolved tenant. v1 returns exactly one row; post-v1 returns N. Used by handlers that list or aggregate across locations (e.g. `/reviews`, `/posts`, `/media`).
   * `resolveLocation(customerId)` → v1 convenience wrapper: returns `locations[0]` or 404 with a `single_location_expected` code if the tenant owns >1 location (post-v1 callers must use `resolveLocations` and a location switcher). Used by handlers that are inherently per-location in v1 (verification, single-post CRUD).
4. **Capability evaluation** (`isGBPSyncAllowed`, feature gates) runs against the **resolved tenant**, keeping the existing three-tier resolver untouched.
5. **OAuth unification:** the in-portal "Connect with Google" CTA initiates the *existing* tenant OAuth flow (`GET /api/google/business`) against the provisioned tenant, then records the link row on callback success. No parallel OAuth stack is introduced.
6. **Denormalized `tenant_id` invariant (migration 237):** `gbp_locations_list.tenant_id` is backfilled from `google_oauth_accounts_list.tenant_id`. If a tenant's OAuth account row ever changes ownership (rare, but possible on re-auth), the denormalized column drifts. `CustomerGBPAccessService.resolveLocations` reconciles on read: if `gbp_locations_list.tenant_id` disagrees with the owning `google_oauth_accounts_list.tenant_id`, it logs a `gbp_tenant_drift` warning and rewrites the row in-band. This closes the invariant without a DB trigger.

---

### Subsystem 1: In-App Verification & Claiming Engine
*(Aligned with `directory-presence-seed-claim` & `google-integration-and-demo-qr`)*

**Goal:** Allow merchants to verify and claim their Google Business Profile directly within the platform without redirecting to Google's complex native interface.

#### Functional Workflow:
1. **Voice of Merchant Status Check:**
   * Invoke `accounts.locations.getVoiceOfMerchantState` to determine whether the location is unverified (`gain_voice_of_merchant: verify`), pending review, or verified (`hasVoiceOfMerchant: true`).
2. **Verification Options Discovery:**
   * Call `locations.fetchVerificationOptions` to retrieve available methods for that location (`SMS`, `PHONE_CALL`, `EMAIL`, `ADDRESS` postcard, or `AUTO`).
3. **Verification Triggering:**
   * Execute `locations.verify` with the merchant-selected verification option.
4. **PIN Ingestion & Completion:**
   * When an SMS/phone/postcard PIN is received by the business owner, render a high-visibility PIN entry dialog in the Customer Portal that executes `locations.verifications.complete`.
5. **Seed-to-Independent Elevation:**
   * If the business entered as a `directory_presence` seed tenant (`org_standing_mode = 'directory_seed'`), successful verification automatically flips the standing mode to `independent`.

#### Current Baseline & Build Delta (verified 2026-08-23):
* **Baseline:** `hasVoiceOfMerchant` is already read from location metadata (`GBPBusinessInfoSync.ts` read-back path) and surfaced in tenant sync status. The `org_standing_mode` column exists on `tenants` with the `directory_seed` → `independent` claim machinery live.
* **Build — `GBPVerificationService` (new, `apps/api/src/services/GBPVerificationService.ts`):** wraps the three Google verification APIs (`fetchVerificationOptions`, `verify`, `verifications.complete`) behind tenant-scoped token access; persists state to the new `gbp_locations_list.verification_state` + `voice_of_merchant` cache columns (migration 237, §7).
* **Build — state machine:** `UNVERIFIED → PENDING → COMPLETED | FAILED`, transitioned only by service methods; on `COMPLETED`, fires the standing-mode elevation and a `gbp_verification_milestone` alert via `CrmAlertService` (Subsystem 2 alert plumbing).
* **Build — UI:** verification status indicator + high-visibility PIN entry dialog in the Customer Portal (`/account/marketing/gbp/`), per §8 endpoints.

---

### Subsystem 2: Review Intelligence & AI Auto-Responder
*(Aligned with `marketing-ops-category-tone`, `alerts-and-notifications`, and `DisputeIntakeService`)*

**Goal:** Automate review monitoring, sentiment classification, and contextual AI response drafting/auto-publishing.

#### Functional Workflow:
1. **Continuous Ingestion & Notifications:**
   * Ingest reviews via `accounts.locations.reviews.list` and `batchGetReviews` (via cron or Google Cloud Pub/Sub push webhooks).
   * Dispatch real-time unread alert badges via `alerts-and-notifications` when new reviews arrive.
2. **Sentiment & Intent Tagging:**
   * Every incoming review is parsed for sentiment (1–5 stars, positive/neutral/negative intent, highlighted keywords).
3. **Tone-Aware AI Reply Engine:**
   * **Behavioral character — response timing (v3):** responses will **not** have an explicit fixed time-to-respond. No "respond immediately" or "respond after exactly 2 minutes" or "respond within 15 minutes" hard deadlines. A fixed cadence is itself a signal of automation and erodes the authenticity the engine is designed to preserve. Instead, responses are timed within a **dynamic window** (e.g., between immediate and up to 15 minutes) whose exact bounds are determined later — potentially randomized, potentially influenced by review sentiment, time of day, or merchant activity patterns. The window is a tunable parameter, not a hardcoded constant. This applies to both Tier A (merchant approval timing is merchant-driven, but the *draft availability* is within the dynamic window) and Tier B (autopilot posting occurs within the dynamic window, not at a fixed offset).
   * **Tone source hierarchy (v3):** the merchant's voice is captured during seek campaigns + intelligence capture by the operator — by the time the merchant claims their account and enters the portal, their voice profile already exists. The GBP reply engine is *not* starting from scratch; it builds on the intelligence profile already constructed during the prospect/seek phase.
     1. **Primary — Owner voice profile** (`OwnerVoiceService.getProfile`): the merchant's actual writing voice (person, formality, humor, apology style, signoff, signature) inferred from their existing review responses during intelligence capture.
     2. **Secondary — Category tone preset** (`MarketingCategoryToneService.getPresetByCategory`): augments owner voice with category-specific nuances (e.g., "Culinary Casual" adds food-specific warmth on top of the owner's base voice; "Professional Reassuring" adds clinical calmness).
     3. **Fallback — Campaign tone** (`campaign.tone`): used if owner voice profile is thin or category preset is missing.
   * **Tier A (Human-in-the-Loop) — v1 surface:** Generates 3 contextual response drafts in the Customer Portal for one-click approval. Drafts must be grounded in review-specific signals (reviewer name, star rating, any minimal comment text, time of visit when available) — *not* generic "thanks for the 5 stars" templates — to stay clear of Google's review-response authenticity guidance.
   * **Tier A prompt design (v3):** single LLM call producing 3 drafts, each with a different angle, all in the merchant's voice:
     ```
     Prompt inputs:
       ├── Owner voice profile (OwnerVoiceService — PRIMARY, captured during seek/intelligence)
       ├── Category tone preset (MarketingCategoryToneService — SECONDARY, augments voice)
       ├── Business context (resolved location: name, category, city, state, phone, website)
       └── Review signals (reviewer name, star rating, comment text, review time)

     Output: 3 drafts, each ≤80 words, each with a different angle:
       ├── Draft 1: Warm + direct (acknowledge + fix/thanks + invite back)
       ├── Draft 2: Professional + concise (acknowledge + fix/thanks, minimal words)
       └── Draft 3: Empathetic + detailed (acknowledge + personal touch + fix/thanks)
     ```
     Single call (not 3 calls) for efficiency: 3 LLM calls per review is 3x latency and 3x cost. The LLM sees all three angles in context and differentiates them.
   * **Tier A sentiment-aware drafting rules (embedded in the prompt):**
     | Star rating | Comment? | Draft strategy |
     | :--- | :--- | :--- |
     | 5★ | With comment | Gratitude + specific reference to what they praised |
     | 5★ | No comment | Genuine thanks + business name + category touch (not generic "thanks for 5 stars") |
     | 3-4★ | With comment | Acknowledge feedback + mention improvement + invite back |
     | 1-2★ | With comment | Apologize + name the fix + **offline redirect** ("Please reach us at [phone]") + never argue publicly |
     | 1-2★ | No comment | Apologize + **offline redirect** + never argue publicly |
   * **Tier A category-specific guardrails (embedded in the prompt):**
     - Medical/health categories: never discuss health details publicly, always redirect offline
     - Legal categories: never discuss case details publicly
     - Food/restaurant: can reference menu items, service experience
     - Retail: can reference product categories, staff help
   * **Relationship to existing services:** the *pattern* (tone + business context + review signals → LLM) is reused from `ReviewSlotService` (deliverable construction), but the *template* is new — different input shape (live GBP review vs. audit deliverable review), different output (3 drafts vs. 1), different primary tone source (owner voice + category tone vs. owner voice + campaign tone). Extracting a shared prompt builder is possible but the inputs diverge enough that a dedicated `buildGbpReviewReplyPrompt` in a new `apps/api/src/services/gbp/prompts.ts` is cleaner.
   * **Tier B (Auto-Pilot) — deferred to Phase 2.5:** Automatically posts polite thank-you replies to 5-star reviews without comments within the dynamic response window (see behavioral character above), while holding $\le 3$-star reviews for human review. **Not shipped in Phase 2.** Tier B is gated on (a) Tier A drafts having been approved by real merchants in production for at least one review cycle, (b) a prompt-design review confirming autopilot replies meet Google's authenticity bar, and (c) the `gbp_ai_response` entitlement being live (Phase 4). Shipping Tier B before Tier A quality is validated risks Google flagging templated 5★-no-comment auto-replies as inauthentic engagement.
4. **Dispute & Policy Violation Bridge:**
   * Negative reviews containing profanity, competitor conflict, or off-topic spam offer a 1-click **"Dispute via Platform"** action that routes the review into the existing `DisputeIntakeService` workflow.

#### Current Baseline & Build Delta (verified 2026-08-23):
* **Baseline:** tenant-side review primitives exist — `GBPAdvancedSync.listReviews` (paginated), `replyToReview`, `deleteReviewReply`. `MarketingCategoryToneService` provides category tone presets. `ReviewSlotService` already does sentiment tagging + AI response drafting, but only against internal audit deliverables — it never touches live GBP reviews. `CrmAlertService` is fully operational with `mkt_direct` / `mkt_campaign` targeting.
* **Build — ingestion:** new cron job `apps/api/src/jobs/gbpReviewIngestion.ts` (modeled on `gbpHoursSync.ts`) polls `reviews.list` per linked location and upserts into `gbp_reviews` (extended in migration 238 with `location_id`, `sentiment`, `reply_status`, `ai_drafts`). On each poll, also refreshes `gbp_locations_list.cached_average_rating` + `cached_review_count` + `rating_cache_updated` from the `averageRating` / `totalReviewCount` fields Google returns alongside the review list — so the GBP dashboard summary card can show "4.5 ★ (127 reviews)" without calling the Google API on every page load. Google Cloud Pub/Sub push is a later optimization, not a v1 dependency. `batchGetReviews` is out of scope for v1 (single-location customers).
* **Build — `GBPReviewReplyService` (new):** connects the existing pieces — GBP review rows → owner voice profile (`OwnerVoiceService.getProfile`, captured during seek/intelligence — PRIMARY tone source) → category tone preset (`MarketingCategoryToneService.getPresetByCategory` — SECONDARY, augments voice) → business context (resolved location) → LLM drafting (pattern from `ReviewSlotService`, new template in `apps/api/src/services/gbp/prompts.ts`) — producing Tier A drafts (3 angle-variants per review, stored in `gbp_reviews.ai_drafts` as `[{ text, tone, generated_at }]`, `reply_status = 'AI_DRAFTED'`). **Tier B autopilot is implemented as a separate method (`runAutopilot`) but is NOT invoked by any Phase 2 job** — it is called only by the Phase 2.5 autopilot job once the quality gates in §4 Subsystem 2 step 3 are met. The `gbp_ai_response` feature key (§6) gates both Tier A draft generation and Tier B autopilot at the entitlement layer; the Phase 2.5 quality gate is an *operational* gate on top of the entitlement gate.
* **Build — alerts:** on ingestion, new reviews fire `CrmAlertService.create()` with type `gbp_new_review` (`mkt_direct` targeting); negative reviews are high-priority. Post-expiry and verification alerts reuse the same channel (Subsystems 1 & 3).
* **Build — dispute bridge:** "Dispute via Platform" creates an `mkt_dispute_intake` row with `intake_kind = 'review_dispute'` (registry-driven per `INTAKE_PORTAL_GENERALIZATION_PLAN.md`), carrying `platform_review_id` in `evidence_payload` so the existing 1:N intake + write-behind machinery is reused unchanged.

---

### Subsystem 3: Local Posts & Promotional Campaign Publisher
*(Aligned with `bsaas-coupons-private-features` & `funnel-coupon-offer-convergence`)*

**Goal:** Keep the merchant's Google Maps pin ranked high by maintaining continuous, active Google Local Posts.

#### Functional Workflow:
1. **Post Types Supported:**
   * **Standard ("What's New"):** Text summary (up to 1,500 chars), photo attachment, and CTA button (`CALL`, `LEARN_MORE`, `BOOK`, `ORDER`, `SHOP`).
   * **Offer:** Promotion title, validity date range, coupon code, redemption URL, terms & conditions. Integrates with the platform's short-link coupon engine (`/s/{autoId}`).
   * **Event:** Event title, start/end date and time, photo, action button.
2. **Post Scheduler & Queuing:**
   * Calendar-based queue that auto-schedules posts at optimal engagement intervals (e.g., every Tuesday and Friday morning).
3. **Seasonal Template Packs:**
   * Pre-built niche post templates that auto-fill business details, seasonal promotions, and wallet coupon offers.

#### Current Baseline & Build Delta (verified 2026-08-23):
* **Baseline:** tenant-side post CRUD exists — `GBPAdvancedSync.createPost` supports all three `topic_type`s (`STANDARD` / `EVENT` / `OFFER`) with CTA buttons, and `listPosts` / `deletePost` are live. The coupon short-link engine (`/s/{autoId}`) and wallet coupons (Phase 3 portal checkout) are live.
* **Build — lifecycle & scheduler:** extend `gbp_posts` (migration 239) with `status` (`DRAFT | SCHEDULED | PUBLISHED | FAILED`), `scheduled_for`, `published_at`, `location_id`, `post_name`. New job `apps/api/src/jobs/gbpPostScheduler.ts` publishes `SCHEDULED` rows whose `scheduled_for <= now()` via the existing `createPost`, then marks state. Scheduling is gated by the new `gbp_posts_scheduler` feature key (§6).
* **Build — offer/coupon wiring:** Offer posts set `offer_json.redeemOnlineUrl` to the platform coupon short link (`/s/{autoId}`) so GBP redemptions land in the existing wallet/QR funnel.
* **Build — seasonal template packs:** stored as a static template registry (category-keyed JSON, same niche-override pattern as `mkt_intake_definitions.niche_overrides`); composer pre-fills business details + active wallet coupons.
* **Constraint note:** Google's My Business API v4 does not support patching a live local post — "edit" is implemented as delete + recreate; the UI should present it as such.

---

### Subsystem 4: Media & Visual Asset Optimization
*(Aligned with `diagnostic-gallery-user-guide` & `IntelligenceProfileService`)*

**Goal:** Optimize visual engagement by managing cover photos, logos, interior/exterior shots, and product galleries.

#### Functional Workflow:
1. **Category-Compliant Uploads:**
   * Implements two-step binary upload (`media:startUpload` + byte streaming) supporting Google's required categories: `COVER`, `PROFILE`, `LOGO`, `EXTERIOR`, `INTERIOR`, `PRODUCT`, `AT_WORK`, `FOOD_AND_DRINK`.
2. **Diagnostic Gallery Handoff:**
   * Deliverable images from the Diagnostic Gallery (`/g/{shortCode}`) can be published directly to live GBP media with one click.
3. **Photo Health Benchmark:**
   * Compares total photo count against the category Gold Standard benchmark (e.g., *"Top 3 competitors in your city have 142 photos; you have 18"*) to guide owner photo uploads.

#### Current Baseline & Build Delta (verified 2026-08-23):
* **Baseline:** `GBPAdvancedSync.listMedia` / `uploadPhoto` / `deleteMedia` exist with all 13 Google media categories (`COVER`, `PROFILE`, `LOGO`, `EXTERIOR`, `INTERIOR`, `PRODUCT`, `AT_WORK`, `FOOD_AND_DRINK`, `MENU`, `COMMON_AREA`, `ROOMS`, `TEAMS`, `ADDITIONAL`). `IntelligenceProfileService` already produces Gold Standard benchmarks for audits.
* **Build — two-step binary upload:** `uploadPhoto` is currently single-step (`sourceUrl` only). Add `uploadPhotoBinary` implementing `media:startUpload` → byte streaming → attach, for direct device uploads from the portal.
* **Build — gallery handoff:** publish endpoint that copies a Diagnostic Gallery deliverable image (`/g/{shortCode}` resolved via the existing short-code service) into GBP media in one click.
* **Build — benchmark surface:** compute photo-count gap from `IntelligenceProfileService` category benchmark + `listMedia` count; render on the GBP dashboard summary card.
* **Deferred:** `gbp_media.view_count` (migration 240 adds the column) — Google deprecated the historical insights endpoint used for per-photo views; populate only if the replacement Performance API proves viable, otherwise leave null.

---

### Subsystem 5: Listing & NAP Guardian
*(Aligned with `GBPBusinessInfoSync` & `business-analysis.schema`)*

**Goal:** Maintain perfect NAP consistency and prevent unauthorized external overrides or stale operating hours.

#### Functional Workflow:
1. **Core Data Sync:**
   * Bidirectional sync for Name, Address, Primary Phone, Additional Phones, Website URL, and Description using `GBPBusinessInfoSync.ts`.
2. **Category Optimizer:**
   * Aligns primary and secondary G-Categories with Google taxonomy recommendations identified during the Intelligence Discovery scan.
3. **Special & Holiday Hours Scheduler:**
   * Single-click application of upcoming holiday hours (Thanksgiving, Christmas, New Year's) to prevent Google Maps "Hours might differ" warning flags.

#### Current Baseline & Build Delta (verified 2026-08-23):
* **Baseline — strongest area (~75% built, tenant-side):** `GBPBusinessInfoSync` already covers name, phone, website, address, description, primary + secondary categories, regular hours (`syncBusinessHours` from `business_hours_list`), and **special/holiday hours** (`syncSpecialHours` from `business_hours_special_list`, also run by the `gbpHoursSync.ts` job). Read-back (`readFromGoogle`) and conflict detection (`compareWithGoogle`) exist, plus sync tracking/history endpoints.
* **Build — customer exposure:** all of the above is tenant-keyed today; the portal surfaces it through the Subsystem 0 identity bridge (resolve tenant → call existing services unchanged).
* **Build — Category Optimizer action:** a customer-facing "Apply recommended categories" action that takes the Intelligence Discovery scan's taxonomy recommendation and calls the existing `syncCategories` — closing the loop that today ends at the audit report.
* **Build — one-click holiday presets:** portal UI applies a preset pack (Thanksgiving / Christmas / New Year's) into `business_hours_special_list`, then triggers `syncSpecialHours`; the sync mechanism needs no change.

---

### Subsystem 6: Public Surface Review Surfacing
*(Aligned with `directory-presence-seed-claim`, `alerts-and-notifications`, and the platform's public surfaces)*

**Goal:** Surface live Google GBP reviews, aggregate rating, and owner replies on any platform public surface the merchant appears on — closing the loop from ingestion → response → public display. This is a capability feature of the `gbp_management` module, gated by the `gbp_directory_reviews` feature key (§6.5).

#### Strategic Rationale — Capability-Driven, Surface-Agnostic
GBP Pro features are **tenant-scoped capabilities**, not surface-scoped. A merchant who purchases `gbp_directory_reviews` via the BSaaS app-store activates the capability on their tenant — and **any public surface that resolves to that tenant can consume it**. The platform has multiple public surfaces where a merchant can appear:

| Public Surface | Route | Who appears | Today |
| :--- | :--- | :--- | :--- |
| **Directory entry** | `/directory/[slug]` | Claimed/published tenants | `StoreRatingsSection` (platform-internal reviews only) |
| **Place entry** | `/place/[slug]` | `directory_seed` listings | No reviews section |
| **Shops directory** | `/shops/directory`, `/shops/[slug]` | Tenants with storefronts | No GBP reviews |
| **Shops trending/featured** | `/shops/trending`, `/shops/featured` | Featured tenants | No GBP reviews |
| **Category discovery** | `/category-discovery` | Tenants by category scope | No GBP reviews |

The merchant doesn't choose "put my reviews on the directory" — they choose "activate GBP Pro reviews" via BSaaS, and **whichever paid surface they're on renders the content**. A merchant on the directory gets reviews on their directory entry. A merchant on the place page gets reviews on their place entry. A merchant on shops gets reviews on their shop profile. One purchase, multiple surfaces.

The platform ingests Google reviews via the Subsystem 2 ingestion pipeline, helps the merchant respond via the Tier A/B reply engine, and then — with this subsystem — surfaces the engagement publicly across whatever surfaces the merchant occupies. This creates a visible differentiator for the GBP Pro module: a prospect visiting any surface sees a listing with real Google reviews + owner replies vs. a listing with nothing.

#### Current State (verified 2026-08-23):
* **Directory page** (`/directory/[slug]`) — for claimed/published tenants — already renders `StoreRatingsSection` → `StoreRatingDisplay`, but this shows **platform-internal reviews only** (users write reviews on the platform via `ReviewsSingletonService`). Google GBP reviews are not surfaced.
* **Place page** (`/place/[slug]`) — for `directory_seed` listings — has **no reviews/ratings section at all**.
* **Shops surfaces** (`/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`) — no GBP reviews surfaced.
* **Two review systems exist that don't talk to each other:** (1) platform-internal reviews (user-generated on the platform), (2) Google GBP reviews (ingested into `gbp_reviews` by the Subsystem 2 cron job). This subsystem bridges them on public surfaces.

#### Functional Design:
1. **Public, read-only GBP review endpoint (surface-agnostic):**
   * `GET /api/public/directory/:slug/gbp-reviews` (no auth — public content; see §8.2)
   * Resolves: slug → tenant → `gbp_locations_list` (via `tenant_id`) → `gbp_reviews` (via `location_id`)
   * Returns: `cached_average_rating`, `cached_review_count`, and a paginated list of published reviews with `reviewer_name`, `star_rating`, `comment`, `review_reply`, `google_create_time`
   * **Does NOT expose:** `sentiment`, `reply_status`, `ai_drafts` — these are internal management fields
   * Gated by `gbp_directory_reviews` capability on the resolved tenant (via `publicUnifiedCapabilityService`, already used on public surfaces)
   * **Surface-agnostic:** the endpoint resolves slug → tenant and checks the capability on the tenant. The calling surface (directory, place, shops, discovery) is irrelevant to the data contract — any surface that can resolve a tenant slug can consume the endpoint.
2. **Frontend rendering (reusable across surfaces, two-gate model):**
   * New `GbpReviewsSection` component (separate from `StoreRatingsSection` — different data source, different trust signal). Designed as a **reusable surface component**, not a directory-specific component.
   * Renders on **any public surface** when **both gates pass** (§6.8):
     - **Hard gate:** `gbp_directory_reviews` capability is present on the resolved tenant (tier/purchase/grant — checked via `publicUnifiedCapabilityService`)
     - **Soft gate (merchant gate):** `merchantPreferences.gbp_reviews_display !== false` (merchant has not opted out of display)
   - The merchant controls the display of the purchase — having the capability doesn't force it onto surfaces; the merchant toggles it on/off via tenant settings
   * Initial consumers (Phase 4): `/directory/[slug]` + `/place/[slug]` (highest-value surfaces first)
   * Future consumers: `/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`, `/category-discovery` — no component changes needed, just mount `GbpReviewsSection` on the surface and pass the tenant slug
   * Shows: aggregate rating badge ("4.5 ★ on Google"), review count, top reviews with owner replies
   * **"Reviewed on Google" badge** on each review — distinguishes GBP reviews from platform-internal reviews; important for consumer trust and Google's review display policies
   * **Reply visibility** — the owner's reply is rendered beneath each review. This is the key differentiator: it proves the merchant is actively engaged, which is the value proposition of the GBP Pro module
3. **Coexistence with platform-internal reviews:**
   * Both sections can render on the same surface — they're visually separated and badged differently ("Reviewed on Google" vs. "Community Review")
   * The aggregate rating shown in the page header prioritizes Google's `cached_average_rating` (larger sample) when both exist; platform-internal rating is secondary
4. **No new ingestion needed:**
   * The `gbpReviewIngestion.ts` cron job (Subsystem 2, Phase 2) already populates `gbp_reviews` with structured data
   * The `cached_average_rating` + `cached_review_count` on `gbp_locations_list` (migration 237) already provide the aggregate — no live Google API call on page load

#### Build Delta:
* **Build — public endpoint:** new route in `directory-gbp-public.ts`, registered at `authLevel: 'public'` in `routeRegistry.ts`. Resolves slug → tenant → location → reviews. Capability-gated. Surface-agnostic.
* **Build — `GbpReviewsSection` component:** new `apps/web/src/components/gbp/GbpReviewsSection.tsx` (under `gbp/` not `directory/` — it's surface-agnostic). Fetches from the public endpoint. Renders aggregate rating + review list with replies + "Reviewed on Google" badges.
* **Build — initial surface integration:** mount `GbpReviewsSection` on `/directory/[slug]` (alongside existing `StoreRatingsSection`) and `/place/[slug]` (first reviews surface on the place page). Both gated by capability check.
* **Future surface integration (post-Phase 4):** mount on `/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`, `/category-discovery`. No component changes — just mount + pass tenant slug.
* **No build — ingestion:** reuses `gbpReviewIngestion.ts` (Phase 2) and `cached_average_rating` (migration 237) unchanged.

#### Google Policy Note:
Surfacing Google reviews on a third-party platform is permitted under Google's API terms as long as:
- Reviews are attributed to Google ("Reviewed on Google" badge)
- The content is not modified or misrepresented
- Reviews link back to the original Google listing where feasible

The "Reviewed on Google" badge and the unmodified review text/reply satisfy these requirements.

---

### Subsystem 7: Public Surface Content Surfacing (GBP Posts + Photos)
*(Aligned with `directory-presence-seed-claim`, `diagnostic-gallery-user-guide`, and the platform's public surfaces)*

**Goal:** Surface live Google GBP local posts (offers, events, "what's new") and photos (exterior, interior, products, food) on any platform public surface the merchant appears on — amplifying the merchant's SEO visibility with fresh, keyword-rich content and visual enrichment. This is a capability feature of the `gbp_management` module, gated by the `gbp_directory_content` feature key (§6.5).

#### Strategic Rationale — Same Capability-Driven, Surface-Agnostic Model as Subsystem 6
GBP Pro features are tenant-scoped capabilities. A merchant who purchases `gbp_directory_content` via the BSaaS app-store activates the capability on their tenant — and **any public surface that resolves to that tenant can consume it** (see Subsystem 6 for the full consumer surface list). The merchant doesn't choose "put my posts on the directory" — they choose "activate GBP Pro content" via BSaaS, and whichever paid surface they're on renders the content.

GBP local posts are fresh, time-bound content that Google indexes. Surfacing them on the platform's public surfaces creates cross-domain content amplification — the same post appears on both Google and the platform, doubling the indexed surface area. GBP photos enrich the listing visually, improving dwell time and engagement signals. Together with Subsystem 6 (reviews), this transforms any surface from a static NAP card into a living, content-rich merchant profile that signals active engagement to both consumers and search engines.

#### Current State (verified 2026-08-23):
* **Directory page** (`/directory/[slug]`) already renders `DirectoryPhotoGalleryDisplay` for platform-internal photos. No GBP photos are surfaced. No GBP local posts are surfaced.
* **Place page** (`/place/[slug]`) has no photo gallery and no posts section.
* **Shops surfaces** (`/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`) — no GBP posts or photos surfaced.
* **GBP data sources exist but are locked behind the tenant/customer portal:** `gbp_posts` (migration 239 adds lifecycle columns) populated by `GBPAdvancedSync.listPosts` / `createPost`; `gbp_media` (migration 240 adds `location_id`) populated by `GBPAdvancedSync.listMedia` / `uploadPhoto`. Neither is exposed on public surfaces.

#### Functional Design:
1. **Public, read-only GBP posts endpoint (surface-agnostic):**
   * `GET /api/public/directory/:slug/gbp-posts` (no auth — public content; see §8.2)
   * Resolves: slug → tenant → `gbp_locations_list` (via `tenant_id`) → `gbp_posts` (via `location_id`, `status = 'PUBLISHED'`)
   * Returns: paginated list of published posts with `topic_type` (STANDARD/EVENT/OFFER), `summary`, `media_url`, `call_to_action_type`, `call_to_action_url`, `event_title`, `event_start_date`, `event_end_date`, `offer_coupon_code`, `offer_redeem_url`, `google_create_time`
   * Sorted by `google_create_time` desc (most recent first); offer/event posts with future end dates prioritized
   * **Does NOT expose:** `status` (internal lifecycle), `scheduled_for` (internal scheduling), `post_name` (internal Google resource ID)
   * **Surface-agnostic:** same resolution pattern as the reviews endpoint — any surface that can resolve a tenant slug can consume it
2. **Public, read-only GBP photos endpoint (surface-agnostic):**
   * `GET /api/public/directory/:slug/gbp-photos` (no auth — public content; see §8.2)
   * Resolves: slug → tenant → `gbp_locations_list` (via `tenant_id`) → `gbp_media` (via `location_id`, `is_active = true`)
   * Returns: list of photos with `category` (COVER, PROFILE, LOGO, EXTERIOR, INTERIOR, PRODUCT, AT_WORK, FOOD_AND_DRINK, etc.), `source_url` or `google_url`, `description`
   * Sorted by category priority (COVER → EXTERIOR → INTERIOR → PRODUCT → FOOD_AND_DRINK → other)
   * **Does NOT expose:** `view_count` (internal analytics, deferred per Subsystem 4)
3. **Frontend rendering (reusable across surfaces, two-gate model):**
   * New `GbpPostsSection` component — renders recent posts as cards (offer post → coupon card with CTA, event post → event card with date, standard post → text + image card). "Posted on Google" badge on each. Designed as a **reusable surface component**.
   * New `GbpPhotoGallerySection` component — renders GBP photos in a category-grouped gallery. "Photos from Google" badge. Integrates with or sits alongside existing `DirectoryPhotoGalleryDisplay` (platform-internal photos).
   * Both render on **any public surface** when **both gates pass** (§6.8):
     - **Hard gate:** `gbp_directory_content` capability is present on the resolved tenant (tier/purchase/grant)
     - **Soft gate (merchant gate):** `merchantPreferences.gbp_content_display !== false` (merchant has not opted out of display)
   * The merchant controls the display of the purchase — same two-gate model as Subsystem 6
   * Initial consumers (Phase 4): `/directory/[slug]` + `/place/[slug]`
   * Future consumers: `/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`, `/category-discovery` — no component changes needed, just mount + pass tenant slug
4. **SEO amplification:**
   * GBP post content is indexed by search engines when surfaced on the platform — creating cross-domain content presence
   * Fresh posts (updated regularly by the scheduler, Subsystem 3) signal active content to search crawlers
   * Photo alt text and structured data (`LocalBusiness` schema with `photo` property) enhance local search visibility
   * Offer posts with coupon short links (`/s/{autoId}`) create cross-traffic between Google, the platform surface, and the platform's coupon funnel
5. **Coexistence with platform-internal content:**
   * GBP posts and platform-internal content (if any) are visually separated and badged differently ("Posted on Google" vs. platform-native)
   * GBP photos and platform-internal photos (`DirectoryPhotoGalleryDisplay`) can render as separate galleries or a merged gallery with source badges — implementation decision
6. **No new ingestion needed:**
   * `gbp_posts` is populated by `GBPAdvancedSync.listPosts` (existing) and the post scheduler (Phase 3)
   * `gbp_media` is populated by `GBPAdvancedSync.listMedia` (existing) and the media upload flow (Phase 3)
   * Both tables gain `location_id` in migrations 239/240, enabling the public endpoint to query by location

#### Build Delta:
* **Build — public endpoints:** two new routes in `directory-gbp-public.ts` (alongside the reviews endpoint from Subsystem 6), registered at `authLevel: 'public'` in `routeRegistry.ts`. Both capability-gated by `gbp_directory_content`. Surface-agnostic.
* **Build — `GbpPostsSection` component:** new `apps/web/src/components/gbp/GbpPostsSection.tsx` (under `gbp/` — surface-agnostic). Fetches from the public posts endpoint. Renders post cards by type with "Posted on Google" badges.
* **Build — `GbpPhotoGallerySection` component:** new `apps/web/src/components/gbp/GbpPhotoGallerySection.tsx` (under `gbp/` — surface-agnostic). Fetches from the public photos endpoint. Renders category-grouped gallery with "Photos from Google" badge.
* **Build — initial surface integration:** mount both components on `/directory/[slug]` and `/place/[slug]` when capability is present.
* **Future surface integration (post-Phase 4):** mount on `/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`, `/category-discovery`. No component changes — just mount + pass tenant slug.
* **No build — ingestion:** reuses `GBPAdvancedSync.listPosts` / `listMedia` (existing) and the Phase 3 scheduler/upload flows unchanged.

#### Google Policy Note:
Surfacing Google local posts and media on a third-party platform is permitted under Google's API terms as long as:
- Content is attributed to Google ("Posted on Google" / "Photos from Google" badges)
- Content is not modified or misrepresented
- Media URLs reference Google's hosted URLs (not re-hosted without attribution)

The badge + unmodified content + Google-hosted URL references satisfy these requirements.

---

## 5. Prospect-to-Tenant Conversion Engine

The core commercial thesis of this platform is **progressive relationship escalation**:

```
Marketing Prospect (Audit / Fix)
       ▼
Marketing Customer (Claimed Deliverable + Portal Access)
       ▼
Managed GBP Subscriber (Recurring Review & Post Automation)
       ▼
Full Retail Visibility Tenant (POS Inventory Sync + Local Shopping Ads)
```

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CONVERSION ENGINE LIFECYCLE                                    │
├─────────────────┬─────────────────┬───────────────────────────────┬─────────────────────────────┤
│ STAGE           │ TRIGGER         │ MERCHANT EXPERIENCE           │ MONETIZATION                │
├─────────────────┼─────────────────┼───────────────────────────────┼─────────────────────────────┤
│ 1. Prospect     │ Cold outreach / │ Views interactive Diagnostic  │ One-time purchase ($99–$499)│
│    Audit        │ SEO scan        │ Gallery with Gold Standard gap│ or free audit               │
├─────────────────┼─────────────────┼───────────────────────────────┼─────────────────────────────┤
│ 2. Claim & Auth │ Payment success │ Claims account in Portal; logs│ Zero friction; saves card on│
│                 │ / email invite  │ in with Google OAuth in 1-tap │ file via Stripe             │
├─────────────────┼─────────────────┼───────────────────────────────┼─────────────────────────────┤
│ 3. GBP Suite    │ Onboarding      │ Auto-fixes NAP; activates AI  │ Recurring subscription:     │
│    Retention    │ checklist       │ reviews & post scheduler      │ $49–$129/month              │
├─────────────────┼─────────────────┼───────────────────────────────┼─────────────────────────────┤
│ 4. Full Tenant  │ "Sync in-store  │ Connects Square/Clover; items │ Full SaaS Tenant:           │
│    Escalation   │ inventory" CTA  │ appear live in Google search  │ $199–$399/month + add-ons   │
└─────────────────┴─────────────────┴───────────────────────────────┴─────────────────────────────┘
```

### 5.1 In-Portal Upgrade Triggers
1. **The Review Velocity Trigger:** When an unverified or free user receives $> 5$ new reviews in a week, prompt: *"Activate AI Auto-Responder to maintain 100% response rate within 1 hour."*
   * *Implementation:* computed from `gbp_reviews` rows (`review_time` within trailing 7 days) written by the ingestion job (Subsystem 2); evaluated in the `gbp/status` overview payload and delivered as an inline dashboard card + `mkt_direct` alert. Suppressed once `gbp_ai_response` entitlement is active.
   * *Cadence dependency (v3):* the trigger's freshness is bounded by the ingestion cron frequency. v1 mandates an **hourly** `gbpReviewIngestion.ts` cadence for single-location merchants so the "5 in a week" signal reflects reality within ~1 hour of the 5th review landing. A daily cadence would lag the upsell prompt by up to 24 hours and miss the moment of merchant attention. Pub/Sub push (deferred) eliminates this constraint; until then, hourly cron is the contract.
2. **The Post Expiration Trigger:** On day 6 after a post expires: *"Your Google ranking drops when posts expire. Enable Auto-Scheduler to keep fresh offers active."*
   * *Implementation:* derived from `gbp_posts` event/offer end dates (migration 239 lifecycle columns); emitted by `gbpPostScheduler.ts` when it observes expiry. Suppressed once `gbp_posts_scheduler` entitlement is active.
3. **The Local Inventory (POS) Upsell Trigger:** On the GBP dashboard summary card: *"Shoppers in your zip code are searching for items you sell. Connect your Clover/Square POS to show live in-stock items directly on Google Maps."*
   * *Implementation:* rendered when the resolved tenant passes `isGBPSyncAllowed` but fails `isGMCSyncAllowed` (both already exist in `lib/google/capability-gate.ts`); CTA deep-links to the existing Square/Clover connection flow.

**Monetization note (v3):** "GBP Pro" is not a subscription tier — it's the **`gbp_management` capability module** (§6.1). The module's features (`gbp_ai_response`, `gbp_posts_scheduler`) flow through the existing capability architecture: hard tier gate (Full Retail Visibility Tenant includes the module via flexible key) + soft merchant gate (any tier can purchase individual features or the entire module via BSaaS catalog). Phase 4 (§9) registers the module + features + BSaaS catalog entries — no new billing infrastructure. The Phase 3 portal checkout (`/api/customer/marketing/checkout`) handles the purchase transaction.

---

## 6. Capability Gate & RBAC Architecture
*(Aligned with `three-tier-feature-gating`, `tier-hierarchy`, and `capability-constraint-relationships`)*

Feature access is governed via the platform's layered capability engine. The GBP Management Suite introduces a new **capability module** (`gbp_management`) whose features flow through the existing tier-gate + BSaaS-purchase machinery — no new billing or entitlement infrastructure is built.

### 6.1 Capability Module Design

```
Capability Type (module): gbp_management  ← "GBP Pro" in product/marketing surface
  ├── Feature: gbp_ai_response       — AI review response (Tier A drafts + Tier B autopilot)
  ├── Feature: gbp_posts_scheduler   — Scheduled post queue + lifecycle management
  └── (future features added to module as built — see §6.5)
```

The platform's capability architecture handles all flexibility from here:
- **Tier assignment:** a tier assigned the `gbp_management` module can grant individual features OR the entire module via the **flexible key** (grants all features within the capability type).
- **BSaaS catalog:** individual features OR the entire module (flexible key) can be sold as recurring SKUs in the BSaaS app store. Any tier can purchase.
- **Admin grants:** complimentary individual features or the entire module can be granted to any tenant.
- **Runtime resolution:** `EffectiveCapabilityResolver` auto-merges tier grants + BSaaS purchases + admin grants into the effective manifest. No resolver changes needed.

### 6.2 Capability Resolution (code-level)

```ts
// Capability Resolution Matrix (reconciled with apps/api/src/lib/google/capability-gate.ts — both gates are async)
const isGBPBasicAllowed       = await isGBPSyncAllowed(tenantId);   // EXISTING — storefront-type + integration gate
const isAIRepliesAllowed      = isFlexible || !!features.gbp_ai_response      || !!purchases.gbp_ai_response;      // NEW — gbp_management module
const isPostsSchedulerAllowed = isFlexible || !!features.gbp_posts_scheduler  || !!purchases.gbp_posts_scheduler;  // NEW — gbp_management module
const isGMCSyncAllowedFlag    = await isGMCSyncAllowed(tenantId);   // EXISTING — storefront + product-type + GMC integration gate
```

Evaluation happens against the **resolved tenant** from the Subsystem 0 bridge, so no change to `EffectiveCapabilityResolver` internals is required.

### 6.3 Registration Plan (Phase 4 — admin UI + data, no new code)

**Verified against the live capability system (2026-08-23):** the keys `gbp_ai_response` and `gbp_posts_scheduler` do **not** exist yet anywhere in `features_list`, `capability_features_list`, `tier_features_list`, or `bsaas_catalog`. Existing adjacent keys are `integration_gbp`, `integration_gmc_sync`, and `propagation_gbp`.

```
Step 1: features_list
  INSERT gbp_ai_response
  INSERT gbp_posts_scheduler

Step 2: capability_features_list
  INSERT capability_type = 'gbp_management'
  LINK gbp_ai_response       → gbp_management
  LINK gbp_posts_scheduler   → gbp_management

Step 3: tier_features_list (hard tier gate)
  ASSIGN gbp_management to {full_retail_visibility_tier_id}
    → flexible key (is_enabled = true, grants ALL features in module)
  (other tiers: not assigned — hard gate excludes them)

Step 4: bsaas_catalog (soft merchant gate — via /settings/admin/bsaas-catalog modal)
  Add Catalog Entry:
    ├── Capability Type = gbp_management, Feature Key = gbp_ai_response
    │   price = $X/mo, billing cycle = monthly, trial days, private/active status, trial/demo eligibility
    ├── Capability Type = gbp_management, Feature Key = gbp_posts_scheduler
    │   price = $Y/mo, billing cycle = monthly, trial days, private/active status, trial/demo eligibility
    └── Capability Type = gbp_management, Feature Key = flexible
        price = $Z/mo (entire module — discounted vs. buying both individually)
        billing cycle = monthly, trial days, private/active status, trial/demo eligibility

Step 5: tenant_feature_purchases (runtime — handled by existing BSaaS checkout)
  Records each purchase with validity period; resolver checks expiry
```

**No new billing infrastructure.** The BSaaS catalog admin modal (`/settings/admin/bsaas-catalog`) already supports price, billing cycle, trial days, private status, active status, trial eligibility, and demo eligibility. Recurring billing is handled by the existing `SubscriptionBillingService` (Phase 3 card-on-file). The only code work is the feature-gate checks in route handlers (already specified: `gbp_ai_response` gates Tier A/B, `gbp_posts_scheduler` gates scheduling).

### 6.4 Capability Matrix (v3 — module-driven, not tier-rows)

The original v2 matrix had "GBP Pro / Retainer ($49–$99/mo)" as a distinct tier row. Under the module-driven model, that row dissolves into **"any tier + BSaaS purchase state"** — the capability module flows to wherever it's purchased or granted.

| Tier / BSaaS Purchase State | GBP Profile & NAP | Review Inbox & Manual Reply | AI Auto-Responder | Scheduled Posts | POS / GMC Sync |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Directory Seed (`directory_presence`)** | Read-only | ❌ | ❌ | ❌ | ❌ |
| **Claimed Customer Portal (Free/Basic)** — no BSaaS | ✅ Sync NAP | ✅ Read & Reply | ❌ (Draft preview only) | ❌ | ❌ |
| **Any tier + BSaaS `gbp_ai_response`** | ✅ Live Sync | ✅ Full Inbox | ✅ AI Auto-Pilot | *(depends on `gbp_posts_scheduler`)* | *(depends on tier)* |
| **Any tier + BSaaS `gbp_posts_scheduler`** | ✅ Live Sync | ✅ Full Inbox | *(depends on `gbp_ai_response`)* | ✅ Unlimited Queue | *(depends on tier)* |
| **Any tier + BSaaS `gbp_management` (flexible)** | ✅ Live Sync | ✅ Full Inbox | ✅ AI Auto-Pilot | ✅ Unlimited Queue | *(depends on tier)* |
| **Full Retail Visibility Tenant ($199+/mo)** — module included | ✅ Live Sync | ✅ Full Inbox | ✅ AI Auto-Pilot | ✅ Unlimited Queue | ✅ Live POS & Google Shopping Feeds |

This is strictly more flexible than the v2 tier-row model: a free-tier Claimed Customer Portal merchant can buy just the AI responder without upgrading to a full tenant tier. A full tenant gets the entire `gbp_management` module included via the flexible key without buying BSaaS add-ons.

### 6.5 Future GBP Management Module Features

The `gbp_management` capability module grows over time. Features are registered in `features_list` + linked to the module as they're built. Candidate future features (not v1):

| Feature Key | Description | Phase |
| :--- | :--- | :--- |
| `gbp_ai_response` | AI review response (Tier A drafts + Tier B autopilot) | Phase 2 / 2.5 |
| `gbp_posts_scheduler` | Scheduled post queue + lifecycle | Phase 3 |
| `gbp_directory_reviews` | Surface live Google GBP reviews + aggregate rating + owner replies on any public surface the merchant appears on (Subsystem 6) — tenant-scoped capability, consumed by directory/place/shops/discovery surfaces | Phase 4 |
| `gbp_directory_content` | Surface live Google GBP local posts (offers, events, what's new) + photos on any public surface the merchant appears on — SEO amplification (Subsystem 7) — tenant-scoped capability, consumed by directory/place/shops/discovery surfaces | Phase 4 |
| `gbp_category_optimizer` | One-click category recommendations from Intelligence Discovery scan | Post-v1 |
| `gbp_holiday_presets` | One-click holiday hours preset packs (Thanksgiving/Christmas/New Year's) | Post-v1 |
| `gbp_media_benchmark` | Photo health benchmark against Gold Standard category benchmark | Post-v1 |
| `gbp_review_dispute` | 1-click "Dispute via Platform" bridge to DisputeIntakeService (if gated — currently free in Subsystem 2) | Post-v1 |

### 6.6 Expiry & Entitlement Boundary

When a BSaaS purchase for `gbp_ai_response` or `gbp_posts_scheduler` expires or is cancelled, the feature gate **flips back immediately** — clean entitlement boundary:
- **AI autopilot** stops scheduling new replies; Tier A draft generation returns 402/403.
- **Post scheduler** stops queuing new posts; existing `SCHEDULED` rows whose `scheduled_for` has not yet passed still publish (they were queued while entitled), but no new rows can be created.
- **Drafts already generated** remain visible in the review inbox (stored in `gbp_reviews.ai_drafts` — persisted data is not revoked).
- **Published review replies** remain live on Google (already posted; not retractable via entitlement).
- **Published local posts** remain live on Google until their natural expiry or manual deletion.

The `EffectiveCapabilityResolver` checks purchase validity dates at resolution time; expired purchases are excluded from the effective manifest automatically.

### 6.7 Tier Representation Status (verified 2026-08-23)

- **Directory Seed** and **Full Retail Visibility Tenant** rows map to machinery that exists today (`org_standing_mode = 'directory_seed'`; full-tenant gating via `integration_gbp` / `integration_gmc_sync`).
- **Claimed Customer Portal (Free/Basic)** has no tier or purchasable representation yet — it rides on the Subsystem 0 link (free NAP sync + review inbox + manual reply).
- **GBP Pro as a capability module** (`gbp_management`) does not exist yet — registered in Phase 4 per §6.3. The module is not a tier; it's a capability type that flows through tier assignment + BSaaS purchases + admin grants.

### 6.8 Merchant Gate — Display Toggle (Soft Gate)

The two-gate capability model is **canon** in the platform's capability architecture, documented across multiple skill docs:
- `three-tier-feature-gating.md` — "Shared Control Model" (§Architectural Insights): platform shapes the economy, merchant shapes their experience
- `capability-data-flow-rules.md` R33 — "Merchant Preferences Must Never Gate Tier-Level Fields": hard architectural boundary between tier-level fields (`allowed_*`, `is_flexible`) and merchant-gated fields (`can_use_*`, `effective_*`)
- `add-capability-feature.md` §3 — "Add a merchant gate storage table column": every capability domain has a dedicated `tenant_*_options_settings` table for merchant preferences

The GBP Management Suite follows this canonical pattern:

| Gate | Layer | Question | Source | Skill doc reference |
| :--- | :--- | :--- | :--- | :--- |
| **Hard gate** | Entitlement | "Does the merchant *have* this capability?" | Tier assignment + BSaaS purchase + admin grant → `features[key]` | `three-tier-feature-gating.md` — three-tier economy (flexible/explicit/BSaaS) |
| **Soft gate (merchant gate)** | Display | "Does the merchant *want to display* this capability?" | Per-tenant `merchantPreferences` toggle in `tenant_*_options_settings` | `add-capability-feature.md` §3 — merchant gate storage table |
| **Effective state** | Render | "Should the surface render this content?" | Hard gate AND soft gate | `capability-data-flow-rules.md` R33 — `can_use_*` = tier allows AND merchant enabled |

This is the **canonical capability pattern**, not a new invention. Existing examples in the codebase:
- `snap_ebt_display` — merchant toggles SNAP/EBT badge visibility (hard gate: tier allows; soft gate: merchant decides)
- `external_link_enabled` — merchant toggles external link display
- `directory_entry_opt_enabled` — merchant toggles directory entry on/off
- `deposit_enabled` / `full_payment_enabled` — merchant toggles payment options

**For GBP Pro directory/content surfacing features:**

The merchant gate follows the `add-capability-feature.md` §3 pattern — a merchant gate storage column in the appropriate `tenant_*_options_settings` table:

```
merchantPreferences: {
  gbp_reviews_display: boolean,    // toggle: show GBP reviews on public surfaces
  gbp_content_display: boolean,    // toggle: show GBP posts + photos on public surfaces
}
```

- **Default: `true`** (merchant opted in by default on purchase — matches the existing pattern where `merchantPrefs.x_enabled !== false` means enabled)
- **Merchant can toggle off** via tenant settings UI without losing the capability — the purchase remains active, the content just doesn't render publicly
- **Toggling back on** is instant — no re-purchase needed, the hard gate is still satisfied
- **Applies across all surfaces** — the toggle is tenant-scoped, not surface-scoped. If the merchant turns off `gbp_reviews_display`, reviews don't render on directory, place, shops, or discovery. One toggle, all surfaces. (Per-surface toggles are a post-v1 possibility if merchants request finer control.)
- **Cache invalidation**: per `add-capability-feature.md` common pitfall — the settings PUT handler MUST call `invalidateEffectiveCapabilities(tenantId)` or the public endpoint will serve stale data for up to 60 seconds.

**Resolution flow (per `capability-data-flow-rules.md` canonical pattern):**
```ts
// Layer 1: Resolver — tier-level fields (R33: never gated by merchant prefs)
const hasGbpReviews = flexible || !!features.gbp_directory_reviews;  // hard gate only

// Layer 1: Resolver — merchant-gated fields (tier AND merchant)
const gbpReviewsEnabled = hasGbpReviews && merchantPreferences?.gbp_reviews_display !== false;

// Layer 5: React hook / public endpoint — reads effective state
// Public endpoint returns { enabled: gbpReviewsEnabled } — both gates must pass
```

**Total flexibility (per `three-tier-feature-gating.md` Shared Control Model):**
- Hard gate: tier includes it, OR merchant buys it via BSaaS, OR admin grants it → merchant *has* it
- Soft gate: merchant toggles display on/off → merchant *shows* it
- The merchant controls the display of the purchase. The platform never forces content onto a surface the merchant doesn't want it on.
- Neither side has full control — platform shapes the economy (what's bundled, what's purchasable, pricing), merchant shapes their experience (what to buy, what to toggle on). That's what makes it work at scale.

---

## 7. Database Schema Extensions

**Verified baseline (2026-08-23):** all four GBP models **already exist** in `apps/api/prisma/schema.prisma` — `gbp_locations_list` (:1933), `gbp_media` (:1954), `gbp_posts` (:1973), `gbp_reviews` (:2000). The work is therefore **extension via numbered SQL migrations** (`database/migrations/`, next available number: 237), not greenfield models. Naming reconciliation vs. the original draft of this spec: posts/reviews/media have **no `_list` suffix** in the live schema; `gbp_locations_list` keys off `account_id` (→ `google_oauth_accounts_list`) and has **no `tenant_id`**; none of posts/reviews/media carry a `location_id` FK today.

| Migration | File | Purpose |
| :--- | :--- | :--- |
| 237 | `237_gbp_locations_verification.sql` | Verification state + VoM cache + denormalized `tenant_id` + cached aggregate rating (`cached_average_rating`, `cached_review_count`, `rating_cache_updated`) on `gbp_locations_list` |
| 238 | `238_gbp_reviews_intelligence.sql` | `location_id`, `reply_status`, `ai_drafts`, `sentiment` on `gbp_reviews`; `star_rating` enum→Int (Google API returns `'ONE'`..`'FIVE'`; migration maps to 1–5) |
| 239 | `239_gbp_posts_lifecycle.sql` | `location_id`, `post_name`, lifecycle `status`, `scheduled_for`, `published_at` on `gbp_posts` |
| 240 | `240_gbp_media_location.sql` | `location_id`, `view_count` on `gbp_media` |
| 241 | `241_mkt_customer_gbp_links.sql` | **New table** — Subsystem 0 identity bridge (customer ↔ tenant; location resolved via `gbp_locations_list.tenant_id` from migration 237, supporting 1:N for post-v1 multi-location) |

Run `doppler run --config local -- pnpm prisma db pull` + `pnpm prisma:generate` after applying, per project convention.

```prisma
// 1. Google Business Location mapping — EXISTING model gbp_locations_list, extended by migration 237
// TARGET STATE (existing fields elided; see schema.prisma:1933)
model gbp_locations_list {
  // existing: id, account_id (FK → google_oauth_accounts_list), location_id, location_name,
  //           store_code, address, phone_number, website_url, category, is_verified,
  //           is_published, last_fetched_at, created_at, updated_at
  // NOTE: spec draft's address_json / primary_phone / primary_category_id are reconciled to the
  //       existing flat columns (address / phone_number / category) — no reshape.

  tenant_id          String?  // NEW (237) — denormalized from google_oauth_accounts_list; backfilled
  business_name      String?  // NEW (237)
  verification_state String   @default("UNVERIFIED") // NEW (237): UNVERIFIED | PENDING | COMPLETED | FAILED
  voice_of_merchant  Json?    // NEW (237) — cached getVoiceOfMerchantState payload
  cached_average_rating Float? // NEW (237) — Google's aggregate averageRating (e.g., 4.5); refreshed by ingestion job
  cached_review_count  Int?    // NEW (237) — Google's aggregate totalReviewCount; refreshed by ingestion job
  rating_cache_updated DateTime? // NEW (237) — last time cached_average_rating / cached_review_count were refreshed

  @@index([tenant_id]) // NEW (237)
}
```

```sql
-- database/migrations/237_gbp_locations_verification.sql
ALTER TABLE gbp_locations_list
  ADD COLUMN IF NOT EXISTS tenant_id VARCHAR,
  ADD COLUMN IF NOT EXISTS business_name VARCHAR,
  ADD COLUMN IF NOT EXISTS verification_state VARCHAR(20) NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS voice_of_merchant JSONB,
  ADD COLUMN IF NOT EXISTS cached_average_rating DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS cached_review_count INTEGER,
  ADD COLUMN IF NOT EXISTS rating_cache_updated TIMESTAMPTZ;

UPDATE gbp_locations_list l
SET tenant_id = a.tenant_id
FROM google_oauth_accounts_list a
WHERE l.account_id = a.id AND l.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_gbp_locations_tenant ON gbp_locations_list (tenant_id);
```

```prisma
// 2. Local Posts Cache & Queue — EXISTING model gbp_posts, extended by migration 239
// TARGET STATE (existing fields elided; see schema.prisma:1973)
model gbp_posts {
  // existing: id, tenant_id, google_post_id, summary, topic_type, call_to_action_type,
  //           call_to_action_url, media_url, event_title, event_start_date, event_end_date,
  //           offer_coupon_code, offer_redeem_url, offer_terms, state (Google-side),
  //           google_create_time, google_update_time, created_at, updated_at
  // RECONCILED: the spec draft's JSON blobs (media_json / event_json / offer_json) are NOT
  //             adopted — the existing flattened columns are kept (simpler querying; the
  //             service layer maps them to Google payloads).

  location_id   String?             // NEW (239) — FK → gbp_locations_list.id
  post_name     String?             // NEW (239) — Google resource ID (accounts/.../localPosts/{id})
  status        String              @default("PUBLISHED") // NEW (239): DRAFT | SCHEDULED | PUBLISHED | FAILED
  scheduled_for DateTime?           // NEW (239)
  published_at  DateTime?           // NEW (239) — backfilled from google_create_time

  gbp_location  gbp_locations_list? @relation(fields: [location_id], references: [id], onDelete: Cascade)
  @@index([tenant_id, status, scheduled_for])
}
```

```sql
-- database/migrations/239_gbp_posts_lifecycle.sql
ALTER TABLE gbp_posts
  ADD COLUMN IF NOT EXISTS location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS post_name VARCHAR,
  ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE gbp_posts SET published_at = google_create_time
WHERE published_at IS NULL AND google_create_time IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gbp_posts_tenant_status_sched ON gbp_posts (tenant_id, status, scheduled_for);
```

```prisma

// 3. Reviews & AI Response State — EXISTING model gbp_reviews, extended by migration 238
// TARGET STATE (existing fields elided; see schema.prisma:2000)
model gbp_reviews {
  // existing: id, tenant_id, google_review_id (unique), reviewer_name, reviewer_photo_url,
  //           comment, review_reply, reply_update_time, google_create_time,
  //           google_update_time, is_replied, created_at, updated_at

  location_id  String?            // NEW (238) — FK → gbp_locations_list.id
  star_rating  Int?               // TYPE CHANGE (238): String → Int (1–5). Google API returns enum
                               // ('ONE'..'FIVE'); migration maps enum→int. GBPAdvancedSync.storeReviews
                               // must be updated to write Int instead of the enum string.
  reply_status String             @default("NONE") // NEW (238): NONE | AI_DRAFTED | PUBLISHED | DISPUTED
  ai_drafts    Json?              // NEW (238) — Tier A drafts: [{ text, tone, generated_at }]
  sentiment    String?            // NEW (238): POSITIVE | NEUTRAL | NEGATIVE

  gbp_location gbp_locations_list? @relation(fields: [location_id], references: [id], onDelete: Cascade)
  @@index([tenant_id, star_rating])
  @@index([tenant_id, reply_status])
}
```

```sql
-- database/migrations/238_gbp_reviews_intelligence.sql
ALTER TABLE gbp_reviews
  ADD COLUMN IF NOT EXISTS location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reply_status VARCHAR(16) NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS ai_drafts JSONB,
  ADD COLUMN IF NOT EXISTS sentiment VARCHAR(12);

-- Google API returns starRating as an enum string ('ONE'..'FIVE'), stored directly
-- in the VarChar(10) column by GBPAdvancedSync.storeReviews. Map the enum to integers.
-- Also handle numeric strings ('1'..'5') defensively in case any row was written by
-- a different code path. Unknown values become NULL.
ALTER TABLE gbp_reviews ALTER COLUMN star_rating TYPE INTEGER
  USING (
    CASE star_rating
      WHEN 'ONE'   THEN 1
      WHEN 'TWO'   THEN 2
      WHEN 'THREE' THEN 3
      WHEN 'FOUR'  THEN 4
      WHEN 'FIVE'  THEN 5
      WHEN '1' THEN 1
      WHEN '2' THEN 2
      WHEN '3' THEN 3
      WHEN '4' THEN 4
      WHEN '5' THEN 5
      ELSE NULL
    END
  );

UPDATE gbp_reviews SET reply_status = 'PUBLISHED' WHERE is_replied = true AND reply_status = 'NONE';

CREATE INDEX IF NOT EXISTS idx_gbp_reviews_tenant_rating ON gbp_reviews (tenant_id, star_rating);
CREATE INDEX IF NOT EXISTS idx_gbp_reviews_tenant_reply ON gbp_reviews (tenant_id, reply_status);
```

```prisma

// 4. Media Assets — EXISTING model gbp_media, extended by migration 240
// TARGET STATE (existing fields elided; see schema.prisma:1954)
model gbp_media {
  // existing: id, tenant_id, google_media_id, media_format, category, source_url,
  //           google_url, description, is_active, created_at, updated_at

  location_id  String?            // NEW (240) — FK → gbp_locations_list.id
  view_count   Int                @default(0) // NEW (240) — populated only if the Performance API
                               // proves viable; otherwise stays null (see §4.4 deferred note)

  gbp_location gbp_locations_list? @relation(fields: [location_id], references: [id], onDelete: Cascade)
  @@index([location_id, category])
}
```

```sql
-- database/migrations/240_gbp_media_location.sql
ALTER TABLE gbp_media
  ADD COLUMN IF NOT EXISTS location_id VARCHAR REFERENCES gbp_locations_list(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_gbp_media_location_category ON gbp_media (location_id, category);
```

```prisma
// 5. NEW TABLE — Subsystem 0 identity bridge (migration 241)
// NOTE (v3): the bridge is customer ↔ tenant, NOT customer ↔ location.
// A tenant may own N gbp_locations_list rows (v1 = 1, post-v1 = N).
// Keeping gbp_location_id OFF the bridge avoids a single nullable FK that
// would preclude multi-location cleanly and a future unique-constraint change.
// Multi-location support is added later as a portal UX layer only.
model mkt_customer_gbp_links {
  id                 String   @id @default(uuid())
  customer_id        String   // platform customer (JWT sub)
  tenant_id          String   // provisioned/reused lightweight tenant
  origin_campaign_id String?  // campaign whose claim created the relationship (audit trail)
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt

  @@unique([customer_id, tenant_id])
  @@index([tenant_id])
}
```

```sql
-- database/migrations/241_mkt_customer_gbp_links.sql
CREATE TABLE IF NOT EXISTS mkt_customer_gbp_links (
  id                 VARCHAR PRIMARY KEY,
  customer_id        VARCHAR NOT NULL,
  tenant_id          VARCHAR NOT NULL,
  origin_campaign_id VARCHAR,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mkt_customer_gbp_links ON mkt_customer_gbp_links (customer_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mkt_customer_gbp_links_tenant ON mkt_customer_gbp_links (tenant_id);
```

---

## 8. API Route Endpoints Contract

### 8.1 Customer / Merchant Endpoints (new file: `apps/api/src/routes/gbp-customer.ts`)

**Verified status (2026-08-23):** all 12 endpoints below are **net-new**. `marketing-customer.ts` (21 endpoints) has no GBP routes, and no GBP module is registered in `routeRegistry.ts`. Functionally equivalent **tenant-side** endpoints already exist in `google-business-oauth.ts` (mounted at `/api/google/business`, 30 endpoints) — the "Backend reuse" column maps each new customer endpoint to the proven service method it delegates to after the Subsystem 0 identity resolution.

**Registration:** new entry in `routeRegistry.ts` at `/api/customer/marketing/gbp`, `domain: 'customer'`, `authLevel: 'public'` (auth handled internally via `requireCustomerAuth` + `requirePlatformContext`, mirroring the `marketing-customer.ts` pattern). Every handler calls `CustomerGBPAccessService.resolveTenant(customerId)` first to establish the bridge, then either `resolveLocation(customerId)` (v1 single-location handlers: verification, single-resource CRUD) or `resolveLocations(customerId)` (list handlers: reviews, posts, media). See Subsystem 0 §4 for the resolution contract.

| HTTP Method | Route | Description | Backend reuse (tenant-side equivalent) | Auth & Context |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/customer/marketing/gbp/status` | Linked GBP connection status, verification state, location metadata, cached aggregate rating (`cached_average_rating` + `cached_review_count`), and upgrade-trigger signals (§5.1). | `GBPBusinessInfoSync.getSyncStatus` + `gbp_locations_list` row | Customer JWT + Platform Context |
| `GET` | `/api/customer/marketing/gbp/verification/options` | Fetch available verification channels (SMS, Call, Mail, PIN). | NEW — `GBPVerificationService.fetchOptions` | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/verification/start` | Trigger verification request to Google. | NEW — `GBPVerificationService.start` | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/verification/complete`| Submit verification PIN code to complete claiming. | NEW — `GBPVerificationService.complete` (fires standing-mode flip + milestone alert) | Customer JWT + Platform Context |
| `GET` | `/api/customer/marketing/gbp/reviews` | List reviews with pagination, filter by rating, sentiment, and reply status. Served from `gbp_reviews` (migration 238 columns), refreshed by the ingestion job. | `GBPAdvancedSync.listReviews` (live passthrough optional) | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/reviews/:id/reply` | Publish an owner response to a specific review. | `GBPAdvancedSync.replyToReview` | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/reviews/:id/ai-draft`| Generate 3 contextual tone-aware AI response options (Tier A). Tier A is the v1 surface; Tier B autopilot is deferred to Phase 2.5 pending Tier A draft-quality validation (see §4 Subsystem 2 and §9). | NEW — `GBPReviewReplyService.generateDrafts` (tone via `MarketingCategoryToneService`) | Customer JWT + Platform Context + `gbp_ai_response` (draft-preview mode when unentitled) |
| `GET` | `/api/customer/marketing/gbp/posts` | List published and scheduled local posts. | `GBPAdvancedSync.listPosts` + `gbp_posts` rows | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/posts` | Create or schedule a new local post (Offer, Event, What's New). `scheduled_for` present → `SCHEDULED` queue; absent → immediate publish. | `GBPAdvancedSync.createPost` | Customer JWT + Platform Context + `gbp_posts_scheduler` for scheduling |
| `DELETE`| `/api/customer/marketing/gbp/posts/:id` | Delete a published local post. | `GBPAdvancedSync.deletePost` | Customer JWT + Platform Context |
| `GET` | `/api/customer/marketing/gbp/media` | List location photos and categories, plus Gold Standard photo-count benchmark. | `GBPAdvancedSync.listMedia` + `IntelligenceProfileService` benchmark | Customer JWT + Platform Context |
| `POST` | `/api/customer/marketing/gbp/media/upload` | Upload and tag a new photo/video asset to GBP. Supports `sourceUrl` (existing) and binary (new two-step `startUpload` path). | `GBPAdvancedSync.uploadPhoto` / NEW `uploadPhotoBinary` | Customer JWT + Platform Context |

All responses follow the platform double-wrap contract (`{ success: true, data: { ... } }`; frontend unwraps `result.data?.data ?? result.data`).

### 8.2 Public Surface Endpoints — GBP Content Surfacing (new file: `apps/api/src/routes/directory-gbp-public.ts`)

**Verified status (2026-08-23):** net-new. No public endpoint serves GBP reviews, posts, or photos today. The existing `directory-presence-public.ts` handles seed claim flows only. Registered in `routeRegistry.ts` at `/api/public/directory`, `authLevel: 'public'` (no auth — public content).

**Surface-agnostic design:** all endpoints resolve slug → tenant → capability check → data. The calling surface (directory, place, shops, discovery) is irrelevant to the data contract — any surface that can resolve a tenant slug can consume any of these endpoints. The capability is checked on the resolved tenant, not on the surface.

| HTTP Method | Route | Description | Backend reuse | Auth & Context |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/public/directory/:slug/gbp-reviews` | Public GBP reviews + aggregate rating for any surface. Resolves slug → tenant → `gbp_locations_list` → `gbp_reviews`. Returns `cached_average_rating`, `cached_review_count`, and paginated reviews (`reviewer_name`, `star_rating`, `comment`, `review_reply`, `google_create_time`). Does NOT expose `sentiment`, `reply_status`, or `ai_drafts` (internal management fields). Surface-agnostic — any surface resolving the tenant slug can consume. | `gbp_reviews` + `gbp_locations_list` (migration 237/238 columns) | **Public (no auth)** + `gbp_directory_reviews` capability gate on resolved tenant |

**Capability gating (two-gate model, §6.8):** the endpoint checks both gates on the resolved tenant via `publicUnifiedCapabilityService`:
1. **Hard gate:** `gbp_directory_reviews` capability is present (tier/purchase/grant → `features[key]`)
2. **Soft gate (merchant gate):** `merchantPreferences.gbp_reviews_display !== false`

If either gate fails, returns `{ success: true, data: { enabled: false } }` — the frontend renders nothing rather than erroring. This keeps public surfaces resilient for tenants without the feature or who have opted out of display. The merchant controls the display of the purchase — having the capability doesn't force it onto surfaces.

| HTTP Method | Route | Description | Backend reuse | Auth & Context |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/public/directory/:slug/gbp-posts` | Public GBP local posts for any surface. Resolves slug → tenant → `gbp_locations_list` → `gbp_posts` (`status = 'PUBLISHED'`). Returns post cards by type (STANDARD/EVENT/OFFER) with CTA, media, dates, coupon links. Sorted by `google_create_time` desc; future-dated offers/events prioritized. Does NOT expose `status`, `scheduled_for`, `post_name` (internal fields). Surface-agnostic. | `gbp_posts` (migration 239 columns) | **Public (no auth)** + `gbp_directory_content` capability gate |
| `GET` | `/api/public/directory/:slug/gbp-photos` | Public GBP photos for any surface. Resolves slug → tenant → `gbp_locations_list` → `gbp_media` (`is_active = true`). Returns photos with category (COVER, EXTERIOR, INTERIOR, PRODUCT, FOOD_AND_DRINK, etc.), URL, description. Sorted by category priority. Does NOT expose `view_count` (internal analytics, deferred per Subsystem 4). Surface-agnostic. | `gbp_media` (migration 240 columns) | **Public (no auth)** + `gbp_directory_content` capability gate |

**Capability gating (posts + photos):** same two-gate model as the reviews endpoint (§6.8):
1. **Hard gate:** `gbp_directory_content` capability is present (tier/purchase/grant)
2. **Soft gate (merchant gate):** `merchantPreferences.gbp_content_display !== false`

If either gate fails, returns `{ success: true, data: { enabled: false } }`.

---

## 9. Phased Implementation Roadmap

**v1 scope (v3):** emerging single-location merchants only. Multi-location portal UX, Tier B autopilot, POS/GMC upsell, and Pub/Sub ingestion are explicitly out of v1 phases 0–2 and land in 2.5 / 4 / post-v1 as noted.

```
Phase 0: Identity Bridge & Schema (BLOCKING — Skills: directory-presence-seed-claim)
  ├── Migrations 237–241 (§7) + prisma db pull / generate
  │   NOTE: migration 241 is customer↔tenant only (no gbp_location_id); multi-location
  │         support later requires NO schema change, only portal UX.
  ├── mkt_customer_gbp_links provisioning on claim of GBP-scoped campaigns
  ├── CustomerGBPAccessService: resolveTenant + resolveLocations + resolveLocation (v1 convenience)
  ├── resolveLocations tenant_id drift reconciliation (Subsystem 0 step 6)
  ├── 404 cross-customer isolation contract
  └── gbp-customer.ts scaffold registered in routeRegistry.ts

Phase 1: OAuth & In-App Verification Flow (Skills: directory-presence-seed-claim, google-integration-and-demo-qr)
  ├── Reuse existing tenant OAuth flow (/api/google/business) via bridge — no parallel stack
  ├── GBPVerificationService: fetchVerificationOptions / verify / verifications.complete
  ├── /account/marketing/gbp/ dashboard shell + verification status indicator + PIN dialog
  └── Verification milestone alert + directory_seed → independent standing flip

Phase 2: Review Intelligence & Tier A Reply Engine (Skills: marketing-ops-category-tone, alerts-and-notifications)
  ├── gbpReviewIngestion.ts cron — HOURLY cadence (§5.1 review-velocity trigger depends on it)
  ├── gbp_reviews upsert + sentiment tagging
  ├── Refresh gbp_locations_list.cached_average_rating + cached_review_count from Google aggregate fields
  ├── GBPReviewReplyService.generateDrafts — Tier A only
  │   ├── Owner voice profile (OwnerVoiceService — PRIMARY, from seek/intelligence capture)
  │   ├── Category tone preset (MarketingCategoryToneService — SECONDARY, augments voice)
  │   ├── New prompt template: apps/api/src/services/gbp/prompts.ts (buildGbpReviewReplyPrompt)
  │   ├── 3 angle-variants per review (warm/direct, professional/concise, empathetic/detailed)
  │   ├── Sentiment-aware rules + category guardrails (medical, legal, food, retail)
  │   └── Single LLM call producing 3 drafts (not 3 calls)
  ├── Review inbox UI (/account/marketing/gbp/reviews) + gbp_new_review alerts
  └── Dispute bridge → DisputeIntakeService (intake_kind = 'review_dispute')
  ⚠️  Tier B autopilot is implemented (runAutopilot method) but NOT invoked by any Phase 2 job.

Phase 2.5: Tier B Autopilot Quality Gate (Skills: marketing-ops-category-tone)
  ├── Pre-condition: Tier A drafts approved by real merchants in production for ≥1 review cycle
  ├── Prompt-design review confirming autopilot replies meet Google's authenticity bar
  ├── GBPReviewReplyService.runAutopilot wired to a scheduled job (5★ no-comment auto-thanks within dynamic window)
  ├── Dynamic response window: tunable parameter, NOT a hardcoded constant (§4 Subsystem 2 behavioral character)
  ├── ≤3★ held for human review; autopilot inert without gbp_ai_response entitlement
  └── Rollback plan: feature flag on runAutopilot job; off → drafts-only mode resumes

Phase 3: Local Post Publisher & Media Manager (Skills: diagnostic-gallery-user-guide, bsaas-coupons-private-features)
  ├── Post composer + schedule queue (gbpPostScheduler.ts; gated: gbp_posts_scheduler)
  ├── Offer post builder wiring coupon short links (/s/{autoId})
  ├── Two-step binary media upload + diagnostic-gallery → GBP media handoff
  └── Photo gallery sync & Gold Standard benchmark indicators

Phase 4: Prospect-to-Tenant Conversion Engine (Skills: three-tier-feature-gating, bsaas-purchase-flow)
  ├── Register gbp_management capability module + features (§6.3):
  │   ├── features_list: gbp_ai_response, gbp_posts_scheduler, gbp_directory_reviews, gbp_directory_content
  │   ├── capability_features_list: gbp_management module links
  │   ├── tier_features_list: assign gbp_management to Full Retail Visibility Tenant (flexible key)
  │   └── bsaas_catalog: 5 SKUs via /settings/admin/bsaas-catalog modal
  │       (gbp_ai_response, gbp_posts_scheduler, gbp_directory_reviews, gbp_directory_content, flexible — all recurring, monthly)
  ├── NO new billing infrastructure — existing SubscriptionBillingService + BSaaS checkout handle it
  ├── In-portal upgrade funnels (review velocity, post expiration, POS upsell — §5.1)
  ├── One-click Square / Clover POS connection (EXISTS tenant-side — wire CTA only)
  ├── Automated Google Merchant Center local inventory sync (EXISTS — GMCProductSync)
  └── Public Surface Review + Content Surfacing (Subsystems 6 + 7):
      ├── Public endpoints: GET /api/public/directory/:slug/gbp-reviews, gbp-posts, gbp-photos (§8.2)
      ├── Surface-agnostic components: GbpReviewsSection + GbpPostsSection + GbpPhotoGallerySection
      │   (under apps/web/src/components/gbp/ — reusable across surfaces)
      ├── Initial consumers: /directory/[slug] + /place/[slug] (Phase 4)
      ├── Future consumers: /shops/[slug], /shops/directory, /shops/trending, /shops/featured, /category-discovery
      │   (no component changes — just mount + pass tenant slug)
      ├── "Reviewed on Google" / "Posted on Google" / "Photos from Google" badges
      ├── Two-gate model (§6.8):
      │   ├── Hard gate: gbp_directory_reviews + gbp_directory_content capabilities on resolved tenant
      │   │   (tier/purchase/grant — tenant-scoped, not surface-scoped — one BSaaS purchase, any surface renders)
      │   └── Soft gate (merchant gate): merchantPreferences.gbp_reviews_display + gbp_content_display toggles
      │       (merchant controls display of the purchase — tenant settings UI, default: true, instant toggle)
      ├── Reuses gbpReviewIngestion.ts (Phase 2) + gbp_posts/gbp_media (Phase 3) + cached_average_rating (migration 237)
      └── SEO amplification: fresh post content indexed cross-domain, photo structured data, offer coupon cross-traffic

Post-v1 (not scheduled): Multi-location portal UX
  ├── Location switcher in /account/marketing/gbp/ header
  ├── Per-location dashboards (reviews, posts, media, verification state)
  ├── resolveLocation deprecated; all handlers use resolveLocations + selected locationId
  ├── Optional: per-location entitlements (tier_features_list scope change — schema work)
  └── NO change to mkt_customer_gbp_links or gbp_locations_list required for the UX layer
```

**Frontend deliverables per phase (all net-new, verified absent 2026-08-23):** `MarketingCustomerService` (web) gains 12 methods (`getGbpStatus`, `getVerificationOptions`, `startVerification`, `completeVerification`, `listReviews`, `replyToReview`, `generateAiDraft`, `listPosts`, `createPost`, `deletePost`, `listMedia`, `uploadMedia`); `CustomerSidebar` gains a "Google Business" nav group under the platform-context section; pages under `/account/marketing/gbp/` (dashboard, reviews, posts, media). The tenant-side tabbed dashboard (`/settings/integrations/google/`, pattern from `google-integration-and-demo-qr.md`) remains a separate build target and is not a prerequisite for the customer portal work.

---

## 10. Verification & Quality Gates

1. **OAuth Safety & Token Isolation:** Unit tests validating that token refresh never leaks plain credentials across customer boundaries — `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts` (bridge resolution, cross-customer 404, token never serialized into portal DTOs, `tenant_id` drift reconciliation on `resolveLocations`).
2. **Verification State Machines:** `apps/api/src/services/__tests__/GBPVerificationService.test.ts` covering `UNVERIFIED` $\rightarrow$ `PENDING` $\rightarrow$ `COMPLETED` / `FAILED`, PIN retry limits, and the `directory_seed` $\rightarrow$ `independent` standing flip on `COMPLETED`.
3. **Route Contract & Isolation:** `apps/api/src/tests/gbp-customer-routes.test.ts`, mirroring the existing 7-test `marketing-customer-routes.test.ts` pattern — no auth → 401, storefront-only → 403 `context_required`, platform context → 200, customer A vs. customer B location/review/post → 404.
4. **Reply Engine Rules:** `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts`:
   - **Phase 2 (Tier A):** owner voice profile is the primary tone source (injected from `OwnerVoiceService.getProfile`); category tone preset augments (injected from `MarketingCategoryToneService.getPresetByCategory`); Tier A produces exactly 3 drafts with distinct angles (warm/direct, professional/concise, empathetic/detailed); drafts are review-grounded (assert prompt includes reviewer name + comment text when available, not just star rating); sentiment-aware rules applied (5★ no-comment → genuine thanks + business name, not generic; 1-2★ → offline redirect present); category guardrails applied (medical → no health details publicly); `gbp_ai_response` entitlement gates draft generation.
   - **Phase 2.5 (Tier B):** autopilot publishes only 5★ no-comment reviews; ≤3★ held for human review; autopilot inert without `gbp_ai_response` entitlement; `runAutopilot` job is feature-flagged and inert by default in Phase 2 test runs; response timing uses the dynamic window (no hardcoded constant — assert the window is a tunable parameter, not a fixed offset).
5. **Scheduler:** job-level test for `gbpPostScheduler.ts` — publishes due `SCHEDULED` rows, marks `FAILED` on Google API error, never double-publishes.
6. **`star_rating` Enum→Int Migration Audit (migration 238):** Google's API returns `starRating` as an enum string (`'ONE'`..`'FIVE'`), which `GBPAdvancedSync.storeReviews` currently writes directly to the `VarChar(10)` column. Migration 238 maps the enum to integers (`ONE→1`..`FIVE→5`) and changes the column to `INTEGER`. Before merging 238:
   - (a) **Update `GBPAdvancedSync.storeReviews`** (line ~860) to write `Int` (1–5) instead of the enum string — the `Review` interface's `starRating` field type changes from `'ONE'|'TWO'|'THREE'|'FOUR'|'FIVE'` to `number`, or a mapping step is added at the storage boundary.
   - (b) **Grep all `star_rating` consumers** in `apps/api` and `apps/web` for enum-string comparisons (`=== 'FIVE'`, `=== 'ONE'`, etc.) and update them to numeric comparisons (`=== 5`, `=== 1`).
   - (c) **Verify `pnpm checkapi` + `pnpm checkweb`** are clean against the flipped Prisma type (`String?` → `Int?`).
   - (d) **Verify `GBPAdvancedSync.listReviews`** and any tenant dashboard serializers handle `Int | null`.
   The migration's `CASE` mapping handles existing rows; this gate handles the code-path fallout so new reviews aren't written with enum strings into an Int column.
7. **Double-Wrap API Contract:** all API responses adhere to `{ success: true, data: { ... } }`; frontend unwraps via `result.data?.data ?? result.data`.
8. **Type Safety:** 100% clean `pnpm checkapi` and `pnpm checkweb`.

---

## 11. Current-State Audit Baseline (verified 2026-08-23)

Recorded during the full-spectrum gap analysis that produced v2 of this spec. Source of truth for "exists vs. build" claims throughout.

| Area | Status | Evidence |
| :--- | :--- | :--- |
| **v1 target segment scoping (v3)** | **Decided** | §1.3 — emerging single-location merchants; multi-location deferred to post-v1 UX layer (no schema change) |
| Tenant GBP OAuth + 30 mgmt endpoints | **Exists** | `google-business-oauth.ts` @ `/api/google/business` |
| NAP / categories / hours / special-hours sync | **Exists** | `GBPBusinessInfoSync.ts` + `gbpHoursSync.ts` job |
| Local Posts CRUD (STANDARD/EVENT/OFFER) | **Exists (tenant-side)** | `GBPAdvancedSync.ts:326–437`; no lifecycle/queue |
| Reviews list / reply / delete-reply | **Exists (tenant-side)** | `GBPAdvancedSync.ts:500–603` |
| Media CRUD, 13 categories | **Exists (tenant-side)** | `GBPAdvancedSync.ts:159–256`; `sourceUrl` upload only |
| GMC product sync (variants, inventory, price) | **Exists** | `GMCProductSync.ts` |
| Capability gates `isGBPSyncAllowed` / `isGMCSyncAllowed` | **Exist (async)** | `lib/google/capability-gate.ts:49–102` |
| Schema models `gbp_locations_list` / `gbp_posts` / `gbp_reviews` / `gbp_media` | **Exist (partial shape)** | `schema.prisma:1933–2021` — extended by migrations 237–240 |
| `star_rating` Enum→Int migration audit | **Required pre-merge of 238** | §10 gate #6 — Google API returns enum (`'ONE'`..`'FIVE'`), stored as `VarChar(10)`. Migration maps enum→Int. `GBPAdvancedSync.storeReviews` (line ~860) must be updated to write `Int` instead of enum string; all enum-string comparisons (`=== 'FIVE'`) must be updated to numeric (`=== 5`). |
| Verification APIs (fetchOptions / verify / complete) | **Missing** | New `GBPVerificationService` (Phase 1) |
| Customer→tenant GBP identity bridge | **Missing (blocker)** | Subsystem 0 + migration 241 (Phase 0). **v3:** bridge is customer↔tenant (no `gbp_location_id`); `resolveTenant` + `resolveLocations` + `resolveLocation` (v1 convenience) |
| `gbp_locations_list.tenant_id` drift reconciliation | **Missing** | Subsystem 0 step 6 — `resolveLocations` reconciles denormalized `tenant_id` against `google_oauth_accounts_list.tenant_id` on read |
| All 12 `/api/customer/marketing/gbp/*` endpoints | **Missing** | New `gbp-customer.ts` (§8.1) |
| Review ingestion (cron / Pub/Sub) | **Missing** | `gbpReviewIngestion.ts` (Phase 2). **v3:** hourly cadence mandated for v1 (§5.1 review-velocity trigger freshness) |
| AI GBP reply engine — Tier A (tone-aware, 3 drafts) | **Missing** | `GBPReviewReplyService.generateDrafts` (Phase 2); owner voice profile (from seek/intelligence capture) is primary tone source, category tone preset augments; 3 angle-variants per review; sentiment-aware + category guardrails; new prompt template in `apps/api/src/services/gbp/prompts.ts` |
| AI GBP reply engine — Tier B (autopilot) | **Missing — deferred to Phase 2.5** | `GBPReviewReplyService.runAutopilot` implemented in Phase 2 but NOT invoked; gated on Tier A production validation + prompt-design review + `gbp_ai_response` entitlement (Phase 4) |
| GBP event alerts (`gbp_new_review`, post-expiry, verification) | **Missing** | `CrmAlertService` exists; zero GBP alert creators today |
| Post scheduler + lifecycle | **Missing** | Migration 239 + `gbpPostScheduler.ts` (Phase 3) |
| Two-step binary media upload | **Missing** | `uploadPhotoBinary` (Phase 3) |
| Feature keys `gbp_ai_response` / `gbp_posts_scheduler` | **Missing** | Registration plan §6.3 (Phase 4) — `features_list` + `capability_features_list` + `tier_features_list` + `bsaas_catalog` |
| GBP Pro capability module (`gbp_management`) | **Missing** | Not a tier — a capability type/module (§6.1). Phase 4 registers module + features + BSaaS catalog entries (individual SKUs + flexible bundle). No new billing infrastructure. |
| BSaaS catalog recurring billing for GBP add-ons | **Exists** | `/settings/admin/bsaas-catalog` modal supports price, billing cycle, trial days, private/active status, trial/demo eligibility. `SubscriptionBillingService` handles recurring charges. |
| In-portal upgrade triggers (§5.1) | **Missing** | Phase 4 |
| Customer portal GBP UI (dashboard, inbox, composer, PIN dialog) | **Missing** | §9 frontend deliverables |
| Multi-location portal UX (location switcher, per-location dashboards) | **Missing — post-v1** | §1.3 + §9 post-v1 block; no schema change required, only portal UX + optional per-location entitlements |
| Tenant tabbed dashboard `/settings/integrations/google/` | **Missing** (spec v1 incorrectly listed it as existing) | Build target only; `GoogleConnectCard` exists in tenant settings |
| Dispute bridge (`review_dispute` intake kind) | **Missing** | Reuses `mkt_dispute_intake` 1:N registry machinery |
| Public surface review surfacing (Subsystem 6) | **Missing** | New `GbpReviewsSection` component (surface-agnostic, under `components/gbp/`) + `GET /api/public/directory/:slug/gbp-reviews` endpoint; gated by `gbp_directory_reviews` feature key (Phase 4). Tenant-scoped capability — any public surface resolving the tenant slug can consume (directory, place, shops, discovery). Reuses `gbp_reviews` (Phase 2 ingestion) + `cached_average_rating` (migration 237). Directory page already has `StoreRatingsSection` (platform-internal reviews only); place/shops/discovery surfaces have no reviews section. |
| Public surface content surfacing — posts + photos (Subsystem 7) | **Missing** | New `GbpPostsSection` + `GbpPhotoGallerySection` components (surface-agnostic, under `components/gbp/`) + `GET /api/public/directory/:slug/gbp-posts` + `gbp-photos` endpoints; gated by `gbp_directory_content` feature key (Phase 4). Tenant-scoped capability — same multi-surface consumer model as Subsystem 6. Reuses `gbp_posts` (migration 239) + `gbp_media` (migration 240). SEO amplification via cross-domain post content + photo structured data. |
| `gbp_directory_reviews` feature key | **Missing** | Registration in Phase 4 with other `gbp_management` module features (§6.5) |
| `gbp_directory_content` feature key | **Missing** | Registration in Phase 4 with other `gbp_management` module features (§6.5) |
| Merchant gate toggles (`gbp_reviews_display`, `gbp_content_display`) | **Missing** | Per-tenant `merchantPreferences` toggles (§6.8) — **canonical two-gate capability pattern** per `three-tier-feature-gating.md` (Shared Control Model) + `capability-data-flow-rules.md` R33 + `add-capability-feature.md` §3. Hard gate (tier/purchase/grant) + soft gate (merchant toggle) = effective state. Existing examples: `snap_ebt_display`, `external_link_enabled`, `directory_entry_opt_enabled`. Default: `true`. Toggle via tenant settings UI. Cache invalidation via `invalidateEffectiveCapabilities(tenantId)` on PUT. |
| Referenced skills & docs | **All exist** | §2 note; `multi-archetype-campaigns` is under `.agents/skills/` |
