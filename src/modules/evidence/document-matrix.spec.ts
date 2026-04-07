import { resolve } from 'node:path';
import {
  findRuleYamlFiles,
  loadRuleDefinitionFromFile,
} from '../rules-engine/rule-definition.files';
import { loadSupportedDocumentMatrix } from './document-matrix';

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
});
