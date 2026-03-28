import { RealtimeEventsService } from './realtime-events.service';

describe('RealtimeEventsService', () => {
  let fanout: {
    publishLaneEvent: jest.Mock;
    publishUserEvent: jest.Mock;
  };
  let store: {
    listMarketAudienceUserIds: jest.Mock;
  };
  let service: RealtimeEventsService;

  beforeEach(() => {
    fanout = {
      publishLaneEvent: jest.fn().mockResolvedValue(true),
      publishUserEvent: jest.fn().mockResolvedValue(true),
    };
    store = {
      listMarketAudienceUserIds: jest
        .fn()
        .mockResolvedValue(['user-1', 'user-2']),
    };

    service = new RealtimeEventsService(fanout as never, store as never);
  });

  it('publishes lane status changed through fanout', async () => {
    await service.publishLaneStatusChanged({
      laneId: 'lane-db-1',
      oldStatus: 'EVIDENCE_COLLECTING',
      newStatus: 'VALIDATED',
    });

    expect(fanout.publishLaneEvent).toHaveBeenCalledWith(
      'lane.status.changed',
      'lane-db-1',
      {
        laneId: 'lane-db-1',
        oldStatus: 'EVIDENCE_COLLECTING',
        newStatus: 'VALIDATED',
      },
    );
  });

  it('publishes pack generated through fanout', async () => {
    await service.publishPackGenerated({
      laneId: 'lane-db-1',
      packId: 'pack-1',
      packType: 'REGULATOR',
    });

    expect(fanout.publishLaneEvent).toHaveBeenCalledWith(
      'pack.generated',
      'lane-db-1',
      {
        laneId: 'lane-db-1',
        packId: 'pack-1',
        packType: 'REGULATOR',
      },
    );
  });

  it('publishes rule updated to the market audience', async () => {
    await service.publishRuleUpdated('JAPAN', ['Carbendazim', 'Imazalil']);

    expect(store.listMarketAudienceUserIds).toHaveBeenCalledWith('JAPAN');
    expect(fanout.publishUserEvent).toHaveBeenNthCalledWith(
      1,
      'rule.updated',
      'user-1',
      {
        marketId: 'JAPAN',
        changedSubstances: ['Carbendazim', 'Imazalil'],
      },
    );
    expect(fanout.publishUserEvent).toHaveBeenNthCalledWith(
      2,
      'rule.updated',
      'user-2',
      {
        marketId: 'JAPAN',
        changedSubstances: ['Carbendazim', 'Imazalil'],
      },
    );
  });
});
