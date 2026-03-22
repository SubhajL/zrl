import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('refreshes cached rules automatically when the backing yaml changes', async () => {
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
    expect(initial?.version).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 5));
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
        '',
      ].join('\n'),
    );

    const updated = await service.getRuleDefinition('JAPAN', 'MANGO');
    expect(updated?.version).toBe(2);
  });
});
