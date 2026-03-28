import { PrismaAuthStore } from './auth.pg-store';

describe('PrismaAuthStore', () => {
  it('resolveLaneOwnerId accepts public lane ids', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('WHERE id = $1 OR lane_id = $1')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ exporter_id: 'user-1' }],
        });
      }

      return Promise.resolve({
        rowCount: 0,
        rows: [],
      });
    });
    const store = new PrismaAuthStore({ query } as never);

    await expect(store.resolveLaneOwnerId('LN-2026-001')).resolves.toBe(
      'user-1',
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 OR lane_id = $1'),
      ['LN-2026-001'],
    );
  });
});
