import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as YAML from 'yaml';
import type { EvidenceArtifactType } from './evidence.types';
import type {
  RuleMarket,
  RuleProduct,
} from '../rules-engine/rules-engine.types';

export type DocumentMatrixClass =
  | 'OFFICIAL_GOVERNMENT_FORM'
  | 'TREATMENT_EVIDENCE'
  | 'LAB_REPORT'
  | 'CERTIFICATION_SCHEMA'
  | 'TRADE_DOCUMENT';

export type DocumentMatrixConfidence =
  | 'HIGH'
  | 'MEDIUM_HIGH'
  | 'MEDIUM'
  | 'MEDIUM_LOW'
  | 'LOW_MEDIUM';

export interface SupportedDocumentCombo {
  market: RuleMarket;
  product: RuleProduct;
  requiredDocuments: string[];
}

export interface DocumentMatrixRule {
  combo: `${RuleMarket}/${RuleProduct}`;
  requiredFieldKeys: string[];
}

export interface SupportedDocumentDefinition {
  documentLabel: string;
  artifactType: EvidenceArtifactType;
  documentClass: DocumentMatrixClass;
  documentRole: string;
  confidence: DocumentMatrixConfidence;
  applicableCombos: Array<`${RuleMarket}/${RuleProduct}`>;
  sourceUrls: string[];
  requiredFieldKeys: string[];
  marketSpecificFieldRules?: DocumentMatrixRule[];
  notes?: string[];
}

export interface SupportedDocumentMatrix {
  version: number;
  artifactTypes: EvidenceArtifactType[];
  supportedCombos: SupportedDocumentCombo[];
  documents: SupportedDocumentDefinition[];
}

const MATRIX_FILE_PATH = resolve(process.cwd(), 'rules/document-matrix.yaml');

function assertStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`Invalid ${context}[${index}].`);
    }

    return entry;
  });
}

function assertCombo(
  value: unknown,
  context: string,
): `${RuleMarket}/${RuleProduct}` {
  if (typeof value !== 'string' || !/^[A-Z]+\/[A-Z]+$/.test(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value as `${RuleMarket}/${RuleProduct}`;
}

function parseMatrix(raw: unknown): SupportedDocumentMatrix {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid document matrix root.');
  }

  const record = raw as Record<string, unknown>;
  if (typeof record['version'] !== 'number') {
    throw new Error('Invalid document matrix version.');
  }

  const artifactTypes = assertStringArray(
    record['artifactTypes'],
    'document matrix artifactTypes',
  ) as EvidenceArtifactType[];
  const supportedCombosRaw = record['supportedCombos'];
  if (!Array.isArray(supportedCombosRaw)) {
    throw new Error('Invalid document matrix supportedCombos.');
  }

  const supportedCombos: SupportedDocumentCombo[] = supportedCombosRaw.map(
    (entry, index) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new Error(`Invalid document matrix supportedCombos[${index}].`);
      }
      const item = entry as Record<string, unknown>;
      if (
        typeof item['market'] !== 'string' ||
        typeof item['product'] !== 'string'
      ) {
        throw new Error(
          `Invalid document matrix supportedCombos[${index}] market/product.`,
        );
      }

      return {
        market: item['market'] as RuleMarket,
        product: item['product'] as RuleProduct,
        requiredDocuments: assertStringArray(
          item['requiredDocuments'],
          `document matrix supportedCombos[${index}] requiredDocuments`,
        ),
      };
    },
  );

  const documentsRaw = record['documents'];
  if (!Array.isArray(documentsRaw)) {
    throw new Error('Invalid document matrix documents.');
  }

  const documents: SupportedDocumentDefinition[] = documentsRaw.map(
    (entry, index) => {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        throw new Error(`Invalid document matrix documents[${index}].`);
      }

      const item = entry as Record<string, unknown>;
      const marketSpecificFieldRulesRaw = item['marketSpecificFieldRules'];
      return {
        documentLabel:
          typeof item['documentLabel'] === 'string'
            ? item['documentLabel']
            : '',
        artifactType: item['artifactType'] as EvidenceArtifactType,
        documentClass: item['documentClass'] as DocumentMatrixClass,
        documentRole:
          typeof item['documentRole'] === 'string' ? item['documentRole'] : '',
        confidence: item['confidence'] as DocumentMatrixConfidence,
        applicableCombos: assertStringArray(
          item['applicableCombos'],
          `document matrix documents[${index}] applicableCombos`,
        ).map((value, comboIndex) =>
          assertCombo(
            value,
            `document matrix documents[${index}] applicableCombos[${comboIndex}]`,
          ),
        ),
        sourceUrls: assertStringArray(
          item['sourceUrls'] ?? [],
          `document matrix documents[${index}] sourceUrls`,
        ),
        requiredFieldKeys: assertStringArray(
          item['requiredFieldKeys'],
          `document matrix documents[${index}] requiredFieldKeys`,
        ),
        marketSpecificFieldRules: Array.isArray(marketSpecificFieldRulesRaw)
          ? marketSpecificFieldRulesRaw.map((rule, ruleIndex) => {
              if (
                typeof rule !== 'object' ||
                rule === null ||
                Array.isArray(rule)
              ) {
                throw new Error(
                  `Invalid document matrix documents[${index}] marketSpecificFieldRules[${ruleIndex}].`,
                );
              }

              const typedRule = rule as Record<string, unknown>;
              return {
                combo: assertCombo(
                  typedRule['combo'],
                  `document matrix documents[${index}] marketSpecificFieldRules[${ruleIndex}] combo`,
                ),
                requiredFieldKeys: assertStringArray(
                  typedRule['requiredFieldKeys'],
                  `document matrix documents[${index}] marketSpecificFieldRules[${ruleIndex}] requiredFieldKeys`,
                ),
              };
            })
          : undefined,
        notes:
          item['notes'] === undefined
            ? undefined
            : assertStringArray(
                item['notes'],
                `document matrix documents[${index}] notes`,
              ),
      };
    },
  );

  return {
    version: record['version'],
    artifactTypes,
    supportedCombos,
    documents,
  };
}

export async function loadSupportedDocumentMatrix(): Promise<SupportedDocumentMatrix> {
  const source = await readFile(MATRIX_FILE_PATH, 'utf8');
  return parseMatrix(YAML.parse(source));
}
