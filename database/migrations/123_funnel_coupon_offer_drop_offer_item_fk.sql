-- ============================================================
-- MIGRATION: Drop foreign key on tenant_funnel_steps.offer_item_id
-- Reason: Sprint 9 Coupon-Funnel Convergence - coupon_offer steps
--         store a tenant_coupons.id in offer_item_id, which cannot
--         satisfy a constraint to inventory_items.id.
-- ============================================================

ALTER TABLE tenant_funnel_steps
DROP CONSTRAINT IF EXISTS fk_tenant_funnel_steps_offer_item;

-- Verification:
-- SELECT conname FROM pg_constraint WHERE conname = 'fk_tenant_funnel_steps_offer_item';
