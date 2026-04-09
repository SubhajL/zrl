import path from 'node:path';
import {
  loadOcrFixture,
  resolveOcrFixturePath,
} from '../../e2e/helpers/ocr-assets';

describe('ocr-assets helper', () => {
  it('resolves committed OCR fixture paths under frontend/e2e/test-assets/ocr-forms', () => {
    expect(
      resolveOcrFixturePath(
        'official/phytosanitary-certificate-japan-mango.svg',
      ),
    ).toBe(
      path.resolve(
        process.cwd(),
        'e2e',
        'test-assets',
        'ocr-forms',
        'official',
        'phytosanitary-certificate-japan-mango.svg',
      ),
    );
  });

  it('loads committed OCR fixtures as binary buffers for Playwright uploads', async () => {
    const buffer = await loadOcrFixture(
      'official/phytosanitary-certificate-japan-mango.svg',
    );

    expect(buffer.byteLength).toBeGreaterThan(0);
    expect(buffer.toString('utf8')).toContain('PHYTOSANITARY CERTIFICATE');
    expect(buffer.toString('utf8')).toContain('Fruit fly free area confirmed');
  });

  it('loads SVG fixture content that can be rendered into browser upload images', async () => {
    const buffer = await loadOcrFixture(
      'treatment/vht-certificate-korea-mango.svg',
    );

    expect(buffer.toString('utf8')).toContain('TREATMENT CERTIFICATE');
    expect(buffer.toString('utf8')).toContain('Overseas inspection reference');
  });
});
