import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve } from 'node:path';
import * as YAML from 'yaml';
import { buildRuleDefinition } from './rules-engine.utils';
import type {
  RuleDefinitionSource,
  RuleSetDefinition,
} from './rules-engine.types';

const RULE_YAML_FILE_PATTERN = /\.(ya?ml)$/i;
const RULE_DATA_FILE_PATTERN = /\.(ya?ml|csv)$/i;

async function findRuleFiles(
  directory: string,
  filePattern: RegExp,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findRuleFiles(entryPath, filePattern)));
      continue;
    }

    if (entry.isFile() && filePattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      const nextCharacter = line[index + 1];
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  if (inQuotes) {
    throw new Error('Invalid CSV row: unmatched quote.');
  }

  values.push(current.trim());
  return values;
}

function parseCsvNumber(value: string, context: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${context}.`);
  }

  return parsed;
}

function parseRuleSubstancesCsv(
  source: string,
  context: string,
): RuleDefinitionSource['substances'] {
  const rows = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  if (rows.length === 0) {
    throw new Error(`Invalid ${context}: missing header row.`);
  }

  const [headerRow, ...dataRows] = rows;
  const headers = parseCsvLine(headerRow);
  const requiredHeaders = ['name', 'cas', 'thaiMrl', 'destinationMrl'];
  for (const header of requiredHeaders) {
    if (!headers.includes(header)) {
      throw new Error(`Invalid ${context}: missing "${header}" column.`);
    }
  }

  return dataRows.map((row, index) => {
    const values = parseCsvLine(row);
    if (values.length !== headers.length) {
      throw new Error(
        `Invalid ${context}: row ${index + 2} has ${values.length} columns; expected ${headers.length}.`,
      );
    }

    const record = Object.fromEntries(
      headers.map((header, headerIndex) => [header, values[headerIndex]]),
    ) as Record<string, string>;

    return {
      name: record['name'] ?? '',
      cas: record['cas'] ?? '',
      thaiMrl: parseCsvNumber(
        record['thaiMrl'] ?? '',
        `${context} row ${index + 2} thaiMrl`,
      ),
      destinationMrl: parseCsvNumber(
        record['destinationMrl'] ?? '',
        `${context} row ${index + 2} destinationMrl`,
      ),
    };
  });
}

function toRuleSourcePath(filePath: string, rulesDirectory?: string): string {
  const absoluteFilePath = resolve(filePath);
  if (rulesDirectory === undefined) {
    return absoluteFilePath;
  }

  const absoluteRulesDirectory = resolve(rulesDirectory);
  const relativePath = relative(absoluteRulesDirectory, absoluteFilePath);
  return posix.join('rules', relativePath.split('\\').join('/'));
}

export async function findRuleYamlFiles(directory: string): Promise<string[]> {
  return await findRuleFiles(directory, RULE_YAML_FILE_PATTERN);
}

export async function findRuleDataFiles(directory: string): Promise<string[]> {
  return await findRuleFiles(directory, RULE_DATA_FILE_PATTERN);
}

export async function loadRuleDefinitionFromFile(
  filePath: string,
  rulesDirectory?: string,
): Promise<RuleSetDefinition> {
  const absoluteFilePath = resolve(filePath);
  const source = await readFile(absoluteFilePath, 'utf8');
  const raw = YAML.parse(source) as RuleDefinitionSource & {
    substancesFile?: string;
  };

  if (typeof raw['substancesFile'] === 'string') {
    const substancesFilePath = resolve(
      dirname(absoluteFilePath),
      raw['substancesFile'],
    );
    const substancesSource = await readFile(substancesFilePath, 'utf8');
    raw['substances'] = parseRuleSubstancesCsv(
      substancesSource,
      `substancesFile for ${absoluteFilePath}`,
    );
  }

  return buildRuleDefinition(
    raw,
    toRuleSourcePath(absoluteFilePath, rulesDirectory),
  );
}

export async function computeRuleDataSignature(
  directory: string,
): Promise<string> {
  const absoluteDirectory = resolve(directory);
  const files = await findRuleDataFiles(absoluteDirectory);
  const signatures = await Promise.all(
    files
      .sort((left, right) => left.localeCompare(right))
      .map(async (filePath) => {
        const metadata = await stat(filePath);
        return `${filePath}:${metadata.mtimeMs}:${metadata.size}`;
      }),
  );

  return signatures.join('|');
}
