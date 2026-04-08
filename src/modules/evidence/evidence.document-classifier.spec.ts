import {
  MatrixDrivenEvidenceDocumentClassifier,
  type EvidenceDocumentAnalysisInput,
} from './evidence.document-classifier';

function buildInput(
  overrides: Partial<EvidenceDocumentAnalysisInput> = {},
): EvidenceDocumentAnalysisInput {
  return {
    artifactType: 'PHYTO_CERT',
    market: 'JAPAN',
    product: 'MANGO',
    fileName: 'phyto.pdf',
    mimeType: 'application/pdf',
    metadata: null,
    ocrText: [
      'PHYTOSANITARY CERTIFICATE',
      'Certificate No. PC-2026-0001',
      'Exporter: Thai Export Co., Ltd.',
      'Consignee: Tokyo Fresh Imports KK',
      'Botanical name: Mangifera indica',
      'Place of origin: Chachoengsao, Thailand',
      'Date of issue: 07 April 2026',
      'Issued by Department of Agriculture',
      'Additional declaration: Fruit fly free area and VHT treatment completed.',
      'Means of conveyance: Air freight',
    ].join('\n'),
    ...overrides,
  };
}

describe('MatrixDrivenEvidenceDocumentClassifier', () => {
  it('classifies a phytosanitary certificate and extracts matrix field values', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();

    const result = await classifier.analyze(buildInput());

    expect(result.documentLabel).toBe('Phytosanitary Certificate');
    expect(result.documentRole).toBe('THAILAND_NPPO_EXPORT_CERTIFICATE');
    expect(result.confidence).toBe('HIGH');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        certificateNumber: 'PC-2026-0001',
        exporterName: 'Thai Export Co., Ltd.',
        consigneeName: 'Tokyo Fresh Imports KK',
        botanicalName: 'Mangifera indica',
        meansOfConveyance: 'Air freight',
        mustStateFruitFlyFree: true,
      }),
    );
    expect(result.missingFieldKeys).not.toContain('certificateNumber');
    expect(result.missingFieldKeys).toContain('declaredPointOfEntry');
    expect(result.missingFieldKeys).toContain('officialSealOrSignature');
    expect(result.lowConfidenceFieldKeys).not.toContain(
      'mustStateFruitFlyFree',
    );
    expect(result.fieldCompleteness.supported).toBe(true);
    expect(result.fieldCompleteness.documentMatrixVersion).toBe(1);
    expect(result.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining([
        'certificateNumber',
        'issuingAuthority',
        'exporterName',
        'consigneeName',
        'placeOfOrigin',
        'meansOfConveyance',
        'botanicalName',
        'additionalDeclarations',
        'issueDate',
        'mustStateFruitFlyFree',
        'treatmentReference',
      ]),
    );
    expect(result.fieldCompleteness.missingFieldKeys).toEqual(
      expect.arrayContaining([
        'declaredPointOfEntry',
        'officialSealOrSignature',
      ]),
    );
    expect(result.fieldCompleteness.unsupportedFieldKeys).toEqual([]);
  });

  it('uses existing artifact metadata to fill structured fields for GAP certificates', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();

    const result = await classifier.analyze(
      buildInput({
        artifactType: 'GAP_CERT',
        market: 'EU',
        product: 'MANGO',
        fileName: 'gap.json',
        mimeType: 'application/json',
        metadata: {
          certificateNumber: 'GAP-100',
          holderName: 'Exporter Co',
          expiryDate: '2026-12-31',
          scope: ['Mango'],
          issuer: 'ACFS Thailand',
        },
        ocrText: 'Thai GAP certificate holder Exporter Co certificate GAP-100',
      }),
    );

    expect(result.documentLabel).toBe('GAP Certificate');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        certificateNumber: 'GAP-100',
        certificateHolder: 'Exporter Co',
        expiryDate: '2026-12-31',
        commodityScope: 'Mango',
      }),
    );
    expect(result.fieldCompleteness.supported).toBe(true);
    expect(result.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining([
        'certificateNumber',
        'certificateHolder',
        'expiryDate',
        'commodityScope',
      ]),
    );
    expect(result.fieldCompleteness.unsupportedFieldKeys).toEqual([
      'issuingAuthority',
    ]);
  });

  it('returns unsupported when no matrix-backed document can be matched confidently', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();

    const result = await classifier.analyze(
      buildInput({
        artifactType: 'INVOICE',
        market: 'EU',
        product: 'MANGO',
        fileName: 'unknown.pdf',
        ocrText: 'Random note without recognizable trade document structure.',
      }),
    );

    expect(result.documentLabel).toBeNull();
    expect(result.analysisStatus).toBe('FAILED');
    expect(result.summaryText).toContain('Unable to classify');
    expect(result.fieldCompleteness).toEqual({
      supported: false,
      documentMatrixVersion: 1,
      expectedFieldKeys: [],
      presentFieldKeys: [],
      missingFieldKeys: [],
      lowConfidenceFieldKeys: [],
      unsupportedFieldKeys: [],
    });
  });
});
