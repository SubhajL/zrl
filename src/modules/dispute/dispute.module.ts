import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { AuditModule } from '../../common/audit/audit.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { LaneModule } from '../lane/lane.module';
import { EvidenceModule } from '../evidence/evidence.module';
import { DisputeController } from './dispute.controller';
import { DISPUTE_STORE } from './dispute.constants';
import { PrismaDisputeStore } from './dispute.pg-store';
import { DisputeService } from './dispute.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    AuditModule,
    HashingModule,
    LaneModule,
    EvidenceModule,
  ],
  controllers: [DisputeController],
  providers: [
    PrismaDisputeStore,
    { provide: DISPUTE_STORE, useExisting: PrismaDisputeStore },
    DisputeService,
  ],
  exports: [DisputeService],
})
export class DisputeModule {}
