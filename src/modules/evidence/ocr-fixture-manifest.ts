import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { EvidenceDocumentFieldCompleteness } from './evidence.types';
import type { EvidenceArtifactType } from './evidence.types';
import type {
  RuleMarket,
  RuleProduct,
} from '../rules-engine/rules-engine.types';

export interface OcrFixtureVariantManifestEntry {
  combo: `${RuleMarket}/${RuleProduct}`;
  assetPath: string;
  requiredFieldKeys: string[];
  expectedFieldCompleteness: Pick<
    EvidenceDocumentFieldCompleteness,
    | 'presentFieldKeys'
    | 'missingFieldKeys'
    | 'lowConfidenceFieldKeys'
    | 'unsupportedFieldKeys'
  >;
}

export interface OcrFixtureManifestEntry {
  documentLabel: string;
  artifactType: EvidenceArtifactType;
  assetPath: string;
  applicableCombos: Array<`${RuleMarket}/${RuleProduct}`>;
  expectedFieldCompleteness: Pick<
    EvidenceDocumentFieldCompleteness,
    | 'presentFieldKeys'
    | 'missingFieldKeys'
    | 'lowConfidenceFieldKeys'
    | 'unsupportedFieldKeys'
  >;
  variants?: OcrFixtureVariantManifestEntry[];
}

export interface OcrFixtureManifest {
  version: number;
  documents: OcrFixtureManifestEntry[];
}

const OCR_FIXTURE_MANIFEST_PATH = resolve(
  process.cwd(),
  'frontend/e2e/test-assets/ocr-forms/manifest.json',
);

function assertStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`Invalid OCR fixture manifest ${label}.`);
  }

  return value.map((entry) => {
    if (typeof entry !== 'string') {
      throw new Error(`Invalid OCR fixture manifest ${label}.`);
    }

    return entry;
  });
}

function parseExpectedFieldCompleteness(
  value: unknown,
  label: string,
): OcrFixtureManifestEntry['expectedFieldCompleteness'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid OCR fixture manifest ${label}.`);
  }

  const record = value as Record<string, unknown>;
  return {
    presentFieldKeys: assertStringArray(
      record['presentFieldKeys'],
      `${label}.presentFieldKeys`,
    ),
    missingFieldKeys: assertStringArray(
      record['missingFieldKeys'],
      `${label}.missingFieldKeys`,
    ),
    lowConfidenceFieldKeys: assertStringArray(
      record['lowConfidenceFieldKeys'],
      `${label}.lowConfidenceFieldKeys`,
    ),
    unsupportedFieldKeys: assertStringArray(
      record['unsupportedFieldKeys'],
      `${label}.unsupportedFieldKeys`,
    ),
  };
}

function parseManifest(raw: unknown): OcrFixtureManifest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid OCR fixture manifest root.');
  }

  const record = raw as Record<string, unknown>;
  if (typeof record['version'] !== 'number') {
    throw new Error('Invalid OCR fixture manifest version.');
  }

  if (!Array.isArray(record['documents'])) {
    throw new Error('Invalid OCR fixture manifest documents.');
  }

  const documents = record['documents'].map((document, index) => {
    if (
      typeof document !== 'object' ||
      document === null ||
      Array.isArray(document)
    ) {
      throw new Error(`Invalid OCR fixture manifest documents[${index}].`);
    }

    const item = document as Record<string, unknown>;
    if (
      typeof item['documentLabel'] !== 'string' ||
      typeof item['artifactType'] !== 'string' ||
      typeof item['assetPath'] !== 'string'
    ) {
      throw new Error(
        `Invalid OCR fixture manifest documents[${index}] identity fields.`,
      );
    }

    const variants =
      item['variants'] === undefined
        ? undefined
        : (() => {
            if (!Array.isArray(item['variants'])) {
              throw new Error(
                `Invalid OCR fixture manifest documents[${index}].variants.`,
              );
            }

            return item['variants'].map((variant, variantIndex) => {
              if (
                typeof variant !== 'object' ||
                variant === null ||
                Array.isArray(variant)
              ) {
                throw new Error(
                  `Invalid OCR fixture manifest documents[${index}].variants[${variantIndex}].`,
                );
              }

              const variantRecord = variant as Record<string, unknown>;
              if (
                typeof variantRecord['combo'] !== 'string' ||
                typeof variantRecord['assetPath'] !== 'string'
              ) {
                throw new Error(
                  `Invalid OCR fixture manifest documents[${index}].variants[${variantIndex}] identity fields.`,
                );
              }

              return {
                combo: variantRecord['combo'] as `${RuleMarket}/${RuleProduct}`,
                assetPath: variantRecord['assetPath'],
                requiredFieldKeys: assertStringArray(
                  variantRecord['requiredFieldKeys'],
                  `documents[${index}].variants[${variantIndex}].requiredFieldKeys`,
                ),
                expectedFieldCompleteness: parseExpectedFieldCompleteness(
                  variantRecord['expectedFieldCompleteness'],
                  `documents[${index}].variants[${variantIndex}].expectedFieldCompleteness`,
                ),
              } satisfies OcrFixtureVariantManifestEntry;
            });
          })();

    return {
      documentLabel: item['documentLabel'],
      artifactType: item['artifactType'] as EvidenceArtifactType,
      assetPath: item['assetPath'],
      applicableCombos: assertStringArray(
        item['applicableCombos'],
        `documents[${index}].applicableCombos`,
      ) as Array<`${RuleMarket}/${RuleProduct}`>,
      expectedFieldCompleteness: parseExpectedFieldCompleteness(
        item['expectedFieldCompleteness'],
        `documents[${index}].expectedFieldCompleteness`,
      ),
      variants,
    } satisfies OcrFixtureManifestEntry;
  });

  return {
    version: record['version'],
    documents,
  };
}

export async function loadOcrFixtureManifest(): Promise<OcrFixtureManifest> {
  const source = await readFile(OCR_FIXTURE_MANIFEST_PATH, 'utf8');
  return parseManifest(JSON.parse(source));
}

export async function readOcrFixtureText(assetPath: string): Promise<string> {
  return readFile(resolve(process.cwd(), assetPath), 'utf8');
}

export function stripSvgToText(svgSource: string): string {
  return svgSource
    .replace(/<\/(?:text|tspan)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

export async function loadOcrFixtureText(assetPath: string): Promise<string> {
  return stripSvgToText(await readOcrFixtureText(assetPath));
}
