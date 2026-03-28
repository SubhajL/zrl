CREATE TYPE "privacy_consent_type" AS ENUM (
  'MARKETING_COMMUNICATIONS'
);

CREATE TYPE "privacy_request_type" AS ENUM (
  'ACCESS',
  'CORRECTION',
  'DELETION',
  'OBJECTION',
  'PORTABILITY',
  'WITHDRAW_CONSENT'
);

CREATE TYPE "privacy_request_status" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED'
);

CREATE TYPE "data_export_status" AS ENUM (
  'READY',
  'FAILED',
  'EXPIRED'
);

CREATE TABLE "privacy_consent_events" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "consent_type" "privacy_consent_type" NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "privacy_requests" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "request_type" "privacy_request_type" NOT NULL,
  "status" "privacy_request_status" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "details" JSONB,
  "due_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "data_export_requests" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" "data_export_status" NOT NULL DEFAULT 'READY',
  "file_name" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "zip_data" BYTEA NOT NULL,
  "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3)
);

CREATE INDEX "idx_privacy_consent_events_user_type_created_at"
  ON "privacy_consent_events" ("user_id", "consent_type", "created_at" DESC);

CREATE INDEX "idx_privacy_requests_user_created_at"
  ON "privacy_requests" ("user_id", "created_at" DESC);

CREATE INDEX "idx_privacy_requests_status_due_at"
  ON "privacy_requests" ("status", "due_at");

CREATE INDEX "idx_data_export_requests_user_exported_at"
  ON "data_export_requests" ("user_id", "exported_at" DESC);
