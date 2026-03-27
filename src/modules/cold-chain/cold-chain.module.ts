import { Module } from '@nestjs/common';
import { AuthModule } from '../../common/auth/auth.module';
import { DatabaseModule } from '../../common/database/database.module';
import { ColdChainController } from './cold-chain.controller';
import { PrismaColdChainStore } from './cold-chain.pg-store';
import { ColdChainService } from './cold-chain.service';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ColdChainController],
  providers: [
    PrismaColdChainStore,
    {
      provide: ColdChainService,
      useFactory: (store: PrismaColdChainStore) => new ColdChainService(store),
      inject: [PrismaColdChainStore],
    },
  ],
  exports: [ColdChainService],
})
export class ColdChainModule {}
