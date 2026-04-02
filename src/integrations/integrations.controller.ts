import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, LaneOwnerGuard } from '../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../common/auth/auth.types';
import { PartnerIntegrationsService } from './integrations.service';

function assertObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value as Record<string, unknown>;
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value.trim();
}

@Controller()
export class PartnerIntegrationsController {
  constructor(
    private readonly integrationsService: PartnerIntegrationsService,
  ) {}

  @Get('integrations/certifications/acfs/:certificateNumber')
  @UseGuards(JwtAuthGuard)
  async lookupAcfsCertificate(
    @Param('certificateNumber') certificateNumber: string,
  ) {
    return {
      lookup:
        await this.integrationsService.lookupAcfsCertificate(certificateNumber),
    };
  }

  @Post('lanes/:id/integrations/lab-results/:provider/import')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async importLabResults(
    @Param('id') laneId: string,
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const record = assertObject(body, 'lab import payload');
    return await this.integrationsService.importLabResults(
      provider,
      laneId,
      { reportId: assertString(record['reportId'], 'reportId') },
      request.user!,
    );
  }

  @Post('lanes/:id/integrations/temperature/:provider/import')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async importTemperatureData(
    @Param('id') laneId: string,
    @Param('provider') provider: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const record = assertObject(body, 'temperature import payload');
    return await this.integrationsService.importTemperatureData(
      provider,
      laneId,
      { shipmentId: assertString(record['shipmentId'], 'shipmentId') },
      request.user!,
    );
  }

  @Post('lanes/:id/integrations/certifications/acfs/import')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async importAcfsCertificate(
    @Param('id') laneId: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const record = assertObject(body, 'ACFS import payload');
    return await this.integrationsService.importAcfsCertificate(
      laneId,
      {
        certificateNumber: assertString(
          record['certificateNumber'],
          'certificateNumber',
        ),
      },
      request.user!,
    );
  }
}
