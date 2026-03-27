CREATE TYPE "pack_status" AS ENUM ('GENERATING', 'READY', 'FAILED');

ALTER TABLE "proof_packs"
ADD COLUMN "status" "pack_status" NOT NULL DEFAULT 'GENERATING',
ADD COLUMN "error_message" TEXT,
ALTER COLUMN "content_hash" DROP NOT NULL,
ALTER COLUMN "file_path" DROP NOT NULL;

UPDATE "proof_packs"
SET "status" = 'READY'
WHERE "content_hash" IS NOT NULL
  AND "file_path" IS NOT NULL;

CREATE TABLE "audit_entry_snapshots" (
  "audit_entry_id" TEXT PRIMARY KEY,
  "payload" JSONB NOT NULL,
  CONSTRAINT "audit_entry_snapshots_audit_entry_id_fkey"
    FOREIGN KEY ("audit_entry_id") REFERENCES "audit_entries"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);
