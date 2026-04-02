import { Module } from '@nestjs/common';
import { AuthModule } from '../common/auth/auth.module';
import { EvidenceModule } from '../modules/evidence/evidence.module';
import { PartnerIntegrationsController } from './integrations.controller';
import { PartnerIntegrationsService } from './integrations.service';

@Module({
  imports: [AuthModule, EvidenceModule],
  controllers: [PartnerIntegrationsController],
  providers: [PartnerIntegrationsService],
  exports: [PartnerIntegrationsService],
})
export class PartnerIntegrationsModule {}
