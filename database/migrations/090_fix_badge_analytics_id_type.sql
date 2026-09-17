-- Fix badge_analytics.id and badge_events.id from uuid to VARCHAR(255)
-- The code generates tenant-scoped IDs (bdga-{tk}-{nanoid} / bdge-{tk}-{nanoid})
-- but the DB columns were created as uuid, causing Prisma conversion errors.

-- 1. badge_analytics: alter id column from uuid to VARCHAR(255)
ALTER TABLE badge_analytics ALTER COLUMN id TYPE VARCHAR(255) USING id::text;
ALTER TABLE badge_analytics ALTER COLUMN id SET DEFAULT NULL;

-- 2. badge_events: alter id column from uuid to VARCHAR(255)
ALTER TABLE badge_events ALTER COLUMN id TYPE VARCHAR(255) USING id::text;
ALTER TABLE badge_events ALTER COLUMN id SET DEFAULT NULL;
