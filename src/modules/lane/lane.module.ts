import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuditService } from '../../common/audit/audit.service';
import { AuthModule } from '../../common/auth/auth.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { ColdChainModule } from '../cold-chain/cold-chain.module';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { LaneController } from './lane.controller';
import { PrismaLaneStore } from './lane.pg-store';
import { RulesEngineLaneRuleSnapshotResolver } from './lane.rules-resolver';
import { LaneService } from './lane.service';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    HashingModule,
    RulesEngineModule,
    ColdChainModule,
  ],
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
        coldChainService: ColdChainService,
        rulesEngineService: RulesEngineService,
      ) =>
        new LaneService(
          laneStore,
          hashingService,
          auditService,
          ruleSnapshotResolver,
          coldChainService,
          rulesEngineService,
        ),
      inject: [
        PrismaLaneStore,
        HashingService,
        AuditService,
        RulesEngineLaneRuleSnapshotResolver,
        ColdChainService,
        RulesEngineService,
      ],
    },
  ],
  exports: [LaneService],
})
export class LaneModule {}
