CREATE TYPE "artifact_source" AS ENUM ('UPLOAD', 'PARTNER_API', 'CAMERA');

ALTER TABLE "evidence_artifacts"
ADD COLUMN "file_name" TEXT NOT NULL DEFAULT 'artifact',
ADD COLUMN "mime_type" TEXT NOT NULL DEFAULT 'application/octet-stream',
ADD COLUMN "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "source" "artifact_source" NOT NULL DEFAULT 'UPLOAD',
ADD COLUMN "checkpoint_id" TEXT,
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "evidence_artifacts"
ADD CONSTRAINT "evidence_artifacts_checkpoint_id_fkey"
FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "evidence_artifacts_lane_id_artifact_type_idx"
ON "evidence_artifacts"("lane_id", "artifact_type");

CREATE INDEX "evidence_artifacts_lane_id_verification_status_idx"
ON "evidence_artifacts"("lane_id", "verification_status");

CREATE INDEX "evidence_artifacts_checkpoint_id_idx"
ON "evidence_artifacts"("checkpoint_id");
