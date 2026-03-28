import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPrivacyStore } from './privacy.pg-store';

function requireDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim() || '';
  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set for DB-backed privacy tests.');
  }

  return databaseUrl;
}

const describeIfDatabase =
  (process.env['DATABASE_URL']?.trim() || '').length > 0
    ? describe
    : describe.skip;

describeIfDatabase('PrismaPrivacyStore (db-backed)', () => {
  let pool: Pool | undefined;

  beforeAll(() => {
    pool = new Pool({
      connectionString: requireDatabaseUrl(),
    });
  });

  afterAll(async () => {
    if (pool !== undefined) {
      await pool.end();
    }
  });

  it('completePrivacyRequest persists the processor and resolution payload', async () => {
    const exporterId = `user-${randomUUID()}`;
    const adminId = `admin-${randomUUID()}`;
    const requestId = `request-${randomUUID()}`;
    const store = new PrismaPrivacyStore(pool as never);

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
        VALUES
          ($1, $2, $3, 'EXPORTER', $4, false, NULL, 0, NOW(), NOW()),
          ($5, $6, $7, 'ADMIN', $8, true, 'totp', 0, NOW(), NOW())
      `,
      [
        exporterId,
        `${exporterId}@example.com`,
        'hashed-password',
        'Exporter Co',
        adminId,
        `${adminId}@example.com`,
        'hashed-password',
        'ZRL Platform',
      ],
    );

    await pool.query(
      `
        INSERT INTO privacy_requests (
          id,
          user_id,
          request_type,
          status,
          reason,
          details,
          due_at,
          completed_at,
          processed_by_user_id,
          resolution,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          'DELETION',
          'PENDING',
          'Delete the dormant account',
          NULL,
          NOW() + INTERVAL '30 days',
          NULL,
          NULL,
          NULL,
          NOW(),
          NOW()
        )
      `,
      [requestId, exporterId],
    );

    try {
      const completed = await store.completePrivacyRequest({
        requestId,
        status: 'COMPLETED',
        completedAt: new Date('2026-03-28T12:00:00.000Z'),
        processedByUserId: adminId,
        resolution: {
          action: 'ANONYMIZED',
          anonymizedEmail: `deleted+${exporterId}@privacy.invalid`,
        },
      });

      expect(completed.status).toBe('COMPLETED');
      expect(completed.processedByUserId).toBe(adminId);
      expect(completed.resolution).toEqual({
        action: 'ANONYMIZED',
        anonymizedEmail: `deleted+${exporterId}@privacy.invalid`,
      });
    } finally {
      await pool.query(`DELETE FROM privacy_requests WHERE id = $1`, [
        requestId,
      ]);
      await pool.query(`DELETE FROM users WHERE id = $1 OR id = $2`, [
        exporterId,
        adminId,
      ]);
    }
  });

  it('anonymizeUser scrubs account access artifacts and notification targets', async () => {
    const exporterId = `user-${randomUUID()}`;
    const store = new PrismaPrivacyStore(pool as never);

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
        VALUES ($1, $2, $3, 'EXPORTER', $4, true, 'totp-secret', 0, NOW(), NOW())
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
        INSERT INTO api_keys (
          id,
          user_id,
          key_hash,
          name,
          scopes,
          ip_whitelist,
          expires_at,
          revoked_at,
          created_at
        )
        VALUES ($1, $2, $3, 'Primary key', ARRAY['lane:read'], ARRAY[]::TEXT[], NULL, NULL, NOW())
      `,
      [randomUUID(), exporterId, 'key-hash'],
    );
    await pool.query(
      `
        INSERT INTO password_reset_requests (
          id,
          email,
          user_id,
          token_hash,
          expires_at,
          used_at,
          revoked_at,
          created_at
        )
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour', NULL, NULL, NOW())
      `,
      [
        randomUUID(),
        `${exporterId}@example.com`,
        exporterId,
        `token-${randomUUID()}`,
      ],
    );
    await pool.query(
      `
        INSERT INTO notifications (
          id,
          user_id,
          lane_id,
          type,
          title,
          message,
          data,
          read_at,
          created_at
        )
        VALUES ($1, $2, NULL, 'PACK_GENERATED', 'Pack ready', 'Ready.', NULL, NULL, NOW())
      `,
      [randomUUID(), exporterId],
    );
    await pool.query(
      `
        INSERT INTO notification_preferences (
          id,
          user_id,
          type,
          in_app_enabled,
          email_enabled,
          push_enabled,
          line_enabled,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'PACK_GENERATED', true, true, false, false, NOW(), NOW())
      `,
      [randomUUID(), exporterId],
    );
    await pool.query(
      `
        INSERT INTO notification_channel_targets (
          id,
          user_id,
          line_user_id,
          push_endpoint,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
      `,
      [
        randomUUID(),
        exporterId,
        'line-user-1',
        'https://push.example.com/device-1',
      ],
    );
    await pool.query(
      `
        INSERT INTO privacy_consent_events (
          id,
          user_id,
          consent_type,
          granted,
          source,
          created_at
        )
        VALUES ($1, $2, 'MARKETING_COMMUNICATIONS', true, 'seed', NOW())
      `,
      [randomUUID(), exporterId],
    );
    await pool.query(
      `
        INSERT INTO data_export_requests (
          id,
          user_id,
          status,
          file_name,
          content_type,
          zip_data,
          exported_at,
          expires_at
        )
        VALUES ($1, $2, 'READY', 'export.zip', 'application/zip', $3, NOW(), NULL)
      `,
      [randomUUID(), exporterId, Buffer.from('zip-data')],
    );

    try {
      const updated = await store.anonymizeUser(
        exporterId,
        new Date('2026-03-28T12:30:00.000Z'),
      );

      expect(updated.email).toBe(`deleted+${exporterId}@privacy.invalid`);
      expect(updated.companyName).toBeNull();
      expect(updated.mfaEnabled).toBe(false);

      const verification = await pool.query<{
        email: string;
        company_name: string | null;
        mfa_enabled: boolean;
        totp_secret: string | null;
        session_version: number;
        api_keys: string;
        reset_requests: string;
        notifications: string;
        notification_preferences: string;
        notification_channel_targets: string;
        consent_events: string;
        data_exports: string;
      }>(
        `
          SELECT
            users.email,
            users.company_name,
            users.mfa_enabled,
            users.totp_secret,
            users.session_version,
            (SELECT COUNT(*)::text FROM api_keys WHERE user_id = users.id) AS api_keys,
            (SELECT COUNT(*)::text FROM password_reset_requests WHERE user_id = users.id) AS reset_requests,
            (SELECT COUNT(*)::text FROM notifications WHERE user_id = users.id) AS notifications,
            (SELECT COUNT(*)::text FROM notification_preferences WHERE user_id = users.id) AS notification_preferences,
            (SELECT COUNT(*)::text FROM notification_channel_targets WHERE user_id = users.id) AS notification_channel_targets,
            (SELECT COUNT(*)::text FROM privacy_consent_events WHERE user_id = users.id) AS consent_events,
            (SELECT COUNT(*)::text FROM data_export_requests WHERE user_id = users.id) AS data_exports
          FROM users
          WHERE users.id = $1
        `,
        [exporterId],
      );

      expect(verification.rows[0]?.totp_secret).toBeNull();
      expect(verification.rows[0]?.session_version).toBe(1);
      expect(verification.rows[0]?.api_keys).toBe('0');
      expect(verification.rows[0]?.reset_requests).toBe('0');
      expect(verification.rows[0]?.notifications).toBe('0');
      expect(verification.rows[0]?.notification_preferences).toBe('0');
      expect(verification.rows[0]?.notification_channel_targets).toBe('0');
      expect(verification.rows[0]?.consent_events).toBe('0');
      expect(verification.rows[0]?.data_exports).toBe('0');
    } finally {
      await pool.query(`DELETE FROM users WHERE id = $1`, [exporterId]);
    }
  });

  it('createBreachIncident and markBreachIncidentNotifications persist delivery timestamps', async () => {
    const adminId = `admin-${randomUUID()}`;
    const store = new PrismaPrivacyStore(pool as never);

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
        VALUES ($1, $2, $3, 'ADMIN', $4, true, 'totp', 0, NOW(), NOW())
      `,
      [adminId, `${adminId}@example.com`, 'hashed-password', 'ZRL Platform'],
    );

    let incidentId: string | undefined;
    try {
      const created = await store.createBreachIncident({
        reportedByUserId: adminId,
        summary: 'Unauthorized export shared to an external recipient',
        description: 'A generated export was sent to the wrong inbox.',
        affectedUserIds: ['user-1', 'user-2'],
        detectedAt: new Date('2026-03-28T04:00:00.000Z'),
        occurredAt: new Date('2026-03-28T03:00:00.000Z'),
        createdAt: new Date('2026-03-28T04:10:00.000Z'),
      });
      incidentId = created.id;

      const updated = await store.markBreachIncidentNotifications({
        incidentId: created.id,
        pdpaOfficeNotifiedAt: new Date('2026-03-28T04:30:00.000Z'),
        dataSubjectsNotifiedAt: new Date('2026-03-28T04:30:00.000Z'),
      });

      expect(updated.pdpaOfficeNotifiedAt?.toISOString()).toBe(
        '2026-03-28T04:30:00.000Z',
      );
      expect(updated.dataSubjectsNotifiedAt?.toISOString()).toBe(
        '2026-03-28T04:30:00.000Z',
      );
      expect(updated.affectedUserIds).toEqual(['user-1', 'user-2']);
    } finally {
      if (incidentId !== undefined) {
        await pool.query(`DELETE FROM privacy_breach_incidents WHERE id = $1`, [
          incidentId,
        ]);
      }
      await pool.query(`DELETE FROM users WHERE id = $1`, [adminId]);
    }
  });
});
