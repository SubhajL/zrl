import type {
  SupportedDocumentDefinition,
  SupportedDocumentMatrix,
} from './document-matrix';
import { loadSupportedDocumentMatrix } from './document-matrix';
import type {
  OcrFixtureManifest,
  OcrFixtureManifestEntry,
  OcrFixtureVariantManifestEntry,
} from './ocr-fixture-manifest';
import { loadOcrFixtureManifest } from './ocr-fixture-manifest';
import {
  loadOcrPolicyExceptions,
  type OcrPolicyExceptionEntry,
} from './ocr-policy-exceptions';
import type {
  RuleMarket,
  RuleProduct,
} from '../rules-engine/rules-engine.types';

export type OcrReadinessProofStatus = 'COMPLETE' | 'PARTIAL' | 'MISSING';

export interface OcrReadinessLedgerEntry {
  combo: `${RuleMarket}/${RuleProduct}`;
  documentLabel: string;
  artifactType: string;
  requiredFieldKeys: string[];
  fixture: {
    status: OcrReadinessProofStatus;
    assetPath: string | null;
    variantAssetPath: string | null;
  };
  classifierProof: {
    status: OcrReadinessProofStatus;
    reason: string;
  };
  backendProof: {
    status: OcrReadinessProofStatus;
    reason: string;
  };
  browserProof: {
    status: OcrReadinessProofStatus;
    reason: string;
  };
  policyExceptions: OcrPolicyExceptionEntry[];
  ready: boolean;
  blockerReasons: string[];
}

export interface OcrReadinessLedger {
  version: number;
  totalRequiredSlots: number;
  fullyReadySlots: number;
  entries: OcrReadinessLedgerEntry[];
}

const BASE_CLASSIFIER_PROVEN_LABELS = new Set([
  'Phytosanitary Certificate',
  'MRL Test Results',
  'GAP Certificate',
  'Grading Report',
  'Commercial Invoice',
  'Packing List',
  'Transport Document',
  'Delivery Note',
  'Export License',
]);

const FULLY_PROVEN_OVERRIDE_COMBOS = new Set<`${RuleMarket}/${RuleProduct}`>([
  'JAPAN/MANGO',
  'JAPAN/MANGOSTEEN',
  'KOREA/MANGO',
  'KOREA/MANGOSTEEN',
]);

const BACKEND_PROVEN_DOCUMENT_LABELS = new Set([
  'Phytosanitary Certificate',
  'VHT Certificate',
  'GAP Certificate',
  'MRL Test Results',
  'Grading Report',
  'Commercial Invoice',
  'Packing List',
  'Transport Document',
  'Delivery Note',
  'Export License',
]);

function buildBrowserProvenRequiredSlots(
  manifest: OcrFixtureManifest,
): Set<string> {
  return new Set(
    manifest.documents.flatMap((document) => {
      const baseSlots = document.applicableCombos.map(
        (combo) => `${combo}::${document.documentLabel}`,
      );
      const variantSlots = (document.variants ?? []).map(
        (variant) => `${variant.combo}::${document.documentLabel}`,
      );

      return [...baseSlots, ...variantSlots];
    }),
  );
}

function comboKey(
  market: RuleMarket,
  product: RuleProduct,
): `${RuleMarket}/${RuleProduct}` {
  return `${market}/${product}`;
}

function getDocumentDefinition(
  matrix: SupportedDocumentMatrix,
  documentLabel: string,
): SupportedDocumentDefinition {
  const definition = matrix.documents.find(
    (document) => document.documentLabel === documentLabel,
  );
  if (!definition) {
    throw new Error(`Missing document definition for ${documentLabel}.`);
  }

  return definition;
}

function getFixtureEntry(
  manifest: OcrFixtureManifest,
  documentLabel: string,
): OcrFixtureManifestEntry | null {
  return (
    manifest.documents.find(
      (document) => document.documentLabel === documentLabel,
    ) ?? null
  );
}

function getVariantEntry(
  entry: OcrFixtureManifestEntry | null,
  combo: `${RuleMarket}/${RuleProduct}`,
): OcrFixtureVariantManifestEntry | null {
  if (entry === null) {
    return null;
  }

  return entry.variants?.find((variant) => variant.combo === combo) ?? null;
}

function determineClassifierProof(
  combo: `${RuleMarket}/${RuleProduct}`,
  documentLabel: string,
  variant: OcrFixtureVariantManifestEntry | null,
): OcrReadinessLedgerEntry['classifierProof'] {
  if (variant !== null) {
    return FULLY_PROVEN_OVERRIDE_COMBOS.has(combo)
      ? {
          status: 'COMPLETE',
          reason: 'Committed override fixture has classifier proof.',
        }
      : {
          status: 'PARTIAL',
          reason:
            'Override fixture exists but classifier proof is not yet marked complete for this combo.',
        };
  }

  if (documentLabel === 'VHT Certificate') {
    return {
      status: 'PARTIAL',
      reason:
        'VHT classifier proof currently exists through live override combos, not as a universal base-slot proof.',
    };
  }

  return BASE_CLASSIFIER_PROVEN_LABELS.has(documentLabel)
    ? {
        status: 'COMPLETE',
        reason: 'Committed base fixture has classifier proof.',
      }
    : {
        status: 'MISSING',
        reason:
          'Classifier proof has not been recorded for this document label.',
      };
}

function determineBackendProof(
  documentLabel: string,
): OcrReadinessLedgerEntry['backendProof'] {
  return BACKEND_PROVEN_DOCUMENT_LABELS.has(documentLabel)
    ? {
        status: 'COMPLETE',
        reason:
          'Backend OCR integration exists for this document family or its compliance effects.',
      }
    : {
        status: 'MISSING',
        reason:
          'No backend OCR integration proof is recorded for this document family.',
      };
}

function determineBrowserProof(
  combo: `${RuleMarket}/${RuleProduct}`,
  documentLabel: string,
  browserProvenRequiredSlots: Set<string>,
): OcrReadinessLedgerEntry['browserProof'] {
  if (!browserProvenRequiredSlots.has(`${combo}::${documentLabel}`)) {
    return {
      status: 'MISSING',
      reason: 'No browser OCR proof recorded for this exact required slot.',
    };
  }

  return {
    status: 'COMPLETE',
    reason: 'Browser OCR proof exists for this exact required document slot.',
  };
}

export async function buildOcrReadinessLedger(): Promise<OcrReadinessLedger> {
  const [matrix, manifest, policyExceptions] = await Promise.all([
    loadSupportedDocumentMatrix(),
    loadOcrFixtureManifest(),
    loadOcrPolicyExceptions(),
  ]);
  const browserProvenRequiredSlots = buildBrowserProvenRequiredSlots(manifest);

  const entries = matrix.supportedCombos.flatMap((combo) => {
    const comboId = comboKey(combo.market, combo.product);

    return combo.requiredDocuments.map((documentLabel) => {
      const definition = getDocumentDefinition(matrix, documentLabel);
      const fixtureEntry = getFixtureEntry(manifest, documentLabel);
      const variant = getVariantEntry(fixtureEntry, comboId);
      const requiredFieldKeys = Array.from(
        new Set([
          ...definition.requiredFieldKeys,
          ...(definition.marketSpecificFieldRules?.find(
            (rule) => rule.combo === comboId,
          )?.requiredFieldKeys ?? []),
        ]),
      );

      const fixtureStatus: OcrReadinessLedgerEntry['fixture'] = {
        // `34.10.4` lets the matrix grow ahead of fixture work; keep that explicit.
        status:
          fixtureEntry !== null &&
          (variant !== null || fixtureEntry.assetPath.length > 0)
            ? 'COMPLETE'
            : 'MISSING',
        assetPath: fixtureEntry?.assetPath ?? null,
        variantAssetPath: variant?.assetPath ?? null,
      };
      const classifierProof = determineClassifierProof(
        comboId,
        documentLabel,
        variant,
      );
      const backendProof = determineBackendProof(documentLabel);
      const browserProof = determineBrowserProof(
        comboId,
        documentLabel,
        browserProvenRequiredSlots,
      );
      const applicablePolicyExceptions = policyExceptions.exceptions.filter(
        (entry) =>
          entry.combo === comboId && entry.documentLabel === documentLabel,
      );
      const blockerReasons = [
        fixtureStatus.status !== 'COMPLETE'
          ? 'Missing committed fixture coverage.'
          : null,
        classifierProof.status !== 'COMPLETE' ? classifierProof.reason : null,
        backendProof.status === 'MISSING' ? backendProof.reason : null,
        browserProof.status !== 'COMPLETE' ? browserProof.reason : null,
        ...applicablePolicyExceptions.map(
          (entry) => `Policy exception: ${entry.summary}`,
        ),
      ].filter((reason): reason is string => reason !== null);

      return {
        combo: comboId,
        documentLabel,
        artifactType: definition.artifactType,
        requiredFieldKeys,
        fixture: fixtureStatus,
        classifierProof,
        backendProof,
        browserProof,
        policyExceptions: applicablePolicyExceptions,
        ready: blockerReasons.length === 0,
        blockerReasons,
      } satisfies OcrReadinessLedgerEntry;
    });
  });

  return {
    version: matrix.version,
    totalRequiredSlots: entries.length,
    fullyReadySlots: entries.filter((entry) => entry.ready).length,
    entries,
  };
}
