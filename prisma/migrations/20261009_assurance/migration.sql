-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboarding" JSONB,
ADD COLUMN     "qaUnavailable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "confirmedBy" TEXT,
ADD COLUMN     "governance" JSONB,
ADD COLUMN     "governanceVersion" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "policySnapshot" JSONB;

-- AlterTable
ALTER TABLE "AssetVersion" ADD COLUMN     "briefRevision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "copyText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "filename" TEXT,
ADD COLUMN     "naming" JSONB,
ADD COLUMN     "review" JSONB,
ADD COLUMN     "revisionNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sourceBriefUrl" TEXT;

-- AlterTable
ALTER TABLE "OutboxEvent" ADD COLUMN     "leaseToken" TEXT,
ADD COLUMN     "leasedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GapAssessment" (
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Reported',
    "owner" TEXT NOT NULL DEFAULT '',
    "evidenceUrl" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "confirmedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GapAssessment_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceMetric_provider_externalId_key" ON "PerformanceMetric"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "AssetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

