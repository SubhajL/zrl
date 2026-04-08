import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  findRuleYamlFiles,
  loadRuleDefinitionFromFile,
} from './rule-definition.files';
import { RuleLoaderService } from './rule-loader.service';

describe('RuleLoaderService', () => {
  it('loads a rule definition from YAML and computes derived fields', async () => {
    const rulesDir = mkdtempSync(join(tmpdir(), 'zrl-rules-'));
    const mangoDir = join(rulesDir, 'japan');
    const mangoFile = join(mangoDir, 'mango.yaml');
    mkdirSync(mangoDir, { recursive: true });
    writeFileSync(
      mangoFile,
      [
        'market: JAPAN',
        'product: MANGO',
        'version: 1',
        'effectiveDate: 2026-03-01',
        'requiredDocuments:',
        '  - Phytosanitary Certificate',
        'completenessWeights:',
        '  regulatory: 0.4',
        '  quality: 0.25',
        '  coldChain: 0.2',
        '  chainOfCustody: 0.15',
        'metadata:',
        '  coverageState: CURATED_HIGH_RISK',
        '  sourceQuality: PRIMARY_ONLY',
        '  retrievedAt: 2026-04-04',
        '  commodityCode: mango-jp-manual',
        '  nonPesticideChecks:',
        '    - type: VHT',
        '      status: REQUIRED',
        '      parameters:',
        '        minCoreTemperatureC: 47',
        '        minHoldMinutes: 20',
        'substances:',
        '  - name: Chlorpyrifos',
        '    cas: 2921-88-2',
        '    thaiMrl: 0.5',
        '    destinationMrl: 0.01',
        '',
      ].join('\n'),
    );

    const service = new RuleLoaderService(rulesDir);
    const definition = await service.getRuleDefinition('JAPAN', 'MANGO');

    expect(definition).not.toBeNull();
    expect(definition?.market).toBe('JAPAN');
    expect(definition?.product).toBe('MANGO');
    expect(definition?.metadata).toMatchObject({
      coverageState: 'CURATED_HIGH_RISK',
      sourceQuality: 'PRIMARY_ONLY',
      commodityCode: 'mango-jp-manual',
    });
    expect(definition?.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    expect(definition?.metadata.nonPesticideChecks).toEqual([
      expect.objectContaining({
        type: 'VHT',
        status: 'REQUIRED',
        parameters: {
          minCoreTemperatureC: 47,
          minHoldMinutes: 20,
        },
      }),
    ]);
    expect(definition?.substances[0]).toMatchObject({
      name: 'Chlorpyrifos',
      cas: '2921-88-2',
      thaiMrl: 0.5,
      destinationMrl: 0.01,
      stringencyRatio: 50,
      riskLevel: 'CRITICAL',
    });
  });

  it('reloads a rule definition after the yaml file changes', async () => {
    const rulesDir = mkdtempSync(join(tmpdir(), 'zrl-rules-'));
    const mangoDir = join(rulesDir, 'japan');
    const mangoFile = join(mangoDir, 'mango.yaml');
    mkdirSync(mangoDir, { recursive: true });
    writeFileSync(
      mangoFile,
      [
        'market: JAPAN',
        'product: MANGO',
        'version: 1',
        'effectiveDate: 2026-03-01',
        'requiredDocuments: []',
        'completenessWeights:',
        '  regulatory: 0.4',
        '  quality: 0.25',
        '  coldChain: 0.2',
        '  chainOfCustody: 0.15',
        'metadata:',
        '  coverageState: CURATED_HIGH_RISK',
        '  sourceQuality: PRIMARY_ONLY',
        '  retrievedAt: 2026-03-01',
        '  commodityCode:',
        '  nonPesticideChecks: []',
        'substances:',
        '  - name: Chlorpyrifos',
        '    cas: 2921-88-2',
        '    thaiMrl: 0.5',
        '    destinationMrl: 0.01',
        '',
      ].join('\n'),
    );

    const service = new RuleLoaderService(rulesDir);
    const initial = await service.getRuleDefinition('JAPAN', 'MANGO');
    expect(initial?.substances).toHaveLength(1);

    writeFileSync(
      mangoFile,
      [
        'market: JAPAN',
        'product: MANGO',
        'version: 2',
        'effectiveDate: 2026-03-02',
        'requiredDocuments: []',
        'completenessWeights:',
        '  regulatory: 0.4',
        '  quality: 0.25',
        '  coldChain: 0.2',
        '  chainOfCustody: 0.15',
        'metadata:',
        '  coverageState: CURATED_HIGH_RISK',
        '  sourceQuality: PRIMARY_ONLY',
        '  retrievedAt: 2026-03-02',
        '  commodityCode:',
        '  nonPesticideChecks: []',
        'substances:',
        '  - name: Chlorpyrifos',
        '    cas: 2921-88-2',
        '    thaiMrl: 0.5',
        '    destinationMrl: 0.01',
        '  - name: Dithiocarbamates',
        '    cas: 111-54-6',
        '    thaiMrl: 2',
        '    destinationMrl: 0.1',
        '',
      ].join('\n'),
    );

    const reloaded = await service.reload();
    const definition = reloaded.find(
      (rule) => rule.market === 'JAPAN' && rule.product === 'MANGO',
    );

    expect(definition?.version).toBe(2);
    expect(definition?.substances).toHaveLength(2);
  });

  it('loads csv-backed substances from the repository rule files', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/japan/mango.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('JAPAN');
    expect(definition.product).toBe('MANGO');
    expect(definition.sourcePath).toBe('rules/japan/mango.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_PLUS_SECONDARY');
    expect(definition.metadata.commodityCode).toBeNull();
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    const phytoCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'PHYTO_CERT',
    );
    const vhtCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'VHT',
    );
    const gapCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'GAP_CERT',
    );

    expect(phytoCheck).toMatchObject({
      status: 'REQUIRED',
      parameters: {
        issuingAuthority: 'Thai NPPO',
        mustStateFruitFlyFree: true,
        mustStateTreatmentPerformed: true,
      },
    });
    expect(vhtCheck).toMatchObject({
      status: 'REQUIRED',
      parameters: {
        minCoreTemperatureC: 47,
        minHoldMinutes: 20,
        alternateAllowedVariety: 'Nang Klang Wan',
        alternateMinCoreTemperatureC: 46.5,
        alternateMinHoldMinutes: 10,
        registeredProductionAreaRequired: true,
        maffVerificationRequired: true,
        packagingSealRequired: true,
        allowedVarieties:
          'Kio Savoy|Chok Anan|Nang Klang Wan|Nam Dok Mai|Pim Saen Daeng|Mahachanok|Rad',
      },
    });
    expect(gapCheck?.status).toBe('REQUIRED');
    expect(gapCheck?.note).toContain('not a MAFF import condition');
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.substances).toHaveLength(191);
    const acetamiprid = definition.substances.find(
      (substance) => substance.name === 'ACETAMIPRID',
    );
    const edb = definition.substances.find(
      (substance) => substance.name === 'ETHYLENE DIBROMIDE (EDB)',
    );
    expect(acetamiprid).toMatchObject({
      aliases: [],
      cas: null,
      thaiMrl: null,
      destinationMrl: 1,
      destinationLimitType: 'NUMERIC',
      stringencyRatio: null,
      riskLevel: null,
      sourceRef: 'JFCRF food_group_detail:11600',
    });
    expect(edb).toMatchObject({
      destinationMrl: 0,
      destinationLimitType: 'NON_DETECT',
      sourceRef: 'JFCRF food_group_detail:11600',
    });
    expect(edb?.note).toContain('N.D.');
    expect(
      definition.substances.find(
        (substance) => substance.name === 'GIBBERELLIN',
      ),
    ).toMatchObject({
      destinationMrl: 0,
      destinationLimitType: 'PHYSIOLOGICAL_LEVEL',
      sourceRef: 'JFCRF food_group_detail:11600',
    });
  });

  it('loads the repository korea mango rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/korea/mango.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('KOREA');
    expect(definition.product).toBe('MANGO');
    expect(definition.sourcePath).toBe('rules/korea/mango.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('ap105050006');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'VHT',
          status: 'REQUIRED',
          parameters: {
            minCoreTemperatureC: 47,
            minHoldMinutes: 20,
            overseasInspectionRequired: true,
            registrationRequired: true,
            allowedVarieties: 'Nang klarngwan|Nam Dork Mai|Rad|Mahachanok',
          },
        }),
      ]),
    );
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.substances).toHaveLength(64);
    expect(definition.substances[0]).toMatchObject({
      name: 'Glufosinate(ammonium)',
      aliases: ['글루포시네이트'],
      destinationMrl: 0.05,
      thaiMrl: null,
    });
  });

  it('loads the repository japan durian rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/japan/durian.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('JAPAN');
    expect(definition.product).toBe('DURIAN');
    expect(definition.sourcePath).toBe('rules/japan/durian.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_PLUS_SECONDARY');
    expect(definition.metadata.commodityCode).toBe('25839');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PHYTO_CERT',
          status: 'REQUIRED',
        }),
      ]),
    );
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.requiredDocuments).not.toContain('VHT Certificate');
    expect(definition.substances).toHaveLength(1);
    expect(definition.substances[0]).toMatchObject({
      name: 'GIBBERELLIN',
      aliases: ['ジベレリン'],
      cas: null,
      thaiMrl: null,
      destinationMrl: 0,
      destinationLimitType: 'PHYSIOLOGICAL_LEVEL',
      sourceRef: 'JFCRF food_group_detail:25839',
    });
  });

  it('loads the repository korea durian rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/korea/durian.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('KOREA');
    expect(definition.product).toBe('DURIAN');
    expect(definition.sourcePath).toBe('rules/korea/durian.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('ap105051059');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PHYTO_CERT',
          status: 'REQUIRED',
        }),
      ]),
    );
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.requiredDocuments).not.toContain('VHT Certificate');
    expect(definition.substances).toHaveLength(3);
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Carbaryl : NAC',
          aliases: ['카바릴'],
          cas: '63-25-2',
          thaiMrl: null,
          destinationMrl: 30,
          sourceRef: 'MFDS foodView:ap105051059',
        }),
        expect.objectContaining({
          name: 'Chlorpyrifos',
          aliases: ['클로르피리포스'],
          cas: '2921-88-2',
          thaiMrl: null,
          destinationMrl: 0.4,
          sourceRef: 'MFDS foodView:ap105051059',
        }),
        expect.objectContaining({
          name: 'Clothianidin',
          aliases: ['클로티아니딘'],
          cas: '210880-92-5',
          thaiMrl: null,
          destinationMrl: 0.9,
          sourceRef: 'MFDS foodView:ap105051059',
        }),
      ]),
    );
  });

  it('loads the repository korea mangosteen rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/korea/mangosteen.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('KOREA');
    expect(definition.product).toBe('MANGOSTEEN');
    expect(definition.sourcePath).toBe('rules/korea/mangosteen.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('ap105051360');
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-05',
    );
    const phytoCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'PHYTO_CERT',
    );
    expect(phytoCheck).toMatchObject({
      type: 'PHYTO_CERT',
      status: 'REQUIRED',
      parameters: {
        treatmentType: 'METHYL_BROMIDE_FUMIGATION',
        treatmentRequired: true,
        certificateMustStateTreatmentDetails: true,
        overseasInspectionRequired: true,
        registrationRequired: true,
      },
    });
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.requiredDocuments).not.toContain('VHT Certificate');
    expect(definition.substances).toHaveLength(3);
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Imidacloprid',
          aliases: ['이미다클로프리드'],
          thaiMrl: null,
          destinationMrl: 0.4,
          sourceRef: 'MFDS foodView:ap105051360',
        }),
        expect.objectContaining({
          name: 'Carbofuran',
          aliases: ['카보퓨란'],
          thaiMrl: null,
          destinationMrl: 2,
          sourceRef: 'MFDS foodView:ap105051360',
        }),
        expect.objectContaining({
          name: '3-Hydroxycarbofuran',
          aliases: [],
          thaiMrl: null,
          destinationMrl: 2,
          sourceRef: 'MFDS foodView:ap105051360',
        }),
      ]),
    );
  });

  it('loads the repository japan mangosteen rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/japan/mangosteen.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('JAPAN');
    expect(definition.product).toBe('MANGOSTEEN');
    expect(definition.sourcePath).toBe('rules/japan/mangosteen.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_PLUS_SECONDARY');
    expect(definition.metadata.commodityCode).toBe('11900');
    expect(definition.metadata.retrievedAt.toISOString()).toContain(
      '2026-04-04',
    );
    const phytoCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'PHYTO_CERT',
    );
    const vhtCheck = definition.metadata.nonPesticideChecks.find(
      (check) => check.type === 'VHT',
    );
    expect(phytoCheck).toMatchObject({
      type: 'PHYTO_CERT',
      status: 'REQUIRED',
    });
    expect(vhtCheck).toMatchObject({
      type: 'VHT',
      status: 'REQUIRED',
      parameters: {
        minRelativeHumidityPercent: 50,
        maxRelativeHumidityPercent: 80,
        minCoreTemperatureC: 46,
        minHoldMinutes: 58,
        minCoolingMinutes: 60,
      },
    });
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('VHT Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.substances).toHaveLength(247);
    expect(definition.substances[0]).toMatchObject({
      name: '1-NAPHTHALENEACETIC ACID',
      destinationMrl: 0.7,
      destinationLimitType: 'NUMERIC',
      sourceRef: 'JFCRF food_group_detail:11900',
    });
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'ETHYLENE DIBROMIDE (EDB)',
          destinationMrl: 0,
          destinationLimitType: 'NON_DETECT',
          sourceRef: 'JFCRF food_group_detail:11900',
        }),
        expect.objectContaining({
          name: 'CARBARYL',
          destinationMrl: 30,
          destinationLimitType: 'NUMERIC',
          note: 'Source MRL 30 mg/kg | Source note except fig | Basis Aa2020',
        }),
      ]),
    );
    expect(definition.substances).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'GIBBERELLIN',
        }),
      ]),
    );
  });

  it('ignores document-matrix yaml during repository rule discovery', async () => {
    const files = await findRuleYamlFiles(resolve(process.cwd(), 'rules'));

    expect(files).toContain(resolve(process.cwd(), 'rules/japan/mango.yaml'));
    expect(files).not.toContain(
      resolve(process.cwd(), 'rules/document-matrix.yaml'),
    );
  });

  it('does not load a repository japan longan rule file', async () => {
    const service = new RuleLoaderService(resolve(process.cwd(), 'rules'));

    await expect(
      service.getRuleDefinition('JAPAN', 'LONGAN'),
    ).resolves.toBeNull();
  });

  it('does not load a repository korea longan rule file', async () => {
    const service = new RuleLoaderService(resolve(process.cwd(), 'rules'));

    await expect(
      service.getRuleDefinition('KOREA', 'LONGAN'),
    ).resolves.toBeNull();
  });

  it('loads the repository eu mango rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/eu/mango.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('EU');
    expect(definition.product).toBe('MANGO');
    expect(definition.sourcePath).toBe('rules/eu/mango.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('0163030');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PHYTO_CERT',
          status: 'REQUIRED',
        }),
      ]),
    );
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.substances).toHaveLength(516);
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Acetamiprid (R)',
          destinationMrl: 0.01,
          destinationLimitType: 'NUMERIC',
        }),
        expect.objectContaining({
          name: 'Bicyclopyrone (sum of bicyclopyrone and its structurally related metabolites determined as the sum of the common moieties 2-(2- methoxyethoxymethyl)-6-(trifluoromethyl) pyridine-3-carboxylic acid (SYN503780) and (2-(2-hydroxyethoxymethyl)-6- (trifluoromethyl)pyridine-3-carboxylic acid (CSCD686480), expressed as bicyclopyrone)',
          destinationMrl: 0,
          destinationLimitType: 'NO_NUMERIC_LIMIT',
        }),
      ]),
    );
  });

  it('loads the repository eu durian rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/eu/durian.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('EU');
    expect(definition.product).toBe('DURIAN');
    expect(definition.sourcePath).toBe('rules/eu/durian.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('0163100');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PHYTO_CERT',
          status: 'REQUIRED',
        }),
      ]),
    );
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.substances).toHaveLength(516);
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Acetamiprid (R)',
          destinationMrl: 0.01,
          destinationLimitType: 'NUMERIC',
        }),
        expect.objectContaining({
          name: 'Bicyclopyrone (sum of bicyclopyrone and its structurally related metabolites determined as the sum of the common moieties 2-(2- methoxyethoxymethyl)-6-(trifluoromethyl) pyridine-3-carboxylic acid (SYN503780) and (2-(2-hydroxyethoxymethyl)-6- (trifluoromethyl)pyridine-3-carboxylic acid (CSCD686480), expressed as bicyclopyrone)',
          destinationMrl: 0,
          destinationLimitType: 'NO_NUMERIC_LIMIT',
        }),
      ]),
    );
  });

  it('loads the repository eu mangosteen rule file', async () => {
    const definition = await loadRuleDefinitionFromFile(
      resolve(process.cwd(), 'rules/eu/mangosteen.yaml'),
      resolve(process.cwd(), 'rules'),
    );

    expect(definition.market).toBe('EU');
    expect(definition.product).toBe('MANGOSTEEN');
    expect(definition.sourcePath).toBe('rules/eu/mangosteen.yaml');
    expect(definition.metadata.coverageState).toBe('FULL_EXHAUSTIVE');
    expect(definition.metadata.sourceQuality).toBe('PRIMARY_ONLY');
    expect(definition.metadata.commodityCode).toBe('0163040');
    expect(definition.metadata.nonPesticideChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PHYTO_CERT',
          status: 'REQUIRED',
        }),
      ]),
    );
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.requiredDocuments).toContain('MRL Test Results');
    expect(definition.substances).toHaveLength(516);
    expect(definition.substances).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Acetamiprid (R)',
          destinationMrl: 0.01,
          destinationLimitType: 'NUMERIC',
        }),
        expect.objectContaining({
          name: 'Fosetyl',
          destinationMrl: 0,
          destinationLimitType: 'NO_NUMERIC_LIMIT',
        }),
      ]),
    );
    const fosetyl = definition.substances.find(
      (substance) => substance.name === 'Fosetyl',
    );
    expect(fosetyl?.note).toContain('phosphonic acid applies');
  });

  it('refreshes cached rules automatically when the backing yaml changes', async () => {
    const rulesDir = mkdtempSync(join(tmpdir(), 'zrl-rules-'));
    const mangoDir = join(rulesDir, 'japan');
    const mangoFile = join(mangoDir, 'mango.yaml');
    const substancesFile = join(mangoDir, 'mango-substances.csv');
    mkdirSync(mangoDir, { recursive: true });
    writeFileSync(
      mangoFile,
      [
        'market: JAPAN',
        'product: MANGO',
        'version: 1',
        'effectiveDate: 2026-03-01',
        'requiredDocuments: []',
        'completenessWeights:',
        '  regulatory: 0.4',
        '  quality: 0.25',
        '  coldChain: 0.2',
        '  chainOfCustody: 0.15',
        'metadata:',
        '  coverageState: CURATED_HIGH_RISK',
        '  sourceQuality: PRIMARY_ONLY',
        '  retrievedAt: 2026-03-01',
        '  commodityCode:',
        '  nonPesticideChecks: []',
        'substancesFile: ./mango-substances.csv',
        '',
      ].join('\n'),
    );
    writeFileSync(
      substancesFile,
      [
        'name,cas,thaiMrl,destinationMrl',
        'Chlorpyrifos,2921-88-2,0.5,0.01',
        '',
      ].join('\n'),
    );

    const service = new RuleLoaderService(rulesDir);
    const initial = await service.getRuleDefinition('JAPAN', 'MANGO');
    expect(initial?.version).toBe(1);
    expect(initial?.substances).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
    writeFileSync(
      substancesFile,
      [
        'name,cas,thaiMrl,destinationMrl',
        'Chlorpyrifos,2921-88-2,0.5,0.01',
        'Dithiocarbamates,111-54-6,2,0.1',
        '',
      ].join('\n'),
    );

    const updated = await service.getRuleDefinition('JAPAN', 'MANGO');
    expect(updated?.version).toBe(1);
    expect(updated?.substances).toHaveLength(2);
  });

  it('loads csv-backed substances with aliases and nullable thai comparator fields', async () => {
    const rulesDir = mkdtempSync(join(tmpdir(), 'zrl-rules-'));
    const mangoDir = join(rulesDir, 'korea');
    const mangoFile = join(mangoDir, 'mango.yaml');
    const substancesFile = join(mangoDir, 'mango-substances.csv');
    mkdirSync(mangoDir, { recursive: true });
    writeFileSync(
      mangoFile,
      [
        'market: KOREA',
        'product: MANGO',
        'version: 1',
        'effectiveDate: 2026-04-03',
        'requiredDocuments:',
        '  - MRL Test Results',
        'completenessWeights:',
        '  regulatory: 0.4',
        '  quality: 0.25',
        '  coldChain: 0.2',
        '  chainOfCustody: 0.15',
        'metadata:',
        '  coverageState: PRIMARY_PARTIAL',
        '  sourceQuality: PRIMARY_ONLY',
        '  retrievedAt: 2026-04-03',
        '  commodityCode: ap105050006',
        '  nonPesticideChecks:',
        '    - type: VHT',
        '      status: REQUIRED',
        '      parameters:',
        '        minCoreTemperatureC: 47',
        '        minHoldMinutes: 20',
        'labPolicy:',
        '  enforcementMode: FULL_PESTICIDE',
        '  requiredArtifactType: MRL_TEST',
        '  acceptedUnits:',
        '    - mg/kg',
        '    - ppm',
        '  defaultDestinationMrlMgKg: 0.01',
        'substancesFile: ./mango-substances.csv',
        '',
      ].join('\n'),
    );
    writeFileSync(
      substancesFile,
      [
        'name,aliases,cas,thaiMrl,destinationMrl,sourceRef,note',
        'Acetamiprid,"아세타미프리드|Acetamiprid",135410-20-7,,0.2,"MFDS foodView:ap105050006; infoView:P00227","0.2 | 2020-11-26 개정고시 변경"',
        '',
      ].join('\n'),
    );

    const definition = await loadRuleDefinitionFromFile(mangoFile, rulesDir);

    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.substances).toEqual([
      expect.objectContaining({
        name: 'Acetamiprid',
        aliases: ['아세타미프리드', 'Acetamiprid'],
        cas: '135410-20-7',
        thaiMrl: null,
        destinationMrl: 0.2,
        stringencyRatio: null,
        riskLevel: null,
        sourceRef: 'MFDS foodView:ap105050006; infoView:P00227',
      }),
    ]);
  });
});
