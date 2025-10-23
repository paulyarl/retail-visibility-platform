-- Add product performance metrics tracking

-- Product Performance Metrics Table
CREATE TABLE "ProductPerformance" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "itemId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  
  -- Google Merchant Center Status
  "approvalStatus" TEXT, -- 'approved', 'pending', 'rejected', 'not_synced'
  "rejectionReason" TEXT,
  
  -- Performance Metrics
  "impressions" INTEGER DEFAULT 0,
  "clicks" INTEGER DEFAULT 0,
  "ctr" DECIMAL(5,2) DEFAULT 0, -- Click-through rate percentage
  "conversions" INTEGER DEFAULT 0,
  "revenue" DECIMAL(12,2) DEFAULT 0,
  
  -- Visibility Metrics
  "visibilityScore" INTEGER DEFAULT 0, -- 0-100
  "searchRank" INTEGER, -- Average rank in search results
  
  -- Metadata
  "lastUpdated" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "ProductPerformance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE,
  CONSTRAINT "ProductPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- Unique constraint: one record per item per day
CREATE UNIQUE INDEX "ProductPerformance_itemId_date_key" ON "ProductPerformance"("itemId", "date");

-- Index for tenant queries
CREATE INDEX "ProductPerformance_tenantId_date_idx" ON "ProductPerformance"("tenantId", "date" DESC);

-- Index for approval status queries
CREATE INDEX "ProductPerformance_approvalStatus_idx" ON "ProductPerformance"("approvalStatus");

-- Performance Summary View (aggregated by tenant)
CREATE OR REPLACE VIEW v_tenant_performance_summary AS
SELECT 
  p."tenantId",
  p."date",
  COUNT(DISTINCT p."itemId") as "totalProducts",
  SUM(CASE WHEN p."approvalStatus" = 'approved' THEN 1 ELSE 0 END) as "approvedProducts",
  SUM(CASE WHEN p."approvalStatus" = 'pending' THEN 1 ELSE 0 END) as "pendingProducts",
  SUM(CASE WHEN p."approvalStatus" = 'rejected' THEN 1 ELSE 0 END) as "rejectedProducts",
  SUM(p."impressions") as "totalImpressions",
  SUM(p."clicks") as "totalClicks",
  CASE 
    WHEN SUM(p."impressions") > 0 THEN ROUND((SUM(p."clicks")::DECIMAL / SUM(p."impressions")::DECIMAL * 100), 2)
    ELSE 0 
  END as "avgCtr",
  SUM(p."conversions") as "totalConversions",
  SUM(p."revenue") as "totalRevenue",
  AVG(p."visibilityScore") as "avgVisibilityScore"
FROM "ProductPerformance" p
GROUP BY p."tenantId", p."date";

-- Product Performance Trends View (last 30 days)
CREATE OR REPLACE VIEW v_product_performance_trends AS
SELECT 
  p."itemId",
  i."sku",
  i."name",
  p."tenantId",
  p."approvalStatus",
  SUM(p."impressions") as "impressions_30d",
  SUM(p."clicks") as "clicks_30d",
  AVG(p."ctr") as "avg_ctr_30d",
  SUM(p."conversions") as "conversions_30d",
  SUM(p."revenue") as "revenue_30d",
  AVG(p."visibilityScore") as "avg_visibility_30d"
FROM "ProductPerformance" p
JOIN "InventoryItem" i ON p."itemId" = i."id"
WHERE p."date" >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY p."itemId", i."sku", i."name", p."tenantId", p."approvalStatus";
