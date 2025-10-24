-- CreateTable
CREATE TABLE "email_configuration" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "email_configuration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_configuration_category_key" ON "email_configuration"("category");

-- CreateIndex
CREATE INDEX "email_configuration_category_idx" ON "email_configuration"("category");
