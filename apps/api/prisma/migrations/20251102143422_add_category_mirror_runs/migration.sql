-- CreateTable
CREATE TABLE "category_mirror_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "strategy" TEXT NOT NULL,
    "dry_run" BOOLEAN NOT NULL DEFAULT true,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deleted" INTEGER NOT NULL DEFAULT 0,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "error" TEXT,
    "job_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "category_mirror_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "category_mirror_runs_tenant_id_strategy_started_at_idx" ON "category_mirror_runs"("tenant_id", "strategy", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "category_mirror_runs" ADD CONSTRAINT "category_mirror_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
