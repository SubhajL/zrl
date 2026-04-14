import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MatrixDrivenEvidenceDocumentClassifier } from './evidence.document-classifier';
import { loadSupportedDocumentMatrix } from './document-matrix';
import {
  loadOcrFixtureManifest,
  loadOcrFixtureText,
} from './ocr-fixture-manifest';
import { buildOcrReadinessLedger } from './ocr-readiness-ledger';
import type {
  RuleMarket,
  RuleProduct,
} from '../rules-engine/rules-engine.types';

const TARGET_DOCUMENT_LABEL = 'Grading Report';

const EXTERNAL_RESEARCH_LEDGER_PATH = resolve(
  process.cwd(),
  'docs/OCR-34-10-1-EXTERNAL-RESEARCH-LEDGER.md',
);
const RECONCILIATION_LEDGER_PATH = resolve(
  process.cwd(),
  'docs/OCR-34-10-2-RECONCILIATION-LEDGER.md',
);
const DECISION_LEDGER_PATH = resolve(
  process.cwd(),
  'docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md',
);

type ComboId = `${RuleMarket}/${RuleProduct}`;

export interface Ocr34_10TraceabilityAuditResult {
  documentLabel: typeof TARGET_DOCUMENT_LABEL;
  externalResearch: {
    path: string;
    mentionsDocumentLabel: boolean;
    mentionsReconciliationLedger: boolean;
  };
  reconciliation: {
    path: string;
    identifiesStandaloneCandidate: boolean;
    mentionsDecisionLedger: boolean;
  };
  decision: {
    path: string;
    approvedCombos: ComboId[];
  };
  matrix: {
    version: number;
    artifactType: string;
    applicableCombos: ComboId[];
    sourceUrls: string[];
  };
  fixture: {
    manifestVersion: number;
    assetPath: string;
    applicableCombos: ComboId[];
    assetExists: boolean;
  };
  classifier: {
    documentLabel: string | null;
    documentRole: string | null;
    supported: boolean;
    presentFieldKeys: string[];
  };
  readiness: {
    totalSlots: number;
    readyCombos: ComboId[];
  };
}

function sortCombos(combos: readonly ComboId[]): ComboId[] {
  return [...combos].sort();
}

function parseApprovedCombos(
  source: string,
  documentLabel: typeof TARGET_DOCUMENT_LABEL,
): ComboId[] {
  return sortCombos(
    source.split('\n').flatMap((line) => {
      const match = line.match(
        /^\|\s*`([A-Z]+\/[A-Z]+)`\s*\|.*`ADD` `Grading Report`/,
      );

      if (!match || !line.includes(`\`${documentLabel}\``)) {
        return [];
      }

      return [match[1] as ComboId];
    }),
  );
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function buildOcr34_10TraceabilityAudit(): Promise<Ocr34_10TraceabilityAuditResult> {
  const [
    externalResearchSource,
    reconciliationSource,
    decisionSource,
    matrix,
    manifest,
    readinessLedger,
  ] = await Promise.all([
    readFile(EXTERNAL_RESEARCH_LEDGER_PATH, 'utf8'),
    readFile(RECONCILIATION_LEDGER_PATH, 'utf8'),
    readFile(DECISION_LEDGER_PATH, 'utf8'),
    loadSupportedDocumentMatrix(),
    loadOcrFixtureManifest(),
    buildOcrReadinessLedger(),
  ]);

  const matrixDocument = matrix.documents.find(
    (document) => document.documentLabel === TARGET_DOCUMENT_LABEL,
  );
  if (!matrixDocument) {
    throw new Error(`Missing matrix definition for ${TARGET_DOCUMENT_LABEL}.`);
  }

  const fixtureDocument = manifest.documents.find(
    (document) => document.documentLabel === TARGET_DOCUMENT_LABEL,
  );
  if (!fixtureDocument) {
    throw new Error(
      `Missing fixture manifest entry for ${TARGET_DOCUMENT_LABEL}.`,
    );
  }

  const [market, product] = fixtureDocument.applicableCombos[0].split('/') as [
    RuleMarket,
    RuleProduct,
  ];
  const classifier = new MatrixDrivenEvidenceDocumentClassifier();
  const classification = await classifier.analyze({
    artifactType: fixtureDocument.artifactType,
    market,
    product,
    fileName: fixtureDocument.assetPath.split('/').at(-1) ?? 'fixture.svg',
    mimeType: 'image/svg+xml',
    metadata: null,
    ocrText: await loadOcrFixtureText(fixtureDocument.assetPath),
  });

  const gradingReadinessEntries = readinessLedger.entries.filter(
    (entry) => entry.documentLabel === TARGET_DOCUMENT_LABEL,
  );

  return {
    documentLabel: TARGET_DOCUMENT_LABEL,
    externalResearch: {
      path: 'docs/OCR-34-10-1-EXTERNAL-RESEARCH-LEDGER.md',
      mentionsDocumentLabel: externalResearchSource.includes(
        TARGET_DOCUMENT_LABEL,
      ),
      mentionsReconciliationLedger: externalResearchSource.includes(
        'docs/OCR-34-10-2-RECONCILIATION-LEDGER.md',
      ),
    },
    reconciliation: {
      path: 'docs/OCR-34-10-2-RECONCILIATION-LEDGER.md',
      identifiesStandaloneCandidate:
        (reconciliationSource.includes(TARGET_DOCUMENT_LABEL) &&
          reconciliationSource.includes(
            'dominant standalone-family candidate',
          )) ||
        reconciliationSource.includes(
          'highest-confidence standalone-family candidate',
        ),
      mentionsDecisionLedger: reconciliationSource.includes(
        'docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md',
      ),
    },
    decision: {
      path: 'docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md',
      approvedCombos: parseApprovedCombos(
        decisionSource,
        TARGET_DOCUMENT_LABEL,
      ),
    },
    matrix: {
      version: matrix.version,
      artifactType: matrixDocument.artifactType,
      applicableCombos: sortCombos(matrixDocument.applicableCombos),
      sourceUrls: [...matrixDocument.sourceUrls],
    },
    fixture: {
      manifestVersion: manifest.version,
      assetPath: fixtureDocument.assetPath,
      applicableCombos: sortCombos(fixtureDocument.applicableCombos),
      assetExists: await fileExists(
        resolve(process.cwd(), fixtureDocument.assetPath),
      ),
    },
    classifier: {
      documentLabel: classification.documentLabel,
      documentRole: classification.documentRole,
      supported: classification.fieldCompleteness.supported,
      presentFieldKeys: [...classification.fieldCompleteness.presentFieldKeys],
    },
    readiness: {
      totalSlots: gradingReadinessEntries.length,
      readyCombos: sortCombos(
        gradingReadinessEntries
          .filter((entry) => entry.ready)
          .map((entry) => entry.combo),
      ),
    },
  };
}
