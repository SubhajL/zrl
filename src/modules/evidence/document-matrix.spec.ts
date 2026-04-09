import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  findRuleYamlFiles,
  loadRuleDefinitionFromFile,
} from '../rules-engine/rule-definition.files';
import { loadSupportedDocumentMatrix } from './document-matrix';
import { loadOcrFixtureManifest } from './ocr-fixture-manifest';
import { buildOcrReadinessLedger } from './ocr-readiness-ledger';
import { buildOcrScopeExpansionAudit } from './ocr-scope-expansion-audit';

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

  it('has a committed canonical OCR fixture manifest for every first-pass document label', async () => {
    const matrix = await loadSupportedDocumentMatrix();
    const manifest = await loadOcrFixtureManifest();

    expect(manifest.version).toBe(matrix.version);
    expect(
      manifest.documents.map((document) => document.documentLabel).sort(),
    ).toEqual(
      matrix.documents.map((document) => document.documentLabel).sort(),
    );

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

    expect(audit.extraRequiredDocumentsOutsideFirstPass).toEqual(
      expect.arrayContaining(['Grading Report']),
    );
  });
});
