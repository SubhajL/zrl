import { PrismaAuditStore } from './audit.prisma-store';

describe('PrismaAuditStore', () => {
  it('findEntriesForLane matches lanes addressed by public lane id', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (
        sql.includes('lanes.lane_id = $1') ||
        sql.includes(
          'lane_id = (SELECT id FROM lanes WHERE id = $1 OR lane_id = $1 LIMIT 1)',
        )
      ) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: 'audit-1',
              timestamp: '2026-03-28T00:00:00.000Z',
              actor: 'user-1',
              action: 'VERIFY',
              entity_type: 'LANE',
              entity_id: 'lane-db-1',
              payload_hash: 'hash',
              payload_snapshot: null,
              prev_hash: 'prev',
              entry_hash: 'entry',
            },
          ],
        });
      }

      return Promise.resolve({
        rowCount: 0,
        rows: [],
      });
    });
    const store = new PrismaAuditStore({ query } as never);

    await expect(store.findEntriesForLane('LN-2026-001')).resolves.toHaveLength(
      1,
    );
  });
});
