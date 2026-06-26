# NIL Youth Sports Platform — Migration Design

**Document Version:** 1.0
**Source Platform:** `retail-visibility-platform` (commerce multi-tenant marketplace)
**Target Project:** NIL Youth Sports Platform (new workspace, new git, new Vercel, new Supabase, new Railway)
**Strategy:** Full platform extraction — clone, strip commerce-specifics, rename/repurpose entities to NIL domain, add NIL-specific tables/services on top
**Source Spec:** `TECHNICAL_SPEC.md` (this folder)
**Source Implementation Plan:** `IMPLEMENTATION_PLAN.md` (this folder)

---

## 0. Executive Summary

The existing `retail-visibility-platform` is a mature multi-tenant commerce platform with battle-tested infrastructure: Auth0 authentication, Prisma + PostgreSQL, a two-tier singleton hierarchy (cached public / 0-TTL private), a capability-gating system with tier/merchant resolvers, RLS-enforced tenant isolation, CRM, RAG chatbot, and a Next.js 16 frontend. The NIL Youth Sports platform needs every one of these primitives — just re-skinned for the NIL domain.

**The migration is a fork-and-transform:**

1. Clone the entire `retail-visibility-platform` repo into a new workspace
2. Strip commerce-specific routes/services/tables (products, orders, storefronts, GMC, GBP, etc.)
3. Rename/repurpose commerce entities to NIL equivalents (products → athlete profiles, orders → deals, storefront → roster)
4. Add NIL-specific tables/services from TECHNICAL_SPEC §14 (consent, guardianship, moderation, eligibility, escrow)
5. Reconfigure for new infrastructure (new Vercel, new Supabase, new Railway, new Auth0 tenant)
6. Rebrand UI from "VisibleShelf" to NIL brand

**Why this works:** The TECHNICAL_SPEC §7.1 already established that every commerce capability has a direct NIL analog. The deal-as-purchase model (§12.10) means the financial track is a re-skin of checkout/escrow. The athlete-as-tenant model (§0) means the entire tenant infra is reused as-is. The capability system, singleton hierarchy, proxy, auth, and RLS patterns carry over without architectural changes.

---

## 1. New Infrastructure Setup

### 1.1 New Git Repository

```
mkdir nil-youth-sports-platform
cd nil-youth-sports-platform
git init
```

Clone source platform as upstream, then strip history (we want a clean starting point, not 1000+ commerce commits):

```bash
# Clone source into temp, copy files (no .git)
git clone --depth=1 https://github.com/paulyarl/retail-visibility-platform.git /tmp/rvp-clone
cp -r /tmp/rvp-clone/* /tmp/rvp-clone/.* nil-youth-sports-platform/
rm -rf nil-youth-sports-platform/.git
git add -A
git commit -m "Initial: platform extraction from retail-visibility-platform"
```

### 1.2 New Supabase Project

| Setting | Value |
|---|---|
| Project name | `nil-youth-sports` |
| Database password | (strong password, store in Doppler) |
| Region | Same as Vercel deployment region |
| Plan | Pro (for RLS, pgvector, point-in-time recovery) |

**Post-setup:**
1. Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Run Prisma migrations (after schema cleanup — see §3)
3. Configure RLS policies (see §3.4)
4. Save connection strings to Doppler:
   - `DATABASE_URL` — pooled connection (via Supabase pooler)
   - `DIRECT_URL` — direct connection (for migrations)

### 1.3 New Auth0 Tenant

| Setting | Value |
|---|---|
| Tenant domain | `nil-youth-sports.us.auth0.com` (or custom domain) |
| Application type | Regular Web Application (Next.js) |
| Callback URLs | `http://localhost:3000/api/auth/callback`, `https://nil-youth-sports.vercel.app/api/auth/callback` |
| Logout URLs | `http://localhost:3000`, `https://nil-youth-sports.vercel.app` |

**Roles to create (TECHNICAL_SPEC §1):**
- `ATHLETE` — minor; no financial scope until age-out
- `GUARDIAN` — consent authority; KYC subject
- `INSTITUTION_ADMIN` — school/club tenant admin
- `COACH` — acts within an institution-tenant
- `SPONSOR` — commercial tenant; deal flow
- `FAN` — authenticated; always-free
- `PLATFORM_ADMIN` — internal
- `COMPLIANCE_AUDITOR` — internal

**Auth0 env vars (store in Doppler):**
- `AUTH0_SECRET`
- `AUTH0_BASE_URL`
- `AUTH0_ISSUER_BASE_URL`
- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_AUDIENCE`

### 1.4 New Vercel Project

| Setting | Value |
|---|---|
| Framework | Next.js |
| Root directory | `apps/web` |
| Build command | `cross-env NODE_OPTIONS=--max-old-space-size=4096 next build --webpack` |
| Output directory | `.next` |
| Install command | `pnpm install` |

**Environment variables (Vercel → Doppler integration or manual):**
- All `NEXT_PUBLIC_*` vars
- `AUTH0_*` vars
- `NEXT_PUBLIC_API_URL` → Railway API URL
- `DATABASE_URL` / `DIRECT_URL` → Supabase pooler URLs

**Deploy order:** API (Railway) first, then Web (Vercel).

### 1.5 New Railway Deployment

| Setting | Value |
|---|---|
| Service name | `nil-youth-sports-api` |
| Source | GitHub repo → `apps/api` directory |
| Start command | `node dist/index.js` |
| Build command | `node build-with-selective-errors.js` |

**Railway environment variables (via Doppler):**
- `DATABASE_URL` / `DIRECT_URL` → Supabase
- `AUTH0_*` vars
- `PORT` → Railway-provided
- All API-side secrets (Stripe, SendGrid, OpenAI, etc.)

### 1.6 Doppler Configuration

Create three Doppler configs:
- `local` — local development
- `dev` — staging (Vercel preview + Railway dev)
- `prd` — production

**Key secrets to configure:**
| Secret | Source |
|---|---|
| `DATABASE_URL` | Supabase pooler (transaction mode) |
| `DIRECT_URL` | Supabase direct (session mode) |
| `AUTH0_SECRET` | `openssl rand -hex 32` |
| `AUTH0_*` | Auth0 dashboard |
| `STRIPE_SECRET_KEY` | Stripe dashboard (new account for NIL) |
| `SENDGRID_API_KEY` | SendGrid (new or existing) |
| `OPENAI_API_KEY` | OpenAI dashboard |
| `NEXT_PUBLIC_API_URL` | Railway API URL |

---

## 2. Platform Extraction — What Stays, What Goes

### 2.1 KEEP (Core Infrastructure — Reused As-Is or Renamed)

| Layer | Files/Patterns | Action |
|---|---|---|
| **Singleton hierarchy (web)** | `FlexibleApiSingleton`, `PublicApiSingleton`, `TenantApiSingleton`, `CustomerApiSingleton`, `AuthenticatedApiSingleton`, `AdminApiSingleton` | Keep as-is; add NIL bases on top (§4.1) |
| **UniversalSingleton (api)** | `apps/api/src/lib/UniversalSingleton.ts` | Keep as-is |
| **ID generators** | `apps/api/src/lib/id-generator.ts` — `generateTenantId`, `generateTenantKey`, `generateUserId`, nanoid pattern | Keep core generators; add NIL-specific generators (§4.2) |
| **Auth middleware** | `apps/api/src/middleware/auth.ts` (authenticateToken, checkTenantAccess), `role-validation.ts`, `permissions.ts` | Keep; add NIL roles to validation |
| **Proxy** | `apps/web/src/proxy.ts` — Auth0 session, subdomain routing, tenant context | Keep; update `PLATFORM_DOMAINS` to NIL brand domain |
| **Capability system** | `EffectiveCapabilityResolver.ts`, `resolvers/` directory, `types.ts`, `capability_features_list`, `features_list`, `tier_features_list`, `capability_type_list` Prisma models | Keep entire system; replace commerce resolvers with NIL resolvers (§4.3) |
| **Tier system** | `TierService.ts`, `TierSingletonService.ts`, `subscription_tiers_list` model, `subscription-billing.ts` | Keep; reconfigure tiers for payer-keyed model (institutions/sponsors pay, athletes/guardians/fans free) |
| **CRM** | All `Crm*Service.ts`, `crm_*` Prisma models, CRM routes, CRM frontend components | Keep; add `athlete_tenant_id`/`guardian_id` columns + NIL actor types (§4.5) |
| **Bot/RAG** | `BotRagService.ts`, `BotDynamicResponseService.ts`, `BotGuardrailService.ts`, `bot_*` Prisma models, bot routes, bot widgets | Keep; add NIL bot personas + child-safety guardrails (§4.6) |
| **Auth0 integration** | `@auth0/nextjs-auth0`, `AuthContext.tsx`, `AuthSyncService`, `auth-sync.ts` route | Keep; point to new Auth0 tenant |
| **Server-resolved context** | `ServerResolvedContextProvider.tsx`, server layout pattern | Keep; adapt for NIL actor types |
| **Cache system** | `contextAwareCacheService`, `contextAwareCacheManager`, `correlation-id.ts`, `cross-context-cache-invalidation.md` skill | Keep as-is |
| **Prisma setup** | `prisma/schema.prisma` structure, `prisma/` directory, migration workflow | Keep; strip commerce models, add NIL models |
| **Express server** | `apps/api/src/index.ts`, route mounting pattern, helmet, cors, rate-limit | Keep; remount NIL routes |
| **Payment infra** | `payments/` services, Stripe integration, escrow patterns, `checkout/` routes | Keep; repurpose for deal-as-purchase (§4.4) |
| **Subscription billing** | `subscription-billing.ts`, `tenant-billing.ts`, Stripe subscription webhooks | Keep; repurpose for institution/sponsor tier subscriptions |
| **BSaaS purchase flow** | `bsaas-purchases.ts` route, `BsaasAnalyticsService.ts` | Keep; repurpose for NIL deal purchase flow |
| **Email service** | `email-service.ts`, `email/` providers, SendGrid integration | Keep; update templates for NIL brand |
| **Audit/logging** | `audit-logger.ts`, `structured-logging.md` skill, `correlation-id-troubleshooting.md` skill | Keep as-is |
| **Rate limiting** | `rate-limit.ts`, `RateLimitingService.ts` | Keep; add child-safety rate limits (profile view/follow limits) |
| **Security** | `security.ts`, `security-headers.ts`, `csrf.ts`, `ssrf-protection.ts`, `threat-detection.ts` | Keep as-is |
| **Organizations** | `organizations.ts` route, org model | Keep; repurpose for institution/sponsor org structures |
| **Navigation** | Database-driven nav system, `NavigationLinksService.ts`, `useNavLinks.tsx` | Keep; reseed nav links for NIL sidebar |
| **Dashboard primitives** | `CrmPageShell.tsx`, `CrmNavPanel.tsx`, `TenantDashboardV2.tsx`, `CapabilityShowcase.tsx`, `PlanSummaryPanel.tsx` | Keep; rebrand for NIL |
| **Mantine UI** | All Mantine components, Tailwind config, theme | Keep; rebrand colors/logo |
| **i18n** | `i18next`, `react-i18next`, PR template | Keep; add NIL-specific translations |
| **Sentry/error tracking** | `@sentry/node`, `@sentry/nextjs` | Keep; new Sentry project for NIL |
| **CCPA/GDPR** | `ccpa.ts`, `gdpr.ts`, `CcpaComplianceService.ts`, `gdpr-compliance.ts`, `account-deletion.ts` | Keep; extend for COPPA right-to-erasure for minors |

### 2.2 DROP (Commerce-Specific — Remove from New Repo)

| Layer | Files | Reason |
|---|---|---|
| **Products** | `products/` routes, `ProductService.ts`, `SingleProductService.ts`, `ProductCacheService.ts`, `ProductOptionsService.ts`, `variant-aware-products*.ts`, `variants*.ts`, `variant-bulk-operations*.ts`, `cached-products.ts`, `product-featuring.ts`, `product-likes.ts`, `product-cache-singleton.ts` | No products in NIL; athlete profiles replace products |
| **Inventory** | `inventory/` routes, `InventoryService.ts`, `InventorySingletonService.ts`, `InventoryTransferService.ts`, `InventoryScopeService.ts`, `StockService.ts` | No physical inventory in NIL |
| **Storefronts** | `storefront.ts`, `storefront-featured.ts`, `storefront-options-settings.ts`, `storefront-type-settings.ts`, `storefront-policies.ts`, `StoreService.ts`, `StorefrontOptionsService.ts`, `StorefrontTypeService.ts`, `StorefrontPolicyService.ts`, `shop-management.ts`, `shops.ts`, `shops-featured.ts`, `ShopService.ts`, `ShopManagementService.ts`, `ShopsFeaturedService.ts` | Replaced by NIL roster/athlete profiles |
| **Google integrations** | `google-business-oauth.ts`, `google-merchant-oauth.ts`, `gbp-*.ts`, `GBP*Service.ts`, `GMCProductSync.ts`, `gmc-product-sync-singleton.ts`, `taxonomy*.ts`, `TaxonomySync*.ts`, `GoogleTaxonomyService.ts` | No Google Business Profile / Google Merchant Center in NIL |
| **Barcode/scan** | `barcode-*.ts`, `scan.ts`, `scan-metrics.ts`, `BarcodeEnrichmentService.ts`, `BarcodeEnrichmentSingletonService.ts` | No barcodes in NIL |
| **Clover/Square** | `clover-*.ts`, `CloverOAuth*.ts`, `square/` services | May retain Stripe-only for payments; drop other gateways initially |
| **Directory** | `directory-*.ts` (all directory routes), `DiscoveryService.ts`, `BaseDiscoveryService.ts`, `directory/` frontend pages | Replace with NIL-specific directory (athlete discovery by coaches/sponsors) |
| **Featured products** | `featured-products*.ts`, `FeaturedProductsService.ts`, `FeaturedProductsSingletonService.ts`, `FeaturedService.ts`, `featured-options-settings.ts`, `FeaturedOptionsService.ts` | Replace with NIL featured athletes |
| **Cart/checkout (commerce)** | `cart.ts`, `shopping-carts.ts`, `checkout.ts` (commerce checkout), `buyer-orders.ts` | Repurpose checkout for deal-as-purchase, but drop cart/shopping-cart |
| **Digital downloads** | `digital-asset-singleton.ts`, `digital-downloads.ts`, `DigitalAssetSingletonService.ts`, `DigitalDownloadPageService.ts`, `downloads/` | No digital downloads in NIL |
| **Cross-tenant products** | `cross-tenant-products.ts` | Replaced by cross-tenant deals |
| **Catalog adoption** | `catalog-adoption.ts`, `catalog-slugs.ts`, `global-catalog.ts` | No catalog in NIL |
| **Meta/TikTok social commerce** | `meta-oauth.ts`, `MetaCatalogSyncService.ts`, `social-pixels.ts`, `SocialPixelService.ts`, `social-commerce-options-settings.ts` | Drop social commerce integrations (future phase) |
| **Recommendations** | `recommendationService.ts`, `recommendation-singleton.ts`, `RecommendationSingletonService.ts` | May rebuild for NIL athlete recommendations later |
| **GBP sync** | All `GBP*` files | No Google Business Profile in NIL |
| **Store reviews** | `store-reviews.ts`, `ReviewsService.ts` | Replaced by athlete achievement verification |
| **Abandoned carts** | `abandoned-carts.ts`, `AbandonedCartService.ts` | No carts in NIL |
| **Deposit forfeiture** | `deposit-forfeiture.ts`, `DepositForfeitureService.ts` | Replaced by escrow milestone logic |
| **Shipments** | `shipments.ts`, `ShipmentStatusService.ts` | No physical shipping in NIL |
| **Smart sale tagging** | `smart-sale-tagging.ts` | No sales in NIL |
| **Slug generation (commerce)** | `slug-generation.ts`, `SlugSingletonService.ts` | May keep for athlete profile slugs; evaluate |
| **Business hours** | `business-hours.ts`, `BusinessHoursService.ts` | Not needed for NIL |
| **Location availability** | `location-availability.ts`, `hero-location.ts`, `HeroLocationService.ts`, `GeocodingService.ts` | Not needed for NIL (coarse location only) |
| **Feed jobs** | `feed-jobs.ts`, `feed-validation.ts` | No product feeds in NIL |
| **Publishing** | `publishing.ts` | Replaced by visibility status transitions |
| **Quick start** | `quick-start.ts`, `QuickstartOptionsService.ts`, `quickstart-options-settings.ts` | Replace with NIL onboarding flow |
| **Image enrichment** | `image-enrichment.ts`, `ImageEnrichmentService.ts`, `AIImageService.ts`, `AIImageSingletonService.ts` | Drop; may add athlete photo moderation later |
| **Override analytics/cache** | `OverrideAnalyticsService.ts`, `OverrideCacheService.ts` | Commerce-specific; drop |
| **Performance monitor/tester** | `ShopsPerformanceMonitor.ts`, `ShopsPerformanceTester.ts` | Commerce-specific; drop |
| **Clone tool** | `clone.ts` | Commerce tenant cloning; drop |

### 2.3 EVALUATE (Keep or Drop Based on NIL Needs)

| File | Decision Criteria |
|---|---|
| `branding.ts` | Keep if NIL needs per-tenant branding; likely keep for institutions/sponsors |
| `business-profile-validation.ts` | Keep if institutions/sponsors need profile validation |
| `customer-auth.ts`, `CustomerAuthService.ts` | Keep — repurpose for fan/guardian authentication |
| `customer-addresses.ts`, `customer-payment-methods.ts` | Keep payment methods (guardian payout routing); drop addresses |
| `customer-notifications.ts` | Keep — repurpose for NIL notifications |
| `tenant-logo.ts` | Keep for institution/sponsor logos |
| `promotion.ts` | Drop; NIL deals don't use promotions |
| `tax.ts`, `TaxService.ts` | Keep — needed for 1099 tax reporting on NIL payouts |
| `refund-singleton.ts`, `RefundSingletonService.ts` | Keep — escrow refund logic for deals |
| `integration-options-settings.ts`, `IntegrationOptionsService.ts` | Keep if NIL needs integration toggles |

---

## 3. Database Migration Plan

### 3.1 Prisma Schema Transformation

The existing `schema.prisma` has ~200+ models. The migration transforms it in three passes:

**Pass 1: Strip commerce models** — Remove all product, inventory, storefront, directory, barcode, GBP, GMC, digital download, cart, shipment, business hours, feed, and related models.

**Pass 2: Rename/repurpose models** — Rename commerce concepts to NIL equivalents where there's a direct mapping.

**Pass 3: Add NIL models** — Add new models from TECHNICAL_SPEC §14 (athlete profiles, guardians, consent, memberships, deals, escrow, moderation, etc.).

### 3.2 Model Rename/Repurpose Map

| Commerce Model | NIL Model | Transformation |
|---|---|---|
| `tenants` | `tenants` (unchanged) | Add `tenant_type` column (`nil_tenant_type` enum: athlete/institution/sponsor) |
| `subscription_tiers_list` | `subscription_tiers_list` (unchanged) | Reconfigure tiers: institution tiers, sponsor tiers, platform-default for free actors |
| `features_list` | `features_list` (unchanged) | Replace commerce feature keys with NIL feature keys |
| `capability_features_list` | `capability_features_list` (unchanged) | Re-link to NIL capability types |
| `capability_type_list` | `capability_type_list` (unchanged) | Replace commerce capability types with NIL types |
| `tier_features_list` | `tier_features_list` (unchanged) | Re-link to NIL features/tiers |
| `crm_support_tickets` | `crm_support_tickets` (unchanged) | Add `athlete_tenant_id`, `guardian_id` columns + guardian-required trigger |
| `crm_inquiries` | `crm_inquiries` (unchanged) | Add `athlete_tenant_id`, `guardian_id` columns |
| `crm_tasks` | `crm_tasks` (unchanged) | No change |
| `crm_activities` | `crm_activities` (unchanged) | No change |
| `crm_alerts` | `crm_alerts` (unchanged) | No change |
| `crm_contacts` | `crm_contacts` (unchanged) | No change |
| `bot_conversations` | `bot_conversations` (unchanged) | Add `athlete_tenant_id`, `guardian_id`, `is_minor_safe` columns |
| `bot_messages` | `bot_messages` (unchanged) | No change |
| `bot_configurations` | `bot_configurations` (unchanged) | No change |
| `bot_faq_embeddings` | `bot_faq_embeddings` (unchanged) | Re-seed with NIL eligibility/consent KB |
| `bot_guardrail_rules` | `bot_guardrail_rules` (unchanged) | Re-seed with child-safety guardrails |
| `bot_product_embeddings` | `bot_athlete_embeddings` | Rename; re-index from athlete profiles instead of products |
| `orders` | `nil_deals` | Rename; repurpose columns (order → deal, buyer → sponsor, seller → athlete-tenant) |
| `order_items` | `nil_deal_milestones` | Rename; repurpose for escrow milestones |
| `payments` | `nil_payments` | Rename; repurpose for deal payouts (guardian payee) |
| `payment_gateways` | `payment_gateways` (unchanged) | Keep for Stripe; drop Clover/Square initially |
| `stripe_*` models | `stripe_*` (unchanged) | Keep for subscription billing + deal payments |
| `subscription_*` models | `subscription_*` (unchanged) | Keep for institution/sponsor tier subscriptions |
| `organizations` | `organizations` (unchanged) | Keep for institution/sponsor org structures |
| `navigation_links` | `navigation_links` (unchanged) | Re-seed with NIL sidebar links |
| `audit_log` | `audit_log` (unchanged) | Keep for compliance audit trail |
| `users` | `users` (unchanged) | Keep; add NIL role mappings |
| `user_tenants` | `user_tenants` (unchanged) | Keep; links users to athlete/institution/sponsor tenants |
| `abandoned_carts` | (DROP) | No carts in NIL |
| `products` | (DROP → replaced by `athlete_profiles_list`) | |
| `product_variants` | (DROP) | |
| `categories` | (DROP) | |
| `storefronts` | (DROP → replaced by NIL roster) | |
| `directory_*` views/tables | (DROP → replaced by NIL athlete directory) | |
| `barcode_*` | (DROP) | |
| `google_*` | (DROP) | |
| `digital_*` | (DROP) | |
| `inventory_*` | (DROP) | |
| `shipment_*` | (DROP) | |
| `business_hours_*` | (DROP) | |
| `store_reviews` | (DROP) | |
| `featured_products` | (DROP → replaced by featured athletes) | |
| `mv_storefront_discovery` | `mv_athlete_discovery` | Rename materialized view; query from athlete profiles instead of products |

### 3.3 New NIL Models to Add (from TECHNICAL_SPEC §14)

All new models follow platform conventions: `*_list` table names, `VARCHAR(255)` IDs, explicit IDs from service layer, `timestamptz` UTC, RLS policies.

**Enums (§14.1):**
- `nil_tenant_type` — athlete, institution, sponsor
- `nil_visibility_status` — draft, pending, approved, rejected, archived
- `nil_compliance_status` — not_started, in_review, cleared, blocked
- `nil_moderation_status` — pending, cleared, rejected
- `nil_age_band` — under_13, 13_to_17, adult
- `nil_consent_scope` — public_profile, gpa_display, media_display, nil_deals, messaging
- `nil_relationship_type` — parent, legal_guardian, custodial
- `nil_escrow_state` — proposed, funded, locked, milestone_released, settled, disputed, refunded

**Tables (§14.2–14.9):**
- `athlete_profiles_list` — 1:1 with athlete-tenant
- `guardians_list` — global guardian accounts (KYC subjects)
- `guardian_athlete_links_list` — many-to-many ownership (guardian ↔ athlete-tenant)
- `athlete_tenant_memberships_list` — cross-tenant (athlete ↔ institution)
- `consent_records_list` — versioned, scoped consent ledger
- `highlight_media_list` — athlete media (allowlisted hosts, moderation state)
- `athlete_metrics_list` — sport-agnostic stats (jsonb)
- `athlete_achievements_list` — verified milestones
- `recruiting_boards_list` — coach boards (institution-scoped)
- `scout_ratings_list` — private star ratings
- `sponsorship_deals_list` — cross-tenant deals (dual-visibility RLS)
- `escrow_milestones_list` — deal escrow state machine
- `nonprofit_allocation_pools_list` — double-entry ledger
- `nil_eligibility_rules_list` — state/association/bylaw rules
- `moderation_cases_list` — content moderation queue
- `message_threads_list` — guardian-gated messaging
- `fan_badges_list` — gamified fan engagement
- `nil_leads_list` — pre-tenant lead capture
- `data_erasure_requests_list` — right-to-erasure workflow
- `payout_schedules_list` — deal payout schedules
- `sponsor_spend_limits_list` — sponsor ROI caps
- `nil_offers_list` — base NIL offers
- `nil_events_list` — event track (schedules, tryouts, signatures)
- `tenant_nil_crm_options_settings` — NIL CRM merchant prefs
- `tenant_nil_bot_options_settings` — NIL bot merchant prefs

**Options settings tables (per capability, §7):**
- `tenant_nil_roster_options_settings`
- `tenant_nil_guardian_options_settings`
- `tenant_nil_recruiting_options_settings`
- `tenant_nil_sponsorship_options_settings`
- `tenant_nil_achievements_options_settings`
- `tenant_nil_fan_options_settings`
- `tenant_nil_finance_options_settings`

### 3.4 RLS Policy Migration

The existing platform uses `current_setting('app.current_tenant', true)` for RLS. This mechanism carries over unchanged.

**Athlete-owned tables (§14.10):**
```sql
ALTER TABLE athlete_profiles_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY athlete_isolation ON athlete_profiles_list
  USING (tenant_id = current_setting('app.current_tenant', true));
```

**Cross-tenant tables (dual-visibility):**
```sql
ALTER TABLE sponsorship_deals_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY deal_dual_visibility ON sponsorship_deals_list
  USING (
    athlete_tenant_id = current_setting('app.current_tenant', true)
    OR sponsor_tenant_id = current_setting('app.current_tenant', true)
  );
```

**CRM guardian-required trigger (§14.11):**
```sql
CREATE OR REPLACE FUNCTION nil_require_guardian_for_minor() RETURNS trigger AS $$
BEGIN
  IF NEW.athlete_tenant_id IS NOT NULL AND NEW.guardian_id IS NULL
     AND EXISTS (
       SELECT 1 FROM athlete_profiles_list p
       WHERE p.tenant_id = NEW.athlete_tenant_id AND p.age_band <> 'adult'
     )
  THEN RAISE EXCEPTION 'NIL: minor-subject CRM record requires guardian_id';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

### 3.5 Migration Execution Order

1. **Create new Supabase project** (empty database)
2. **Strip commerce models from `schema.prisma`** — remove all DROP models from §3.2
3. **Rename repurposed models** — apply renames from §3.2
4. **Add NIL models** — add all §3.3 models to `schema.prisma`
5. **Generate initial migration** — `prisma migrate dev --name nil_initial_schema`
6. **Run migration** on new Supabase
7. **Enable pgvector** — `CREATE EXTENSION IF NOT EXISTS vector;`
8. **Create RLS policies** — apply all §3.4 policies
9. **Create triggers** — guardian-required trigger on CRM tables
10. **Create materialized view** — `mv_athlete_discovery` (replaces `mv_storefront_discovery`)
11. **Seed base data** — tiers, features, capability types, eligibility rules, nav links, bot guardrails

---

## 4. Code Migration Plan

### 4.1 NIL Base Singleton Classes (TECHNICAL_SPEC §13)

Add to `apps/web/src/services/base/`:

| NIL Base | Extends | File | TTL | Header |
|---|---|---|---|---|
| `NilPublicApiSingleton` | `PublicApiSingleton` | `NilPublicApiSingleton.ts` | 5–15 min | none |
| `AthleteApiSingleton` | `TenantApiSingleton` | `AthleteApiSingleton.ts` | 0 | `X-Tenant-ID` = athlete-tenant |
| `InstitutionApiSingleton` | `TenantApiSingleton` | `InstitutionApiSingleton.ts` | 0 | `X-Tenant-ID` = institution |
| `SponsorApiSingleton` | `TenantApiSingleton` | `SponsorApiSingleton.ts` | 0 | `X-Tenant-ID` = sponsor |
| `GuardianApiSingleton` | `CustomerApiSingleton` | `GuardianApiSingleton.ts` | 0 | `X-Guardian-ID` |
| `FanApiSingleton` | `AuthenticatedApiSingleton` | `FanApiSingleton.ts` | short | `X-User-ID` |
| `ComplianceApiSingleton` | `AdminApiSingleton` | `ComplianceApiSingleton.ts` | 0 | `X-Audit-ID` |

### 4.2 ID Generators to Add (TECHNICAL_SPEC §6)

Add to `apps/api/src/lib/id-generator.ts`:

| Generator | Prefix | Format |
|---|---|---|
| `generateAthleteTenantId()` | `tid` | `tid-{nanoid}` (reuses `generateTenantId()`) |
| `generateGuardianId()` | `guard` | `guard-{nanoid}` |
| `generateGuardianAthleteLinkId(athleteTenantId, guardianId)` | `gown` | `gown-{atk}-{guardianId}-{nanoid}` |
| `generateAthleteMembershipId(athleteTenantId, institutionTenantId)` | `amem` | `amem-{atk}-{instTk}-{nanoid}` |
| `generateHighlightId(athleteTenantId)` | `hl` | `hl-{atk}-{nanoid}` |
| `generateAthleteMetricsId(athleteTenantId)` | `metric` | `metric-{atk}-{nanoid}` |
| `generateAchievementId(athleteTenantId)` | `ach` | `ach-{atk}-{nanoid}` |
| `generateConsentRecordId(athleteTenantId)` | `consent` | `consent-{atk}-{nanoid}` |
| `generateSponsorshipDealId(athleteTenantId, sponsorTenantId)` | `deal` | `deal-{atk}-{sponsorTk}-{nanoid}` |
| `generateNilOfferId(athleteTenantId)` | `niloffer` | `niloffer-{atk}-{nanoid}` |
| `generateEscrowId(athleteTenantId)` | `escrow` | `escrow-{atk}-{nanoid}` |
| `generateNilEventId(athleteTenantId)` | `nilevt` | `nilevt-{atk}-{nanoid}` |
| `generateBadgeAwardId(athleteTenantId)` | `badge` | `badge-{atk}-{nanoid}` |
| `generateThreadId(athleteTenantId)` | `thread` | `thread-{atk}-{nanoid}` |
| `generateModerationCaseId(athleteTenantId)` | `mod` | `mod-{atk}-{nanoid}` |
| `generateRecruitingBoardId(institutionTenantId)` | `board` | `board-{instTk}-{nanoid}` |
| `generateNilLeadId()` | `nillead` | `nillead-{nanoid}` |

### 4.3 Capability Resolvers (Replace Commerce → NIL)

**Remove (commerce resolvers):**
- `CommerceResolver.ts` → replaced by `NilRosterResolver.ts`
- `PaymentGatewayResolver.ts` → keep (shared infra for deal payments)
- `StorefrontTypeResolver.ts` → replaced by `NilLandingResolver.ts`
- `FulfillmentResolver.ts` → drop
- `BarcodeScanResolver.ts` → drop
- `ProductOptionsResolver.ts` → replaced by `NilRosterOptionsResolver.ts`
- `FeaturedOptionsResolver.ts` → replaced by `NilAchievementsResolver.ts`
- `IntegrationOptionsResolver.ts` → drop or keep for NIL integrations
- `QuickstartOptionsResolver.ts` → drop
- `StorefrontOptionsResolver.ts` → replaced by `NilLandingResolver.ts`
- `DirectoryEntryOptionsResolver.ts` → replaced by `NilRosterResolver.ts` (directory facet)
- `FaqOptionsResolver.ts` → keep (shared infra for NIL bot KB)
- `CrmOptionsResolver.ts` → replaced by `NilCrmOptionsResolver.ts`
- `ChatbotOptionsResolver.ts` → replaced by `NilBotOptionsResolver.ts`
- `OrgOptionsResolver.ts` → keep (shared infra)
- `SocialCommerceOptionsResolver.ts` → drop

**Add (NIL resolvers):**

| Resolver | File | Capability Key |
|---|---|---|
| `NilLandingResolver` | `NilLandingResolver.ts` | `nil_landing` |
| `NilRosterResolver` | `NilRosterResolver.ts` | `nil_roster` |
| `NilGuardianResolver` | `NilGuardianResolver.ts` | `nil_guardian` |
| `NilRecruitingResolver` | `NilRecruitingResolver.ts` | `nil_recruiting` |
| `NilSponsorshipResolver` | `NilSponsorshipResolver.ts` | `nil_sponsorship` |
| `NilAchievementsResolver` | `NilAchievementsResolver.ts` | `nil_achievements` |
| `NilFanNetworkResolver` | `NilFanNetworkResolver.ts` | `nil_fan_network` |
| `NilComplianceResolver` | `NilComplianceResolver.ts` | `nil_compliance` |
| `NilFinanceResolver` | `NilFinanceResolver.ts` | `nil_finance` |
| `NilCrmOptionsResolver` | `NilCrmOptionsResolver.ts` | `nil_crm` |
| `NilBotOptionsResolver` | `NilBotOptionsResolver.ts` | `nil_bot` |

**Update `EffectiveCapabilityResolver.ts`:**
- Replace commerce resolver imports with NIL resolver imports
- Update `MerchantSettingsBundle` type to include NIL settings tables
- Update `resolveEffectiveCapabilities()` to dispatch to NIL resolvers

### 4.4 Backend Services (Replace Commerce → NIL)

**Remove (commerce services):**
- All services listed in §2.2 DROP list

**Add (NIL services — from TECHNICAL_SPEC §9):**

| Service | Base | File | Responsibility |
|---|---|---|---|
| `AthleteProfileService` | `PermissionEnhancedBaseService` | `AthleteProfileService.ts` | CRUD on athlete-tenant profiles, status transitions |
| `NilRosterService` | `UniversalSingleton` | `NilRosterService.ts` | Public approved roster reads (cached per-atk) |
| `GuardianConsentService` | `BaseService` | `GuardianConsentService.ts` | Scoped consent grant/revoke, ownership checks |
| `AthleteMembershipService` | `BaseService` | `AthleteMembershipService.ts` | Cross-tenant memberships (transfers) |
| `RecruitingBoardService` | `BaseService` | `RecruitingBoardService.ts` | Coach boards, private ratings |
| `SponsorshipService` | `PermissionEnhancedBaseService` | `SponsorshipService.ts` | Cross-tenant deals, escrow, spend-cap enforcement |
| `EscrowLedgerService` | `BaseService` | `EscrowLedgerService.ts` | Double-entry escrow + non-profit pool ledger |
| `ComplianceVettingService` | `UniversalSingleton` | `ComplianceVettingService.ts` | State/association eligibility + contract vetting |
| `MediaModerationService` | `BaseService` | `MediaModerationService.ts` | Media moderation queue + allowlist validation |
| `MessagingService` | `BaseService` | `MessagingService.ts` | Guardian-gated threads |
| `FanNetworkService` | `BaseService` | `FanNetworkService.ts` | Follows, feed, badge awards |
| `DataErasureService` | `BaseService` | `DataErasureService.ts` | Right-to-erasure cascade + audit certificate |
| `NilLeadService` | `BaseService` | `NilLeadService.ts` | Pre-tenant lead capture |

**Repurpose (commerce → NIL):**
- `CheckoutService` / `checkout.ts` → repurpose for deal-as-purchase checkout flow
- `OrderManagementService` → repurpose for deal management
- `PaymentService` / `payments/` services → repurpose for deal payouts (guardian payee)
- `SubscriptionBillingService` → repurpose for institution/sponsor tier billing
- `BsaasAnalyticsService` → repurpose for deal analytics
- `RefundService` → repurpose for escrow refunds

### 4.5 CRM Migration (TECHNICAL_SPEC §16)

The CRM is reused with minimal changes:

1. **Schema:** Add `athlete_tenant_id` + `guardian_id` columns to `crm_support_tickets` and `crm_inquiries` (§3.2)
2. **Trigger:** Add `nil_require_guardian_for_minor()` trigger (§3.4)
3. **Actor types:** Extend from `'platform'|'tenant'|'customer'` to include `'compliance'|'institution'|'sponsor'|'guardian'`
4. **Services:** Keep all `Crm*Service.ts`; update queries to filter by `athlete_tenant_id` where applicable
5. **Routes:** Keep `crm/` routes; update role validation for NIL actor types
6. **Frontend:** Keep CRM components; update for NIL actor surfaces (Compliance CRM, Institution/Sponsor CRM, Guardian CRM)
7. **Options:** Add `tenant_nil_crm_options_settings` table + `NilCrmOptionsResolver`

### 4.6 Bot Migration (TECHNICAL_SPEC §17)

The bot/RAG stack is reused with NIL-specific configuration:

1. **Schema:** Add `athlete_tenant_id`, `guardian_id`, `is_minor_safe` to `bot_conversations` (§3.2)
2. **Options:** Add `tenant_nil_bot_options_settings` table + `NilBotOptionsResolver`
3. **Guardrails:** Re-seed `bot_guardrail_rules` with child-safety rules:
   - Block any response containing minor PII (DOB, precise location, contact)
   - Block adult→minor direct conversational intent
   - Force unanswered athlete-subject questions to escalate to CRM
4. **RAG sources:** Re-index `bot_faq_embeddings` from `nil_eligibility_rules_list` + NIL consent docs
5. **Bot personas (§17.1):**
   - Compliance/Eligibility Bot (RAG over eligibility rules)
   - Guardian Onboarding Bot (FAQ + consent docs)
   - Recruiting/Sponsor FAQ Bot (public, consented athlete data)
   - Fan Bot (public FAQ + approved data)
6. **Rename:** `bot_product_embeddings` → `bot_athlete_embeddings`; re-index from athlete profiles

### 4.7 Frontend Route Migration

**Remove (commerce routes):**
- `/products/*` → replaced by `/athletes/:athleteTenantId`
- `/shops/*` → replaced by `/institutions/:tenantId`
- `/directory/*` → replaced by `/roster` (public) and `/recruiting` (coach)
- `/cart/*`, `/checkout/*` → replaced by `/deals/*` (sponsor deal flow)
- `/items/*` → drop
- `/catalog/*` → drop
- `/downloads/*` → drop
- `/orders/*` → replaced by `/deals/*`
- `/t/[tenantId]/items/*` → replaced by `/t/[tenantId]/roster/*`
- `/t/[tenantId]/inventory/*` → drop
- `/t/[tenantId]/storefront/*` → replaced by `/t/[tenantId]/profile/*`

**Add (NIL routes):**
- `/` — NIL marketing landing (Phase 1)
- `/athletes/:athleteTenantId` — public athlete profile (approved + consented)
- `/guardian` — guardian dashboard
- `/athletes/:athleteTenantId/dashboard` — athlete dashboard (post age-out)
- `/institutions/:tenantId` — institution dashboard
- `/sponsors/:tenantId` — sponsor dashboard
- `/fans` — fan dashboard
- `/admin/nil` — compliance/admin dashboard
- `/roster` — public roster directory
- `/recruiting` — coach recruiting board
- `/deals` — sponsor deal pipeline
- `/t/[tenantId]/roster/*` — institution roster management
- `/t/[tenantId]/profile/*` — athlete profile management
- `/t/[tenantId]/deals/*` — deal management
- `/t/[tenantId]/consent/*` — consent management
- `/t/[tenantId]/media/*` — media management
- `/t/[tenantId]/support/*` — CRM support (reuses existing)

### 4.8 Frontend Service Migration

**Remove:** All commerce-specific web services (`ProductService`, `StorefrontService`, `DirectoryService`, `InventoryService`, etc.)

**Add (NIL web services — each extends the matching NIL base singleton):**

| Service | Extends | File |
|---|---|---|
| `NilPublicRosterService` | `NilPublicApiSingleton` | `NilPublicRosterService.ts` |
| `AthleteService` | `AthleteApiSingleton` | `AthleteService.ts` |
| `GuardianService` | `GuardianApiSingleton` | `GuardianService.ts` |
| `InstitutionService` | `InstitutionApiSingleton` | `InstitutionService.ts` |
| `SponsorService` | `SponsorApiSingleton` | `SponsorService.ts` |
| `FanService` | `FanApiSingleton` | `FanService.ts` |
| `ComplianceService` | `ComplianceApiSingleton` | `ComplianceService.ts` |
| `NilLeadService` | `NilPublicApiSingleton` | `NilLeadService.ts` (web side) |

### 4.9 Rebranding

| Element | Commerce | NIL |
|---|---|---|
| Project name | `retail-visibility-platform` | `nil-youth-sports-platform` |
| Package names | `@rvp/api`, `@rvp/shared` | `@nil/api`, `@nil/shared` |
| Web app name | `web` | `web` (unchanged) |
| Brand domain | `visibleshelf.com` | (new NIL brand domain) |
| `PLATFORM_DOMAINS` in proxy.ts | `['visibleshelf.com', 'visibleshelf.store']` | `['nilbrand.com']` (or whatever the NIL domain is) |
| `API_BASE_URL` default | `https://api.visibleshelf.com` | `https://api.nilbrand.com` (or Railway URL) |
| UI colors/logo | VisibleShelf brand | NIL brand |
| Email templates | VisibleShelf branding | NIL branding |
| Sentry project | `retail-visibility-platform` | `nil-youth-sports-platform` |

---

## 5. Phased Migration Execution

### Phase M0: Infrastructure Setup (1–2 days)

| Step | Action | Verification |
|---|---|---|
| M0.1 | Create new git repo, clone source files (no .git history) | `git log` shows single initial commit |
| M0.2 | Create new Supabase project, enable pgvector | Supabase dashboard accessible |
| M0.3 | Create new Auth0 tenant + roles + application | Auth0 dashboard configured |
| M0.4 | Create new Vercel project (web) | Vercel project linked to repo |
| M0.5 | Create new Railway service (api) | Railway service linked to repo |
| M0.6 | Configure Doppler (local, dev, prd configs) | All secrets configured |
| M0.7 | Update package names (`@rvp/*` → `@nil/*`) | `pnpm install` succeeds |
| M0.8 | Update `PLATFORM_DOMAINS`, `API_BASE_URL`, brand strings | No "visibleshelf" references remain |

### Phase M1: Database Schema Cleanup (2–3 days)

| Step | Action | Verification |
|---|---|---|
| M1.1 | Strip commerce models from `schema.prisma` (§2.2 DROP list) | `prisma validate` passes |
| M1.2 | Rename repurposed models (§3.2 rename map) | `prisma validate` passes |
| M1.3 | Add all NIL models from TECHNICAL_SPEC §14 | `prisma validate` passes |
| M1.4 | Generate + run initial migration on Supabase | `prisma migrate dev --name nil_initial_schema` succeeds |
| M1.5 | Create RLS policies (§3.4) | RLS test: cross-athlete query returns 0 rows |
| M1.6 | Create guardian-required trigger | Trigger test: minor CRM record without guardian → error |
| M1.7 | Create `mv_athlete_discovery` materialized view | View queryable |
| M1.8 | Seed base data (tiers, features, capabilities, eligibility rules, nav links, bot guardrails) | Seed scripts complete |

### Phase M2: API Code Cleanup + NIL Services (3–5 days)

| Step | Action | Verification |
|---|---|---|
| M2.1 | Delete all commerce routes/services from §2.2 DROP list | `pnpm checkapi` passes (no broken imports) |
| M2.2 | Add NIL ID generators to `id-generator.ts` (§4.2) | All generators produce correct format |
| M2.3 | Add NIL base singleton classes (§4.1) | All bases extend correct platform base |
| M2.4 | Add NIL backend services (§4.4) | Services compile; singleton pattern enforced |
| M2.5 | Replace commerce resolvers with NIL resolvers (§4.3) | `EffectiveCapabilityResolver` dispatches to NIL resolvers |
| M2.6 | Update auth middleware for NIL roles | Role validation works for all NIL roles |
| M2.7 | Repurpose checkout/payment services for deal-as-purchase | Deal payment flow compiles |
| M2.8 | Update CRM services for NIL actor types + athlete/guardian scoping | CRM services compile with NIL columns |
| M2.9 | Update bot services for NIL personas + child-safety guardrails | Bot services compile with NIL scoping |
| M2.10 | `pnpm checkapi` — zero TS errors | Build passes |

### Phase M3: Web Code Cleanup + NIL Frontend (3–5 days)

| Step | Action | Verification |
|---|---|---|
| M3.1 | Delete all commerce frontend routes/services from §2.2 DROP list | No broken imports |
| M3.2 | Add NIL base singleton classes to web (§4.1) | All bases extend correct platform base |
| M3.3 | Add NIL web services (§4.8) | Services compile; singleton pattern enforced |
| M3.4 | Update `proxy.ts` with new `PLATFORM_DOMAINS` | Proxy routes correctly for NIL domain |
| M3.5 | Update `AuthContext` / `ServerResolvedContextProvider` for NIL actor types | Auth flow works with new Auth0 tenant |
| M3.6 | Create NIL landing page (Phase 1 — marketing + lead capture) | Landing page renders; lead form posts |
| M3.7 | Create NIL dashboard routes (§4.7) — guardian, athlete, institution, sponsor, fan, compliance | All dashboards render with scoped data |
| M3.8 | Rebrand UI (colors, logo, fonts) | No VisibleShelf branding remains |
| M3.9 | Update navigation links in database | All sidebar items correct for NIL |
| M3.10 | `pnpm checkweb` — zero TS errors | Build passes |

### Phase M4: Integration + Deployment (2–3 days)

| Step | Action | Verification |
|---|---|---|
| M4.1 | Deploy API to Railway | Health check passes |
| M4.2 | Deploy Web to Vercel | Landing page loads on Vercel URL |
| M4.3 | Configure custom domain DNS → Vercel | TLS handshake + 200 on custom domain |
| M4.4 | Test Auth0 login flow end-to-end | Login → dashboard → logout works |
| M4.5 | Test capability resolution | `GET /api/tenants/:id/capabilities` returns NIL manifest |
| M4.6 | Test RLS isolation | Cross-athlete query returns 0 rows |
| M4.7 | Test CRM guardian-required trigger | Minor CRM record without guardian → DB error |
| M4.8 | Test bot child-safety guardrails | Bot refuses to reveal minor PII |
| M4.9 | Smoke test all NIL routes | All routes return expected status codes |

### Phase M5: NIL Feature Implementation (follows IMPLEMENTATION_PLAN.md)

Once the platform extraction is complete and stable (M0–M4), follow the existing `IMPLEMENTATION_PLAN.md` phases:

- **Phase 0:** Confirm fee parameters, tenant_type alterability, RLS GUC mechanism, legal review
- **Phase 1:** Credibility shell (landing + leads)
- **Phase 2:** Native pipeline (athlete-tenant + firewall + consent + roster + P0 safety gates)
- **Phase 3:** Unified service (guardian/institution/sponsor/fan portals + CRM + bots)
- **Phase 4:** Multi-tenant mesh (automated compliance + finance + RLS audit + erasure + age-out)

---

## 6. File Inventory — What Gets Copied vs. Deleted

### 6.1 API Files — KEEP (count: ~80 files)

**Core lib:**
- `apps/api/src/lib/UniversalSingleton.ts`
- `apps/api/src/lib/id-generator.ts` (modified — add NIL generators)
- `apps/api/src/prisma.ts`
- `apps/api/src/logger.ts`

**Middleware (keep all except commerce-specific):**
- `apps/api/src/middleware/auth.ts`
- `apps/api/src/middleware/audit-logger.ts`
- `apps/api/src/middleware/case-transform.ts`
- `apps/api/src/middleware/createIdentifierRoute.ts`
- `apps/api/src/middleware/createUniversalRoute.ts`
- `apps/api/src/middleware/csrf.ts`
- `apps/api/src/middleware/flags.ts`
- `apps/api/src/middleware/identifierResolver.ts`
- `apps/api/src/middleware/input-validation.ts`
- `apps/api/src/middleware/organization-validation.ts`
- `apps/api/src/middleware/permissions.ts`
- `apps/api/src/middleware/policy-enforcement.ts`
- `apps/api/src/middleware/rate-limit.ts`
- `apps/api/src/middleware/role-validation.ts`
- `apps/api/src/middleware/security-headers.ts`
- `apps/api/src/middleware/security.ts`
- `apps/api/src/middleware/session-tracker.ts`
- `apps/api/src/middleware/ssrf-protection.ts`
- `apps/api/src/middleware/subscription.ts`
- `apps/api/src/middleware/tenantAutoId.ts`
- `apps/api/src/middleware/tier-access.ts`
- `apps/api/src/middleware/tier-validation.ts`
- `apps/api/src/middleware/universal-transform.ts`
- `apps/api/src/middleware/universalIdentifierResolver.ts`
- Drop: `image-search-limits.ts`, `sku-limits.ts` (commerce-specific)

**Services (keep core + CRM + bot + payment + subscription):**
- All `Crm*Service.ts` (8 files)
- All `Bot*Service.ts` (14 files)
- `BaseService.ts`
- `EffectiveCapabilityResolver.ts` (modified)
- `resolvers/` directory (replace commerce resolvers with NIL resolvers)
- `payments/` services (12 files — repurpose for deal payouts)
- `subscription/` services (8 files — repurpose for institution/sponsor billing)
- `permissions/` services (20 files)
- `ai-providers/` (7 files)
- `email/` + `email-providers/` (9 files)
- `encryption.ts`
- `mfa.ts`
- `auth0-mfa.service.ts`
- `threat-detection.ts`
- `gdpr-compliance.ts`
- `CcpaComplianceService.ts`
- `TenantService.ts`, `TenantSingletonService.ts`, `TenantProfileService.ts`
- `TierService.ts`, `TierSingletonService.ts`
- `UserService.ts`
- `OrganizationService` (via `organizations.ts` route)
- `OAuthSingletonService.ts`, `TokenEncryptionService.ts`
- `UniversalIdentifierCache.ts`
- `SystemStatusService.ts`
- `GrowthTipService.ts`, `NextStepsService.ts`
- `RateLimitingService.ts`
- `SecurityMonitoringService.ts`
- `SentryApiService.ts`
- `RealtimeService.ts`
- `ScopeRouter.ts` (evaluate — may need modifications for NIL scoping)
- `RefundSingletonService.ts` (repurpose for escrow refunds)
- `TaxService.ts` (needed for 1099 reporting)

**Routes (keep core + CRM + bot + payment + auth + admin):**
- `auth-sync.ts`, `auth-sessions.ts`, `auth0-mfa.ts`
- `crm/` directory (3 files)
- `bot-merchant.ts`, `bot-public.ts`
- `checkout/` directory (repurpose for deal checkout)
- `payments.ts`, `payment-gateways.ts`, `payment-gateway-settings.ts`
- `stripe-webhook.ts`, `stripe-webhooks.ts`, `stripe-connect-webhooks.ts`
- `subscription-billing.ts`, `subscriptions.ts`, `tenant-billing.ts`
- `bsaas-purchases.ts` (repurpose for deal-as-purchase)
- `billing.ts`
- `admin/` directory (38 files — keep admin infra, strip commerce-specific admin routes)
- `tenant/` directory (2 files)
- `tenants.ts`, `universal-tenants.ts`, `tenant-capabilities.ts`, `tenant-tier.ts`
- `tenant-users.ts`, `tenant-profile.ts`, `tenant-flags.ts`, `tenant-limits.ts`
- `tenant-notifications.ts`, `tenant-auto-id.ts`
- `organizations.ts`, `organization-capabilities.ts`, `organization-requests.ts`
- `users.ts`, `users-singleton.ts`, `admin-users.ts`
- `tiers.ts`, `tiers-singleton.ts`, `tier-config.ts`
- `permissions.ts`, `effective-flags.ts`, `platform-flags.ts`
- `health.ts`, `performance.ts`, `performance-api.ts`
- `cache.ts`, `cache-stats.ts`, `cache-invalidation.ts`, `cache-monitoring.ts`
- `audit.ts`, `security.ts`, `security-alerts.ts`, `security-monitoring.ts`, `security-telemetry.ts`
- `client-errors.ts`, `rate-limiting.ts`, `rate-limit-warnings.ts`
- `feedback.ts`, `onboarding.ts`
- `ccpa.ts`, `gdpr.ts`, `account-deletion.ts`
- `policy.ts`, `platform-settings.ts`, `platform-stats.ts`, `platform-dashboard.ts`
- `platform-fee-invoices.ts`, `platform-revenue.ts`
- `email-management.ts`, `email-test.ts`
- `mfa.ts`
- `index.ts` (modified — remount NIL routes)
- `mounts/` directory (6 files — evaluate which are commerce-specific)
- `integrations/` directory (evaluate)
- `oauth/` directory (keep for Stripe/ payment OAuth)

### 6.2 API Files — DELETE (count: ~90 files)

All files from §2.2 DROP list. Key categories:
- All product/variant/inventory routes and services (~25 files)
- All storefront/shop routes and services (~15 files)
- All directory routes and services (~15 files)
- All GBP/GMC/Google routes and services (~15 files)
- All barcode/scan routes and services (~5 files)
- All digital download routes and services (~5 files)
- All cart/abandoned cart routes and services (~3 files)
- All shipment/fulfillment routes and services (~3 files)
- All social commerce routes and services (~3 files)
- All feed/catalog routes and services (~3 files)
- All business hours/location routes and services (~3 files)
- All image enrichment/AI image routes and services (~3 files)
- All recommendation routes and services (~3 files)
- All featured products routes and services (~5 files)
- All store reviews routes and services (~2 files)
- All test files specific to commerce (~10 files)
- All documentation files specific to commerce (~15 files)

### 6.3 Web Files — KEEP

**Base singletons:**
- `apps/web/src/providers/base/` — all 6 base classes + `EnhancedFlexibleApiSingleton` + `UniversalSingleton`

**Core infra:**
- `apps/web/src/proxy.ts` (modified)
- `apps/web/src/lib/auth0.ts`
- `apps/web/src/lib/clientTenantContext.ts`
- `apps/web/src/lib/correlation-id.ts`
- `apps/web/src/lib/directory-helpers.ts` (evaluate — may rename to roster-helpers)
- `apps/web/src/contexts/AuthContext.tsx` (modified)
- `apps/web/src/components/tenant/ServerResolvedContextProvider.tsx`
- `apps/web/src/components/tenant/TenantAuthGate.tsx`

**CRM components:**
- `apps/web/src/components/crm/` — all CRM components

**Bot components:**
- `apps/web/src/components/bot/` — all bot widget components

**Navigation:**
- `apps/web/src/components/navigation/` — all nav components
- `apps/web/src/hooks/useNavLinks.tsx`
- `apps/web/src/services/NavigationLinksService.ts`

**Dashboard primitives:**
- `apps/web/src/components/dashboard/` — dashboard components
- `apps/web/src/components/tenant/` — tenant components

**Services (core):**
- `apps/web/src/services/UnifiedCapabilityService.ts` (modified)
- `apps/web/src/services/AuthSyncService.ts`
- `apps/web/src/services/contextAwareCacheService.ts`
- `apps/web/src/utils/contextCacheManager.ts`
- `apps/web/src/utils/contextAwareCacheManager.ts`

**Hooks:**
- `apps/web/src/hooks/tenant-access/` — capability access hooks
- `apps/web/src/hooks/useTenantComplete.tsx`

**Config:**
- `apps/web/src/config/rbac.ts` (modified — add NIL roles/permissions)

### 6.4 Web Files — DELETE

- `apps/web/src/app/products/` (13 items)
- `apps/web/src/app/shops/` (14 items)
- `apps/web/src/app/directory/` (24 items)
- `apps/web/src/app/items/` (3 items)
- `apps/web/src/app/cart/` (2 items)
- `apps/web/src/app/carts/` (2 items)
- `apps/web/src/app/checkout/` (2 items)
- `apps/web/src/app/orders/` (3 items)
- `apps/web/src/app/my-orders/` (2 items)
- `apps/web/src/app/downloads/` (1 item)
- `apps/web/src/app/catalog/` (1 item)
- `apps/web/src/app/category-discovery/` (1 item)
- `apps/web/src/app/cross-tenant/` (1 item)
- `apps/web/src/app/test-*` (3 items)
- `apps/web/src/app/debug/` (1 item)
- `apps/web/src/app/sentry-example-page/` (1 item)
- Commerce-specific services, components, hooks
- Commerce-specific API route handlers in `apps/web/src/app/api/` (119 items — strip commerce, keep auth/health/CRM/bot)

---

## 7. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Prisma schema breaks after stripping 100+ models | High | Do schema cleanup in one pass; run `prisma validate` after each batch of removals |
| Broken imports after deleting commerce routes/services | High | Delete in dependency order (routes → services → models); run `pnpm checkapi`/`checkweb` after each batch |
| Auth0 role mapping breaks | Medium | Test all NIL roles end-to-end in M4.4 |
| RLS policies not applied correctly on new Supabase | High | Run RLS isolation test in M1.5 before any code deployment |
| Materialized view `mv_athlete_discovery` query is wrong | Medium | Build and test view in M1.7 before building services on top |
| Stripe webhook signature validation fails on new domain | Medium | Update webhook endpoints in Stripe dashboard for new Railway API URL |
| Cache namespace collisions between old and new code | Low | New project = clean cache; no collision possible |
| Bot guardrails not seeded correctly | High (safety) | Test child-safety guardrails in M4.8 before any public bot access |
| CRM guardian-required trigger blocks legitimate operations | Medium | Test with both minor and adult athlete-tenants in M4.7 |
| Missing env vars on new infrastructure | Medium | Use Doppler checklist from §1.6; verify all vars present before deployment |

---

## 8. Acceptance Criteria for Migration Completion

The migration is complete when:

- [ ] New git repo exists with clean history (single initial commit + migration commits)
- [ ] New Supabase project is provisioned with pgvector enabled
- [ ] New Auth0 tenant has all 8 NIL roles configured
- [ ] New Vercel project deploys successfully
- [ ] New Railway API service deploys successfully
- [ ] Doppler has all three configs (local, dev, prd) with all required secrets
- [ ] `prisma migrate dev` succeeds on new Supabase with NIL-only schema
- [ ] RLS policies are applied and tested (cross-athlete isolation)
- [ ] Guardian-required trigger is applied and tested
- [ ] `pnpm checkapi` passes with zero TS errors
- [ ] `pnpm checkweb` passes with zero TS errors
- [ ] No "visibleshelf" or "rvp" references remain in code (except in migration comments)
- [ ] Auth0 login flow works end-to-end
- [ ] Capability resolution returns NIL manifest (not commerce)
- [ ] CRM works with NIL actor types
- [ ] Bot child-safety guardrails are seeded and tested
- [ ] All NIL dashboard routes render
- [ ] Custom domain resolves with valid TLS

Once all criteria are met, proceed to `IMPLEMENTATION_PLAN.md` Phase 0 → Phase 1 → ... → Phase 4.
