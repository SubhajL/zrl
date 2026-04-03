import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadRuleDefinitionFromFile } from './rule-definition.files';
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
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.substances).toHaveLength(12);
    expect(definition.substances[0]).toMatchObject({
      name: 'Chlorpyrifos',
      aliases: ['クロルピリホス'],
      cas: '2921-88-2',
      thaiMrl: 0.5,
      destinationMrl: 0.01,
      stringencyRatio: 50,
      riskLevel: 'CRITICAL',
      sourceRef: 'JFCRF db.ffcr.or.jp',
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
    expect(definition.requiredDocuments).toContain('Phytosanitary Certificate');
    expect(definition.labPolicy).toMatchObject({
      enforcementMode: 'FULL_PESTICIDE',
      requiredArtifactType: 'MRL_TEST',
      defaultDestinationMrlMgKg: 0.01,
    });
    expect(definition.substances.length).toBeGreaterThan(50);
    expect(definition.substances[0]).toMatchObject({
      name: 'Glufosinate(ammonium)',
      aliases: ['글루포시네이트'],
      destinationMrl: 0.05,
      thaiMrl: null,
    });
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
