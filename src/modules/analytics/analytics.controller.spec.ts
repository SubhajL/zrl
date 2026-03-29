import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';

function createMockService(): jest.Mocked<
  Pick<
    AnalyticsService,
    | 'getOverview'
    | 'getRejectionTrend'
    | 'getCompletenessDistribution'
    | 'getExcursionHeatmap'
    | 'getExporterLeaderboard'
  >
> {
  return {
    getOverview: jest.fn().mockResolvedValue({ kpis: { totalLanes: 5 } }),
    getRejectionTrend: jest.fn().mockResolvedValue({ datapoints: [] }),
    getCompletenessDistribution: jest.fn().mockResolvedValue({ brackets: [] }),
    getExcursionHeatmap: jest.fn().mockResolvedValue({ matrix: [] }),
    getExporterLeaderboard: jest.fn().mockResolvedValue({ exporters: [] }),
  };
}

function createMockRequest(
  overrides: Partial<AuthPrincipalRequest> = {},
): AuthPrincipalRequest {
  return {
    headers: {},
    method: 'GET',
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMIN',
      companyName: null,
      mfaEnabled: false,
      sessionVersion: 0,
    },
    ...overrides,
  } as AuthPrincipalRequest;
}

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    controller = new AnalyticsController(
      service as unknown as AnalyticsService,
    );
  });

  describe('getOverview', () => {
    it('delegates to service with query and user', async () => {
      const request = createMockRequest();
      const result = await controller.getOverview(
        { from: '2026-01-01', to: '2026-12-31' },
        request,
      );

      expect(service.getOverview).toHaveBeenCalledWith(
        { from: '2026-01-01', to: '2026-12-31' },
        request.user,
      );
      expect(result).toEqual({ kpis: { totalLanes: 5 } });
    });
  });

  describe('getRejectionTrend', () => {
    it('delegates to service with query and user', async () => {
      const request = createMockRequest();
      const result = await controller.getRejectionTrend(
        { product: 'MANGO', market: 'JAPAN', granularity: 'week' },
        request,
      );

      expect(service.getRejectionTrend).toHaveBeenCalledWith(
        { product: 'MANGO', market: 'JAPAN', granularity: 'week' },
        request.user,
      );
      expect(result).toEqual({ datapoints: [] });
    });
  });

  describe('getCompletenessDistribution', () => {
    it('delegates to service with user', async () => {
      const request = createMockRequest();
      const result = await controller.getCompletenessDistribution(request);

      expect(service.getCompletenessDistribution).toHaveBeenCalledWith(
        request.user,
      );
      expect(result).toEqual({ brackets: [] });
    });
  });

  describe('getExcursionHeatmap', () => {
    it('delegates to service with user', async () => {
      const request = createMockRequest();
      const result = await controller.getExcursionHeatmap(request);

      expect(service.getExcursionHeatmap).toHaveBeenCalledWith(request.user);
      expect(result).toEqual({ matrix: [] });
    });
  });

  describe('getExporterLeaderboard', () => {
    it('delegates to service with query and user', async () => {
      const request = createMockRequest();
      const result = await controller.getExporterLeaderboard(
        { sort: 'laneCount', limit: '10' },
        request,
      );

      expect(service.getExporterLeaderboard).toHaveBeenCalledWith(
        { sort: 'laneCount', limit: '10' },
        request.user,
      );
      expect(result).toEqual({ exporters: [] });
    });
  });
});
