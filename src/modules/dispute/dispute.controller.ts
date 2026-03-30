import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, LaneOwnerGuard } from '../../common/auth/auth.guards';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { DisputeService } from './dispute.service';
import type { DisputeStatus, DisputeType } from './dispute.types';

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

function parseOptionalNumber(
  value: unknown,
  context: string,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return numeric;
}

const VALID_DISPUTE_TYPES: readonly DisputeType[] = [
  'CUSTOMS_REJECTION',
  'QUALITY_CLAIM',
  'INSURANCE_CLAIM',
  'GRADE_DISPUTE',
  'CARGO_DAMAGE',
];

const VALID_DISPUTE_STATUSES: readonly DisputeStatus[] = [
  'OPEN',
  'INVESTIGATING',
  'DEFENSE_SUBMITTED',
  'RESOLVED',
];

function parseDisputeType(value: unknown): DisputeType {
  const normalized = assertString(value, 'type').toUpperCase();
  if (!VALID_DISPUTE_TYPES.includes(normalized as DisputeType)) {
    throw new BadRequestException(
      'Invalid dispute type. Must be one of: CUSTOMS_REJECTION, QUALITY_CLAIM, INSURANCE_CLAIM, GRADE_DISPUTE, CARGO_DAMAGE.',
    );
  }

  return normalized as DisputeType;
}

function parseDisputeStatus(value: unknown): DisputeStatus {
  const normalized = assertString(value, 'status').toUpperCase();
  if (!VALID_DISPUTE_STATUSES.includes(normalized as DisputeStatus)) {
    throw new BadRequestException(
      'Invalid dispute status. Must be one of: OPEN, INVESTIGATING, DEFENSE_SUBMITTED, RESOLVED.',
    );
  }

  return normalized as DisputeStatus;
}

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post('lanes/:id/disputes')
  @UseGuards(LaneOwnerGuard)
  async createDispute(
    @Param('id') laneId: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const payload = assertObject(body, 'dispute payload');
    const dispute = await this.disputeService.createDispute(
      laneId,
      {
        type: parseDisputeType(payload['type']),
        description: assertString(payload['description'], 'description'),
        claimant: assertString(payload['claimant'], 'claimant'),
        financialImpact: parseOptionalNumber(
          payload['financialImpact'],
          'financialImpact',
        ),
      },
      request.user!,
    );

    return { dispute };
  }

  @Get('disputes/:disputeId')
  async getDispute(
    @Param('disputeId') id: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    const dispute = await this.disputeService.getDispute(id, request.user);
    return { dispute };
  }

  @Get('lanes/:id/disputes')
  @UseGuards(LaneOwnerGuard)
  async listDisputesForLane(@Param('id') laneId: string) {
    const disputes = await this.disputeService.listDisputesForLane(laneId);
    return { disputes };
  }

  @Post('disputes/:disputeId/defense-pack')
  async generateDefensePack(
    @Param('disputeId') id: string,
    @Req() request: AuthPrincipalRequest,
  ) {
    const dispute = await this.disputeService.generateDefensePack(
      id,
      request.user!,
    );

    return { dispute };
  }

  @Patch('disputes/:disputeId')
  async updateDispute(
    @Param('disputeId') id: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const payload = assertObject(body, 'update payload');
    const dispute = await this.disputeService.updateDispute(
      id,
      {
        status:
          payload['status'] !== undefined
            ? parseDisputeStatus(payload['status'])
            : undefined,
        resolutionNotes:
          payload['resolutionNotes'] !== undefined
            ? assertString(payload['resolutionNotes'], 'resolutionNotes')
            : undefined,
      },
      request.user!,
    );

    return { dispute };
  }
}
