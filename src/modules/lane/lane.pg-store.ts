import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type {
  CreateLaneInput,
  LaneColdChainMode,
  LaneDetail,
  LaneGpsPoint,
  LaneMarket,
  LaneProduct,
  LaneRuleSnapshot,
  LaneRuleSnapshotPayload,
  LaneStatus,
  LaneStore,
  LaneSummary,
  LaneTransportMode,
  UpdateLaneInput,
} from './lane.types';

type QueryExecutor = Pool | PoolClient;

interface LaneRow extends QueryResultRow {
  id: string;
  lane_id: string;
  exporter_id: string;
  status: LaneStatus;
  product_type: LaneProduct;
  destination_market: LaneMarket;
  completeness_score: string | number;
  cold_chain_mode: LaneColdChainMode;
  created_at: Date | string;
  updated_at: Date | string;
  status_changed_at: Date | string;
}

interface BatchRow extends QueryResultRow {
  id: string;
  lane_id: string;
  batch_id: string;
  product: LaneProduct;
  variety: string | null;
  quantity_kg: string | number;
  origin_province: string;
  harvest_date: Date | string;
  grade: 'PREMIUM' | 'A' | 'B';
}

interface RouteRow extends QueryResultRow {
  id: string;
  lane_id: string;
  transport_mode: LaneTransportMode;
  carrier: string | null;
  origin_gps: LaneGpsPoint | null;
  destination_gps: LaneGpsPoint | null;
  estimated_transit_hours: number | null;
}

interface CheckpointRow extends QueryResultRow {
  id: string;
  lane_id: string;
  sequence: number;
  location_name: string;
  gps_lat: string | number | null;
  gps_lng: string | number | null;
  timestamp: Date | string | null;
  temperature: string | number | null;
  signature_hash: string | null;
  signer_name: string | null;
  condition_notes: string | null;
  status: 'PENDING' | 'COMPLETED' | 'OVERDUE';
}

interface RuleSnapshotRow extends QueryResultRow {
  id: string;
  lane_id: string;
  market: LaneMarket;
  product: LaneProduct;
  version: number;
  rules: LaneRuleSnapshot['rules'];
  effective_date: Date | string;
  created_at: Date | string;
}

@Injectable()
export class PrismaLaneStore implements LaneStore, OnModuleDestroy {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    if (databaseUrl.length === 0) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.executor = this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== undefined) {
      await this.pool.end();
    }
  }

  async runInTransaction<T>(
    operation: (store: LaneStore) => Promise<T>,
  ): Promise<T> {
    const executor = this.requireExecutor();

    if (executor instanceof Pool) {
      const client = await executor.connect();

      try {
        await client.query('BEGIN');
        const transactionalStore = PrismaLaneStore.withExecutor(client);
        const result = await operation(transactionalStore);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    return await operation(this);
  }

  private static withExecutor(executor: QueryExecutor): PrismaLaneStore {
    const store = new PrismaLaneStore();
    store.pool = undefined;
    store.executor = executor;
    return store;
  }

  async findLatestLaneIdByYear(year: number): Promise<string | null> {
    const result = await this.requireExecutor().query<{ lane_id: string }>(
      `
        SELECT lane_id
        FROM lanes
        WHERE lane_id LIKE $1
        ORDER BY lane_id DESC
        LIMIT 1
      `,
      [`LN-${year}-%`],
    );

    return result.rowCount === 0 ? null : result.rows[0].lane_id;
  }

  async findLatestBatchIdByPrefix(prefix: string): Promise<string | null> {
    const result = await this.requireExecutor().query<{ batch_id: string }>(
      `
        SELECT batch_id
        FROM batches
        WHERE batch_id LIKE $1
        ORDER BY batch_id DESC
        LIMIT 1
      `,
      [`${prefix}-%`],
    );

    return result.rowCount === 0 ? null : result.rows[0].batch_id;
  }

  async createLaneBundle(input: {
    exporterId: string;
    laneId: string;
    status: LaneStatus;
    productType: LaneProduct;
    destinationMarket: LaneMarket;
    completenessScore: number;
    coldChainMode?: LaneColdChainMode;
    batchId: string;
    batch: CreateLaneInput['batch'];
    route: CreateLaneInput['route'];
    checkpoints: NonNullable<CreateLaneInput['checkpoints']>;
    ruleSnapshot: LaneRuleSnapshotPayload | null;
  }): Promise<LaneDetail> {
    const executor = this.requireExecutor();
    const laneDbId = randomUUID();
    const batchDbId = randomUUID();
    const routeDbId = randomUUID();

    await executor.query(
      `
        INSERT INTO lanes (
          id,
          lane_id,
          exporter_id,
          status,
          product_type,
          destination_market,
          completeness_score,
          cold_chain_mode,
          status_changed_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
      `,
      [
        laneDbId,
        input.laneId,
        input.exporterId,
        input.status,
        input.productType,
        input.destinationMarket,
        input.completenessScore,
        input.coldChainMode ?? null,
      ],
    );

    await executor.query(
      `
        INSERT INTO batches (
          id,
          lane_id,
          batch_id,
          product,
          variety,
          quantity_kg,
          origin_province,
          harvest_date,
          grade
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        batchDbId,
        laneDbId,
        input.batchId,
        input.productType,
        input.batch.variety ?? null,
        input.batch.quantityKg,
        input.batch.originProvince,
        input.batch.harvestDate,
        input.batch.grade,
      ],
    );

    await executor.query(
      `
        INSERT INTO routes (
          id,
          lane_id,
          transport_mode,
          carrier,
          origin_gps,
          destination_gps,
          estimated_transit_hours
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
      `,
      [
        routeDbId,
        laneDbId,
        input.route.transportMode,
        input.route.carrier ?? null,
        input.route.originGps === undefined
          ? null
          : JSON.stringify(input.route.originGps),
        input.route.destinationGps === undefined
          ? null
          : JSON.stringify(input.route.destinationGps),
        input.route.estimatedTransitHours ?? null,
      ],
    );

    for (const checkpoint of input.checkpoints) {
      await executor.query(
        `
          INSERT INTO checkpoints (
            id,
            lane_id,
            sequence,
            location_name,
            gps_lat,
            gps_lng,
            timestamp,
            temperature,
            signature_hash,
            signer_name,
            condition_notes,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `,
        [
          randomUUID(),
          laneDbId,
          checkpoint.sequence,
          checkpoint.locationName,
          checkpoint.gpsLat ?? null,
          checkpoint.gpsLng ?? null,
          checkpoint.timestamp ?? null,
          checkpoint.temperature ?? null,
          checkpoint.signatureHash ?? null,
          checkpoint.signerName ?? null,
          checkpoint.conditionNotes ?? null,
          checkpoint.status ?? 'PENDING',
        ],
      );
    }

    if (input.ruleSnapshot !== null) {
      await executor.query(
        `
          INSERT INTO rule_snapshots (
            id,
            lane_id,
            market,
            product,
            version,
            rules,
            effective_date,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())
        `,
        [
          randomUUID(),
          laneDbId,
          input.ruleSnapshot.market,
          input.ruleSnapshot.product,
          input.ruleSnapshot.version,
          JSON.stringify({
            sourcePath: input.ruleSnapshot.sourcePath,
            requiredDocuments: input.ruleSnapshot.requiredDocuments,
            completenessWeights: input.ruleSnapshot.completenessWeights,
            substances: input.ruleSnapshot.substances,
          }),
          input.ruleSnapshot.effectiveDate,
        ],
      );
    }

    const lane = await this.findLaneById(laneDbId);
    if (lane === null) {
      throw new Error('Unable to load created lane.');
    }

    return lane;
  }

  async findLanes(filter: {
    exporterId?: string | undefined;
    page: number;
    limit: number;
    status?: LaneStatus | undefined;
    product?: LaneProduct | undefined;
    market?: LaneMarket | undefined;
  }): Promise<{ items: LaneSummary[]; total: number }> {
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (filter.exporterId !== undefined) {
      values.push(filter.exporterId);
      conditions.push(`exporter_id = $${values.length}`);
    }

    if (filter.status !== undefined) {
      values.push(filter.status);
      conditions.push(`status = $${values.length}`);
    }

    if (filter.product !== undefined) {
      values.push(filter.product);
      conditions.push(`product_type = $${values.length}`);
    }

    if (filter.market !== undefined) {
      values.push(filter.market);
      conditions.push(`destination_market = $${values.length}`);
    }

    const whereClause =
      conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const offset = (filter.page - 1) * filter.limit;
    const countResult = await this.requireExecutor().query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM lanes ${whereClause}`,
      values,
    );
    const listResult = await this.requireExecutor().query<LaneRow>(
      `
        SELECT
          id,
          lane_id,
          exporter_id,
          status,
          product_type,
          destination_market,
          completeness_score,
          cold_chain_mode,
          status_changed_at,
          created_at,
          updated_at
        FROM lanes
        ${whereClause}
        ORDER BY created_at DESC, id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, filter.limit, offset],
    );

    return {
      items: listResult.rows.map((row) => this.mapLaneSummary(row)),
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  }

  async findLaneById(id: string): Promise<LaneDetail | null> {
    const executor = this.requireExecutor();
    const laneResult = await executor.query<LaneRow>(
      `
        SELECT
          id,
          lane_id,
          exporter_id,
          status,
          product_type,
          destination_market,
          completeness_score,
          cold_chain_mode,
          status_changed_at,
          created_at,
          updated_at
        FROM lanes
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (laneResult.rowCount === 0) {
      return null;
    }

    const laneRow = laneResult.rows[0];
    const [batchResult, routeResult, checkpointsResult, ruleSnapshotResult] =
      await Promise.all([
        executor.query<BatchRow>(
          `
            SELECT
              id,
              lane_id,
              batch_id,
              product,
              variety,
              quantity_kg,
              origin_province,
              harvest_date,
              grade
            FROM batches
            WHERE lane_id = $1
            LIMIT 1
          `,
          [id],
        ),
        executor.query<RouteRow>(
          `
            SELECT
              id,
              lane_id,
              transport_mode,
              carrier,
              origin_gps,
              destination_gps,
              estimated_transit_hours
            FROM routes
            WHERE lane_id = $1
            LIMIT 1
          `,
          [id],
        ),
        executor.query<CheckpointRow>(
          `
            SELECT
              id,
              lane_id,
              sequence,
              location_name,
              gps_lat,
              gps_lng,
              timestamp,
              temperature,
              signature_hash,
              signer_name,
              condition_notes,
              status
            FROM checkpoints
            WHERE lane_id = $1
            ORDER BY sequence ASC
          `,
          [id],
        ),
        executor.query<RuleSnapshotRow>(
          `
            SELECT
              id,
              lane_id,
              market,
              product,
              version,
              rules,
              effective_date,
              created_at
            FROM rule_snapshots
            WHERE lane_id = $1
            LIMIT 1
          `,
          [id],
        ),
      ]);

    return {
      ...this.mapLaneSummary(laneRow),
      batch:
        batchResult.rowCount === 0
          ? null
          : {
              id: batchResult.rows[0].id,
              laneId: batchResult.rows[0].lane_id,
              batchId: batchResult.rows[0].batch_id,
              product: batchResult.rows[0].product,
              variety: batchResult.rows[0].variety,
              quantityKg: Number(batchResult.rows[0].quantity_kg),
              originProvince: batchResult.rows[0].origin_province,
              harvestDate: new Date(batchResult.rows[0].harvest_date),
              grade: batchResult.rows[0].grade,
            },
      route:
        routeResult.rowCount === 0
          ? null
          : {
              id: routeResult.rows[0].id,
              laneId: routeResult.rows[0].lane_id,
              transportMode: routeResult.rows[0].transport_mode,
              carrier: routeResult.rows[0].carrier,
              originGps: routeResult.rows[0].origin_gps,
              destinationGps: routeResult.rows[0].destination_gps,
              estimatedTransitHours:
                routeResult.rows[0].estimated_transit_hours,
            },
      checkpoints: checkpointsResult.rows.map((row) => ({
        id: row.id,
        laneId: row.lane_id,
        sequence: row.sequence,
        locationName: row.location_name,
        gpsLat: row.gps_lat === null ? null : Number(row.gps_lat),
        gpsLng: row.gps_lng === null ? null : Number(row.gps_lng),
        timestamp: row.timestamp === null ? null : new Date(row.timestamp),
        temperature: row.temperature === null ? null : Number(row.temperature),
        signatureHash: row.signature_hash,
        signerName: row.signer_name,
        conditionNotes: row.condition_notes,
        status: row.status,
      })),
      ruleSnapshot:
        ruleSnapshotResult.rowCount === 0
          ? null
          : this.mapRuleSnapshot(ruleSnapshotResult.rows[0]),
    };
  }

  async updateLaneBundle(
    id: string,
    input: UpdateLaneInput,
  ): Promise<LaneDetail | null> {
    const executor = this.requireExecutor();
    const existing = await this.findLaneById(id);
    if (existing === null) {
      return null;
    }

    if (input.coldChainMode !== undefined) {
      await executor.query(
        `
          UPDATE lanes
          SET cold_chain_mode = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [id, input.coldChainMode],
      );
    }

    if (input.batch !== undefined) {
      await executor.query(
        `
          UPDATE batches
          SET
            variety = COALESCE($2, variety),
            quantity_kg = COALESCE($3, quantity_kg),
            origin_province = COALESCE($4, origin_province),
            harvest_date = COALESCE($5, harvest_date),
            grade = COALESCE($6, grade)
          WHERE lane_id = $1
        `,
        [
          id,
          input.batch.variety ?? null,
          input.batch.quantityKg ?? null,
          input.batch.originProvince ?? null,
          input.batch.harvestDate ?? null,
          input.batch.grade ?? null,
        ],
      );
    }

    if (input.route !== undefined) {
      await executor.query(
        `
          UPDATE routes
          SET
            transport_mode = COALESCE($2, transport_mode),
            carrier = COALESCE($3, carrier),
            origin_gps = COALESCE($4::jsonb, origin_gps),
            destination_gps = COALESCE($5::jsonb, destination_gps),
            estimated_transit_hours = COALESCE($6, estimated_transit_hours)
          WHERE lane_id = $1
        `,
        [
          id,
          input.route.transportMode ?? null,
          input.route.carrier ?? null,
          input.route.originGps === undefined
            ? null
            : JSON.stringify(input.route.originGps),
          input.route.destinationGps === undefined
            ? null
            : JSON.stringify(input.route.destinationGps),
          input.route.estimatedTransitHours ?? null,
        ],
      );
    }

    await executor.query(
      `
        UPDATE lanes
        SET updated_at = NOW()
        WHERE id = $1
      `,
      [id],
    );

    return await this.findLaneById(id);
  }

  async transitionLaneStatus(
    id: string,
    targetStatus: LaneStatus,
    transitionedAt: Date,
  ): Promise<LaneDetail | null> {
    const executor = this.requireExecutor();
    const existing = await this.findLaneById(id);
    if (existing === null) {
      return null;
    }

    await executor.query(
      `
        UPDATE lanes
        SET
          status = $2,
          status_changed_at = $3,
          updated_at = $3
        WHERE id = $1
      `,
      [id, targetStatus, transitionedAt],
    );

    return await this.findLaneById(id);
  }

  async countProofPacksForLane(id: string): Promise<number> {
    const result = await this.requireExecutor().query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM proof_packs
        WHERE lane_id = $1
      `,
      [id],
    );

    return Number(result.rows[0]?.total ?? 0);
  }

  private requireExecutor(): QueryExecutor {
    if (this.executor === undefined) {
      throw new Error('Lane store is not configured.');
    }

    return this.executor;
  }

  private mapLaneSummary(row: LaneRow): LaneSummary {
    return {
      id: row.id,
      laneId: row.lane_id,
      exporterId: row.exporter_id,
      status: row.status,
      productType: row.product_type,
      destinationMarket: row.destination_market,
      completenessScore: Number(row.completeness_score),
      coldChainMode: row.cold_chain_mode,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      statusChangedAt: new Date(row.status_changed_at),
    };
  }

  private mapRuleSnapshot(row: RuleSnapshotRow): LaneRuleSnapshot {
    return {
      id: row.id,
      laneId: row.lane_id,
      market: row.market,
      product: row.product,
      version: row.version,
      rules: row.rules,
      effectiveDate: new Date(row.effective_date),
      createdAt: new Date(row.created_at),
    };
  }
}
