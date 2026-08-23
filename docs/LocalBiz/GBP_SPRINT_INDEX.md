# GBP Authorized Management Suite — Sprint Plan Index

**Master spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Status:** All phases planned — ready for execution

---

## Phase Overview

| Phase | Sprint Plan | Scope | Prerequisite | Status |
|:---|:---|:---|:---|:---|
| **0** | [GBP_SPRINT_PHASE0.md](GBP_SPRINT_PHASE0.md) | Identity Bridge & Schema — migrations 237–241, `CustomerGBPAccessService`, route scaffold | None | Ready |
| **1** | [GBP_SPRINT_PHASE1.md](GBP_SPRINT_PHASE1.md) | OAuth & Verification Flow — `GBPVerificationService`, dashboard shell, PIN dialog | Phase 0 | Ready |
| **2** | [GBP_SPRINT_PHASE2.md](GBP_SPRINT_PHASE2.md) | Review Intelligence & Tier A Reply Engine — ingestion cron, 3-draft generation, review inbox | Phase 1 | Ready |
| **2.5** | [GBP_SPRINT_PHASE2_5.md](GBP_SPRINT_PHASE2_5.md) | Tier B Autopilot — dynamic window, 5★ auto-reply, feature-flagged rollback | Phase 2 + **Tier A production validation** | Gated |
| **3** | [GBP_SPRINT_PHASE3.md](GBP_SPRINT_PHASE3.md) | Post Publisher & Media Manager — scheduler cron, post composer, binary media upload | Phase 2 | Ready |
| **4** | [GBP_SPRINT_PHASE4.md](GBP_SPRINT_PHASE4.md) | Capability Registration + BSaaS + Directory Surfacing — module registration, merchant gates, public endpoints, surface components | Phase 2 + Phase 3 | Ready |

---

## Dependency Graph

```
Phase 0 (Schema + Bridge)
  │
  ├── Phase 1 (OAuth + Verification)
  │     │
  │     └── Phase 2 (Review Ingestion + Tier A)
  │           │
  │           ├── Phase 2.5 (Tier B Autopilot) ← GATED on Tier A production validation
  │           │
  │           └── Phase 3 (Posts + Media)
  │                 │
  │                 └── Phase 4 (Capability + BSaaS + Directory Surfacing)
  │
  └── (Phase 4 depends on Phase 2 + Phase 3 data being available)
```

**Critical path:** Phase 0 → 1 → 2 → 3 → 4

**Parallelizable:** Phase 2.5 can run in parallel with Phase 3/4 IF Tier A production validation is complete. Phase 3 can start as soon as Phase 2 is code-complete (doesn't need Phase 2.5).

---

## Cross-Phase Contracts (Handoff Points)

Each phase has explicit handoff verification in its sprint plan. The key contracts:

| Contract | Owner Phase | Consumer Phase(s) | What |
|:---|:---|:---|:---|
| `CustomerGBPAccessService.resolveTenant()` | Phase 0 | 1, 2, 3, 4 | Customer → tenant resolution |
| `gbp_locations_list.verification_state` | Phase 0 (schema) + Phase 1 (population) | 2, 4 | Verification status |
| `gbp_reviews` with Int `star_rating` + intelligence columns | Phase 0 (schema) + Phase 2 (ingestion) | 4 | Public review surfacing |
| `cached_average_rating` + `cached_review_count` | Phase 0 (schema) + Phase 2 (refresh) | 4 | Public aggregate rating |
| `gbp_posts` with lifecycle columns | Phase 0 (schema) + Phase 3 (population) | 4 | Public post surfacing |
| `gbp_media` with `location_id` | Phase 0 (schema) + Phase 3 (population) | 4 | Public photo surfacing |
| `gbp_ai_response` feature key | Phase 4 (registration) | 2 (gate logic), 2.5 (activation) | Entitlement gate |
| `gbp_posts_scheduler` feature key | Phase 4 (registration) | 3 (gate logic) | Entitlement gate |
| `gbp_directory_reviews` / `gbp_directory_content` feature keys | Phase 4 (registration) | 4 (public endpoints) | Entitlement gate |
| Merchant gate toggles | Phase 4 | 4 (public endpoints) | Display toggle |

**Note on entitlement gates:** Phases 2 and 3 implement the gate logic (checking `features[key]`), but the feature keys are not registered until Phase 4. This is correct — the gates will return `false` (unentitled) until Phase 4 registration. Phase 2 delivers the service, Phase 4 delivers the entitlement. Draft-preview mode in Phase 2 handles the unentitled state gracefully.

---

## Total File Inventory (All Phases)

### New Files

| File | Phase |
|:---|:---|
| `database/migrations/237_gbp_locations_verification.sql` | 0 |
| `database/migrations/238_gbp_reviews_intelligence.sql` | 0 |
| `database/migrations/239_gbp_posts_lifecycle.sql` | 0 |
| `database/migrations/240_gbp_media_location.sql` | 0 |
| `database/migrations/241_mkt_customer_gbp_links.sql` | 0 |
| `database/migrations/NNN_review_dispute_intake.sql` | 2 |
| `database/migrations/NNN_gbp_management_capability.sql` | 4 |
| `database/migrations/NNN_tenant_gbp_options_settings.sql` | 4 |
| `apps/api/src/services/CustomerGBPAccessService.ts` | 0 |
| `apps/api/src/services/GBPVerificationService.ts` | 1 |
| `apps/api/src/services/GBPReviewReplyService.ts` | 2 |
| `apps/api/src/services/gbp/prompts.ts` | 2 |
| `apps/api/src/services/resolvers/GbpManagementResolver.ts` | 4 |
| `apps/api/src/routes/gbp-customer.ts` | 0 (scaffold) → 1, 2, 3 (filled) |
| `apps/api/src/routes/gbp-options-settings.ts` | 4 |
| `apps/api/src/routes/directory-gbp-public.ts` | 4 |
| `apps/api/src/jobs/gbpReviewIngestion.ts` | 2 |
| `apps/api/src/jobs/gbpPostScheduler.ts` | 3 |
| `apps/api/src/jobs/gbpReviewAutopilot.ts` | 2.5 |
| `apps/web/src/app/account/marketing/gbp/page.tsx` | 1 |
| `apps/web/src/app/account/marketing/gbp/VerificationStatusCard.tsx` | 1 |
| `apps/web/src/app/account/marketing/gbp/PinDialog.tsx` | 1 |
| `apps/web/src/app/account/marketing/gbp/reviews/page.tsx` | 2 |
| `apps/web/src/app/account/marketing/gbp/reviews/ReviewCard.tsx` | 2 |
| `apps/web/src/app/account/marketing/gbp/reviews/AiDraftPicker.tsx` | 2 |
| `apps/web/src/app/account/marketing/gbp/posts/page.tsx` | 3 |
| `apps/web/src/app/account/marketing/gbp/posts/PostComposer.tsx` | 3 |
| `apps/web/src/app/account/marketing/gbp/posts/PostCard.tsx` | 3 |
| `apps/web/src/app/account/marketing/gbp/posts/OfferPostBuilder.tsx` | 3 |
| `apps/web/src/app/account/marketing/gbp/media/page.tsx` | 3 |
| `apps/web/src/app/account/marketing/gbp/media/MediaUploader.tsx` | 3 |
| `apps/web/src/components/gbp/GbpReviewsSection.tsx` | 4 |
| `apps/web/src/components/gbp/GbpPostsSection.tsx` | 4 |
| `apps/web/src/components/gbp/GbpPhotoGallerySection.tsx` | 4 |
| `apps/api/src/services/__tests__/CustomerGBPAccessService.test.ts` | 0 |
| `apps/api/src/services/__tests__/GBPVerificationService.test.ts` | 1 |
| `apps/api/src/services/__tests__/GBPReviewReplyService.test.ts` | 2 (+ 2.5 extension) |
| `apps/api/src/services/__tests__/GbpManagementResolver.test.ts` | 4 |
| `apps/api/src/tests/gbp-customer-routes.test.ts` | 0 → 1 → 2 → 3 (extended each phase) |
| `apps/api/src/tests/gbpPostScheduler.test.ts` | 3 |
| `apps/api/src/tests/directory-gbp-public-routes.test.ts` | 4 |

### Modified Files

| File | Phases |
|:---|:---|
| `apps/api/prisma/schema.prisma` | 0 (introspected — not hand-edited) |
| `apps/api/src/services/GBPAdvancedSync.ts` | 0 (star_rating Int), 3 (uploadPhotoBinary) |
| `apps/api/src/routes/routeRegistry.ts` | 0, 4 |
| `apps/api/src/services/MarketingCustomerService.ts` | 0 (bridge provisioning) |
| `apps/web/src/services/MarketingCustomerService.ts` | 1, 2, 3 (GBP methods) |
| `apps/web/src/components/customer/CustomerSidebar.tsx` | 1 |
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | 4 |
| `apps/web/src/services/UnifiedCapabilityService.ts` | 4 |
| `apps/web/src/services/CapabilityResolutionService.ts` | 4 |
| `apps/web/src/components/dashboard/PlanSummaryWidget.tsx` | 4 |
| `apps/web/src/app/directory/[slug]/page.tsx` | 4 |
| `apps/web/src/app/place/[slug]/page.tsx` | 4 |
| `apps/api/src/config/unifiedConfig.ts` | 2.5 |
| `apps/api/src/index.ts` (or job registration) | 2, 2.5, 3 |

---

## Global Verification Gates (apply to every phase)

Per `start-of-phase-sprint-checklist.md` §0:

```bash
cd apps/api && npx tsc --noEmit    # zero new errors
cd apps/web && npx tsc --noEmit    # zero new errors
```

**Non-negotiable.** Every phase ends with clean TypeScript on both apps.

---

## Skills to Update After All Phases

Per `end-of-phase-sprint-checklist.md`:

| Skill | Update |
|:---|:---|
| `google-integration-and-demo-qr.md` | Add customer-portal GBP access pattern (bridge resolution) |
| `tenant-scoped-id-generation.md` | Add `gbpl` prefix to ID catalog |
| `capability-deployment-flow.md` | Add `gbp_management` as a worked example |
| `three-tier-feature-gating.md` | Add GBP Pro as a case study (module with 4 features + flexible + BSaaS) |
| `alerts-and-notifications.md` | Add `gbp_new_review` + `gbp_verification_milestone` alert types |
| Consider: `gbp-customer-bridge.md` | New skill for bridge resolution + drift reconciliation pattern |
| Consider: `gbp-review-reply-engine.md` | New skill for Tier A/B reply engine pattern (tone hierarchy, 3-draft generation, dynamic window) |
