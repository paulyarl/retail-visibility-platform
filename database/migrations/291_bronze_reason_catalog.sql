-- Migration 291: mkt_bronze_reason_catalog + mkt_bronze_catalog_meta
--
-- Bronze Standard system (docs/LocalBiz/BRONZE_STANDARD_SPEC.md): the
-- DB-authoritative reason catalog for bronze profiles. Each reason names a
-- discovery blind spot (why a category-qualified, operating business is
-- invisible); bronze slots are typed by reason, one per discovery vector.
--
--   - mkt_bronze_reason_catalog: the catalog itself. reason_key is the
--     immutable join key between catalog, profile slots, vector_execution_log,
--     and downstream profiles (op_<slug> immutability precedent, migration 288).
--     Catalog is additive — reasons are never deleted, only deprecated via
--     deprecated_in_revision (+ optional superseded_by pointing at the
--     canonical key, §3.5.6).
--   - mkt_bronze_catalog_meta: single-row monotonic catalog_revision counter
--     (§3.5.2). The catalog service bumps it inside the same transaction as
--     every catalog write; bronze profiles stamp it so staleness is a single
--     predicate (§3.5.3).
--
-- No CHECK constraints — provenance, priority range, and scope_platform
-- vocabulary are validated in code (BronzeReasonCatalogService), per the
-- mkt_manual_play_templates precedent and the chk_<->app-enum drift rule
-- (migrations 256/264/270). No RLS, no updated_at triggers — mkt_* family
-- convention (manual-sql-migration-policy.md); updated_at is maintained by
-- the catalog service on every write.
--
-- Scope columns are NULL = wildcard (§3.6.1): universal / category /
-- location / category+location levels, plus the independent scope_platform
-- axis (§3.6.5). All scope values are stored in NORMALIZED form —
-- scope_category_key via normalizeCategoryKey (spaces, not underscores),
-- scope_city title-cased, scope_state 2-letter code, scope_platform
-- lowercased gold vocabulary. Seed literals below are already normalized.

CREATE TABLE IF NOT EXISTS mkt_bronze_reason_catalog (
  reason_key             varchar(80)  PRIMARY KEY,          -- immutable join key
  label                  varchar(255) NOT NULL,
  definition             text         NOT NULL,
  signals                jsonb        NOT NULL DEFAULT '[]', -- searchable signal vocabulary (§3.1)
  expected_vectors       jsonb        NOT NULL DEFAULT '[]', -- vectors that should surface it
  priority               int          NOT NULL DEFAULT 3,    -- 1-5, orders slot-filling effort
  scope_category_key     varchar(255),                       -- NULL = any category
  scope_city             varchar(100),                       -- NULL = any market (city+state set together)
  scope_state            varchar(50),
  scope_platform         varchar(20),                        -- NULL = platform-agnostic
  provenance             varchar(30)  NOT NULL DEFAULT 'operator_authored', -- derived | operator_authored
  introduced_in_revision int          NOT NULL,
  revised_in_revision    int,                                -- last content/scope revision
  deprecated_in_revision int,
  deprecated_reason      text,
  superseded_by          varchar(80),                        -- -> canonical reason_key (§3.5.6)
  created_by             varchar(255),
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mkt_bronze_reason_catalog_scope
  ON mkt_bronze_reason_catalog (scope_category_key, scope_city, scope_state);

CREATE INDEX IF NOT EXISTS idx_mkt_bronze_reason_catalog_deprecated
  ON mkt_bronze_reason_catalog (deprecated_in_revision);

CREATE TABLE IF NOT EXISTS mkt_bronze_catalog_meta (
  id               text         PRIMARY KEY,               -- always 'catalog'
  catalog_revision int          NOT NULL,
  updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- Single counter row, seeded at 1 (the seed rows below are revision 1).
INSERT INTO mkt_bronze_catalog_meta (id, catalog_revision)
SELECT 'catalog', 1
WHERE NOT EXISTS (SELECT 1 FROM mkt_bronze_catalog_meta WHERE id = 'catalog');

-- §3.2 seed catalog — derived post-hoc from the Indianapolis African Grocery
-- Store sweep. provenance='derived', introduced_in_revision=1. Per-row
-- idempotent: re-running skips existing reason_keys.
INSERT INTO mkt_bronze_reason_catalog
  (reason_key, label, definition, signals, expected_vectors, priority,
   scope_category_key, scope_city, scope_state, scope_platform,
   provenance, introduced_in_revision)
SELECT * FROM (VALUES
  ('misaligned_platform_category',
   'Mis-categorized platform category',
   'The business is category-qualified and operating, but its platform profile carries a generic or wrong primary category label, so category-label searches miss it. Indianapolis instance: Arsema — GBP primary category "Convenience store".',
   '["platform primary category label is generic (e.g. Convenience store, Grocery store, Restaurant) while description or photos show specialization", "assortment evidence contradicts the platform-assigned category", "business absent from category-filtered platform searches"]'::jsonb,
   '["category-taxonomy sweep"]'::jsonb,
   1, NULL, NULL, NULL, NULL, 'derived', 1),

  ('no_category_token_in_name',
   'Name carries no category word',
   'The business name contains no English category word — an endonym, transliteration, or opaque trade name — so name-token searches miss it. Indianapolis instances: Arsema; Senay Habesha.',
   '["name contains no English category token", "name is a transliteration or endonym (non-English origin)", "category identity appears only in description, signage, or records — never in the name"]'::jsonb,
   '["endonym / transliteration sweep"]'::jsonb,
   1, NULL, NULL, NULL, NULL, 'derived', 1),

  ('trade_manifest_only',
   'Trade / import-only visibility',
   'The business is category-qualified and operating, but its only public trace is a customs bill-of-lading record naming it as importer of record. It has no category-bearing platform profile. Indianapolis instances: Arsema; Kaura International Food Market.',
   '["bill of lading names the business as importer of record", "manifest line items name category-defining goods", "importer-of-record address differs from any directory listing address"]'::jsonb,
   '["customs / trade records"]'::jsonb,
   1, 'african grocery store', NULL, NULL, NULL, 'derived', 1),

  ('no_mainstream_profile',
   'No platform profile at all',
   'The business is confirmed operating but has no profile on any mainstream platform — its only traces are address-indexed or registry datasets. Indianapolis instance: Habesha Ethiopian Store LLC — registry only.',
   '["state business-registry filing names the business at a storefront address with no matching platform listing", "utility, tax, or licensing record confirms operation at an address with no platform profile", "address-indexed datasets list the business; Google, Yelp, and Facebook return nothing"]'::jsonb,
   '["address-indexed datasets"]'::jsonb,
   2, NULL, NULL, NULL, NULL, 'derived', 1),

  ('hosted_storefront_only',
   'Hosted storefront is the only web surface',
   'The business''s only web surface is a hosted storefront subdomain (e.g. *.square.site, *.myshopify.com); no independent site and no platform profile. Indianapolis instance: arsemamart.square.site.',
   '["only web result for the business is a hosted storefront subdomain", "no independent domain exists for the business", "no platform profile beyond the hosted page"]'::jsonb,
   '["site-scoped sweep"]'::jsonb,
   2, NULL, NULL, NULL, NULL, 'derived', 1),

  ('alternate_identity',
   'Second trading name at the same address',
   'The business trades under a second name at the same address or phone, splitting or obscuring its public trace. Indianapolis instance: "Ethiopian Eritrean Store" listed at Arsema''s address and phone.',
   '["two distinct business names share an address or phone", "directory listings disagree on the name at a confirmed address", "one identity carries the category signal while the other does not"]'::jsonb,
   '["identity-conflict detection"]'::jsonb,
   2, NULL, NULL, NULL, NULL, 'derived', 1),

  ('corridor_absent_from_guides',
   'Storefront on no known retail corridor',
   'The storefront sits on a street or cluster that appears in no known retail corridor or guide, so corridor-driven discovery misses it. Indianapolis instance: W Washington St / W 10th St cluster.',
   '["storefront address falls outside every known retail corridor for the market", "a cluster of category-relevant storefronts sits on an unlisted street", "no local guide, directory, or corridor map names the street"]'::jsonb,
   '["address clustering"]'::jsonb,
   2, NULL, NULL, NULL, NULL, 'derived', 1),

  ('wholesale_or_hybrid_role',
   'Wholesale or grocery-plus-kitchen hybrid',
   'The business operates as a wholesaler or a grocery-plus-kitchen hybrid, so retail-facing discovery paths miss it even though it is category-qualified. Indianapolis instances: Amez International Imports; East African Imports Wholesale.',
   '["described as wholesale, import, or distribution in filings or signage", "a dual role (e.g. grocery plus kitchen) splits its platform categorization", "absent from retail directories but present in foodservice or wholesale channels"]'::jsonb,
   '["foodservice / wholesale channels"]'::jsonb,
   3, 'african grocery store', NULL, NULL, NULL, 'derived', 1),

  ('community_only_no_reviews',
   'Community-known, no reviews',
   'The business is known inside its community but carries no review footprint anywhere — invisible to review-driven discovery. Indianapolis instance: hidden-trust grocers.',
   '["community or referral sources name the business while all platforms show zero reviews", "word-of-mouth presence with no review surface", "operating storefront with empty review sections"]'::jsonb,
   '["community / referral networks"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('non_english_signage_only',
   'Non-English signage, no English listing',
   'The storefront signage is non-English with no English-language listing, so English-language searches miss it. Indianapolis instance: corridor storefronts.',
   '["Street View shows non-English signage only", "no English-language listing or website exists", "storefront is legible only in a non-English script"]'::jsonb,
   '["Street View sweep"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('absent_from_platform',
   'Confirmed operating, no profile on the observed platform',
   'The business is confirmed operating but has no profile on the observed platform; it may be present on others. The absent platform is recorded on the slot via observed_platform. Indianapolis instance: strong-on-Google businesses with no Facebook/Yelp presence.',
   '["business confirmed operating via other sources; no listing on the observed platform", "platform search returns nothing for a verified address", "presence on other platforms corroborates the absence"]'::jsonb,
   '["platform-presence audit"]'::jsonb,
   1, NULL, NULL, NULL, NULL, 'derived', 1),

  ('unclaimed_profile',
   'Platform profile exists but was never claimed',
   'A platform profile exists for the business but was never claimed — no owner control over content, hours, or responses. Indianapolis instance: unclaimed GBPs.',
   '["platform shows an unclaimed or own-this-business state", "no owner responses, posts, or claimed-state indicators", "profile fields are auto-generated only"]'::jsonb,
   '["platform-presence audit"]'::jsonb,
   2, NULL, NULL, NULL, NULL, 'derived', 1),

  ('stale_or_missing_hours',
   'Profile carries no or unreliable hours',
   'The platform profile carries no hours, or hours that conflict with other sources — a field-level invisibility signal.',
   '["hours field is empty on the profile", "listed hours contradict other platforms or observed storefront signage", "platform shows an hours-might-differ caveat"]'::jsonb,
   '["platform field audit"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('no_website_or_contact',
   'Profile lacks website link and contact info',
   'The platform profile has no website link and no usable contact information — a field-level invisibility signal.',
   '["no website field on the profile", "no phone or contact method listed", "profile carries an address only"]'::jsonb,
   '["platform field audit"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('zero_or_floor_reviews',
   'Profile present, zero-to-floor review count',
   'The platform profile exists but its review count is zero or at floor level relative to category norms — reads as invisible or untrusted.',
   '["review count is zero or near-zero relative to category norms", "no ratings are displayed", "reviews are absent despite operating history"]'::jsonb,
   '["platform field audit"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('thin_photo_surface',
   'Profile has no or floor-level photos',
   'The platform profile has no photos or a floor-level photo count — nothing to establish the storefront visually.',
   '["no photos on the profile", "only street-view or auto-generated imagery exists", "photo count is far below category norm"]'::jsonb,
   '["platform field audit"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1),

  ('low_rating_floor',
   'Ratings absent or floor-level on the profile',
   'The platform profile displays no rating or a floor-level rating aggregate despite being present.',
   '["no rating is displayed on the profile", "rating count is at floor level", "aggregate rating is missing despite profile presence"]'::jsonb,
   '["platform field audit"]'::jsonb,
   3, NULL, NULL, NULL, NULL, 'derived', 1)
) AS v(reason_key, label, definition, signals, expected_vectors, priority,
       scope_category_key, scope_city, scope_state, scope_platform,
       provenance, introduced_in_revision)
WHERE NOT EXISTS (
  SELECT 1 FROM mkt_bronze_reason_catalog c WHERE c.reason_key = v.reason_key
);

-- ─── Verification (manual) ───────────────────────────────────────────────
-- SELECT count(*) FROM mkt_bronze_reason_catalog;                       -- 17
-- SELECT * FROM mkt_bronze_catalog_meta;                                -- revision 1
-- SELECT reason_key, scope_category_key, priority FROM mkt_bronze_reason_catalog ORDER BY priority, reason_key;
-- SELECT reason_key FROM mkt_bronze_reason_catalog
--   WHERE (scope_category_key IS NULL OR scope_category_key = 'african grocery store')
--     AND scope_city IS NULL AND scope_state IS NULL
--     AND deprecated_in_revision IS NULL;                               -- 17 rows for african grocery store
