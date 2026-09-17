-- Migration 213: Directory presence enrichment intake definition
--
-- Data-only migration: inserts the `directory_presence_enrichment` intake
-- definition into mkt_intake_definitions. This drives the token-gated
-- self-serve enrichment form rendered by IntakeFormRenderer.

INSERT INTO mkt_intake_definitions (
  intake_kind, label, description, driver, service_category,
  form_schema, field_mappings, owner_copy, niche_overrides,
  is_active, is_draft, created_at, updated_at
) VALUES (
  'directory_presence_enrichment',
  'Directory Listing Enrichment',
  'Token-gated self-serve form for business owners to enrich their unclaimed directory listing.',
  'registry',
  'directory',
  '[
    {"key":"hours","label":"Business Hours","type":"hours_grid","required":false,"help_text":"Set your weekly hours. Mark days closed if you are not open."},
    {"key":"logo","label":"Logo or Storefront Photo","type":"attachments","required":false,"help_text":"Upload a logo or photo of your storefront.","max_files":3},
    {"key":"phone","label":"Phone Number","type":"phone","required":false,"help_text":"Correct the phone number if it is wrong."},
    {"key":"website","label":"Website","type":"url","required":false,"help_text":"Your business website or social media page."},
    {"key":"snap_ebt","label":"Do you accept SNAP/EBT?","type":"checkbox","required":false,"help_text":"Check if you accept SNAP/EBT benefits."},
    {"key":"description","label":"Business Description","type":"textarea","required":false,"help_text":"A short description of your business for the directory."},
    {"key":"owner_name","label":"Your Name (optional)","type":"text","required":false,"help_text":"So we can address you correctly. Not published."}
  ]'::jsonb,
  '[
    {"field":"hours","adapter":"directory_listing_write","config":{"target_column":"hours"}},
    {"field":"hours","adapter":"directory_provenance_write","config":{"target_column":"hours","source":"owner_self_serve"}},
    {"field":"phone","adapter":"directory_listing_write","config":{"target_column":"phone"}},
    {"field":"phone","adapter":"directory_provenance_write","config":{"target_column":"phone","source":"owner_self_serve"}},
    {"field":"website","adapter":"directory_listing_write","config":{"target_column":"website"}},
    {"field":"website","adapter":"directory_provenance_write","config":{"target_column":"website","source":"owner_self_serve"}},
    {"field":"description","adapter":"directory_listing_write","config":{"target_column":"description"}},
    {"field":"description","adapter":"directory_provenance_write","config":{"target_column":"description","source":"owner_self_serve"}},
    {"field":"snap_ebt","adapter":"directory_snap_ebt_write"},
    {"field":"owner_name","adapter":"directory_seed_owner_write"}
  ]'::jsonb,
  '{"title":"Update Your Listing","body":"Thank you for updating your listing. Your information will appear on the directory."}'::jsonb,
  '{}'::jsonb,
  true,
  false,
  now(),
  now()
)
ON CONFLICT (intake_kind) DO NOTHING;
