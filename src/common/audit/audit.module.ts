import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HashingModule } from '../hashing/hashing.module';
import { AUDIT_ENTRY_STORE } from './audit.constants';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { PrismaAuditStore } from './audit.prisma-store';
import { AuditService } from './audit.service';

@Module({
  imports: [AuthModule, HashingModule, DatabaseModule],
  controllers: [AuditController],
  providers: [
    {
      provide: AUDIT_ENTRY_STORE,
      useClass: PrismaAuditStore,
    },
    PrismaAuditStore,
    AuditService,
    AuditInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: AuditInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
