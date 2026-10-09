ALTER TABLE "ClientPlan" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'Normal', ADD COLUMN "deliverySchedule" JSONB;
