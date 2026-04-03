import {
  RuleLabEnforcementMode,
  RuleMarket,
  RuleProduct,
  RuleRiskLevel,
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
): {
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string;
  requiredDocuments: string[];
  completenessWeights: {
    regulatory: number;
    quality: number;
    coldChain: number;
    chainOfCustody: number;
  };
  labPolicy?: {
    enforcementMode: RuleLabEnforcementMode;
    requiredArtifactType: 'MRL_TEST';
    acceptedUnits: string[];
    defaultDestinationMrlMgKg: number | null;
  };
  substances: Array<{
    name: string;
    aliases: string[];
    cas: string | null;
    thaiMrl: number | null;
    destinationMrl: number;
    stringencyRatio: number | null;
    riskLevel: RuleRiskLevel | null;
    sourceRef: string | null;
    note: string | null;
  }>;
} {
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
      const stringencyRatio =
        thaiMrl === null
          ? null
          : computeStringencyRatio(thaiMrl, destinationMrl);

      return {
        name,
        aliases,
        cas,
        thaiMrl,
        destinationMrl,
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
    labPolicy,
    substances,
  };
}

export function buildRuleSnapshotPayload(definition: {
  market: RuleMarket;
  product: RuleProduct;
  version: number;
  effectiveDate: Date;
  sourcePath: string;
  requiredDocuments: string[];
  completenessWeights: {
    regulatory: number;
    quality: number;
    coldChain: number;
    chainOfCustody: number;
  };
  labPolicy?: {
    enforcementMode: RuleLabEnforcementMode;
    requiredArtifactType: 'MRL_TEST';
    acceptedUnits: string[];
    defaultDestinationMrlMgKg: number | null;
  };
  substances: Array<{
    name: string;
    aliases: string[];
    cas: string | null;
    thaiMrl: number | null;
    destinationMrl: number;
    stringencyRatio: number | null;
    riskLevel: RuleRiskLevel | null;
    sourceRef: string | null;
    note: string | null;
  }>;
}) {
  return {
    market: definition.market,
    product: definition.product,
    version: definition.version,
    effectiveDate: definition.effectiveDate,
    sourcePath: definition.sourcePath,
    requiredDocuments: definition.requiredDocuments,
    completenessWeights: definition.completenessWeights,
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
    labPolicy: snapshot.rules.labPolicy,
    substances: (snapshot.rules.substances ?? []).map((substance) => ({
      aliases: [] as string[],
      sourceRef: null as string | null,
      note: null as string | null,
      ...substance,
    })),
  };
}
