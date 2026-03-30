-- CreateEnum
CREATE TYPE "dispute_type" AS ENUM ('CUSTOMS_REJECTION', 'QUALITY_CLAIM', 'INSURANCE_CLAIM', 'GRADE_DISPUTE', 'CARGO_DAMAGE');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'INVESTIGATING', 'DEFENSE_SUBMITTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "disputes" (
    "id" TEXT NOT NULL,
    "lane_id" TEXT NOT NULL,
    "type" "dispute_type" NOT NULL,
    "description" TEXT NOT NULL,
    "claimant" TEXT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'OPEN',
    "financial_impact" DECIMAL(12,2),
    "resolution_notes" TEXT,
    "defense_pack_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disputes_lane_id_idx" ON "disputes"("lane_id");

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
