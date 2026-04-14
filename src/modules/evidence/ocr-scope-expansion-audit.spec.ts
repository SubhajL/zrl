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
        'Grading Report',
        'Export License',
        'Commercial Invoice',
        'Packing List',
        'Transport Document',
        'Delivery Note',
      ]),
    );
    expect(audit.extraRequiredDocumentsOutsideFirstPass).not.toContain(
      'Grading Report',
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

  it('surfaces machine-readable unresolved policy exceptions such as the EU durian phytosanitary dispute', async () => {
    const audit = await buildOcrScopeExpansionAudit();

    expect(audit.policyExceptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          combo: 'EU/DURIAN',
          documentLabel: 'Phytosanitary Certificate',
          status: 'UNRESOLVED',
          exceptionType: 'POLICY_DISPUTE',
        }),
      ]),
    );
  });
});
