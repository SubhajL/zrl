import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuditService } from '../../common/audit/audit.service';
import { AuthModule } from '../../common/auth/auth.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { LaneModule } from '../lane/lane.module';
import { LaneService } from '../lane/lane.service';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import {
  EVIDENCE_OBJECT_STORE,
  EVIDENCE_PHOTO_METADATA_EXTRACTOR,
} from './evidence.constants';
import { EvidenceController } from './evidence.controller';
import { ExifPhotoMetadataExtractor } from './evidence.metadata';
import { PrismaEvidenceStore } from './evidence.pg-store';
import { EvidenceService } from './evidence.service';
import {
  createEvidenceObjectStoreFromEnv,
  LocalEvidenceObjectStore,
} from './evidence.storage';
import { PrismaProofPackStore } from './proof-pack.pg-store';
import { ProofPackService } from './proof-pack.service';
import { PROOF_PACK_STORE } from './proof-pack.types';

@Module({
  imports: [
    AuthModule,
    HashingModule,
    AuditModule,
    RulesEngineModule,
    forwardRef(() => LaneModule),
  ],
  controllers: [EvidenceController],
  providers: [
    PrismaEvidenceStore,
    LocalEvidenceObjectStore,
    PrismaProofPackStore,
    {
      provide: EVIDENCE_OBJECT_STORE,
      useFactory: (localObjectStore: LocalEvidenceObjectStore) =>
        createEvidenceObjectStoreFromEnv(localObjectStore),
      inject: [LocalEvidenceObjectStore],
    },
    {
      provide: EVIDENCE_PHOTO_METADATA_EXTRACTOR,
      useFactory: () => new ExifPhotoMetadataExtractor(),
    },
    {
      provide: PROOF_PACK_STORE,
      useClass: PrismaProofPackStore,
    },
    {
      provide: EvidenceService,
      useFactory: (
        store: PrismaEvidenceStore,
        objectStore: ReturnType<typeof createEvidenceObjectStoreFromEnv>,
        hashingService: HashingService,
        auditService: AuditService,
        photoMetadataExtractor: ExifPhotoMetadataExtractor,
        rulesEngineService: RulesEngineService,
        laneService: LaneService,
      ) =>
        new EvidenceService(
          store,
          objectStore,
          hashingService,
          auditService,
          photoMetadataExtractor,
          rulesEngineService,
          laneService,
        ),
      inject: [
        PrismaEvidenceStore,
        EVIDENCE_OBJECT_STORE,
        HashingService,
        AuditService,
        EVIDENCE_PHOTO_METADATA_EXTRACTOR,
        RulesEngineService,
        LaneService,
      ],
    },
    ProofPackService,
  ],
  exports: [EvidenceService, ProofPackService],
})
export class EvidenceModule {}
