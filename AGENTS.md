# AGENTS.md — Project Conventions

## Build & Typecheck Commands

- `pnpm checkapi` — TypeScript check for `apps/api` (`tsc --noEmit --project apps/api`)
- `pnpm checkweb` — TypeScript check for `apps/web` (`tsc --noEmit --project apps/web`)
- `pnpm prisma:generate` — Regenerate Prisma Client (run after schema changes)
- `doppler run --config local -- pnpm prisma db pull` — Pull DB schema into `prisma/schema.prisma` (run from `apps/api`)
- `doppler run --config local -- pnpm prisma generate` — Regenerate client with Doppler secrets

## Architecture

- **Backend:** Node.js + Express + TypeScript in `apps/api`
  - Routes in `apps/api/src/routes/` (registered via `routeRegistry.ts`)
  - Services in `apps/api/src/services/`
  - Prisma ORM; schema at `apps/api/prisma/schema.prisma`
  - Migrations in `database/migrations/` (numbered, e.g. `161_*.sql`)
  - `RequestCtx` type lives in `apps/api/src/context.ts` (NOT `middleware/auth.ts`)
  - Config via `unifiedConfig` from `apps/api/src/config/unifiedConfig.ts` (NOT `config.ts`)
  - `audit()` helper in `apps/api/src/audit.ts` accepts optional `actorType: 'user' | 'system' | 'integration' | 'customer'`
- **Frontend:** Next.js (App Router) + TypeScript in `apps/web`
  - Pages in `apps/web/src/app/`
  - Services in `apps/web/src/services/` (extend `PublicApiSingleton` or `CustomerApiSingleton`)
  - Customer auth context: `apps/web/src/contexts/CustomerAuthContext.tsx`
  - Customer auth service: `apps/web/src/services/CustomerAuthService.ts` (singleton; `applyExternalAuth()` persists tokens from external auth flows)

## Conventions

- Platform sentinel: use `'platform'` (the `tenants.id = 'platform'` row). Do NOT use `'_platform_'`.
- `PLATFORM_SCOPE` constant: `apps/api/src/lib/platform-scope.ts`
- Marketing Ops public routes mount at `/api` (so routes are `/api/public/marketing/*`)
- Marketing Ops admin routes mount at `/api/admin/marketing-ops`
- Customer auth routes mount at `/api/customer-auth`
- Frontend public services extend `PublicApiSingleton` with `ttl: 0` for no caching
- Double-wrap response contract: unwrap with `result.data?.data ?? result.data`
- Mantine UI is used on marketing public pages (`@mantine/core`); customer account pages use Tailwind + `@/components/ui/*`
- Tabler icons: use `IconLogin` (not `IconLogIn`)

## Marketing Ops Customer Portal (Phase 1)

Spec: `docs/LocalBiz/MARKETING_OPS_CUSTOMER_PORTAL_SPEC.md`

Key files:
- `apps/api/src/services/MarketingCustomerService.ts` — claim service (`claimAllEligible`, `issueClaimToken`, `getClaimTokenSummary`, `consumeClaimToken`, `registrationClaimSweep`)
- `apps/api/src/services/marketing/MarketingReceiptPdfService.ts` — shared receipt PDF generator
- `apps/api/src/services/marketing/MarketingReceiptEmailService.ts` — receipt + claim invite emails
- `apps/api/src/routes/marketing-ops-public.ts` — public pay + claim endpoints (§6.1)
- `apps/api/src/routes/marketing-ops.ts` — admin pay-link + send-claim-invite endpoints (§8.1, §8.2)
- `apps/web/src/services/MarketingClaimPublicService.ts` — frontend claim service
- `apps/web/src/app/marketing/claim/` — public claim pages (Path B)
- `apps/web/src/app/marketing/pay/PayPageClient.tsx` — pay page with email field + account CTA

Three claim paths, one claim service:
- **Path A** (at payment): pay page success screen → register/login → `claimViaPayRegister` / `claimViaPayLogin`
- **Path B** (email awareness): `/marketing/claim` → email → claim link → `/marketing/claim/[token]` → register/login
- **Path C** (registration sweep): `CustomerAuthService.verifyEmail` / `oauthLogin` → `registrationClaimSweep` (fire-and-forget)

## Marketing Ops Customer Portal (Phase 2 — Authenticated Portal)

Context signals (§4.2):
- `CustomerAuthService.computeContexts(customerId)` returns `{ storefront, platform }` booleans
- `contexts` field on `/me` and all auth responses (login, register, oauth, claim)
- Frontend `CustomerAuthContext` exposes `contexts` and refreshes after claim/purchase events

Portal backend (§6.2, §6.4, §6.5, §7.3, §7.4, §7.7, §7.9):
- `apps/api/src/routes/marketing-customer.ts` — authenticated portal routes at `/api/customer/marketing/*`
  - All routes require customer JWT + `requirePlatformContext` gate (403 `context_required`)
  - Endpoints: overview, campaigns, purchases, receipts (view + PDF), branding, support tickets, alerts
- `apps/api/src/services/MarketingCustomerProjection.ts` — customer-safe projection:
  - `projectCampaign` / `projectCampaigns` — whitelists fields, hides internal stages
  - `mapCustomerStatus` — maps internal stages to customer-legible statuses (§7.3)
  - `buildPortalOverview` — aggregates total spent, active engagements, deliverables ready
  - `buildReceiptViewModel` — receipt DTO with QR destination + branding resolution (§7.4)

Portal frontend (§7.2, §7.4, §7.7, §7.9):
- `apps/web/src/services/MarketingCustomerService.ts` — extends `CustomerApiSingleton`, wraps all portal endpoints
- `apps/web/src/app/account/marketing/` — portal pages:
  - `page.tsx` — overview (summary cards + campaigns + recent purchases)
  - `purchases/page.tsx` — full payment history table
  - `campaigns/[id]/page.tsx` — campaign detail with progress timeline + deliverables + receipts
  - `receipts/[revenueId]/page.tsx` — HTML receipt view with QR
  - `settings/page.tsx` — branding settings with live QR preview
  - `support/page.tsx` + `support/[ticketId]/page.tsx` — support tickets
  - `alerts/page.tsx` — platform alerts with mark-read/dismiss
- `apps/web/src/components/customer/CustomerSidebar.tsx` — signal-gated nav groups:
  - "Shopping" group (storefront context)
  - "My Services" group (platform context)
  - "Account" group (context-agnostic, §7.8)
  - Unread alert badge on Notifications (refreshes every 60s when platform context active)

Migrations:
- `162_mkt_customer_branding.sql` — per-customer branding (logo, asset URL, brand color)
- `163_crm_tickets_campaign_id.sql` — additive `campaign_id` on `crm_support_tickets`
- `164_crm_customer_alert_states.sql` — per-customer alert read/dismiss state

## Marketing Ops Customer Portal (Phase 3 — Card on File + Repeat Purchase)

Saved-card plumbing (§6.3):
- `CustomerPaymentMethodsService.savePaymentMethodFromIntent(customerId, pi)` — attaches a PI's payment_method to the customer's platform-scoped Stripe customer
- `CustomerPaymentMethodsService.getOrCreateStripeCustomer` is now public (was private)
- `SubscriptionBillingService.createOneTimePaymentIntent` accepts `setupFutureUsage` + `customer` params
- `SubscriptionBillingService.stripeInstance` getter (public accessor for the private Stripe instance)
- `ConversionSource` type extended with `'portal_checkout'`
- Pay page (`/marketing/pay`) passes `saveCard` → `setup_future_usage: 'off_session'` on the PI; post-confirmation, if authenticated + opted in, calls `savePaymentMethodFromIntent`

Portal checkout (§7.6, §7.5):
- `POST /api/customer/marketing/checkout` — repeat-purchase checkout:
  - Off-session charge with `useSavedMethodId` (customer + payment_method + off_session: true)
  - SCA failure → 402 `authentication_required` with clientSecret for frontend fallback
  - Interactive checkout → PI with `setup_future_usage: 'off_session'` + platform Stripe customer
  - Coupon redemption: `savedCouponId` (wallet) or `couponCode` (ad-hoc) → validates + applies discount → flips wallet row to `redeemed`
- `POST /api/customer/marketing/checkout/confirm` — confirms interactive checkout, marks campaign paid, flips coupon, sends receipt email
- `GET /api/customer/marketing/coupons/applicable?campaignId=` — wallet coupons valid for the campaign's price (§7.5)
- `POST /api/customer/marketing/payment-methods/save-from-payment` — attaches PI's PM to platform scope

Frontend checkout:
- `apps/web/src/app/account/marketing/campaigns/[id]/checkout/page.tsx` — portal checkout page:
  - Saved card selection (platform-scope payment methods)
  - Applicable coupon list (one-click apply) + ad-hoc coupon code entry
  - Off-session charge for saved cards; Stripe Elements fallback for new cards
  - Order summary with discount + total
- Campaign detail page gains "Purchase again / Upgrade" button (§7.6)
- `MarketingCustomerService` (frontend) gains `savePaymentMethodFromIntent`, `getApplicableCoupons`, `createCheckout`, `confirmCheckout`
- `MarketingPayPublicService.createCheckout` accepts `saveCard` param
- Pay page shows "Save this card" checkbox when customer is authenticated

## Marketing Ops Customer Portal — Tests (§11)

- `apps/api/src/services/__tests__/MarketingCustomerProjection.test.ts` (24 tests):
  - Status mapper: every internal stage maps to a customer status or is hidden
  - Hidden stages (seek, preview_built, shown, lost, dead) return null
  - Active subscription overrides stage
  - `projectCampaign` whitelists fields (no notes, pain_score, estimated_*, assigned_to)
  - `projectCampaigns` filters out hidden-stage campaigns
- `apps/api/src/tests/marketing-customer-routes.test.ts` (7 tests):
  - JWT required: no auth → 401, invalid token → 401
  - Context gating: storefront-only → 403 context_required, zero-context → 403, platform → 200
  - Cross-customer isolation: customer A gets 404 on customer B's campaign + receipt

## Marketing Ops Customer Portal — Alert Composer (§8.3)

Operator composer for sending alerts to marketing customers (platform-context only).

Backend endpoints (in `marketing-ops.ts`):
- `GET  /api/admin/marketing-ops/alerts/customers` — list marketing customers for recipient picker
- `GET  /api/admin/marketing-ops/alerts/recipient-count` — pre-send recipient estimate
- `POST /api/admin/marketing-ops/alerts` — create targeted / broadcast / campaign-scoped alert
- `GET  /api/admin/marketing-ops/alerts` — sent alerts history with read/dismissed counts

Frontend:
- `/settings/admin/crm/broadcast/marketing` — dedicated marketing broadcast page (mirrors tenant broadcast)
- Campaign detail "Customer Account" section — "Send Alert" link + "Send Claim Invite" button
- `MarketingOpsService` gains `listMarketingAlertCustomers`, `getAlertRecipientCount`, `createMarketingAlert`, `listMarketingAlerts`, `sendClaimInvite`

Alert targeting (stored in `crm_alerts.metadata`):
- `mkt_broadcast` — no metadata, visible to all platform-context customers
- `mkt_direct` — `metadata.customer_id`, visible to one customer
- `mkt_campaign` — `metadata.campaign_id`, visible to customers who claimed that campaign

All alerts use `tenant_id = PLATFORM_SCOPE`. Customer-side reader is in `marketing-customer.ts` (`GET /alerts`, `POST /alerts/:id/read`, etc.).

## Intake Portal Generalization (Registry-Driven Intake Forms)

Spec: `docs/LocalBiz/INTAKE_PORTAL_GENERALIZATION_PLAN.md`

Generalizes the token-gated "owner data collection" framework to support multiple intake types (dispute, profile_repair, gbp_optimization, review_response_setup, ...) via a registry-driven architecture.

### Schema (Migration 173)
- `mkt_intake_definitions` table — declarative `form_schema`, `field_mappings`, `owner_copy`, `niche_overrides` in JSONB
- `mkt_dispute_intake` — `campaign_id` UNIQUE relaxed to `@@unique([campaign_id, intake_kind])` (1:N relation)
- FK from `mkt_dispute_intake.intake_kind` → `mkt_intake_definitions.intake_kind`

### Backend Services
- `apps/api/src/services/intake/IntakeDefinitionService.ts` — loads + caches definitions, builds dynamic Zod schemas from `form_schema`, resolves niche overrides, runs custom validators
- `apps/api/src/services/intake/writeBehindAdapters.ts` — maps evidence_payload to existing backend domain models (business_hours_list, review_response_settings, etc.)
- `apps/api/src/services/DisputeIntakeService.ts` — extended with `submitRegistryIntake` (kind-aware idempotency, dynamic Zod validation, write-behind adapters, downstream agent enqueue stub)
- `apps/api/src/services/MarketingCampaignService.ts` — registry-driven auto-gen hook: checks `getDefinitionsForTrigger(stage)` on non-recovery transitions; `REVIEW_TRANSITIONS` extended with `gbp_intake_submitted` + `review_setup_submitted` stages
- `apps/api/src/services/RecoveryResolutionService.ts` — updated for 1:N relation (uses `find` on `mkt_dispute_intake` array, `findFirst` for `findByCampaign`)

### Routes
- `apps/api/src/routes/recovery-intake-public.ts` — dispatches to `submitRegistryIntake` for registry kinds; `GET /options` endpoint for dynamic option sources; `reissue` accepts `intakeKind`
- `apps/api/src/routes/marketing-ops.ts` — `GET /recovery/:campaignId/intake` accepts `intakeKind` query param (returns single intake) or returns all intakes (array); `reissue-link` + `attachments/:id` accept `intakeKind`

### Frontend
- `apps/web/src/app/recovery/intake/IntakeFormRenderer.tsx` — generic, registry-driven form renderer (text, url, email, phone, textarea, select, radio, multiselect, checkbox, chips, hours_grid, attachments, number, date, object/nested)
- `apps/web/src/app/recovery/intake/IntakePageClient.tsx` — registry render path: detects `context.definition` and renders `IntakeFormRenderer` instead of hardcoded form fields
- `apps/web/src/services/RecoveryIntakePublicService.ts` — `submitRegistryIntake`, `getOptions`, `reissueLink(campaignId, intakeKind)`
- `apps/web/src/services/RecoveryOpsService.ts` — `getIntake(campaignId, intakeKind)`, `reissueLink(campaignId, intakeKind)`, `downloadAttachment(campaignId, attachmentId, fileName, intakeKind)`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/recovery/[campaignId]/RecoveryDetailClient.tsx` — generic evidence payload renderer for registry kinds (JSON display + downstream action panel)

### Tests
- `apps/api/src/services/__tests__/IntakeDefinitionService.test.ts` (15 tests) — getByKind, getDefinitionsForTrigger, resolve (niche overrides), buildSubmitSchema (dynamic Zod), cache invalidation
- `apps/api/src/services/__tests__/DisputeIntakeService.test.ts` (21 tests) — existing dispute tests + 6 new submitRegistryIntake tests (success, idempotency, expired/invalid token, missing definition, Zod validation failure)

### Key Patterns
- **Code-defined kinds** (`dispute`, `profile_repair`): hardcoded form fields in `IntakePageClient`, validated by `recovery-intake.schema.ts`
- **Registry-driven kinds** (`gbp_optimization`, `review_response_setup`): dynamic form fields from `mkt_intake_definitions.form_schema`, validated by `IntakeDefinitionService.buildSubmitSchema`
- **Niche overrides**: `niche_overrides[category]` can add fields, override field labels/help, and override owner copy per business category
- **Downstream handoff**: stubbed enqueue with manual import path (plan §7.4)

## Gallery Short URLs (SMS-friendly prospect links)

Mirrors the coupon `/s/{autoId}` short URL pattern for diagnostic gallery tokens. The 32-char `/preview/{token}` URL is too long for SMS outreach to phone-only prospects; the short `/g/{shortCode}` form (6 chars) makes text-message gallery links practical.

### Schema (Migration 183)
- `mkt_deliverable_preview_tokens.short_code` — nullable `VARCHAR(8)`, unique partial index `idx_mkt_preview_tokens_short_code` (WHERE NOT NULL)
- 6-char codes from curated 32-char alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — no 0/O/1/I), ~1B combinations
- Legacy tokens have `short_code = null` and keep working via the long URL; `ensureShortCode()` lazily backfills on next admin access

### Backend
- `apps/api/src/lib/id-generator.ts` — `generateGalleryShortCode()` (6-char nanoid from curated alphabet)
- `apps/api/src/services/MarketingDeliverableService.ts`:
  - `generateCampaignToken()` now mints a unique `short_code` (with 3-retry collision handling) for `diagnostic_gallery` + `multi_diagnostic_gallery` token types
  - `resolveShortCode(shortCode)` — public lookup, returns `{ token, tokenType }`; expired tokens return null
  - `ensureShortCode(tokenId, tokenType)` — lazy backfill for legacy tokens
- `apps/api/src/routes/gallery-code.ts` — `GET /api/gallery-code/:shortCode` (public, no auth) → `{ token, tokenType, isMultiGallery }`
- `apps/api/src/routes/routeRegistry.ts` — registers `/api/gallery-code` at `authLevel: 'public'`
- `apps/api/src/routes/marketing-ops.ts`:
  - Single gallery token response includes `shortUrl` + `shortCode` alongside `galleryUrl`
  - Multi-gallery token response includes `galleryUrl` (`?prospect=true`), `shortUrl`, `shortCode`
  - Pay-links list (`GET /campaigns/:id/pay-links`) includes `shortCode` + `shortUrl` per token (powers `listGalleryTokens`)

### Frontend
- `apps/web/src/services/GalleryShortCodeService.ts` — `resolveShortCode()` (extends `PublicApiSingleton`, `ttl: 0`)
- `apps/web/src/app/g/[shortCode]/page.tsx` — server redirect page: resolves short code → redirects to `/preview/{token}` (or `?prospect=true` for multi-gallery)
- `apps/web/src/services/MarketingOpsService.ts` — `GalleryToken` interface extended with `short_code?` + `shortUrl?`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/GalleryPanel.tsx` — "Use short URLs" toggle (default on); prefers `/g/{shortCode}` when available
- `apps/web/src/components/marketing-ops/LogContactModal.tsx` — "Insert gallery link" prefers short URL for SMS-friendly message body
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/SiblingsTab.tsx` — multi-gallery hint mentions SMS-friendly short URL

### Key Patterns
- **Resolution flow**: `/g/{shortCode}` (server page) → `GET /api/gallery-code/:shortCode` → `redirect(/preview/{token}[?prospect=true])`
- **Multi-gallery detection**: `tokenType === 'multi_diagnostic_gallery'` → append `?prospect=true` so `preview/[token]/page.tsx` renders `MultiGalleryPage`
- **Collision handling**: 3 retries on unique-index conflict; falls back to no short code (long URL still works) if exhausted
- **Lazy backfill**: legacy tokens without `short_code` are not broken; `ensureShortCode()` can backfill them on demand

## Intelligence Campaign Prompts — Focus + Kind Awareness

Makes prompt templates focus- and kind-aware so the campaign workspace Prompts tab surfaces only the templates matching the campaign's intelligence type. Previously focus was inferred from the template NAME (regex `/competitive/i`) and kind was inferred from `output_schema.name` — both were artifacts, not queryable data.

### Schema (Migration 203)
- `mkt_prompt_templates_list.intelligence_focus` — nullable `VARCHAR(20)` (`'emerging'` | `'competitive'`); NULL for non-intelligence templates + composition fragments
- `mkt_prompt_templates_list.intelligence_campaign_kind` — nullable `VARCHAR(20)` (`'discovery'` | `'establishment'`); NULL for non-intelligence templates + fragments
- Index `idx_mkt_prompt_templates_intelligence` on `(intelligence_focus, intelligence_campaign_kind, is_active)`
- Backfill sets the 3 known seeded templates: emerging discovery, competitive discovery, establishment

### Backend
- `apps/api/src/services/MarketingPromptService.ts`:
  - `PromptTemplateInput` gains `intelligenceFocus` + `intelligenceCampaignKind` (nullable)
  - `createTemplate` / `updateTemplate` persist both fields
  - `listTemplates` accepts `intelligenceFocus`, `intelligenceCampaignKind`, and `includeNullFocusKind` filters — when `includeNullFocusKind` is set, returns templates matching the focus+kind OR templates with NULL focus/kind (legacy fallback)
  - `cloneTemplate` copies both fields
  - `clearDefaultForType` includes focus+kind in the default-uniqueness key (so emerging + competitive can each have their own default)
- `apps/api/src/routes/marketing-ops.ts`:
  - `promptTemplateCreateSchema` accepts `intelligence_focus` + `intelligence_campaign_kind` (nullable enums)
  - `GET /prompts/templates` accepts `intelligence_focus`, `intelligence_campaign_kind`, `include_null_focus_kind` query params
  - `POST` / `PUT /prompts/templates/:id` pass the new fields through
- Seed scripts updated to set the new fields:
  - `apps/api/src/scripts/seed-intelligence-discovery-templates.ts` — sets `intelligenceFocus` + `intelligenceCampaignKind: 'discovery'` on both templates
  - `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — sets `intelligenceCampaignKind: 'establishment'`
  - `apps/api/src/scripts/seed-intelligence-fragments.ts` — unchanged (fragments identified by `fragment_kind`, focus/kind stay NULL)

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `IntelligenceCampaignKind` type added (next to existing `IntelligenceFocus`)
  - `PromptTemplate` + `PromptTemplateCreateInput` gain `intelligence_focus?` + `intelligence_campaign_kind?`
  - `listPromptTemplates` accepts + passes the new filters
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — Prompts tab:
  - For intelligence-scope campaigns, passes `intelligence_focus` + `intelligence_campaign_kind` + `include_null_focus_kind: true` so only matching templates (plus legacy untyped ones) are fetched
  - Header text shows the active focus + kind when intelligence-scope
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/PromptLibraryClient.tsx`:
  - `PromptTemplateModal` shows Focus + Kind selectors only when `scope = 'intelligence'`; clears them when scope leaves intelligence
  - `intelligenceDiscoveryTemplateIds` memo uses stored fields with name-based fallback for legacy templates
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/prompts/[id]/PromptWorkspaceClient.tsx`:
  - `templateFocus` reads `template.intelligence_focus` first, falls back to name regex for legacy templates
  - `isIntelligenceDiscovery` / `isIntelligenceEstablishment` read `template.intelligence_campaign_kind` first, fall back to `output_schema.name`

### Key Patterns
- **Match + fallback**: the campaign Prompts tab query uses `(focus AND kind match) OR (focus AND kind are NULL)` so legacy/untyped templates remain visible alongside focus-matched ones
- **Backward compatibility**: all focus/kind inference sites retain a name-based or output_schema-based fallback so templates that haven't been re-seeded still work
- **Fragments excluded**: composition fragments (`prompt_type = 'fragment'`) keep NULL focus/kind — they're identified by `fragment_kind` and assembled by `PromptComposerService`

## Compatible Prompts Tab — Organization + Triage Recommendations

The Prompts tab on the campaign detail page (`CampaignDetailClient.tsx`) surfaces prompt templates filtered by the campaign's `scope` and current `stage`. Two organizational layers help the operator pick the right workspace quickly:

### Category Grouping
- Prompts are grouped by `category` (e.g., `profile_repair`, `Digital Audit`, `Review Response`), with an "Uncategorized" bucket sorted last
- Within each group: `is_default` prompts pinned first, then sorted by `output_schema` name, then by name
- Each card shows badges: **Default** (blue), **Intelligence-aware** (violet — all business-scope seek prompts), **output_schema** (gray)

### Triage Recommendations
- When triage is decided (`isOperatorAccepted === true` OR `overriddenPlaybook != null`), a green **"Recommended by Triage"** section appears at the top
- `computeTriageRecommendations()` matches prompts via two layers:
  - **Signal-based** (higher rank): `SIGNAL_PROMPT_MATCHERS` maps signal code patterns to prompt name patterns (e.g., `CP_NAP_*` → "NAP Drift Audit", `DS_CLAIMED_STATUS` → "Unclaimed Profile Audit", `WC_*` → "Business Audit", review signals → "Business Audit")
  - **Playbook category-based** (broader fallback): `PLAYBOOK_CATEGORY_TO_PROMPT_CATEGORIES` maps the effective playbook's category to prompt template categories (e.g., `profile_repair` → `profile_repair`, `review_management` → `Digital Audit` + `Review Response`)
- Each recommended card carries green reason badges explaining why it was recommended
- Recommended prompts are excluded from the "All Prompts" section below to avoid duplication
- All computation is client-side (no new API endpoint); triage result is fetched via `getTriage(campaignId)` in parallel with `listPromptTemplates`

## Business Origin (Diaspora / Heritage Categorization)

Captures the international country/region of origin for diaspora-niche campaigns (e.g. "African Grocery Store" → country: Gambia, region: West Africa). The continent-level qualifier in the `category` field is too coarse for prompt composition, niche overrides, and outreach targeting — a Gambian, Ethiopian, and Nigerian grocery store serve very different diaspora communities.

### Schema (Migration 204)
- `mkt_campaigns_list.business_origin_country` — nullable `VARCHAR(100)`, free-text country name (not ISO code, since prompt-facing)
- `mkt_campaigns_list.business_origin_region` — nullable `VARCHAR(100)`, free-text region (absorbs the multi-country case, e.g. "West Africa" spans Gambia, Senegal, Nigeria)
- Both nullable; no backfill required. Legacy campaigns have NULL and keep working.

### Backend
- `apps/api/src/routes/marketing-ops.ts`:
  - `campaignBaseSchema` accepts `business_origin_country` + `business_origin_region` (optional strings, max 100)
  - POST + PUT handlers pass `businessOriginCountry` / `businessOriginRegion` through to the service
- `apps/api/src/services/MarketingCampaignService.ts`:
  - `CampaignInput` + `CampaignUpdateInput` gain `businessOriginCountry?` + `businessOriginRegion?`
  - `createCampaign` writes both fields (null when absent)
  - `updateCampaign` writes both fields when present in the input (`!== undefined` guard)
- `apps/api/src/services/BusinessProspectService.ts` — `createSiblingCampaign` copies both origin fields from the source campaign (origin travels with the business identity, like `tone` + `attributes`)
- `apps/api/src/services/scope-utils.ts` — `business_origin` added to `business`, `category`, and `intelligence` scope variable lists (origin is niche-level context, not business-name-specific)
- `apps/api/src/services/MarketingExecutionService.ts` — `renderTemplate` candidate map builds `business_origin` as `country, region` joined string (empty when both null)
- `apps/api/src/services/deliverable/prompts.ts`:
  - `BusinessContextFields` gains `businessOrigin: string | null`
  - All 9 deliverable prompt templates (review response, recovery playbook, listing corrections, CTA fixes, mobile catalog, GBP photo, availability inquiry, fulfillment pathway, hours sync) inject `{{business_origin}}` (fallback: `'unspecified'`)
- `apps/api/src/services/deliverable/BusinessContextService.ts` — `getBusinessContext` populates `businessOrigin` from `[country, region].filter(Boolean).join(', ')`

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `Campaign` interface gains `business_origin_country?` + `business_origin_region?`
  - `CampaignCreateInput` gains both fields
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/CampaignFormClient.tsx`:
  - `FormState` + `EMPTY_FORM` include both fields (default `''`)
  - `fetchCampaign` loads both fields
  - Create submit sends `strOrUndef(form.business_origin_country)` + `strOrUndef(form.business_origin_region)`
  - Edit submit sends raw values (so cleared state persists)
  - Two `SuggestiveSelect` fields ("Origin Country" + "Origin Region") placed after the Category field, with vocabulary sourced from existing campaign records via `distinctValues`
  - Helper text explains the diaspora-niche use case + that non-diaspora categories should leave them blank

### Key Patterns
- **Country name, not ISO code**: these fields are prompt-facing (interpolated into deliverable prompts as `{{business_origin}}`), not join keys. "Gambia" reads naturally in a prompt; "GM" does not.
- **Region absorbs multi-country**: most grocery stores are regional rather than single-country. A single region field ("West Africa") handles the case where a store serves multiple country communities without requiring an array.
- **Scope placement**: `business_origin` is in `business`, `category`, and `intelligence` scope variable lists — origin is niche-level context tied to the category, not the specific business name, so category-scope and intelligence-scope prompts can reference it too.

## Log Contact Modal — Per-Channel Result Options + Other Subtype

Extends the "Log contact" modal so every channel has a tailored result dropdown (mirroring the Phone channel's "Call result" pattern), and the "Other" channel gains a subtype selector (DM / Text / Email / Fax-Mail).

### Behavior
- **Phone** — unchanged: "Call result" (Connected / Voicemail / No Answer / Wrong Number / Disconnected) auto-maps to `outcome`.
- **Email** — Contact result: Replied / Sent-no-reply / Bounced / Unsubscribed / Marked as spam / Failed to send.
- **Website** — Contact result: Form submitted / Awaiting response / Form error / No contact form / Page not found.
- **Social** — Contact result: Replied / Sent-no-reply / Comment left / Profile not found / No DM access.
- **In Person** — Contact result: Met owner / Met staff / Not available / Left message with staff / Refused / Closed permanently / Wrong location.
- **Other** — Contact result: Replied / Sent-no-reply / Bad contact info / Refused / Failed to send. Plus an "Other type" subtype selector: DM / Text-SMS / Email / Fax-Mail.
- Selecting a contact result auto-sets the `outcome` field (operator can still override after, but backend enforces the mapping).

### Storage
- Reuses the existing `mkt_outreach_log.call_details` JSON column — no migration required.
- `call_details.call_result` is phone-only; `call_details.contact_result` is non-phone-only; `call_details.other_subtype` is `other`-channel-only. Backend Zod validation enforces these gates plus the per-channel allowed result set and the result→outcome mapping.

### Backend
- `apps/api/src/services/MarketingOutreachService.ts` — `CallDetails` extended with optional `contact_result` + `other_subtype`; new `ContactResult` + `OtherSubtype` union types.
- `apps/api/src/routes/marketing-ops.ts`:
  - `contactResultEnum` + `otherSubtypeEnum` Zod enums
  - `CONTACT_RESULT_TO_OUTCOME` map (result → required outcome)
  - `CHANNEL_CONTACT_RESULTS` map (channel → allowed result values)
  - `callDetailsSchema` extended with optional `call_result` / `contact_result` / `other_subtype`
  - `outreachLogSchema.superRefine` rewritten to handle both phone (`call_result` path) and non-phone (`contact_result` path) coherence checks

### Frontend
- `apps/web/src/services/MarketingOpsService.ts` — `CallDetails` + `ContactResult` + `OtherSubtype` types mirror backend; `LogContactInput` extended with optional `call_details` + `update_worksheet`.
- `apps/web/src/components/marketing-ops/LogContactModal.tsx`:
  - Per-channel result option arrays (`EMAIL_RESULT_OPTIONS`, `WEBSITE_RESULT_OPTIONS`, `SOCIAL_RESULT_OPTIONS`, `IN_PERSON_RESULT_OPTIONS`, `OTHER_RESULT_OPTIONS`) each with `outcome` mapping
  - `OTHER_SUBTYPE_OPTIONS` for the Other subtype selector
  - `contactResultOptionsForChannel(channel)` helper
  - `contactResult` + `otherSubtype` state; `useEffect` on `channel` resets result to first option of new channel + auto-maps outcome
  - Non-phone section renders "Contact result" dropdown + (when `other`) "Other type" dropdown
  - Submit sends `call_details: { contact_result, other_subtype }` for non-phone channels via `logContact`

## Outreach Checklist Bridge (Sprint 1)

Spec: `docs/LocalBiz/marketing_ops_outreach_checklist_bridge_sprint_plan.md`

Bridges the campaign execution layer (Openers, Follow-Ups, Pitch Construction, Contact Log) to the planning layer (Checklist Builder). Closes the gap where `outreach` checklist steps were hollow labels with no artifact detection or auto-completion.

### Migrations (apply in order)
- `185a_mkt_checklist_internal_link_step_type.sql` — DDL: adds `internal_link` to `chk_checklist_step_type` check constraint
- `185_mkt_outreach_checklist_bridge_backfill.sql` — Data-only: backfills `outreach_kind` + `auto_complete` on existing outreach starter steps; adds `internal_link` steps for Openers Workspace + Deliverables deep-links
- `186_mkt_outreach_state_signal_registry.sql` — Data-only: seeds `OX_*` signal rows in `mkt_signal_registry` under new `OX` family

### Backend
- `apps/api/src/services/OutreachChecklistBridgeService.ts` — bridge service:
  - `getOutreachState(campaignId)` — counts + derived flags from outreach tables
  - `checkStepSatisfaction(campaignId, step)` — checks if an outreach step's artifact exists
  - `onOutreachArtifactCreated(campaignId, kind, actor)` — auto-completes steps with `auto_complete=true` (fire-and-forget, called after opener/follow-up/pitch/contact-log creation)
  - `resolveStepDeepLink(campaignId, step)` — resolves internal URL for outreach + internal_link steps
  - `enrichStepViews(campaignId, stepViews)` — enriches checklist view with `outreachStatus` + `internalLink`
- `apps/api/src/services/triage/outreach-state-extractor.ts` — derives `OX_*` signals from outreach tables (openers, follow-ups, pitches, contact logs)
- `apps/api/src/services/triage/signal-taxonomy.ts` — `OX` family + 6 codes + `isOutreachStateSignal()` predicate
- `apps/api/src/services/triage/TriageEngineService.ts` — `evaluateTriage` + `evaluateAllMatchingPlaybooks` filter out `OX_*` signals (display-only, don't influence playbook selection)
- `apps/api/src/services/PlaybookChecklistService.ts`:
  - `internal_link` added to `CHECKLIST_STEP_TYPES`
  - `validateInternalLinkConfig` — validates named target against registry
  - `INTERNAL_LINK_TARGETS` — named target registry: `openers_workspace | deliverables | gallery | campaign_tab | recovery_detail | intake_form`
  - `getCampaignChecklist` enriches step views with `outreachStatus` + `internalLink` via bridge service (lazy import, best-effort)
  - `CampaignChecklistStepView` extended with `outreachStatus?` + `internalLink?`
- `apps/api/src/services/OutreachOpenerService.ts` — `fireBridgeAutoComplete` after execute/import (fire-and-forget)
- `apps/api/src/services/OutreachFollowUpService.ts` — `fireBridgeAutoComplete` after execute/import
- `apps/api/src/services/outreach-pitch/PitchService.ts` — fire-and-forget bridge call after `assemblePitch`
- `apps/api/src/services/MarketingOutreachService.ts` — fire-and-forget bridge call after `logContact`
- `apps/api/src/routes/marketing-ops.ts` — `GET /:id/outreach-state` endpoint

### Frontend
- `apps/web/src/services/MarketingOpsService.ts`:
  - `CHECKLIST_STEP_TYPES` includes `internal_link`
  - `INTERNAL_LINK_TARGETS` + `INTERNAL_LINK_TARGET_LABELS` — named target registry (mirrors backend)
  - `OUTREACH_KINDS` + `OUTREACH_KIND_LABELS` — outreach kind enum + labels
  - `ChecklistStepView` extended with `outreachStatus?` + `internalLink?`
  - `OutreachState` interface + `getOutreachState(campaignId)` method
- `apps/web/src/app/.../CampaignChecklistTab.tsx`:
  - Outreach steps render channel badge + kind label + satisfaction indicator (detected/not yet) + deep-link button + one-click "mark complete"
  - `internal_link` steps render "Open →" button with resolved URL
  - `SuggestionFormModal` captures `stepType` + type-specific `actionConfig` (URL for `url_check`, target for `internal_link`, channel+kind for `outreach`, credential_ref for `credentials`)
- `apps/web/src/app/.../ChecklistBuilderTab.tsx`:
  - `internal_link` in step type dropdown with indigo color
  - `internal_link` target selector + params JSON input
  - `outreach` kind selector + auto-complete checkbox + min follow-up # input
- `apps/web/src/components/marketing-ops/OutreachFollowUpCard.tsx` — checklist cross-link footer ("X/Y outreach steps complete →")
- `apps/web/src/app/.../OpenerWorkspaceClient.tsx` — checklist badge in campaign selector ("Checklist: X/Y outreach steps done →")

### Key Patterns
- **OX signals are display-only**: `isOutreachStateSignal()` predicate; triage engine filters them out of rule evaluation
- **Fire-and-forget bridge calls**: `import('./OutreachChecklistBridgeService').then(...)` pattern — checklist auto-completion never breaks the outreach flow
- **Named target registry**: `internal_link` steps use named targets (not raw URLs) — keeps step templates portable across campaigns; `{campaignId}` resolved at render time
- **Lazy import for circular dep avoidance**: `PlaybookChecklistService` lazy-imports `OutreachChecklistBridgeService` (bridge imports checklist service for step lookups)
- **Best-effort enrichment**: bridge enrichment failures are logged + swallowed — checklist renders without enrichment if bridge has issues

## Intelligence Profile City Scoping (Migration 205)

Closes the city-contamination gap: an intelligence profile established from a city-A establishment campaign was being applied to a city-B discovery campaign for the same `(category, focus)`, injecting city-A-specific discovery patterns, supplier names, and business examples into the city-B prompt. The discovery AI then returned city-A businesses.

### Schema (Migration 205)
- `mkt_intelligence_profiles.reference_city` — nullable `VARCHAR(100)`. NULL = city-agnostic (legacy/backfill sentinel).
- `idx_mkt_intel_profiles_active_category_city_focus` — partial unique index on `(category_key, reference_city, intelligence_focus) WHERE status = 'active' AND reference_city IS NOT NULL` — one active profile per (category, city, focus) triple.
- `idx_mkt_intel_profiles_active_category_focus_nullcity` — partial unique index on `(category_key, intelligence_focus) WHERE status = 'active' AND reference_city IS NULL` — preserves one-city-agnostic-profile-per-(category, focus) invariant.
- Backfill: `reference_city` populated from the most recent establishment campaign matching each profile's category_key. Profiles whose category has no establishment campaign remain NULL (city-agnostic).

### Resolution Semantics
`IntelligenceProfileService.resolve(category, focus?, city?, ctx?)`:
1. If `city` is provided: try exact `(category_key, reference_city, focus)` match (primary path).
2. Fall back to city-agnostic `(category_key, reference_city=NULL, focus)` match — logged warning.
3. Fall back to `(category_key, focus)` match ignoring city — logged warning (cross-city contamination possible).
4. If `focus` is omitted (business-scope §1B path): city is still honored; focus filter is dropped.

### Render-Time City Mismatch Guard
`renderProfileBlock(profile, targetCity?)` and `renderBusinessProfileBlock(profile, targetCity?)`:
- Emit a `CITY RETARGETING DIRECTIVE` when the profile's `reference_city` differs from the campaign's target city — instructs the AI to apply category-level knowledge but re-derive concrete discovery queries, supplier lists, and business examples for the target city.
- Emit a `CITY APPLICATION DIRECTIVE` when a city-agnostic profile is applied to a city-specific campaign.

### Establishment Import
`MarketingPromptService.importExternalResult` now reads the establishment campaign's `city` and stamps it onto the imported draft via `importAsDraft({ referenceCity })`. This is the key fix: the establishment campaign's city flows end-to-end into the profile's reference_city.

### Key Files
- `apps/api/src/services/intelligence/IntelligenceProfileService.ts` — `resolve`, `createProfile`, `importAsDraft`, `activateDraft`, `publishVersion`, `renderProfileBlock`, `renderBusinessProfileBlock`, `normalizeReferenceCity`
- `apps/api/src/services/intelligence/PromptComposerService.ts` — `composeIntelligencePrompt({ category, focus, city })`
- `apps/api/src/services/MarketingExecutionService.ts` — passes `input.campaign.city` to composer + business-scope resolver
- `apps/api/src/services/MarketingPromptService.ts` — stamps establishment campaign city onto imported draft
- `apps/api/src/routes/marketing-ops.ts` — `resolve` route accepts `?city=` query; `create` route accepts `referenceCity` body field
- `apps/web/src/services/MarketingOpsService.ts` — `resolveIntelligenceProfile(category, focus?, city?)`, `createIntelligenceProfile({ referenceCity })`, `IntelligenceProfile.reference_city`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/intelligence-profiles/IntelligenceProfilesClient.tsx` — displays reference_city badge (cyan for city-scoped, gray for city-agnostic)
- `apps/api/src/scripts/seed-intelligence-profile-establishment-template.ts` — establishment template now instructs the AI to produce city-specific concrete examples

### Tests
- `apps/api/src/services/__tests__/IntelligenceProfileService.focus-alignment.test.ts` — 24 tests (existing focus tests updated for `reference_city: null` filter + 13 new city-scoped tests)
- `apps/api/src/services/__tests__/PromptComposerService.test.ts` — 5 tests (city pass-through test added)
- `apps/api/src/services/__tests__/ResolvePrompt.test.ts` — 9 tests (business-scope city pass-through assertion updated)

## Directory Seed ↔ Campaign Link (Migration 230)

Bridges `directory_presence_seeds` (unclaimed public listings) with `mkt_campaigns_list` (operator-validated prospect campaigns) so campaign signals can enrich the seed's public SEO surface. One physical business may have many sibling campaigns (multi-archetype), so this is a join table — not a 1:1 FK on the seed.

### Schema (Migration 230)
- `directory_seed_campaign_links` — join table (`seed_id`, `campaign_id`, `tenant_id`, `link_role`, `nap_match_confidence`, `nap_match_summary` JSONB, `last_synced_at`, `last_sync_fields[]`)
- `link_role` CHECK: `primary` (one per seed, enforced by partial unique index) / `sibling` / `recovery`
- `nap_match_confidence` CHECK: `high` / `medium` / `low` / `none`
- Unique on `(seed_id, campaign_id)` regardless of role

### Backend
- `apps/api/src/services/DirectorySeedCampaignLinkService.ts`:
  - `computeNapMatch(seedId, campaignId)` — normalized business name + address + phone + city comparison; high = name match AND (address OR phone match) AND city match
  - `linkCampaign(seedId, campaignId, role)` — creates link, computes NAP match, **auto-projects campaign signals only when NAP confidence is high**
  - `unlinkCampaign(seedId, campaignId)` — removes link; does NOT roll back projected fields (provenance rows remain as audit trail)
  - `listLinks(seedId)` — returns links with campaign summary
  - `buildDiff(seedId, campaignId)` — per-field diff (campaign value vs current seed value) for operator review
  - `syncFromCampaign(seedId, campaignId, fields[])` — projects selected fields onto listing + writes `directory_field_provenance` rows with `source_name = 'linked_campaign'`, `confidence = 'high'`, `show_on_public = true`
  - `findCandidateCampaigns(seedId, query?)` — searches unlinked campaigns by business name similarity or city+category match
- `apps/api/src/routes/directory-presence-admin.ts` — 6 new endpoints under `/api/admin/directory-presence/presence-seeds/:id/campaign-links`:
  - `GET  /campaign-links` — list linked campaigns
  - `GET  /campaign-candidates?query=` — search unlinked campaigns
  - `GET  /campaign-links/:campaignId/diff` — per-field diff
  - `POST /campaign-links` — link a campaign (body: `{ campaignId, role }`)
  - `DELETE /campaign-links/:campaignId` — unlink
  - `POST /campaign-links/:campaignId/sync` — project fields (body: `{ fields[] }`)
- `apps/api/src/lib/id-generator.ts` — `generateDirectorySeedCampaignLinkId(tenantId)` (`dscl-` prefix)

### Projection policy
- **Auto-projection on link**: only when `nap_match_confidence = 'high'`. Default projected fields: phone, website, primaryCategory, originCountry, originRegion, neighborhood.
- **Manual sync**: operator opens diff modal, picks fields explicitly. Overwrites operator-entered seed values; provenance row preserves the audit trail.
- **Origin country/region/neighborhood** → merged into `directory_listings_list.keywords[]` as prefixed tokens (`origin_country:Senegal`, `neighborhood:Broad Ripple`) for SEO.
- **Primary category** projection also mirrors to `directory_presence_seeds.category` so `/place` browse pages stay consistent.
- **Directory profiles** (JSON) → provenance row only (not flattened onto listing).

### Frontend
- `apps/web/src/services/DirectoryPresenceAdminService.ts` — `listCampaignLinks`, `findCampaignCandidates`, `getCampaignDiff`, `linkCampaign`, `unlinkCampaign`, `syncFromCampaign` + types `DirectorySeedCampaignLink`, `DirectoryCampaignCandidate`, `DirectoryCampaignDiffEntry`
- `apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/LinkedCampaignsPanel.tsx` — panel with:
  - Linked campaign cards (role badge, NAP confidence badge, last sync metadata, expandable NAP match details)
  - "Link Campaign" picker modal (search + role selector + candidate list with already-linked state)
  - "Sync" diff modal (per-field campaign-vs-seed comparison, checkbox select, project button)
  - "Unlink" with confirm (warns that projected fields stay)
- Mounted on seed detail page after the Outreach & Enrichment section

### Provenance field keys (new, campaign-sourced)
- `origin_country`, `origin_region`, `neighborhood`, `description`, `directory_profile`
- All campaign-sourced provenance: `source_name = 'linked_campaign'`, `source_url = /settings/admin/marketing-ops/recovery/:campaignId`, `confidence = 'high'`, `show_on_public = true`

## V3.1 Entry Presence Tier (Migration 231)

Implements the V3.1 tier strategy: `directory_presence` (free gateway) → Entry Presence triad (`presence`, `discovery`, `storefront`) → Commerce tiers → Scale tiers. The `presence` tier is a clean directory-enrichment-only tier (display name "Starter", $19/mo) that does NOT inherit Google or platform marketplace capabilities. The legacy `starter` tier remains dormant and inactive.

Strategy source of truth: `docs/PLATFORM_STRATEGY_V3.md`
Progressive upgrade spec: `docs/LocalBiz/directory_presence_progressive_upgrade_spec.md`
Tier hierarchy skill: `.devin/skills/tier-hierarchy.md`

### Tier taxonomy
| Key | Layer | Price | Display | Role |
|-----|-------|------:|---------|------|
| `directory_presence` | Gateway | $0 | Directory Presence | Free seed/claim on-ramp |
| `presence` | Entry Presence | $19 | Starter | Paid in-house directory surface (logo, about, gallery, layouts) |
| `discovery` | Entry Presence | $29 | Discovery | Google visibility surface |
| `storefront` | Entry Presence | $59 | Storefront | Platform marketplace/storefront surface |
| `commitment` | Commerce | $79 | Commitment | Deposit-only money mode |
| `ecommerce` | Commerce | $99 | E-commerce | Full-payment money mode |
| `omnichannel` | Commerce | $149 | Omnichannel | Deposit + full-payment mode |
| `professional` | Scale | $199 | Professional | Advanced single-location tier |
| `organization` | Scale | $499 | Organization | Organization tier |
| `enterprise` | Scale | $499 | Enterprise | Multi-location/enterprise tier |

Legacy inactive tiers (do NOT reactivate): `starter`, `google_only`, `chain_starter`.

### Hierarchy
```text
directory_presence: []
presence:           [directory_presence]
discovery:          [directory_presence]
storefront:         [discovery, directory_presence]
```
`presence` does NOT inherit `google_only` or `starter`. It is directory enrichment only.

### Migration 231
- `database/migrations/231_entry_presence_tier.sql`
- Adds `billing_type` column to `subscription_tiers_list` (default `'subscription'`, `directory_presence` set to `'none'`)
- Inserts `presence` tier row ($19, sort_order=10, `billing_type='subscription'`)
- Seeds 6 directory-entry feature keys: `directory_entry_logo_on`, `directory_entry_about_on`, `directory_entry_gallery_on`, `directory_entry_social_on`, `directory_entry_layout_editorial`, `directory_entry_layout_immersive`
- Links features to `directory_entry` capability type
- Seeds `tier_features_list` for `presence` (directory enrichment only)
- Renumbers active V3 tier sort orders (0/10/20/30/40/50/60/70/80/90)

### Backend
- `apps/api/src/services/resolvers/DirectoryEntryOptionsResolver.ts` — reads `directory_entry_logo_on` / `directory_entry_about_on` (with `_enabled` fallbacks); produces `logo_enabled`, `can_show_logo`, `about_enabled`, `can_show_about`
- `apps/api/src/services/resolvers/types.ts` — `EffectiveDirectoryEntryOptions` includes the 4 new fields
- `apps/api/src/routes/public-tenant-capabilities.ts` — expired capability response includes false-valued logo/about fields
- `apps/api/src/routes/directory-presence-upgrade.ts` — V3.1 gateway upgrade API:
  - GET `/:tenantId/upgrade/options` — when current tier is `directory_presence`, returns the triad (`presence`, `discovery`, `storefront`) with mode metadata (`mode`, `surface`, `tagline`, `isPrimary`) and `isGatewayUpgrade: true`; non-gateway tenants get the flat sort_order ladder
  - POST `/:tenantId/upgrade` — enforces: from gateway, only the three Entry Presence modes are valid targets (`invalid_gateway_upgrade_target` error otherwise); paid tiers require `paymentMethodId`
- `apps/api/src/middleware/tier-access.ts` — `presence` added to `TIER_HIERARCHY`, `tierOrder`, display names, pricing
- `apps/api/src/utils/tier-limits.ts` — `presence` added to `SubscriptionTier` type and `TIER_LIMITS` (maxSkus: 0 — directory mode, no catalog)
- `apps/api/src/utils/trial-tier-transparency.ts` — `trial_presence` → `presence` mapping
- `apps/api/src/services/GrowthTipService.ts` — `presence` added to `TIER_ORDER`

### Frontend
- `apps/web/src/lib/tiers/tier-features.ts` — clean `presence` entry (directory-mode only); `TIER_HIERARCHY.presence = ['directory_presence']`; `TIER_DISPLAY_NAMES.presence = 'Starter'`; `TIER_PRICING.presence = 19`
- `apps/web/src/lib/tiers/tier-resolver.ts` — `presence` in `TierInfo['level']`, `mapTierLevel`, hierarchy comparison, upgrade options
- `apps/web/src/lib/tiers/content-consistency.ts` — `presence` progression entry
- `apps/web/src/lib/growth-tips/tipEngine.ts` — `presence` in `TIER_ORDER`
- `apps/web/src/services/CapabilityResolutionService.ts` — `logoEnabled`, `aboutEnabled`, `canShowLogo`, `canShowAbout`
- `apps/web/src/services/UnifiedCapabilityService.ts` — `BackendEffectiveDirectoryEntry` extended; `mapDirectoryEntry()` maps snake_case → camelCase
- `apps/web/src/services/DirectoryPresenceUpgradeService.ts` — `UpgradeTierOption` gained `mode`, `surface`, `tagline`, `isPrimary`, `billingType`; `UpgradeOptions` gained `isGatewayUpgrade`
- `apps/web/src/app/t/[tenantId]/settings/subscription/upgrade/page.tsx` — V3.1 mode picker:
  - When `isGatewayUpgrade` is true: renders mode badges (`directory`/`google`/`platform`), taglines, surface labels, "Recommended" badge on Presence
  - Presence card gets blue ring + border highlight as primary CTA
  - Paid tiers show inline Stripe `CardElement` form when selected (SetupIntent flow → `paymentMethodId` → `upgrade()` call)
- `apps/web/src/app/directory/[slug]/page.tsx` — passes `directoryEntryOptions` through `layoutProps`
- `apps/web/src/app/directory/[slug]/layouts/types.ts` — `DirectoryEntryLayoutProps` includes capability state
- All 4 directory layouts (Classic, Editorial, Immersive, Premium) — gate logo with `canShowLogo`, about with `canShowAbout`; default `?? true` so existing tenants keep rendering
- `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx` — gates logo with `dirEntryOpts?.canShowLogo`
- `apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx` — claim success CTA is "Choose Your Presence Mode" (not "Upgrade to Sell Online")
- `apps/web/src/components/dashboard/TierUpgradeCard.tsx` — dashboard CTA is "Choose Your Presence Mode"

### Tests
- `apps/api/src/services/resolvers/CapabilityResolversOnOff.test.ts` — 8 new `DirectoryEntryOptionsResolver` tests (logo/about gating, flexible tier, disabled capability, layout keys)
- `apps/web/src/lib/tiers/entry-presence-tier.test.ts` — 21 tests verifying presence feature boundaries, hierarchy isolation, legacy starter dormancy, gateway free-tier limits
- `apps/web/vitest.config.ts` — vitest config for web app (node environment, `@` alias)

## Profile Repair Briefing Persistence & Opener Bridge (Migration 232)

AI-generated triage and per-issue briefings are persisted as campaign artifacts (not just execution logs) and can be wired into the Openers workspace.

### Schema (Migration 232)
- `mkt_campaigns_list.repair_triage_briefing` JSONB NULL — persists the triage briefing (`scope`, `viability`, `pitch`, `risks`, `recommended_track`, etc.) with provenance metadata (`_execution_id`, `_validated`)

### Backend persistence
- `ProfileRepairPromptService.executeSeekSync()` — after running the triage template (`mpt-profile-repair-triage-default`), parses + validates the AI output, persists the briefing to `repair_triage_briefing` with `_execution_id` and `_validated` flags. Best-effort output (strict Zod fails but `profile_repair_triage` exists) is persisted with `_validated: false`. Unparseable output does NOT overwrite the previous briefing.
- `ProfileRepairPromptService.importExternalResult()` — persists valid imported triage output the same way.
- Per-issue seek templates (`mpt-profile-repair-nap-drift-seek`, etc.) do NOT persist to `repair_triage_briefing` — their output (`profile_repair_audit`) is rendered from `mkt_prompt_executions_list.raw_output` by the frontend.

### Opener bridge
- `OutreachOpenerService.createFromBriefing()` — creates/updates an opener from an AI briefing's `opener_hook`. Mirrors `importOpener` upsert + quality gate + bridge autocomplete logic, but:
  - `source = 'ai_briefing'` (distinct from `'ai'` and `'external'`)
  - `hook_angle = null` (briefing's `primary_angle` is free-text, not a HOOK_LIBRARY key)
  - `extracted_fields` includes `{ sourceBriefing, executionId, primaryAngle }` for provenance
- Route: `POST /api/admin/marketing-ops/openers/from-briefing` (before the catch-all)
- Frontend: `MarketingOpsService.createOpenerFromBriefing()` + `OpenerSource` widened to `'ai' | 'external' | 'ai_briefing'`

### Frontend
- `apps/web/src/components/marketing-ops/RepairTrackPanel.tsx` — reads `campaign.repair_triage_briefing` on mount (survives refresh + track confirmation); re-runs triage with explicit `templateId = 'mpt-profile-repair-triage-default'` (so post-confirmation re-runs don't accidentally run a per-issue seek); shows "Unverified" badge when `_validated === false`; "Create Opener from Hook" button
- `apps/web/src/components/marketing-ops/RepairBriefingCard.tsx` — renders per-issue `profile_repair_audit` executions (scope, impact, pitch, risks) + "Create Opener from Hook" button
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/CampaignDetailClient.tsx` — fetches executions via `listExecutions`, filters by `output_schema.name === 'profile_repair_audit'`, renders `RepairBriefingCard`
- `apps/web/src/app/(platform)/settings/admin/marketing-ops/openers/OpenerWorkspaceClient.tsx` — source badge shows "AI Briefing" for `ai_briefing` source

### Tests
- `apps/api/src/services/__tests__/OutreachOpenerService.test.ts` (4 tests) — create with `source='ai_briefing'`, upsert in place, quality-gate failure doesn't block, provenance fields
- `apps/api/src/services/__tests__/ProfileRepairPromptService.persistence.test.ts` (4 tests) — strict validation pass (`_validated=true`), best-effort (`_validated=false`), unparseable output (no write), per-issue template (no write)



