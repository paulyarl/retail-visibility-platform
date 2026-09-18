-- Migration 299: create the `disputes` storage bucket
--
-- The `disputes` bucket is referenced by StorageBuckets.DISPUTES
-- (apps/api/src/storage-config.ts, default name `disputes`) and consumed by:
--   - POST /api/admin/marketing-ops/:campaignId/files/upload (diagnostic screenshots)
--   - DisputeIntakeService, GalleryMultiService, DirectoryClaimService
--   - gbp-customer, marketing-ops-public
--
-- It was never provisioned in the Supabase project, so every upload to it failed
-- with `Bucket not found` (surfaced as a 500 `upload_failed`). The bucket is
-- PRIVATE: files are served through token-scoped API proxies, not public URLs.
-- The API uploads with the service-role key, which bypasses RLS, so no storage
-- policies are required.
--
-- No file_size_limit / allowed_mime_types: the 10 MB cap and PNG/JPEG/WebP
-- restriction are enforced in code by the route's multer config. A bucket-level
-- limit would be redundant and could break other consumers (e.g. dispute PDFs).
--
-- Idempotent. Apply to `local` + `prd`:
--   psql $DATABASE_URL -f database/migrations/299_disputes_storage_bucket.sql

INSERT INTO storage.buckets (id, name, public)
VALUES ('disputes', 'disputes', false)
ON CONFLICT (id) DO NOTHING;
