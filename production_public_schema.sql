--
-- PostgreSQL database dump
--

\restrict DykrRJ3R7WYMyC1EeUnqrk6YZCK7XKyGEuLCTDCc6zKn1hI3JLAQEgYd3ALVhcL

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: LocationStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."LocationStatus" AS ENUM (
    'pending',
    'active',
    'inactive',
    'closed',
    'archived'
);


ALTER TYPE public."LocationStatus" OWNER TO postgres;

--
-- Name: action; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.action AS ENUM (
    'create',
    'update',
    'delete',
    'sync',
    'policy_apply',
    'oauth_connect',
    'oauth_refresh'
);


ALTER TYPE public.action OWNER TO postgres;

--
-- Name: actor_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.actor_type AS ENUM (
    'user',
    'system',
    'integration'
);


ALTER TYPE public.actor_type OWNER TO postgres;

--
-- Name: availability_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.availability_status AS ENUM (
    'in_stock',
    'out_of_stock',
    'preorder'
);


ALTER TYPE public.availability_status OWNER TO postgres;

--
-- Name: enrichment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.enrichment_status AS ENUM (
    'COMPLETE',
    'NEEDS_ENRICHMENT',
    'PARTIALLY_ENRICHED'
);


ALTER TYPE public.enrichment_status OWNER TO postgres;

--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.entity_type AS ENUM (
    'inventory_item',
    'tenant',
    'policy',
    'oauth',
    'other'
);


ALTER TYPE public.entity_type OWNER TO postgres;

--
-- Name: item_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_status AS ENUM (
    'active',
    'inactive',
    'archived',
    'trashed',
    'draft'
);


ALTER TYPE public.item_status OWNER TO postgres;

--
-- Name: item_visibility; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.item_visibility AS ENUM (
    'public',
    'private'
);


ALTER TYPE public.item_visibility OWNER TO postgres;

--
-- Name: job_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.job_status AS ENUM (
    'queued',
    'processing',
    'success',
    'failed'
);


ALTER TYPE public.job_status OWNER TO postgres;

--
-- Name: location_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.location_status AS ENUM (
    'pending',
    'active',
    'inactive',
    'closed',
    'archived'
);


ALTER TYPE public.location_status OWNER TO postgres;

--
-- Name: permission_action; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.permission_action AS ENUM (
    'tenant.create',
    'tenant.read',
    'tenant.update',
    'tenant.delete',
    'tenant.manage_users',
    'inventory.create',
    'inventory.read',
    'inventory.update',
    'inventory.delete',
    'analytics.view',
    'admin.access_dashboard',
    'admin.manage_settings'
);


ALTER TYPE public.permission_action OWNER TO postgres;

--
-- Name: product_condition; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_condition AS ENUM (
    'brand_new',
    'refurbished',
    'used'
);


ALTER TYPE public.product_condition OWNER TO postgres;

--
-- Name: product_source; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_source AS ENUM (
    'MANUAL',
    'QUICK_START_WIZARD',
    'PRODUCT_SCAN',
    'IMPORT',
    'API',
    'BULK_UPLOAD',
    'CLOVER_DEMO'
);


ALTER TYPE public.product_source OWNER TO postgres;

--
-- Name: sync_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.sync_status AS ENUM (
    'pending',
    'success',
    'error'
);


ALTER TYPE public.sync_status OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'OWNER',
    'USER',
    'PLATFORM_ADMIN',
    'PLATFORM_SUPPORT',
    'PLATFORM_VIEWER'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: user_tenant_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_tenant_role AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'VIEWER',
    'SUPPORT'
);


ALTER TYPE public.user_tenant_role OWNER TO postgres;

--
-- Name: refresh_directory_category_stores(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_directory_category_stores() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY directory_category_stores;
END;
$$;


ALTER FUNCTION public.refresh_directory_category_stores() OWNER TO postgres;

--
-- Name: refresh_directory_listings(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.refresh_directory_listings() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    tenant_table_name TEXT := 'Tenant';
    profile_table_name TEXT := 'tenant_business_profile';
    inventory_table_name TEXT := 'InventoryItem';
BEGIN
    -- Insert new tenants - use dynamic table names
    EXECUTE format('
        INSERT INTO directory_listings (
            id,
            tenant_id,
            business_name,
            slug,
            address,
            city,
            state,
            zip_code,
            phone,
            email,
            website,
            latitude,
            longitude,
            logo_url,
            subscription_tier,
            use_custom_website
        )
        SELECT
            t.id,
            t.id as tenant_id,
            COALESCE(p.business_name, t.name) as business_name,
            LOWER(REPLACE(COALESCE(p.business_name, t.name), '' '', ''-'')) || ''-'' || t.id as slug,
            COALESCE(p.address_line1, '''') as address,
            p.city,
            p.state,
            p.postal_code as zip_code,
            p.phone_number as phone,
            p.email,
            p.website,
            p.latitude,
            p.longitude,
            p.logo_url,
            COALESCE(t."subscriptionTier", ''trial'') as subscription_tier,
            false as use_custom_website
        FROM %I t
        LEFT JOIN %I p ON t.id = p.tenant_id
        WHERE t.id NOT IN (SELECT tenant_id FROM directory_listings)
        ON CONFLICT (id) DO UPDATE SET
            business_name = EXCLUDED.business_name,
            slug = EXCLUDED.slug,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            state = EXCLUDED.state,
            zip_code = EXCLUDED.zip_code,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            website = EXCLUDED.website,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            logo_url = EXCLUDED.logo_url,
            subscription_tier = EXCLUDED.subscription_tier,
            updated_at = NOW()
    ', tenant_table_name, profile_table_name);

    -- Update product counts for all listings
    EXECUTE format('
        UPDATE directory_listings
        SET product_count = (
            SELECT COUNT(*)
            FROM %I ii
            WHERE ii."tenantId" = directory_listings.tenant_id
            AND ii."itemStatus" = ''active''
            AND ii.visibility = ''public''
        )
    ', inventory_table_name);

    RAISE NOTICE 'Directory listings refreshed successfully';
END;
$$;


ALTER FUNCTION public.refresh_directory_listings() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: InventoryItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."InventoryItem" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    "priceCents" integer NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    "imageUrl" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "marketingDescription" text,
    "imageGallery" text[] DEFAULT '{}'::text[],
    "customCta" jsonb,
    "socialLinks" jsonb,
    "customBranding" jsonb,
    "customSections" jsonb[] DEFAULT '{}'::jsonb[],
    "landingPageTheme" text DEFAULT 'default'::text,
    "auditLogId" text,
    availability public.availability_status DEFAULT 'in_stock'::public.availability_status NOT NULL,
    brand text NOT NULL,
    "categoryPath" text[] DEFAULT ARRAY[]::text[],
    condition public.product_condition DEFAULT 'brand_new'::public.product_condition,
    currency character(3) DEFAULT 'USD'::bpchar NOT NULL,
    description text,
    "eligibilityReason" text,
    gtin text,
    "itemStatus" public.item_status DEFAULT 'active'::public.item_status,
    "locationId" text,
    manufacturer text,
    "merchantName" text,
    mpn text,
    price numeric(12,2) NOT NULL,
    quantity integer,
    "searchTsv" tsvector,
    "syncStatus" public.sync_status DEFAULT 'pending'::public.sync_status,
    "syncedAt" timestamp(3) without time zone,
    title text NOT NULL,
    visibility public.item_visibility DEFAULT 'public'::public.item_visibility,
    tenant_category_id text,
    enriched_at timestamp(3) without time zone,
    enriched_by text,
    enriched_from_barcode text,
    missing_images boolean DEFAULT false NOT NULL,
    missing_description boolean DEFAULT false NOT NULL,
    missing_specs boolean DEFAULT false NOT NULL,
    missing_brand boolean DEFAULT false NOT NULL,
    source public.product_source DEFAULT 'MANUAL'::public.product_source NOT NULL,
    "enrichmentStatus" public.enrichment_status DEFAULT 'COMPLETE'::public.enrichment_status NOT NULL
);


ALTER TABLE public."InventoryItem" OWNER TO postgres;

--
-- Name: COLUMN "InventoryItem"."marketingDescription"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."marketingDescription" IS 'Professional+ tier: Custom marketing copy for landing page';


--
-- Name: COLUMN "InventoryItem"."imageGallery"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."imageGallery" IS 'Professional+ tier: Array of image URLs for product gallery';


--
-- Name: COLUMN "InventoryItem"."customCta"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."customCta" IS 'Professional+ tier: Custom call-to-action button config';


--
-- Name: COLUMN "InventoryItem"."socialLinks"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."socialLinks" IS 'Professional+ tier: Social media links';


--
-- Name: COLUMN "InventoryItem"."customBranding"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."customBranding" IS 'Enterprise tier: Custom branding (logo, colors)';


--
-- Name: COLUMN "InventoryItem"."customSections"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."customSections" IS 'Enterprise tier: Custom content sections';


--
-- Name: COLUMN "InventoryItem"."landingPageTheme"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."InventoryItem"."landingPageTheme" IS 'Enterprise tier: Landing page theme/template';


--
-- Name: LocationStatusLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LocationStatusLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "oldStatus" public."LocationStatus" NOT NULL,
    "newStatus" public."LocationStatus" NOT NULL,
    "changedBy" text NOT NULL,
    reason text,
    "reopeningDate" timestamp(3) without time zone,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."LocationStatusLog" OWNER TO postgres;

--
-- Name: PhotoAsset; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PhotoAsset" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "inventoryItemId" text NOT NULL,
    url text NOT NULL,
    width integer,
    height integer,
    "contentType" text,
    bytes integer,
    "exifRemoved" boolean DEFAULT false NOT NULL,
    "capturedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publicUrl" text,
    "signedUrl" text,
    "position" integer DEFAULT 0 NOT NULL,
    alt text,
    caption text
);


ALTER TABLE public."PhotoAsset" OWNER TO postgres;

--
-- Name: ProductPerformance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ProductPerformance" (
    id text NOT NULL,
    "itemId" text NOT NULL,
    "tenantId" text NOT NULL,
    date date NOT NULL,
    "approvalStatus" text,
    "rejectionReason" text,
    impressions integer DEFAULT 0 NOT NULL,
    clicks integer DEFAULT 0 NOT NULL,
    ctr numeric(5,2) DEFAULT 0 NOT NULL,
    conversions integer DEFAULT 0 NOT NULL,
    revenue numeric(12,2) DEFAULT 0 NOT NULL,
    "visibilityScore" integer DEFAULT 0 NOT NULL,
    "searchRank" integer,
    "lastUpdated" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ProductPerformance" OWNER TO postgres;

--
-- Name: SyncJob; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SyncJob" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    target text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    attempt integer DEFAULT 0 NOT NULL,
    payload jsonb NOT NULL,
    "lastError" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL
);


ALTER TABLE public."SyncJob" OWNER TO postgres;

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    region text DEFAULT 'us-east-1'::text NOT NULL,
    language text DEFAULT 'en-US'::text NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    data_policy_accepted boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "subscriptionStatus" text DEFAULT 'trial'::text,
    "subscriptionTier" text DEFAULT 'starter'::text,
    "trialEndsAt" timestamp(3) without time zone,
    "subscriptionEndsAt" timestamp(3) without time zone,
    "stripeCustomerId" text,
    "stripeSubscriptionId" text,
    "organizationId" text,
    "serviceLevel" text DEFAULT 'self_service'::text,
    "managedServicesActive" boolean DEFAULT false NOT NULL,
    "dedicatedManager" text,
    "monthlySkuQuota" integer,
    "skusAddedThisMonth" integer DEFAULT 0 NOT NULL,
    "googleBusinessAccessToken" text,
    "googleBusinessRefreshToken" text,
    "googleBusinessTokenExpiry" timestamp(3) without time zone,
    created_by text,
    location_status public.location_status DEFAULT 'active'::public.location_status NOT NULL,
    status_changed_at timestamp(3) without time zone,
    status_changed_by text,
    reopening_date timestamp(3) without time zone,
    closure_reason text,
    "locationStatus" public."LocationStatus" DEFAULT 'active'::public."LocationStatus",
    "statusChangedAt" timestamp(3) without time zone,
    "statusChangedBy" text,
    "reopeningDate" timestamp(3) without time zone,
    "closureReason" text,
    slug text,
    google_sync_enabled boolean DEFAULT false,
    google_last_sync timestamp without time zone,
    google_product_count integer DEFAULT 0,
    directory_visible boolean DEFAULT true
);


ALTER TABLE public."Tenant" OWNER TO postgres;

--
-- Name: COLUMN "Tenant"."organizationId"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."organizationId" IS 'If set, tenant is part of a chain and inherits org subscription';


--
-- Name: COLUMN "Tenant"."serviceLevel"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."serviceLevel" IS 'Service level: self_service, managed_bronze, managed_silver, managed_gold, managed_platinum';


--
-- Name: COLUMN "Tenant"."managedServicesActive"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."managedServicesActive" IS 'Whether tenant is using managed services';


--
-- Name: COLUMN "Tenant"."dedicatedManager"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."dedicatedManager" IS 'Staff member assigned to manage this tenant inventory';


--
-- Name: COLUMN "Tenant"."monthlySkuQuota"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."monthlySkuQuota" IS 'Number of SKUs included per month in managed service plan';


--
-- Name: COLUMN "Tenant"."skusAddedThisMonth"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant"."skusAddedThisMonth" IS 'Track SKU usage for current month (resets monthly)';


--
-- Name: COLUMN "Tenant".created_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".created_by IS 'User ID who created this tenant (for auditing and PLATFORM_SUPPORT limits)';


--
-- Name: COLUMN "Tenant".slug; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".slug IS 'URL-friendly identifier for tenant (e.g., joes-market)';


--
-- Name: COLUMN "Tenant".google_sync_enabled; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".google_sync_enabled IS 'Whether this tenant is actively syncing products with Google Merchant Center';


--
-- Name: COLUMN "Tenant".google_last_sync; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".google_last_sync IS 'Timestamp of last successful sync with Google';


--
-- Name: COLUMN "Tenant".google_product_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".google_product_count IS 'Number of products currently synced to Google';


--
-- Name: COLUMN "Tenant".directory_visible; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public."Tenant".directory_visible IS 'Whether this tenant should appear in the public directory';


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id text NOT NULL,
    tenant_id text NOT NULL,
    actor_id text NOT NULL,
    actor_type public.actor_type NOT NULL,
    diff jsonb NOT NULL,
    entity_id text NOT NULL,
    entity_type public.entity_type NOT NULL,
    ip text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    occurred_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    pii_scrubbed boolean DEFAULT true NOT NULL,
    request_id text,
    user_agent text,
    action public.action NOT NULL
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: barcode_enrichment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barcode_enrichment (
    id text NOT NULL,
    barcode text NOT NULL,
    name text,
    brand text,
    description text,
    category_path text[],
    price_cents integer,
    image_url text,
    image_thumbnail_url text,
    metadata jsonb,
    source text NOT NULL,
    last_fetched_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fetch_count integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.barcode_enrichment OWNER TO postgres;

--
-- Name: barcode_lookup_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.barcode_lookup_log (
    id text NOT NULL,
    tenant_id text NOT NULL,
    barcode text NOT NULL,
    provider text,
    status text DEFAULT 'success'::text NOT NULL,
    response jsonb,
    latency_ms integer,
    error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.barcode_lookup_log OWNER TO postgres;

--
-- Name: business_hours; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_hours (
    id text NOT NULL,
    tenant_id text NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    periods jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_hash text,
    last_synced_at timestamp(3) without time zone,
    sync_attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.business_hours OWNER TO postgres;

--
-- Name: business_hours_special; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_hours_special (
    id text NOT NULL,
    tenant_id text NOT NULL,
    date date NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    open text,
    close text,
    note text,
    source_hash text,
    last_synced_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.business_hours_special OWNER TO postgres;

--
-- Name: category_mirror_runs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.category_mirror_runs (
    id text NOT NULL,
    tenant_id text,
    strategy text NOT NULL,
    dry_run boolean DEFAULT true NOT NULL,
    created integer DEFAULT 0 NOT NULL,
    updated integer DEFAULT 0 NOT NULL,
    deleted integer DEFAULT 0 NOT NULL,
    skipped boolean DEFAULT false NOT NULL,
    reason text,
    error text,
    job_id text,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.category_mirror_runs OWNER TO postgres;

--
-- Name: clover_demo_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clover_demo_snapshots (
    id text NOT NULL,
    integration_id text NOT NULL,
    snapshot_data jsonb NOT NULL,
    item_count integer NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.clover_demo_snapshots OWNER TO postgres;

--
-- Name: clover_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clover_integrations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    mode text DEFAULT 'demo'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    access_token text,
    refresh_token text,
    token_expires_at timestamp(3) without time zone,
    merchant_id text,
    demo_enabled_at timestamp(3) without time zone,
    demo_last_active_at timestamp(3) without time zone,
    production_enabled_at timestamp(3) without time zone,
    last_sync_at timestamp(3) without time zone,
    last_sync_status text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.clover_integrations OWNER TO postgres;

--
-- Name: clover_item_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clover_item_mappings (
    id text NOT NULL,
    integration_id text NOT NULL,
    clover_item_id text NOT NULL,
    clover_item_name text NOT NULL,
    clover_sku text,
    rvp_item_id text,
    rvp_sku text,
    mapping_status text DEFAULT 'pending'::text NOT NULL,
    conflict_reason text,
    last_synced_at timestamp(3) without time zone,
    last_sync_status text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.clover_item_mappings OWNER TO postgres;

--
-- Name: clover_sync_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clover_sync_logs (
    id text NOT NULL,
    integration_id text NOT NULL,
    trace_id text NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    items_processed integer DEFAULT 0 NOT NULL,
    items_succeeded integer DEFAULT 0 NOT NULL,
    items_failed integer DEFAULT 0 NOT NULL,
    error_message text,
    error_details jsonb,
    duration_ms integer,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.clover_sync_logs OWNER TO postgres;

--
-- Name: tenant_business_profile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_business_profile (
    tenant_id text NOT NULL,
    business_name text NOT NULL,
    address_line1 text NOT NULL,
    address_line2 text,
    city text NOT NULL,
    state text,
    postal_code text NOT NULL,
    country_code character(2) NOT NULL,
    phone_number text,
    email text,
    website text,
    contact_person text,
    hours jsonb,
    social_links jsonb,
    seo_tags jsonb,
    latitude numeric(65,30),
    longitude numeric(65,30),
    display_map boolean DEFAULT false NOT NULL,
    map_privacy_mode text DEFAULT 'precise'::text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    logo_url text,
    gbp_category_id text,
    gbp_category_name text,
    gbp_category_last_mirrored timestamp(3) without time zone,
    gbp_category_sync_status text,
    banner_url text,
    business_description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tenant_business_profile OWNER TO postgres;

--
-- Name: tenant_category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_category (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    parent_id text,
    google_category_id text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tenant_category OWNER TO postgres;

--
-- Name: directory_category_stores; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.directory_category_stores AS
 SELECT t.id AS tenant_id,
    t.name AS store_name,
    t.slug AS store_slug,
    bp.latitude,
    bp.longitude,
    bp.city,
    bp.state,
    bp.postal_code AS zip_code,
    bp.address_line1 AS address,
    tc.id AS category_id,
    tc.name AS category_name,
    tc.slug AS category_slug,
    tc.google_category_id,
    count(ii.id) AS product_count,
    max(ii."updatedAt") AS last_product_update,
    t.google_last_sync,
    t.google_sync_enabled,
    t.directory_visible
   FROM (((public."Tenant" t
     JOIN public.tenant_business_profile bp ON ((bp.tenant_id = t.id)))
     JOIN public."InventoryItem" ii ON ((ii."tenantId" = t.id)))
     JOIN public.tenant_category tc ON ((ii.tenant_category_id = tc.id)))
  WHERE ((t.google_sync_enabled = true) AND (t.google_last_sync > (now() - '24:00:00'::interval)) AND (t.directory_visible = true) AND (t.location_status = 'active'::public.location_status) AND (ii."itemStatus" = 'active'::public.item_status) AND (ii.visibility = 'public'::public.item_visibility) AND (tc.is_active = true))
  GROUP BY t.id, t.name, t.slug, bp.latitude, bp.longitude, bp.city, bp.state, bp.postal_code, bp.address_line1, tc.id, tc.name, tc.slug, tc.google_category_id, t.google_last_sync, t.google_sync_enabled, t.directory_visible
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.directory_category_stores OWNER TO postgres;

--
-- Name: MATERIALIZED VIEW directory_category_stores; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON MATERIALIZED VIEW public.directory_category_stores IS 'Pre-computed store-category associations for directory. 
   Only includes verified stores (syncing with Google within 24 hours).
   Refresh every 15 minutes via cron or manually.';


--
-- Name: directory_featured_listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directory_featured_listings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    featured_from timestamp(3) without time zone NOT NULL,
    featured_until timestamp(3) without time zone NOT NULL,
    placement_priority integer DEFAULT 5 NOT NULL,
    created_by text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.directory_featured_listings OWNER TO postgres;

--
-- Name: directory_listings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directory_listings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    business_name text,
    slug text,
    address text,
    city text,
    state text,
    zip_code text,
    phone text,
    email text,
    website text,
    latitude double precision,
    longitude double precision,
    primary_category text,
    secondary_categories text[],
    logo_url text,
    description text,
    rating_avg double precision DEFAULT 0,
    rating_count integer DEFAULT 0,
    product_count integer DEFAULT 0,
    is_featured boolean DEFAULT false,
    subscription_tier text DEFAULT 'trial'::text,
    use_custom_website boolean DEFAULT false,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.directory_listings OWNER TO postgres;

--
-- Name: directory_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directory_settings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    is_published boolean DEFAULT false NOT NULL,
    seo_description text,
    seo_keywords text[],
    primary_category text,
    secondary_categories text[],
    is_featured boolean DEFAULT false NOT NULL,
    featured_until timestamp(3) without time zone,
    slug text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.directory_settings OWNER TO postgres;

--
-- Name: directory_support_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directory_support_notes (
    id text NOT NULL,
    tenant_id text NOT NULL,
    note text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.directory_support_notes OWNER TO postgres;

--
-- Name: email_configuration; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_configuration (
    id text NOT NULL,
    category text NOT NULL,
    email text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "updatedBy" text
);


ALTER TABLE public.email_configuration OWNER TO postgres;

--
-- Name: feed_push_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.feed_push_jobs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    sku text,
    job_status public.job_status DEFAULT 'queued'::public.job_status NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    max_retries integer DEFAULT 5 NOT NULL,
    last_attempt timestamp(3) without time zone,
    next_retry timestamp(3) without time zone,
    error_message text,
    error_code text,
    payload jsonb,
    result jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.feed_push_jobs OWNER TO postgres;

--
-- Name: gbp_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gbp_categories (
    id text NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.gbp_categories OWNER TO postgres;

--
-- Name: gbp_insights_daily; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gbp_insights_daily (
    id text NOT NULL,
    location_id text NOT NULL,
    date date NOT NULL,
    views_search integer DEFAULT 0 NOT NULL,
    views_maps integer DEFAULT 0 NOT NULL,
    actions_website integer DEFAULT 0 NOT NULL,
    actions_phone integer DEFAULT 0 NOT NULL,
    actions_directions integer DEFAULT 0 NOT NULL,
    photos_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.gbp_insights_daily OWNER TO postgres;

--
-- Name: gbp_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gbp_locations (
    id text NOT NULL,
    account_id text NOT NULL,
    location_id text NOT NULL,
    location_name text NOT NULL,
    store_code text,
    address text,
    phone_number text,
    website_url text,
    category text,
    is_verified boolean DEFAULT false,
    is_published boolean DEFAULT false,
    last_fetched_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.gbp_locations OWNER TO postgres;

--
-- Name: google_merchant_links; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.google_merchant_links (
    id text NOT NULL,
    account_id text NOT NULL,
    merchant_id text NOT NULL,
    merchant_name text,
    website_url text,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_at timestamp(3) without time zone,
    sync_status text DEFAULT 'pending'::text,
    sync_error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.google_merchant_links OWNER TO postgres;

--
-- Name: google_oauth_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.google_oauth_accounts (
    id text NOT NULL,
    tenant_id text NOT NULL,
    google_account_id text NOT NULL,
    email text NOT NULL,
    display_name text,
    profile_picture_url text,
    scopes text[] NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.google_oauth_accounts OWNER TO postgres;

--
-- Name: google_oauth_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.google_oauth_tokens (
    id text NOT NULL,
    account_id text NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text NOT NULL,
    token_type text DEFAULT 'Bearer'::text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    scopes text[] NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.google_oauth_tokens OWNER TO postgres;

--
-- Name: google_taxonomy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.google_taxonomy (
    id text NOT NULL,
    category_id text NOT NULL,
    category_path text NOT NULL,
    parent_id text,
    level integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    version text DEFAULT '2024-09'::text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.google_taxonomy OWNER TO postgres;

--
-- Name: location_status_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.location_status_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    old_status public.location_status NOT NULL,
    new_status public.location_status NOT NULL,
    changed_by text NOT NULL,
    reason text,
    reopening_date timestamp(3) without time zone,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.location_status_logs OWNER TO postgres;

--
-- Name: oauth_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.oauth_integrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id text,
    provider text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    scopes text[] DEFAULT '{}'::text[],
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.oauth_integrations OWNER TO postgres;

--
-- Name: organization; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization (
    id text NOT NULL,
    name text NOT NULL,
    "ownerId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "subscriptionTier" text DEFAULT 'chain_starter'::text,
    "subscriptionStatus" text DEFAULT 'trial'::text,
    "trialEndsAt" timestamp(3) without time zone,
    "subscriptionEndsAt" timestamp(3) without time zone,
    "stripeCustomerId" text,
    "stripeSubscriptionId" text,
    "maxLocations" integer DEFAULT 5 NOT NULL,
    "maxTotalSKUs" integer DEFAULT 2500 NOT NULL,
    metadata jsonb
);


ALTER TABLE public.organization OWNER TO postgres;

--
-- Name: TABLE organization; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.organization IS 'Multi-location chains and franchises';


--
-- Name: COLUMN organization."subscriptionTier"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organization."subscriptionTier" IS 'Chain pricing tier: chain_starter, chain_professional, chain_enterprise';


--
-- Name: COLUMN organization."maxLocations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organization."maxLocations" IS 'Maximum number of locations allowed';


--
-- Name: COLUMN organization."maxTotalSKUs"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.organization."maxTotalSKUs" IS 'Shared SKU pool across all locations in the chain';


--
-- Name: organization_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_requests (
    id text NOT NULL,
    tenant_id text NOT NULL,
    organization_id text NOT NULL,
    requested_by text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    request_type text DEFAULT 'join'::text NOT NULL,
    estimated_cost double precision,
    cost_currency text DEFAULT 'USD'::text,
    notes text,
    admin_notes text,
    cost_agreed boolean DEFAULT false NOT NULL,
    cost_agreed_at timestamp(3) without time zone,
    processed_by text,
    processed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.organization_requests OWNER TO postgres;

--
-- Name: outreach_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.outreach_feedback (
    id text NOT NULL,
    tenant_id text,
    user_id text,
    feedback jsonb NOT NULL,
    score integer NOT NULL,
    category text,
    context text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.outreach_feedback OWNER TO postgres;

--
-- Name: permission_audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permission_audit_log (
    id text NOT NULL,
    role text NOT NULL,
    action text NOT NULL,
    old_value boolean,
    new_value boolean NOT NULL,
    changed_by text NOT NULL,
    changed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reason text
);


ALTER TABLE public.permission_audit_log OWNER TO postgres;

--
-- Name: permission_matrix; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permission_matrix (
    id text NOT NULL,
    role text NOT NULL,
    action public.permission_action NOT NULL,
    allowed boolean DEFAULT false NOT NULL,
    description text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.permission_matrix OWNER TO postgres;

--
-- Name: platform_feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_feature_flags (
    id text NOT NULL,
    flag text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    rollout text,
    updated_at timestamp(3) without time zone NOT NULL,
    allow_tenant_override boolean DEFAULT false NOT NULL,
    description text
);


ALTER TABLE public.platform_feature_flags OWNER TO postgres;

--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.platform_settings (
    id integer DEFAULT 1 NOT NULL,
    platform_name text,
    platform_description text,
    logo_url text,
    favicon_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.platform_settings OWNER TO postgres;

--
-- Name: scan_results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scan_results (
    id text NOT NULL,
    tenant_id text NOT NULL,
    session_id text NOT NULL,
    barcode text NOT NULL,
    sku text,
    raw_payload jsonb,
    status text DEFAULT 'new'::text NOT NULL,
    enrichment jsonb,
    validation jsonb,
    duplicate_of text,
    error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.scan_results OWNER TO postgres;

--
-- Name: scan_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scan_sessions (
    id text NOT NULL,
    tenant_id text NOT NULL,
    user_id text,
    template_id text,
    status text DEFAULT 'active'::text NOT NULL,
    device_type text,
    scanned_count integer DEFAULT 0 NOT NULL,
    committed_count integer DEFAULT 0 NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    started_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp(3) without time zone
);


ALTER TABLE public.scan_sessions OWNER TO postgres;

--
-- Name: scan_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.scan_templates (
    id text NOT NULL,
    tenant_id text NOT NULL,
    name text NOT NULL,
    "defaultCategory" text,
    "defaultPriceCents" integer,
    "defaultCurrency" character(3) DEFAULT 'USD'::bpchar NOT NULL,
    "defaultVisibility" text DEFAULT 'private'::text NOT NULL,
    "enrichmentRules" jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.scan_templates OWNER TO postgres;

--
-- Name: sku_billing_policy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sku_billing_policy (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    count_active_private boolean NOT NULL,
    count_preorder boolean NOT NULL,
    count_zero_price boolean NOT NULL,
    require_image boolean NOT NULL,
    require_currency boolean NOT NULL,
    note text,
    updated_by text,
    effective_from timestamp(3) without time zone,
    effective_to timestamp(3) without time zone,
    updated_at timestamp(3) without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sku_billing_policy OWNER TO postgres;

--
-- Name: sku_billing_policy_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sku_billing_policy_history (
    id text NOT NULL,
    scope text DEFAULT 'global'::text NOT NULL,
    effective_from timestamp(3) without time zone NOT NULL,
    effective_to timestamp(3) without time zone,
    count_active_private boolean NOT NULL,
    count_preorder boolean NOT NULL,
    count_zero_price boolean NOT NULL,
    require_image boolean NOT NULL,
    require_currency boolean NOT NULL,
    notes text,
    updated_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.sku_billing_policy_history OWNER TO postgres;

--
-- Name: sku_billing_policy_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sku_billing_policy_overrides (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    tenant_id text NOT NULL,
    count_active_private boolean,
    count_preorder boolean,
    count_zero_price boolean,
    require_image boolean,
    require_currency boolean,
    note text,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.sku_billing_policy_overrides OWNER TO postgres;

--
-- Name: square_integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.square_integrations (
    id text NOT NULL,
    tenant_id text NOT NULL,
    access_token text NOT NULL,
    refresh_token text,
    merchant_id text NOT NULL,
    location_id text,
    token_expires_at timestamp(3) without time zone,
    scopes text[],
    mode text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    last_sync_at timestamp(3) without time zone,
    last_error text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.square_integrations OWNER TO postgres;

--
-- Name: square_product_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.square_product_mappings (
    id text NOT NULL,
    tenant_id text NOT NULL,
    integration_id text NOT NULL,
    inventory_item_id text NOT NULL,
    square_catalog_object_id text NOT NULL,
    square_item_variation_id text,
    sync_status text DEFAULT 'pending'::text NOT NULL,
    last_synced_at timestamp(3) without time zone,
    sync_error text,
    conflict_resolution text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.square_product_mappings OWNER TO postgres;

--
-- Name: square_sync_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.square_sync_logs (
    id text NOT NULL,
    tenant_id text NOT NULL,
    integration_id text NOT NULL,
    mapping_id text,
    sync_type text NOT NULL,
    direction text NOT NULL,
    operation text NOT NULL,
    status text NOT NULL,
    error_message text,
    error_code text,
    request_payload jsonb,
    response_payload jsonb,
    items_affected integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.square_sync_logs OWNER TO postgres;

--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stripe_webhook_events (
    id text NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    processed_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.stripe_webhook_events OWNER TO postgres;

--
-- Name: subscription_tiers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscription_tiers (
    id text NOT NULL,
    tier_key text NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    price_monthly integer NOT NULL,
    max_skus integer,
    max_locations integer,
    tier_type text DEFAULT 'individual'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    created_by text,
    updated_by text
);


ALTER TABLE public.subscription_tiers OWNER TO postgres;

--
-- Name: tenant_feature_flags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_feature_flags (
    id text NOT NULL,
    tenant_id text NOT NULL,
    flag text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    rollout text,
    updated_at timestamp(3) without time zone NOT NULL,
    description text
);


ALTER TABLE public.tenant_feature_flags OWNER TO postgres;

--
-- Name: tenant_feature_overrides; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tenant_feature_overrides (
    id text NOT NULL,
    tenant_id text NOT NULL,
    feature text NOT NULL,
    granted boolean DEFAULT true NOT NULL,
    reason text,
    expires_at timestamp(3) without time zone,
    granted_by text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tenant_feature_overrides OWNER TO postgres;

--
-- Name: tier_change_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tier_change_logs (
    id text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    action text NOT NULL,
    change_type text NOT NULL,
    before_state jsonb,
    after_state jsonb,
    changed_by text NOT NULL,
    changed_by_email text,
    reason text,
    ip_address text,
    user_agent text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.tier_change_logs OWNER TO postgres;

--
-- Name: tier_features; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tier_features (
    id text NOT NULL,
    tier_id text NOT NULL,
    feature_key text NOT NULL,
    feature_name text NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    is_inherited boolean DEFAULT false NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.tier_features OWNER TO postgres;

--
-- Name: upgrade_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.upgrade_requests (
    id text NOT NULL,
    tenant_id text NOT NULL,
    business_name text NOT NULL,
    current_tier text NOT NULL,
    requested_tier text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    notes text,
    admin_notes text,
    processed_by text,
    processed_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.upgrade_requests OWNER TO postgres;

--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    device_info text,
    ip_address text,
    user_agent text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO postgres;

--
-- Name: user_tenants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_tenants (
    id text NOT NULL,
    user_id text NOT NULL,
    tenant_id text NOT NULL,
    role public.user_tenant_role DEFAULT 'MEMBER'::public.user_tenant_role NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.user_tenants OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    first_name text,
    last_name text,
    role public.user_role DEFAULT 'USER'::public.user_role NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    email_verification_token text,
    password_reset_token text,
    password_reset_expires timestamp(3) without time zone,
    last_login timestamp(3) without time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: v_product_performance_trends; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_product_performance_trends AS
 SELECT p."itemId",
    i.sku,
    i.name,
    p."tenantId",
    p."approvalStatus",
    sum(p.impressions) AS impressions_30d,
    sum(p.clicks) AS clicks_30d,
    avg(p.ctr) AS avg_ctr_30d,
    sum(p.conversions) AS conversions_30d,
    sum(p.revenue) AS revenue_30d,
    avg(p."visibilityScore") AS avg_visibility_30d
   FROM (public."ProductPerformance" p
     JOIN public."InventoryItem" i ON ((p."itemId" = i.id)))
  WHERE (p.date >= (CURRENT_DATE - '30 days'::interval))
  GROUP BY p."itemId", i.sku, i.name, p."tenantId", p."approvalStatus";


ALTER VIEW public.v_product_performance_trends OWNER TO postgres;

--
-- Name: v_tenant_performance_summary; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_tenant_performance_summary AS
 SELECT "tenantId",
    date,
    count(DISTINCT "itemId") AS "totalProducts",
    sum(
        CASE
            WHEN ("approvalStatus" = 'approved'::text) THEN 1
            ELSE 0
        END) AS "approvedProducts",
    sum(
        CASE
            WHEN ("approvalStatus" = 'pending'::text) THEN 1
            ELSE 0
        END) AS "pendingProducts",
    sum(
        CASE
            WHEN ("approvalStatus" = 'rejected'::text) THEN 1
            ELSE 0
        END) AS "rejectedProducts",
    sum(impressions) AS "totalImpressions",
    sum(clicks) AS "totalClicks",
        CASE
            WHEN (sum(impressions) > 0) THEN round((((sum(clicks))::numeric / (sum(impressions))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "avgCtr",
    sum(conversions) AS "totalConversions",
    sum(revenue) AS "totalRevenue",
    avg("visibilityScore") AS "avgVisibilityScore"
   FROM public."ProductPerformance" p
  GROUP BY "tenantId", date;


ALTER VIEW public.v_tenant_performance_summary OWNER TO postgres;

--
-- Name: InventoryItem InventoryItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_pkey" PRIMARY KEY (id);


--
-- Name: LocationStatusLog LocationStatusLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LocationStatusLog"
    ADD CONSTRAINT "LocationStatusLog_pkey" PRIMARY KEY (id);


--
-- Name: PhotoAsset PhotoAsset_inventoryItemId_position_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PhotoAsset"
    ADD CONSTRAINT "PhotoAsset_inventoryItemId_position_key" UNIQUE ("inventoryItemId", "position");


--
-- Name: PhotoAsset PhotoAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PhotoAsset"
    ADD CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY (id);


--
-- Name: ProductPerformance ProductPerformance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductPerformance"
    ADD CONSTRAINT "ProductPerformance_pkey" PRIMARY KEY (id);


--
-- Name: SyncJob SyncJob_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncJob"
    ADD CONSTRAINT "SyncJob_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_slug_key" UNIQUE (slug);


--
-- Name: Tenant Tenant_stripeCustomerId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_stripeCustomerId_key" UNIQUE ("stripeCustomerId");


--
-- Name: Tenant Tenant_stripeSubscriptionId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: barcode_enrichment barcode_enrichment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barcode_enrichment
    ADD CONSTRAINT barcode_enrichment_pkey PRIMARY KEY (id);


--
-- Name: barcode_lookup_log barcode_lookup_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barcode_lookup_log
    ADD CONSTRAINT barcode_lookup_log_pkey PRIMARY KEY (id);


--
-- Name: business_hours business_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_pkey PRIMARY KEY (id);


--
-- Name: business_hours_special business_hours_special_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours_special
    ADD CONSTRAINT business_hours_special_pkey PRIMARY KEY (id);


--
-- Name: category_mirror_runs category_mirror_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_mirror_runs
    ADD CONSTRAINT category_mirror_runs_pkey PRIMARY KEY (id);


--
-- Name: clover_demo_snapshots clover_demo_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_demo_snapshots
    ADD CONSTRAINT clover_demo_snapshots_pkey PRIMARY KEY (id);


--
-- Name: clover_integrations clover_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_integrations
    ADD CONSTRAINT clover_integrations_pkey PRIMARY KEY (id);


--
-- Name: clover_item_mappings clover_item_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_item_mappings
    ADD CONSTRAINT clover_item_mappings_pkey PRIMARY KEY (id);


--
-- Name: clover_sync_logs clover_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_sync_logs
    ADD CONSTRAINT clover_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: directory_featured_listings directory_featured_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_featured_listings
    ADD CONSTRAINT directory_featured_listings_pkey PRIMARY KEY (id);


--
-- Name: directory_listings directory_listings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_listings
    ADD CONSTRAINT directory_listings_pkey PRIMARY KEY (id);


--
-- Name: directory_listings directory_listings_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_listings
    ADD CONSTRAINT directory_listings_slug_key UNIQUE (slug);


--
-- Name: directory_settings directory_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_settings
    ADD CONSTRAINT directory_settings_pkey PRIMARY KEY (id);


--
-- Name: directory_support_notes directory_support_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_support_notes
    ADD CONSTRAINT directory_support_notes_pkey PRIMARY KEY (id);


--
-- Name: email_configuration email_configuration_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_configuration
    ADD CONSTRAINT email_configuration_pkey PRIMARY KEY (id);


--
-- Name: feed_push_jobs feed_push_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.feed_push_jobs
    ADD CONSTRAINT feed_push_jobs_pkey PRIMARY KEY (id);


--
-- Name: gbp_categories gbp_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gbp_categories
    ADD CONSTRAINT gbp_categories_pkey PRIMARY KEY (id);


--
-- Name: gbp_insights_daily gbp_insights_daily_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gbp_insights_daily
    ADD CONSTRAINT gbp_insights_daily_pkey PRIMARY KEY (id);


--
-- Name: gbp_locations gbp_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gbp_locations
    ADD CONSTRAINT gbp_locations_pkey PRIMARY KEY (id);


--
-- Name: google_merchant_links google_merchant_links_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_merchant_links
    ADD CONSTRAINT google_merchant_links_pkey PRIMARY KEY (id);


--
-- Name: google_oauth_accounts google_oauth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_oauth_accounts
    ADD CONSTRAINT google_oauth_accounts_pkey PRIMARY KEY (id);


--
-- Name: google_oauth_tokens google_oauth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_oauth_tokens
    ADD CONSTRAINT google_oauth_tokens_pkey PRIMARY KEY (id);


--
-- Name: google_taxonomy google_taxonomy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_taxonomy
    ADD CONSTRAINT google_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: location_status_logs location_status_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_status_logs
    ADD CONSTRAINT location_status_logs_pkey PRIMARY KEY (id);


--
-- Name: oauth_integrations oauth_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_integrations
    ADD CONSTRAINT oauth_integrations_pkey PRIMARY KEY (id);


--
-- Name: organization organization_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT organization_pkey PRIMARY KEY (id);


--
-- Name: organization_requests organization_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_pkey PRIMARY KEY (id);


--
-- Name: organization organization_stripeCustomerId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT "organization_stripeCustomerId_key" UNIQUE ("stripeCustomerId");


--
-- Name: organization organization_stripeSubscriptionId_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization
    ADD CONSTRAINT "organization_stripeSubscriptionId_key" UNIQUE ("stripeSubscriptionId");


--
-- Name: outreach_feedback outreach_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.outreach_feedback
    ADD CONSTRAINT outreach_feedback_pkey PRIMARY KEY (id);


--
-- Name: permission_audit_log permission_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_audit_log
    ADD CONSTRAINT permission_audit_log_pkey PRIMARY KEY (id);


--
-- Name: permission_matrix permission_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permission_matrix
    ADD CONSTRAINT permission_matrix_pkey PRIMARY KEY (id);


--
-- Name: platform_feature_flags platform_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_feature_flags
    ADD CONSTRAINT platform_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: scan_results scan_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_pkey PRIMARY KEY (id);


--
-- Name: scan_sessions scan_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_sessions
    ADD CONSTRAINT scan_sessions_pkey PRIMARY KEY (id);


--
-- Name: scan_templates scan_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_templates
    ADD CONSTRAINT scan_templates_pkey PRIMARY KEY (id);


--
-- Name: sku_billing_policy_history sku_billing_policy_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_billing_policy_history
    ADD CONSTRAINT sku_billing_policy_history_pkey PRIMARY KEY (id);


--
-- Name: sku_billing_policy_overrides sku_billing_policy_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_billing_policy_overrides
    ADD CONSTRAINT sku_billing_policy_overrides_pkey PRIMARY KEY (id);


--
-- Name: sku_billing_policy_overrides sku_billing_policy_overrides_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_billing_policy_overrides
    ADD CONSTRAINT sku_billing_policy_overrides_tenant_id_key UNIQUE (tenant_id);


--
-- Name: sku_billing_policy sku_billing_policy_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_billing_policy
    ADD CONSTRAINT sku_billing_policy_pkey PRIMARY KEY (id);


--
-- Name: square_integrations square_integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.square_integrations
    ADD CONSTRAINT square_integrations_pkey PRIMARY KEY (id);


--
-- Name: square_product_mappings square_product_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.square_product_mappings
    ADD CONSTRAINT square_product_mappings_pkey PRIMARY KEY (id);


--
-- Name: square_sync_logs square_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.square_sync_logs
    ADD CONSTRAINT square_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: subscription_tiers subscription_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscription_tiers
    ADD CONSTRAINT subscription_tiers_pkey PRIMARY KEY (id);


--
-- Name: tenant_business_profile tenant_business_profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_business_profile
    ADD CONSTRAINT tenant_business_profile_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenant_category tenant_category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_category
    ADD CONSTRAINT tenant_category_pkey PRIMARY KEY (id);


--
-- Name: tenant_feature_flags tenant_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_feature_flags
    ADD CONSTRAINT tenant_feature_flags_pkey PRIMARY KEY (id);


--
-- Name: tenant_feature_overrides tenant_feature_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_feature_overrides
    ADD CONSTRAINT tenant_feature_overrides_pkey PRIMARY KEY (id);


--
-- Name: tier_change_logs tier_change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_change_logs
    ADD CONSTRAINT tier_change_logs_pkey PRIMARY KEY (id);


--
-- Name: tier_features tier_features_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_features
    ADD CONSTRAINT tier_features_pkey PRIMARY KEY (id);


--
-- Name: upgrade_requests upgrade_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.upgrade_requests
    ADD CONSTRAINT upgrade_requests_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_tenants user_tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: InventoryItem_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InventoryItem_source_idx" ON public."InventoryItem" USING btree (source);


--
-- Name: InventoryItem_tenantId_enrichmentStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InventoryItem_tenantId_enrichmentStatus_idx" ON public."InventoryItem" USING btree ("tenantId", "enrichmentStatus");


--
-- Name: InventoryItem_tenantId_sku_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON public."InventoryItem" USING btree ("tenantId", sku);


--
-- Name: InventoryItem_tenantId_updatedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InventoryItem_tenantId_updatedAt_idx" ON public."InventoryItem" USING btree ("tenantId", "updatedAt");


--
-- Name: InventoryItem_tenant_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "InventoryItem_tenant_category_id_idx" ON public."InventoryItem" USING btree (tenant_category_id);


--
-- Name: LocationStatusLog_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LocationStatusLog_createdAt_idx" ON public."LocationStatusLog" USING btree ("createdAt");


--
-- Name: LocationStatusLog_tenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LocationStatusLog_tenantId_idx" ON public."LocationStatusLog" USING btree ("tenantId");


--
-- Name: PhotoAsset_capturedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PhotoAsset_capturedAt_idx" ON public."PhotoAsset" USING btree ("capturedAt");


--
-- Name: PhotoAsset_inventoryItemId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PhotoAsset_inventoryItemId_idx" ON public."PhotoAsset" USING btree ("inventoryItemId");


--
-- Name: PhotoAsset_inventoryItemId_position_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PhotoAsset_inventoryItemId_position_idx" ON public."PhotoAsset" USING btree ("inventoryItemId", "position");


--
-- Name: PhotoAsset_tenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PhotoAsset_tenantId_idx" ON public."PhotoAsset" USING btree ("tenantId");


--
-- Name: ProductPerformance_approvalStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductPerformance_approvalStatus_idx" ON public."ProductPerformance" USING btree ("approvalStatus");


--
-- Name: ProductPerformance_itemId_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ProductPerformance_itemId_date_key" ON public."ProductPerformance" USING btree ("itemId", date);


--
-- Name: ProductPerformance_tenantId_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ProductPerformance_tenantId_date_idx" ON public."ProductPerformance" USING btree ("tenantId", date DESC);


--
-- Name: SyncJob_tenantId_status_updatedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SyncJob_tenantId_status_updatedAt_idx" ON public."SyncJob" USING btree ("tenantId", status, "updatedAt");


--
-- Name: Tenant_created_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_created_by_idx" ON public."Tenant" USING btree (created_by);


--
-- Name: Tenant_directory_visible_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_directory_visible_idx" ON public."Tenant" USING btree (directory_visible);


--
-- Name: Tenant_google_sync_enabled_google_last_sync_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_google_sync_enabled_google_last_sync_idx" ON public."Tenant" USING btree (google_sync_enabled, google_last_sync);


--
-- Name: Tenant_locationStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_locationStatus_idx" ON public."Tenant" USING btree ("locationStatus");


--
-- Name: Tenant_location_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_location_status_idx" ON public."Tenant" USING btree (location_status);


--
-- Name: Tenant_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_name_idx" ON public."Tenant" USING btree (name);


--
-- Name: Tenant_organizationId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_organizationId_idx" ON public."Tenant" USING btree ("organizationId");


--
-- Name: Tenant_serviceLevel_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_serviceLevel_idx" ON public."Tenant" USING btree ("serviceLevel");


--
-- Name: Tenant_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_slug_idx" ON public."Tenant" USING btree (slug);


--
-- Name: Tenant_subscriptionStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Tenant_subscriptionStatus_idx" ON public."Tenant" USING btree ("subscriptionStatus");


--
-- Name: audit_log_actor_type_actor_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_actor_type_actor_id_idx ON public.audit_log USING btree (actor_type, actor_id);


--
-- Name: audit_log_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_entity_type_entity_id_idx ON public.audit_log USING btree (entity_type, entity_id);


--
-- Name: audit_log_request_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_request_id_idx ON public.audit_log USING btree (request_id);


--
-- Name: audit_log_tenant_id_occurred_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_log_tenant_id_occurred_at_idx ON public.audit_log USING btree (tenant_id, occurred_at DESC);


--
-- Name: barcode_enrichment_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode_enrichment_barcode_idx ON public.barcode_enrichment USING btree (barcode);


--
-- Name: barcode_enrichment_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX barcode_enrichment_barcode_key ON public.barcode_enrichment USING btree (barcode);


--
-- Name: barcode_enrichment_last_fetched_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode_enrichment_last_fetched_at_idx ON public.barcode_enrichment USING btree (last_fetched_at);


--
-- Name: barcode_enrichment_source_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode_enrichment_source_idx ON public.barcode_enrichment USING btree (source);


--
-- Name: barcode_lookup_log_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode_lookup_log_barcode_idx ON public.barcode_lookup_log USING btree (barcode);


--
-- Name: barcode_lookup_log_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode_lookup_log_tenant_id_created_at_idx ON public.barcode_lookup_log USING btree (tenant_id, created_at);


--
-- Name: business_hours_special_tenant_id_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_hours_special_tenant_id_date_idx ON public.business_hours_special USING btree (tenant_id, date);


--
-- Name: business_hours_special_tenant_id_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX business_hours_special_tenant_id_date_key ON public.business_hours_special USING btree (tenant_id, date);


--
-- Name: business_hours_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX business_hours_tenant_id_idx ON public.business_hours USING btree (tenant_id);


--
-- Name: business_hours_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX business_hours_tenant_id_key ON public.business_hours USING btree (tenant_id);


--
-- Name: category_mirror_runs_tenant_id_strategy_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX category_mirror_runs_tenant_id_strategy_started_at_idx ON public.category_mirror_runs USING btree (tenant_id, strategy, started_at DESC);


--
-- Name: clover_demo_snapshots_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_demo_snapshots_expires_at_idx ON public.clover_demo_snapshots USING btree (expires_at);


--
-- Name: clover_demo_snapshots_integration_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_demo_snapshots_integration_id_idx ON public.clover_demo_snapshots USING btree (integration_id);


--
-- Name: clover_integrations_mode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_integrations_mode_idx ON public.clover_integrations USING btree (mode);


--
-- Name: clover_integrations_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_integrations_status_idx ON public.clover_integrations USING btree (status);


--
-- Name: clover_integrations_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_integrations_tenant_id_idx ON public.clover_integrations USING btree (tenant_id);


--
-- Name: clover_integrations_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clover_integrations_tenant_id_key ON public.clover_integrations USING btree (tenant_id);


--
-- Name: clover_item_mappings_integration_id_clover_item_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clover_item_mappings_integration_id_clover_item_id_key ON public.clover_item_mappings USING btree (integration_id, clover_item_id);


--
-- Name: clover_item_mappings_integration_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_item_mappings_integration_id_idx ON public.clover_item_mappings USING btree (integration_id);


--
-- Name: clover_item_mappings_mapping_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_item_mappings_mapping_status_idx ON public.clover_item_mappings USING btree (mapping_status);


--
-- Name: clover_item_mappings_rvp_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_item_mappings_rvp_item_id_idx ON public.clover_item_mappings USING btree (rvp_item_id);


--
-- Name: clover_sync_logs_integration_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_sync_logs_integration_id_idx ON public.clover_sync_logs USING btree (integration_id);


--
-- Name: clover_sync_logs_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_sync_logs_started_at_idx ON public.clover_sync_logs USING btree (started_at);


--
-- Name: clover_sync_logs_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_sync_logs_status_idx ON public.clover_sync_logs USING btree (status);


--
-- Name: clover_sync_logs_trace_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX clover_sync_logs_trace_id_idx ON public.clover_sync_logs USING btree (trace_id);


--
-- Name: clover_sync_logs_trace_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX clover_sync_logs_trace_id_key ON public.clover_sync_logs USING btree (trace_id);


--
-- Name: directory_featured_listings_placement_priority_featured_fro_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_featured_listings_placement_priority_featured_fro_idx ON public.directory_featured_listings USING btree (placement_priority, featured_from DESC);


--
-- Name: directory_featured_listings_tenant_id_featured_until_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_featured_listings_tenant_id_featured_until_idx ON public.directory_featured_listings USING btree (tenant_id, featured_until);


--
-- Name: directory_settings_is_featured_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_settings_is_featured_idx ON public.directory_settings USING btree (is_featured);


--
-- Name: directory_settings_is_published_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_settings_is_published_idx ON public.directory_settings USING btree (is_published);


--
-- Name: directory_settings_slug_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_settings_slug_idx ON public.directory_settings USING btree (slug);


--
-- Name: directory_settings_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX directory_settings_slug_key ON public.directory_settings USING btree (slug);


--
-- Name: directory_settings_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX directory_settings_tenant_id_key ON public.directory_settings USING btree (tenant_id);


--
-- Name: directory_support_notes_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX directory_support_notes_tenant_id_created_at_idx ON public.directory_support_notes USING btree (tenant_id, created_at DESC);


--
-- Name: email_configuration_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX email_configuration_category_idx ON public.email_configuration USING btree (category);


--
-- Name: email_configuration_category_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX email_configuration_category_key ON public.email_configuration USING btree (category);


--
-- Name: feed_push_jobs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feed_push_jobs_created_at_idx ON public.feed_push_jobs USING btree (created_at);


--
-- Name: feed_push_jobs_job_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feed_push_jobs_job_status_idx ON public.feed_push_jobs USING btree (job_status);


--
-- Name: feed_push_jobs_next_retry_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feed_push_jobs_next_retry_idx ON public.feed_push_jobs USING btree (next_retry);


--
-- Name: feed_push_jobs_tenant_id_job_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feed_push_jobs_tenant_id_job_status_idx ON public.feed_push_jobs USING btree (tenant_id, job_status);


--
-- Name: feed_push_jobs_tenant_id_sku_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX feed_push_jobs_tenant_id_sku_idx ON public.feed_push_jobs USING btree (tenant_id, sku);


--
-- Name: gbp_categories_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gbp_categories_is_active_idx ON public.gbp_categories USING btree (is_active);


--
-- Name: gbp_categories_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX gbp_categories_name_key ON public.gbp_categories USING btree (name);


--
-- Name: gbp_insights_daily_location_id_date_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX gbp_insights_daily_location_id_date_idx ON public.gbp_insights_daily USING btree (location_id, date);


--
-- Name: gbp_insights_daily_location_id_date_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX gbp_insights_daily_location_id_date_key ON public.gbp_insights_daily USING btree (location_id, date);


--
-- Name: gbp_locations_account_id_location_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX gbp_locations_account_id_location_id_key ON public.gbp_locations USING btree (account_id, location_id);


--
-- Name: google_merchant_links_account_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX google_merchant_links_account_id_idx ON public.google_merchant_links USING btree (account_id);


--
-- Name: google_merchant_links_merchant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX google_merchant_links_merchant_id_idx ON public.google_merchant_links USING btree (merchant_id);


--
-- Name: google_oauth_accounts_tenant_id_google_account_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX google_oauth_accounts_tenant_id_google_account_id_key ON public.google_oauth_accounts USING btree (tenant_id, google_account_id);


--
-- Name: google_oauth_tokens_account_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX google_oauth_tokens_account_id_key ON public.google_oauth_tokens USING btree (account_id);


--
-- Name: google_taxonomy_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX google_taxonomy_category_id_idx ON public.google_taxonomy USING btree (category_id);


--
-- Name: google_taxonomy_category_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX google_taxonomy_category_id_key ON public.google_taxonomy USING btree (category_id);


--
-- Name: google_taxonomy_parent_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX google_taxonomy_parent_id_idx ON public.google_taxonomy USING btree (parent_id);


--
-- Name: google_taxonomy_version_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX google_taxonomy_version_is_active_idx ON public.google_taxonomy USING btree (version, is_active);


--
-- Name: idx_directory_category_stores_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_category_stores_category ON public.directory_category_stores USING btree (category_id);


--
-- Name: idx_directory_category_stores_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_category_stores_location ON public.directory_category_stores USING btree (latitude, longitude) WHERE ((latitude IS NOT NULL) AND (longitude IS NOT NULL));


--
-- Name: idx_directory_category_stores_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_category_stores_slug ON public.directory_category_stores USING btree (category_slug);


--
-- Name: idx_directory_category_stores_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_category_stores_tenant ON public.directory_category_stores USING btree (tenant_id);


--
-- Name: idx_directory_category_stores_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_directory_category_stores_unique ON public.directory_category_stores USING btree (tenant_id, category_id);


--
-- Name: idx_directory_listings_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_city ON public.directory_listings USING btree (city);


--
-- Name: idx_directory_listings_is_featured; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_is_featured ON public.directory_listings USING btree (is_featured);


--
-- Name: idx_directory_listings_is_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_is_published ON public.directory_listings USING btree (is_published);


--
-- Name: idx_directory_listings_primary_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_primary_category ON public.directory_listings USING btree (primary_category);


--
-- Name: idx_directory_listings_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_slug ON public.directory_listings USING btree (slug);


--
-- Name: idx_directory_listings_state; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_state ON public.directory_listings USING btree (state);


--
-- Name: idx_directory_listings_tenant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_directory_listings_tenant_id ON public.directory_listings USING btree (tenant_id);


--
-- Name: idx_oauth_integrations_provider; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_oauth_integrations_provider ON public.oauth_integrations USING btree (provider, is_active);


--
-- Name: idx_oauth_integrations_tenant; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_oauth_integrations_tenant ON public.oauth_integrations USING btree (tenant_id) WHERE (tenant_id IS NOT NULL);


--
-- Name: idx_tenant_business_profile_gbp_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_business_profile_gbp_sync_status ON public.tenant_business_profile USING btree (gbp_category_sync_status) WHERE (gbp_category_sync_status IS NOT NULL);


--
-- Name: idx_tenant_directory_visible; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_directory_visible ON public."Tenant" USING btree (directory_visible);


--
-- Name: idx_tenant_google_sync; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_google_sync ON public."Tenant" USING btree (google_sync_enabled, google_last_sync);


--
-- Name: idx_tenant_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tenant_slug ON public."Tenant" USING btree (slug);


--
-- Name: location_status_logs_changed_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX location_status_logs_changed_by_idx ON public.location_status_logs USING btree (changed_by);


--
-- Name: location_status_logs_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX location_status_logs_tenant_id_created_at_idx ON public.location_status_logs USING btree (tenant_id, created_at);


--
-- Name: organization_ownerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "organization_ownerId_idx" ON public.organization USING btree ("ownerId");


--
-- Name: organization_requests_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_requests_created_at_idx ON public.organization_requests USING btree (created_at);


--
-- Name: organization_requests_organization_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_requests_organization_id_idx ON public.organization_requests USING btree (organization_id);


--
-- Name: organization_requests_requested_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_requests_requested_by_idx ON public.organization_requests USING btree (requested_by);


--
-- Name: organization_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_requests_status_idx ON public.organization_requests USING btree (status);


--
-- Name: organization_requests_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX organization_requests_tenant_id_idx ON public.organization_requests USING btree (tenant_id);


--
-- Name: organization_subscriptionStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "organization_subscriptionStatus_idx" ON public.organization USING btree ("subscriptionStatus");


--
-- Name: outreach_feedback_category_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX outreach_feedback_category_idx ON public.outreach_feedback USING btree (category);


--
-- Name: outreach_feedback_context_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX outreach_feedback_context_idx ON public.outreach_feedback USING btree (context);


--
-- Name: outreach_feedback_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX outreach_feedback_created_at_idx ON public.outreach_feedback USING btree (created_at);


--
-- Name: outreach_feedback_score_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX outreach_feedback_score_idx ON public.outreach_feedback USING btree (score);


--
-- Name: outreach_feedback_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX outreach_feedback_tenant_id_created_at_idx ON public.outreach_feedback USING btree (tenant_id, created_at);


--
-- Name: permission_audit_log_changed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permission_audit_log_changed_at_idx ON public.permission_audit_log USING btree (changed_at);


--
-- Name: permission_audit_log_changed_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permission_audit_log_changed_by_idx ON public.permission_audit_log USING btree (changed_by);


--
-- Name: permission_audit_log_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permission_audit_log_role_idx ON public.permission_audit_log USING btree (role);


--
-- Name: permission_matrix_action_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permission_matrix_action_idx ON public.permission_matrix USING btree (action);


--
-- Name: permission_matrix_role_action_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permission_matrix_role_action_key ON public.permission_matrix USING btree (role, action);


--
-- Name: permission_matrix_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX permission_matrix_role_idx ON public.permission_matrix USING btree (role);


--
-- Name: platform_feature_flags_flag_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX platform_feature_flags_flag_key ON public.platform_feature_flags USING btree (flag);


--
-- Name: scan_results_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_results_barcode_idx ON public.scan_results USING btree (barcode);


--
-- Name: scan_results_session_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_results_session_id_idx ON public.scan_results USING btree (session_id);


--
-- Name: scan_results_tenant_id_session_id_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX scan_results_tenant_id_session_id_barcode_key ON public.scan_results USING btree (tenant_id, session_id, barcode);


--
-- Name: scan_results_tenant_id_status_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_results_tenant_id_status_created_at_idx ON public.scan_results USING btree (tenant_id, status, created_at);


--
-- Name: scan_sessions_started_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_sessions_started_at_idx ON public.scan_sessions USING btree (started_at);


--
-- Name: scan_sessions_tenant_id_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_sessions_tenant_id_status_idx ON public.scan_sessions USING btree (tenant_id, status);


--
-- Name: scan_templates_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX scan_templates_tenant_id_idx ON public.scan_templates USING btree (tenant_id);


--
-- Name: scan_templates_tenant_id_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX scan_templates_tenant_id_name_key ON public.scan_templates USING btree (tenant_id, name);


--
-- Name: sku_billing_policy_history_scope_effective_from_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX sku_billing_policy_history_scope_effective_from_idx ON public.sku_billing_policy_history USING btree (scope, effective_from DESC);


--
-- Name: square_integrations_enabled_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_integrations_enabled_idx ON public.square_integrations USING btree (enabled);


--
-- Name: square_integrations_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_integrations_tenant_id_idx ON public.square_integrations USING btree (tenant_id);


--
-- Name: square_integrations_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX square_integrations_tenant_id_key ON public.square_integrations USING btree (tenant_id);


--
-- Name: square_product_mappings_integration_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_product_mappings_integration_id_idx ON public.square_product_mappings USING btree (integration_id);


--
-- Name: square_product_mappings_inventory_item_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_product_mappings_inventory_item_id_idx ON public.square_product_mappings USING btree (inventory_item_id);


--
-- Name: square_product_mappings_sync_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_product_mappings_sync_status_idx ON public.square_product_mappings USING btree (sync_status);


--
-- Name: square_product_mappings_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_product_mappings_tenant_id_idx ON public.square_product_mappings USING btree (tenant_id);


--
-- Name: square_product_mappings_tenant_id_inventory_item_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX square_product_mappings_tenant_id_inventory_item_id_key ON public.square_product_mappings USING btree (tenant_id, inventory_item_id);


--
-- Name: square_sync_logs_integration_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_sync_logs_integration_id_created_at_idx ON public.square_sync_logs USING btree (integration_id, created_at DESC);


--
-- Name: square_sync_logs_status_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_sync_logs_status_created_at_idx ON public.square_sync_logs USING btree (status, created_at DESC);


--
-- Name: square_sync_logs_tenant_id_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX square_sync_logs_tenant_id_created_at_idx ON public.square_sync_logs USING btree (tenant_id, created_at DESC);


--
-- Name: stripe_webhook_events_event_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stripe_webhook_events_event_id_idx ON public.stripe_webhook_events USING btree (event_id);


--
-- Name: stripe_webhook_events_event_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX stripe_webhook_events_event_id_key ON public.stripe_webhook_events USING btree (event_id);


--
-- Name: stripe_webhook_events_event_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stripe_webhook_events_event_type_idx ON public.stripe_webhook_events USING btree (event_type);


--
-- Name: stripe_webhook_events_processed_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX stripe_webhook_events_processed_at_idx ON public.stripe_webhook_events USING btree (processed_at);


--
-- Name: subscription_tiers_is_active_sort_order_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscription_tiers_is_active_sort_order_idx ON public.subscription_tiers USING btree (is_active, sort_order);


--
-- Name: subscription_tiers_tier_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscription_tiers_tier_key_idx ON public.subscription_tiers USING btree (tier_key);


--
-- Name: subscription_tiers_tier_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX subscription_tiers_tier_key_key ON public.subscription_tiers USING btree (tier_key);


--
-- Name: subscription_tiers_tier_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX subscription_tiers_tier_type_idx ON public.subscription_tiers USING btree (tier_type);


--
-- Name: tenant_business_profile_gbp_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_business_profile_gbp_category_id_idx ON public.tenant_business_profile USING btree (gbp_category_id);


--
-- Name: tenant_business_profile_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenant_business_profile_tenant_id_key ON public.tenant_business_profile USING btree (tenant_id);


--
-- Name: tenant_category_google_category_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_category_google_category_id_idx ON public.tenant_category USING btree (google_category_id);


--
-- Name: tenant_category_parent_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_category_parent_id_idx ON public.tenant_category USING btree (parent_id);


--
-- Name: tenant_category_tenant_id_is_active_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_category_tenant_id_is_active_idx ON public.tenant_category USING btree (tenant_id, is_active);


--
-- Name: tenant_category_tenant_id_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenant_category_tenant_id_slug_key ON public.tenant_category USING btree (tenant_id, slug);


--
-- Name: tenant_feature_flags_tenant_id_flag_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenant_feature_flags_tenant_id_flag_key ON public.tenant_feature_flags USING btree (tenant_id, flag);


--
-- Name: tenant_feature_flags_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_feature_flags_tenant_id_idx ON public.tenant_feature_flags USING btree (tenant_id);


--
-- Name: tenant_feature_overrides_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_feature_overrides_expires_at_idx ON public.tenant_feature_overrides USING btree (expires_at);


--
-- Name: tenant_feature_overrides_feature_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_feature_overrides_feature_idx ON public.tenant_feature_overrides USING btree (feature);


--
-- Name: tenant_feature_overrides_tenant_id_feature_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tenant_feature_overrides_tenant_id_feature_key ON public.tenant_feature_overrides USING btree (tenant_id, feature);


--
-- Name: tenant_feature_overrides_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tenant_feature_overrides_tenant_id_idx ON public.tenant_feature_overrides USING btree (tenant_id);


--
-- Name: tier_change_logs_changed_by_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tier_change_logs_changed_by_idx ON public.tier_change_logs USING btree (changed_by);


--
-- Name: tier_change_logs_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tier_change_logs_created_at_idx ON public.tier_change_logs USING btree (created_at);


--
-- Name: tier_change_logs_entity_type_entity_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tier_change_logs_entity_type_entity_id_idx ON public.tier_change_logs USING btree (entity_type, entity_id);


--
-- Name: tier_features_feature_key_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tier_features_feature_key_idx ON public.tier_features USING btree (feature_key);


--
-- Name: tier_features_tier_id_feature_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX tier_features_tier_id_feature_key_key ON public.tier_features USING btree (tier_id, feature_key);


--
-- Name: tier_features_tier_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX tier_features_tier_id_idx ON public.tier_features USING btree (tier_id);


--
-- Name: upgrade_requests_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX upgrade_requests_created_at_idx ON public.upgrade_requests USING btree (created_at);


--
-- Name: upgrade_requests_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX upgrade_requests_status_idx ON public.upgrade_requests USING btree (status);


--
-- Name: upgrade_requests_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX upgrade_requests_tenant_id_idx ON public.upgrade_requests USING btree (tenant_id);


--
-- Name: user_sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_sessions_expires_at_idx ON public.user_sessions USING btree (expires_at);


--
-- Name: user_sessions_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_sessions_user_id_idx ON public.user_sessions USING btree (user_id);


--
-- Name: user_tenants_tenant_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_tenants_tenant_id_idx ON public.user_tenants USING btree (tenant_id);


--
-- Name: user_tenants_user_id_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX user_tenants_user_id_idx ON public.user_tenants USING btree (user_id);


--
-- Name: user_tenants_user_id_tenant_id_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_tenants_user_id_tenant_id_key ON public.user_tenants USING btree (user_id, tenant_id);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_email_idx ON public.users USING btree (email);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_role_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_role_idx ON public.users USING btree (role);


--
-- Name: InventoryItem InventoryItem_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: InventoryItem InventoryItem_tenant_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."InventoryItem"
    ADD CONSTRAINT "InventoryItem_tenant_category_id_fkey" FOREIGN KEY (tenant_category_id) REFERENCES public.tenant_category(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LocationStatusLog LocationStatusLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LocationStatusLog"
    ADD CONSTRAINT "LocationStatusLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PhotoAsset PhotoAsset_inventoryItemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PhotoAsset"
    ADD CONSTRAINT "PhotoAsset_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES public."InventoryItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PhotoAsset PhotoAsset_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PhotoAsset"
    ADD CONSTRAINT "PhotoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductPerformance ProductPerformance_itemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductPerformance"
    ADD CONSTRAINT "ProductPerformance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES public."InventoryItem"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ProductPerformance ProductPerformance_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ProductPerformance"
    ADD CONSTRAINT "ProductPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SyncJob SyncJob_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SyncJob"
    ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Tenant Tenant_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: barcode_lookup_log barcode_lookup_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.barcode_lookup_log
    ADD CONSTRAINT barcode_lookup_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: business_hours_special business_hours_special_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours_special
    ADD CONSTRAINT business_hours_special_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: business_hours business_hours_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_hours
    ADD CONSTRAINT business_hours_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: category_mirror_runs category_mirror_runs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.category_mirror_runs
    ADD CONSTRAINT category_mirror_runs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clover_demo_snapshots clover_demo_snapshots_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_demo_snapshots
    ADD CONSTRAINT clover_demo_snapshots_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.clover_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clover_integrations clover_integrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_integrations
    ADD CONSTRAINT clover_integrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clover_item_mappings clover_item_mappings_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_item_mappings
    ADD CONSTRAINT clover_item_mappings_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.clover_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: clover_sync_logs clover_sync_logs_integration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clover_sync_logs
    ADD CONSTRAINT clover_sync_logs_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES public.clover_integrations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: directory_featured_listings directory_featured_listings_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_featured_listings
    ADD CONSTRAINT directory_featured_listings_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: directory_featured_listings directory_featured_listings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_featured_listings
    ADD CONSTRAINT directory_featured_listings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: directory_settings directory_settings_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_settings
    ADD CONSTRAINT directory_settings_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: directory_support_notes directory_support_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_support_notes
    ADD CONSTRAINT directory_support_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: directory_support_notes directory_support_notes_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directory_support_notes
    ADD CONSTRAINT directory_support_notes_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: gbp_insights_daily gbp_insights_daily_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gbp_insights_daily
    ADD CONSTRAINT gbp_insights_daily_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.gbp_locations(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: gbp_locations gbp_locations_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gbp_locations
    ADD CONSTRAINT gbp_locations_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.google_oauth_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: google_merchant_links google_merchant_links_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_merchant_links
    ADD CONSTRAINT google_merchant_links_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.google_oauth_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: google_oauth_accounts google_oauth_accounts_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_oauth_accounts
    ADD CONSTRAINT google_oauth_accounts_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: google_oauth_tokens google_oauth_tokens_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.google_oauth_tokens
    ADD CONSTRAINT google_oauth_tokens_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.google_oauth_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: location_status_logs location_status_logs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.location_status_logs
    ADD CONSTRAINT location_status_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: oauth_integrations oauth_integrations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.oauth_integrations
    ADD CONSTRAINT oauth_integrations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE;


--
-- Name: organization_requests organization_requests_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organization(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_requests organization_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_requests
    ADD CONSTRAINT organization_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scan_results scan_results_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.scan_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scan_results scan_results_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_results
    ADD CONSTRAINT scan_results_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scan_sessions scan_sessions_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_sessions
    ADD CONSTRAINT scan_sessions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.scan_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: scan_sessions scan_sessions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_sessions
    ADD CONSTRAINT scan_sessions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: scan_sessions scan_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_sessions
    ADD CONSTRAINT scan_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: scan_templates scan_templates_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.scan_templates
    ADD CONSTRAINT scan_templates_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sku_billing_policy_overrides sku_billing_policy_overrides_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sku_billing_policy_overrides
    ADD CONSTRAINT sku_billing_policy_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE;


--
-- Name: tenant_business_profile tenant_business_profile_gbp_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_business_profile
    ADD CONSTRAINT tenant_business_profile_gbp_category_id_fkey FOREIGN KEY (gbp_category_id) REFERENCES public.gbp_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: tenant_business_profile tenant_business_profile_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_business_profile
    ADD CONSTRAINT tenant_business_profile_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_feature_flags tenant_feature_flags_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_feature_flags
    ADD CONSTRAINT tenant_feature_flags_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_feature_overrides tenant_feature_overrides_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tenant_feature_overrides
    ADD CONSTRAINT tenant_feature_overrides_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tier_features tier_features_tier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tier_features
    ADD CONSTRAINT tier_features_tier_id_fkey FOREIGN KEY (tier_id) REFERENCES public.subscription_tiers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_tenants user_tenants_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_tenants user_tenants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_tenants
    ADD CONSTRAINT user_tenants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: tenant_business_profile Public can view business profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view business profiles" ON public.tenant_business_profile FOR SELECT TO authenticated, anon USING (true);


--
-- Name: tenant_category Public can view categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view categories" ON public.tenant_category FOR SELECT TO authenticated, anon USING (true);


--
-- Name: directory_settings Public can view directory settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view directory settings" ON public.directory_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: platform_settings Public can view platform settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view platform settings" ON public.platform_settings FOR SELECT TO authenticated, anon USING (true);


--
-- Name: directory_listings Public can view published directory listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view published directory listings" ON public.directory_listings FOR SELECT TO authenticated, anon USING ((is_published = true));


--
-- Name: directory_listings Service role has full access to directory_listings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to directory_listings" ON public.directory_listings TO service_role USING (true) WITH CHECK (true);


--
-- Name: directory_settings Service role has full access to directory_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to directory_settings" ON public.directory_settings TO service_role USING (true) WITH CHECK (true);


--
-- Name: organization Service role has full access to organization; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to organization" ON public.organization TO service_role USING (true) WITH CHECK (true);


--
-- Name: platform_settings Service role has full access to platform_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to platform_settings" ON public.platform_settings TO service_role USING (true) WITH CHECK (true);


--
-- Name: tenant_business_profile Service role has full access to tenant_business_profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to tenant_business_profile" ON public.tenant_business_profile TO service_role USING (true) WITH CHECK (true);


--
-- Name: tenant_category Service role has full access to tenant_category; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to tenant_category" ON public.tenant_category TO service_role USING (true) WITH CHECK (true);


--
-- Name: user_tenants Service role has full access to user_tenants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to user_tenants" ON public.user_tenants TO service_role USING (true) WITH CHECK (true);


--
-- Name: users Service role has full access to users; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service role has full access to users" ON public.users TO service_role USING (true) WITH CHECK (true);


--
-- Name: directory_listings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.directory_listings ENABLE ROW LEVEL SECURITY;

--
-- Name: directory_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.directory_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_integrations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.oauth_integrations ENABLE ROW LEVEL SECURITY;

--
-- Name: oauth_integrations oauth_integrations_access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY oauth_integrations_access ON public.oauth_integrations USING (((current_setting('app.current_user_role'::text, true) = ANY (ARRAY['PLATFORM_ADMIN'::text, 'PLATFORM_SUPPORT'::text, 'PLATFORM_VIEWER'::text])) OR (tenant_id IS NULL) OR (tenant_id = current_setting('app.current_tenant_id'::text, true))));


--
-- Name: organization; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.organization ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_business_profile; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenant_business_profile ENABLE ROW LEVEL SECURITY;

--
-- Name: tenant_category; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tenant_category ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tenants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: TABLE directory_listings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.directory_listings TO anon;
GRANT SELECT ON TABLE public.directory_listings TO authenticated;


--
-- PostgreSQL database dump complete
--

\unrestrict DykrRJ3R7WYMyC1EeUnqrk6YZCK7XKyGEuLCTDCc6zKn1hI3JLAQEgYd3ALVhcL

