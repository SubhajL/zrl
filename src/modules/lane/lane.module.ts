import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuditService } from '../../common/audit/audit.service';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { ColdChainModule } from '../cold-chain/cold-chain.module';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { NotificationModule } from '../notifications/notification.module';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { LANE_RECONCILER } from './lane.constants';
import { CheckpointController, LaneController } from './lane.controller';
import { PrismaLaneStore } from './lane.pg-store';
import { RulesEngineLaneRuleSnapshotResolver } from './lane.rules-resolver';
import { LaneService } from './lane.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    DatabaseModule,
    HashingModule,
    RulesEngineModule,
    ColdChainModule,
    NotificationModule,
  ],
  controllers: [LaneController, CheckpointController],
  providers: [
    PrismaLaneStore,
    RulesEngineLaneRuleSnapshotResolver,
    {
      provide: LaneService,
      useFactory: (
        laneStore: PrismaLaneStore,
        hashingService: HashingService,
        auditService: AuditService,
        ruleSnapshotResolver: RulesEngineLaneRuleSnapshotResolver,
        coldChainService: ColdChainService,
        rulesEngineService: RulesEngineService,
        realtimeEvents: RealtimeEventsService,
      ) =>
        new LaneService(
          laneStore,
          hashingService,
          auditService,
          ruleSnapshotResolver,
          coldChainService,
          rulesEngineService,
          realtimeEvents,
        ),
      inject: [
        PrismaLaneStore,
        HashingService,
        AuditService,
        RulesEngineLaneRuleSnapshotResolver,
        ColdChainService,
        RulesEngineService,
        RealtimeEventsService,
      ],
    },
    { provide: LANE_RECONCILER, useExisting: LaneService },
  ],
  exports: [LaneService, LANE_RECONCILER],
})
export class LaneModule {}
