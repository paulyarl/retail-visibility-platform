-- AlterTable
ALTER TABLE "PhotoAsset" ADD COLUMN     "width" INTEGER,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "capturedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PhotoAsset_capturedAt_idx" ON "PhotoAsset"("capturedAt");
