import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request, { type Response } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/common/auth/auth.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public';

describe('ColdChainController live DB (e2e)', () => {
  let pool: Pool;
  let app: INestApplication<App>;
  let exporterId: string;
  let laneId: string;
  let publicLaneId: string;

  const envSnapshot = { ...process.env };
  const authServiceMock = {
    verifyAccessToken: jest.fn(),
    resolveLaneOwnerId: jest.fn(),
  };

  async function createApp(): Promise<INestApplication<App>> {
    process.env['DATABASE_URL'] = databaseUrl;
    process.env['PROOF_PACK_WORKER_ENABLED'] = 'false';
    process.env['CERTIFICATION_EXPIRY_WORKER_ENABLED'] = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .compile();

    const nestApp = moduleFixture.createNestApplication();
    await nestApp.init();
    return nestApp;
  }

  async function seedFruitProfile(): Promise<void> {
    await pool.query(
      `
        INSERT INTO fruit_profiles (
          id,
          product_type,
          optimal_min_c,
          optimal_max_c,
          chilling_threshold_c,
          heat_threshold_c,
          shelf_life_min_days,
          shelf_life_max_days,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'MANGO',
          10.00,
          13.00,
          10.00,
          15.00,
          14,
          21,
          NOW(),
          NOW()
        )
        ON CONFLICT (product_type) DO UPDATE
        SET
          optimal_min_c = EXCLUDED.optimal_min_c,
          optimal_max_c = EXCLUDED.optimal_max_c,
          chilling_threshold_c = EXCLUDED.chilling_threshold_c,
          heat_threshold_c = EXCLUDED.heat_threshold_c,
          shelf_life_min_days = EXCLUDED.shelf_life_min_days,
          shelf_life_max_days = EXCLUDED.shelf_life_max_days,
          updated_at = NOW()
      `,
      [randomUUID()],
    );
  }

  async function seedLaneFixture(): Promise<void> {
    await pool.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          role,
          company_name,
          mfa_enabled,
          totp_secret,
          session_version,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'EXPORTER', $4, false, NULL, 0, NOW(), NOW())
      `,
      [
        exporterId,
        `${exporterId}@example.com`,
        'hashed-password',
        'Exporter Co',
      ],
    );

    await pool.query(
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
          cold_chain_device_id,
          cold_chain_data_frequency_seconds,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'EVIDENCE_COLLECTING',
          'MANGO',
          'JAPAN',
          92.50,
          'LOGGER',
          NOW(),
          'logger-1',
          300,
          NOW(),
          NOW()
        )
      `,
      [laneId, publicLaneId, exporterId],
    );
  }

  function ingestCriticalBatch() {
    return request(app.getHttpServer())
      .post(`/lanes/${publicLaneId}/temperature`)
      .set('Authorization', 'Bearer access-token')
      .send({
        readings: [
          {
            timestamp: '2026-03-28T00:00:00.000Z',
            temperatureC: 9,
            deviceId: 'logger-1',
          },
          {
            timestamp: '2026-03-28T00:05:00.000Z',
            temperatureC: 9,
            deviceId: 'logger-1',
          },
        ],
      });
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('SELECT 1');
    await seedFruitProfile();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    exporterId = `user-${randomUUID()}`;
    laneId = `lane-${randomUUID()}`;
    publicLaneId = `LN-LIVE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    authServiceMock.verifyAccessToken.mockResolvedValue({
      user: {
        id: exporterId,
        email: `${exporterId}@example.com`,
        role: 'EXPORTER',
        companyName: 'Exporter Co',
        mfaEnabled: false,
        sessionVersion: 0,
      },
      claims: {
        iss: 'zrl-auth',
        aud: 'zrl',
        sub: exporterId,
        type: 'access',
        role: 'EXPORTER',
        sv: 0,
        mfa: false,
        email: `${exporterId}@example.com`,
        companyName: 'Exporter Co',
        iat: 1,
        exp: 2,
        jti: 'jti',
      },
    });
    authServiceMock.resolveLaneOwnerId.mockImplementation(
      (requestedLaneId: string) =>
        requestedLaneId === laneId || requestedLaneId === publicLaneId
          ? Promise.resolve(exporterId)
          : Promise.resolve(null),
    );

    await seedLaneFixture();
    app = await createApp();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    await pool.query('DELETE FROM notifications WHERE lane_id = $1', [laneId]);
    await pool.query('DELETE FROM excursions WHERE lane_id = $1', [laneId]);
    await pool.query('DELETE FROM temperature_readings WHERE lane_id = $1', [
      laneId,
    ]);
    await pool.query('DELETE FROM lanes WHERE id = $1', [laneId]);
    await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
  });

  afterAll(async () => {
    process.env = envSnapshot;
    await pool.end();
  });

  it('POST /lanes/:id/temperature persists readings, excursions, notifications, and the lane breach flag', async () => {
    await ingestCriticalBatch()
      .expect(201)
      .expect((response: Response) => {
        const body = response.body as {
          count: number;
          excursionsDetected: number;
          sla: {
            status: string;
            defensibilityScore: number;
            shelfLifeImpactPercent: number;
            remainingShelfLifeDays: number;
            excursionCount: number;
            totalExcursionMinutes: number;
            maxDeviationC: number;
          };
        };

        expect(body).toEqual({
          count: 2,
          excursionsDetected: 1,
          sla: {
            status: 'FAIL',
            defensibilityScore: 0,
            shelfLifeImpactPercent: 100,
            remainingShelfLifeDays: 0,
            excursionCount: 1,
            totalExcursionMinutes: 10,
            maxDeviationC: 1,
          },
        });
      });

    const readingsResult = await pool.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM temperature_readings
        WHERE lane_id = $1
      `,
      [laneId],
    );
    expect(readingsResult.rows[0]?.count).toBe('2');

    const excursionResult = await pool.query<{
      severity: string;
      direction: string;
      excursion_type: string;
      ongoing: boolean;
      duration_minutes: number;
      started_at: Date;
      ended_at: Date | null;
    }>(
      `
        SELECT
          severity,
          direction,
          excursion_type,
          ongoing,
          duration_minutes,
          started_at,
          ended_at
        FROM excursions
        WHERE lane_id = $1
      `,
      [laneId],
    );
    expect(excursionResult.rows).toEqual([
      expect.objectContaining({
        severity: 'CRITICAL',
        direction: 'LOW',
        excursion_type: 'CHILLING',
        ongoing: true,
        duration_minutes: 10,
        started_at: new Date('2026-03-28T00:00:00.000Z'),
        ended_at: null,
      }),
    ]);

    const laneResult = await pool.query<{
      cold_chain_sla_breached_at: Date | null;
    }>(
      `
        SELECT cold_chain_sla_breached_at
        FROM lanes
        WHERE id = $1
      `,
      [laneId],
    );
    expect(laneResult.rows[0]?.cold_chain_sla_breached_at).toEqual(
      new Date('2026-03-28T00:00:00.000Z'),
    );

    const notificationResult = await pool.query<{
      type: string;
      lane_id: string | null;
      highest_severity: string | null;
      sla_breached: string | null;
      excursion_count: string | null;
    }>(
      `
        SELECT
          type,
          lane_id,
          data->>'highestSeverity' AS highest_severity,
          data->>'slaBreached' AS sla_breached,
          data->>'excursionCount' AS excursion_count
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [exporterId],
    );
    expect(notificationResult.rows).toEqual([
      {
        type: 'EXCURSION_ALERT',
        lane_id: laneId,
        highest_severity: 'CRITICAL',
        sla_breached: 'true',
        excursion_count: '1',
      },
    ]);
  });

  it('GET /lanes/:id/temperature returns the persisted live DB state', async () => {
    await ingestCriticalBatch().expect(201);

    await request(app.getHttpServer())
      .get(
        `/lanes/${publicLaneId}/temperature?from=2026-03-28T00:00:00.000Z&to=2026-03-28T01:00:00.000Z&resolution=raw`,
      )
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect((response: Response) => {
        const body = response.body as {
          readings: Array<{
            id: string;
            laneId: string;
            timestamp: string;
            temperatureC: number;
            deviceId: string | null;
          }>;
          excursions: Array<{
            id: string;
            laneId: string;
            startedAt: string;
            endedAt: string | null;
            ongoing: boolean;
            durationMinutes: number;
            severity: string;
            direction: string;
            type: string;
            thresholdC: number;
            minObservedC: number;
            maxObservedC: number;
            maxDeviationC: number;
            shelfLifeImpactPercent: number;
          }>;
          sla: {
            status: string;
            defensibilityScore: number;
            shelfLifeImpactPercent: number;
            remainingShelfLifeDays: number;
            excursionCount: number;
            totalExcursionMinutes: number;
            maxDeviationC: number;
          };
          meta: {
            resolution: string;
            from: string | null;
            to: string | null;
            totalReadings: number;
          };
        };

        expect(body.readings).toHaveLength(2);
        expect(body.readings[0]?.id).toEqual(expect.any(String));
        expect(body.readings[0]).toMatchObject({
          laneId,
          timestamp: '2026-03-28T00:00:00.000Z',
          temperatureC: 9,
          deviceId: 'logger-1',
        });
        expect(body.readings[1]?.id).toEqual(expect.any(String));
        expect(body.readings[1]).toMatchObject({
          laneId,
          timestamp: '2026-03-28T00:05:00.000Z',
          temperatureC: 9,
          deviceId: 'logger-1',
        });

        expect(body.excursions).toHaveLength(1);
        expect(body.excursions[0]?.id).toEqual(expect.any(String));
        expect(body.excursions[0]).toMatchObject({
          laneId,
          startedAt: '2026-03-28T00:00:00.000Z',
          endedAt: null,
          ongoing: true,
          durationMinutes: 10,
          severity: 'CRITICAL',
          direction: 'LOW',
          type: 'CHILLING',
          thresholdC: 10,
          minObservedC: 9,
          maxObservedC: 9,
          maxDeviationC: 1,
          shelfLifeImpactPercent: 100,
        });

        expect(body.sla).toEqual({
          status: 'FAIL',
          defensibilityScore: 0,
          shelfLifeImpactPercent: 100,
          remainingShelfLifeDays: 0,
          excursionCount: 1,
          totalExcursionMinutes: 10,
          maxDeviationC: 1,
        });
        expect(body.meta).toEqual({
          resolution: 'raw',
          from: '2026-03-28T00:00:00.000Z',
          to: '2026-03-28T01:00:00.000Z',
          totalReadings: 2,
        });
      });
  });
});
