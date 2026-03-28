import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaColdChainStore } from './cold-chain.pg-store';

function requireDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim() || '';
  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set for DB-backed cold-chain tests.');
  }

  return databaseUrl;
}

const describeIfDatabase =
  (process.env['DATABASE_URL']?.trim() || '').length > 0
    ? describe
    : describe.skip;

describeIfDatabase('PrismaColdChainStore (db-backed)', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
    });
  });

  afterAll(async () => {
    if (pool !== undefined) {
      await pool.end();
    }
  });

  it('replaceExcursions persists the earliest critical SLA breach timestamp and keeps it sticky', async () => {
    const exporterId = `user-${randomUUID()}`;
    const laneId = `lane-${randomUUID()}`;
    const publicLaneId = `LN-TEST-${Date.now()}`;
    const store = new PrismaColdChainStore(pool as never);

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
          0,
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

    try {
      await expect(
        store.replaceExcursions(laneId, [
          {
            laneId,
            startedAt: new Date('2026-03-28T02:00:00.000Z'),
            endedAt: new Date('2026-03-28T02:30:00.000Z'),
            ongoing: false,
            durationMinutes: 30,
            severity: 'CRITICAL',
            direction: 'LOW',
            type: 'CHILLING',
            thresholdC: 10,
            minObservedC: 8,
            maxObservedC: 9,
            maxDeviationC: 2,
            shelfLifeImpactPercent: 100,
          },
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          laneId,
          severity: 'CRITICAL',
          type: 'CHILLING',
        }),
      ]);

      const firstBreach = await pool.query<{
        cold_chain_sla_breached_at: Date | string | null;
      }>(
        `
          SELECT cold_chain_sla_breached_at
          FROM lanes
          WHERE id = $1
        `,
        [laneId],
      );
      expect(firstBreach.rows[0]?.cold_chain_sla_breached_at).not.toBeNull();
      expect(
        new Date(
          firstBreach.rows[0]?.cold_chain_sla_breached_at as Date | string,
        ).toISOString(),
      ).toBe('2026-03-28T02:00:00.000Z');

      await store.replaceExcursions(laneId, [
        {
          laneId,
          startedAt: new Date('2026-03-28T04:00:00.000Z'),
          endedAt: new Date('2026-03-28T04:20:00.000Z'),
          ongoing: false,
          durationMinutes: 20,
          severity: 'CRITICAL',
          direction: 'HIGH',
          type: 'HEAT',
          thresholdC: 15,
          minObservedC: 16,
          maxObservedC: 18,
          maxDeviationC: 3,
          shelfLifeImpactPercent: 100,
        },
      ]);

      const stickyBreach = await pool.query<{
        cold_chain_sla_breached_at: Date | string | null;
      }>(
        `
          SELECT cold_chain_sla_breached_at
          FROM lanes
          WHERE id = $1
        `,
        [laneId],
      );
      expect(
        new Date(
          stickyBreach.rows[0]?.cold_chain_sla_breached_at as Date | string,
        ).toISOString(),
      ).toBe('2026-03-28T02:00:00.000Z');
    } finally {
      await pool.query(`DELETE FROM excursions WHERE lane_id = $1`, [laneId]);
      await pool.query(`DELETE FROM temperature_readings WHERE lane_id = $1`, [
        laneId,
      ]);
      await pool.query(`DELETE FROM lanes WHERE id = $1`, [laneId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [exporterId]);
    }
  });

  it('createTemperatureReadings writes live rows with generated ids', async () => {
    const exporterId = `user-${randomUUID()}`;
    const laneId = `lane-${randomUUID()}`;
    const publicLaneId = `LN-TEST-${Date.now()}-READINGS`;
    const store = new PrismaColdChainStore(pool as never);

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
          0,
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

    try {
      await store.createTemperatureReadings(laneId, [
        {
          timestamp: new Date('2026-03-28T01:00:00.000Z'),
          temperatureC: 11,
          deviceId: 'logger-1',
        },
        {
          timestamp: new Date('2026-03-28T01:05:00.000Z'),
          temperatureC: 9.5,
          deviceId: 'logger-1',
        },
      ]);

      const result = await pool.query<{
        id: string;
        recorded_at: Date | string;
        temperature_c: string;
      }>(
        `
          SELECT id, recorded_at, temperature_c::text
          FROM temperature_readings
          WHERE lane_id = $1
          ORDER BY recorded_at ASC
        `,
        [laneId],
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.id).toBeTruthy();
      expect(result.rows[0]?.recorded_at).toBeTruthy();
      expect(result.rows[0]?.temperature_c).toBe('11.00');
      expect(result.rows[1]?.temperature_c).toBe('9.50');
    } finally {
      await pool.query(`DELETE FROM temperature_readings WHERE lane_id = $1`, [
        laneId,
      ]);
      await pool.query(`DELETE FROM lanes WHERE id = $1`, [laneId]);
      await pool.query(`DELETE FROM users WHERE id = $1`, [exporterId]);
    }
  });
});
