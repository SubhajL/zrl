import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { NotificationModule } from '../notifications/notification.module';
import { NotificationService } from '../notifications/notification.service';
import {
  DEFAULT_RULES_DIRECTORY,
  RULES_DIRECTORY,
} from './rules-engine.constants';
import { CertificationExpiryWorkerService } from './certification-expiry.worker';
import { RuleLoaderService } from './rule-loader.service';
import { RulesEngineController } from './rules-engine.controller';
import { PrismaRulesEngineStore } from './rules-engine.pg-store';
import { RulesEngineService } from './rules-engine.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    HashingModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [RulesEngineController],
  providers: [
    {
      provide: RULES_DIRECTORY,
      useValue: DEFAULT_RULES_DIRECTORY,
    },
    RuleLoaderService,
    PrismaRulesEngineStore,
    CertificationExpiryWorkerService,
    {
      provide: RulesEngineService,
      useFactory: (
        loader: RuleLoaderService,
        store: PrismaRulesEngineStore,
        hashingService: HashingService,
        notificationService: NotificationService,
      ) =>
        new RulesEngineService(
          loader,
          store,
          hashingService,
          notificationService,
        ),
      inject: [
        RuleLoaderService,
        PrismaRulesEngineStore,
        HashingService,
        NotificationService,
      ],
    },
  ],
  exports: [RulesEngineService, RuleLoaderService],
})
export class RulesEngineModule {}
