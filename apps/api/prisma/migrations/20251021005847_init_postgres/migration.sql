-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'VIEWER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "contentType" TEXT,
    "bytes" INTEGER,
    "exifRemoved" BOOLEAN NOT NULL DEFAULT true,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tenant_name_idx" ON "Tenant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_updatedAt_idx" ON "InventoryItem"("tenantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "PhotoAsset_tenantId_inventoryItemId_idx" ON "PhotoAsset"("tenantId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "PhotoAsset_capturedAt_idx" ON "PhotoAsset"("capturedAt");

-- CreateIndex
CREATE INDEX "SyncJob_tenantId_status_updatedAt_idx" ON "SyncJob"("tenantId", "status", "updatedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAsset" ADD CONSTRAINT "PhotoAsset_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncJob" ADD CONSTRAINT "SyncJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
