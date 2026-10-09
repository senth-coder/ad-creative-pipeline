ALTER TABLE "DeliveryBatch" ADD COLUMN "mediaBuyerSlackId" TEXT;
ALTER TABLE "DeliveryItem" ADD COLUMN "assetVersionId" TEXT;
ALTER TABLE "OutboxEvent" ADD COLUMN "lastError" TEXT;
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "AssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
