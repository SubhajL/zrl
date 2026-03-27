import { Test, type TestingModule } from '@nestjs/testing';
import type { Pool } from 'pg';
import { PrismaAuditStore } from '../audit/audit.prisma-store';
import { PrismaAuthStore } from '../auth/auth.pg-store';
import { PrismaLaneStore } from '../../modules/lane/lane.pg-store';
import { DATABASE_POOL, DEFAULT_DB_POOL_SIZE } from './database.constants';
import { DatabaseModule } from './database.module';

describe('DatabaseModule', () => {
  const envSnapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...envSnapshot };
    jest.restoreAllMocks();
  });

  async function createModule(): Promise<TestingModule> {
    return await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [PrismaAuditStore, PrismaAuthStore, PrismaLaneStore],
    }).compile();
  }

  function poolMax(pool: Pool): number | undefined {
    return (pool as Pool & { options?: { max?: number } }).options?.max;
  }

  it('creates a shared pool with the default size', async () => {
    process.env['DATABASE_URL'] =
      'postgres://postgres:postgres@localhost:5432/zrl_test';
    delete process.env['DB_POOL_SIZE'];

    const moduleRef = await createModule();
    const pool = moduleRef.get<Pool>(DATABASE_POOL);

    expect(pool).toBeDefined();
    expect(poolMax(pool)).toBe(DEFAULT_DB_POOL_SIZE);

    await moduleRef.close();
  });

  it('uses DB_POOL_SIZE when configured', async () => {
    process.env['DATABASE_URL'] =
      'postgres://postgres:postgres@localhost:5432/zrl_test';
    process.env['DB_POOL_SIZE'] = '7';

    const moduleRef = await createModule();
    const pool = moduleRef.get<Pool>(DATABASE_POOL);

    expect(poolMax(pool)).toBe(7);

    await moduleRef.close();
  });

  it('injects the same pool instance into multiple stores', async () => {
    process.env['DATABASE_URL'] =
      'postgres://postgres:postgres@localhost:5432/zrl_test';

    const moduleRef = await createModule();
    const pool = moduleRef.get<Pool>(DATABASE_POOL);
    const auditStore = moduleRef.get(PrismaAuditStore);
    const authStore = moduleRef.get(PrismaAuthStore);
    const laneStore = moduleRef.get(PrismaLaneStore);

    expect(auditStore['pool']).toBe(pool);
    expect(authStore['pool']).toBe(pool);
    expect(laneStore['pool']).toBe(pool);

    await moduleRef.close();
  });

  it('closes the shared pool when the module is destroyed', async () => {
    process.env['DATABASE_URL'] =
      'postgres://postgres:postgres@localhost:5432/zrl_test';

    const moduleRef = await createModule();
    const pool = moduleRef.get<Pool>(DATABASE_POOL);
    const endSpy = jest.spyOn(pool, 'end').mockResolvedValue();

    await moduleRef.close();

    expect(endSpy).toHaveBeenCalledTimes(1);
  });
});
