import { RuleMarket, RuleProduct, RuleRiskLevel } from './rules-engine.types';

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
  substances: Array<{
    name: string;
    cas: string;
    thaiMrl: number;
    destinationMrl: number;
    stringencyRatio: number;
    riskLevel: RuleRiskLevel;
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
  const substances = assertArray(record['substances'], 'substances').map(
    (substance, index) => {
      const substanceRecord = assertObject(substance, `substances[${index}]`);
      const name = assertString(
        substanceRecord['name'],
        `substances[${index}].name`,
      );
      const cas = assertString(
        substanceRecord['cas'],
        `substances[${index}].cas`,
      );
      const thaiMrl = assertNumber(
        substanceRecord['thaiMrl'],
        `substances[${index}].thaiMrl`,
      );
      const destinationMrl = assertNumber(
        substanceRecord['destinationMrl'],
        `substances[${index}].destinationMrl`,
      );
      const stringencyRatio = computeStringencyRatio(thaiMrl, destinationMrl);

      return {
        name,
        cas,
        thaiMrl,
        destinationMrl,
        stringencyRatio,
        riskLevel: classifyRiskLevel(stringencyRatio),
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
  substances: Array<{
    name: string;
    cas: string;
    thaiMrl: number;
    destinationMrl: number;
    stringencyRatio: number;
    riskLevel: RuleRiskLevel;
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
    substances: definition.substances,
  };
}
