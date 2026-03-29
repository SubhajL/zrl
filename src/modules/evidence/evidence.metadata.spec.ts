import { BadRequestException } from '@nestjs/common';
import { resolve } from 'node:path';
import { ExifPhotoMetadataExtractor } from './evidence.metadata';

describe('ExifPhotoMetadataExtractor', () => {
  it('maps EXIF timestamp, GPS coordinates, and camera model', async () => {
    const extractor = new ExifPhotoMetadataExtractor(() =>
      Promise.resolve({
        latitude: 13.6904,
        longitude: 101.0779,
        DateTimeOriginal: new Date('2026-03-22T11:02:03.000Z'),
        Make: 'Apple',
        Model: 'iPhone 15 Pro',
      }),
    );

    await expect(extractor.extract('/tmp/checkpoint.jpg')).resolves.toEqual({
      capturedAt: '2026-03-22T11:02:03.000Z',
      exifTimestamp: '2026-03-22T11:02:03.000Z',
      gpsLat: 13.6904,
      gpsLng: 101.0779,
      cameraModel: 'Apple iPhone 15 Pro',
    });
  });

  it('returns null when no supported metadata is present', async () => {
    const extractor = new ExifPhotoMetadataExtractor(() => Promise.resolve({}));

    await expect(extractor.extract('/tmp/checkpoint.jpg')).resolves.toBeNull();
  });

  it('rejects invalid GPS coordinates', async () => {
    const extractor = new ExifPhotoMetadataExtractor(() =>
      Promise.resolve({
        latitude: 120,
        longitude: 200,
      }),
    );

    await expect(
      extractor.extract('/tmp/checkpoint.jpg'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects malformed image files that cannot be parsed for EXIF', async () => {
    const extractor = new ExifPhotoMetadataExtractor(() => {
      throw new Error('Invalid image');
    });

    await expect(extractor.extract('/tmp/checkpoint.jpg')).rejects.toThrow(
      'Checkpoint photo file is not a valid image with readable EXIF metadata.',
    );
  });

  it('parses capturedAt and GPS coordinates from the real checkpoint test asset', async () => {
    const extractor = new ExifPhotoMetadataExtractor();

    const result = await extractor.extract(
      resolve(process.cwd(), 'frontend/e2e/test-assets/checkpoint-photo.jpg'),
    );

    expect(result).not.toBeNull();
    expect(result?.cameraModel).toBe('OpenAI Codex Camera');
    expect(result?.capturedAt).toEqual(
      expect.stringMatching(/^2026-03-29T\d{2}:34:56\.000Z$/),
    );
    expect(result?.capturedAt).toBe(result?.exifTimestamp);
    expect(result?.gpsLat).toBeCloseTo(13.690366666666668);
    expect(result?.gpsLng).toBeCloseTo(101.0779);
  });
});
