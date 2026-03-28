import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaNotificationStore } from './notification.pg-store';

function requireDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim() || '';
  if (databaseUrl.length === 0) {
    throw new Error(
      'DATABASE_URL must be set for DB-backed notification store tests.',
    );
  }

  return databaseUrl;
}

const describeIfDatabase =
  (process.env['DATABASE_URL']?.trim() || '').length > 0
    ? describe
    : describe.skip;

describeIfDatabase('PrismaNotificationStore (db-backed)', () => {
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

  it('listDeliveryTargets returns users joined with channel targets', async () => {
    const userId = `user-${randomUUID()}`;
    const store = new PrismaNotificationStore(pool as never);

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
      [userId, `${userId}@example.com`, 'hashed-password', 'Exporter Co'],
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
        userId,
        'line-user-1',
        'https://push.example.com/device-1',
      ],
    );

    try {
      await expect(store.listDeliveryTargets([userId])).resolves.toEqual([
        {
          userId,
          email: `${userId}@example.com`,
          lineUserId: 'line-user-1',
          pushEndpoint: 'https://push.example.com/device-1',
        },
      ]);
    } finally {
      await pool.query(
        'DELETE FROM notification_channel_targets WHERE user_id = $1',
        [userId],
      );
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });
});
