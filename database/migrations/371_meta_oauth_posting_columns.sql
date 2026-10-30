-- Migration 371: Meta OAuth — posting-scope lifecycle columns
--
-- Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §6
--
-- posting_scopes_granted_at — when the connection last authorized the
--                             posting scope set (pages_manage_posts,
--                             instagram_content_publish, publish_video,
--                             threads_basic, threads_content_publish).
-- reauthorization_required  — set when scopes granted on the token diverge
--                             from META_SCOPES (existing connections need
--                             re-auth after the scope expansion).
-- scopes on meta_oauth_tokens_list already exists — granted-vs-required
-- is computed live, not cached.

ALTER TABLE meta_oauth_accounts_list
  ADD COLUMN IF NOT EXISTS posting_scopes_granted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reauthorization_required  BOOLEAN NOT NULL DEFAULT false;
