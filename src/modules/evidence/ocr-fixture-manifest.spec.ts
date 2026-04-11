import {
  loadOcrFixtureManifest,
  loadOcrFixtureText,
} from './ocr-fixture-manifest';
import { loadSupportedDocumentMatrix } from './document-matrix';

describe('OCR fixture manifest helpers', () => {
  it('loads the committed OCR fixture manifest with typed document entries', async () => {
    const manifest = await loadOcrFixtureManifest();

    expect(manifest.version).toBe(1);
    expect(manifest.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentLabel: 'Phytosanitary Certificate',
          artifactType: 'PHYTO_CERT',
        }),
        expect.objectContaining({
          documentLabel: 'VHT Certificate',
          artifactType: 'VHT_CERT',
        }),
        expect.objectContaining({
          documentLabel: 'Grading Report',
          artifactType: 'INVOICE',
        }),
      ]),
    );
  });

  it('extracts deterministic OCR-visible text from committed SVG fixtures', async () => {
    const text = await loadOcrFixtureText(
      'frontend/e2e/test-assets/ocr-forms/official/phytosanitary-certificate-japan-mango.svg',
    );

    expect(text).toContain('PHYTOSANITARY CERTIFICATE');
    expect(text).toContain(
      'Fruit fly free area confirmed under MAFF protocol.',
    );
    expect(text).toContain(
      'Treatment reference: VHT treatment record VHT-2026-0088 completed before export.',
    );
  });

  it('extracts deterministic OCR-visible text from the committed grading report fixture', async () => {
    const text = await loadOcrFixtureText(
      'frontend/e2e/test-assets/ocr-forms/trade/grading-report-base.svg',
    );

    expect(text).toContain('GRADING REPORT');
    expect(text).toContain('Grade class: Premium Export A');
    expect(text).toContain('Lot or consignment ID: LOT-EXPORT-2026-041');
  });

  it('keeps fixture manifest combo applicability aligned with the supported document matrix', async () => {
    const [manifest, matrix] = await Promise.all([
      loadOcrFixtureManifest(),
      loadSupportedDocumentMatrix(),
    ]);

    for (const document of manifest.documents) {
      const matrixDocument = matrix.documents.find(
        (entry) => entry.documentLabel === document.documentLabel,
      );

      expect(matrixDocument).toBeDefined();
      expect(document.applicableCombos.slice().sort()).toEqual(
        [...(matrixDocument?.applicableCombos ?? [])].sort(),
      );
    }
  });
});
