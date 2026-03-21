-- Fix: Checkpoint signature_hash should be CHAR(64) for SHA-256 consistency
ALTER TABLE "checkpoints" ALTER COLUMN "signature_hash" TYPE CHAR(64);

-- Fix: Add SHA-256 CHECK constraint on checkpoint signature_hash
ALTER TABLE "checkpoints" ADD CONSTRAINT "chk_checkpoint_signature_hash"
  CHECK ("signature_hash" IS NULL OR "signature_hash" ~ '^[0-9a-f]{64}$');

-- Fix: Add indexes to audit_entries for query performance (10-year retention)
CREATE INDEX "audit_entries_entity_id_idx" ON "audit_entries"("entity_id");
CREATE INDEX "audit_entries_timestamp_idx" ON "audit_entries"("timestamp");

-- Fix: Add onDelete RESTRICT to prevent orphaning audit-referenced users
-- ApiKey → User
ALTER TABLE "api_keys" DROP CONSTRAINT IF EXISTS "api_keys_user_id_fkey";
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lane → User (exporter)
ALTER TABLE "lanes" DROP CONSTRAINT IF EXISTS "lanes_exporter_id_fkey";
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_exporter_id_fkey"
  FOREIGN KEY ("exporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EvidenceArtifact → Lane
ALTER TABLE "evidence_artifacts" DROP CONSTRAINT IF EXISTS "evidence_artifacts_lane_id_fkey";
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_lane_id_fkey"
  FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- EvidenceArtifact → User (uploader)
ALTER TABLE "evidence_artifacts" DROP CONSTRAINT IF EXISTS "evidence_artifacts_uploaded_by_fkey";
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_uploaded_by_fkey"
  FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProofPack → Lane
ALTER TABLE "proof_packs" DROP CONSTRAINT IF EXISTS "proof_packs_lane_id_fkey";
ALTER TABLE "proof_packs" ADD CONSTRAINT "proof_packs_lane_id_fkey"
  FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ProofPack → User (generator)
ALTER TABLE "proof_packs" DROP CONSTRAINT IF EXISTS "proof_packs_generated_by_fkey";
ALTER TABLE "proof_packs" ADD CONSTRAINT "proof_packs_generated_by_fkey"
  FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
