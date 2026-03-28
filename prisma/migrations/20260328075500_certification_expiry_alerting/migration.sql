ALTER TYPE "notification_type"
  ADD VALUE IF NOT EXISTS 'CERTIFICATION_EXPIRY';

CREATE TABLE "certification_alert_deliveries" (
  "id" TEXT PRIMARY KEY,
  "lane_id" TEXT NOT NULL REFERENCES "lanes"("id") ON DELETE CASCADE,
  "artifact_id" TEXT NOT NULL REFERENCES "evidence_artifacts"("id") ON DELETE CASCADE,
  "artifact_type" "artifact_type" NOT NULL,
  "alert_code" TEXT NOT NULL,
  "warning_days" INTEGER,
  "expires_at" TIMESTAMP(3),
  "notification_id" TEXT UNIQUE REFERENCES "notifications"("id") ON DELETE SET NULL,
  "delivery_status" TEXT NOT NULL,
  "claimed_at" TIMESTAMP(3) NOT NULL,
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("lane_id", "artifact_id", "alert_code")
);

CREATE INDEX "idx_certification_alert_deliveries_status_claimed_at"
  ON "certification_alert_deliveries" ("delivery_status", "claimed_at" DESC);
