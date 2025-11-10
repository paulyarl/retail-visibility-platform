-- Safe schema creation - skips if already exists

-- Create enums safely
DO $$ BEGIN
    CREATE TYPE "user_role" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'ADMIN', 'OWNER', 'USER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "user_tenant_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "availability_status" AS ENUM ('in_stock', 'out_of_stock', 'preorder');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "product_condition" AS ENUM ('new', 'refurbished', 'used');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "item_visibility" AS ENUM ('public', 'private');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "sync_status" AS ENUM ('pending', 'success', 'error');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "item_status" AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "actor_type" AS ENUM ('user', 'system', 'integration');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "entity_type" AS ENUM ('inventory_item', 'tenant', 'policy', 'oauth', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Now copy the rest of full-schema-clean.sql starting from the CREATE TABLE statements
-- Skip all the CREATE TYPE lines and paste everything else below this line
