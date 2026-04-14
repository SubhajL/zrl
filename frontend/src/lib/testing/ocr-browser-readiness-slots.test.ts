import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import manifest from '../../../e2e/test-assets/ocr-forms/manifest.json';
import * as YAML from 'yaml';
import {
  OCR_BROWSER_READINESS_SLOTS,
  OCR_BROWSER_REQUIRED_SLOT_COUNT,
} from './ocr-browser-readiness-slots';

describe('ocr browser readiness slots', () => {
  it('enumerates every fixture-backed required combo-document slot for browser proof expansion', () => {
    expect(OCR_BROWSER_REQUIRED_SLOT_COUNT).toBe(
      OCR_BROWSER_READINESS_SLOTS.length,
    );
    expect(OCR_BROWSER_REQUIRED_SLOT_COUNT).toBeGreaterThan(0);
    expect(
      OCR_BROWSER_READINESS_SLOTS.filter(
        (slot) =>
          slot.combo === 'JAPAN/MANGO' &&
          slot.documentLabel === 'VHT Certificate',
      ),
    ).toHaveLength(1);
    expect(
      OCR_BROWSER_READINESS_SLOTS.filter(
        (slot) =>
          slot.combo === 'EU/MANGO' && slot.documentLabel === 'Export License',
      ),
    ).toHaveLength(1);
    expect(
      OCR_BROWSER_READINESS_SLOTS.filter(
        (slot) => slot.documentLabel === 'Grading Report',
      ),
    ).toHaveLength(9);
  });

  it('stays in exact parity with the fixture-backed subset of the supported document matrix', async () => {
    const matrix = YAML.parse(
      await readFile(
        resolve(process.cwd(), '../rules/document-matrix.yaml'),
        'utf8',
      ),
    ) as {
      supportedCombos: Array<{
        market: string;
        product: string;
        requiredDocuments: string[];
      }>;
    };
    const fixtureBackedLabels = new Set(
      manifest.documents.map((document) => document.documentLabel),
    );
    const matrixSlots = matrix.supportedCombos
      .flatMap((combo) =>
        combo.requiredDocuments
          .filter((documentLabel) => fixtureBackedLabels.has(documentLabel))
          .map(
            (documentLabel) =>
              `${combo.market}/${combo.product}::${documentLabel}`,
          ),
      )
      .sort();
    const browserSlots = OCR_BROWSER_READINESS_SLOTS.map(
      (slot) => `${slot.combo}::${slot.documentLabel}`,
    ).sort();

    expect(browserSlots).toEqual(matrixSlots);
  });

  it('uses explicit variant completeness for override-backed slots', () => {
    const phytoDocument = manifest.documents.find(
      (document) => document.documentLabel === 'Phytosanitary Certificate',
    );
    const vhtDocument = manifest.documents.find(
      (document) => document.documentLabel === 'VHT Certificate',
    );
    const japanMangoPhytoSlot = OCR_BROWSER_READINESS_SLOTS.find(
      (slot) =>
        slot.combo === 'JAPAN/MANGO' &&
        slot.documentLabel === 'Phytosanitary Certificate',
    );
    const koreaMangoVhtSlot = OCR_BROWSER_READINESS_SLOTS.find(
      (slot) =>
        slot.combo === 'KOREA/MANGO' && slot.documentLabel === 'VHT Certificate',
    );
    const japanMangoPhytoVariant = phytoDocument?.variants?.find(
      (variant) => variant.combo === 'JAPAN/MANGO',
    );
    const koreaMangoVhtVariant = vhtDocument?.variants?.find(
      (variant) => variant.combo === 'KOREA/MANGO',
    );

    expect(japanMangoPhytoSlot?.expectedPresentFieldKeys).toEqual(
      japanMangoPhytoVariant?.expectedFieldCompleteness.presentFieldKeys,
    );
    expect(koreaMangoVhtSlot?.expectedPresentFieldKeys).toEqual(
      koreaMangoVhtVariant?.expectedFieldCompleteness.presentFieldKeys,
    );
  });
});
