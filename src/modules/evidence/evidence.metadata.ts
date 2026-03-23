import { BadRequestException } from '@nestjs/common';
import * as exifr from 'exifr';
import type {
  EvidencePhotoMetadataExtractor,
  ExtractedPhotoMetadata,
} from './evidence.types';

interface ExifMetadata {
  latitude?: number;
  longitude?: number;
  DateTimeOriginal?: Date | string;
  Model?: string;
  Make?: string;
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatTimestamp(value: Date | string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const timestamp = value instanceof Date ? value : new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? undefined
    : timestamp.toISOString();
}

function buildCameraModel(metadata: ExifMetadata): string | undefined {
  const make = metadata.Make?.trim();
  const model = metadata.Model?.trim();

  if (make !== undefined && model !== undefined && make.length > 0) {
    return `${make} ${model}`.trim();
  }

  return model !== undefined && model.length > 0 ? model : undefined;
}

function validateGps(latitude: number, longitude: number): void {
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new BadRequestException('Checkpoint photo GPS metadata is invalid.');
  }
}

export class ExifPhotoMetadataExtractor implements EvidencePhotoMetadataExtractor {
  constructor(
    private readonly parseExif: (
      filePath: string,
    ) => Promise<ExifMetadata | null> = async (filePath) =>
      (await exifr.parse(filePath, {
        gps: true,
        pick: ['latitude', 'longitude', 'DateTimeOriginal', 'Model', 'Make'],
      })) as ExifMetadata | null,
  ) {}

  async extract(filePath: string): Promise<ExtractedPhotoMetadata | null> {
    const metadata = await this.parseExif(filePath);
    if (metadata === null) {
      return null;
    }

    const extracted: ExtractedPhotoMetadata = {};
    const capturedAt = formatTimestamp(metadata.DateTimeOriginal);

    if (capturedAt !== undefined) {
      extracted.capturedAt = capturedAt;
      extracted.exifTimestamp = capturedAt;
    }

    const cameraModel = buildCameraModel(metadata);
    if (cameraModel !== undefined) {
      extracted.cameraModel = cameraModel;
    }

    if (
      isFiniteCoordinate(metadata.latitude) &&
      isFiniteCoordinate(metadata.longitude)
    ) {
      validateGps(metadata.latitude, metadata.longitude);
      extracted.gpsLat = metadata.latitude;
      extracted.gpsLng = metadata.longitude;
    }

    return Object.keys(extracted).length === 0 ? null : extracted;
  }
}
