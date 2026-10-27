-- 362: Supabase security-advisor remediation (2026-10-27)
--
-- Clears ERROR lints:
--   * rls_disabled_in_public  — public.spatial_ref_sys
--   * security_definer_view   — public.digital_download_asset_stats,
--                               public.digital_download_page_stats
-- Clears WARN lint:
--   * materialized_view_in_api — public.mv_tenant_effective_capabilities
--      (only the API's postgres connection reads it; apps/web uses the anon
--       key for auth only and never queries this mv)
--
-- Apply:  doppler run --config <prd|stg> -- node scripts/apply-sql-file.cjs ../../database/migrations/362_security_advisor_remediation.sql
-- Or paste into the Supabase SQL editor.

-- ── spatial_ref_sys ─────────────────────────────────────────────────────────
-- PostGIS SRID lookup; contents are public EPSG reference data. ACL is
-- `=r/supabase_admin` (PUBLIC SELECT only — no write exposure). RLS-on plus a
-- permissive SELECT policy keeps PostGIS functions (ST_Transform, geography
-- spheroid lookups) working for API roles.
-- NOTE: table is owned by supabase_admin, so this fails under the `postgres`
-- role (SQL editor / apply-sql-file). The DO block logs a warning instead of
-- aborting; if it warns, enable RLS via a Supabase support ticket or move the
-- postgis extension to the `extensions` schema (drop + recreate — invasive).
DO $$
BEGIN
  ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE WARNING 'spatial_ref_sys is owned by supabase_admin — RLS not enabled. Needs Supabase support or postgis schema move.';
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c WHERE c.relname='spatial_ref_sys' AND c.relnamespace='public'::regnamespace AND c.relrowsecurity) THEN
    DROP POLICY IF EXISTS spatial_ref_sys_select ON public.spatial_ref_sys;
    CREATE POLICY spatial_ref_sys_select ON public.spatial_ref_sys
      FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

-- ── security_definer_view → security_invoker ────────────────────────────────
-- Both views were created as default (owner-context) views, so any caller read
-- with the postgres owner's privileges, bypassing RLS on underlying tables.
CREATE OR REPLACE VIEW public.digital_download_asset_stats
WITH (security_invoker = true) AS
 SELECT dd.id AS download_id,
    dd.download_page_id,
    dd.asset_name,
    dd.asset_type,
    count(dal.id) AS total_downloads,
    count(CASE WHEN (dal.download_successful = true) THEN 1 ELSE NULL::integer END) AS successful_downloads,
    count(CASE WHEN (dal.download_successful = false) THEN 1 ELSE NULL::integer END) AS failed_downloads,
    avg(CASE WHEN (dal.download_successful = true) THEN dal.download_duration_ms ELSE NULL::integer END) AS avg_download_duration_ms
   FROM (digital_downloads dd
     LEFT JOIN download_access_logs dal ON (((dal.download_id)::text = (dd.id)::text)))
  GROUP BY dd.id, dd.download_page_id, dd.asset_name, dd.asset_type;

CREATE OR REPLACE VIEW public.digital_download_page_stats
WITH (security_invoker = true) AS
 SELECT dp.id AS download_page_id,
    dp.tenant_id,
    dp.title,
    dp.status,
    count(DISTINCT dag.id) AS total_access_grants,
    count(DISTINCT CASE WHEN ((dag.status)::text = 'active'::text) THEN dag.id ELSE NULL::character varying END) AS active_access_grants,
    count(DISTINCT CASE WHEN ((dag.status)::text = 'expired'::text) THEN dag.id ELSE NULL::character varying END) AS expired_access_grants,
    count(DISTINCT CASE WHEN ((dag.status)::text = 'revoked'::text) THEN dag.id ELSE NULL::character varying END) AS revoked_access_grants,
    count(DISTINCT dal.id) AS total_download_attempts,
    count(DISTINCT CASE WHEN (dal.download_successful = true) THEN dal.id ELSE NULL::character varying END) AS successful_downloads,
    count(DISTINCT CASE WHEN (dal.download_successful = false) THEN dal.id ELSE NULL::character varying END) AS failed_downloads,
    sum(CASE WHEN (dal.download_successful = true) THEN dal.download_size ELSE (0)::bigint END) AS total_bytes_downloaded
   FROM ((digital_download_pages dp
     LEFT JOIN digital_access_grants dag ON (((dag.download_page_id)::text = (dp.id)::text)))
     LEFT JOIN download_access_logs dal ON (((dal.access_grant_id)::text = (dag.id)::text)))
  GROUP BY dp.id, dp.tenant_id, dp.title, dp.status;

-- ── mv_tenant_effective_capabilities — remove API-role read ─────────────────
REVOKE SELECT ON public.mv_tenant_effective_capabilities FROM anon, authenticated;

-- ── stg drift: PostgREST grants on app tables (prd has acl=null on these) ────
-- stg had authenticated=arw on orders/payments and authenticated=r on
-- platform_fee_tiers with RLS disabled — full read/write via the API. Nothing
-- legit reads them through PostgREST (web's anon client is auth-only; the API
-- connects as the postgres owner). REVOKE is a no-op on prd.
REVOKE ALL ON public.orders FROM authenticated;
REVOKE ALL ON public.payments FROM authenticated;
REVOKE ALL ON public.platform_fee_tiers FROM authenticated;
