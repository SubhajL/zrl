import { Inject, Injectable } from '@nestjs/common';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as YAML from 'yaml';
import {
  DEFAULT_RULES_DIRECTORY,
  RULES_DIRECTORY,
} from './rules-engine.constants';
import { buildRuleDefinition } from './rules-engine.utils';
import type { RuleSetDefinition } from './rules-engine.types';

async function findYamlFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findYamlFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

@Injectable()
export class RuleLoaderService {
  private cache = new Map<string, RuleSetDefinition>();
  private cacheSignature: string | null = null;

  constructor(
    @Inject(RULES_DIRECTORY)
    private readonly rulesDirectory: string = DEFAULT_RULES_DIRECTORY,
  ) {}

  async reload(): Promise<RuleSetDefinition[]> {
    const definitions = await this.loadFromDisk();
    this.cache = new Map(
      definitions.map((definition) => this.definitionKey(definition)),
    );
    this.cacheSignature = await this.computeSignature();
    return definitions;
  }

  async getRuleDefinition(
    market: string,
    product: string,
  ): Promise<RuleSetDefinition | null> {
    await this.ensureFreshCache();

    return this.cache.get(this.toKey(market, product)) ?? null;
  }

  async listRuleDefinitions(): Promise<RuleSetDefinition[]> {
    await this.ensureFreshCache();

    return [...this.cache.values()].sort((left, right) =>
      left.market === right.market
        ? left.product.localeCompare(right.product)
        : left.market.localeCompare(right.market),
    );
  }

  private async loadFromDisk(): Promise<RuleSetDefinition[]> {
    const absoluteDirectory = resolve(this.rulesDirectory);
    const files = await findYamlFiles(absoluteDirectory);
    const definitions = await Promise.all(
      files.map(async (filePath) => {
        const source = await readFile(filePath, 'utf8');
        const raw: unknown = YAML.parse(source);
        return buildRuleDefinition(raw, filePath);
      }),
    );

    const seen = new Set<string>();
    for (const definition of definitions) {
      const key = this.toKey(definition.market, definition.product);
      if (seen.has(key)) {
        throw new Error(`Duplicate rule definition for ${key}.`);
      }
      seen.add(key);
    }

    return definitions;
  }

  private async ensureFreshCache(): Promise<void> {
    if (this.cache.size === 0) {
      await this.reload();
      return;
    }

    const nextSignature = await this.computeSignature();
    if (this.cacheSignature !== nextSignature) {
      await this.reload();
    }
  }

  private async computeSignature(): Promise<string> {
    const absoluteDirectory = resolve(this.rulesDirectory);
    const files = await findYamlFiles(absoluteDirectory);
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

  private definitionKey(definition: RuleSetDefinition) {
    return [
      this.toKey(definition.market, definition.product),
      definition,
    ] as const;
  }

  private toKey(market: string, product: string): string {
    return `${market.trim().toUpperCase()}::${product.trim().toUpperCase()}`;
  }
}
