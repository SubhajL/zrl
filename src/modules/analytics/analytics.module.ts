import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { AnalyticsController } from './analytics.controller';
import { PrismaAnalyticsStore } from './analytics.pg-store';
import { AnalyticsService, ANALYTICS_STORE } from './analytics.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AnalyticsController],
  providers: [
    { provide: ANALYTICS_STORE, useClass: PrismaAnalyticsStore },
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
