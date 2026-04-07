CREATE TYPE "artifact_analysis_status" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "evidence_artifact_analyses" (
  "id" TEXT NOT NULL,
  "artifact_id" TEXT NOT NULL,
  "lane_id" TEXT NOT NULL,
  "analyzer_version" TEXT NOT NULL,
  "analysis_status" "artifact_analysis_status" NOT NULL DEFAULT 'QUEUED',
  "document_label" TEXT,
  "document_role" TEXT,
  "confidence" TEXT,
  "summary_text" TEXT,
  "extracted_fields" JSONB,
  "missing_field_keys" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "low_confidence_field_keys" TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "evidence_artifact_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "evidence_artifact_analyses_artifact_id_created_at_idx"
ON "evidence_artifact_analyses"("artifact_id", "created_at");

CREATE INDEX "evidence_artifact_analyses_lane_id_created_at_idx"
ON "evidence_artifact_analyses"("lane_id", "created_at");

ALTER TABLE "evidence_artifact_analyses"
ADD CONSTRAINT "evidence_artifact_analyses_artifact_id_fkey"
FOREIGN KEY ("artifact_id") REFERENCES "evidence_artifacts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence_artifact_analyses"
ADD CONSTRAINT "evidence_artifact_analyses_lane_id_fkey"
FOREIGN KEY ("lane_id") REFERENCES "lanes"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
