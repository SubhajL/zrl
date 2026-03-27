import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import { AppModule } from '../src/app.module';
import { ProofPackService } from '../src/modules/evidence/proof-pack.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public';

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms.`);
}

describe('ProofPack worker integration (e2e)', () => {
  let pool: Pool;
  let storageRoot: string;
  const envSnapshot = { ...process.env };

  async function createApp(workerEnabled: boolean): Promise<INestApplication> {
    process.env['DATABASE_URL'] = databaseUrl;
    process.env['PROOF_PACK_WORKER_ENABLED'] = workerEnabled ? 'true' : 'false';
    process.env['PROOF_PACK_JOB_POLL_INTERVAL_MS'] = '100';
    process.env['PROOF_PACK_JOB_HEARTBEAT_MS'] = '50';
    process.env['PROOF_PACK_JOB_LEASE_MS'] = '200';
    process.env['PROOF_PACK_JOB_MAX_ATTEMPTS'] = '3';
    process.env['EVIDENCE_STORAGE_ROOT'] = storageRoot;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    return app;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('SELECT 1');
    storageRoot = await mkdtemp(join(tmpdir(), 'zrl-proof-pack-worker-'));
  });

  afterAll(async () => {
    process.env = envSnapshot;
    await pool.end();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('reclaims an expired processing job after restart and completes the pack', async () => {
    const exporterId = `user-${randomUUID()}`;
    const laneId = `lane-${randomUUID()}`;
    const publicLaneId = `LN-INT-${Date.now()}`;
    let app: INestApplication | undefined;
    let restartedApp: INestApplication | undefined;
    let packId: string | null = null;
    let jobId: string | null = null;

    await pool.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          role,
          company_name,
          mfa_enabled,
          totp_secret,
          session_version,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, 'EXPORTER', $4, false, NULL, 0, NOW(), NOW())
      `,
      [
        exporterId,
        `${exporterId}@example.com`,
        'hashed-password',
        'Exporter Co',
      ],
    );
    await pool.query(
      `
        INSERT INTO lanes (
          id,
          lane_id,
          exporter_id,
          status,
          product_type,
          destination_market,
          completeness_score,
          cold_chain_mode,
          status_changed_at,
          cold_chain_device_id,
          cold_chain_data_frequency_seconds,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'VALIDATED',
          'MANGO',
          'JAPAN',
          97.00,
          NULL,
          NOW(),
          NULL,
          NULL,
          NOW(),
          NOW()
        )
      `,
      [laneId, publicLaneId, exporterId],
    );

    try {
      app = await createApp(false);
      const proofPackService = app.get(ProofPackService);

      const pack = await proofPackService.generatePack(
        {
          laneId,
          packType: 'REGULATOR',
          generatedBy: exporterId,
        },
        {
          laneId: publicLaneId,
          batchId: 'BATCH-INT-001',
          product: 'MANGO',
          market: 'JAPAN',
          variety: 'Nam Dok Mai',
          quantity: 500,
          grade: 'A',
          origin: 'Chiang Mai',
          harvestDate: '2026-03-15',
          transportMode: 'AIR',
          carrier: 'Thai Airways',
          completeness: 97,
          status: 'VALIDATED',
          checklistItems: [],
          labResults: null,
          checkpoints: [],
          generatedAt: '2026-03-16T10:00:00.000Z',
          packType: 'REGULATOR',
        },
      );
      packId = pack.id;

      const jobResult = await pool.query<{ id: string }>(
        'SELECT id FROM proof_pack_jobs WHERE proof_pack_id = $1',
        [pack.id],
      );
      jobId = jobResult.rows[0]?.id ?? null;
      expect(jobId).not.toBeNull();

      await pool.query(
        `
          UPDATE proof_pack_jobs
          SET
            status = 'PROCESSING',
            attempt_count = 1,
            leased_at = NOW() - INTERVAL '5 minutes',
            lease_expires_at = NOW() - INTERVAL '4 minutes',
            updated_at = NOW() - INTERVAL '5 minutes'
          WHERE id = $1
        `,
        [jobId],
      );

      await app.close();
      app = undefined;

      restartedApp = await createApp(true);

      await waitFor(async () => {
        const result = await pool.query<{
          status: string;
          content_hash: string | null;
          file_path: string | null;
        }>(
          `
            SELECT status, content_hash, file_path
            FROM proof_packs
            WHERE id = $1
          `,
          [pack.id],
        );
        const row = result.rows[0];
        return (
          row?.status === 'READY' &&
          row.content_hash !== null &&
          row.file_path !== null
        );
      }, 10_000);

      const jobState = await pool.query<{
        status: string;
        attempt_count: string;
      }>(
        `
          SELECT status, attempt_count::text AS attempt_count
          FROM proof_pack_jobs
          WHERE id = $1
        `,
        [jobId],
      );
      expect(jobState.rows[0]?.status).toBe('COMPLETED');
      expect(Number(jobState.rows[0]?.attempt_count ?? '0')).toBeGreaterThan(1);
    } finally {
      if (app !== undefined) {
        await app.close();
      }
      if (restartedApp !== undefined) {
        await restartedApp.close();
      }
      if (jobId !== null) {
        await pool.query('DELETE FROM proof_pack_jobs WHERE id = $1', [jobId]);
      }
      if (packId !== null) {
        await pool.query(
          'DELETE FROM audit_entry_snapshots WHERE audit_entry_id IN (SELECT id FROM audit_entries WHERE entity_id = $1)',
          [packId],
        );
        await pool.query('DELETE FROM audit_entries WHERE entity_id = $1', [
          packId,
        ]);
        await pool.query('DELETE FROM proof_packs WHERE id = $1', [packId]);
      }
      await pool.query('DELETE FROM lanes WHERE id = $1', [laneId]);
      await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
    }
  });
});
