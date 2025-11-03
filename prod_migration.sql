-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- DropForeignKey
ALTER TABLE "tenant_feature_flags" DROP CONSTRAINT "tenant_feature_flags_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "business_hours" DROP CONSTRAINT "business_hours_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "business_hours_special" DROP CONSTRAINT "business_hours_special_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "category_mirror_runs" DROP CONSTRAINT "category_mirror_runs_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "tenant_business_profile" DROP CONSTRAINT "tenant_business_profile_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_templates" DROP CONSTRAINT "scan_templates_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_sessions" DROP CONSTRAINT "scan_sessions_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_sessions" DROP CONSTRAINT "scan_sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_sessions" DROP CONSTRAINT "scan_sessions_template_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_results" DROP CONSTRAINT "scan_results_tenant_id_fkey";

-- DropForeignKey
ALTER TABLE "scan_results" DROP CONSTRAINT "scan_results_session_id_fkey";

-- DropForeignKey
ALTER TABLE "barcode_lookup_log" DROP CONSTRAINT "barcode_lookup_log_tenant_id_fkey";

-- AlterTable
ALTER TABLE "public"."tenant_business_profile" DROP CONSTRAINT "tenant_business_profile_pkey",
ADD COLUMN     "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id" TEXT NOT NULL,
ALTER COLUMN "latitude" SET DATA TYPE DECIMAL,
ALTER COLUMN "longitude" SET DATA TYPE DECIMAL,
ALTER COLUMN "display_map" DROP NOT NULL,
ALTER COLUMN "map_privacy_mode" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(6),
ADD CONSTRAINT "tenant_business_profile_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."permission_matrix" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(6),
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(6);

-- AlterTable
ALTER TABLE "public"."permission_audit_log" ALTER COLUMN "id" SET DEFAULT (gen_random_uuid())::text,
DROP COLUMN "action",
ADD COLUMN     "action" "public"."permission_action" NOT NULL,
ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMP(6);

-- DropTable
DROP TABLE "platform_feature_flags";

-- DropTable
DROP TABLE "tenant_feature_flags";

-- DropTable
DROP TABLE "business_hours";

-- DropTable
DROP TABLE "business_hours_special";

-- DropTable
DROP TABLE "category_mirror_runs";

-- DropTable
DROP TABLE "feed_push_jobs";

-- DropTable
DROP TABLE "outreach_feedback";

-- DropTable
DROP TABLE "tenant_category";

-- DropTable
DROP TABLE "google_taxonomy";

-- DropTable
DROP TABLE "scan_templates";

-- DropTable
DROP TABLE "scan_sessions";

-- DropTable
DROP TABLE "scan_results";

-- DropTable
DROP TABLE "barcode_lookup_log";

-- DropEnum
DROP TYPE "job_status";

-- CreateIndex
CREATE INDEX "idx_tenant_business_profile_tenant_id" ON "public"."tenant_business_profile"("tenant_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_profile_tenant_id_key" ON "public"."tenant_business_profile"("tenant_id" ASC);

-- AddForeignKey
ALTER TABLE "public"."tenant_business_profile" ADD CONSTRAINT "tenant_business_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- RenameIndex
ALTER INDEX "public"."permission_matrix_role_idx" RENAME TO "idx_permission_matrix_role";

-- RenameIndex
ALTER INDEX "public"."permission_matrix_action_idx" RENAME TO "idx_permission_matrix_action";

-- RenameIndex
ALTER INDEX "public"."permission_audit_log_role_idx" RENAME TO "idx_permission_audit_role";

-- RenameIndex
ALTER INDEX "public"."permission_audit_log_changed_by_idx" RENAME TO "idx_permission_audit_changed_by";

-- RenameIndex
ALTER INDEX "public"."permission_audit_log_changed_at_idx" RENAME TO "idx_permission_audit_changed_at";
