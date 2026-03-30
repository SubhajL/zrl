import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  JwtAuthGuard,
  LaneOwnerGuard,
  RolesGuard,
} from '../../common/auth/auth.guards';
import { Roles } from '../../common/auth/auth.decorators';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { MrvLiteService } from './mrv-lite.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class MrvLiteController {
  constructor(private readonly mrvLiteService: MrvLiteService) {}

  @Get('lanes/:id/esg')
  @UseGuards(LaneOwnerGuard)
  async getLaneEsg(@Param('id') laneId: string) {
    return await this.mrvLiteService.getLaneEsgCard(laneId);
  }

  @Get('esg/exporter/:exporterId')
  async getExporterEsg(
    @Param('exporterId') exporterId: string,
    @Query() query: Record<string, string | undefined>,
    @Req() request: AuthPrincipalRequest,
  ) {
    const user = request.user!;
    if (user.role === 'EXPORTER' && user.id !== exporterId) {
      throw new ForbiddenException('Exporter ESG access denied.');
    }

    const quarter = Math.max(1, Math.min(4, Number(query['quarter']) || 1));
    const year = Number(query['year']) || new Date().getFullYear();
    return await this.mrvLiteService.getExporterReport(
      exporterId,
      quarter,
      year,
    );
  }

  @Get('esg/platform')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getPlatformEsg(@Query() query: Record<string, string | undefined>) {
    const year = Number(query['year']) || new Date().getFullYear();
    return await this.mrvLiteService.getPlatformReport(year);
  }

  @Get('esg/carbon/factors')
  getEmissionFactors() {
    return { factors: this.mrvLiteService.getEmissionFactors() };
  }
}
