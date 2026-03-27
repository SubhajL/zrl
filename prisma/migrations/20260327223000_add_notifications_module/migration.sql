CREATE TYPE "notification_type" AS ENUM (
  'RULE_CHANGE',
  'EXCURSION_ALERT',
  'MISSING_DOCUMENT',
  'PACK_GENERATED',
  'CLAIM_FILED'
);

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "lane_id" TEXT REFERENCES "lanes"("id") ON DELETE SET NULL,
  "type" "notification_type" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "notification_preferences" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" "notification_type" NOT NULL,
  "in_app_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "email_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "push_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "line_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "type")
);

CREATE INDEX "idx_notifications_user_created_at"
  ON "notifications" ("user_id", "created_at" DESC);

CREATE INDEX "idx_notifications_user_read_at"
  ON "notifications" ("user_id", "read_at");
