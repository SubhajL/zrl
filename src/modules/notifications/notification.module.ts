import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationChannels } from './notification.channels';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { PrismaNotificationStore } from './notification.pg-store';
import { NotificationPubSub } from './notification.pubsub';
import { RealtimeEventsService } from './realtime-events.service';
import { NotificationService } from './notification.service';
import { NOTIFICATION_FANOUT, NOTIFICATION_STORE } from './notification.types';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [NotificationController],
  providers: [
    PrismaNotificationStore,
    NotificationGateway,
    NotificationChannels,
    NotificationPubSub,
    {
      provide: NOTIFICATION_STORE,
      useExisting: PrismaNotificationStore,
    },
    {
      provide: NOTIFICATION_FANOUT,
      useExisting: NotificationPubSub,
    },
    RealtimeEventsService,
    NotificationService,
  ],
  exports: [NotificationService, RealtimeEventsService],
})
export class NotificationModule {}
