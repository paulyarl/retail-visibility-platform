-- AlterTable
ALTER TABLE "platform_feature_flags" ADD COLUMN "allow_tenant_override" BOOLEAN NOT NULL DEFAULT false;
