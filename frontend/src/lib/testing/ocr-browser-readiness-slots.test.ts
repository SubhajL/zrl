import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as YAML from 'yaml';
import {
  OCR_BROWSER_READINESS_SLOTS,
  OCR_BROWSER_REQUIRED_SLOT_COUNT,
} from './ocr-browser-readiness-slots';

describe('ocr browser readiness slots', () => {
  it('enumerates every current required combo-document slot for browser proof expansion', () => {
    expect(OCR_BROWSER_REQUIRED_SLOT_COUNT).toBe(75);
    expect(OCR_BROWSER_READINESS_SLOTS).toHaveLength(75);
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
  });

  it('stays in exact combo-document parity with the supported document matrix', async () => {
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
    const matrixSlots = matrix.supportedCombos
      .flatMap((combo) =>
        combo.requiredDocuments.map(
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
});
