-- Migration: Make features_list.category nullable
-- Reason: The Add Feature UI does not send a category, so the backend was
-- silently defaulting to 'product_types'. This makes category truly optional.

ALTER TABLE features_list ALTER COLUMN category DROP NOT NULL;
