import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as YAML from 'yaml';
import type {
  RuleMarket,
  RuleProduct,
} from '../rules-engine/rules-engine.types';

export type OcrPolicyExceptionStatus = 'UNRESOLVED' | 'DEFERRED';
export type OcrPolicyExceptionType = 'POLICY_DISPUTE' | 'SCOPE_DEFERRED';

export interface OcrPolicyExceptionEntry {
  combo: `${RuleMarket}/${RuleProduct}`;
  documentLabel: string;
  status: OcrPolicyExceptionStatus;
  exceptionType: OcrPolicyExceptionType;
  phase: string;
  summary: string;
  reason: string;
  sourceRefs: string[];
  recommendedAction: string;
}

export interface OcrPolicyExceptionsRegistry {
  version: number;
  exceptions: OcrPolicyExceptionEntry[];
}

const OCR_POLICY_EXCEPTIONS_PATH = resolve(
  process.cwd(),
  'rules/ocr-policy-exceptions.yaml',
);

function assertString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${context}.`);
  }

  return value.trim();
}

function assertStringArray(value: unknown, context: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${context}.`);
  }

  return value.map((entry, index) =>
    assertString(entry, `${context}[${index}]`),
  );
}

function assertCombo(
  value: unknown,
  context: string,
): `${RuleMarket}/${RuleProduct}` {
  const normalized = assertString(value, context);
  if (!/^[A-Z]+\/[A-Z]+$/.test(normalized)) {
    throw new Error(`Invalid ${context}.`);
  }

  return normalized as `${RuleMarket}/${RuleProduct}`;
}

function parseRegistry(raw: unknown): OcrPolicyExceptionsRegistry {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid OCR policy exceptions root.');
  }

  const record = raw as Record<string, unknown>;
  if (typeof record['version'] !== 'number') {
    throw new Error('Invalid OCR policy exceptions version.');
  }
  if (!Array.isArray(record['exceptions'])) {
    throw new Error('Invalid OCR policy exceptions list.');
  }

  const exceptions = record['exceptions'].map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Invalid OCR policy exception[${index}].`);
    }

    const item = entry as Record<string, unknown>;
    return {
      combo: assertCombo(item['combo'], `exceptions[${index}].combo`),
      documentLabel: assertString(
        item['documentLabel'],
        `exceptions[${index}].documentLabel`,
      ),
      status: assertString(
        item['status'],
        `exceptions[${index}].status`,
      ) as OcrPolicyExceptionStatus,
      exceptionType: assertString(
        item['exceptionType'],
        `exceptions[${index}].exceptionType`,
      ) as OcrPolicyExceptionType,
      phase: assertString(item['phase'], `exceptions[${index}].phase`),
      summary: assertString(item['summary'], `exceptions[${index}].summary`),
      reason: assertString(item['reason'], `exceptions[${index}].reason`),
      sourceRefs: assertStringArray(
        item['sourceRefs'],
        `exceptions[${index}].sourceRefs`,
      ),
      recommendedAction: assertString(
        item['recommendedAction'],
        `exceptions[${index}].recommendedAction`,
      ),
    } satisfies OcrPolicyExceptionEntry;
  });

  return {
    version: record['version'],
    exceptions,
  };
}

export async function loadOcrPolicyExceptions(): Promise<OcrPolicyExceptionsRegistry> {
  const source = await readFile(OCR_POLICY_EXCEPTIONS_PATH, 'utf8');
  return parseRegistry(YAML.parse(source));
}
