import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import type { LaneColdChainMode, LaneProduct } from '../lane/lane.types';
import type {
  ColdChainStore,
  FruitProfile,
  LaneTemperatureContext,
  NewTemperatureExcursion,
  TemperatureExcursion,
  TemperatureReading,
  TemperatureReadingInput,
} from './cold-chain.types';

interface FruitProfileRow extends QueryResultRow {
  id: string;
  product_type: LaneProduct;
  optimal_min_c: string | number;
  optimal_max_c: string | number;
  chilling_threshold_c: string | number | null;
  heat_threshold_c: string | number;
  shelf_life_min_days: number;
  shelf_life_max_days: number;
}

interface LaneTemperatureContextRow extends FruitProfileRow {
  lane_id: string;
  cold_chain_mode: LaneColdChainMode;
  cold_chain_device_id: string | null;
  cold_chain_data_frequency_seconds: number | null;
}

interface TemperatureReadingRow extends QueryResultRow {
  id: string;
  lane_id: string;
  recorded_at: Date;
  temperature_c: string | number;
  device_id: string | null;
}

interface TemperatureExcursionRow extends QueryResultRow {
  id: string;
  lane_id: string;
  started_at: Date;
  ended_at: Date | null;
  ongoing: boolean;
  duration_minutes: number;
  severity: TemperatureExcursion['severity'];
  direction: TemperatureExcursion['direction'];
  excursion_type: TemperatureExcursion['type'];
  threshold_c: string | number;
  min_observed_c: string | number;
  max_observed_c: string | number;
  max_deviation_c: string | number;
  shelf_life_impact_percent: number;
}

@Injectable()
export class PrismaColdChainStore implements ColdChainStore, OnModuleDestroy {
  private pool?: Pool;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    if (databaseUrl.length === 0) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== undefined) {
      await this.pool.end();
    }
  }

  async listProfiles(): Promise<FruitProfile[]> {
    const result = await this.requirePool().query<FruitProfileRow>(
      `
        SELECT
          id,
          product_type,
          optimal_min_c,
          optimal_max_c,
          chilling_threshold_c,
          heat_threshold_c,
          shelf_life_min_days,
          shelf_life_max_days
        FROM fruit_profiles
        ORDER BY product_type ASC
      `,
    );

    return result.rows.map((row) => this.mapProfile(row));
  }

  async findProfileByProduct(
    productType: LaneProduct,
  ): Promise<FruitProfile | null> {
    const result = await this.requirePool().query<FruitProfileRow>(
      `
        SELECT
          id,
          product_type,
          optimal_min_c,
          optimal_max_c,
          chilling_threshold_c,
          heat_threshold_c,
          shelf_life_min_days,
          shelf_life_max_days
        FROM fruit_profiles
        WHERE product_type = $1
      `,
      [productType],
    );

    return result.rowCount === 0 ? null : this.mapProfile(result.rows[0]);
  }

  async findLaneTemperatureContext(
    laneId: string,
  ): Promise<LaneTemperatureContext | null> {
    const result = await this.requirePool().query<LaneTemperatureContextRow>(
      `
        SELECT
          l.id AS lane_id,
          l.product_type,
          l.cold_chain_mode,
          l.cold_chain_device_id,
          l.cold_chain_data_frequency_seconds,
          fp.id,
          fp.optimal_min_c,
          fp.optimal_max_c,
          fp.chilling_threshold_c,
          fp.heat_threshold_c,
          fp.shelf_life_min_days,
          fp.shelf_life_max_days
        FROM lanes l
        INNER JOIN fruit_profiles fp
          ON fp.product_type = l.product_type
        WHERE l.id = $1
      `,
      [laneId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      laneId: row.lane_id,
      productType: row.product_type,
      coldChainMode: row.cold_chain_mode,
      coldChainDeviceId: row.cold_chain_device_id,
      coldChainDataFrequencySeconds: row.cold_chain_data_frequency_seconds,
      profile: this.mapProfile(row),
    };
  }

  async createTemperatureReadings(
    laneId: string,
    readings: TemperatureReadingInput[],
  ): Promise<void> {
    if (readings.length === 0) {
      return;
    }

    const values: unknown[] = [];
    const placeholders = readings.map((reading, index) => {
      const base = index * 4;
      values.push(
        laneId,
        reading.timestamp,
        reading.temperatureC,
        reading.deviceId,
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
    });

    await this.requirePool().query(
      `
        INSERT INTO temperature_readings (
          lane_id,
          recorded_at,
          temperature_c,
          device_id
        )
        VALUES ${placeholders.join(', ')}
      `,
      values,
    );
  }

  async listTemperatureReadings(
    laneId: string,
    query: { from?: Date; to?: Date } = {},
  ): Promise<TemperatureReading[]> {
    const result = await this.requirePool().query<TemperatureReadingRow>(
      `
        SELECT
          id,
          lane_id,
          recorded_at,
          temperature_c,
          device_id
        FROM temperature_readings
        WHERE lane_id = $1
          AND ($2::timestamp IS NULL OR recorded_at >= $2)
          AND ($3::timestamp IS NULL OR recorded_at <= $3)
        ORDER BY recorded_at ASC
      `,
      [laneId, query.from ?? null, query.to ?? null],
    );

    return result.rows.map((row) => this.mapTemperatureReading(row));
  }

  async replaceExcursions(
    laneId: string,
    excursions: NewTemperatureExcursion[],
  ): Promise<TemperatureExcursion[]> {
    const pool = this.requirePool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM excursions WHERE lane_id = $1`, [laneId]);

      if (excursions.length > 0) {
        const values: unknown[] = [];
        const placeholders = excursions.map((excursion, index) => {
          const base = index * 13;
          values.push(
            excursion.laneId,
            excursion.startedAt,
            excursion.endedAt,
            excursion.ongoing,
            excursion.durationMinutes,
            excursion.severity,
            excursion.direction,
            excursion.type,
            excursion.thresholdC,
            excursion.minObservedC,
            excursion.maxObservedC,
            excursion.maxDeviationC,
            excursion.shelfLifeImpactPercent,
          );

          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13})`;
        });

        await client.query(
          `
            INSERT INTO excursions (
              lane_id,
              started_at,
              ended_at,
              ongoing,
              duration_minutes,
              severity,
              direction,
              excursion_type,
              threshold_c,
              min_observed_c,
              max_observed_c,
              max_deviation_c,
              shelf_life_impact_percent
            )
            VALUES ${placeholders.join(', ')}
          `,
          values,
        );
      }

      const result = await client.query<TemperatureExcursionRow>(
        `
          SELECT
            id,
            lane_id,
            started_at,
            ended_at,
            ongoing,
            duration_minutes,
            severity,
            direction,
            excursion_type,
            threshold_c,
            min_observed_c,
            max_observed_c,
            max_deviation_c,
            shelf_life_impact_percent
          FROM excursions
          WHERE lane_id = $1
          ORDER BY started_at ASC
        `,
        [laneId],
      );

      await client.query('COMMIT');
      return result.rows.map((row) => this.mapExcursion(row));
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listLaneExcursions(
    laneId: string,
    query: { from?: Date; to?: Date } = {},
  ): Promise<TemperatureExcursion[]> {
    const result = await this.requirePool().query<TemperatureExcursionRow>(
      `
        SELECT
          id,
          lane_id,
          started_at,
          ended_at,
          ongoing,
          duration_minutes,
          severity,
          direction,
          excursion_type,
          threshold_c,
          min_observed_c,
          max_observed_c,
          max_deviation_c,
          shelf_life_impact_percent
        FROM excursions
        WHERE lane_id = $1
          AND ($2::timestamp IS NULL OR COALESCE(ended_at, started_at) >= $2)
          AND ($3::timestamp IS NULL OR started_at <= $3)
        ORDER BY started_at ASC
      `,
      [laneId, query.from ?? null, query.to ?? null],
    );

    return result.rows.map((row) => this.mapExcursion(row));
  }

  private requirePool(): Pool {
    if (this.pool === undefined) {
      throw new Error('Cold-chain store is not configured.');
    }

    return this.pool;
  }

  private mapProfile(row: FruitProfileRow): FruitProfile {
    return {
      id: row.id,
      productType: row.product_type,
      optimalMinC: Number(row.optimal_min_c),
      optimalMaxC: Number(row.optimal_max_c),
      chillingThresholdC:
        row.chilling_threshold_c === null
          ? null
          : Number(row.chilling_threshold_c),
      heatThresholdC: Number(row.heat_threshold_c),
      shelfLifeMinDays: row.shelf_life_min_days,
      shelfLifeMaxDays: row.shelf_life_max_days,
    };
  }

  private mapTemperatureReading(
    row: TemperatureReadingRow,
  ): TemperatureReading {
    return {
      id: row.id,
      laneId: row.lane_id,
      timestamp: row.recorded_at,
      temperatureC: Number(row.temperature_c),
      deviceId: row.device_id,
    };
  }

  private mapExcursion(row: TemperatureExcursionRow): TemperatureExcursion {
    return {
      id: row.id,
      laneId: row.lane_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      ongoing: row.ongoing,
      durationMinutes: row.duration_minutes,
      severity: row.severity,
      direction: row.direction,
      type: row.excursion_type,
      thresholdC: Number(row.threshold_c),
      minObservedC: Number(row.min_observed_c),
      maxObservedC: Number(row.max_observed_c),
      maxDeviationC: Number(row.max_deviation_c),
      shelfLifeImpactPercent: row.shelf_life_impact_percent,
    };
  }
}
