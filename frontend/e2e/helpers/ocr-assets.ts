import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from '@playwright/test';

const OCR_FIXTURE_ROOT = path.resolve(
  __dirname,
  '..',
  'test-assets',
  'ocr-forms',
);

export function resolveOcrFixturePath(relativePath: string): string {
  return path.resolve(OCR_FIXTURE_ROOT, relativePath);
}

export async function loadOcrFixture(relativePath: string): Promise<Buffer> {
  return readFile(resolveOcrFixturePath(relativePath));
}

export async function renderOcrSvgFixtureToPng(
  page: Page,
  relativePath: string,
): Promise<Buffer> {
  const svgSource = await loadOcrFixture(relativePath);
  const svgText = svgSource.toString('utf8');

  const dataUrl = await page.evaluate(async (svgMarkup: string) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const objectUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () =>
          reject(new Error('Failed to render OCR SVG fixture.'));
        nextImage.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas 2D context was not available.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);

      return canvas.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, svgText);

  return Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
}
