import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module';
import { AuditService } from '../../common/audit/audit.service';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { HashingModule } from '../../common/hashing/hashing.module';
import { HashingService } from '../../common/hashing/hashing.service';
import { ColdChainModule } from '../cold-chain/cold-chain.module';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { LaneModule } from '../lane/lane.module';
import { LANE_RECONCILER } from '../lane/lane.constants';
import type { LaneReconciler } from '../lane/lane.types';
import { RulesEngineModule } from '../rules-engine/rules-engine.module';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import { NotificationModule } from '../notifications/notification.module';
import { RealtimeEventsService } from '../notifications/realtime-events.service';
import {
  EVIDENCE_DOCUMENT_CLASSIFIER,
  EVIDENCE_DOCUMENT_ANALYSIS_PROVIDER,
  EVIDENCE_OBJECT_STORE,
  EVIDENCE_PHOTO_METADATA_EXTRACTOR,
} from './evidence.constants';
import { CheckpointEvidenceController } from './checkpoint-evidence.controller';
import { EvidenceController } from './evidence.controller';
import { MatrixDrivenEvidenceDocumentClassifier } from './evidence.document-classifier';
import { TesseractEvidenceDocumentAnalysisProvider } from './evidence.document-analysis';
import { ExifPhotoMetadataExtractor } from './evidence.metadata';
import { PrismaEvidenceStore } from './evidence.pg-store';
import { EvidenceService } from './evidence.service';
import {
  createEvidenceObjectStoreFromEnv,
  LocalEvidenceObjectStore,
} from './evidence.storage';
import { PrismaProofPackStore } from './proof-pack.pg-store';
import { ProofPackService } from './proof-pack.service';
import { ProofPackWorkerService } from './proof-pack.worker';
import { PROOF_PACK_STORE } from './proof-pack.types';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    HashingModule,
    AuditModule,
    RulesEngineModule,
    NotificationModule,
    LaneModule,
    ColdChainModule,
  ],
  controllers: [EvidenceController, CheckpointEvidenceController],
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
      provide: EVIDENCE_DOCUMENT_ANALYSIS_PROVIDER,
      useFactory: () => new TesseractEvidenceDocumentAnalysisProvider(),
    },
    {
      provide: EVIDENCE_DOCUMENT_CLASSIFIER,
      useFactory: () => new MatrixDrivenEvidenceDocumentClassifier(),
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
        documentAnalysisProvider: TesseractEvidenceDocumentAnalysisProvider,
        documentClassifier: MatrixDrivenEvidenceDocumentClassifier,
        rulesEngineService: RulesEngineService,
        laneReconciler: LaneReconciler,
        realtimeEvents: RealtimeEventsService,
        coldChainService: ColdChainService,
      ) =>
        new EvidenceService(
          store,
          objectStore,
          hashingService,
          auditService,
          photoMetadataExtractor,
          documentAnalysisProvider,
          documentClassifier,
          rulesEngineService,
          laneReconciler,
          realtimeEvents,
          coldChainService,
        ),
      inject: [
        PrismaEvidenceStore,
        EVIDENCE_OBJECT_STORE,
        HashingService,
        AuditService,
        EVIDENCE_PHOTO_METADATA_EXTRACTOR,
        EVIDENCE_DOCUMENT_ANALYSIS_PROVIDER,
        EVIDENCE_DOCUMENT_CLASSIFIER,
        RulesEngineService,
        LANE_RECONCILER,
        RealtimeEventsService,
        ColdChainService,
      ],
    },
    ProofPackService,
    ProofPackWorkerService,
  ],
  exports: [EvidenceService, ProofPackService],
})
export class EvidenceModule {}
