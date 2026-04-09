import { buildOcrReadinessLedger } from './ocr-readiness-ledger';

describe('OCR readiness ledger', () => {
  it('enumerates every currently required combo-document slot and reflects exhaustive browser proof', async () => {
    const ledger = await buildOcrReadinessLedger();

    expect(ledger.version).toBe(1);
    expect(ledger.totalRequiredSlots).toBe(75);
    expect(ledger.entries).toHaveLength(75);
    expect(ledger.fullyReadySlots).toBeGreaterThan(0);

    const japanMangoPhyto = ledger.entries.find(
      (entry) =>
        entry.combo === 'JAPAN/MANGO' &&
        entry.documentLabel === 'Phytosanitary Certificate',
    );
    const euMangoGap = ledger.entries.find(
      (entry) =>
        entry.combo === 'EU/MANGO' && entry.documentLabel === 'GAP Certificate',
    );
    const koreaMangoVht = ledger.entries.find(
      (entry) =>
        entry.combo === 'KOREA/MANGO' &&
        entry.documentLabel === 'VHT Certificate',
    );

    expect(japanMangoPhyto?.ready).toBe(true);
    expect(japanMangoPhyto?.browserProof.status).toBe('COMPLETE');
    expect(euMangoGap?.ready).toBe(true);
    expect(euMangoGap?.browserProof.status).toBe('COMPLETE');
    expect(koreaMangoVht?.classifierProof.status).toBe('COMPLETE');
    expect(koreaMangoVht?.browserProof.status).toBe('COMPLETE');
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

    const japanMangoPhyto = ledger.entries.find(
      (entry) =>
        entry.combo === 'JAPAN/MANGO' &&
        entry.documentLabel === 'Phytosanitary Certificate',
    );

    expect(japanMangoPhyto?.requiredFieldKeys).toEqual(
      expect.arrayContaining([
        'certificateNumber',
        'mustStateFruitFlyFree',
        'treatmentReference',
      ]),
    );
  });
});
