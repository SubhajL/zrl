-- AlterTable: make substance comparator fields nullable for source-accurate imports
-- Korea mango pesticide rows from MFDS do not include Thai comparison data

ALTER TABLE "substances" ALTER COLUMN "cas" DROP NOT NULL;
ALTER TABLE "substances" ALTER COLUMN "thai_mrl" DROP NOT NULL;
ALTER TABLE "substances" ALTER COLUMN "stringency_ratio" DROP NOT NULL;
ALTER TABLE "substances" ALTER COLUMN "risk_level" DROP NOT NULL;
