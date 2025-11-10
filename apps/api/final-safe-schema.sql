-- Safe schema creation - wraps everything in DO blocks to skip if exists

-- Create all enums safely
DO $$ BEGIN CREATE TYPE "user_role" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_VIEWER', 'ADMIN', 'OWNER', 'USER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "user_tenant_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "availability_status" AS ENUM ('in_stock', 'out_of_stock', 'preorder'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "product_condition" AS ENUM ('new', 'refurbished', 'used'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "item_visibility" AS ENUM ('public', 'private'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "sync_status" AS ENUM ('pending', 'success', 'error'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "item_status" AS ENUM ('active', 'inactive', 'archived'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "actor_type" AS ENUM ('user', 'system', 'integration'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "entity_type" AS ENUM ('inventory_item', 'tenant', 'policy', 'oauth', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "action" AS ENUM ('create', 'update', 'delete', 'sync', 'policy_apply', 'oauth_connect', 'oauth_refresh'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "permission_action" AS ENUM ('tenant.create', 'tenant.read', 'tenant.update', 'tenant.delete', 'tenant.manage_users', 'inventory.create', 'inventory.read', 'inventory.update', 'inventory.delete', 'analytics.view', 'admin.access_dashboard', 'admin.manage_settings'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "job_status" AS ENUM ('queued', 'processing', 'success', 'failed'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "product_source" AS ENUM ('MANUAL', 'QUICK_START_WIZARD', 'PRODUCT_SCAN', 'IMPORT', 'API', 'BULK_UPLOAD', 'CLOVER_DEMO'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "enrichment_status" AS ENUM ('COMPLETE', 'NEEDS_ENRICHMENT', 'PARTIALLY_ENRICHED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
