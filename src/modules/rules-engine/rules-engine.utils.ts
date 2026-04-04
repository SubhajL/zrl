import {
  RuleCoverageState,
  RuleLabEnforcementMode,
  RuleMarket,
  RuleNonPesticideCheckStatus,
  RuleNonPesticideCheckType,
  RuleProduct,
  RuleRiskLevel,
  RuleSourceQuality,
} from './rules-engine.types';
import type {
  RuleMetadata,
  RuleMetadataParameterValue,
  RuleSetDefinition,
  RuleSnapshotPayload,
} from './rules-engine.types';

function assertObject(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value as Record<string, unknown>;
}

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${context}.`);
  }

  return value.trim();
}

function assertNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value;
}

function assertArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && !Number.isNaN(value) ? value : null;
}

function assertScalarMetadataValue(
  value: unknown,
  context: string,
): RuleMetadataParameterValue {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  throw new Error(`Invalid ${context}.`);
}

export function normalizeRuleMarket(value: string): RuleMarket {
  const normalized = value.trim().toUpperCase();
  if (!Object.values(RuleMarket).includes(normalized as RuleMarket)) {
    throw new Error(`Unsupported market: ${value}`);
  }

  return normalized as RuleMarket;
}

export function normalizeRuleProduct(value: string): RuleProduct {
  const normalized = value.trim().toUpperCase();
  if (!Object.values(RuleProduct).includes(normalized as RuleProduct)) {
    throw new Error(`Unsupported product: ${value}`);
  }

  return normalized as RuleProduct;
}

export function classifyRiskLevel(stringencyRatio: number): RuleRiskLevel {
  if (stringencyRatio >= 10) {
    return RuleRiskLevel.CRITICAL;
  }

  if (stringencyRatio >= 5) {
    return RuleRiskLevel.HIGH;
  }

  if (stringencyRatio >= 2) {
    return RuleRiskLevel.MEDIUM;
  }

  return RuleRiskLevel.LOW;
}

export function computeStringencyRatio(
  thaiMrl: number,
  destinationMrl: number,
): number {
  if (destinationMrl <= 0) {
    throw new Error('Destination MRL must be greater than zero.');
  }

  const rawRatio = thaiMrl / destinationMrl;
  return Number(rawRatio.toFixed(2));
}

export function parseEffectiveDate(value: string | Date): Date {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid effective date: ${String(value)}`);
  }

  return parsed;
}

export function buildRuleDefinition(
  raw: unknown,
  sourcePath: string,
): RuleSetDefinition {
  const record = assertObject(raw, 'rule definition');
  const market = normalizeRuleMarket(
    assertString(record['market'], 'rule definition market'),
  );
  const product = normalizeRuleProduct(
    assertString(record['product'], 'rule definition product'),
  );
  const version = assertNumber(record['version'], 'rule definition version');
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Invalid rule definition version.');
  }

  const effectiveDate = parseEffectiveDate(
    record['effectiveDate'] as string | Date,
  );
  const requiredDocuments = assertArray(
    record['requiredDocuments'],
    'requiredDocuments',
  ).map((value, index) => assertString(value, `requiredDocuments[${index}]`));
  const weights = assertObject(
    record['completenessWeights'],
    'completenessWeights',
  );
  const metadataRecord = assertObject(record['metadata'], 'metadata');
  const nonPesticideChecks = (
    metadataRecord['nonPesticideChecks'] === undefined
      ? []
      : assertArray(metadataRecord['nonPesticideChecks'], 'nonPesticideChecks')
  ).map((check, index) => {
    const checkRecord = assertObject(
      check,
      `metadata.nonPesticideChecks[${index}]`,
    );
    const parametersRecord =
      checkRecord['parameters'] === undefined
        ? {}
        : assertObject(
            checkRecord['parameters'],
            `metadata.nonPesticideChecks[${index}].parameters`,
          );

    return {
      type: assertString(
        checkRecord['type'],
        `metadata.nonPesticideChecks[${index}].type`,
      ) as RuleNonPesticideCheckType,
      status: assertString(
        checkRecord['status'],
        `metadata.nonPesticideChecks[${index}].status`,
      ) as RuleNonPesticideCheckStatus,
      parameters: Object.fromEntries(
        Object.entries(parametersRecord).map(([key, value]) => [
          key,
          assertScalarMetadataValue(
            value,
            `metadata.nonPesticideChecks[${index}].parameters.${key}`,
          ),
        ]),
      ),
      sourceRef: readString(checkRecord['sourceRef']),
      note: readString(checkRecord['note']),
    };
  });
  const metadata: RuleMetadata = {
    coverageState: assertString(
      metadataRecord['coverageState'],
      'metadata.coverageState',
    ) as RuleCoverageState,
    sourceQuality: assertString(
      metadataRecord['sourceQuality'],
      'metadata.sourceQuality',
    ) as RuleSourceQuality,
    retrievedAt: parseEffectiveDate(
      metadataRecord['retrievedAt'] as string | Date,
    ),
    commodityCode: readString(metadataRecord['commodityCode']),
    nonPesticideChecks,
  };
  const labPolicyRecord =
    record['labPolicy'] === undefined
      ? null
      : assertObject(record['labPolicy'], 'labPolicy');
  const labPolicy =
    labPolicyRecord === null
      ? undefined
      : {
          enforcementMode: assertString(
            labPolicyRecord['enforcementMode'],
            'labPolicy.enforcementMode',
          ) as RuleLabEnforcementMode,
          requiredArtifactType: (readString(
            labPolicyRecord['requiredArtifactType'],
          ) ?? 'MRL_TEST') as 'MRL_TEST',
          acceptedUnits: (Array.isArray(labPolicyRecord['acceptedUnits'])
            ? labPolicyRecord['acceptedUnits']
            : ['mg/kg', 'ppm']
          ).map((value, index) =>
            assertString(value, `labPolicy.acceptedUnits[${index}]`),
          ),
          defaultDestinationMrlMgKg:
            labPolicyRecord['defaultDestinationMrlMgKg'] === null
              ? null
              : labPolicyRecord['defaultDestinationMrlMgKg'] === undefined
                ? null
                : assertNumber(
                    labPolicyRecord['defaultDestinationMrlMgKg'],
                    'labPolicy.defaultDestinationMrlMgKg',
                  ),
        };
  const substances = assertArray(record['substances'], 'substances').map(
    (substance, index) => {
      const substanceRecord = assertObject(substance, `substances[${index}]`);
      const name = assertString(
        substanceRecord['name'],
        `substances[${index}].name`,
      );
      const aliasesValue = substanceRecord['aliases'];
      const aliases =
        aliasesValue === undefined
          ? []
          : assertArray(aliasesValue, `substances[${index}].aliases`).map(
              (value, aliasIndex) =>
                assertString(
                  value,
                  `substances[${index}].aliases[${aliasIndex}]`,
                ),
            );
      const cas = readString(substanceRecord['cas']);
      const thaiMrl = readNumber(substanceRecord['thaiMrl']);
      const destinationMrl = assertNumber(
        substanceRecord['destinationMrl'],
        `substances[${index}].destinationMrl`,
      );
      const destinationLimitType =
        readString(substanceRecord['destinationLimitType']) ?? 'NUMERIC';
      const stringencyRatio =
        thaiMrl === null || destinationLimitType !== 'NUMERIC'
          ? null
          : computeStringencyRatio(thaiMrl, destinationMrl);

      return {
        name,
        aliases,
        cas,
        thaiMrl,
        destinationMrl,
        destinationLimitType: destinationLimitType as
          | 'NUMERIC'
          | 'NON_DETECT'
          | 'PHYSIOLOGICAL_LEVEL',
        stringencyRatio,
        riskLevel:
          stringencyRatio === null ? null : classifyRiskLevel(stringencyRatio),
        sourceRef: readString(substanceRecord['sourceRef']),
        note: readString(substanceRecord['note']),
      };
    },
  );

  return {
    market,
    product,
    version,
    effectiveDate,
    sourcePath,
    requiredDocuments,
    completenessWeights: {
      regulatory: assertNumber(
        weights['regulatory'],
        'completenessWeights.regulatory',
      ),
      quality: assertNumber(weights['quality'], 'completenessWeights.quality'),
      coldChain: assertNumber(
        weights['coldChain'],
        'completenessWeights.coldChain',
      ),
      chainOfCustody: assertNumber(
        weights['chainOfCustody'],
        'completenessWeights.chainOfCustody',
      ),
    },
    metadata,
    labPolicy,
    substances,
  };
}

export function buildRuleSnapshotPayload(
  definition: RuleSetDefinition,
): RuleSnapshotPayload {
  return {
    market: definition.market,
    product: definition.product,
    version: definition.version,
    effectiveDate: definition.effectiveDate,
    sourcePath: definition.sourcePath,
    requiredDocuments: definition.requiredDocuments,
    completenessWeights: definition.completenessWeights,
    metadata: definition.metadata,
    labPolicy: definition.labPolicy,
    substances: definition.substances,
  };
}

const DEFAULT_COMPLETENESS_WEIGHTS = {
  regulatory: 0.4,
  quality: 0.25,
  coldChain: 0.2,
  chainOfCustody: 0.15,
};

export function adaptLaneSnapshotToRulePayload(snapshot: {
  market: string;
  product: string;
  version: number;
  effectiveDate: Date;
  rules: {
    sourcePath?: string;
    requiredDocuments?: string[];
    completenessWeights?: {
      regulatory: number;
      quality: number;
      coldChain: number;
      chainOfCustody: number;
    };
    metadata?: {
      coverageState: RuleCoverageState;
      sourceQuality: RuleSourceQuality;
      retrievedAt: Date | string;
      commodityCode?: string | null;
      nonPesticideChecks?: Array<{
        type: RuleNonPesticideCheckType;
        status: RuleNonPesticideCheckStatus;
        parameters?: Record<string, RuleMetadataParameterValue>;
        sourceRef?: string | null;
        note?: string | null;
      }>;
    };
    labPolicy?: {
      enforcementMode: 'DOCUMENT_ONLY' | 'FULL_PESTICIDE';
      requiredArtifactType: 'MRL_TEST';
      acceptedUnits: string[];
      defaultDestinationMrlMgKg: number | null;
    };
    substances?: Array<{
      name: string;
      cas: string | null;
      thaiMrl: number | null;
      destinationMrl: number;
      destinationLimitType?: 'NUMERIC' | 'NON_DETECT' | 'PHYSIOLOGICAL_LEVEL';
      stringencyRatio: number | null;
      riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
    }>;
  };
}) {
  return {
    market: snapshot.market as RuleMarket,
    product: snapshot.product as RuleProduct,
    version: snapshot.version,
    effectiveDate: snapshot.effectiveDate,
    sourcePath: snapshot.rules.sourcePath ?? '',
    requiredDocuments: snapshot.rules.requiredDocuments ?? [],
    completenessWeights:
      snapshot.rules.completenessWeights ?? DEFAULT_COMPLETENESS_WEIGHTS,
    metadata:
      snapshot.rules.metadata === undefined
        ? {
            coverageState: RuleCoverageState.CURATED_HIGH_RISK,
            sourceQuality: RuleSourceQuality.SECONDARY_ONLY,
            retrievedAt: snapshot.effectiveDate,
            commodityCode: null,
            nonPesticideChecks: [],
          }
        : {
            coverageState: snapshot.rules.metadata.coverageState,
            sourceQuality: snapshot.rules.metadata.sourceQuality,
            retrievedAt: parseEffectiveDate(
              snapshot.rules.metadata.retrievedAt,
            ),
            commodityCode: snapshot.rules.metadata.commodityCode ?? null,
            nonPesticideChecks: (
              snapshot.rules.metadata.nonPesticideChecks ?? []
            ).map((check) => ({
              type: check.type,
              status: check.status,
              parameters: check.parameters ?? {},
              sourceRef: check.sourceRef ?? null,
              note: check.note ?? null,
            })),
          },
    labPolicy: snapshot.rules.labPolicy,
    substances: (snapshot.rules.substances ?? []).map((substance) => ({
      aliases: [] as string[],
      sourceRef: null as string | null,
      note: null as string | null,
      destinationLimitType: 'NUMERIC' as const,
      ...substance,
    })),
  };
}
