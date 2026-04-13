import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { Pool } from 'pg';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/common/audit/audit.service';
import { AuditAction, AuditEntityType } from '../src/common/audit/audit.types';
import { AuthService } from '../src/common/auth/auth.service';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public';

function buildHex(index: number): string {
  return index.toString(16).padStart(64, '0').slice(-64);
}

const AUDIT_CHAIN_TEST_TIMEOUT_MS = 20_000;

describe('Audit chain integrity (live DB e2e)', () => {
  let pool: Pool;
  let app: INestApplication<App>;
  let auditService: AuditService;
  let exporterId: string;
  let laneId: string;
  let publicLaneId: string;
  let secondaryLaneId: string;
  let secondaryPublicLaneId: string;

  const envSnapshot = { ...process.env };
  const authServiceMock = {
    verifyAccessToken: jest.fn(),
    resolveLaneOwnerId: jest.fn(),
  };

  async function createApp(): Promise<INestApplication<App>> {
    process.env['DATABASE_URL'] = databaseUrl;
    process.env['PROOF_PACK_WORKER_ENABLED'] = 'false';
    process.env['CERTIFICATION_EXPIRY_WORKER_ENABLED'] = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(authServiceMock)
      .compile();

    const nestApp = moduleFixture.createNestApplication();
    await nestApp.init();
    return nestApp;
  }

  async function seedLane(
    dbLaneId: string,
    externalLaneId: string,
  ): Promise<void> {
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
          cold_chain_device_id,
          cold_chain_data_frequency_seconds,
          status_changed_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'EVIDENCE_COLLECTING',
          'MANGO',
          'JAPAN',
          96.5,
          NULL,
          NULL,
          NULL,
          NOW(),
          NOW(),
          NOW()
        )
      `,
      [dbLaneId, externalLaneId, exporterId],
    );
  }

  async function appendLaneEntries(
    dbLaneId: string,
    count: number,
    startIndex = 0,
  ): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      const sequence = startIndex + index;
      await auditService.createEntry({
        actor: exporterId,
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.LANE,
        entityId: dbLaneId,
        payloadHash: buildHex(sequence + 1),
        timestamp: new Date(Date.UTC(2026, 2, 29, 3, 0, sequence)),
      });
    }
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query('SELECT 1');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    exporterId = `user-${randomUUID()}`;
    laneId = `lane-${randomUUID()}`;
    secondaryLaneId = `lane-${randomUUID()}`;
    publicLaneId = `LN-AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    secondaryPublicLaneId = `LN-AUDIT-${Date.now()}-${Math.floor(Math.random() * 1000)}-B`;

    authServiceMock.verifyAccessToken.mockImplementation((token: string) => {
      if (token !== 'owner-token') {
        throw new Error('invalid token');
      }

      return Promise.resolve({
        user: {
          id: exporterId,
          email: `${exporterId}@example.com`,
          role: 'EXPORTER',
          companyName: 'Exporter Co',
          mfaEnabled: false,
          sessionVersion: 0,
        },
        claims: {
          iss: 'zrl-auth',
          aud: 'zrl',
          sub: exporterId,
          type: 'access',
          role: 'EXPORTER',
          sv: 0,
          mfa: false,
          email: `${exporterId}@example.com`,
          companyName: 'Exporter Co',
          iat: 1,
          exp: 2,
          jti: 'jti',
        },
      });
    });
    authServiceMock.resolveLaneOwnerId.mockImplementation(
      (requestedLaneId: string) => {
        if (
          requestedLaneId === laneId ||
          requestedLaneId === publicLaneId ||
          requestedLaneId === secondaryLaneId ||
          requestedLaneId === secondaryPublicLaneId
        ) {
          return Promise.resolve(exporterId);
        }

        return Promise.resolve(null);
      },
    );

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
    await seedLane(laneId, publicLaneId);
    await seedLane(secondaryLaneId, secondaryPublicLaneId);

    app = await createApp();
    auditService = app.get(AuditService);
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }

    await pool.query(
      `
        DELETE FROM audit_entry_snapshots
        WHERE audit_entry_id IN (
          SELECT id FROM audit_entries WHERE entity_id IN ($1, $2)
        )
      `,
      [laneId, secondaryLaneId],
    );
    await pool.query('DELETE FROM audit_entries WHERE entity_id IN ($1, $2)', [
      laneId,
      secondaryLaneId,
    ]);
    await pool.query('DELETE FROM lanes WHERE id IN ($1, $2)', [
      laneId,
      secondaryLaneId,
    ]);
    await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
  });

  afterAll(async () => {
    process.env = envSnapshot;
    await pool.end();
  });

  it(
    'returns valid for an untampered 1000-entry lane audit chain and ignores other lanes',
    async () => {
      await appendLaneEntries(laneId, 1000);
      await appendLaneEntries(secondaryLaneId, 2, 1000);

      await request(app.getHttpServer())
        .post(`/lanes/${publicLaneId}/audit/verify`)
        .set('Authorization', 'Bearer owner-token')
        .expect(201)
        .expect({
          valid: true,
          entriesChecked: 1000,
        });

      await request(app.getHttpServer())
        .post(`/lanes/${secondaryPublicLaneId}/audit/verify`)
        .set('Authorization', 'Bearer owner-token')
        .expect(201)
        .expect({
          valid: true,
          entriesChecked: 2,
        });
    },
    AUDIT_CHAIN_TEST_TIMEOUT_MS,
  );

  it(
    'returns the first invalid entry after audit hash tampering',
    async () => {
      await appendLaneEntries(laneId, 1000);

      const tamperedEntry = await pool.query<{ id: string }>(
        `
          SELECT id
          FROM audit_entries
          WHERE entity_type = 'LANE' AND entity_id = $1
          ORDER BY timestamp ASC, id ASC
          OFFSET 499
          LIMIT 1
        `,
        [laneId],
      );
      const tamperedEntryId = tamperedEntry.rows[0]?.id;

      expect(tamperedEntryId).toBeDefined();

      await pool.query(
        'UPDATE audit_entries SET entry_hash = $2 WHERE id = $1',
        [tamperedEntryId, '0'.repeat(64)],
      );

      await request(app.getHttpServer())
        .post(`/lanes/${publicLaneId}/audit/verify`)
        .set('Authorization', 'Bearer owner-token')
        .expect(201)
        .expect((response) => {
          expect(response.body).toMatchObject({
            valid: false,
            entriesChecked: 1000,
            firstInvalidIndex: 499,
            firstInvalidEntryId: tamperedEntryId,
          });
        });
    },
    AUDIT_CHAIN_TEST_TIMEOUT_MS,
  );
});
