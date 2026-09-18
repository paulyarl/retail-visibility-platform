-- 295_directory_presence_events_surface_scope.sql
--
-- Per-surface engagement for the directory surfaces ecosystem.
-- (docs/LocalBiz/directory_presence_traffic_surface_sprint_plan.md; AGENTS.md →
--  "Directory Presence Traffic Surface")
--
-- `directory_presence_events` (migration 293) was ENTRY-scoped: `tenant_id` and
-- `listing_id` are NOT NULL, so shelf surfaces (category / location / store-type
-- / home) could not be recorded. This migration makes the table surface-scoped:
--
--   surface     — which surface emitted the event:
--                 place_entry | directory_entry | place_category | place_city |
--                 directory_category | directory_location |
--                 directory_store_type | directory_home
--   entity_ref  — the surface's own reference (shelf slug, or entry slug)
--   detail      — event-specific detail (e.g. the filter key for filter_applied)
--
-- `tenant_id` / `listing_id` become NULLABLE: entry events still carry both,
-- shelf events carry neither. `slug` is reused as the denormalized slug.
--
-- Safe to apply: the table was empty at the time of writing (0 rows).
-- Idempotent: DROP NOT NULL and IF NOT EXISTS are re-runnable.
--
-- Apply against both `local` and `prd`:
--   psql "$DATABASE_URL" -f database/migrations/295_directory_presence_events_surface_scope.sql

ALTER TABLE directory_presence_events ALTER COLUMN tenant_id DROP NOT NULL;
ALTER TABLE directory_presence_events ALTER COLUMN listing_id DROP NOT NULL;

ALTER TABLE directory_presence_events ADD COLUMN IF NOT EXISTS surface VARCHAR(40);
ALTER TABLE directory_presence_events ADD COLUMN IF NOT EXISTS entity_ref VARCHAR(255);
ALTER TABLE directory_presence_events ADD COLUMN IF NOT EXISTS detail VARCHAR(255);

-- Per-surface rollups (the Surface Engagement readout groups by surface).
CREATE INDEX IF NOT EXISTS idx_dpe_surface_created
  ON directory_presence_events (surface, created_at DESC);
