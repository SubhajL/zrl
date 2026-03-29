import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview(
    @Query() query: Record<string, string | undefined>,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.analyticsService.getOverview(
      { from: query['from'], to: query['to'] },
      request.user!,
    );
  }

  @Get('rejection-trend')
  async getRejectionTrend(
    @Query() query: Record<string, string | undefined>,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.analyticsService.getRejectionTrend(
      {
        product: query['product'],
        market: query['market'],
        granularity: query['granularity'],
      },
      request.user!,
    );
  }

  @Get('completeness-distribution')
  async getCompletenessDistribution(@Req() request: AuthPrincipalRequest) {
    return await this.analyticsService.getCompletenessDistribution(
      request.user!,
    );
  }

  @Get('excursion-heatmap')
  async getExcursionHeatmap(@Req() request: AuthPrincipalRequest) {
    return await this.analyticsService.getExcursionHeatmap(request.user!);
  }

  @Get('exporter-leaderboard')
  async getExporterLeaderboard(
    @Query() query: Record<string, string | undefined>,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.analyticsService.getExporterLeaderboard(
      { sort: query['sort'], limit: query['limit'] },
      request.user!,
    );
  }
}
