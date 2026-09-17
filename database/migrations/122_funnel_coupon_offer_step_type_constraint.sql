-- ============================================================
-- MIGRATION: Add coupon_offer to funnel step_type check constraint
-- Reason: Sprint 9 Coupon-Funnel Convergence - missing constraint update
-- ============================================================

-- Drop and recreate the check constraint to include 'coupon_offer'
ALTER TABLE tenant_funnel_steps
DROP CONSTRAINT IF EXISTS chk_tenant_funnel_steps_step_type;

ALTER TABLE tenant_funnel_steps
ADD CONSTRAINT chk_tenant_funnel_steps_step_type
CHECK (step_type IN ('order_bump', 'upsell', 'downsell', 'oto', 'coupon_offer'));

-- Verification:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'chk_tenant_funnel_steps_step_type';
