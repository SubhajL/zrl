import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuthModule } from '../../common/auth/auth.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import {
  DEFAULT_RULES_DIRECTORY,
  RULES_DIRECTORY,
} from './rules-engine.constants';
import { RuleLoaderService } from './rule-loader.service';
import { RulesEngineController } from './rules-engine.controller';
import { PrismaRulesEngineStore } from './rules-engine.pg-store';
import { RulesEngineService } from './rules-engine.service';

@Module({
  imports: [AuthModule, HashingModule, AuditModule],
  controllers: [RulesEngineController],
  providers: [
    {
      provide: RULES_DIRECTORY,
      useValue: DEFAULT_RULES_DIRECTORY,
    },
    RuleLoaderService,
    PrismaRulesEngineStore,
    {
      provide: RulesEngineService,
      useFactory: (
        loader: RuleLoaderService,
        store: PrismaRulesEngineStore,
        hashingService: HashingService,
      ) => new RulesEngineService(loader, store, hashingService),
      inject: [RuleLoaderService, PrismaRulesEngineStore, HashingService],
    },
  ],
  exports: [RulesEngineService, RuleLoaderService],
})
export class RulesEngineModule {}
