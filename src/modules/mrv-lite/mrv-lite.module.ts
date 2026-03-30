import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { MrvLiteController } from './mrv-lite.controller';
import { MRV_LITE_STORE } from './mrv-lite.constants';
import { PrismaMrvLiteStore } from './mrv-lite.pg-store';
import { MrvLiteService } from './mrv-lite.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MrvLiteController],
  providers: [
    PrismaMrvLiteStore,
    { provide: MRV_LITE_STORE, useExisting: PrismaMrvLiteStore },
    MrvLiteService,
  ],
  exports: [MrvLiteService],
})
export class MrvLiteModule {}
