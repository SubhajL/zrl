import { MRV_LITE_STORE, EMISSION_FACTORS } from './mrv-lite.constants';
import type { MrvLiteStore } from './mrv-lite.types';
import { MrvLiteService } from './mrv-lite.service';

function createMockStore(): jest.Mocked<MrvLiteStore> {
  return {
    getLaneEsgData: jest.fn().mockResolvedValue({
      productType: 'MANGO',
      destinationMarket: 'JAPAN',
      transportMode: 'AIR',
      quantityKg: 1000,
      completenessScore: 85,
      status: 'VALIDATED',
      originProvince: 'Chanthaburi',
      evidenceCount: 12,
      auditEntryCount: 5,
    }),
    getExporterEsgData: jest.fn().mockResolvedValue({
      totalCo2eKg: 4600,
      avgCo2ePerKg: 2.3,
      laneCount: 2,
      avgCompleteness: 80,
      totalEvidenceCount: 24,
      distinctProvinces: 2,
      distinctProducts: 1,
    }),
    getPlatformEsgData: jest.fn().mockResolvedValue({
      totalCo2eKg: 50000,
      avgCo2ePerKg: 1.8,
      laneCount: 100,
      avgCompleteness: 75,
      totalEvidenceCount: 1200,
      totalAuditEntries: 600,
      distinctExporters: 15,
      distinctProvinces: 8,
      distinctProducts: 4,
    }),
  };
}

describe('MrvLiteService', () => {
  let service: MrvLiteService;
  let store: jest.Mocked<MrvLiteStore>;

  beforeEach(() => {
    store = createMockStore();
    service = new MrvLiteService(store);
  });

  describe('MRV_LITE_STORE token', () => {
    it('exports a Symbol token', () => {
      expect(typeof MRV_LITE_STORE).toBe('symbol');
    });
  });

  describe('getLaneEsgCard', () => {
    it('returns carbon calculation using emission factors', async () => {
      const card = await service.getLaneEsgCard('lane-1');

      expect(store.getLaneEsgData.mock.calls[0][0]).toBe('lane-1');
      // MANGO + JAPAN + AIR = 2.3 co2ePerKg, 1000 kg => 2300 total
      expect(card.carbon.co2ePerKg).toBe(2.3);
      expect(card.carbon.co2eTotalKg).toBe(2300);
      expect(card.carbon.transportMode).toBe('AIR');
      expect(card.carbon.quantityKg).toBe(1000);
    });

    it('uses default factor for unmatched route', async () => {
      store.getLaneEsgData.mockResolvedValue({
        productType: 'RAMBUTAN',
        destinationMarket: 'INDIA',
        transportMode: 'RAIL',
        quantityKg: 500,
        completenessScore: 60,
        status: 'COLLECTING',
        originProvince: 'Rayong',
        evidenceCount: 3,
        auditEntryCount: 1,
      });

      const card = await service.getLaneEsgCard('lane-2');

      // No matching factor for RAMBUTAN/INDIA/RAIL => default 1.5
      expect(card.carbon.co2ePerKg).toBe(1.5);
      expect(card.carbon.co2eTotalKg).toBe(750); // 500 * 1.5
    });

    it('returns waste section with lane status', async () => {
      const card = await service.getLaneEsgCard('lane-1');

      expect(card.waste.laneStatus).toBe('VALIDATED');
      expect(card.waste.isRejected).toBe(false);
    });

    it('marks isRejected true for INCOMPLETE status', async () => {
      store.getLaneEsgData.mockResolvedValue({
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        transportMode: 'AIR',
        quantityKg: 1000,
        completenessScore: 30,
        status: 'INCOMPLETE',
        originProvince: 'Chanthaburi',
        evidenceCount: 2,
        auditEntryCount: 1,
      });

      const card = await service.getLaneEsgCard('lane-3');
      expect(card.waste.isRejected).toBe(true);
    });

    it('returns social section with origin and product', async () => {
      const card = await service.getLaneEsgCard('lane-1');

      expect(card.social.originProvince).toBe('Chanthaburi');
      expect(card.social.product).toBe('MANGO');
    });

    it('returns governance section with completeness and counts', async () => {
      const card = await service.getLaneEsgCard('lane-1');

      expect(card.governance.completenessScore).toBe(85);
      expect(card.governance.evidenceCount).toBe(12);
      expect(card.governance.auditEntryCount).toBe(5);
    });

    it('throws NotFoundException when lane not found', async () => {
      store.getLaneEsgData.mockResolvedValue(null);

      await expect(service.getLaneEsgCard('nonexistent')).rejects.toThrow(
        'Lane not found',
      );
    });

    it('handles null transportMode with default factor', async () => {
      store.getLaneEsgData.mockResolvedValue({
        productType: 'MANGO',
        destinationMarket: 'JAPAN',
        transportMode: null,
        quantityKg: 200,
        completenessScore: 50,
        status: 'CREATED',
        originProvince: 'Nonthaburi',
        evidenceCount: 1,
        auditEntryCount: 0,
      });

      const card = await service.getLaneEsgCard('lane-4');

      // null transport mode won't match any factor => default 1.5
      expect(card.carbon.co2ePerKg).toBe(1.5);
      expect(card.carbon.co2eTotalKg).toBe(300); // 200 * 1.5
      expect(card.carbon.transportMode).toBe('UNKNOWN');
    });
  });

  describe('getExporterReport', () => {
    it('returns structured quarterly report', async () => {
      const report = await service.getExporterReport('exporter-1', 1, 2026);

      expect(store.getExporterEsgData.mock.calls[0]).toEqual([
        'exporter-1',
        1,
        2026,
      ]);
      expect(report.exporterId).toBe('exporter-1');
      expect(report.period).toEqual({ quarter: 1, year: 2026 });
      expect(report.environmental.totalCo2eKg).toBe(4600);
      expect(report.environmental.avgCo2ePerKg).toBe(2.3);
      expect(report.environmental.laneCount).toBe(2);
      expect(report.social.distinctProvinces).toBe(2);
      expect(report.social.distinctProducts).toBe(1);
      expect(report.governance.avgCompleteness).toBe(80);
      expect(report.governance.totalEvidenceCount).toBe(24);
    });
  });

  describe('getPlatformReport', () => {
    it('returns structured annual report', async () => {
      const report = await service.getPlatformReport(2026);

      expect(store.getPlatformEsgData.mock.calls[0][0]).toBe(2026);
      expect(report.year).toBe(2026);
      expect(report.environmental.totalCo2eKg).toBe(50000);
      expect(report.environmental.avgCo2ePerKg).toBe(1.8);
      expect(report.environmental.laneCount).toBe(100);
      expect(report.social.distinctExporters).toBe(15);
      expect(report.social.distinctProvinces).toBe(8);
      expect(report.social.distinctProducts).toBe(4);
      expect(report.governance.avgCompleteness).toBe(75);
      expect(report.governance.totalEvidenceCount).toBe(1200);
      expect(report.governance.totalAuditEntries).toBe(600);
    });
  });

  describe('getEmissionFactors', () => {
    it('returns all factors', () => {
      const factors = service.getEmissionFactors();

      expect(factors).toHaveLength(EMISSION_FACTORS.length);
      expect(factors).toEqual(expect.arrayContaining(EMISSION_FACTORS));
    });

    it('returns a copy, not the original array', () => {
      const factors = service.getEmissionFactors();
      factors.push({
        product: 'TEST',
        market: 'TEST',
        transportMode: 'TEST',
        co2ePerKg: 0,
      });

      expect(service.getEmissionFactors()).toHaveLength(
        EMISSION_FACTORS.length,
      );
    });
  });
});
