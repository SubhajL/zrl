import { AnalyticsService, ANALYTICS_STORE } from './analytics.service';
import type { AnalyticsStore } from './analytics.types';

function createMockStore(): jest.Mocked<AnalyticsStore> {
  return {
    getOverview: jest.fn().mockResolvedValue({
      totalLanes: 5,
      avgCompleteness: 80,
      readyToShip: 3,
      coldChainCount: 4,
      marketsServed: 2,
      productsCovered: 2,
    }),
    getRejectionTrend: jest.fn().mockResolvedValue([]),
    getCompletenessDistribution: jest.fn().mockResolvedValue([]),
    getExcursionHeatmap: jest.fn().mockResolvedValue([]),
    getExporterLeaderboard: jest.fn().mockResolvedValue([]),
  };
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let store: jest.Mocked<AnalyticsStore>;

  beforeEach(() => {
    store = createMockStore();
    service = new AnalyticsService(store);
  });

  describe('ANALYTICS_STORE token', () => {
    it('exports a Symbol token', () => {
      expect(typeof ANALYTICS_STORE).toBe('symbol');
    });
  });

  describe('getOverview', () => {
    it('passes exporterId for EXPORTER role', async () => {
      await service.getOverview({}, { id: 'user-1', role: 'EXPORTER' });
      const filters = store.getOverview.mock.calls[0][0];
      expect(filters.exporterId).toBe('user-1');
    });

    it('passes exporterId for PARTNER role', async () => {
      await service.getOverview({}, { id: 'partner-1', role: 'PARTNER' });
      const filters = store.getOverview.mock.calls[0][0];
      expect(filters.exporterId).toBe('partner-1');
    });

    it('omits exporterId for ADMIN role', async () => {
      await service.getOverview({}, { id: 'admin-1', role: 'ADMIN' });
      const filters = store.getOverview.mock.calls[0][0];
      expect(filters).not.toHaveProperty('exporterId');
    });

    it('omits exporterId for AUDITOR role', async () => {
      await service.getOverview({}, { id: 'auditor-1', role: 'AUDITOR' });
      const filters = store.getOverview.mock.calls[0][0];
      expect(filters).not.toHaveProperty('exporterId');
    });

    it('parses from/to date strings', async () => {
      await service.getOverview(
        { from: '2026-01-01', to: '2026-12-31' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getOverview.mock.calls[0][0];
      expect(filters.from).toEqual(new Date('2026-01-01'));
      expect(filters.to).toEqual(new Date('2026-12-31'));
    });

    it('returns kpis wrapper', async () => {
      const result = await service.getOverview(
        {},
        { id: 'admin-1', role: 'ADMIN' },
      );
      expect(result.kpis.totalLanes).toBe(5);
    });

    it('throws BadRequestException for invalid from date', async () => {
      await expect(
        service.getOverview(
          { from: 'not-a-date' },
          { id: 'admin-1', role: 'ADMIN' },
        ),
      ).rejects.toThrow('Invalid from date: not-a-date');
    });

    it('throws BadRequestException for invalid to date', async () => {
      await expect(
        service.getOverview(
          { to: 'garbage' },
          { id: 'admin-1', role: 'ADMIN' },
        ),
      ).rejects.toThrow('Invalid to date: garbage');
    });
  });

  describe('getRejectionTrend', () => {
    it('ignores invalid granularity', async () => {
      await service.getRejectionTrend(
        { granularity: 'invalid' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getRejectionTrend.mock.calls[0][0];
      expect(filters).not.toHaveProperty('granularity');
    });

    it('passes valid granularity', async () => {
      await service.getRejectionTrend(
        { granularity: 'week' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getRejectionTrend.mock.calls[0][0];
      expect(filters.granularity).toBe('week');
    });

    it('passes product and market filters', async () => {
      await service.getRejectionTrend(
        { product: 'MANGO', market: 'JAPAN' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getRejectionTrend.mock.calls[0][0];
      expect(filters.product).toBe('MANGO');
      expect(filters.market).toBe('JAPAN');
    });

    it('scopes by exporter role', async () => {
      await service.getRejectionTrend({}, { id: 'user-1', role: 'EXPORTER' });
      const filters = store.getRejectionTrend.mock.calls[0][0];
      expect(filters.exporterId).toBe('user-1');
    });

    it('returns datapoints wrapper', async () => {
      const result = await service.getRejectionTrend(
        {},
        { id: 'admin-1', role: 'ADMIN' },
      );
      expect(result).toEqual({ datapoints: [] });
    });
  });

  describe('getCompletenessDistribution', () => {
    it('scopes by exporter role', async () => {
      await service.getCompletenessDistribution({
        id: 'user-1',
        role: 'EXPORTER',
      });
      const filters = store.getCompletenessDistribution.mock.calls[0][0];
      expect(filters.exporterId).toBe('user-1');
    });

    it('omits exporterId for ADMIN role', async () => {
      await service.getCompletenessDistribution({
        id: 'admin-1',
        role: 'ADMIN',
      });
      const filters = store.getCompletenessDistribution.mock.calls[0][0];
      expect(filters).not.toHaveProperty('exporterId');
    });

    it('returns brackets wrapper', async () => {
      const result = await service.getCompletenessDistribution({
        id: 'admin-1',
        role: 'ADMIN',
      });
      expect(result).toEqual({ brackets: [] });
    });
  });

  describe('getExcursionHeatmap', () => {
    it('scopes by exporter role', async () => {
      await service.getExcursionHeatmap({
        id: 'user-1',
        role: 'EXPORTER',
      });
      const filters = store.getExcursionHeatmap.mock.calls[0][0];
      expect(filters.exporterId).toBe('user-1');
    });

    it('omits exporterId for ADMIN role', async () => {
      await service.getExcursionHeatmap({
        id: 'admin-1',
        role: 'ADMIN',
      });
      const filters = store.getExcursionHeatmap.mock.calls[0][0];
      expect(filters).not.toHaveProperty('exporterId');
    });

    it('returns matrix wrapper', async () => {
      const result = await service.getExcursionHeatmap({
        id: 'admin-1',
        role: 'ADMIN',
      });
      expect(result).toEqual({ matrix: [] });
    });
  });

  describe('getExporterLeaderboard', () => {
    it('clamps limit to MAX_LEADERBOARD_LIMIT', async () => {
      await service.getExporterLeaderboard(
        { limit: '200' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters.limit).toBe(100);
    });

    it('passes valid limit', async () => {
      await service.getExporterLeaderboard(
        { limit: '25' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters.limit).toBe(25);
    });

    it('ignores invalid sort field', async () => {
      await service.getExporterLeaderboard(
        { sort: 'invalid' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters).not.toHaveProperty('sort');
    });

    it('passes valid sort field', async () => {
      await service.getExporterLeaderboard(
        { sort: 'laneCount' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters.sort).toBe('laneCount');
    });

    it('scopes by exporter role', async () => {
      await service.getExporterLeaderboard(
        {},
        { id: 'user-1', role: 'EXPORTER' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters.exporterId).toBe('user-1');
    });

    it('ignores non-numeric limit', async () => {
      await service.getExporterLeaderboard(
        { limit: 'abc' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters).not.toHaveProperty('limit');
    });

    it('ignores zero or negative limit', async () => {
      await service.getExporterLeaderboard(
        { limit: '0' },
        { id: 'admin-1', role: 'ADMIN' },
      );
      const filters = store.getExporterLeaderboard.mock.calls[0][0];
      expect(filters).not.toHaveProperty('limit');
    });

    it('returns exporters wrapper', async () => {
      const result = await service.getExporterLeaderboard(
        {},
        { id: 'admin-1', role: 'ADMIN' },
      );
      expect(result).toEqual({ exporters: [] });
    });
  });
});
