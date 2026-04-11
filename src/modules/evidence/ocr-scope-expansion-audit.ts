import {
  findRuleYamlFiles,
  loadRuleDefinitionFromFile,
} from '../rules-engine/rule-definition.files';
import { loadSupportedDocumentMatrix } from './document-matrix';
import { loadOcrPolicyExceptions } from './ocr-policy-exceptions';
import { resolve } from 'node:path';

export interface OcrScopeExpansionAuditResult {
  currentMatrixDocumentLabels: string[];
  extraRequiredDocumentsOutsideFirstPass: string[];
  requiredDocumentsCoveredByExistingMatrix: string[];
  nonDocumentControlsModeledAsFieldOrRuleConstraints: string[];
  policyExceptions: Array<{
    combo: string;
    documentLabel: string;
    status: string;
    exceptionType: string;
    summary: string;
  }>;
}

const NON_DOCUMENT_CONTROL_LABELS = new Set([
  'Product Photos',
  'Temperature Log',
  'SLA Summary',
  'Excursion Report',
  'Handoff Signatures',
]);

export async function buildOcrScopeExpansionAudit(): Promise<OcrScopeExpansionAuditResult> {
  const [matrix, files, policyExceptions] = await Promise.all([
    loadSupportedDocumentMatrix(),
    findRuleYamlFiles(resolve(process.cwd(), 'rules')),
    loadOcrPolicyExceptions(),
  ]);

  const definitions = await Promise.all(
    files.map((filePath) =>
      loadRuleDefinitionFromFile(filePath, resolve(process.cwd(), 'rules')),
    ),
  );

  const currentMatrixDocumentLabels = [...matrix.documents]
    .map((document) => document.documentLabel)
    .sort();
  const currentMatrixDocumentLabelSet = new Set(currentMatrixDocumentLabels);

  const allRequiredDocuments = [
    ...new Set(
      definitions.flatMap((definition) => definition.requiredDocuments),
    ),
  ].sort();

  const extraRequiredDocumentsOutsideFirstPass = allRequiredDocuments.filter(
    (documentLabel) =>
      !currentMatrixDocumentLabelSet.has(documentLabel) &&
      !NON_DOCUMENT_CONTROL_LABELS.has(documentLabel),
  );

  const requiredDocumentsCoveredByExistingMatrix = allRequiredDocuments.filter(
    (documentLabel) => currentMatrixDocumentLabelSet.has(documentLabel),
  );

  return {
    currentMatrixDocumentLabels,
    extraRequiredDocumentsOutsideFirstPass,
    requiredDocumentsCoveredByExistingMatrix,
    nonDocumentControlsModeledAsFieldOrRuleConstraints: [
      'KOREA/MANGO overseas inspection and registration are modeled as VHT fields/constraints.',
      'KOREA/MANGOSTEEN fumigation, registration, and overseas inspection are modeled on the phytosanitary path, not as separate document uploads.',
      'JAPAN/MANGOSTEEN certificate-label control is modeled as phytosanitary/VHT field requirements, not a separate document family.',
    ],
    policyExceptions: policyExceptions.exceptions.map((entry) => ({
      combo: entry.combo,
      documentLabel: entry.documentLabel,
      status: entry.status,
      exceptionType: entry.exceptionType,
      summary: entry.summary,
    })),
  };
}
