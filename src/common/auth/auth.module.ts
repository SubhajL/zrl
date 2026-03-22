import { Module } from '@nestjs/common';
import { AUTH_STORE } from './auth.constants';
import { AuthController } from './auth.controller';
import {
  ApiKeyAuthGuard,
  AuditorReadOnlyGuard,
  JwtAuthGuard,
  LaneOwnerGuard,
  PartnerScopeGuard,
  RolesGuard,
} from './auth.guards';
import { PrismaAuthStore } from './auth.pg-store';
import { AuthService } from './auth.service';

@Module({
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
    PartnerScopeGuard,
    AuditorReadOnlyGuard,
  ],
})
export class AuthModule {}
