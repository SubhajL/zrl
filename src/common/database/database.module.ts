import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL, DEFAULT_DB_POOL_SIZE } from './database.constants';

export function resolveDbPoolSize(rawValue: string | undefined): number {
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return DEFAULT_DB_POOL_SIZE;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid DB_POOL_SIZE configuration.');
  }

  return parsed;
}

export function createDatabasePool(): Pool | undefined {
  const databaseUrl = process.env['DATABASE_URL'] ?? '';
  if (databaseUrl.length === 0) {
    return undefined;
  }

  return new Pool({
    connectionString: databaseUrl,
    max: resolveDbPoolSize(process.env['DB_POOL_SIZE']),
  });
}

@Injectable()
class DatabasePoolLifecycle implements OnModuleDestroy {
  constructor(
    @Inject(DATABASE_POOL)
    private readonly pool: Pool | undefined,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== undefined) {
      await this.pool.end();
    }
  }
}

@Module({
  providers: [
    {
      provide: DATABASE_POOL,
      useFactory: createDatabasePool,
    },
    DatabasePoolLifecycle,
  ],
  exports: [DATABASE_POOL],
})
export class DatabaseModule {}
