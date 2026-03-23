import { BadRequestException } from '@nestjs/common';
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
});
