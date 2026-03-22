import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { JwtAuthGuard, LaneOwnerGuard } from '../../common/auth/auth.guards';
import { LaneService } from './lane.service';
import type {
  CreateLaneInput,
  LaneListQuery,
  LaneMarket,
  LaneProduct,
  LaneStatus,
  LaneTransportMode,
  UpdateLaneInput,
} from './lane.types';

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

function assertOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Expected string.');
  }

  const normalized = value.trim();
  return normalized.length === 0 ? undefined : normalized;
}

function assertNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return value;
}

function assertOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException('Expected numeric value.');
  }

  return value;
}

function parseDate(value: unknown, context: string): Date {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return parsed;
}

function parseTransportMode(value: unknown): LaneTransportMode {
  const normalized = assertString(value, 'route.transportMode').toUpperCase();
  if (!['AIR', 'SEA', 'TRUCK'].includes(normalized)) {
    throw new BadRequestException('Unsupported transport mode.');
  }

  return normalized as LaneTransportMode;
}

function parseMarket(value: unknown): LaneMarket {
  const normalized = assertString(value, 'destination.market').toUpperCase();
  if (!['JAPAN', 'CHINA', 'KOREA', 'EU'].includes(normalized)) {
    throw new BadRequestException('Unsupported destination market.');
  }

  return normalized as LaneMarket;
}

function parseProduct(value: unknown): LaneProduct {
  const normalized = assertString(value, 'product').toUpperCase();
  if (!['MANGO', 'DURIAN', 'MANGOSTEEN', 'LONGAN'].includes(normalized)) {
    throw new BadRequestException('Unsupported product.');
  }

  return normalized as LaneProduct;
}

function parseStatus(value: unknown): LaneStatus {
  const normalized = assertString(value, 'status').toUpperCase();
  if (
    ![
      'CREATED',
      'EVIDENCE_COLLECTING',
      'VALIDATED',
      'PACKED',
      'CLOSED',
      'INCOMPLETE',
      'CLAIM_DEFENSE',
      'DISPUTE_RESOLVED',
      'ARCHIVED',
    ].includes(normalized)
  ) {
    throw new BadRequestException('Unsupported lane status.');
  }

  return normalized as LaneStatus;
}

function parseGpsPoint(value: unknown, context: string) {
  const record = assertObject(value, context);
  return {
    lat: assertNumber(record['lat'], `${context}.lat`),
    lng: assertNumber(record['lng'], `${context}.lng`),
  };
}

function parseCreateLaneInput(body: unknown): CreateLaneInput {
  const record = assertObject(body, 'lane payload');
  const batch = assertObject(record['batch'], 'batch');
  const destination = assertObject(record['destination'], 'destination');
  const route = assertObject(record['route'], 'route');

  return {
    product: parseProduct(record['product']),
    batch: {
      variety: assertOptionalString(batch['variety']),
      quantityKg: assertNumber(batch['quantityKg'], 'batch.quantityKg'),
      originProvince: assertString(
        batch['originProvince'],
        'batch.originProvince',
      ),
      harvestDate: parseDate(batch['harvestDate'], 'batch.harvestDate'),
      grade: assertString(batch['grade'], 'batch.grade').toUpperCase() as
        | 'PREMIUM'
        | 'A'
        | 'B',
    },
    destination: {
      market: parseMarket(destination['market']),
    },
    route: {
      transportMode: parseTransportMode(route['transportMode']),
      carrier: assertOptionalString(route['carrier']),
      originGps:
        route['originGps'] === undefined
          ? undefined
          : parseGpsPoint(route['originGps'], 'route.originGps'),
      destinationGps:
        route['destinationGps'] === undefined
          ? undefined
          : parseGpsPoint(route['destinationGps'], 'route.destinationGps'),
      estimatedTransitHours: assertOptionalNumber(
        route['estimatedTransitHours'],
      ),
    },
  };
}

function parseUpdateLaneInput(body: unknown): UpdateLaneInput {
  const record = assertObject(body, 'lane update payload');
  const result: UpdateLaneInput = {};

  if (record['batch'] !== undefined) {
    const batch = assertObject(record['batch'], 'batch');
    result.batch = {
      variety: assertOptionalString(batch['variety']),
      quantityKg: assertOptionalNumber(batch['quantityKg']),
      originProvince: assertOptionalString(batch['originProvince']),
      harvestDate:
        batch['harvestDate'] === undefined
          ? undefined
          : parseDate(batch['harvestDate'], 'batch.harvestDate'),
      grade:
        batch['grade'] === undefined
          ? undefined
          : (assertString(batch['grade'], 'batch.grade').toUpperCase() as
              | 'PREMIUM'
              | 'A'
              | 'B'),
    };
  }

  if (record['route'] !== undefined) {
    const route = assertObject(record['route'], 'route');
    result.route = {
      transportMode:
        route['transportMode'] === undefined
          ? undefined
          : parseTransportMode(route['transportMode']),
      carrier: assertOptionalString(route['carrier']),
      originGps:
        route['originGps'] === undefined
          ? undefined
          : parseGpsPoint(route['originGps'], 'route.originGps'),
      destinationGps:
        route['destinationGps'] === undefined
          ? undefined
          : parseGpsPoint(route['destinationGps'], 'route.destinationGps'),
      estimatedTransitHours: assertOptionalNumber(
        route['estimatedTransitHours'],
      ),
    };
  }

  return result;
}

function parseListQuery(query: Record<string, unknown>): LaneListQuery {
  const parsed: LaneListQuery = {};

  if (query['page'] !== undefined) {
    const page = Number(query['page']);
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Invalid page.');
    }
    parsed.page = page;
  }

  if (query['limit'] !== undefined) {
    const limit = Number(query['limit']);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Invalid limit.');
    }
    parsed.limit = limit;
  }

  if (query['status'] !== undefined) {
    parsed.status = parseStatus(query['status']);
  }

  if (query['product'] !== undefined) {
    parsed.product = parseProduct(query['product']);
  }

  if (query['market'] !== undefined) {
    parsed.market = parseMarket(query['market']);
  }

  return parsed;
}

@Controller('lanes')
@UseGuards(JwtAuthGuard)
export class LaneController {
  constructor(private readonly laneService: LaneService) {}

  @Post()
  async create(@Body() body: unknown, @Req() request: AuthPrincipalRequest) {
    return await this.laneService.create(
      parseCreateLaneInput(body),
      request.user!,
    );
  }

  @Get()
  async findAll(
    @Query() query: Record<string, unknown>,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.laneService.findAll(parseListQuery(query), request.user!);
  }

  @Get(':id')
  @UseGuards(LaneOwnerGuard)
  async findById(@Param('id') id: string) {
    return await this.laneService.findById(id);
  }

  @Patch(':id')
  @UseGuards(LaneOwnerGuard)
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.laneService.update(
      id,
      parseUpdateLaneInput(body),
      request.user!,
    );
  }

  @Get(':id/completeness')
  @UseGuards(LaneOwnerGuard)
  async getCompleteness(@Param('id') id: string) {
    return await this.laneService.getCompleteness(id);
  }
}
