import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, LaneOwnerGuard } from '../../common/auth/auth.guards';
import type {
  IngestLaneReadingsInput,
  TemperatureReadingInput,
  TemperatureResolution,
} from './cold-chain.types';
import { ColdChainService } from './cold-chain.service';
import type { LaneProduct } from '../lane/lane.types';

const TEMPERATURE_FILE_SIZE_LIMIT_BYTES = 2 * 1024 * 1024;

interface UploadedCsvFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

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

function parseDate(value: unknown, context: string): Date {
  const date = new Date(assertString(value, context));
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return date;
}

function parseTemperature(value: unknown, context: string): number {
  const numeric =
    typeof value === 'number' ? value : Number(assertString(value, context));
  if (!Number.isFinite(numeric)) {
    throw new BadRequestException(`Invalid ${context}.`);
  }

  return numeric;
}

function parseOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new BadRequestException('Invalid deviceId.');
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function parseProduct(value: string): LaneProduct {
  const normalized = value.trim().toUpperCase();
  if (!['MANGO', 'DURIAN', 'MANGOSTEEN', 'LONGAN'].includes(normalized)) {
    throw new BadRequestException('Unsupported product.');
  }

  return normalized as LaneProduct;
}

function parseResolution(value: unknown): TemperatureResolution | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = assertString(value, 'resolution').toLowerCase();
  if (!['raw', '5m', '15m', '1h'].includes(normalized)) {
    throw new BadRequestException('Invalid resolution.');
  }

  return normalized as TemperatureResolution;
}

function parseJsonIngestionBody(body: unknown): IngestLaneReadingsInput {
  const record = assertObject(body, 'temperature payload');
  const readings = record['readings'];
  if (!Array.isArray(readings) || readings.length === 0) {
    throw new BadRequestException(
      'At least one temperature reading is required.',
    );
  }

  return {
    readings: readings.map((entry, index) =>
      parseTemperatureReadingRecord(entry, `readings[${index}]`),
    ),
  };
}

function parseTemperatureReadingRecord(
  value: unknown,
  context: string,
): TemperatureReadingInput {
  const record = assertObject(value, context);
  const timestamp = parseDate(record['timestamp'], `${context}.timestamp`);
  const temperatureValue =
    record['temperatureC'] ?? record['temperature'] ?? record['value'];

  return {
    timestamp,
    temperatureC: parseTemperature(temperatureValue, `${context}.temperatureC`),
    deviceId: parseOptionalString(record['deviceId'] ?? record['device_id']),
  };
}

function parseCsvFile(file: UploadedCsvFile): IngestLaneReadingsInput {
  const content = file.buffer.toString('utf8').trim();
  if (content.length === 0) {
    throw new BadRequestException('CSV upload must not be empty.');
  }

  const [headerLine, ...rows] = content.split(/\r?\n/).filter(Boolean);
  if (rows.length === 0) {
    throw new BadRequestException('CSV upload must include at least one row.');
  }

  const headers = headerLine
    .split(',')
    .map((entry) => entry.trim().toLowerCase());
  const timestampIndex = headers.indexOf('timestamp');
  const temperatureIndex = headers.findIndex((header) =>
    ['temperaturec', 'temperature', 'value'].includes(header),
  );
  const deviceIdIndex = headers.findIndex((header) =>
    ['deviceid', 'device_id'].includes(header),
  );

  if (timestampIndex === -1 || temperatureIndex === -1) {
    throw new BadRequestException(
      'CSV upload must include timestamp and temperature columns.',
    );
  }

  return {
    readings: rows.map((row, index) => {
      const columns = row.split(',').map((entry) => entry.trim());
      return {
        timestamp: parseDate(
          columns[timestampIndex],
          `csv row ${index + 1} timestamp`,
        ),
        temperatureC: parseTemperature(
          columns[temperatureIndex],
          `csv row ${index + 1} temperature`,
        ),
        deviceId:
          deviceIdIndex === -1
            ? null
            : parseOptionalString(columns[deviceIdIndex]),
      };
    }),
  };
}

function createTemperatureUploadInterceptor() {
  return FileInterceptor('file', {
    limits: {
      fileSize: TEMPERATURE_FILE_SIZE_LIMIT_BYTES,
    },
  });
}

@Controller()
export class ColdChainController {
  constructor(private readonly coldChainService: ColdChainService) {}

  @Get('cold-chain/profiles')
  async listProfiles() {
    return {
      profiles: await this.coldChainService.listProfiles(),
    };
  }

  @Get('cold-chain/profiles/:product')
  async getProfile(@Param('product') product: string) {
    return {
      profile: await this.coldChainService.getProfile(parseProduct(product)),
    };
  }

  @Post('lanes/:id/temperature')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  @UseInterceptors(createTemperatureUploadInterceptor())
  async ingestLaneTemperature(
    @Param('id') laneId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: unknown,
  ) {
    const payload =
      file === undefined ? parseJsonIngestionBody(body) : parseCsvFile(file);
    return await this.coldChainService.ingestLaneReadings(laneId, payload);
  }

  @Get('lanes/:id/temperature')
  @UseGuards(JwtAuthGuard, LaneOwnerGuard)
  async getLaneTemperature(
    @Param('id') laneId: string,
    @Query() query: Record<string, unknown>,
  ) {
    return await this.coldChainService.listLaneTemperatureData(laneId, {
      from:
        query['from'] === undefined
          ? undefined
          : parseDate(query['from'], 'from'),
      to: query['to'] === undefined ? undefined : parseDate(query['to'], 'to'),
      resolution: parseResolution(query['resolution']),
    });
  }
}
