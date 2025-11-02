-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('queued', 'processing', 'success', 'failed');

-- AlterTable
ALTER TABLE "tenant_business_profile" ADD COLUMN     "logo_url" TEXT;

-- CreateTable
CREATE TABLE "feed_push_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT,
    "job_status" "job_status" NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "last_attempt" TIMESTAMP(3),
    "next_retry" TIMESTAMP(3),
    "error_message" TEXT,
    "error_code" TEXT,
    "payload" JSONB,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "feed_push_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_feedback" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "feedback" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "category" TEXT,
    "context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_category" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parent_id" TEXT,
    "google_category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_taxonomy" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "category_path" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" TEXT NOT NULL DEFAULT '2024-09',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_taxonomy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultCategory" TEXT,
    "defaultPriceCents" INTEGER,
    "defaultCurrency" CHAR(3) NOT NULL DEFAULT 'USD',
    "defaultVisibility" TEXT NOT NULL DEFAULT 'private',
    "enrichmentRules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "template_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "device_type" TEXT,
    "scanned_count" INTEGER NOT NULL DEFAULT 0,
    "committed_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "scan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "sku" TEXT,
    "raw_payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'new',
    "enrichment" JSONB,
    "validation" JSONB,
    "duplicate_of" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_lookup_log" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "provider" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "response" JSONB,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_lookup_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_push_jobs_tenant_id_job_status_idx" ON "feed_push_jobs"("tenant_id", "job_status");

-- CreateIndex
CREATE INDEX "feed_push_jobs_job_status_idx" ON "feed_push_jobs"("job_status");

-- CreateIndex
CREATE INDEX "feed_push_jobs_next_retry_idx" ON "feed_push_jobs"("next_retry");

-- CreateIndex
CREATE INDEX "feed_push_jobs_created_at_idx" ON "feed_push_jobs"("created_at");

-- CreateIndex
CREATE INDEX "feed_push_jobs_tenant_id_sku_idx" ON "feed_push_jobs"("tenant_id", "sku");

-- CreateIndex
CREATE INDEX "outreach_feedback_tenant_id_created_at_idx" ON "outreach_feedback"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "outreach_feedback_score_idx" ON "outreach_feedback"("score");

-- CreateIndex
CREATE INDEX "outreach_feedback_category_idx" ON "outreach_feedback"("category");

-- CreateIndex
CREATE INDEX "outreach_feedback_context_idx" ON "outreach_feedback"("context");

-- CreateIndex
CREATE INDEX "outreach_feedback_created_at_idx" ON "outreach_feedback"("created_at");

-- CreateIndex
CREATE INDEX "tenant_category_tenant_id_is_active_idx" ON "tenant_category"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "tenant_category_google_category_id_idx" ON "tenant_category"("google_category_id");

-- CreateIndex
CREATE INDEX "tenant_category_parent_id_idx" ON "tenant_category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_category_tenant_id_slug_key" ON "tenant_category"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "google_taxonomy_category_id_key" ON "google_taxonomy"("category_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_category_id_idx" ON "google_taxonomy"("category_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_parent_id_idx" ON "google_taxonomy"("parent_id");

-- CreateIndex
CREATE INDEX "google_taxonomy_version_is_active_idx" ON "google_taxonomy"("version", "is_active");

-- CreateIndex
CREATE INDEX "scan_templates_tenant_id_idx" ON "scan_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "scan_templates_tenant_id_name_key" ON "scan_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "scan_sessions_tenant_id_status_idx" ON "scan_sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "scan_sessions_started_at_idx" ON "scan_sessions"("started_at");

-- CreateIndex
CREATE INDEX "scan_results_tenant_id_status_created_at_idx" ON "scan_results"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "scan_results_session_id_idx" ON "scan_results"("session_id");

-- CreateIndex
CREATE INDEX "scan_results_barcode_idx" ON "scan_results"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "scan_results_tenant_id_session_id_barcode_key" ON "scan_results"("tenant_id", "session_id", "barcode");

-- CreateIndex
CREATE INDEX "barcode_lookup_log_tenant_id_created_at_idx" ON "barcode_lookup_log"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "barcode_lookup_log_barcode_idx" ON "barcode_lookup_log"("barcode");

-- AddForeignKey
ALTER TABLE "scan_templates" ADD CONSTRAINT "scan_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "scan_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "scan_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_lookup_log" ADD CONSTRAINT "barcode_lookup_log_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
