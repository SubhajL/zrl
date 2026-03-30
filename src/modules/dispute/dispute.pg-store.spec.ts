import { PrismaDisputeStore } from './dispute.pg-store';

describe('PrismaDisputeStore', () => {
  function createMockQuery() {
    return jest.fn();
  }

  function buildStore(query: jest.Mock) {
    return new PrismaDisputeStore({ query } as never);
  }

  const disputeRow = {
    id: 'dispute-1',
    lane_id: 'lane-db-1',
    type: 'QUALITY_CLAIM',
    description: 'Fruit arrived damaged',
    claimant: 'Importer Co',
    status: 'OPEN',
    financial_impact: '50000.00',
    resolution_notes: null,
    defense_pack_id: null,
    created_at: '2026-03-29T10:00:00.000Z',
    updated_at: '2026-03-29T10:00:00.000Z',
    resolved_at: null,
  };

  it('creates dispute and returns record', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [disputeRow],
    });
    const store = buildStore(query);

    const result = await store.createDispute('lane-db-1', {
      type: 'QUALITY_CLAIM',
      description: 'Fruit arrived damaged',
      claimant: 'Importer Co',
      financialImpact: 50000,
    });

    expect(result.id).toBe('dispute-1');
    expect(result.laneId).toBe('lane-db-1');
    expect(result.type).toBe('QUALITY_CLAIM');
    expect(result.description).toBe('Fruit arrived damaged');
    expect(result.claimant).toBe('Importer Co');
    expect(result.status).toBe('OPEN');
    expect(result.financialImpact).toBe(50000);
    expect(result.defensePackId).toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO'),
      expect.arrayContaining([
        'lane-db-1',
        'QUALITY_CLAIM',
        'Fruit arrived damaged',
        'Importer Co',
        50000,
      ]),
    );
  });

  it('finds dispute by id', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [disputeRow],
    });
    const store = buildStore(query);

    const result = await store.findDisputeById('dispute-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('dispute-1');
    expect(result!.type).toBe('QUALITY_CLAIM');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      ['dispute-1'],
    );
  });

  it('returns null for missing dispute', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });
    const store = buildStore(query);

    const result = await store.findDisputeById('non-existent');
    expect(result).toBeNull();
  });

  it('lists disputes for lane', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        disputeRow,
        { ...disputeRow, id: 'dispute-2', type: 'CARGO_DAMAGE' },
      ],
    });
    const store = buildStore(query);

    const result = await store.findDisputesForLane('lane-db-1');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('dispute-1');
    expect(result[1].id).toBe('dispute-2');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE lane_id = $1'),
      ['lane-db-1'],
    );
  });

  it('updates dispute status', async () => {
    const updatedRow = {
      ...disputeRow,
      status: 'INVESTIGATING',
      updated_at: '2026-03-29T11:00:00.000Z',
    };
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [updatedRow],
    });
    const store = buildStore(query);

    const result = await store.updateDispute('dispute-1', {
      status: 'INVESTIGATING',
    });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('INVESTIGATING');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.arrayContaining(['dispute-1']),
    );
  });

  it('links defense pack', async () => {
    const linkedRow = {
      ...disputeRow,
      defense_pack_id: 'pack-1',
      status: 'DEFENSE_SUBMITTED',
    };
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [linkedRow],
    });
    const store = buildStore(query);

    const result = await store.linkDefensePack('dispute-1', 'pack-1');
    expect(result).not.toBeNull();
    expect(result!.defensePackId).toBe('pack-1');
    expect(result!.status).toBe('DEFENSE_SUBMITTED');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('defense_pack_id'),
      expect.arrayContaining(['dispute-1', 'pack-1']),
    );
  });

  it('counts disputes for lane', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ count: 3 }],
    });
    const store = buildStore(query);

    const result = await store.countDisputesForLane('lane-db-1');
    expect(result).toBe(3);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('COUNT'), [
      'lane-db-1',
    ]);
  });

  it('counts excursions for lane', async () => {
    const query = createMockQuery().mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ count: 2 }],
    });
    const store = buildStore(query);

    const result = await store.countExcursionsForLane('lane-db-1');
    expect(result).toBe(2);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('excursions'), [
      'lane-db-1',
    ]);
  });
});
