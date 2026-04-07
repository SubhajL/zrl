import { loadSupportedDocumentMatrix } from './document-matrix';
import type {
  EvidenceArtifactType,
  EvidenceDocumentFieldCompleteness,
  EvidenceDocumentClassificationResult,
  EvidenceDocumentClassifier,
} from './evidence.types';

export interface EvidenceDocumentAnalysisInput {
  artifactType: EvidenceArtifactType;
  market: string;
  product: string;
  fileName: string;
  mimeType: string;
  metadata: Record<string, unknown> | null;
  ocrText: string;
}

type CandidateDocument = Awaited<
  ReturnType<typeof loadSupportedDocumentMatrix>
>['documents'][number];

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findRegexValue(
  source: string,
  patterns: RegExp[],
): string | undefined {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const value = match?.[1]?.trim();
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function stringFromMetadata(
  metadata: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function listFromMetadata(
  metadata: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  if (!Array.isArray(value)) {
    return undefined;
  }

  const strings = value
    .filter(
      (entry): entry is string =>
        typeof entry === 'string' && entry.trim().length > 0,
    )
    .map((entry) => entry.trim());
  return strings.length > 0 ? strings.join(', ') : undefined;
}

function extractCommonFields(
  input: EvidenceDocumentAnalysisInput,
): Record<string, unknown> {
  const text = input.ocrText;
  const metadata = input.metadata;

  return {
    certificateNumber:
      stringFromMetadata(metadata, 'certificateNumber') ??
      findRegexValue(text, [
        /certificate\s*(?:no\.?|number)\s*[:#]?\s*([^\n]+)/i,
        /cert(?:ificate)?\s*#\s*([^\n]+)/i,
      ]),
    exporterName:
      stringFromMetadata(metadata, 'exporterName') ??
      findRegexValue(text, [
        /(?:name\s+of\s+)?exporter(?:\s+name)?\s*[:#]\s*([^\n]+)/i,
      ]),
    consigneeName:
      stringFromMetadata(metadata, 'consigneeName') ??
      findRegexValue(text, [
        /(?:name\s+of\s+)?consignee(?:\s+name)?\s*[:#]\s*([^\n]+)/i,
      ]),
    botanicalName:
      stringFromMetadata(metadata, 'botanicalName') ??
      findRegexValue(text, [/botanical\s+name\s*[:#]?\s*([^\n]+)/i]),
    issueDate:
      stringFromMetadata(metadata, 'issueDate') ??
      stringFromMetadata(metadata, 'issuedAt') ??
      findRegexValue(text, [
        /(?:date\s+of\s+issue|issue\s+date)\s*[:#]?\s*([^\n]+)/i,
      ]),
    issuingAuthority:
      stringFromMetadata(metadata, 'issuingAuthority') ??
      stringFromMetadata(metadata, 'issuer') ??
      findRegexValue(text, [
        /(?:issued\s+by|issuing\s+authority)\s*[:#]?\s*([^\n]+)/i,
      ]),
    meansOfConveyance:
      stringFromMetadata(metadata, 'meansOfConveyance') ??
      findRegexValue(text, [/means\s+of\s+conveyance\s*[:#]?\s*([^\n]+)/i]),
    placeOfOrigin:
      stringFromMetadata(metadata, 'placeOfOrigin') ??
      findRegexValue(text, [
        /(?:place\s+of\s+origin|origin)\s*[:#]?\s*([^\n]+)/i,
      ]),
    additionalDeclarations:
      stringFromMetadata(metadata, 'additionalDeclarations') ??
      findRegexValue(text, [/additional\s+declarations?\s*[:#]?\s*([^\n]+)/i]),
    treatmentRecordNumber:
      stringFromMetadata(metadata, 'treatmentRecordNumber') ??
      findRegexValue(text, [
        /(?:treatment\s+record\s+number|record\s+number)\s*[:#]?\s*([^\n]+)/i,
      ]),
    targetCoreTemperatureC:
      stringFromMetadata(metadata, 'targetCoreTemperatureC') ??
      findRegexValue(text, [
        /(?:core\s+temperature|target\s+temperature)\s*[:#]?\s*([^\n]+)/i,
      ]),
    holdMinutes:
      stringFromMetadata(metadata, 'holdMinutes') ??
      findRegexValue(text, [
        /(?:hold\s+minutes|holding\s+time)\s*[:#]?\s*([^\n]+)/i,
      ]),
    linkedPhytoCertificateNumber:
      stringFromMetadata(metadata, 'linkedPhytoCertificateNumber') ??
      findRegexValue(text, [
        /(?:linked\s+phyto\s+certificate|phyto\s+certificate\s+number)\s*[:#]?\s*([^\n]+)/i,
      ]),
    reportNumber:
      stringFromMetadata(metadata, 'reportNumber') ??
      findRegexValue(text, [
        /(?:report\s+number|report\s+no\.?)\s*[:#]?\s*([^\n]+)/i,
      ]),
    laboratoryName:
      stringFromMetadata(metadata, 'laboratoryName') ??
      (input.artifactType === 'MRL_TEST'
        ? stringFromMetadata(metadata, 'issuer')
        : undefined) ??
      findRegexValue(text, [/(?:laboratory|lab\s+name)\s*[:#]?\s*([^\n]+)/i]),
    resultUnits:
      stringFromMetadata(metadata, 'resultUnits') ??
      findRegexValue(text, [/(?:result\s+units|units)\s*[:#]?\s*([^\n]+)/i]),
    certificateHolder:
      stringFromMetadata(metadata, 'certificateHolder') ??
      stringFromMetadata(metadata, 'holderName'),
    expiryDate:
      stringFromMetadata(metadata, 'expiryDate') ??
      findRegexValue(text, [
        /(?:expiry\s+date|valid\s+until)\s*[:#]?\s*([^\n]+)/i,
      ]),
    commodityScope:
      stringFromMetadata(metadata, 'commodityScope') ??
      listFromMetadata(metadata, 'scope'),
    invoiceNumber:
      stringFromMetadata(metadata, 'invoiceNumber') ??
      findRegexValue(text, [
        /(?:invoice\s+number|invoice\s+no\.?)\s*[:#]?\s*([^\n]+)/i,
      ]),
    invoiceDate:
      stringFromMetadata(metadata, 'invoiceDate') ??
      findRegexValue(text, [
        /(?:invoice\s+date|date\s+of\s+invoice)\s*[:#]?\s*([^\n]+)/i,
      ]),
    goodsDescription:
      stringFromMetadata(metadata, 'goodsDescription') ??
      findRegexValue(text, [
        /(?:goods\s+description|description\s+of\s+goods)\s*[:#]?\s*([^\n]+)/i,
      ]),
    shipmentReference:
      stringFromMetadata(metadata, 'shipmentReference') ??
      findRegexValue(text, [
        /(?:shipment\s+reference|reference)\s*[:#]?\s*([^\n]+)/i,
      ]),
  };
}

function selectCandidates(
  documents: CandidateDocument[],
  input: EvidenceDocumentAnalysisInput,
): CandidateDocument[] {
  const combo =
    `${input.market}/${input.product}` as CandidateDocument['applicableCombos'][number];
  return documents.filter(
    (document) =>
      document.artifactType === input.artifactType &&
      document.applicableCombos.includes(combo),
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function scoreDocument(
  document: CandidateDocument,
  normalizedText: string,
): number {
  const documentLabel = normalizeText(document.documentLabel);
  let score = 0;
  if (normalizedText.includes(documentLabel)) {
    score += 5;
  }

  switch (document.documentLabel) {
    case 'Phytosanitary Certificate':
      if (normalizedText.includes('phytosanitary certificate')) score += 10;
      if (normalizedText.includes('botanical name')) score += 2;
      break;
    case 'VHT Certificate':
      if (normalizedText.includes('vht')) score += 6;
      if (normalizedText.includes('vapour heat')) score += 8;
      if (normalizedText.includes('core temperature')) score += 3;
      break;
    case 'MRL Test Results':
      if (normalizedText.includes('laboratory')) score += 2;
      if (normalizedText.includes('report number')) score += 3;
      if (normalizedText.includes('mg/kg')) score += 3;
      break;
    case 'GAP Certificate':
      if (normalizedText.includes('gap')) score += 4;
      if (normalizedText.includes('certificate')) score += 2;
      break;
    case 'Commercial Invoice':
      if (normalizedText.includes('commercial invoice')) score += 8;
      if (normalizedText.includes('invoice number')) score += 3;
      break;
    case 'Packing List':
      if (normalizedText.includes('packing list')) score += 8;
      break;
    case 'Transport Document':
      if (normalizedText.includes('bill of lading')) score += 8;
      if (normalizedText.includes('air waybill')) score += 8;
      if (normalizedText.includes('transport document')) score += 6;
      break;
    case 'Delivery Note':
      if (normalizedText.includes('delivery note')) score += 8;
      break;
    case 'Export License':
      if (normalizedText.includes('export license')) score += 8;
      if (normalizedText.includes('exporter registration')) score += 5;
      break;
    default:
      break;
  }

  return score;
}

function hasFieldValue(value: unknown): boolean {
  return typeof value === 'string'
    ? value.trim().length > 0
    : value !== undefined && value !== null;
}

function buildUnsupportedFieldKeys(
  expectedFieldKeys: string[],
  extractedFields: Record<string, unknown>,
): string[] {
  return Object.keys(extractedFields)
    .filter((fieldKey) => !expectedFieldKeys.includes(fieldKey))
    .sort();
}

function buildFieldCompleteness(
  matrixVersion: number,
  expectedFieldKeys: string[],
  extractedFields: Record<string, unknown>,
  lowConfidenceFieldKeys: string[],
): EvidenceDocumentFieldCompleteness {
  const presentFieldKeys = expectedFieldKeys.filter((fieldKey) =>
    hasFieldValue(extractedFields[fieldKey]),
  );
  const missingFieldKeys = expectedFieldKeys.filter(
    (fieldKey) => !presentFieldKeys.includes(fieldKey),
  );

  return {
    supported: expectedFieldKeys.length > 0,
    documentMatrixVersion: matrixVersion,
    expectedFieldKeys: [...new Set(expectedFieldKeys)],
    presentFieldKeys: [...new Set(presentFieldKeys)],
    missingFieldKeys: [...new Set(missingFieldKeys)],
    lowConfidenceFieldKeys: [...new Set(lowConfidenceFieldKeys)],
    unsupportedFieldKeys: buildUnsupportedFieldKeys(
      expectedFieldKeys,
      extractedFields,
    ),
  };
}

export class MatrixDrivenEvidenceDocumentClassifier implements EvidenceDocumentClassifier {
  constructor(
    private readonly loadMatrix: typeof loadSupportedDocumentMatrix = loadSupportedDocumentMatrix,
  ) {}

  async analyze(
    input: EvidenceDocumentAnalysisInput,
  ): Promise<EvidenceDocumentClassificationResult> {
    const matrix = await this.loadMatrix();
    const candidates = selectCandidates(matrix.documents, input);
    const normalizedText = normalizeText(input.ocrText);
    const candidateScores = candidates
      .map((document) => ({
        document,
        score: scoreDocument(document, normalizedText),
      }))
      .sort((left, right) => right.score - left.score);

    const match = candidateScores[0];
    if (match === undefined || match.score < 4) {
      return {
        analysisStatus: 'FAILED',
        documentLabel: null,
        documentRole: null,
        confidence: null,
        summaryText:
          'Unable to classify artifact confidently from OCR text and metadata.',
        extractedFields: {},
        missingFieldKeys: [],
        lowConfidenceFieldKeys: [],
        fieldCompleteness: {
          supported: false,
          documentMatrixVersion: matrix.version,
          expectedFieldKeys: [],
          presentFieldKeys: [],
          missingFieldKeys: [],
          lowConfidenceFieldKeys: [],
          unsupportedFieldKeys: [],
        },
      };
    }

    const extractedFields = extractCommonFields(input);
    const combo = `${input.market}/${input.product}`;
    const extraRequiredFields =
      match.document.marketSpecificFieldRules?.find(
        (rule) => rule.combo === combo,
      )?.requiredFieldKeys ?? [];
    const expectedFieldKeys = [
      ...match.document.requiredFieldKeys,
      ...extraRequiredFields,
    ];

    const lowConfidenceFieldKeys: string[] = [];

    if (
      match.document.documentLabel === 'Phytosanitary Certificate' &&
      extraRequiredFields.includes('mustStateFruitFlyFree')
    ) {
      const declaration =
        stringValue(extractedFields['additionalDeclarations'])?.toLowerCase() ??
        '';
      if (declaration.includes('fruit fly free')) {
        extractedFields['mustStateFruitFlyFree'] = true;
      } else {
        lowConfidenceFieldKeys.push('mustStateFruitFlyFree');
      }
      if (declaration.includes('treatment')) {
        extractedFields['treatmentReference'] = declaration;
      }
    }

    const filteredExtractedFields = Object.fromEntries(
      Object.entries(extractedFields).filter(
        ([, value]) => value !== undefined,
      ),
    );

    const fieldCompleteness = buildFieldCompleteness(
      matrix.version,
      expectedFieldKeys,
      filteredExtractedFields,
      lowConfidenceFieldKeys,
    );

    return {
      analysisStatus: 'COMPLETED',
      documentLabel: match.document.documentLabel,
      documentRole: match.document.documentRole,
      confidence: match.document.confidence,
      summaryText: `Matched ${match.document.documentLabel} using matrix-driven rules.`,
      extractedFields: filteredExtractedFields,
      missingFieldKeys: fieldCompleteness.missingFieldKeys,
      lowConfidenceFieldKeys: [...new Set(lowConfidenceFieldKeys)],
      fieldCompleteness,
    };
  }
}
