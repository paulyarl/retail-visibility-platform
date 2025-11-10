/*
  Warnings:

  - Changed the type of `action` on the `permission_audit_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable (only if tables exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permission_audit_log') THEN
    ALTER TABLE "permission_audit_log" ALTER COLUMN "id" DROP DEFAULT,
    DROP COLUMN "action",
    ADD COLUMN     "action" TEXT NOT NULL,
    ALTER COLUMN "changed_at" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- AlterTable
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'permission_matrix') THEN
    ALTER TABLE "permission_matrix" ALTER COLUMN "id" DROP DEFAULT,
    ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
    ALTER COLUMN "updated_at" DROP DEFAULT,
    ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
  END IF;
END $$;

-- CreateTable
CREATE TABLE "tenant_business_profile" (
    "tenant_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT,
    "postal_code" TEXT NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "phone_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "contact_person" TEXT,
    "hours" JSONB,
    "social_links" JSONB,
    "seo_tags" JSONB,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "display_map" BOOLEAN NOT NULL DEFAULT false,
    "map_privacy_mode" TEXT NOT NULL DEFAULT 'precise',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_business_profile_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_business_profile" ADD CONSTRAINT "tenant_business_profile_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex (only if indexes exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_permission_audit_changed_at') THEN
    ALTER INDEX "idx_permission_audit_changed_at" RENAME TO "permission_audit_log_changed_at_idx";
  END IF;
  
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_permission_audit_changed_by') THEN
    ALTER INDEX "idx_permission_audit_changed_by" RENAME TO "permission_audit_log_changed_by_idx";
  END IF;
  
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_permission_audit_role') THEN
    ALTER INDEX "idx_permission_audit_role" RENAME TO "permission_audit_log_role_idx";
  END IF;
  
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_permission_matrix_action') THEN
    ALTER INDEX "idx_permission_matrix_action" RENAME TO "permission_matrix_action_idx";
  END IF;
  
  IF EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_permission_matrix_role') THEN
    ALTER INDEX "idx_permission_matrix_role" RENAME TO "permission_matrix_role_idx";
  END IF;
END $$;
