/* eslint-disable @typescript-eslint/unbound-method */
import { MRV_LITE_STORE, EMISSION_FACTORS } from './mrv-lite.constants';
import type { LaneCarbonRow, MrvLiteStore } from './mrv-lite.types';
import { MrvLiteService } from './mrv-lite.service';

// Two sample lanes: MANGO/JAPAN/AIR (factor=2.3) and MANGO/JAPAN/SEA (factor=1.1)
const exporterLaneRows: LaneCarbonRow[] = [
  {
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    transportMode: 'AIR',
    quantityKg: 1000,
    completenessScore: 85,
    originProvince: 'Chanthaburi',
    evidenceCount: 12,
    auditEntryCount: 5,
  },
  {
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    transportMode: 'SEA',
    quantityKg: 1000,
    completenessScore: 75,
    originProvince: 'Rayong',
    evidenceCount: 12,
    auditEntryCount: 5,
  },
];

const platformLaneRows: LaneCarbonRow[] = [
  ...exporterLaneRows.map((r) => ({ ...r, exporterId: 'exporter-1' })),
  {
    productType: 'DURIAN',
    destinationMarket: 'CHINA',
    transportMode: 'TRUCK',
    quantityKg: 500,
    completenessScore: 65,
    originProvince: 'Chumphon',
    evidenceCount: 6,
    auditEntryCount: 3,
    exporterId: 'exporter-2',
  },
];

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
    getExporterLaneCarbonRows: jest.fn().mockResolvedValue(exporterLaneRows),
    getPlatformLaneCarbonRows: jest.fn().mockResolvedValue(platformLaneRows),
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
    it('computes CO2e using per-lane emission factors (not hardcoded 1.5)', async () => {
      const report = await service.getExporterReport('exporter-1', 1, 2026);

      expect(store.getExporterLaneCarbonRows).toHaveBeenCalledWith(
        'exporter-1',
        1,
        2026,
      );
      expect(report.exporterId).toBe('exporter-1');
      expect(report.period).toEqual({ quarter: 1, year: 2026 });
      // Lane 1: MANGO/JAPAN/AIR = 2.3 * 1000 = 2300
      // Lane 2: MANGO/JAPAN/SEA = 1.1 * 1000 = 1100
      // Total: 3400, avg: 3400/2000 = 1.7
      expect(report.environmental.totalCo2eKg).toBe(3400);
      expect(report.environmental.avgCo2ePerKg).toBe(1.7);
      expect(report.environmental.laneCount).toBe(2);
      expect(report.social.distinctProvinces).toBe(2);
      expect(report.social.distinctProducts).toBe(1);
      expect(report.governance.avgCompleteness).toBe(80);
      expect(report.governance.totalEvidenceCount).toBe(24);
    });

    it('returns zeros for empty lane set', async () => {
      store.getExporterLaneCarbonRows.mockResolvedValue([]);

      const report = await service.getExporterReport('exporter-1', 1, 2026);

      expect(report.environmental.totalCo2eKg).toBe(0);
      expect(report.environmental.avgCo2ePerKg).toBe(0);
      expect(report.environmental.laneCount).toBe(0);
    });

    it('excludes empty-string provinces from distinct count', async () => {
      store.getExporterLaneCarbonRows.mockResolvedValue([
        {
          productType: 'MANGO',
          destinationMarket: 'JAPAN',
          transportMode: 'AIR',
          quantityKg: 100,
          completenessScore: 50,
          originProvince: '',
          evidenceCount: 1,
          auditEntryCount: 0,
        },
        {
          productType: 'MANGO',
          destinationMarket: 'JAPAN',
          transportMode: 'AIR',
          quantityKg: 100,
          completenessScore: 50,
          originProvince: 'Chanthaburi',
          evidenceCount: 1,
          auditEntryCount: 0,
        },
      ]);

      const report = await service.getExporterReport('exporter-1', 1, 2026);

      // Empty string province should not be counted
      expect(report.social.distinctProvinces).toBe(1);
    });
  });

  describe('getPlatformReport', () => {
    it('computes CO2e using per-lane emission factors (not hardcoded 1.5)', async () => {
      const report = await service.getPlatformReport(2026);

      expect(store.getPlatformLaneCarbonRows).toHaveBeenCalledWith(2026);
      expect(report.year).toBe(2026);
      // Lane 1: MANGO/JAPAN/AIR = 2.3 * 1000 = 2300
      // Lane 2: MANGO/JAPAN/SEA = 1.1 * 1000 = 1100
      // Lane 3: DURIAN/CHINA/TRUCK = 0.8 * 500 = 400
      // Total: 3800, totalQty: 2500, avg: 3800/2500 = 1.52
      expect(report.environmental.totalCo2eKg).toBe(3800);
      expect(report.environmental.avgCo2ePerKg).toBe(1.52);
      expect(report.environmental.laneCount).toBe(3);
      expect(report.social.distinctExporters).toBe(2);
      expect(report.social.distinctProvinces).toBe(3);
      expect(report.social.distinctProducts).toBe(2);
      expect(report.governance.avgCompleteness).toBe(75);
      expect(report.governance.totalEvidenceCount).toBe(30);
      expect(report.governance.totalAuditEntries).toBe(13);
    });

    it('returns zeros for empty lane set', async () => {
      store.getPlatformLaneCarbonRows.mockResolvedValue([]);

      const report = await service.getPlatformReport(2026);

      expect(report.environmental.totalCo2eKg).toBe(0);
      expect(report.environmental.avgCo2ePerKg).toBe(0);
      expect(report.environmental.laneCount).toBe(0);
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
