import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as YAML from 'yaml';
import type {
  DocumentMatrixClass,
  DocumentMatrixConfidence,
  DocumentMatrixRule,
  SupportedDocumentCombo,
  SupportedDocumentMatrix,
} from './document-matrix';
import { parseSupportedDocumentMatrix } from './document-matrix';
import type {
  OcrFixtureManifest,
  OcrFixtureManifestEntry,
} from './ocr-fixture-manifest';
import { parseOcrFixtureManifest } from './ocr-fixture-manifest';
import type {
  EvidenceArtifactType,
  EvidenceDocumentFieldCompleteness,
} from './evidence.types';
import {
  RuleChecklistCategory,
  type RuleLaneArtifact,
  type RuleMarket,
  type RuleProduct,
} from '../rules-engine/rules-engine.types';

export type ComboId = `${RuleMarket}/${RuleProduct}`;

export type DocumentCatalogChecklistMatchMode =
  | 'ARTIFACT_TYPE_ONLY'
  | 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK';

export type ChecklistMatchSource =
  | 'ARTIFACT_TYPE'
  | 'METADATA_DOCUMENT_TYPE'
  | 'OCR_DOCUMENT_LABEL'
  | 'FILE_NAME_FALLBACK';

export interface DocumentCatalogChecklistMatch {
  matched: boolean;
  source: ChecklistMatchSource | null;
}

export interface DocumentCatalogFixtureVariant {
  combo: ComboId;
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

export interface DocumentCatalogFixture {
  assetPath: string;
  applicableCombos: ComboId[];
  expectedFieldCompleteness: Pick<
    EvidenceDocumentFieldCompleteness,
    | 'presentFieldKeys'
    | 'missingFieldKeys'
    | 'lowConfidenceFieldKeys'
    | 'unsupportedFieldKeys'
  >;
  variants: DocumentCatalogFixtureVariant[];
}

export interface DocumentCatalogEntry {
  documentLabel: string;
  artifactType: EvidenceArtifactType;
  checklistCategory: RuleChecklistCategory;
  checklistMatchMode: DocumentCatalogChecklistMatchMode;
  matrixBacked: boolean;
  fixtureBacked: boolean;
  documentClass: DocumentMatrixClass | null;
  documentRole: string | null;
  confidence: DocumentMatrixConfidence | null;
  applicableCombos: ComboId[];
  sourceUrls: string[];
  requiredFieldKeys: string[];
  marketSpecificFieldRules: DocumentMatrixRule[];
  notes: string[];
  fixture: DocumentCatalogFixture | null;
}

export interface DocumentCatalogRequiredSlot {
  combo: ComboId;
  documentLabel: string;
  artifactType: EvidenceArtifactType;
  fixturePath: string;
  expectedPresentFieldKeys: readonly string[];
  requiredFieldKeys: readonly string[];
  hasVariantFixture: boolean;
}

export interface DocumentCatalog {
  version: number;
  supportedCombos: SupportedDocumentCombo[];
  entries: DocumentCatalogEntry[];
  entriesByLabel: Map<string, DocumentCatalogEntry>;
  fixtureBackedRequiredSlots: DocumentCatalogRequiredSlot[];
}

const REPO_ROOT = resolve(__dirname, '../../..');
const MATRIX_PATH = resolve(REPO_ROOT, 'rules/document-matrix.yaml');
const FIXTURE_MANIFEST_PATH = resolve(
  REPO_ROOT,
  'frontend/e2e/test-assets/ocr-forms/manifest.json',
);

const CHECKLIST_SEMANTICS = new Map<
  string,
  {
    category: RuleChecklistCategory;
    matchMode: DocumentCatalogChecklistMatchMode;
    artifactType?: EvidenceArtifactType;
  }
>([
  [
    'Phytosanitary Certificate',
    {
      category: RuleChecklistCategory.REGULATORY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
    },
  ],
  [
    'VHT Certificate',
    {
      category: RuleChecklistCategory.REGULATORY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
    },
  ],
  [
    'MRL Test Results',
    {
      category: RuleChecklistCategory.REGULATORY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
    },
  ],
  [
    'Export License',
    {
      category: RuleChecklistCategory.REGULATORY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'GAP Certificate',
    {
      category: RuleChecklistCategory.REGULATORY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
    },
  ],
  [
    'Grading Report',
    {
      category: RuleChecklistCategory.QUALITY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'Commercial Invoice',
    {
      category: RuleChecklistCategory.CHAIN_OF_CUSTODY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'Packing List',
    {
      category: RuleChecklistCategory.CHAIN_OF_CUSTODY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'Transport Document',
    {
      category: RuleChecklistCategory.CHAIN_OF_CUSTODY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'Delivery Note',
    {
      category: RuleChecklistCategory.CHAIN_OF_CUSTODY,
      matchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
    },
  ],
  [
    'Product Photos',
    {
      category: RuleChecklistCategory.QUALITY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'CHECKPOINT_PHOTO',
    },
  ],
  [
    'Temperature Log',
    {
      category: RuleChecklistCategory.COLD_CHAIN,
      matchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'TEMP_DATA',
    },
  ],
  [
    'SLA Summary',
    {
      category: RuleChecklistCategory.COLD_CHAIN,
      matchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'TEMP_DATA',
    },
  ],
  [
    'Excursion Report',
    {
      category: RuleChecklistCategory.COLD_CHAIN,
      matchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'TEMP_DATA',
    },
  ],
  [
    'Handoff Signatures',
    {
      category: RuleChecklistCategory.CHAIN_OF_CUSTODY,
      matchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'HANDOFF_SIGNATURE',
    },
  ],
]);

let documentCatalogCache: DocumentCatalog | null = null;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function matchesFileNameFallback(
  fileName: string,
  documentLabel: string,
): boolean {
  return slugify(fileName).includes(slugify(documentLabel));
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function fixtureFromManifestEntry(
  manifestEntry: OcrFixtureManifestEntry | null,
): DocumentCatalogFixture | null {
  if (manifestEntry === null) {
    return null;
  }

  return {
    assetPath: manifestEntry.assetPath,
    applicableCombos: [...manifestEntry.applicableCombos],
    expectedFieldCompleteness: manifestEntry.expectedFieldCompleteness,
    variants: (manifestEntry.variants ?? []).map((variant) => ({
      combo: variant.combo,
      assetPath: variant.assetPath,
      requiredFieldKeys: [...variant.requiredFieldKeys],
      expectedFieldCompleteness: variant.expectedFieldCompleteness,
    })),
  };
}

function requiredFieldKeysForCombo(
  entry: DocumentCatalogEntry,
  combo: ComboId,
): string[] {
  return [
    ...new Set([
      ...entry.requiredFieldKeys,
      ...(entry.marketSpecificFieldRules.find((rule) => rule.combo === combo)
        ?.requiredFieldKeys ?? []),
    ]),
  ].sort();
}

export function buildDocumentCatalog(
  matrix: SupportedDocumentMatrix,
  manifest: OcrFixtureManifest,
): DocumentCatalog {
  if (manifest.version !== matrix.version) {
    throw new Error(
      `Document catalog version mismatch: matrix=${matrix.version}, manifest=${manifest.version}.`,
    );
  }

  const manifestByLabel = new Map<string, OcrFixtureManifestEntry>(
    manifest.documents.map((document) => [document.documentLabel, document]),
  );
  const entries = matrix.documents.map<DocumentCatalogEntry>((document) => {
    const semantics = CHECKLIST_SEMANTICS.get(document.documentLabel);
    const manifestEntry = manifestByLabel.get(document.documentLabel) ?? null;

    if (manifestEntry && manifestEntry.artifactType !== document.artifactType) {
      throw new Error(
        `Fixture manifest artifact type drift for ${document.documentLabel}.`,
      );
    }

    return {
      documentLabel: document.documentLabel,
      artifactType: document.artifactType,
      checklistCategory:
        semantics?.category ?? RuleChecklistCategory.REGULATORY,
      checklistMatchMode: semantics?.matchMode ?? 'ARTIFACT_TYPE_ONLY',
      matrixBacked: true,
      fixtureBacked: manifestEntry !== null,
      documentClass: document.documentClass,
      documentRole: document.documentRole,
      confidence: document.confidence,
      applicableCombos: [...document.applicableCombos],
      sourceUrls: [...document.sourceUrls],
      requiredFieldKeys: [...document.requiredFieldKeys],
      marketSpecificFieldRules: [...(document.marketSpecificFieldRules ?? [])],
      notes: [...(document.notes ?? [])],
      fixture: fixtureFromManifestEntry(manifestEntry),
    };
  });

  const entriesByLabel = new Map<string, DocumentCatalogEntry>(
    entries.map((entry) => [entry.documentLabel, entry]),
  );

  for (const manifestDocument of manifest.documents) {
    if (!entriesByLabel.has(manifestDocument.documentLabel)) {
      throw new Error(
        `Fixture manifest label ${manifestDocument.documentLabel} is not modeled in the document matrix.`,
      );
    }
  }

  for (const [documentLabel, semantics] of CHECKLIST_SEMANTICS.entries()) {
    if (entriesByLabel.has(documentLabel)) {
      continue;
    }

    if (!semantics.artifactType) {
      throw new Error(
        `Supplemental checklist document ${documentLabel} is missing an artifact type.`,
      );
    }

    const entry: DocumentCatalogEntry = {
      documentLabel,
      artifactType: semantics.artifactType,
      checklistCategory: semantics.category,
      checklistMatchMode: semantics.matchMode,
      matrixBacked: false,
      fixtureBacked: false,
      documentClass: null,
      documentRole: null,
      confidence: null,
      applicableCombos: [],
      sourceUrls: [],
      requiredFieldKeys: [],
      marketSpecificFieldRules: [],
      notes: [],
      fixture: null,
    };
    entries.push(entry);
    entriesByLabel.set(documentLabel, entry);
  }

  const fixtureBackedRequiredSlots = matrix.supportedCombos.flatMap((combo) => {
    const comboId: ComboId = `${combo.market}/${combo.product}`;

    return combo.requiredDocuments.flatMap((documentLabel) => {
      const entry = entriesByLabel.get(documentLabel);
      if (!entry?.fixture) {
        return [];
      }

      const variant =
        entry.fixture.variants.find(
          (candidate) => candidate.combo === comboId,
        ) ?? null;

      return [
        {
          combo: comboId,
          documentLabel,
          artifactType: entry.artifactType,
          fixturePath: variant?.assetPath ?? entry.fixture.assetPath,
          expectedPresentFieldKeys:
            variant?.expectedFieldCompleteness.presentFieldKeys ??
            entry.fixture.expectedFieldCompleteness.presentFieldKeys,
          requiredFieldKeys: requiredFieldKeysForCombo(entry, comboId),
          hasVariantFixture: variant !== null,
        },
      ];
    });
  });

  return {
    version: matrix.version,
    supportedCombos: matrix.supportedCombos.map((combo) => ({
      market: combo.market,
      product: combo.product,
      requiredDocuments: [...combo.requiredDocuments],
    })),
    entries,
    entriesByLabel,
    fixtureBackedRequiredSlots,
  };
}

function readMatrixSourceSync(): SupportedDocumentMatrix {
  return parseSupportedDocumentMatrix(
    YAML.parse(readFileSync(MATRIX_PATH, 'utf8')),
  );
}

function readFixtureManifestSync(): OcrFixtureManifest {
  return parseOcrFixtureManifest(
    JSON.parse(readFileSync(FIXTURE_MANIFEST_PATH, 'utf8')),
  );
}

export function loadDocumentCatalogSync(): DocumentCatalog {
  if (documentCatalogCache !== null) {
    return documentCatalogCache;
  }

  documentCatalogCache = buildDocumentCatalog(
    readMatrixSourceSync(),
    readFixtureManifestSync(),
  );
  return documentCatalogCache;
}

export function loadDocumentCatalog(): Promise<DocumentCatalog> {
  return Promise.resolve(loadDocumentCatalogSync());
}

export function getDocumentCatalogEntrySync(
  documentLabel: string,
): DocumentCatalogEntry | null {
  return loadDocumentCatalogSync().entriesByLabel.get(documentLabel) ?? null;
}

export function resolveChecklistDocumentCategory(
  documentLabel: string,
): RuleChecklistCategory {
  return (
    getDocumentCatalogEntrySync(documentLabel)?.checklistCategory ??
    RuleChecklistCategory.REGULATORY
  );
}

export function matchChecklistDocumentAgainstArtifact(
  documentLabel: string,
  artifact: Pick<
    RuleLaneArtifact,
    'artifactType' | 'fileName' | 'metadata' | 'latestAnalysisDocumentLabel'
  >,
): DocumentCatalogChecklistMatch {
  const documentKey = normalizeKey(documentLabel);
  const metadata = artifact.metadata ?? {};
  const metadataDocumentType =
    readString(metadata, 'documentType') ??
    readString(metadata, 'documentName');
  const ocrDocumentLabel =
    artifact.latestAnalysisDocumentLabel === null ||
    artifact.latestAnalysisDocumentLabel === undefined
      ? null
      : normalizeKey(artifact.latestAnalysisDocumentLabel);
  const entry = getDocumentCatalogEntrySync(documentLabel);

  if (
    metadataDocumentType !== null &&
    normalizeKey(metadataDocumentType) === documentKey
  ) {
    return { matched: true, source: 'METADATA_DOCUMENT_TYPE' };
  }

  if (ocrDocumentLabel !== null && ocrDocumentLabel === documentKey) {
    return { matched: true, source: 'OCR_DOCUMENT_LABEL' };
  }

  if (entry === null) {
    return {
      matched: matchesFileNameFallback(artifact.fileName, documentLabel),
      source: matchesFileNameFallback(artifact.fileName, documentLabel)
        ? 'FILE_NAME_FALLBACK'
        : null,
    };
  }

  if (artifact.artifactType === entry.artifactType) {
    if (entry.checklistMatchMode === 'ARTIFACT_TYPE_ONLY') {
      return { matched: true, source: 'ARTIFACT_TYPE' };
    }

    if (matchesFileNameFallback(artifact.fileName, documentLabel)) {
      return { matched: true, source: 'FILE_NAME_FALLBACK' };
    }
  }

  return { matched: false, source: null };
}

export function resetDocumentCatalogCacheForTests(): void {
  documentCatalogCache = null;
}
