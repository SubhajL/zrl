import { Pool } from 'pg';
import { PrismaEvidenceStore } from './evidence.pg-store';

function requireDatabaseUrl(): string {
  const databaseUrl = process.env['DATABASE_URL']?.trim() || '';
  if (databaseUrl.length === 0) {
    throw new Error('DATABASE_URL must be set for DB-backed evidence tests.');
  }

  return databaseUrl;
}

const describeIfDatabase =
  (process.env['DATABASE_URL']?.trim() || '').length > 0
    ? describe
    : describe.skip;

describeIfDatabase('PrismaEvidenceStore (db-backed)', () => {
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

  it('linkCreatesCycle works with text artifact ids when the new edge is acyclic', async () => {
    const exporterId = 'user-evidence-cycle-test';
    const laneId = 'lane-evidence-cycle-test';
    const publicLaneId = 'LN-EVIDENCE-CYCLE-TEST';
    const sourceArtifactId = 'artifact-source-text-id';
    const targetArtifactId = 'artifact-target-text-id';
    const store = new PrismaEvidenceStore(pool as never);

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
          0,
          NOW(),
          NOW(),
          NOW()
        )
      `,
      [laneId, publicLaneId, exporterId],
    );

    await pool.query(
      `
        INSERT INTO evidence_artifacts (
          id,
          lane_id,
          artifact_type,
          file_name,
          mime_type,
          file_size_bytes,
          file_path,
          content_hash,
          source,
          checkpoint_id,
          uploaded_by,
          verification_status,
          metadata,
          uploaded_at,
          updated_at
        )
        VALUES
          (
            $1,
            $2,
            'MRL_TEST',
            'source.json',
            'application/json',
            128,
            'evidence/source.json',
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            'UPLOAD',
            NULL,
            $3,
            'PENDING',
            NULL,
            NOW(),
            NOW()
          ),
          (
            $4,
            $2,
            'PHYTO_CERT',
            'target.pdf',
            'application/pdf',
            256,
            'evidence/target.pdf',
            'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            'UPLOAD',
            NULL,
            $3,
            'PENDING',
            NULL,
            NOW(),
            NOW()
          )
      `,
      [sourceArtifactId, laneId, exporterId, targetArtifactId],
    );

    try {
      await expect(
        store.linkCreatesCycle(sourceArtifactId, targetArtifactId),
      ).resolves.toBe(false);
    } finally {
      await pool.query(
        'DELETE FROM artifact_links WHERE source_artifact_id IN ($1, $2) OR target_artifact_id IN ($1, $2)',
        [sourceArtifactId, targetArtifactId],
      );
      await pool.query('DELETE FROM evidence_artifacts WHERE id IN ($1, $2)', [
        sourceArtifactId,
        targetArtifactId,
      ]);
      await pool.query('DELETE FROM lanes WHERE id = $1', [laneId]);
      await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
    }
  });

  it('linkCreatesCycle detects an existing reverse path with text artifact ids', async () => {
    const exporterId = 'user-evidence-cycle-positive';
    const laneId = 'lane-evidence-cycle-positive';
    const publicLaneId = 'LN-EVIDENCE-CYCLE-POSITIVE';
    const sourceArtifactId = 'artifact-source-positive';
    const targetArtifactId = 'artifact-target-positive';
    const store = new PrismaEvidenceStore(pool as never);

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
          0,
          NOW(),
          NOW(),
          NOW()
        )
      `,
      [laneId, publicLaneId, exporterId],
    );

    await pool.query(
      `
        INSERT INTO evidence_artifacts (
          id,
          lane_id,
          artifact_type,
          file_name,
          mime_type,
          file_size_bytes,
          file_path,
          content_hash,
          source,
          checkpoint_id,
          uploaded_by,
          verification_status,
          metadata,
          uploaded_at,
          updated_at
        )
        VALUES
          (
            $1,
            $2,
            'MRL_TEST',
            'source.json',
            'application/json',
            128,
            'evidence/source.json',
            'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            'UPLOAD',
            NULL,
            $3,
            'PENDING',
            NULL,
            NOW(),
            NOW()
          ),
          (
            $4,
            $2,
            'PHYTO_CERT',
            'target.pdf',
            'application/pdf',
            256,
            'evidence/target.pdf',
            'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            'UPLOAD',
            NULL,
            $3,
            'PENDING',
            NULL,
            NOW(),
            NOW()
          )
      `,
      [sourceArtifactId, laneId, exporterId, targetArtifactId],
    );

    await pool.query(
      `
        INSERT INTO artifact_links (
          id,
          source_artifact_id,
          target_artifact_id,
          relationship_type
        )
        VALUES ($1, $2, $3, 'SUPPORTS')
      `,
      ['artifact-link-positive', targetArtifactId, sourceArtifactId],
    );

    try {
      await expect(
        store.linkCreatesCycle(sourceArtifactId, targetArtifactId),
      ).resolves.toBe(true);
    } finally {
      await pool.query(
        'DELETE FROM artifact_links WHERE id = $1 OR source_artifact_id IN ($2, $3) OR target_artifact_id IN ($2, $3)',
        ['artifact-link-positive', sourceArtifactId, targetArtifactId],
      );
      await pool.query('DELETE FROM evidence_artifacts WHERE id IN ($1, $2)', [
        sourceArtifactId,
        targetArtifactId,
      ]);
      await pool.query('DELETE FROM lanes WHERE id = $1', [laneId]);
      await pool.query('DELETE FROM users WHERE id = $1', [exporterId]);
    }
  });
});
