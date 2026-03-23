CREATE TABLE "fruit_profiles" (
  "id" UUID NOT NULL,
  "product_type" "product_type" NOT NULL,
  "optimal_min_c" DECIMAL(5,2) NOT NULL,
  "optimal_max_c" DECIMAL(5,2) NOT NULL,
  "chilling_threshold_c" DECIMAL(5,2),
  "heat_threshold_c" DECIMAL(5,2) NOT NULL,
  "shelf_life_min_days" INTEGER NOT NULL,
  "shelf_life_max_days" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fruit_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fruit_profiles_product_type_key"
  ON "fruit_profiles"("product_type");

ALTER TABLE "lanes"
  ADD COLUMN "cold_chain_device_id" TEXT,
  ADD COLUMN "cold_chain_data_frequency_seconds" INTEGER;
