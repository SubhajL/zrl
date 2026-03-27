import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type {
  AuthApiKeyCreationInput,
  AuthApiKeyRecord,
  AuthRole,
  AuthStore,
  AuthUserRecord,
} from './auth.types';

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  role: AuthRole;
  company_name: string | null;
  mfa_enabled: boolean;
  totp_secret: string | null;
  session_version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ApiKeyRow extends QueryResultRow {
  id: string;
  user_id: string;
  key_hash: string;
  name: string;
  scopes: string[];
  ip_whitelist: string[];
  expires_at: Date | string | null;
  revoked_at: Date | string | null;
}

type QueryExecutor = Pool | PoolClient;

@Injectable()
export class PrismaAuthStore implements AuthStore, OnModuleDestroy {
  private pool?: Pool;
  private executor?: QueryExecutor;

  constructor() {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    if (databaseUrl.length === 0) {
      return;
    }

    this.pool = new Pool({ connectionString: databaseUrl });
    this.executor = this.pool;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool !== undefined) {
      await this.pool.end();
    }
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const row = await this.findOneUser('email = $1 LIMIT 1', [email]);
    return row === null ? null : this.mapUser(row);
  }

  async findUserById(id: string): Promise<AuthUserRecord | null> {
    const row = await this.findOneUser('id = $1 LIMIT 1', [id]);
    return row === null ? null : this.mapUser(row);
  }

  async updateUserMfa(
    userId: string,
    input: { mfaEnabled: boolean; totpSecret: string | null },
  ): Promise<AuthUserRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<UserRow>(
      `
        UPDATE users
        SET mfa_enabled = $2, totp_secret = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING
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
      `,
      [userId, input.mfaEnabled, input.totpSecret],
    );

    return result.rowCount === 0 ? null : this.mapUser(result.rows[0]);
  }

  async incrementUserSessionVersion(
    userId: string,
  ): Promise<AuthUserRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<UserRow>(
      `
        UPDATE users
        SET session_version = session_version + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING
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
      `,
      [userId],
    );

    return result.rowCount === 0 ? null : this.mapUser(result.rows[0]);
  }

  async findApiKeyByHash(hash: string): Promise<AuthApiKeyRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<ApiKeyRow>(
      `
        SELECT
          id,
          user_id,
          key_hash,
          name,
          scopes,
          ip_whitelist,
          expires_at,
          revoked_at
        FROM api_keys
        WHERE key_hash = $1
        LIMIT 1
      `,
      [hash],
    );

    return result.rowCount === 0 ? null : this.mapApiKey(result.rows[0]);
  }

  async createApiKey(
    input: AuthApiKeyCreationInput,
  ): Promise<AuthApiKeyRecord> {
    const executor = this.requireExecutor();
    const result = await executor.query<ApiKeyRow>(
      `
        INSERT INTO api_keys (
          user_id,
          key_hash,
          name,
          scopes,
          ip_whitelist,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          user_id,
          key_hash,
          name,
          scopes,
          ip_whitelist,
          expires_at,
          revoked_at
      `,
      [
        input.userId,
        input.keyHash,
        input.name,
        input.scopes,
        input.ipWhitelist,
        input.expiresAt ?? null,
      ],
    );

    return this.mapApiKey(result.rows[0]);
  }

  async revokeApiKey(apiKeyId: string): Promise<AuthApiKeyRecord | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<ApiKeyRow>(
      `
        UPDATE api_keys
        SET revoked_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          user_id,
          key_hash,
          name,
          scopes,
          ip_whitelist,
          expires_at,
          revoked_at
      `,
      [apiKeyId],
    );

    return result.rowCount === 0 ? null : this.mapApiKey(result.rows[0]);
  }

  async resolveLaneOwnerId(laneId: string): Promise<string | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<{ exporter_id: string }>(
      `
        SELECT exporter_id
        FROM lanes
        WHERE id = $1
        LIMIT 1
      `,
      [laneId],
    );

    return result.rowCount === 0 ? null : result.rows[0].exporter_id;
  }

  async resolveProofPackOwnerId(packId: string): Promise<string | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<{ exporter_id: string }>(
      `
        SELECT lanes.exporter_id
        FROM proof_packs
        INNER JOIN lanes ON lanes.id = proof_packs.lane_id
        WHERE proof_packs.id = $1
        LIMIT 1
      `,
      [packId],
    );

    return result.rowCount === 0 ? null : result.rows[0].exporter_id;
  }

  async resolveCheckpointOwnerId(checkpointId: string): Promise<string | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<{ exporter_id: string }>(
      `
        SELECT lanes.exporter_id
        FROM checkpoints
        INNER JOIN lanes ON lanes.id = checkpoints.lane_id
        WHERE checkpoints.id = $1
        LIMIT 1
      `,
      [checkpointId],
    );

    return result.rowCount === 0 ? null : result.rows[0].exporter_id;
  }

  private async findOneUser(
    clause: string,
    values: unknown[],
  ): Promise<UserRow | null> {
    const executor = this.requireExecutor();
    const result = await executor.query<UserRow>(
      `
        SELECT
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
        FROM users
        WHERE ${clause}
      `,
      [...values],
    );

    return result.rowCount === 0 ? null : result.rows[0];
  }

  private requireExecutor(): QueryExecutor {
    if (this.executor === undefined) {
      throw new Error('Auth store is not configured.');
    }

    return this.executor;
  }

  private mapUser(row: UserRow): AuthUserRecord {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      role: row.role,
      companyName: row.company_name,
      mfaEnabled: row.mfa_enabled,
      totpSecret: row.totp_secret,
      sessionVersion: row.session_version,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapApiKey(row: ApiKeyRow): AuthApiKeyRecord {
    return {
      id: row.id,
      userId: row.user_id,
      keyHash: row.key_hash,
      name: row.name,
      scopes: row.scopes ?? [],
      ipWhitelist: row.ip_whitelist ?? [],
      expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    };
  }
}
