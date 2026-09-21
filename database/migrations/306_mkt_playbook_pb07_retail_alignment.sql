-- Migration 306: Modernize PB-07 Playbook to Physical Shelf Visibility
-- Spec: docs/LocalBiz/PHYSICAL_RETAIL_PLAYBOOK_ALIGNMENT_SPRINT_PLAN.md (Phase 1)
-- Data-only UPDATE — no schema change, no `prisma db pull` required.
-- PB-07 stays code=PB-07, archetype=A6, priority_rank=5, category=triage_management;
-- matching_rules unchanged so the triage cascade is untouched.

UPDATE mkt_playbook_catalog
SET
  name = 'Physical Shelf Visibility & Counter Fulfillment',
  description = 'For independent physical retail stores and specialty markets whose shelves are invisible online. Delivers a 5-product shelf activation, mobile catalog preview, GBP photo optimization, and counter pickup workflow — driving in-store foot traffic with 0% marketplace commission.',
  fitd_offer_title = '5-Product Shelf Activation + GBP In-Stock Preview',
  retainer_pitch_title = 'Monthly Physical Shelf Visibility & Counter Discovery Retainer',
  updated_at = now()
WHERE code = 'PB-07';
