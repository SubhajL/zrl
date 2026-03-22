import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuditService } from '../../common/audit/audit.service';
import { AuthModule } from '../../common/auth/auth.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { LaneController } from './lane.controller';
import { PrismaLaneStore } from './lane.pg-store';
import { RulesEngineLaneRuleSnapshotResolver } from './lane.rules-resolver';
import { LaneService } from './lane.service';

@Module({
  imports: [AuthModule, AuditModule, HashingModule, RulesEngineModule],
  controllers: [LaneController],
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
      ) =>
        new LaneService(
          laneStore,
          hashingService,
          auditService,
          ruleSnapshotResolver,
        ),
      inject: [
        PrismaLaneStore,
        HashingService,
        AuditService,
        RulesEngineLaneRuleSnapshotResolver,
      ],
    },
  ],
  exports: [LaneService],
})
export class LaneModule {}
