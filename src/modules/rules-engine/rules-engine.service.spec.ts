import { RulesEngineService } from './rules-engine.service';
import type { HashingService } from '../../common/hashing/hashing.service';
import type {
  RuleLoaderPort,
  RuleSetDefinition,
  RuleStore,
} from './rules-engine.types';

function buildDefinition(
  overrides: Partial<RuleSetDefinition> = {},
): RuleSetDefinition {
  return {
    market: 'JAPAN',
    product: 'MANGO',
    version: 1,
    effectiveDate: new Date('2026-03-01'),
    sourcePath: '/rules/japan/mango.yaml',
    requiredDocuments: ['Phytosanitary Certificate'],
    completenessWeights: {
      regulatory: 0.4,
      quality: 0.25,
      coldChain: 0.2,
      chainOfCustody: 0.15,
    },
    substances: [
      {
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
      },
    ],
    ...overrides,
  };
}

describe('RulesEngineService', () => {
  it('reloadRules syncs loaded definitions to the rule store', async () => {
    const definition = buildDefinition();
    const loader = {
      reload: jest.fn().mockResolvedValue([definition]),
    } as unknown as RuleLoaderPort;
    const syncRuleDefinition = jest.fn().mockResolvedValue({
      id: 'rule-set-1',
      market: definition.market,
      product: definition.product,
      version: definition.version,
      effectiveDate: definition.effectiveDate,
      sourcePath: definition.sourcePath,
      payload: definition,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    const store = {} as RuleStore;
    const runInTransaction = jest.fn(
      async <T>(operation: (transactionalStore: RuleStore) => Promise<T>) =>
        await operation(store),
    );
    Object.assign(store, {
      runInTransaction,
      syncRuleDefinition,
      findLatestRuleSet: jest.fn(),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
    });
    const service = new RulesEngineService(loader, store, {
      hashString: jest.fn(),
    } as unknown as HashingService);

    const result = await service.reloadRules();

    expect(result.loaded).toBe(1);
    expect(syncRuleDefinition).toHaveBeenCalledWith(definition);
    expect(runInTransaction).toHaveBeenCalled();
  });

  it('getRuleSnapshot combines the current yaml definition and version metadata', async () => {
    const definition = buildDefinition();
    const loader = {
      getRuleDefinition: jest.fn().mockResolvedValue(definition),
      reload: jest.fn(),
    } as unknown as RuleLoaderPort;
    const store = {
      runInTransaction: jest.fn(),
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn().mockResolvedValue({
        id: 'rule-set-1',
        market: 'JAPAN',
        product: 'MANGO',
        version: 3,
        effectiveDate: new Date('2026-03-01'),
        sourcePath: '/rules/japan/mango.yaml',
        payload: definition,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
    } as unknown as RuleStore;
    const service = new RulesEngineService(loader, store, {
      hashString: jest.fn(),
    } as unknown as HashingService);

    const snapshot = await service.getRuleSnapshot('JAPAN', 'MANGO');

    expect(snapshot).toMatchObject({
      market: 'JAPAN',
      product: 'MANGO',
      version: 3,
      sourcePath: '/rules/japan/mango.yaml',
    });
  });

  it('delegates market and substance lookups to the store', async () => {
    const loader = {
      getRuleDefinition: jest.fn(),
      reload: jest.fn(),
    } as unknown as RuleLoaderPort;
    const listMarkets = jest.fn().mockResolvedValue(['JAPAN']);
    const listSubstances = jest.fn().mockResolvedValue([
      {
        id: 'substance-1',
        market: 'JAPAN',
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ]);
    const store = {
      runInTransaction: jest.fn(),
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn(),
      listMarkets,
      listSubstances,
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
    } as unknown as RuleStore;
    const service = new RulesEngineService(loader, store, {
      hashString: jest.fn(),
    } as unknown as HashingService);

    await expect(service.listMarkets()).resolves.toEqual(['JAPAN']);
    await expect(service.listSubstances('JAPAN')).resolves.toHaveLength(1);
    expect(listSubstances).toHaveBeenCalledWith('JAPAN');
  });

  it('bumps rule versions when an admin creates a substance', async () => {
    const loader = {
      getRuleDefinition: jest.fn(),
      reload: jest.fn(),
    } as unknown as RuleLoaderPort;
    const createdSubstance = {
      id: 'substance-2',
      market: 'JAPAN',
      name: 'Prochloraz',
      cas: '67747-09-5',
      thaiMrl: 5,
      destinationMrl: 2,
      stringencyRatio: 2.5,
      riskLevel: 'MEDIUM',
      createdAt: new Date('2026-03-02T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    };
    const createSubstance = jest.fn().mockResolvedValue(createdSubstance);
    const bumpRuleVersionsForMarket = jest.fn().mockResolvedValue([]);
    const hashString = jest
      .fn()
      .mockResolvedValue(
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      );
    const appendSubstanceAuditEntry = jest.fn().mockResolvedValue(undefined);
    const store = {} as RuleStore;
    const runInTransaction = jest.fn(
      async <T>(operation: (transactionalStore: RuleStore) => Promise<T>) =>
        await operation(store),
    );
    Object.assign(store, {
      runInTransaction,
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn(),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance,
      bumpRuleVersionsForMarket,
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry,
    });
    const service = new RulesEngineService(loader, store, {
      hashString,
    } as unknown as HashingService);

    const result = await service.createSubstance(
      'JAPAN',
      {
        name: 'Prochloraz',
        cas: '67747-09-5',
        thaiMrl: 5,
        destinationMrl: 2,
      },
      'admin-1',
    );

    expect(result).toMatchObject({ name: 'Prochloraz', market: 'JAPAN' });
    expect(createSubstance).toHaveBeenCalledWith('JAPAN', {
      name: 'Prochloraz',
      cas: '67747-09-5',
      thaiMrl: 5,
      destinationMrl: 2,
    });
    expect(bumpRuleVersionsForMarket).toHaveBeenCalledWith(
      'JAPAN',
      'Substance created: Prochloraz',
    );
    expect(appendSubstanceAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'admin-1',
        action: 'CREATE',
        substanceId: 'substance-2',
      }),
    );
  });
});
