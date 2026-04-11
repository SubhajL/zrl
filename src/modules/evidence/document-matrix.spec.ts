import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import {
  findRuleYamlFiles,
  loadRuleDefinitionFromFile,
} from '../rules-engine/rule-definition.files';
import { loadSupportedDocumentMatrix } from './document-matrix';
import { loadOcrFixtureManifest } from './ocr-fixture-manifest';
import { buildOcrReadinessLedger } from './ocr-readiness-ledger';
import { loadOcrPolicyExceptions } from './ocr-policy-exceptions';
import { buildOcrScopeExpansionAudit } from './ocr-scope-expansion-audit';

function buildRulesEngineService() {
  return new RulesEngineService(
    { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
    {} as never,
    { hashString: jest.fn() } as never,
  );
}

function buildChecklistForDocument(
  documentLabel: string,
  artifact: {
    id: string;
    artifactType:
      | 'MRL_TEST'
      | 'VHT_CERT'
      | 'PHYTO_CERT'
      | 'CHECKPOINT_PHOTO'
      | 'TEMP_DATA'
      | 'HANDOFF_SIGNATURE'
      | 'INVOICE'
      | 'GAP_CERT';
    fileName: string;
    metadata?: Record<string, unknown> | null;
    latestAnalysisDocumentLabel?: string | null;
  },
) {
  const service = buildRulesEngineService();

  return service.evaluateLane(
    {
      market: 'EU',
      product: 'MANGO',
      version: 1,
      effectiveDate: new Date('2026-04-01T00:00:00.000Z'),
      sourcePath: '/rules/eu/mango.yaml',
      requiredDocuments: [documentLabel],
      completenessWeights: {
        regulatory: 0.4,
        quality: 0.25,
        coldChain: 0.2,
        chainOfCustody: 0.15,
      },
      metadata: {
        coverageState: 'FULL_EXHAUSTIVE',
        sourceQuality: 'PRIMARY_ONLY',
        retrievedAt: new Date('2026-04-01T00:00:00.000Z'),
        commodityCode: null,
        nonPesticideChecks: [],
      },
      labPolicy: {
        enforcementMode: 'DOCUMENT_ONLY',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: null,
      },
      substances: [],
    },
    [
      {
        metadata: null,
        latestAnalysisDocumentLabel: null,
        ...artifact,
      },
    ],
  ).checklist[0];
}

function buildMetadataForExpectedArtifact(
  documentLabel: string,
  artifactType:
    | 'MRL_TEST'
    | 'VHT_CERT'
    | 'PHYTO_CERT'
    | 'CHECKPOINT_PHOTO'
    | 'TEMP_DATA'
    | 'HANDOFF_SIGNATURE'
    | 'INVOICE'
    | 'GAP_CERT',
): Record<string, unknown> {
  return {
    documentType: documentLabel,
    ...(artifactType === 'PHYTO_CERT' ||
    artifactType === 'VHT_CERT' ||
    artifactType === 'GAP_CERT'
      ? { expiresAt: '2026-12-31T00:00:00.000Z' }
      : {}),
  };
}

describe('supported document matrix', () => {
  it('loads the official/formal first-pass document matrix for live supported combos', async () => {
    const matrix = await loadSupportedDocumentMatrix();

    expect(matrix.version).toBe(1);
    expect(matrix.artifactTypes).toEqual(
      expect.arrayContaining([
        'PHYTO_CERT',
        'VHT_CERT',
        'MRL_TEST',
        'GAP_CERT',
        'INVOICE',
      ]),
    );
    expect(matrix.supportedCombos).toHaveLength(9);
    const japanMangoCombo = matrix.supportedCombos.find(
      (combo) => combo.market === 'JAPAN' && combo.product === 'MANGO',
    );
    const euMangosteenCombo = matrix.supportedCombos.find(
      (combo) => combo.market === 'EU' && combo.product === 'MANGOSTEEN',
    );
    const koreaMangoCombo = matrix.supportedCombos.find(
      (combo) => combo.market === 'KOREA' && combo.product === 'MANGO',
    );
    expect(japanMangoCombo?.requiredDocuments).toEqual(
      expect.arrayContaining([
        'Phytosanitary Certificate',
        'MRL Test Results',
        'VHT Certificate',
        'GAP Certificate',
        'Grading Report',
        'Commercial Invoice',
        'Packing List',
        'Transport Document',
        'Delivery Note',
      ]),
    );
    expect(euMangosteenCombo?.requiredDocuments).not.toEqual(
      expect.arrayContaining(['VHT Certificate']),
    );
    expect(koreaMangoCombo?.requiredDocuments).toEqual(
      expect.arrayContaining(['VHT Certificate']),
    );

    const phytoDocument = matrix.documents.find(
      (document) => document.documentLabel === 'Phytosanitary Certificate',
    );
    const vhtDocument = matrix.documents.find(
      (document) => document.documentLabel === 'VHT Certificate',
    );
    const invoiceDocument = matrix.documents.find(
      (document) => document.documentLabel === 'Commercial Invoice',
    );
    const gradingReportDocument = matrix.documents.find(
      (document) => document.documentLabel === 'Grading Report',
    );
    expect(phytoDocument).toMatchObject({
      artifactType: 'PHYTO_CERT',
      documentClass: 'OFFICIAL_GOVERNMENT_FORM',
      confidence: 'HIGH',
    });
    expect(phytoDocument?.requiredFieldKeys).toEqual(
      expect.arrayContaining([
        'certificateNumber',
        'exporterName',
        'consigneeName',
        'botanicalName',
        'issueDate',
        'issuingAuthority',
      ]),
    );
    expect(vhtDocument).toMatchObject({
      artifactType: 'VHT_CERT',
      documentClass: 'TREATMENT_EVIDENCE',
      confidence: 'MEDIUM',
    });
    expect(vhtDocument?.applicableCombos).toEqual(
      expect.arrayContaining([
        'JAPAN/MANGO',
        'JAPAN/MANGOSTEEN',
        'KOREA/MANGO',
      ]),
    );
    expect(invoiceDocument).toMatchObject({
      artifactType: 'INVOICE',
      documentClass: 'TRADE_DOCUMENT',
      confidence: 'HIGH',
    });
    expect(gradingReportDocument).toMatchObject({
      artifactType: 'INVOICE',
      documentClass: 'TRADE_DOCUMENT',
      confidence: 'MEDIUM_LOW',
    });
    expect(gradingReportDocument?.applicableCombos).toHaveLength(9);
  });

  it('tracks every currently supported live rule combo for the first-pass formal document scope', async () => {
    const rulesDirectory = resolve(process.cwd(), 'rules');
    const files = await findRuleYamlFiles(rulesDirectory);
    const definitions = await Promise.all(
      files
        .filter((filePath) => !filePath.endsWith('document-matrix.yaml'))
        .map((filePath) =>
          loadRuleDefinitionFromFile(filePath, rulesDirectory),
        ),
    );
    const matrix = await loadSupportedDocumentMatrix();

    const supportedRuleCombos = definitions
      .map((definition) => `${definition.market}/${definition.product}`)
      .sort();
    const matrixCombos = matrix.supportedCombos
      .map((combo) => `${combo.market}/${combo.product}`)
      .sort();

    expect(matrixCombos).toEqual(supportedRuleCombos);
  });

  it('keeps committed OCR fixture manifest rows aligned for every currently fixture-backed document label', async () => {
    const matrix = await loadSupportedDocumentMatrix();
    const manifest = await loadOcrFixtureManifest();

    expect(manifest.version).toBe(matrix.version);
    expect(matrix.documents.map((document) => document.documentLabel)).toEqual(
      expect.arrayContaining(
        manifest.documents.map((document) => document.documentLabel),
      ),
    );
    expect(
      manifest.documents.map((document) => document.documentLabel),
    ).toContain('Grading Report');

    for (const document of manifest.documents) {
      const matrixDocument = matrix.documents.find(
        (entry) => entry.documentLabel === document.documentLabel,
      );

      expect(matrixDocument).toBeDefined();
      expect(
        document.assetPath.startsWith('frontend/e2e/test-assets/ocr-forms/'),
      ).toBe(true);
      expect(document.applicableCombos.slice().sort()).toEqual(
        [...(matrixDocument?.applicableCombos ?? [])].sort(),
      );
      expect(document.expectedFieldCompleteness).toBeDefined();
      expect(
        document.expectedFieldCompleteness?.presentFieldKeys.length,
      ).toBeGreaterThan(0);
      expect(document.expectedFieldCompleteness?.missingFieldKeys).toEqual(
        expect.any(Array),
      );
      expect(
        document.expectedFieldCompleteness?.lowConfidenceFieldKeys,
      ).toEqual(expect.any(Array));
      expect(document.expectedFieldCompleteness?.unsupportedFieldKeys).toEqual(
        expect.any(Array),
      );
      await expect(
        access(resolve(process.cwd(), document.assetPath)),
      ).resolves.toBeUndefined();
    }
  });

  it('keeps fixture-backed document artifact families aligned between the matrix and manifest', async () => {
    const [matrix, manifest] = await Promise.all([
      loadSupportedDocumentMatrix(),
      loadOcrFixtureManifest(),
    ]);

    for (const manifestDocument of manifest.documents) {
      const matrixDocument = matrix.documents.find(
        (entry) => entry.documentLabel === manifestDocument.documentLabel,
      );

      expect(matrixDocument).toBeDefined();
      expect(manifestDocument.artifactType).toBe(matrixDocument?.artifactType);
    }
  });

  it('keeps current runtime checklist identity aligned with the canonical artifact family for supported labels', async () => {
    const matrix = await loadSupportedDocumentMatrix();
    const expectations = [
      {
        documentLabel: 'Phytosanitary Certificate',
        expectedArtifactType: 'PHYTO_CERT' as const,
        wrongArtifactType: 'INVOICE' as const,
        fileName: 'phytosanitary-certificate.pdf',
      },
      {
        documentLabel: 'VHT Certificate',
        expectedArtifactType: 'VHT_CERT' as const,
        wrongArtifactType: 'INVOICE' as const,
        fileName: 'vht-certificate.pdf',
      },
      {
        documentLabel: 'MRL Test Results',
        expectedArtifactType: 'MRL_TEST' as const,
        wrongArtifactType: 'INVOICE' as const,
        fileName: 'mrl-test-results.pdf',
      },
      {
        documentLabel: 'GAP Certificate',
        expectedArtifactType: 'GAP_CERT' as const,
        wrongArtifactType: 'INVOICE' as const,
        fileName: 'gap-certificate.pdf',
      },
      {
        documentLabel: 'Commercial Invoice',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'commercial-invoice.pdf',
      },
      {
        documentLabel: 'Export License',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'export-license.pdf',
      },
      {
        documentLabel: 'Grading Report',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'grading-report.pdf',
      },
      {
        documentLabel: 'Packing List',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'packing-list.pdf',
      },
      {
        documentLabel: 'Transport Document',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'transport-document.pdf',
      },
      {
        documentLabel: 'Delivery Note',
        expectedArtifactType: 'INVOICE' as const,
        wrongArtifactType: 'CHECKPOINT_PHOTO' as const,
        fileName: 'delivery-note.pdf',
      },
    ];

    for (const expectation of expectations) {
      const matrixDocument = matrix.documents.find(
        (entry) => entry.documentLabel === expectation.documentLabel,
      );

      const positiveChecklistItem = buildChecklistForDocument(
        expectation.documentLabel,
        {
          id: `artifact-${expectation.documentLabel}-expected`,
          artifactType: expectation.expectedArtifactType,
          fileName: expectation.fileName,
          metadata: buildMetadataForExpectedArtifact(
            expectation.documentLabel,
            expectation.expectedArtifactType,
          ),
        },
      );
      const negativeChecklistItem = buildChecklistForDocument(
        expectation.documentLabel,
        {
          id: `artifact-${expectation.documentLabel}-wrong`,
          artifactType: expectation.wrongArtifactType,
          fileName: 'wrong-artifact.bin',
          metadata: null,
        },
      );

      expect(matrixDocument?.artifactType).toBe(
        expectation.expectedArtifactType,
      );
      expect(positiveChecklistItem?.present).toBe(true);
      expect(negativeChecklistItem?.status).toBe('MISSING');
    }
  });

  it('keeps current CI invariants scoped to matrix-backed and fixture-backed document families only', async () => {
    const matrix = await loadSupportedDocumentMatrix();

    expect(
      matrix.documents.some(
        (document) => document.documentLabel === 'Product Photos',
      ),
    ).toBe(false);
    expect(
      matrix.documents.some(
        (document) => document.documentLabel === 'Temperature Log',
      ),
    ).toBe(false);
    expect(
      matrix.documents.some(
        (document) => document.documentLabel === 'SLA Summary',
      ),
    ).toBe(false);
    expect(
      matrix.documents.some(
        (document) => document.documentLabel === 'Excursion Report',
      ),
    ).toBe(false);
    expect(
      matrix.documents.some(
        (document) => document.documentLabel === 'Handoff Signatures',
      ),
    ).toBe(false);
  });

  it('keeps frontend backend seed helper artifact families aligned for the matrix-backed labels it seeds', async () => {
    const helperSource = await readFile(
      resolve(process.cwd(), 'frontend/e2e/helpers/backend.ts'),
      'utf8',
    );
    const helperLines = helperSource.split('\n');
    const expectations = [
      ['MRL Test Results', 'MRL_TEST', 'mrl-test-report.pdf'],
      ['VHT Certificate', 'VHT_CERT', 'vht-certificate.pdf'],
      [
        'Phytosanitary Certificate',
        'PHYTO_CERT',
        'phytosanitary-certificate.pdf',
      ],
      ['GAP Certificate', 'GAP_CERT', 'gap-certificate.pdf'],
      ['Export License', 'INVOICE', 'export-license.pdf'],
      ['Commercial Invoice', 'INVOICE', 'commercial-invoice.pdf'],
      ['Grading Report', 'INVOICE', 'grading-report.pdf'],
      ['Packing List', 'INVOICE', 'packing-list.pdf'],
      ['Transport Document', 'INVOICE', 'transport-document.pdf'],
      ['Delivery Note', 'INVOICE', 'delivery-note.pdf'],
    ] as const;

    for (const [documentLabel, artifactType, fileName] of expectations) {
      const documentTypeLineIndex = helperLines.findIndex((line) =>
        line.includes(`documentType: '${documentLabel}'`),
      );

      expect(documentTypeLineIndex).toBeGreaterThan(-1);

      const entryWindow = helperLines.slice(
        Math.max(0, documentTypeLineIndex - 8),
        documentTypeLineIndex + 1,
      );

      expect(entryWindow).toEqual(
        expect.arrayContaining([
          expect.stringContaining(`artifactType: '${artifactType}'`),
          expect.stringContaining(`fileName: '${fileName}'`),
          expect.stringContaining(`documentType: '${documentLabel}'`),
        ]),
      );
    }
  });

  it('loads committed machine-readable OCR policy exceptions for unresolved disputes', async () => {
    const exceptions = await loadOcrPolicyExceptions();

    expect(exceptions.version).toBe(1);
    expect(exceptions.exceptions).toEqual(
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

  it('has committed combo-specific OCR fixture variants for every override-bearing matrix combo', async () => {
    const matrix = await loadSupportedDocumentMatrix();
    const manifest = await loadOcrFixtureManifest();

    const overrideEntries = matrix.documents.flatMap((document) =>
      (document.marketSpecificFieldRules ?? []).map((rule) => ({
        documentLabel: document.documentLabel,
        combo: rule.combo,
        requiredFieldKeys: [...rule.requiredFieldKeys].sort(),
      })),
    );

    expect(overrideEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentLabel: 'Phytosanitary Certificate',
          combo: 'JAPAN/MANGO',
        }),
        expect.objectContaining({
          documentLabel: 'Phytosanitary Certificate',
          combo: 'JAPAN/MANGOSTEEN',
        }),
        expect.objectContaining({
          documentLabel: 'Phytosanitary Certificate',
          combo: 'KOREA/MANGOSTEEN',
        }),
        expect.objectContaining({
          documentLabel: 'VHT Certificate',
          combo: 'JAPAN/MANGO',
        }),
        expect.objectContaining({
          documentLabel: 'VHT Certificate',
          combo: 'JAPAN/MANGOSTEEN',
        }),
        expect.objectContaining({
          documentLabel: 'VHT Certificate',
          combo: 'KOREA/MANGO',
        }),
      ]),
    );

    for (const overrideEntry of overrideEntries) {
      const manifestDocument = manifest.documents.find(
        (document) => document.documentLabel === overrideEntry.documentLabel,
      );
      const variant = manifestDocument?.variants?.find(
        (entry) => entry.combo === overrideEntry.combo,
      );

      expect(variant).toBeDefined();
      expect([...(variant?.requiredFieldKeys ?? [])].sort()).toEqual(
        overrideEntry.requiredFieldKeys,
      );
      expect(variant?.expectedFieldCompleteness).toBeDefined();
      expect(variant?.expectedFieldCompleteness?.presentFieldKeys).toEqual(
        expect.arrayContaining(overrideEntry.requiredFieldKeys),
      );
      await expect(
        access(resolve(process.cwd(), variant?.assetPath ?? '')),
      ).resolves.toBeUndefined();
    }
  });

  it('can build a strict OCR readiness ledger for every current required slot', async () => {
    const matrix = await loadSupportedDocumentMatrix();
    const ledger = await buildOcrReadinessLedger();

    const requiredSlotCount = matrix.supportedCombos.reduce(
      (total, combo) => total + combo.requiredDocuments.length,
      0,
    );

    expect(ledger.totalRequiredSlots).toBe(requiredSlotCount);
    expect(ledger.entries).toHaveLength(requiredSlotCount);
    expect(ledger.fullyReadySlots).toBeGreaterThan(0);
  });

  it('surfaces standalone required document families that are not yet modeled in the first-pass matrix', async () => {
    const audit = await buildOcrScopeExpansionAudit();

    expect(audit.currentMatrixDocumentLabels).toEqual(
      expect.arrayContaining(['Grading Report']),
    );
    expect(audit.extraRequiredDocumentsOutsideFirstPass).not.toContain(
      'Grading Report',
    );
  });
});
