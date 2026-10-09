-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Source" ADD VALUE 'TALLY';
ALTER TYPE "Source" ADD VALUE 'SLACK';
ALTER TYPE "Source" ADD VALUE 'NOTION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "weeklyCapacityHours" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "operations" JSONB,
ADD COLUMN     "parentJobId" TEXT;

-- AlterTable
ALTER TABLE "InboundEvent" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "duplicateOfId" TEXT,
ADD COLUMN     "jobId" TEXT;

-- CreateTable
CREATE TABLE "ClientPlan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cadenceDays" INTEGER NOT NULL DEFAULT 7,
    "targetJobs" INTEGER NOT NULL DEFAULT 0,
    "targetVariants" INTEGER NOT NULL DEFAULT 0,
    "formatMix" TEXT NOT NULL DEFAULT '',
    "approverEmail" TEXT NOT NULL DEFAULT '',
    "releaseOwnerEmail" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchRecord" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "variantCode" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not launched',
    "plannedAt" TIMESTAMP(3),
    "launchedAt" TIMESTAMP(3),
    "destinationUrl" TEXT NOT NULL DEFAULT '',
    "adUrl" TEXT NOT NULL DEFAULT '',
    "campaign" TEXT NOT NULL DEFAULT '',
    "adSet" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientPlan_clientId_key" ON "ClientPlan"("clientId");

-- CreateIndex
CREATE INDEX "LaunchRecord_status_plannedAt_idx" ON "LaunchRecord"("status", "plannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchRecord_jobId_variantCode_platform_account_key" ON "LaunchRecord"("jobId", "variantCode", "platform", "account");

-- AddForeignKey
ALTER TABLE "ClientPlan" ADD CONSTRAINT "ClientPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchRecord" ADD CONSTRAINT "LaunchRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

