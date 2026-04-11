import {
  MatrixDrivenEvidenceDocumentClassifier,
  type EvidenceDocumentAnalysisInput,
} from './evidence.document-classifier';
import {
  loadOcrFixtureManifest,
  loadOcrFixtureText,
} from './ocr-fixture-manifest';

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

async function analyzeManifestBaseFixture(documentLabel: string) {
  const classifier = new MatrixDrivenEvidenceDocumentClassifier();
  const manifest = await loadOcrFixtureManifest();
  const fixture = manifest.documents.find(
    (document) => document.documentLabel === documentLabel,
  );

  expect(fixture).toBeDefined();

  const defaultComboByDocumentLabel: Record<string, `${string}/${string}`> = {
    'Phytosanitary Certificate': 'EU/MANGO',
    'VHT Certificate': 'KOREA/MANGO',
    'MRL Test Results': 'EU/MANGO',
    'GAP Certificate': 'EU/MANGO',
    'Commercial Invoice': 'EU/MANGO',
    'Packing List': 'EU/MANGO',
    'Transport Document': 'EU/MANGO',
    'Delivery Note': 'EU/MANGO',
    'Export License': 'EU/MANGO',
  };

  const [market, product] = (
    defaultComboByDocumentLabel[documentLabel] ??
    fixture?.applicableCombos[0] ??
    'EU/MANGO'
  ).split('/') as [string, string];

  const result = await classifier.analyze(
    buildInput({
      artifactType: fixture?.artifactType ?? 'PHYTO_CERT',
      market,
      product,
      fileName: fixture?.assetPath.split('/').at(-1) ?? 'fixture.svg',
      mimeType: 'image/svg+xml',
      ocrText: await loadOcrFixtureText(fixture?.assetPath ?? ''),
    }),
  );

  return { manifest, fixture, result };
}

describe('MatrixDrivenEvidenceDocumentClassifier', () => {
  it('classifies the committed base phytosanitary fixture using manifest-backed expectations', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();
    const manifest = await loadOcrFixtureManifest();
    const phytoFixture = manifest.documents.find(
      (document) => document.documentLabel === 'Phytosanitary Certificate',
    );

    expect(phytoFixture).toBeDefined();

    const result = await classifier.analyze(
      buildInput({
        market: 'EU',
        product: 'MANGO',
        fileName: phytoFixture?.assetPath.split('/').at(-1) ?? 'phyto.svg',
        mimeType: 'image/svg+xml',
        ocrText: await loadOcrFixtureText(phytoFixture?.assetPath ?? ''),
      }),
    );

    expect(result.documentLabel).toBe('Phytosanitary Certificate');
    expect(result.documentRole).toBe('THAILAND_NPPO_EXPORT_CERTIFICATE');
    expect(result.confidence).toBe('HIGH');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        certificateNumber: 'PC-2026-0001',
        exporterName: 'Thai Orchard Export Co., Ltd.',
        consigneeName: 'Global Fresh Produce Importers',
        botanicalName: 'Mangifera indica',
        meansOfConveyance: 'Air freight TG Cargo 602',
        packageDescription: '420 cartons / palletized',
        commodityDescription: 'Fresh tropical fruit consignment',
        authorizedOfficer: 'Plant Quarantine Officer',
      }),
    );
    expect(result.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining(
        phytoFixture?.expectedFieldCompleteness.presentFieldKeys ?? [],
      ),
    );
    expect(result.fieldCompleteness.missingFieldKeys).toEqual(
      phytoFixture?.expectedFieldCompleteness.missingFieldKeys,
    );
    expect(result.fieldCompleteness.lowConfidenceFieldKeys).toEqual(
      phytoFixture?.expectedFieldCompleteness.lowConfidenceFieldKeys,
    );
    expect(result.fieldCompleteness.unsupportedFieldKeys).toEqual(
      phytoFixture?.expectedFieldCompleteness.unsupportedFieldKeys,
    );
    expect(result.fieldCompleteness.supported).toBe(true);
    expect(result.fieldCompleteness.documentMatrixVersion).toBe(
      manifest.version,
    );
  });

  it('classifies the committed Japan mango phytosanitary override fixture using manifest-backed expectations', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();
    const manifest = await loadOcrFixtureManifest();
    const phytoFixture = manifest.documents.find(
      (document) => document.documentLabel === 'Phytosanitary Certificate',
    );
    const variant = phytoFixture?.variants?.find(
      (entry) => entry.combo === 'JAPAN/MANGO',
    );

    expect(variant).toBeDefined();

    const result = await classifier.analyze(
      buildInput({
        market: 'JAPAN',
        product: 'MANGO',
        fileName:
          variant?.assetPath.split('/').at(-1) ?? 'phyto-japan-mango.svg',
        mimeType: 'image/svg+xml',
        ocrText: await loadOcrFixtureText(variant?.assetPath ?? ''),
      }),
    );

    expect(result.documentLabel).toBe('Phytosanitary Certificate');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        certificateNumber: 'JP-MG-PHYTO-2026-0001',
        mustStateFruitFlyFree: true,
        treatmentReference:
          'VHT treatment record VHT-2026-0088 completed before export.',
      }),
    );
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
        ...(variant?.expectedFieldCompleteness.presentFieldKeys ?? []),
      ]),
    );
    expect(result.fieldCompleteness.missingFieldKeys).toEqual(
      expect.arrayContaining(
        phytoFixture?.expectedFieldCompleteness.missingFieldKeys ?? [],
      ),
    );
    expect(result.lowConfidenceFieldKeys).toEqual(
      variant?.expectedFieldCompleteness.lowConfidenceFieldKeys ?? [],
    );
  });

  it.each([
    {
      documentLabel: 'MRL Test Results',
      expectedFields: {
        reportNumber: 'LAB-2026-0112',
        laboratoryName: 'Bangkok Residue Analytics Laboratory',
        resultUnits: 'mg/kg',
        authorizedSignatory: 'Laboratory director',
      },
    },
    {
      documentLabel: 'GAP Certificate',
      expectedFields: {
        certificateNumber: 'GAP-2026-2301',
        certificateHolder: 'Thai Orchard Export Co., Ltd.',
        schemeName: 'Thailand GAP',
      },
    },
    {
      documentLabel: 'Commercial Invoice',
      expectedFields: {
        invoiceNumber: 'INV-2026-0448',
        sellerName: 'Thai Orchard Export Co., Ltd.',
        currency: 'USD',
      },
    },
    {
      documentLabel: 'Packing List',
      expectedFields: {
        packingListNumber: 'PL-2026-0193',
        packageType: 'corrugated cartons',
        containerReference: 'ULD-TG-602',
      },
    },
    {
      documentLabel: 'Transport Document',
      expectedFields: {
        transportDocumentNumber: 'AWB-217-2026-8891',
        transportMode: 'Air freight',
        carrierName: 'Thai Airways Cargo',
      },
    },
    {
      documentLabel: 'Delivery Note',
      expectedFields: {
        deliveryNoteNumber: 'DN-2026-0311',
        senderName: 'Thai Orchard Export Co., Ltd.',
        receiverSignature: 'Warehouse intake clerk',
      },
    },
    {
      documentLabel: 'Export License',
      expectedFields: {
        authorizationNumber: 'EX-DOA-2026-1187',
        legalEntityName: 'Thai Orchard Export Co., Ltd.',
        issuingOffice: 'Plant Standards and Certification Office',
      },
    },
    {
      documentLabel: 'Grading Report',
      expectedFields: {
        gradingReportNumber: 'GR-2026-0418',
        inspectionDate: '07 April 2026',
        gradeClass: 'Premium Export A',
        packhouseName: 'Chiang Mai Premium Packing Center',
        inspectorName: 'Somchai Rattanakul',
      },
    },
  ])(
    'classifies committed base $documentLabel fixture using manifest-backed expectations',
    async ({ documentLabel, expectedFields }) => {
      const { manifest, fixture, result } =
        await analyzeManifestBaseFixture(documentLabel);

      expect(result.documentLabel).toBe(documentLabel);
      expect(result.extractedFields).toEqual(
        expect.objectContaining(expectedFields),
      );
      expect(result.fieldCompleteness.presentFieldKeys).toEqual(
        expect.arrayContaining(
          fixture?.expectedFieldCompleteness.presentFieldKeys ?? [],
        ),
      );
      expect(result.fieldCompleteness.missingFieldKeys).toEqual(
        fixture?.expectedFieldCompleteness.missingFieldKeys,
      );
      expect(result.fieldCompleteness.lowConfidenceFieldKeys).toEqual(
        fixture?.expectedFieldCompleteness.lowConfidenceFieldKeys,
      );
      expect(result.fieldCompleteness.unsupportedFieldKeys).toEqual(
        fixture?.expectedFieldCompleteness.unsupportedFieldKeys,
      );
      expect(result.fieldCompleteness.documentMatrixVersion).toBe(
        manifest.version,
      );
    },
  );

  it('uses grading report OCR text to extract the full committed grading fixture field set', async () => {
    const { fixture, result } =
      await analyzeManifestBaseFixture('Grading Report');

    expect(result.documentLabel).toBe('Grading Report');
    expect(result.documentRole).toBe('QUALITY_GRADING_REPORT');
    expect(result.confidence).toBe('MEDIUM_LOW');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        gradingReportNumber: 'GR-2026-0418',
        inspectionDate: '07 April 2026',
        exporterName: 'Thai Orchard Export Co., Ltd.',
        commodityName: 'Fresh Mango',
        lotOrConsignmentId: 'LOT-EXPORT-2026-041',
        gradeClass: 'Premium Export A',
        packhouseName: 'Chiang Mai Premium Packing Center',
        inspectorName: 'Somchai Rattanakul',
      }),
    );
    expect(result.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining(
        fixture?.expectedFieldCompleteness.presentFieldKeys ?? [],
      ),
    );
    expect(result.fieldCompleteness.missingFieldKeys).toEqual(
      fixture?.expectedFieldCompleteness.missingFieldKeys,
    );
    expect(result.fieldCompleteness.lowConfidenceFieldKeys).toEqual(
      fixture?.expectedFieldCompleteness.lowConfidenceFieldKeys,
    );
    expect(result.fieldCompleteness.unsupportedFieldKeys).toEqual(
      fixture?.expectedFieldCompleteness.unsupportedFieldKeys,
    );
  });

  it('classifies the committed Korea mango VHT override fixture using manifest-backed expectations', async () => {
    const classifier = new MatrixDrivenEvidenceDocumentClassifier();
    const manifest = await loadOcrFixtureManifest();
    const vhtFixture = manifest.documents.find(
      (document) => document.documentLabel === 'VHT Certificate',
    );
    const variant = vhtFixture?.variants?.find(
      (entry) => entry.combo === 'KOREA/MANGO',
    );

    expect(variant).toBeDefined();

    const result = await classifier.analyze(
      buildInput({
        artifactType: 'VHT_CERT',
        market: 'KOREA',
        product: 'MANGO',
        fileName: variant?.assetPath.split('/').at(-1) ?? 'vht-korea-mango.svg',
        mimeType: 'image/svg+xml',
        ocrText: await loadOcrFixtureText(variant?.assetPath ?? ''),
      }),
    );

    expect(result.documentLabel).toBe('VHT Certificate');
    expect(result.extractedFields).toEqual(
      expect.objectContaining({
        treatmentRecordNumber: 'VHT-KR-MG-2026-0105',
        treatmentMethod: 'Vapor heat treatment',
        overseasInspectionReference: 'QIA-OVERSEAS-TH-2026-511',
      }),
    );
    expect(result.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining([
        'treatmentRecordNumber',
        'commodityName',
        'treatmentFacility',
        'treatmentDate',
        'treatmentMethod',
        'targetCoreTemperatureC',
        'holdMinutes',
        'operatorOrInspector',
        'linkedPhytoCertificateNumber',
        ...(variant?.expectedFieldCompleteness.presentFieldKeys ?? []),
      ]),
    );
    expect(result.fieldCompleteness.missingFieldKeys).toEqual(
      expect.arrayContaining(
        variant?.expectedFieldCompleteness.missingFieldKeys ?? [],
      ),
    );
    expect(result.fieldCompleteness.lowConfidenceFieldKeys).toEqual(
      variant?.expectedFieldCompleteness.lowConfidenceFieldKeys ?? [],
    );
  });

  it.each([
    {
      documentLabel: 'Phytosanitary Certificate',
      combo: 'JAPAN/MANGOSTEEN' as const,
      artifactType: 'PHYTO_CERT' as const,
      expectedFields: {
        certificateNumber: 'JP-MT-PHYTO-2026-0007',
        packageMarkingForJapan: 'JP-MANGOSTEEN-LOT-77',
        treatmentReference:
          'Steam heat treatment record SHT-2026-144 with verified cooling.',
      },
      expectedSharedPresentFields: [
        'certificateNumber',
        'exporterName',
        'consigneeName',
        'placeOfOrigin',
        'botanicalName',
        'packageDescription',
        'additionalDeclarations',
        'issueDate',
      ],
    },
    {
      documentLabel: 'Phytosanitary Certificate',
      combo: 'KOREA/MANGOSTEEN' as const,
      artifactType: 'PHYTO_CERT' as const,
      expectedFields: {
        certificateNumber: 'KR-MT-PHYTO-2026-0004',
        fumigationDetails: 'Methyl bromide 32 g/m3 for 2 hours at 21 C.',
        treatmentReference:
          'Fumigation log MB-2026-031 and plant quarantine release noted.',
      },
      expectedSharedPresentFields: [
        'certificateNumber',
        'exporterName',
        'consigneeName',
        'placeOfOrigin',
        'botanicalName',
        'additionalDeclarations',
        'issuingAuthority',
        'issueDate',
      ],
    },
    {
      documentLabel: 'VHT Certificate',
      combo: 'JAPAN/MANGO' as const,
      artifactType: 'VHT_CERT' as const,
      expectedFields: {
        treatmentRecordNumber: 'VHT-JP-MG-2026-0088',
        allowedVariety: 'Nam Doc Mai',
        maffVerificationReference: 'MAFF-TH-INSPECT-2026-114',
      },
      expectedSharedPresentFields: [
        'treatmentRecordNumber',
        'commodityName',
        'treatmentFacility',
        'treatmentDate',
        'treatmentMethod',
        'targetCoreTemperatureC',
        'holdMinutes',
        'linkedPhytoCertificateNumber',
      ],
    },
    {
      documentLabel: 'VHT Certificate',
      combo: 'JAPAN/MANGOSTEEN' as const,
      artifactType: 'VHT_CERT' as const,
      expectedFields: {
        treatmentRecordNumber: 'VHT-JP-MT-2026-0041',
        humidityRequirement:
          'Chamber humidity maintained between 50 and 80 percent.',
        coolingRequirement:
          'Product cooled for at least 60 minutes after treatment.',
      },
      expectedSharedPresentFields: [
        'treatmentRecordNumber',
        'commodityName',
        'treatmentFacility',
        'treatmentDate',
        'treatmentMethod',
        'targetCoreTemperatureC',
        'holdMinutes',
        'linkedPhytoCertificateNumber',
      ],
    },
  ])(
    'classifies committed $combo $documentLabel override fixture using manifest-backed expectations',
    async ({
      documentLabel,
      combo,
      artifactType,
      expectedFields,
      expectedSharedPresentFields,
    }) => {
      const classifier = new MatrixDrivenEvidenceDocumentClassifier();
      const manifest = await loadOcrFixtureManifest();
      const fixture = manifest.documents.find(
        (document) => document.documentLabel === documentLabel,
      );
      const variant = fixture?.variants?.find((entry) => entry.combo === combo);

      expect(variant).toBeDefined();

      const [market, product] = combo.split('/') as [string, string];
      const result = await classifier.analyze(
        buildInput({
          artifactType,
          market,
          product,
          fileName: variant?.assetPath.split('/').at(-1) ?? 'override.svg',
          mimeType: 'image/svg+xml',
          ocrText: await loadOcrFixtureText(variant?.assetPath ?? ''),
        }),
      );

      expect(result.documentLabel).toBe(documentLabel);
      expect(result.extractedFields).toEqual(
        expect.objectContaining(expectedFields),
      );
      expect(result.fieldCompleteness.presentFieldKeys).toEqual(
        expect.arrayContaining([
          ...expectedSharedPresentFields,
          ...(variant?.expectedFieldCompleteness.presentFieldKeys ?? []),
        ]),
      );
      expect(result.fieldCompleteness.missingFieldKeys).toEqual(
        expect.arrayContaining(
          variant?.expectedFieldCompleteness.missingFieldKeys ?? [],
        ),
      );
      expect(result.fieldCompleteness.lowConfidenceFieldKeys).toEqual(
        variant?.expectedFieldCompleteness.lowConfidenceFieldKeys ?? [],
      );
    },
  );

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
