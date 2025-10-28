-- CreateTable
CREATE TABLE "organization_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "request_type" TEXT NOT NULL DEFAULT 'join',
    "estimated_cost" DOUBLE PRECISION,
    "cost_currency" TEXT DEFAULT 'USD',
    "notes" TEXT,
    "admin_notes" TEXT,
    "cost_agreed" BOOLEAN NOT NULL DEFAULT false,
    "cost_agreed_at" TIMESTAMP(3),
    "processed_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_requests_tenant_id_idx" ON "organization_requests"("tenant_id");

-- CreateIndex
CREATE INDEX "organization_requests_organization_id_idx" ON "organization_requests"("organization_id");

-- CreateIndex
CREATE INDEX "organization_requests_status_idx" ON "organization_requests"("status");

-- CreateIndex
CREATE INDEX "organization_requests_requested_by_idx" ON "organization_requests"("requested_by");

-- CreateIndex
CREATE INDEX "organization_requests_created_at_idx" ON "organization_requests"("created_at");

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_requests" ADD CONSTRAINT "organization_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
