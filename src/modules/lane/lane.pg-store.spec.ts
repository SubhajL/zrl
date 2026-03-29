import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AuditAction } from '../../common/audit/audit.types';
import { LaneService } from './lane.service';
import { PrismaLaneStore } from './lane.pg-store';

describe('PrismaLaneStore', () => {
  it('findLaneById resolves public lane ids before hydrating the lane bundle', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (
          sql.includes('FROM lanes') &&
          sql.includes('WHERE id = $1 OR lane_id = $1')
        ) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: 'lane-db-1',
                lane_id: 'LN-2026-001',
                exporter_id: 'user-1',
                status: 'EVIDENCE_COLLECTING',
                product_type: 'MANGO',
                destination_market: 'JAPAN',
                completeness_score: '73',
                cold_chain_mode: null,
                cold_chain_device_id: null,
                cold_chain_data_frequency_seconds: null,
                status_changed_at: '2026-03-28T00:00:00.000Z',
                created_at: '2026-03-28T00:00:00.000Z',
                updated_at: '2026-03-28T00:00:00.000Z',
              },
            ],
          });
        }

        if (sql.includes('FROM batches')) {
          expect(values).toEqual(['lane-db-1']);
          return Promise.resolve({ rowCount: 0, rows: [] });
        }

        if (sql.includes('FROM routes')) {
          expect(values).toEqual(['lane-db-1']);
          return Promise.resolve({ rowCount: 0, rows: [] });
        }

        if (sql.includes('FROM checkpoints')) {
          expect(values).toEqual(['lane-db-1']);
          return Promise.resolve({ rowCount: 0, rows: [] });
        }

        if (sql.includes('FROM rule_snapshots')) {
          expect(values).toEqual(['lane-db-1']);
          return Promise.resolve({ rowCount: 0, rows: [] });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaLaneStore({ query } as never);

    await expect(store.findLaneById('LN-2026-001')).resolves.toMatchObject({
      id: 'lane-db-1',
      laneId: 'LN-2026-001',
      exporterId: 'user-1',
    });
  });

  it('findCheckpointsForLane resolves public lane ids before querying checkpoints', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (
          sql.includes('FROM lanes') &&
          sql.includes('WHERE id = $1 OR lane_id = $1')
        ) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: 'lane-db-1',
                lane_id: 'LN-2026-001',
                exporter_id: 'user-1',
                status: 'EVIDENCE_COLLECTING',
                product_type: 'MANGO',
                destination_market: 'JAPAN',
                completeness_score: '0',
                cold_chain_mode: null,
                cold_chain_device_id: null,
                cold_chain_data_frequency_seconds: null,
                status_changed_at: '2026-03-28T00:00:00.000Z',
                created_at: '2026-03-28T00:00:00.000Z',
                updated_at: '2026-03-28T00:00:00.000Z',
              },
            ],
          });
        }

        if (sql.includes('FROM checkpoints')) {
          expect(values).toEqual(['lane-db-1']);
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: 'cp-1',
                lane_id: 'lane-db-1',
                sequence: 1,
                location_name: 'Packing House',
                gps_lat: null,
                gps_lng: null,
                timestamp: null,
                temperature: null,
                signature_hash: null,
                signer_name: null,
                condition_notes: null,
                status: 'PENDING',
              },
            ],
          });
        }

        if (
          sql.includes('FROM batches') ||
          sql.includes('FROM routes') ||
          sql.includes('FROM rule_snapshots')
        ) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaLaneStore({ query } as never);

    await expect(store.findCheckpointsForLane('LN-2026-001')).resolves.toEqual([
      expect.objectContaining({
        id: 'cp-1',
        laneId: 'lane-db-1',
        sequence: 1,
      }),
    ]);
  });
});

function requireDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim() || '';
  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set for DB-backed lane tests.');
  }

  return databaseUrl;
}

const describeIfDatabase =
  (process.env['DATABASE_URL']?.trim() || '').length > 0
    ? describe
    : describe.skip;

describeIfDatabase('PrismaLaneStore (db-backed)', () => {
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

  it('serializes concurrent lane creation so generated public lane ids stay unique', async () => {
    const exporterId = `user-${randomUUID()}`;
    const store = new PrismaLaneStore(pool as never);
    const service = new LaneService(
      store,
      {
        hashString: jest
          .fn()
          .mockResolvedValue(
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          ),
      } as never,
      {
        createEntry: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        resolve: jest.fn().mockResolvedValue({
          market: 'JAPAN',
          product: 'MANGO',
          version: 1,
          effectiveDate: new Date('2026-03-01T00:00:00.000Z'),
          rules: {
            sourcePath: 'rules/japan/mango.yaml',
            requiredDocuments: ['Phytosanitary Certificate'],
            completenessWeights: {
              regulatory: 0.4,
              quality: 0.25,
              coldChain: 0.2,
              chainOfCustody: 0.15,
            },
            substances: [],
          },
        }),
      } as never,
      {
        validateLaneConfiguration: jest.fn().mockReturnValue({
          mode: 'LOGGER',
          deviceId: 'logger-test',
          dataFrequencySeconds: 300,
        }),
      } as never,
      {} as never,
      {} as never,
      {
        publishLaneStatusChanged: jest.fn().mockResolvedValue(undefined),
        publishCheckpointRecorded: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

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

    const createInput = {
      product: 'MANGO',
      batch: {
        variety: 'Nam Doc Mai',
        quantityKg: 5000,
        originProvince: 'Chachoengsao',
        harvestDate: new Date('2026-03-29T00:00:00.000Z'),
        grade: 'A',
      },
      destination: {
        market: 'JAPAN',
      },
      route: {
        transportMode: 'AIR',
        carrier: 'Thai Airways Cargo',
        estimatedTransitHours: 8,
      },
      coldChainConfig: {
        mode: 'LOGGER',
        deviceId: 'logger-test',
        dataFrequencySeconds: 300,
      },
    } as const;
    const actor = {
      id: exporterId,
      role: 'EXPORTER',
      email: `${exporterId}@example.com`,
      companyName: 'Exporter Co',
      mfaEnabled: false,
      sessionVersion: 0,
    } as const;

    let createdLaneIds: string[] = [];

    try {
      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () => service.create(createInput, actor)),
      );
      const rejected = settled.find((entry) => entry.status === 'rejected');
      if (rejected !== undefined && rejected.status === 'rejected') {
        throw rejected.reason;
      }
      const created = settled
        .filter((entry) => entry.status === 'fulfilled')
        .map((entry) => entry.value);

      createdLaneIds = created.map((entry) => entry.lane.id);
      const publicLaneIds = created.map((entry) => entry.lane.laneId);

      expect(new Set(publicLaneIds).size).toBe(5);
      expect(publicLaneIds).toHaveLength(5);
      expect(
        created.every((entry) => entry.lane.status === 'EVIDENCE_COLLECTING'),
      ).toBe(true);
    } finally {
      if (createdLaneIds.length > 0) {
        await pool.query(
          'DELETE FROM rule_snapshots WHERE lane_id = ANY($1::text[])',
          [createdLaneIds],
        );
        await pool.query('DELETE FROM routes WHERE lane_id = ANY($1::text[])', [
          createdLaneIds,
        ]);
        await pool.query(
          'DELETE FROM batches WHERE lane_id = ANY($1::text[])',
          [createdLaneIds],
        );
        await pool.query('DELETE FROM lanes WHERE id = ANY($1::text[])', [
          createdLaneIds,
        ]);
      }

      await pool.query(
        `
          DELETE FROM audit_entries
          WHERE actor = $1
            AND action = $2
        `,
        [exporterId, AuditAction.CREATE],
      );
      await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
    }
  });
});
