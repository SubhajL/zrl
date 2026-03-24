CREATE TYPE "excursion_direction" AS ENUM ('LOW', 'HIGH');
CREATE TYPE "excursion_type" AS ENUM ('CHILLING', 'HEAT');

CREATE TABLE "temperature_readings" (
  "id" UUID NOT NULL,
  "lane_id" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL,
  "temperature_c" DECIMAL(5,2) NOT NULL,
  "device_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "temperature_readings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "temperature_readings_lane_id_recorded_at_idx"
  ON "temperature_readings"("lane_id", "recorded_at");

ALTER TABLE "temperature_readings"
  ADD CONSTRAINT "temperature_readings_lane_id_fkey"
  FOREIGN KEY ("lane_id") REFERENCES "lanes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "excursions" (
  "id" UUID NOT NULL,
  "lane_id" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3),
  "ongoing" BOOLEAN NOT NULL DEFAULT FALSE,
  "duration_minutes" INTEGER NOT NULL,
  "severity" "excursion_severity" NOT NULL,
  "direction" "excursion_direction" NOT NULL,
  "excursion_type" "excursion_type" NOT NULL,
  "threshold_c" DECIMAL(5,2) NOT NULL,
  "min_observed_c" DECIMAL(5,2) NOT NULL,
  "max_observed_c" DECIMAL(5,2) NOT NULL,
  "max_deviation_c" DECIMAL(5,2) NOT NULL,
  "shelf_life_impact_percent" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "excursions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "excursions_lane_id_started_at_idx"
  ON "excursions"("lane_id", "started_at");

ALTER TABLE "excursions"
  ADD CONSTRAINT "excursions_lane_id_fkey"
  FOREIGN KEY ("lane_id") REFERENCES "lanes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
