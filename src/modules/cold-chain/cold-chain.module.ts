import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notifications/notification.module';
import { NotificationService } from '../notifications/notification.service';
import { ColdChainController } from './cold-chain.controller';
import { PrismaColdChainStore } from './cold-chain.pg-store';
import { ColdChainService } from './cold-chain.service';

@Module({
  imports: [AuthModule, DatabaseModule, NotificationModule],
  controllers: [ColdChainController],
  providers: [
    PrismaColdChainStore,
    {
      provide: ColdChainService,
      useFactory: (
        store: PrismaColdChainStore,
        notificationService: NotificationService,
      ) => new ColdChainService(store, notificationService),
      inject: [PrismaColdChainStore, NotificationService],
    },
  ],
  exports: [ColdChainService],
})
export class ColdChainModule {}
