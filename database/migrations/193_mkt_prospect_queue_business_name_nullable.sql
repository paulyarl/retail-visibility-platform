-- Migration 193: Make mkt_prospect_queue.business_name nullable
--
-- For category-scope and city-scope queue entries, a business name is not
-- always relevant — the operator may be queueing a category or city prospect
-- without a specific triggering business. The business_name column was
-- previously NOT NULL, which forced the "Add Prospect to Queue" modal to
-- require it regardless of scope.
--
-- This migration drops the NOT NULL constraint so business_name is optional
-- for non-business-scope entries. Business-scope entries still require it
-- (enforced at the application layer via Zod superRefine).
--
-- No RLS, no triggers — matches the mkt_* family policy.
--
-- After running: cd apps/api && doppler run --config local -- npx prisma db pull && npx prisma generate

BEGIN;

ALTER TABLE mkt_prospect_queue
  ALTER COLUMN business_name DROP NOT NULL;

-- Verification query (run manually after applying):
-- SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'mkt_prospect_queue' AND column_name = 'business_name';

COMMIT;
