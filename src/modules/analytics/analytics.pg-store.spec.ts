import { PrismaAnalyticsStore } from './analytics.pg-store';

describe('PrismaAnalyticsStore', () => {
  it('getOverview returns KPI counts from aggregation query', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM lanes')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              total_lanes: 12,
              avg_completeness: 73,
              ready_to_ship: 4,
              cold_chain_count: 8,
              markets_served: 3,
              products_covered: 2,
            },
          ],
        });
      }

      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getOverview({});

    expect(result).toEqual({
      totalLanes: 12,
      avgCompleteness: 73,
      readyToShip: 4,
      coldChainCount: 8,
      marketsServed: 3,
      productsCovered: 2,
    });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('getOverview returns zeroes when no lanes exist', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM lanes')) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              total_lanes: 0,
              avg_completeness: 0,
              ready_to_ship: 0,
              cold_chain_count: 0,
              markets_served: 0,
              products_covered: 0,
            },
          ],
        });
      }

      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getOverview({});

    expect(result).toEqual({
      totalLanes: 0,
      avgCompleteness: 0,
      readyToShip: 0,
      coldChainCount: 0,
      marketsServed: 0,
      productsCovered: 0,
    });
  });

  it('getOverview scopes by exporterId when provided', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (sql.includes('FROM lanes')) {
          expect(sql).toContain('exporter_id = $');
          expect(values).toContain('user-42');
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                total_lanes: 5,
                avg_completeness: 80,
                ready_to_ship: 2,
                cold_chain_count: 3,
                markets_served: 1,
                products_covered: 1,
              },
            ],
          });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getOverview({ exporterId: 'user-42' });

    expect(result.totalLanes).toBe(5);
  });

  it('getOverview filters by date range', async () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-03-31T23:59:59.999Z');
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (sql.includes('FROM lanes')) {
          expect(sql).toContain('created_at >= $');
          expect(sql).toContain('created_at <= $');
          expect(values).toContain(from);
          expect(values).toContain(to);
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                total_lanes: 3,
                avg_completeness: 60,
                ready_to_ship: 1,
                cold_chain_count: 2,
                markets_served: 2,
                products_covered: 1,
              },
            ],
          });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getOverview({ from, to });

    expect(result.totalLanes).toBe(3);
  });

  it('getRejectionTrend groups by specified granularity', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (sql.includes('date_trunc')) {
          expect(values).toContain('week');
          return Promise.resolve({
            rowCount: 2,
            rows: [
              {
                period: '2026-03-03 00:00:00',
                rejection_count: 2,
                total_count: 10,
              },
              {
                period: '2026-03-10 00:00:00',
                rejection_count: 1,
                total_count: 8,
              },
            ],
          });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getRejectionTrend({ granularity: 'week' });

    expect(result).toHaveLength(2);
    expect(result[0].period).toBe('2026-03-03 00:00:00');
    expect(result[0].rejectionCount).toBe(2);
    expect(result[0].totalCount).toBe(10);
  });

  it('getRejectionTrend computes rejection rate', async () => {
    const query = jest.fn().mockImplementation(() =>
      Promise.resolve({
        rowCount: 1,
        rows: [
          {
            period: '2026-03-01 00:00:00',
            rejection_count: 3,
            total_count: 12,
          },
        ],
      }),
    );
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getRejectionTrend({});

    expect(result[0].rejectionRate).toBe(25);
  });

  it('getCompletenessDistribution returns 4 brackets with percentages', async () => {
    const query = jest.fn().mockImplementation(() =>
      Promise.resolve({
        rowCount: 4,
        rows: [
          { label: '0-25%', count: 2 },
          { label: '25-50%', count: 3 },
          { label: '50-75%', count: 5 },
          { label: '75-100%', count: 10 },
        ],
      }),
    );
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getCompletenessDistribution({});

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ label: '0-25%', count: 2, percentage: 10 });
    expect(result[1]).toEqual({ label: '25-50%', count: 3, percentage: 15 });
    expect(result[2]).toEqual({ label: '50-75%', count: 5, percentage: 25 });
    expect(result[3]).toEqual({ label: '75-100%', count: 10, percentage: 50 });
  });

  it('getExcursionHeatmap returns segment x severity cells', async () => {
    const query = jest.fn().mockImplementation(() =>
      Promise.resolve({
        rowCount: 2,
        rows: [
          { segment: 'MANGO', severity: 'MINOR', count: 5 },
          { segment: 'DURIAN', severity: 'SEVERE', count: 2 },
        ],
      }),
    );
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getExcursionHeatmap({});

    expect(result).toEqual([
      { segment: 'MANGO', severity: 'MINOR', count: 5 },
      { segment: 'DURIAN', severity: 'SEVERE', count: 2 },
    ]);
  });

  it('getExporterLeaderboard returns sorted entries with limit', async () => {
    const query = jest
      .fn()
      .mockImplementation((sql: string, values?: unknown[]) => {
        if (sql.includes('FROM lanes')) {
          expect(sql).toContain('LIMIT $');
          expect(values).toContain(5);
          return Promise.resolve({
            rowCount: 2,
            rows: [
              {
                exporter_id: 'user-1',
                company_name: 'Fruit Co',
                lane_count: 10,
                avg_completeness: 90,
                ready_to_ship_count: 6,
              },
              {
                exporter_id: 'user-2',
                company_name: null,
                lane_count: 5,
                avg_completeness: 70,
                ready_to_ship_count: 2,
              },
            ],
          });
        }

        return Promise.resolve({ rowCount: 0, rows: [] });
      });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getExporterLeaderboard({
      sort: 'laneCount',
      limit: 5,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      exporterId: 'user-1',
      companyName: 'Fruit Co',
      laneCount: 10,
      avgCompleteness: 90,
      readyToShipCount: 6,
    });
    expect(result[1].companyName).toBeNull();
  });

  it('getExporterLeaderboard defaults sort to avgCompleteness', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM lanes')) {
        expect(sql).toContain('ORDER BY avg_completeness DESC');
        return Promise.resolve({
          rowCount: 0,
          rows: [],
        });
      }

      return Promise.resolve({ rowCount: 0, rows: [] });
    });
    const store = new PrismaAnalyticsStore({ query } as never);

    const result = await store.getExporterLeaderboard({});

    expect(result).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
