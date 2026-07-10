---
description: Pre-flight checklist for BSaaS coupon targeting implementation — ensures all target types, validation logic, admin UI, and bundle promo code gap fix are covered
---

# BSaaS Coupon Targeting — Pre-Flight Checklist

Run this before starting implementation of the coupon targeting sprint.

## 1. Hard Rule — TypeScript Checks at Sprint End

```bash
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

Zero new errors on both. Non-negotiable.

## 2. Design Doc

- [ ] Read `docs/BSAAS_COUPON_TARGETING_SPRINT_PLAN.md` fully before starting
- [ ] Understand the 6 target types: feature, tier, capability type, tier type, demo status, subscription status
- [ ] Understand AND logic across fields, OR within fields, null = no constraint

## 3. Singleton Service Strategy

- [ ] **Backend**: `CouponTargetService.ts` — extends `BaseService` (stateless CRUD with cache). 60s in-memory cache on `getTargetsForCoupon`. `invalidateCache()` on writes.
- [ ] **Frontend**: `AdminBsaasPromotionsService.ts` — already extends `AdminApiSingleton`. Extend existing types and methods, no new service needed.

## 4. Database & Migration

- [ ] **Migration file**: `097_coupon_target_rules.sql`
- [ ] **Table**: `coupon_target_rules` — `id VARCHAR(255) PK`, `coupon_id VARCHAR(255) UNIQUE`, 6 JSONB target fields, timestamps
- [ ] **RLS**: Admin-only (no tenant access). Use `DO$$ ... EXCEPTION WHEN OTHERS THEN END $$;`
- [ ] **Indexes**: `coupon_id` (unique index already from UNIQUE constraint), plus index for lookup
- [ ] **updated_at trigger**: Standard pattern
- [ ] **Idempotency**: `CREATE TABLE IF NOT EXISTS`, `DO$$` wrappers
- [ ] **Prisma schema**: Add `coupon_target_rules` model manually or via `db pull`

## 5. ID Generation

- [ ] **New generator**: `generateCouponTargetId()` in `apps/api/src/lib/id-generator.ts`
- [ ] **Prefix**: `ctgt-` (no tenant scope — coupons are platform-managed)
- [ ] **Format**: `ctgt-{nanoid}` (no tenant key since this is platform-level)

## 6. Backend Architecture

- [ ] **New service**: `apps/api/src/services/CouponTargetService.ts`
  - `getTargetsForCoupon(couponId)` — 60s cache
  - `validateCouponTargets(couponId, context)` — checks all 6 target types
  - `setCouponTargets(couponId, targets)` — upsert
  - `invalidateCache()`
- [ ] **Modified routes**: `apps/api/src/routes/admin/bsaas-promotions.ts`
  - `POST /coupon` — accept optional target fields, create rules row after Stripe coupon
  - `PUT /coupon/:id/targets` — new endpoint to update targets on existing coupon
  - `GET /` — include targets in coupon response
- [ ] **Modified checkout**: `apps/api/src/routes/bsaas-purchases.ts`
  - `POST /feature-purchase` — add targeting validation after Stripe promo code validation
  - `POST /bundle-purchase` — **FIX promo code gap**: add full Stripe promo code validation + targeting check
- [ ] **Logger calls**: `logger.method(message, undefined, { ...meta })` signature
- [ ] **Zod validation**: Target fields in coupon creation schema
- [ ] **Auth**: `authenticateToken` + `requireAdmin` on new PUT endpoint

## 7. Frontend Architecture

- [ ] **Modified service**: `apps/web/src/services/AdminBsaasPromotionsService.ts`
  - Add `CouponTargets` interface
  - Add `targets?` to `BsaasCoupon`
  - Add target fields to `CreateCouponRequest`
  - New `updateCouponTargets(couponId, targets)` method
- [ ] **Modified component**: `apps/web/src/admin/components/BsaasPromotionManagement.tsx`
  - Target section in coupon create form (6 fields)
  - Feature multi-select (from catalog data — reuse existing coupon list or fetch features)
  - Tier multi-select
  - Capability type multi-select
  - Tier type checkboxes (trial/paid)
  - Demo status checkboxes (demo/non-demo)
  - Subscription status multi-select
  - Target badges in coupon table
  - Edit targets modal/button on existing coupons
- [ ] **No new pages** — all changes in existing `/settings/admin/bsaas-promotions` page
- [ ] **No new navigation links** — existing page is already linked
- [ ] **Loading/empty/error states** for target editing

## 8. Capability System

- [ ] **No new capability features needed** — coupon targeting is admin-only, not tenant-facing
- [ ] **No feature keys** — no `canonical-features.ts` or `tier-hierarchies.ts` changes
- [ ] **No resolver changes** — targeting is a checkout gate, not a capability

## 9. Navigation & Settings Cards

- [ ] **No new pages** — no navigation links needed
- [ ] **No new settings cards** — existing admin card for "BSAAS Promotions" already covers the page

## 10. Skills to Update After Completion

- [ ] `bsaas-coupons-private-features.md` — add targeting section, update architecture diagram, update coupon creation schema, add target validation flow, update known gaps (bundle promo code gap FIXED)
- [ ] `bsaas-purchase-flow.md` — note that promo codes now work on bundles too

## 11. Pre-Flight Summary

```
Sprint: BSaaS Coupon Targeting
Design doc: docs/BSAAS_COUPON_TARGETING_SPRINT_PLAN.md

New services: CouponTargetService.ts (backend)
New entities: coupon_target_rules
New ID generators: generateCouponTargetId (ctgt-)
New pages/routes: PUT /api/admin/bsaas-promotions/coupon/:id/targets (new endpoint on existing route file)
New sidebar links: none
New settings cards: none
New migration: 097_coupon_target_rules.sql
New background jobs: none
New capability features: none
Skills to read before starting: bsaas-coupons-private-features.md, bsaas-purchase-flow.md, deploy-service-extending-base-singleton.md, tenant-scoped-id-generation.md
Skills to update after completion: bsaas-coupons-private-features.md, bsaas-purchase-flow.md
New skill to create: this checklist (bsaas-coupon-targeting-checklist.md)
```
