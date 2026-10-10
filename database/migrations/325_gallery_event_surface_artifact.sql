-- 325_gallery_event_surface_artifact.sql
--
-- Sprint 8.4 — plan-CTA gallery events ride the same mkt_gallery_events
-- model, but a plan-level interaction isn't attributable to one sibling.
-- Two nullable dimensions carry that: `surface` names the artifact family
-- emitting the event ('gallery' today; 'proposal'/'execution' land on the
-- same event model later without a schema change — proposal spec §11) and
-- `artifact` carries the artifact-level identifier ('plan:claim',
-- 'plan:phase:foundation', 'plan:pricing', proposal version ids later).

ALTER TABLE mkt_gallery_events
  ADD COLUMN IF NOT EXISTS surface  varchar(30),
  ADD COLUMN IF NOT EXISTS artifact varchar(255);

COMMENT ON COLUMN mkt_gallery_events.surface IS
  'Artifact family emitting the event: gallery | proposal | execution. Null = legacy sibling-gallery event.';
COMMENT ON COLUMN mkt_gallery_events.artifact IS
  'Artifact-level identifier for non-sibling events, e.g. plan:claim | plan:phase:<key> | plan:pricing.';
