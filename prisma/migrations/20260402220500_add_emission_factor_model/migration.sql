-- CreateTable
CREATE TABLE "emission_factors" (
    "id" TEXT NOT NULL,
    "product" "product_type" NOT NULL,
    "market" "destination_market" NOT NULL,
    "transport_mode" "transport_mode" NOT NULL,
    "co2e_per_kg" DECIMAL(10,4) NOT NULL,
    "source" TEXT NOT NULL,
    "last_updated" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emission_factors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emission_factors_product_market_transport_mode_key" ON "emission_factors"("product", "market", "transport_mode");
