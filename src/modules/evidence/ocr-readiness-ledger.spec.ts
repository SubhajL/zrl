import { buildOcrReadinessLedger } from './ocr-readiness-ledger';

describe('OCR readiness ledger', () => {
  it('enumerates every currently required combo-document slot and reflects exhaustive browser proof', async () => {
    const ledger = await buildOcrReadinessLedger();

    expect(ledger.version).toBe(1);
    expect(ledger.totalRequiredSlots).toBe(75);
    expect(ledger.entries).toHaveLength(75);
    expect(ledger.fullyReadySlots).toBeGreaterThan(0);

    expect(ledger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          combo: 'JAPAN/MANGO',
          documentLabel: 'Phytosanitary Certificate',
          ready: true,
          browserProof: expect.objectContaining({
            status: 'COMPLETE',
          }),
        }),
        expect.objectContaining({
          combo: 'EU/MANGO',
          documentLabel: 'GAP Certificate',
          ready: true,
          browserProof: expect.objectContaining({
            status: 'COMPLETE',
          }),
        }),
        expect.objectContaining({
          combo: 'KOREA/MANGO',
          documentLabel: 'VHT Certificate',
          classifierProof: expect.objectContaining({
            status: 'COMPLETE',
          }),
          browserProof: expect.objectContaining({
            status: 'COMPLETE',
          }),
        }),
      ]),
    );
  });

  it('marks every slot blocked when any proof layer is not complete', async () => {
    const ledger = await buildOcrReadinessLedger();

    for (const entry of ledger.entries) {
      if (
        entry.fixture.status !== 'COMPLETE' ||
        entry.classifierProof.status !== 'COMPLETE' ||
        entry.backendProof.status !== 'COMPLETE' ||
        entry.browserProof.status !== 'COMPLETE'
      ) {
        expect(entry.ready).toBe(false);
        expect(entry.blockerReasons.length).toBeGreaterThan(0);
      }
    }
  });

  it('includes base and combo-specific required fields for override-bearing slots', async () => {
    const ledger = await buildOcrReadinessLedger();

    expect(ledger.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          combo: 'JAPAN/MANGO',
          documentLabel: 'Phytosanitary Certificate',
          requiredFieldKeys: expect.arrayContaining([
            'certificateNumber',
            'mustStateFruitFlyFree',
            'treatmentReference',
          ]),
        }),
      ]),
    );
  });
});
