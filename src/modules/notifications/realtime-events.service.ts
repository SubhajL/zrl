import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_FANOUT,
  NOTIFICATION_STORE,
  type CheckpointRecordedRealtimeEvent,
  type EvidenceUploadedRealtimeEvent,
  type LaneStatusChangedRealtimeEvent,
  type NotificationFanoutPublisher,
  type NotificationServiceStore,
  type PackGeneratedRealtimeEvent,
  type TemperatureExcursionRealtimeEvent,
} from './notification.types';

@Injectable()
export class RealtimeEventsService {
  constructor(
    @Inject(NOTIFICATION_FANOUT)
    private readonly fanout: NotificationFanoutPublisher,
    @Inject(NOTIFICATION_STORE)
    private readonly store: NotificationServiceStore,
  ) {}

  async publishLaneStatusChanged(
    event: LaneStatusChangedRealtimeEvent,
  ): Promise<void> {
    await this.fanout.publishLaneEvent(
      'lane.status.changed',
      event.laneId,
      event,
    );
  }

  async publishEvidenceUploaded(
    event: EvidenceUploadedRealtimeEvent,
  ): Promise<void> {
    await this.fanout.publishLaneEvent(
      'evidence.uploaded',
      event.laneId,
      event,
    );
  }

  async publishCheckpointRecorded(
    event: CheckpointRecordedRealtimeEvent,
  ): Promise<void> {
    await this.fanout.publishLaneEvent(
      'checkpoint.recorded',
      event.laneId,
      event,
    );
  }

  async publishTemperatureExcursion(
    event: TemperatureExcursionRealtimeEvent,
  ): Promise<void> {
    await this.fanout.publishLaneEvent(
      'temperature.excursion',
      event.laneId,
      event,
    );
  }

  async publishPackGenerated(event: PackGeneratedRealtimeEvent): Promise<void> {
    await this.fanout.publishLaneEvent('pack.generated', event.laneId, event);
  }

  async publishRuleUpdated(
    marketId: string,
    changedSubstances: readonly string[],
  ): Promise<void> {
    const userIds = await this.store.listMarketAudienceUserIds(marketId);
    await Promise.all(
      userIds.map(async (userId) => {
        await this.fanout.publishUserEvent('rule.updated', userId, {
          marketId,
          changedSubstances,
        });
      }),
    );
  }
}
