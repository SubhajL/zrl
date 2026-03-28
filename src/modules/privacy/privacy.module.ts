import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { NotificationModule } from '../notifications/notification.module';
import {
  PrivacyAdminController,
  PrivacyController,
} from './privacy.controller';
import { PRIVACY_STORE } from './privacy.constants';
import { PrismaPrivacyStore } from './privacy.pg-store';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [AuthModule, DatabaseModule, NotificationModule],
  controllers: [PrivacyController, PrivacyAdminController],
  providers: [
    PrismaPrivacyStore,
    {
      provide: PRIVACY_STORE,
      useExisting: PrismaPrivacyStore,
    },
    PrivacyService,
  ],
  exports: [PrivacyService],
})
export class PrivacyModule {}
