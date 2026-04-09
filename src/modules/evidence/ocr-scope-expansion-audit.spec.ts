import { buildOcrScopeExpansionAudit } from './ocr-scope-expansion-audit';

describe('OCR scope expansion audit', () => {
  it('surfaces required rule-pack documents that still sit outside the current first-pass OCR matrix', async () => {
    const audit = await buildOcrScopeExpansionAudit();

    expect(audit.currentMatrixDocumentLabels).toEqual(
      expect.arrayContaining([
        'Phytosanitary Certificate',
        'VHT Certificate',
        'MRL Test Results',
        'GAP Certificate',
        'Export License',
        'Commercial Invoice',
        'Packing List',
        'Transport Document',
        'Delivery Note',
      ]),
    );
    expect(audit.extraRequiredDocumentsOutsideFirstPass).toEqual(
      expect.arrayContaining(['Grading Report']),
    );
    expect(audit.requiredDocumentsCoveredByExistingMatrix).toEqual(
      expect.arrayContaining([
        'Phytosanitary Certificate',
        'VHT Certificate',
        'MRL Test Results',
        'GAP Certificate',
        'Export License',
      ]),
    );
  });

  it('records known non-document controls that should not be invented as new OCR document families', async () => {
    const audit = await buildOcrScopeExpansionAudit();

    expect(audit.nonDocumentControlsModeledAsFieldOrRuleConstraints).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'KOREA/MANGO overseas inspection and registration',
        ),
        expect.stringContaining('KOREA/MANGOSTEEN fumigation'),
        expect.stringContaining('JAPAN/MANGOSTEEN certificate-label control'),
      ]),
    );
  });
});
