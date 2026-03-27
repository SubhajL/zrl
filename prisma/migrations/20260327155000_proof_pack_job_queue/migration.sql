CREATE TYPE "proof_pack_job_status" AS ENUM (
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

UPDATE "proof_packs"
SET "status" = 'FAILED',
    "error_message" = COALESCE(
      "error_message",
      'Proof pack generation was interrupted before durable job support was enabled. Please regenerate the pack.'
    )
WHERE "status" = 'GENERATING';

CREATE TABLE "proof_pack_jobs" (
  "id" TEXT PRIMARY KEY,
  "proof_pack_id" TEXT NOT NULL UNIQUE,
  "status" "proof_pack_job_status" NOT NULL DEFAULT 'QUEUED',
  "payload" JSONB NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "available_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "leased_at" TIMESTAMPTZ,
  "lease_expires_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "proof_pack_jobs_proof_pack_id_fkey"
    FOREIGN KEY ("proof_pack_id") REFERENCES "proof_packs"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE INDEX "proof_pack_jobs_status_available_at_idx"
  ON "proof_pack_jobs" ("status", "available_at");

CREATE INDEX "proof_pack_jobs_status_lease_expires_at_idx"
  ON "proof_pack_jobs" ("status", "lease_expires_at");
