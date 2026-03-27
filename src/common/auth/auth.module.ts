import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AUTH_STORE } from './auth.constants';
import { AuthController } from './auth.controller';
import {
  ApiKeyAuthGuard,
  AuditorReadOnlyGuard,
  CheckpointOwnerGuard,
  JwtAuthGuard,
  LaneOwnerGuard,
  PackOwnerGuard,
  PartnerScopeGuard,
  RolesGuard,
} from './auth.guards';
import { PrismaAuthStore } from './auth.pg-store';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_STORE,
      useClass: PrismaAuthStore,
    },
    AuthService,
    JwtAuthGuard,
    ApiKeyAuthGuard,
    RolesGuard,
    LaneOwnerGuard,
    PackOwnerGuard,
    CheckpointOwnerGuard,
    PartnerScopeGuard,
    AuditorReadOnlyGuard,
  ],
  exports: [
    AuthService,
    AUTH_STORE,
    JwtAuthGuard,
    ApiKeyAuthGuard,
    RolesGuard,
    LaneOwnerGuard,
    PackOwnerGuard,
    CheckpointOwnerGuard,
    PartnerScopeGuard,
    AuditorReadOnlyGuard,
  ],
})
export class AuthModule {}
