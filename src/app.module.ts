import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LaneModule } from './modules/lane/lane.module';
import { RulesEngineModule } from './modules/rules-engine/rules-engine.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { ColdChainModule } from './modules/cold-chain/cold-chain.module';
import { DisputeModule } from './modules/dispute/dispute.module';
import { MrvLiteModule } from './modules/mrv-lite/mrv-lite.module';
import { AuthModule } from './common/auth/auth.module';
import { HashingModule } from './common/hashing/hashing.module';
import { AuditModule } from './common/audit/audit.module';
import { NotificationModule } from './modules/notifications/notification.module';

@Module({
  imports: [
    // Core modules (M1-M5)
    LaneModule,
    RulesEngineModule,
    EvidenceModule,
    ColdChainModule,
    DisputeModule,
    MrvLiteModule,
    NotificationModule,
    // Common services
    AuthModule,
    HashingModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
