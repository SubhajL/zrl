-- Task 8: add persistent rule-store tables for YAML-backed MRL data.
CREATE TABLE "substances" (
    "id" TEXT NOT NULL,
    "market" "destination_market" NOT NULL,
    "name" TEXT NOT NULL,
    "cas" TEXT NOT NULL,
    "thai_mrl" DECIMAL(10,4) NOT NULL,
    "destination_mrl" DECIMAL(10,4) NOT NULL,
    "stringency_ratio" DECIMAL(10,2) NOT NULL,
    "risk_level" "risk_level" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "substances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rule_sets" (
    "id" TEXT NOT NULL,
    "market" "destination_market" NOT NULL,
    "product" "product_type" NOT NULL,
    "version" INTEGER NOT NULL,
    "effective_date" DATE NOT NULL,
    "source_path" TEXT,
    "rules" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rule_versions" (
    "id" TEXT NOT NULL,
    "rule_set_id" TEXT NOT NULL,
    "market" "destination_market" NOT NULL,
    "product" "product_type" NOT NULL,
    "version" INTEGER NOT NULL,
    "changes_summary" TEXT NOT NULL,
    "rules" JSONB NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "substances_market_name_key" ON "substances"("market", "name");
CREATE INDEX "substances_market_idx" ON "substances"("market");

CREATE UNIQUE INDEX "rule_sets_market_product_key" ON "rule_sets"("market", "product");
CREATE INDEX "rule_sets_market_product_version_idx" ON "rule_sets"("market", "product", "version");

CREATE UNIQUE INDEX "rule_versions_rule_set_id_version_key" ON "rule_versions"("rule_set_id", "version");
CREATE INDEX "rule_versions_market_product_idx" ON "rule_versions"("market", "product");

ALTER TABLE "rule_versions"
ADD CONSTRAINT "rule_versions_rule_set_id_fkey"
FOREIGN KEY ("rule_set_id") REFERENCES "rule_sets"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
