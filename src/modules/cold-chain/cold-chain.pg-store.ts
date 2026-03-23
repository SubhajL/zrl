import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import type { LaneProduct } from '../lane/lane.types';
import type { ColdChainStore, FruitProfile } from './cold-chain.types';

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
}
