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
    packageDescription:
      (input.artifactType === 'PHYTO_CERT'
        ? stringFromMetadata(metadata, 'packageDescription')
        : undefined) ??
      findRegexValue(text, [/package\s+description\s*[:#]?\s*([^\n]+)/i]),
    placeOfOrigin:
      (input.artifactType === 'PHYTO_CERT'
        ? stringFromMetadata(metadata, 'placeOfOrigin')
        : undefined) ??
      findRegexValue(text, [/place\s+of\s+origin\s*[:#]?\s*([^\n]+)/i]),
    commodityDescription:
      stringFromMetadata(metadata, 'commodityDescription') ??
      findRegexValue(text, [/commodity\s+description\s*[:#]?\s*([^\n]+)/i]),
    additionalDeclarations:
      stringFromMetadata(metadata, 'additionalDeclarations') ??
      findRegexValue(text, [/additional\s+declarations?\s*[:#]?\s*([^\n]+)/i]),
    treatmentReference:
      stringFromMetadata(metadata, 'treatmentReference') ??
      findRegexValue(text, [/treatment\s+reference\s*[:#]?\s*([^\n]+)/i]),
    packageMarkingForJapan:
      stringFromMetadata(metadata, 'packageMarkingForJapan') ??
      findRegexValue(text, [
        /package\s+marking\s+for\s+japan\s*[:#]?\s*([^\n]+)/i,
      ]),
    fumigationDetails:
      stringFromMetadata(metadata, 'fumigationDetails') ??
      findRegexValue(text, [/fumigation\s+details\s*[:#]?\s*([^\n]+)/i]),
    authorizedOfficer:
      (input.artifactType === 'PHYTO_CERT'
        ? stringFromMetadata(metadata, 'authorizedOfficer')
        : undefined) ??
      findRegexValue(text, [/authorized\s+officer\s*[:#]?\s*([^\n]+)/i]),
    treatmentRecordNumber:
      stringFromMetadata(metadata, 'treatmentRecordNumber') ??
      findRegexValue(text, [
        /(?:treatment\s+record\s+number|record\s+number)\s*[:#]?\s*([^\n]+)/i,
      ]),
    targetCoreTemperatureC:
      stringFromMetadata(metadata, 'targetCoreTemperatureC') ??
      findRegexValue(text, [
        /target\s+core\s+temperature(?:\s+c)?\s*[:#]?\s*([^\n]+)/i,
      ]),
    holdMinutes:
      stringFromMetadata(metadata, 'holdMinutes') ??
      findRegexValue(text, [
        /(?:hold\s+minutes|holding\s+time)\s*[:#]?\s*([^\n]+)/i,
      ]),
    linkedPhytoCertificateNumber:
      stringFromMetadata(metadata, 'linkedPhytoCertificateNumber') ??
      findRegexValue(text, [
        /linked\s+phyto\s+certificate\s+number\s*[:#]?\s*([^\n]+)/i,
      ]),
    overseasInspectionReference:
      stringFromMetadata(metadata, 'overseasInspectionReference') ??
      findRegexValue(text, [
        /overseas\s+inspection\s+reference\s*[:#]?\s*([^\n]+)/i,
      ]),
    commodityName:
      stringFromMetadata(metadata, 'commodityName') ??
      findRegexValue(text, [/commodity\s+name\s*[:#]?\s*([^\n]+)/i]),
    lotOrConsignmentId:
      stringFromMetadata(metadata, 'lotOrConsignmentId') ??
      findRegexValue(text, [/lot\s+or\s+consignment\s+id\s*[:#]?\s*([^\n]+)/i]),
    treatmentFacility:
      stringFromMetadata(metadata, 'treatmentFacility') ??
      findRegexValue(text, [/treatment\s+facility\s*[:#]?\s*([^\n]+)/i]),
    treatmentDate:
      stringFromMetadata(metadata, 'treatmentDate') ??
      findRegexValue(text, [/treatment\s+date\s*[:#]?\s*([^\n]+)/i]),
    treatmentMethod:
      stringFromMetadata(metadata, 'treatmentMethod') ??
      findRegexValue(text, [/treatment\s+method\s*[:#]?\s*([^\n]+)/i]),
    operatorOrInspector:
      stringFromMetadata(metadata, 'operatorOrInspector') ??
      findRegexValue(text, [/operator\s+or\s+inspector\s*[:#]?\s*([^\n]+)/i]),
    allowedVariety:
      stringFromMetadata(metadata, 'allowedVariety') ??
      findRegexValue(text, [/allowed\s+variety\s*[:#]?\s*([^\n]+)/i]),
    maffVerificationReference:
      stringFromMetadata(metadata, 'maffVerificationReference') ??
      findRegexValue(text, [
        /maff\s+verification\s+reference\s*[:#]?\s*([^\n]+)/i,
      ]),
    humidityRequirement:
      stringFromMetadata(metadata, 'humidityRequirement') ??
      findRegexValue(text, [/humidity\s+requirement\s*[:#]?\s*([^\n]+)/i]),
    coolingRequirement:
      stringFromMetadata(metadata, 'coolingRequirement') ??
      findRegexValue(text, [/cooling\s+requirement\s*[:#]?\s*([^\n]+)/i]),
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
      findRegexValue(text, [
        /(?:laboratory\s+name|lab\s+name)\s*[:#]?\s*([^\n]+)/i,
      ]),
    accreditationReference:
      stringFromMetadata(metadata, 'accreditationReference') ??
      findRegexValue(text, [/accreditation\s+reference\s*[:#]?\s*([^\n]+)/i]),
    sampleId:
      stringFromMetadata(metadata, 'sampleId') ??
      findRegexValue(text, [/sample\s+id\s*[:#]?\s*([^\n]+)/i]),
    sampleOriginCountry:
      stringFromMetadata(metadata, 'sampleOriginCountry') ??
      findRegexValue(text, [/sample\s+origin\s+country\s*[:#]?\s*([^\n]+)/i]),
    sampleReceiptDate:
      stringFromMetadata(metadata, 'sampleReceiptDate') ??
      findRegexValue(text, [/sample\s+receipt\s+date\s*[:#]?\s*([^\n]+)/i]),
    analysisDate:
      stringFromMetadata(metadata, 'analysisDate') ??
      findRegexValue(text, [/analysis\s+date\s*[:#]?\s*([^\n]+)/i]),
    analyticalMethod:
      stringFromMetadata(metadata, 'analyticalMethod') ??
      findRegexValue(text, [/analytical\s+method\s*[:#]?\s*([^\n]+)/i]),
    analyteTable:
      stringFromMetadata(metadata, 'analyteTable') ??
      findRegexValue(text, [/analyte\s+table\s*[:#]?\s*([^\n]+)/i]),
    resultUnits:
      stringFromMetadata(metadata, 'resultUnits') ??
      findRegexValue(text, [/(?:result\s+units|units)\s*[:#]?\s*([^;\n]+)/i]),
    certificateHolder:
      stringFromMetadata(metadata, 'certificateHolder') ??
      stringFromMetadata(metadata, 'holderName') ??
      findRegexValue(text, [/certificate\s+holder\s*[:#]?\s*([^\n]+)/i]),
    schemeName:
      stringFromMetadata(metadata, 'schemeName') ??
      findRegexValue(text, [/scheme\s+name\s*[:#]?\s*([^\n]+)/i]),
    expiryDate:
      stringFromMetadata(metadata, 'expiryDate') ??
      findRegexValue(text, [
        /(?:expiry\s+date|valid\s+until)\s*[:#]?\s*([^\n]+)/i,
      ]),
    commodityScope:
      stringFromMetadata(metadata, 'commodityScope') ??
      listFromMetadata(metadata, 'scope') ??
      findRegexValue(text, [/commodity\s+scope\s*[:#]?\s*([^\n]+)/i]),
    farmOrSiteId:
      stringFromMetadata(metadata, 'farmOrSiteId') ??
      findRegexValue(text, [/farm\s+or\s+site\s+id\s*[:#]?\s*([^\n]+)/i]),
    farmLocation:
      stringFromMetadata(metadata, 'farmLocation') ??
      findRegexValue(text, [/farm\s+location\s*[:#]?\s*([^\n]+)/i]),
    certificationBody:
      stringFromMetadata(metadata, 'certificationBody') ??
      findRegexValue(text, [/certification\s+body\s*[:#]?\s*([^\n]+)/i]),
    authorizedSignatory:
      stringFromMetadata(metadata, 'authorizedSignatory') ??
      findRegexValue(text, [/authorized\s+signatory\s*[:#]?\s*([^\n]+)/i]),
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
    sellerName:
      stringFromMetadata(metadata, 'sellerName') ??
      findRegexValue(text, [/seller\s+name\s*[:#]?\s*([^\n]+)/i]),
    buyerName:
      stringFromMetadata(metadata, 'buyerName') ??
      findRegexValue(text, [/buyer\s+name\s*[:#]?\s*([^\n]+)/i]),
    quantity:
      stringFromMetadata(metadata, 'quantity') ??
      findRegexValue(text, [/quantity\s*[:#]?\s*([^\n]+)/i]),
    unitPrice:
      stringFromMetadata(metadata, 'unitPrice') ??
      findRegexValue(text, [/unit\s+price\s*[:#]?\s*([^\n]+)/i]),
    totalAmount:
      stringFromMetadata(metadata, 'totalAmount') ??
      findRegexValue(text, [/total\s+amount\s*[:#]?\s*([^\n]+)/i]),
    currency:
      stringFromMetadata(metadata, 'currency') ??
      findRegexValue(text, [/currency\s*[:#]?\s*([^\n]+)/i]),
    countryOfOrigin:
      stringFromMetadata(metadata, 'countryOfOrigin') ??
      findRegexValue(text, [/country\s+of\s+origin\s*[:#]?\s*([^|;\n]+)/i]),
    incoterms:
      stringFromMetadata(metadata, 'incoterms') ??
      findRegexValue(text, [/incoterms\s*[:#]?\s*([^|;\n]+)/i]),
    shipmentReference:
      stringFromMetadata(metadata, 'shipmentReference') ??
      findRegexValue(text, [/shipment\s+reference\s*[:#]?\s*([^|;\n]+)/i]),
    packingListNumber:
      stringFromMetadata(metadata, 'packingListNumber') ??
      findRegexValue(text, [/packing\s+list\s+number\s*[:#]?\s*([^\n]+)/i]),
    packingListDate:
      stringFromMetadata(metadata, 'packingListDate') ??
      findRegexValue(text, [/packing\s+list\s+date\s*[:#]?\s*([^\n]+)/i]),
    invoiceReference:
      stringFromMetadata(metadata, 'invoiceReference') ??
      findRegexValue(text, [/invoice\s+reference\s*[:#]?\s*([^\n]+)/i]),
    packageCount:
      stringFromMetadata(metadata, 'packageCount') ??
      findRegexValue(text, [/package\s+count\s*[:#]?\s*([^\n]+)/i]),
    packageType:
      stringFromMetadata(metadata, 'packageType') ??
      findRegexValue(text, [/package\s+type\s*[:#]?\s*([^\n]+)/i]),
    marksAndNumbers:
      stringFromMetadata(metadata, 'marksAndNumbers') ??
      findRegexValue(text, [/marks\s+and\s+numbers\s*[:#]?\s*([^\n]+)/i]),
    grossWeight:
      stringFromMetadata(metadata, 'grossWeight') ??
      findRegexValue(text, [/gross\s+weight\s*[:#]?\s*([^|;\n]+)/i]),
    netWeight:
      stringFromMetadata(metadata, 'netWeight') ??
      findRegexValue(text, [/net\s+weight\s*[:#]?\s*([^|;\n]+)/i]),
    containerReference:
      stringFromMetadata(metadata, 'containerReference') ??
      findRegexValue(text, [/container\s+reference\s*[:#]?\s*([^\n]+)/i]),
    transportDocumentNumber:
      stringFromMetadata(metadata, 'transportDocumentNumber') ??
      findRegexValue(text, [
        /transport\s+document\s+number\s*[:#]?\s*([^\n]+)/i,
      ]),
    transportMode:
      stringFromMetadata(metadata, 'transportMode') ??
      findRegexValue(text, [/transport\s+mode\s*[:#]?\s*([^\n]+)/i]),
    carrierName:
      stringFromMetadata(metadata, 'carrierName') ??
      findRegexValue(text, [/carrier\s+name\s*[:#]?\s*([^\n]+)/i]),
    shipperName:
      stringFromMetadata(metadata, 'shipperName') ??
      findRegexValue(text, [/shipper\s+name\s*[:#]?\s*([^\n]+)/i]),
    departurePoint:
      stringFromMetadata(metadata, 'departurePoint') ??
      findRegexValue(text, [/departure\s+point\s*[:#]?\s*([^\n]+)/i]),
    arrivalPoint:
      stringFromMetadata(metadata, 'arrivalPoint') ??
      findRegexValue(text, [/arrival\s+point\s*[:#]?\s*([^\n]+)/i]),
    deliveryNoteNumber:
      stringFromMetadata(metadata, 'deliveryNoteNumber') ??
      findRegexValue(text, [/delivery\s+note\s+number\s*[:#]?\s*([^\n]+)/i]),
    deliveryDate:
      stringFromMetadata(metadata, 'deliveryDate') ??
      findRegexValue(text, [/delivery\s+date\s*[:#]?\s*([^\n]+)/i]),
    senderName:
      stringFromMetadata(metadata, 'senderName') ??
      findRegexValue(text, [/sender\s+name\s*[:#]?\s*([^\n]+)/i]),
    receiverName:
      stringFromMetadata(metadata, 'receiverName') ??
      findRegexValue(text, [/receiver\s+name\s*[:#]?\s*([^\n]+)/i]),
    deliveryLocation:
      stringFromMetadata(metadata, 'deliveryLocation') ??
      findRegexValue(text, [/delivery\s+location\s*[:#]?\s*([^\n]+)/i]),
    senderSignature:
      stringFromMetadata(metadata, 'senderSignature') ??
      findRegexValue(text, [/sender\s+signature\s*[:#]?\s*([^\n]+)/i]),
    receiverSignature:
      stringFromMetadata(metadata, 'receiverSignature') ??
      findRegexValue(text, [/receiver\s+signature\s*[:#]?\s*([^\n]+)/i]),
    authorizationNumber:
      stringFromMetadata(metadata, 'authorizationNumber') ??
      findRegexValue(text, [/authorization\s+number\s*[:#]?\s*([^\n]+)/i]),
    legalEntityName:
      stringFromMetadata(metadata, 'legalEntityName') ??
      findRegexValue(text, [/legal\s+entity\s+name\s*[:#]?\s*([^\n]+)/i]),
    establishmentName:
      stringFromMetadata(metadata, 'establishmentName') ??
      findRegexValue(text, [/establishment\s+name\s*[:#]?\s*([^\n]+)/i]),
    operatorType:
      stringFromMetadata(metadata, 'operatorType') ??
      findRegexValue(text, [/operator\s+type\s*[:#]?\s*([^\n]+)/i]),
    address:
      stringFromMetadata(metadata, 'address') ??
      findRegexValue(text, [/address\s*[:#]?\s*([^\n]+)/i]),
    issuingOffice:
      stringFromMetadata(metadata, 'issuingOffice') ??
      findRegexValue(text, [/issuing\s+office\s*[:#]?\s*([^\n]+)/i]),
    gradingReportNumber:
      stringFromMetadata(metadata, 'gradingReportNumber') ??
      findRegexValue(text, [/grading\s+report\s+number\s*[:#]?\s*([^\n]+)/i]),
    inspectionDate:
      stringFromMetadata(metadata, 'inspectionDate') ??
      findRegexValue(text, [/inspection\s+date\s*[:#]?\s*([^\n]+)/i]),
    gradeClass:
      stringFromMetadata(metadata, 'gradeClass') ??
      findRegexValue(text, [/grade\s+class\s*[:#]?\s*([^\n]+)/i]),
    packhouseName:
      stringFromMetadata(metadata, 'packhouseName') ??
      findRegexValue(text, [/packhouse\s+name\s*[:#]?\s*([^\n]+)/i]),
    inspectorName:
      stringFromMetadata(metadata, 'inspectorName') ??
      findRegexValue(text, [/inspector\s+name\s*[:#]?\s*([^\n]+)/i]),
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
      if (normalizedText.includes('good agricultural practices')) score += 8;
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
      if (normalizedText.includes('exporter authorization')) score += 8;
      if (normalizedText.includes('authorization record')) score += 4;
      break;
    case 'Grading Report':
      if (normalizedText.includes('grading report')) score += 8;
      if (normalizedText.includes('grade class')) score += 4;
      if (normalizedText.includes('packhouse name')) score += 3;
      if (normalizedText.includes('inspection date')) score += 3;
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
      if (
        extractedFields['treatmentReference'] === undefined &&
        declaration.includes('treatment')
      ) {
        extractedFields['treatmentReference'] = declaration;
      }
    }

    if (match.document.documentLabel === 'Grading Report') {
      delete extractedFields['reportNumber'];
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
