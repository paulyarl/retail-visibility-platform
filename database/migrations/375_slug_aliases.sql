-- Migration 375: Slug aliases — the deterministic half of dead-slug insurance
--
-- The fuzzy slug-variant resolver (services/directory/seedSlugVariants.ts)
-- infers old slugs from name/geo tokens — it cannot cover a full rename to
-- different tokens. This table records the trail at rename time: every slug
-- a tenant/listing vacates maps to the tenant that vacated it. Resolution is
-- then bookkeeping, not inference.
--
-- Invariants the writers enforce (updateSlug + the seed fields rename path):
--   - assigning a slug DELETES any alias row for that slug (a live owner
--     supersedes a stale alias — slug recycling)
--   - vacating a slug UPSERTS old_slug → tenant_id (latest rename wins)
-- Readers verify the alias target is still live before 308ing — a dead
-- target stays a 404, never a dangling redirect.

CREATE TABLE IF NOT EXISTS public.slug_aliases (
  old_slug    text        PRIMARY KEY,
  tenant_id   text        NOT NULL,
  replaced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slug_aliases_tenant
  ON public.slug_aliases (tenant_id, replaced_at DESC);
