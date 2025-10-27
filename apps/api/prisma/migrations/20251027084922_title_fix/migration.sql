/*
  Warnings:

  - The primary key for the `audit_log` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `actor` on the `audit_log` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `audit_log` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `audit_log` table. All the data in the column will be lost.
  - You are about to drop the `currency_rates` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `brand` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `InventoryItem` table without a default value. This is not possible if the table is not empty.
  - Made the column `impressions` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `clicks` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ctr` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `conversions` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `revenue` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `visibilityScore` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastUpdated` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `createdAt` on table `ProductPerformance` required. This step will fail if there are existing NULL values in that column.
  - Made the column `source` on table `SyncJob` required. This step will fail if there are existing NULL values in that column.
  - Made the column `managedServicesActive` on table `Tenant` required. This step will fail if there are existing NULL values in that column.
  - Made the column `skusAddedThisMonth` on table `Tenant` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `actor_id` to the `audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actor_type` to the `audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `diff` to the `audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entity_id` to the `audit_log` table without a default value. This is not possible if the table is not empty.
  - Added the required column `entity_type` to the `audit_log` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `audit_log` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `views_search` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.
  - Made the column `views_maps` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.
  - Made the column `actions_website` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.
  - Made the column `actions_phone` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.
  - Made the column `actions_directions` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.
  - Made the column `photos_count` on table `gbp_insights_daily` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "availability_status" AS ENUM ('in_stock', 'out_of_stock', 'preorder');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('new', 'refurbished', 'used');

-- CreateEnum
CREATE TYPE "item_visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "sync_status" AS ENUM ('pending', 'success', 'error');

-- CreateEnum
CREATE TYPE "item_status" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('user', 'system', 'integration');

-- CreateEnum
CREATE TYPE "entity_type" AS ENUM ('inventory_item', 'tenant', 'policy', 'oauth', 'other');

-- CreateEnum
CREATE TYPE "action" AS ENUM ('create', 'update', 'delete', 'sync', 'policy_apply', 'oauth_connect', 'oauth_refresh');

-- DropForeignKey
ALTER TABLE "public"."ProductPerformance" DROP CONSTRAINT "ProductPerformance_itemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProductPerformance" DROP CONSTRAINT "ProductPerformance_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "public"."audit_log" DROP CONSTRAINT "audit_log_tenant_id_fkey";

-- DropIndex
DROP INDEX "public"."PhotoAsset_tenantId_inventoryItemId_idx";

-- DropIndex
DROP INDEX "public"."audit_log_tenant_id_created_at_idx";

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "auditLogId" TEXT,
ADD COLUMN     "availability" "availability_status" NOT NULL DEFAULT 'in_stock',
ADD COLUMN     "brand" TEXT NOT NULL,
ADD COLUMN     "categoryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "condition" "product_condition" DEFAULT 'new',
ADD COLUMN     "currency" CHAR(3) NOT NULL DEFAULT 'USD',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "eligibilityReason" TEXT,
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "itemStatus" "item_status" DEFAULT 'active',
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "merchantName" TEXT,
ADD COLUMN     "mpn" TEXT,
ADD COLUMN     "price" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "quantity" INTEGER,
ADD COLUMN     "searchTsv" tsvector,
ADD COLUMN     "syncStatus" "sync_status" DEFAULT 'pending',
ADD COLUMN     "syncedAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "visibility" "item_visibility" DEFAULT 'public';

-- AlterTable
ALTER TABLE "PhotoAsset" ALTER COLUMN "exifRemoved" SET DEFAULT false,
ALTER COLUMN "capturedAt" DROP NOT NULL,
ALTER COLUMN "capturedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProductPerformance" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "impressions" SET NOT NULL,
ALTER COLUMN "clicks" SET NOT NULL,
ALTER COLUMN "ctr" SET NOT NULL,
ALTER COLUMN "conversions" SET NOT NULL,
ALTER COLUMN "revenue" SET NOT NULL,
ALTER COLUMN "visibilityScore" SET NOT NULL,
ALTER COLUMN "lastUpdated" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "SyncJob" ALTER COLUMN "source" SET NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "managedServicesActive" SET NOT NULL,
ALTER COLUMN "skusAddedThisMonth" SET NOT NULL;

-- AlterTable
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_pkey",
DROP COLUMN "actor",
DROP COLUMN "created_at",
DROP COLUMN "payload",
ADD COLUMN     "actor_id" TEXT NOT NULL,
ADD COLUMN     "actor_type" "actor_type" NOT NULL,
ADD COLUMN     "diff" JSONB NOT NULL,
ADD COLUMN     "entity_id" TEXT NOT NULL,
ADD COLUMN     "entity_type" "entity_type" NOT NULL,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "metadata" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pii_scrubbed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "request_id" TEXT,
ADD COLUMN     "user_agent" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "action",
ADD COLUMN     "action" "action" NOT NULL,
ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "audit_log_id_seq";

-- AlterTable
ALTER TABLE "gbp_insights_daily" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "views_search" SET NOT NULL,
ALTER COLUMN "views_maps" SET NOT NULL,
ALTER COLUMN "actions_website" SET NOT NULL,
ALTER COLUMN "actions_phone" SET NOT NULL,
ALTER COLUMN "actions_directions" SET NOT NULL,
ALTER COLUMN "photos_count" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_locations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "google_merchant_links" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "google_oauth_accounts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "google_oauth_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- DropTable
DROP TABLE "public"."currency_rates";

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "platform_name" TEXT,
    "platform_description" TEXT,
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_billing_policy" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "count_active_private" BOOLEAN NOT NULL,
    "count_preorder" BOOLEAN NOT NULL,
    "count_zero_price" BOOLEAN NOT NULL,
    "require_image" BOOLEAN NOT NULL,
    "require_currency" BOOLEAN NOT NULL,
    "note" TEXT,
    "updated_by" TEXT,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_billing_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_billing_policy_history" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'global',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "count_active_private" BOOLEAN NOT NULL,
    "count_preorder" BOOLEAN NOT NULL,
    "count_zero_price" BOOLEAN NOT NULL,
    "require_image" BOOLEAN NOT NULL,
    "require_currency" BOOLEAN NOT NULL,
    "notes" TEXT,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sku_billing_policy_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upgrade_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "current_tier" TEXT NOT NULL,
    "requested_tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "admin_notes" TEXT,
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sku_billing_policy_history_scope_effective_from_idx" ON "sku_billing_policy_history"("scope", "effective_from" DESC);

-- CreateIndex
CREATE INDEX "upgrade_requests_tenant_id_idx" ON "upgrade_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "upgrade_requests_status_idx" ON "upgrade_requests"("status");

-- CreateIndex
CREATE INDEX "upgrade_requests_created_at_idx" ON "upgrade_requests"("created_at");

-- CreateIndex
CREATE INDEX "PhotoAsset_tenantId_idx" ON "PhotoAsset"("tenantId");

-- CreateIndex
CREATE INDEX "PhotoAsset_inventoryItemId_idx" ON "PhotoAsset"("inventoryItemId");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_occurred_at_idx" ON "audit_log"("tenant_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_entity_type_entity_id_idx" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_type_actor_id_idx" ON "audit_log"("actor_type", "actor_id");

-- CreateIndex
CREATE INDEX "audit_log_request_id_idx" ON "audit_log"("request_id");

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPerformance" ADD CONSTRAINT "ProductPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
