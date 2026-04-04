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
    labPolicy: {
      enforcementMode: 'DOCUMENT_ONLY',
      requiredArtifactType: 'MRL_TEST',
      acceptedUnits: ['mg/kg', 'ppm'],
      defaultDestinationMrlMgKg: null,
    },
    substances: [
      {
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
        aliases: [],
        sourceRef: null,
        note: null,
      },
    ],
    ...overrides,
  };
}

describe('RulesEngineService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

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
    const notificationService = {
      notifyMarketAudience: jest.fn().mockResolvedValue([]),
    };
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
    const service = new RulesEngineService(
      loader,
      store,
      {
        hashString,
      } as unknown as HashingService,
      notificationService as never,
    );

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
    expect(notificationService.notifyMarketAudience).toHaveBeenCalledWith(
      'JAPAN',
      {
        laneId: null,
        type: 'RULE_CHANGE',
        title: 'Rule update published',
        message: 'Japan market rules were updated for Prochloraz.',
        data: {
          market: 'JAPAN',
          substanceId: 'substance-2',
          substanceName: 'Prochloraz',
          changeType: 'CREATED',
        },
      },
    );
  });

  it('getChecklist categorizes required evidence for a market and product', async () => {
    const definition = buildDefinition({
      requiredDocuments: [
        'Phytosanitary Certificate',
        'Commercial Invoice',
        'Temperature Log',
      ],
    });
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
        version: 1,
        effectiveDate: definition.effectiveDate,
        sourcePath: definition.sourcePath,
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

    await expect(service.getChecklist('JAPAN', 'MANGO')).resolves.toEqual({
      checklist: [
        expect.objectContaining({
          label: 'Phytosanitary Certificate',
          category: 'REGULATORY',
          present: false,
          status: 'MISSING',
        }),
        expect.objectContaining({
          label: 'Commercial Invoice',
          category: 'CHAIN_OF_CUSTODY',
          present: false,
          status: 'MISSING',
        }),
        expect.objectContaining({
          label: 'Temperature Log',
          category: 'COLD_CHAIN',
          present: false,
          status: 'MISSING',
        }),
      ],
    });
  });

  it('evaluateLane applies weighted completeness scoring and certification alerts', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-24T05:30:00.000Z'));
    const definition = buildDefinition({
      requiredDocuments: [
        'Phytosanitary Certificate',
        'VHT Certificate',
        'Temperature Log',
        'Commercial Invoice',
      ],
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        metadata: { expiresAt: '2026-04-01T00:00:00.000Z' },
      },
      {
        id: 'artifact-2',
        artifactType: 'TEMP_DATA',
        fileName: 'temperature.json',
        metadata: null,
      },
      {
        id: 'artifact-3',
        artifactType: 'INVOICE',
        fileName: 'invoice.pdf',
        metadata: null,
      },
    ]);

    expect(result.score).toBe(80);
    expect(result.required).toBe(4);
    expect(result.present).toBe(3);
    expect(result.missing).toEqual(['VHT Certificate']);
    expect(result.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'REGULATORY',
          required: 2,
          present: 1,
          score: 0.5,
        }),
      ]),
    );
    expect(result.certificationAlerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'PHYTO_CERT',
          status: 'VALID',
        }),
        expect.objectContaining({
          artifactType: 'VHT_CERT',
          status: 'MISSING',
        }),
      ]),
    );
  });

  it('evaluateLane flags any mrl exceedance and preserves unknown substances', () => {
    const definition = buildDefinition({
      substances: [
        {
          name: 'Chlorpyrifos',
          aliases: [],
          cas: '2921-88-2',
          thaiMrl: 0.5,
          destinationMrl: 0.01,
          stringencyRatio: 50,
          riskLevel: 'CRITICAL',
          sourceRef: null,
          note: null,
        },
        {
          name: 'Dithiocarbamates',
          aliases: [],
          cas: '111-54-6',
          thaiMrl: 2,
          destinationMrl: 0.1,
          stringencyRatio: 20,
          riskLevel: 'CRITICAL',
          sourceRef: null,
          note: null,
        },
      ],
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [
            {
              substance: 'Chlorpyrifos',
              valueMgKg: 0.02,
            },
          ],
        },
      },
    ]);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        valid: false,
        hasUnknowns: true,
        results: [
          expect.objectContaining({
            substance: 'Chlorpyrifos',
            valueMgKg: 0.02,
            limitMgKg: 0.01,
            status: 'FAIL',
          }),
          expect.objectContaining({
            substance: 'Dithiocarbamates',
            valueMgKg: null,
            limitMgKg: 0.1,
            status: 'UNKNOWN',
          }),
        ],
      }),
    );
  });

  it('evaluateLane treats a measured value at the destination limit as passing', () => {
    const definition = buildDefinition();
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [
            {
              substance: 'Chlorpyrifos',
              valueMgKg: 0.01,
            },
          ],
        },
      },
    ]);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        valid: true,
        hasUnknowns: false,
        blockingReasons: [],
        results: [
          expect.objectContaining({
            substance: 'Chlorpyrifos',
            valueMgKg: 0.01,
            status: 'PASS',
          }),
        ],
      }),
    );
  });

  it('evaluateLane blocks when full pesticide enforcement requires structured mrl evidence', () => {
    const definition = buildDefinition({
      market: 'KOREA',
      product: 'MANGO',
      labPolicy: {
        enforcementMode: 'FULL_PESTICIDE',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: 0.01,
      },
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, []);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        status: 'BLOCKED',
        valid: false,
        blockingReasons: ['MRL_TEST_REQUIRED'],
        results: [],
      }),
    );
  });

  it('evaluateLane uses the specific korea mango threshold before the default fallback', () => {
    const definition = buildDefinition({
      market: 'KOREA',
      product: 'MANGO',
      labPolicy: {
        enforcementMode: 'FULL_PESTICIDE',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: 0.01,
      },
      substances: [
        {
          name: 'Acetamiprid',
          aliases: ['아세타미프리드'],
          cas: '135410-20-7',
          thaiMrl: null,
          destinationMrl: 0.2,
          stringencyRatio: null,
          riskLevel: null,
          sourceRef: 'MFDS foodView:ap105050006; infoView:P00227',
          note: null,
        },
      ],
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [
            {
              substance: '아세타미프리드',
              valueMgKg: 0.25,
            },
            {
              substance: 'Unlisted Pesticide',
              valueMgKg: 0.02,
            },
          ],
        },
      },
    ]);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        status: 'FAIL',
        valid: false,
        blockingReasons: [],
        results: [
          expect.objectContaining({
            substance: 'Acetamiprid',
            limitMgKg: 0.2,
            status: 'FAIL',
            limitSource: 'SPECIFIC',
          }),
          expect.objectContaining({
            substance: 'Unlisted Pesticide',
            limitMgKg: 0.01,
            status: 'FAIL',
            limitSource: 'DEFAULT_FALLBACK',
          }),
        ],
      }),
    );
  });

  it('evaluateLane treats a non-detect Japan mango row as a zero-tolerance hard stop', () => {
    const definition = buildDefinition({
      market: 'JAPAN',
      product: 'MANGO',
      labPolicy: {
        enforcementMode: 'FULL_PESTICIDE',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: 0.01,
      },
      substances: [
        {
          name: 'ETHYLENE DIBROMIDE (EDB)',
          aliases: [],
          cas: null,
          thaiMrl: null,
          destinationMrl: 0,
          destinationLimitType: 'NON_DETECT',
          stringencyRatio: null,
          riskLevel: null,
          sourceRef: 'JFCRF food_group_detail:11600',
          note: 'Source limit N.D.; encoded operationally as 0 mg/kg.',
        },
      ],
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [
            {
              substance: 'ETHYLENE DIBROMIDE (EDB)',
              valueMgKg: 0.001,
            },
          ],
        },
      },
    ]);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        status: 'FAIL',
        valid: false,
        hasUnknowns: false,
        results: [
          expect.objectContaining({
            substance: 'ETHYLENE DIBROMIDE (EDB)',
            limitMgKg: 0,
            passed: false,
            status: 'FAIL',
            limitSource: 'SPECIFIC',
          }),
        ],
      }),
    );
  });

  it('evaluateLane leaves physiological-level Japan mango rows as unknown rather than inventing a numeric threshold', () => {
    const definition = buildDefinition({
      market: 'JAPAN',
      product: 'MANGO',
      labPolicy: {
        enforcementMode: 'FULL_PESTICIDE',
        requiredArtifactType: 'MRL_TEST',
        acceptedUnits: ['mg/kg', 'ppm'],
        defaultDestinationMrlMgKg: 0.01,
      },
      substances: [
        {
          name: 'GIBBERELLIN',
          aliases: [],
          cas: null,
          thaiMrl: null,
          destinationMrl: 0,
          destinationLimitType: 'PHYSIOLOGICAL_LEVEL',
          stringencyRatio: null,
          riskLevel: null,
          sourceRef: 'JFCRF food_group_detail:11600',
          note: 'Source symbol ※ means no more than physiological level contained naturally.',
        },
      ],
    });
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      {} as RuleStore,
      { hashString: jest.fn() } as unknown as HashingService,
    );

    const result = service.evaluateLane(definition, [
      {
        id: 'artifact-1',
        artifactType: 'MRL_TEST',
        fileName: 'lab-results.json',
        metadata: {
          results: [
            {
              substance: 'GIBBERELLIN',
              valueMgKg: 0.5,
            },
          ],
        },
      },
    ]);

    expect(result.labValidation).toEqual(
      expect.objectContaining({
        status: 'PASS',
        valid: true,
        hasUnknowns: true,
        results: [
          expect.objectContaining({
            substance: 'GIBBERELLIN',
            limitMgKg: null,
            passed: false,
            status: 'UNKNOWN',
            limitSource: 'SPECIFIC',
          }),
        ],
      }),
    );
  });

  it('notifies lane owners when an uploaded certification is already expired', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-24T00:00:00.000Z'));
    const notifyLaneOwner = jest.fn().mockResolvedValue([
      {
        id: 'notification-1',
      },
    ]);
    const notificationService = {
      notifyLaneOwner,
    };
    const claimCertificationAlertDelivery = jest.fn().mockResolvedValue({
      id: 'delivery-1',
    });
    const completeCertificationAlertDelivery = jest
      .fn()
      .mockResolvedValue(undefined);
    const releaseCertificationAlertDelivery = jest
      .fn()
      .mockResolvedValue(undefined);
    const store = {
      claimCertificationAlertDelivery,
      completeCertificationAlertDelivery,
      releaseCertificationAlertDelivery,
      runInTransaction: jest.fn(),
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn(),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
      listLatestActiveCertificationArtifacts: jest.fn(),
    } as unknown as RuleStore;
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      store,
      { hashString: jest.fn() } as unknown as HashingService,
      notificationService as never,
    );

    await service.notifyCertificationAlertForArtifact({
      laneId: 'lane-1',
      lanePublicId: 'LN-2026-001',
      artifact: {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        metadata: {
          expiresAt: '2026-03-01T00:00:00.000Z',
        },
      },
    });

    expect(claimCertificationAlertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-1',
        artifactId: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        alertCode: 'EXPIRED',
      }),
    );
    const notifyLaneOwnerCalls = notifyLaneOwner.mock.calls as Array<
      [
        string,
        {
          type: string;
          title: string;
          message: string;
          data: Record<string, unknown>;
        },
      ]
    >;
    const notifiedLaneId = notifyLaneOwnerCalls[0]?.[0] ?? null;
    const notificationInput = notifyLaneOwnerCalls[0]?.[1] ?? null;
    expect(notifiedLaneId).toBe('lane-1');
    expect(notificationInput).toMatchObject({
      type: 'CERTIFICATION_EXPIRY',
      title: 'Certification expired',
      data: {
        artifactId: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        alertCode: 'EXPIRED',
      },
    });
    expect(notificationInput?.message).toContain('Lane LN-2026-001');
    expect(completeCertificationAlertDelivery).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        notificationId: 'notification-1',
        deliveryStatus: 'DELIVERED',
      }),
    );
  });

  it('does not notify for uploaded certifications that are still valid', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-24T00:00:00.000Z'));
    const notifyLaneOwner = jest.fn().mockResolvedValue([]);
    const notificationService = {
      notifyLaneOwner,
    };
    const claimCertificationAlertDelivery = jest.fn();
    const store = {
      claimCertificationAlertDelivery,
      completeCertificationAlertDelivery: jest.fn(),
      releaseCertificationAlertDelivery: jest.fn(),
      runInTransaction: jest.fn(),
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn(),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
      listLatestActiveCertificationArtifacts: jest.fn(),
    } as unknown as RuleStore;
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      store,
      { hashString: jest.fn() } as unknown as HashingService,
      notificationService as never,
    );

    await service.notifyCertificationAlertForArtifact({
      laneId: 'lane-1',
      lanePublicId: 'LN-2026-001',
      artifact: {
        id: 'artifact-1',
        artifactType: 'PHYTO_CERT',
        fileName: 'phyto.pdf',
        metadata: {
          expiresAt: '2026-04-15T00:00:00.000Z',
        },
      },
    });

    expect(claimCertificationAlertDelivery).not.toHaveBeenCalled();
    expect(notifyLaneOwner).not.toHaveBeenCalled();
  });

  it('scanCertificationExpirations emits warning notifications for upcoming expiries', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-24T00:00:00.000Z'));
    const notifyLaneOwner = jest.fn().mockResolvedValue([
      {
        id: 'notification-14',
      },
    ]);
    const notificationService = {
      notifyLaneOwner,
    };
    const claimCertificationAlertDelivery = jest.fn().mockResolvedValue({
      id: 'delivery-14',
    });
    const store = {
      claimCertificationAlertDelivery,
      completeCertificationAlertDelivery: jest
        .fn()
        .mockResolvedValue(undefined),
      releaseCertificationAlertDelivery: jest.fn().mockResolvedValue(undefined),
      listLatestActiveCertificationArtifacts: jest.fn().mockResolvedValue([
        {
          laneId: 'lane-1',
          lanePublicId: 'LN-2026-001',
          artifactId: 'artifact-1',
          artifactType: 'PHYTO_CERT',
          fileName: 'phyto.pdf',
          metadata: {
            expiresAt: '2026-04-07T00:00:00.000Z',
          },
          uploadedAt: new Date('2026-03-20T00:00:00.000Z'),
        },
      ]),
      runInTransaction: jest.fn(),
      syncRuleDefinition: jest.fn(),
      findLatestRuleSet: jest.fn(),
      listMarkets: jest.fn(),
      listSubstances: jest.fn(),
      createSubstance: jest.fn(),
      bumpRuleVersionsForMarket: jest.fn(),
      updateSubstance: jest.fn(),
      listRuleVersions: jest.fn(),
      appendSubstanceAuditEntry: jest.fn(),
    } as unknown as RuleStore;
    const service = new RulesEngineService(
      { reload: jest.fn(), getRuleDefinition: jest.fn() } as never,
      store,
      { hashString: jest.fn() } as unknown as HashingService,
      notificationService as never,
    );

    const result = await service.scanCertificationExpirations();

    expect(claimCertificationAlertDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        laneId: 'lane-1',
        artifactId: 'artifact-1',
        alertCode: 'WARNING_14',
        warningDays: 14,
      }),
    );
    const warningNotifyLaneOwnerCalls = notifyLaneOwner.mock.calls as Array<
      [
        string,
        {
          type: string;
          title: string;
          message: string;
          data: Record<string, unknown>;
        },
      ]
    >;
    const warningLaneId = warningNotifyLaneOwnerCalls[0]?.[0] ?? null;
    const warningNotificationInput =
      warningNotifyLaneOwnerCalls[0]?.[1] ?? null;
    expect(warningLaneId).toBe('lane-1');
    expect(warningNotificationInput).toMatchObject({
      type: 'CERTIFICATION_EXPIRY',
      title: 'Certification expires in 14 days',
      data: {
        alertCode: 'WARNING_14',
        warningDays: 14,
      },
    });
    expect(warningNotificationInput?.message).toContain('Lane LN-2026-001');
    expect(result).toEqual(
      expect.objectContaining({
        processed: 1,
        notified: 1,
      }),
    );
  });
});
