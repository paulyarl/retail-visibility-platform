-- 275_intake_contact_consent.sql
-- Contact-consent flags for the two public intake surfaces.
--
-- directory_presence_suggestions.contact_consent — "Suggest a business"
--   submitter opted in to being contacted about the suggestion (vs.
--   fire-and-forget). false for legacy rows is the safe reading: no opt-in
--   was captured, so treat as not consented.
--
-- directory_presence_seeds.owner_contact_consent — "Add your business"
--   owner opted in to being contacted back. Stored on the seed (alongside
--   owner_name/owner_email/owner_phone) so operators know whether the owner
--   contact info may be used; flows through the anonymous email-verification
--   payload (CreateSeedInput.ownerContactConsent).

ALTER TABLE directory_presence_suggestions
  ADD COLUMN IF NOT EXISTS contact_consent boolean NOT NULL DEFAULT false;

ALTER TABLE directory_presence_seeds
  ADD COLUMN IF NOT EXISTS owner_contact_consent boolean NOT NULL DEFAULT false;
