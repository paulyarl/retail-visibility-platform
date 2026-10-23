-- 357_seed_batch_nullable.sql
-- Allow directory_presence_seeds.seed_batch to be NULL. The column was
-- created NOT NULL because every seed gets a cohort label at mint time
-- (from-campaign-*, pg-*, manual form labels), but dissolving a cohort —
-- the seed-batch "delete" — clears the label and needs NULL to mean
-- "unbatched". Read paths already gate on seed_batch IS NOT NULL, so the
-- constraint was the only thing standing between a cohort and its dissolve.

ALTER TABLE directory_presence_seeds
  ALTER COLUMN seed_batch DROP NOT NULL;

COMMENT ON COLUMN directory_presence_seeds.seed_batch IS
  'Cohort label grouping seeds (from-campaign-{id}, pg-{id}-{date}, form labels). NULL = unbatched — the seed exists outside any cohort view.';
