-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('EXPORTER', 'PARTNER', 'ADMIN', 'AUDITOR');

-- CreateEnum
CREATE TYPE "lane_status" AS ENUM ('CREATED', 'EVIDENCE_COLLECTING', 'VALIDATED', 'PACKED', 'CLOSED', 'INCOMPLETE', 'CLAIM_DEFENSE', 'DISPUTE_RESOLVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('MANGO', 'DURIAN', 'MANGOSTEEN', 'LONGAN');

-- CreateEnum
CREATE TYPE "destination_market" AS ENUM ('JAPAN', 'CHINA', 'KOREA', 'EU');

-- CreateEnum
CREATE TYPE "transport_mode" AS ENUM ('AIR', 'SEA', 'TRUCK');

-- CreateEnum
CREATE TYPE "artifact_type" AS ENUM ('MRL_TEST', 'VHT_CERT', 'PHYTO_CERT', 'CHECKPOINT_PHOTO', 'TEMP_DATA', 'HANDOFF_SIGNATURE', 'INVOICE', 'GAP_CERT');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED');

-- CreateEnum
CREATE TYPE "checkpoint_status" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "pack_type" AS ENUM ('REGULATOR', 'BUYER', 'DEFENSE');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('UPLOAD', 'SIGN', 'GENERATE', 'VERIFY', 'CREATE', 'UPDATE');

-- CreateEnum
CREATE TYPE "audit_entity_type" AS ENUM ('LANE', 'ARTIFACT', 'CHECKPOINT', 'PROOF_PACK');

-- CreateEnum
CREATE TYPE "grade" AS ENUM ('PREMIUM', 'A', 'B');

-- CreateEnum
CREATE TYPE "cold_chain_mode" AS ENUM ('MANUAL', 'LOGGER', 'TELEMETRY');

-- CreateEnum
CREATE TYPE "excursion_severity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');

-- CreateEnum
CREATE TYPE "risk_level" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "company_name" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopes" TEXT[],
    "ip_whitelist" TEXT[],
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lanes" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "exporter_id" TEXT NOT NULL,
    "status" "lane_status" NOT NULL DEFAULT 'CREATED',
    "product_type" "product_type" NOT NULL,
    "destination_market" "destination_market" NOT NULL,
    "completeness_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cold_chain_mode" "cold_chain_mode",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "product" "product_type" NOT NULL,
    "variety" TEXT,
    "quantity_kg" DECIMAL(10,2) NOT NULL,
    "origin_province" TEXT NOT NULL,
    "harvest_date" DATE NOT NULL,
    "grade" "grade" NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routes" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "transport_mode" "transport_mode" NOT NULL,
    "carrier" TEXT,
    "origin_gps" JSONB,
    "destination_gps" JSONB,
    "estimated_transit_hours" INTEGER,

    CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "location_name" TEXT NOT NULL,
    "gps_lat" DECIMAL(10,7),
    "gps_lng" DECIMAL(10,7),
    "timestamp" TIMESTAMP(3),
    "temperature" DECIMAL(5,2),
    "signature_hash" TEXT,
    "signer_name" TEXT,
    "condition_notes" TEXT,
    "status" "checkpoint_status" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_artifacts" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "artifact_type" "artifact_type" NOT NULL,
    "file_path" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "issuer" TEXT,
    "issued_at" TIMESTAMP(3),
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verification_status" "verification_status" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,

    CONSTRAINT "evidence_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_links" (
    "id" TEXT NOT NULL,
    "source_artifact_id" TEXT NOT NULL,
    "target_artifact_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,

    CONSTRAINT "artifact_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_packs" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "pack_type" "pack_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content_hash" CHAR(64) NOT NULL,
    "file_path" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" TEXT NOT NULL,
    "recipient" TEXT,

    CONSTRAINT "proof_packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_entries" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "entity_type" "audit_entity_type" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "prev_hash" CHAR(64) NOT NULL,
    "entry_hash" CHAR(64) NOT NULL,

    CONSTRAINT "audit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_snapshots" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "market" "destination_market" NOT NULL,
    "product" "product_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL,
    "effective_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lanes_lane_id_key" ON "lanes"("lane_id");

-- CreateIndex
CREATE UNIQUE INDEX "batches_lane_id_key" ON "batches"("lane_id");

-- CreateIndex
CREATE UNIQUE INDEX "batches_batch_id_key" ON "batches"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "routes_lane_id_key" ON "routes"("lane_id");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_lane_id_sequence_key" ON "checkpoints"("lane_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_links_source_artifact_id_target_artifact_id_key" ON "artifact_links"("source_artifact_id", "target_artifact_id");

-- CreateIndex
CREATE UNIQUE INDEX "rule_snapshots_lane_id_key" ON "rule_snapshots"("lane_id");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_exporter_id_fkey" FOREIGN KEY ("exporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routes" ADD CONSTRAINT "routes_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "evidence_artifacts_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_links" ADD CONSTRAINT "artifact_links_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "evidence_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_links" ADD CONSTRAINT "artifact_links_target_artifact_id_fkey" FOREIGN KEY ("target_artifact_id") REFERENCES "evidence_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_packs" ADD CONSTRAINT "proof_packs_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_packs" ADD CONSTRAINT "proof_packs_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_snapshots" ADD CONSTRAINT "rule_snapshots_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
