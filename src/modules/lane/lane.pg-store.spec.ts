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
