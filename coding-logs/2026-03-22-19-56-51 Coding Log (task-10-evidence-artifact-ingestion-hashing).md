# Task 10 Evidence Artifact Ingestion Hashing

## Plan Draft A

### Overview

Implement the core Task 10 evidence backend around the Task 25 frontend contract: multipart upload, evidence listing/detail, hash verification, and graph retrieval. Use explicit evidence artifact fields for stable frontend values and keep flexible photo and partner metadata in JSON.

### Files To Change

- `prisma/schema.prisma`: add additive evidence-artifact fields needed by the API contract.
- `prisma/migrations/*`: apply the evidence schema changes.
- `src/modules/evidence/evidence.module.ts`: wire the real Evidence module.
- `src/modules/evidence/evidence.constants.ts`: injection tokens and storage defaults.
- `src/modules/evidence/evidence.types.ts`: service/store/object-storage contracts.
- `src/modules/evidence/evidence.service.ts`: upload, list, detail, verify, and graph logic.
- `src/modules/evidence/evidence.controller.ts`: JWT upload/list/detail/verify/graph endpoints and partner push endpoints.
- `src/modules/evidence/evidence.pg-store.ts`: raw `pg` persistence for artifacts and links.
- `src/modules/evidence/evidence.storage.ts`: object-store abstraction with local-disk implementation using S3-style keys.
- `src/modules/evidence/evidence.metadata.ts`: photo metadata extraction and artifact metadata helpers.
- `src/modules/evidence/evidence.service.spec.ts`: unit tests for hashing, storage, audit, and graph behavior.
- `test/evidence.e2e-spec.ts`: route wiring and multipart/JSON endpoint coverage.
- `docs/PROGRESS.md`: terse closeout update.

### Implementation Steps

1. TDD sequence:
   1) Add unit tests for upload, verify, list filters, and graph traversal.
   2) Run the focused unit tests and confirm failures because the Evidence service does not exist.
   3) Implement the smallest service, storage, and store behavior to satisfy the tests.
   4) Add controller and e2e tests for the Task 25 HTTP contract.
   5) Add schema changes and persistence details only where tests require them.
   6) Run `db:generate`, lint, typecheck, focused tests, full tests, and build.
2. `EvidenceService.uploadArtifact(input, actor)`
   - Validate lane ownership or partner scope at the controller layer.
   - Hash the uploaded file, derive the object-store key `evidence/{laneId}/{artifactType}/{hash}.{ext}`, persist metadata, and append an audit entry.
3. `EvidenceService.listLaneArtifacts(laneId, filters)`
   - Return Task 25 list shape with optional type/status filtering and graph-friendly fields.
4. `EvidenceService.getArtifact(id)`
   - Return detail view including full hash, metadata, and verification status.
5. `EvidenceService.verifyArtifact(id)`
   - Re-read the stored object, recompute SHA-256, compare to stored hash, and update verification status to `VERIFIED` or `FAILED`.
6. `EvidenceService.getLaneGraph(laneId)`
   - Return `nodes` and `edges` from `evidence_artifacts` and `artifact_links`.
7. `EvidenceController`
   - Add JWT-protected `GET /lanes/:id/evidence`, `POST /lanes/:id/evidence`, `GET /evidence/:id`, `GET /evidence/:id/verify`, `GET /lanes/:id/evidence/graph`.
   - Add partner API-key-protected JSON ingestion endpoints for lab results and logistics temperature pushes.

### Test Coverage

- `uploadArtifact hashes content and stores object under hash-based key`
  Immediate hashing and storage path are deterministic.
- `uploadArtifact creates an audit entry for ARTIFACT uploads`
  Upload side effects are auditable.
- `listLaneArtifacts applies artifact type and verification filters`
  Lane list filtering works.
- `verifyArtifact recomputes the stored object hash`
  Verification uses stored content, not metadata.
- `getLaneGraph returns artifact nodes and relationship edges`
  Graph response matches frontend DAG needs.
- `POST /lanes/:id/evidence accepts multipart uploads`
  Upload route wiring and auth are correct.
- `GET /lanes/:id/evidence/graph returns graph data`
  Graph endpoint is registered.
- `POST /partner/lab/results stores partner evidence via API key`
  Partner ingestion route is wired.

### Decision Completeness

- Goal:
  Deliver the evidence APIs and storage path that unblock Task 25 and satisfy core Task 10 hashing/audit requirements.
- Non-goals:
  No proof-pack generation, no OCR pipeline, no complete MRL auto-validation engine, no photo compression pipeline.
- Success criteria:
  Task 25 evidence routes exist, uploaded artifacts are stored outside the database under hash-based keys, audit entries are created, hash verification works, and backend gates pass.
- Public interfaces:
  - `GET /lanes/:id/evidence`
  - `POST /lanes/:id/evidence`
  - `GET /evidence/:id`
  - `GET /evidence/:id/verify`
  - `GET /lanes/:id/evidence/graph`
  - `POST /partner/lab/results`
  - `POST /partner/logistics/temperature`
  - additive evidence schema fields and optional env vars for object storage root
- Edge cases / failure modes:
  - Unknown artifact type: fail closed with 400.
  - Missing lane: fail closed with 404.
  - Non-owner exporter access: fail closed with 403.
  - Object-store write failure: fail closed; no DB record or audit entry should survive.
  - Verification mismatch: mark failed and return mismatch details.
- Rollout & monitoring:
  - Additive schema only.
  - Default to local object-store root for dev/test; production can switch adapters later without changing the HTTP contract.
  - Watch upload latency, object-write failures, and verification failures.
- Acceptance checks:
  - `npm run db:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test -- evidence.service.spec.ts`
  - `npm run test:e2e -- evidence.e2e-spec.ts`
  - `npm run test`
  - `npm run build`

### Dependencies

- Existing `HashingModule`, `AuditModule`, `AuthModule`, `LaneModule`
- Existing schema tables `lanes`, `checkpoints`, `evidence_artifacts`, `artifact_links`, `audit_entries`

### Validation

- Focused unit tests prove hashing, storage, audit, and graph behaviors.
- E2E tests prove route registration and auth guards.
- Full backend gates pass after schema generation.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceController` | HTTP `/lanes/:id/evidence`, `/evidence/:id`, `/partner/*` | `src/modules/evidence/evidence.module.ts`, imported by `src/app.module.ts` | `evidence_artifacts`, `artifact_links`, `checkpoints`, `lanes` |
| `EvidenceService` | `EvidenceController` handlers | `src/modules/evidence/evidence.module.ts` provider factory | same evidence tables |
| `PrismaEvidenceStore` | `EvidenceService` | `src/modules/evidence/evidence.module.ts` providers | `evidence_artifacts`, `artifact_links`, `checkpoints`, `lanes` |
| `LocalEvidenceObjectStore` | `EvidenceService` upload and verify paths | `src/modules/evidence/evidence.module.ts` provider token | object-store root outside DB |
| evidence migration | N/A | `prisma/migrations/*`, followed by `npm run db:generate` | `evidence_artifacts`, `checkpoints` |

## Plan Draft B

### Overview

Implement only the FE-facing evidence contract first and keep persistence changes minimal by storing most secondary values in `metadata`. This reduces migration churn but makes the API more serialization-heavy.

### Files To Change

- `src/modules/evidence/*`: controller, service, store, constants, types, and local object-store implementation.
- `prisma/schema.prisma`: only add optional `checkpointId` and soft-delete support if required.
- `test/evidence.e2e-spec.ts`: route contract coverage.
- `docs/PROGRESS.md`: closeout note.

### Implementation Steps

1. Add service and e2e tests for list/upload/detail/verify/graph.
2. Keep `fileName`, `mimeType`, `fileSizeBytes`, `source`, and photo metadata inside `metadata`.
3. Only persist stable core fields as first-class columns: `filePath`, `contentHash`, `artifactType`, `uploadedBy`, `verificationStatus`, and optional checkpoint relation.
4. Build graph edges from `artifact_links` and list data from artifact rows.
5. Keep partner ingestion limited to storing JSON payloads as artifacts with `source=PARTNER_API` in metadata.

### Test Coverage

- `uploadArtifact returns contract fields derived from metadata`
  Response shape remains stable without many schema changes.
- `verifyArtifact updates verification status after re-hashing`
  Verification state transitions correctly.
- `GET /lanes/:id/evidence returns metadata-backed artifacts`
  HTTP contract hides storage details.

### Decision Completeness

- Goal:
  Reach the FE contract with the fewest moving parts.
- Non-goals:
  No explicit top-level schema fields for every response value.
- Success criteria:
  The FE contract is satisfied, and no broad schema changes are needed.
- Trade-off:
  Faster implementation, weaker query ergonomics, and more API-layer reshaping.

### Dependencies

- Existing evidence-artifact schema and metadata JSON column.

### Validation

- Same backend gates as Draft A.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceController` | evidence HTTP routes | `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `artifact_links` |
| `EvidenceService` | controller handlers | `src/modules/evidence/evidence.module.ts` | same |
| `EvidenceStore` | service | `src/modules/evidence/evidence.module.ts` | same |

## Comparative Analysis

- Draft A strengths:
  - Better long-term contract stability for FE and analytics.
  - Cleaner list/detail responses and filters.
  - Stronger modeling for checkpoint and source context.
- Draft A gaps:
  - More schema churn and more persistence work up front.
- Draft B strengths:
  - Lower implementation surface and fewer migrations.
  - Faster path to basic FE enablement.
- Draft B gaps:
  - Pushes too much contract logic into JSON metadata.
  - Makes filtering and future admin/reporting work weaker.
- Trade-off:
  - Draft A costs more now but matches the product shape better.
  - Draft B is faster but likely creates rework for Task 25 and downstream analytics.

## Unified Execution Plan

### Overview

Use Draft A’s explicit contract-first model, but keep flexible partner/photo-specific details in `metadata` so the schema only carries the stable fields the frontend and filters truly need. Implement the FE-facing evidence routes first, then partner push endpoints on the same service and storage path.

### Files To Change

- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/modules/evidence/evidence.module.ts`
- `src/modules/evidence/evidence.constants.ts`
- `src/modules/evidence/evidence.types.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/evidence/evidence.controller.ts`
- `src/modules/evidence/evidence.pg-store.ts`
- `src/modules/evidence/evidence.storage.ts`
- `src/modules/evidence/evidence.metadata.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `test/evidence.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps

1. TDD sequence:
   1) Add `src/modules/evidence/evidence.service.spec.ts` with upload/list/detail/verify/graph and partner-ingestion cases.
   2) Run `npm run test -- evidence.service.spec.ts` and confirm failure because the evidence service/module do not exist.
   3) Implement service/types/constants and local object-store adapter.
   4) Add `test/evidence.e2e-spec.ts` covering multipart upload, list, verify, graph, and partner JSON routes.
   5) Run the focused e2e test and confirm route/auth failures.
   6) Implement controller wiring, store, and schema changes to pass the tests.
   7) Run `npm run db:generate`, lint, typecheck, focused tests, full tests, and build.
2. Add stable evidence fields:
   - `fileName`
   - `mimeType`
   - `fileSizeBytes`
   - `source`
   - `checkpointId?`
   - `deletedAt?`
3. Add `EvidenceService` functions:
   - `uploadArtifact`
   - `createPartnerArtifact`
   - `listLaneArtifacts`
   - `getArtifact`
   - `verifyArtifact`
   - `getLaneGraph`
   - `softDeleteArtifact`
4. Add `EvidenceController` routes:
   - `GET /lanes/:id/evidence`
   - `POST /lanes/:id/evidence`
   - `GET /lanes/:id/evidence/graph`
   - `GET /evidence/:id`
   - `GET /evidence/:id/verify`
   - `DELETE /evidence/:id`
   - `POST /partner/lab/results`
   - `POST /partner/logistics/temperature`
5. Audit behavior:
   - Upload, verify, and delete each append `ARTIFACT` audit entries.
   - Fail closed on object-store or audit errors.
6. Object storage:
   - Use S3-style keys: `evidence/{laneId}/{artifactType}/{hash}.{ext}`.
   - Default to a local filesystem object-store adapter for dev/test without changing the public contract.
7. Metadata handling:
   - Keep EXIF/photo metadata and partner payload specifics in `metadata`.
   - Return contract fields in stable top-level response properties.

### Test Coverage

- `uploadArtifact stores the file under a hash-based key`
  Key format and hash are deterministic.
- `uploadArtifact appends an ARTIFACT audit entry`
  Uploads are auditable.
- `uploadArtifact rejects uploads for missing lanes`
  Lane anchoring is enforced.
- `listLaneArtifacts filters by type and verification status`
  List endpoint filtering works.
- `getArtifact returns contract fields and metadata`
  Detail shape is stable.
- `verifyArtifact fails when the object hash mismatches`
  Tampering detection is explicit.
- `getLaneGraph returns nodes and edges for a lane`
  Graph endpoint matches FE needs.
- `createPartnerArtifact stores JSON evidence under partner auth`
  Partner ingestion reuses the same artifact flow.
- `POST /lanes/:id/evidence accepts multipart form data`
  Upload route and auth are wired.
- `GET /evidence/:id/verify returns verification results`
  Verify route is wired.
- `POST /partner/lab/results requires API key auth`
  Partner route guard is enforced.

### Decision Completeness

- Goal:
  Deliver a real evidence ingestion module that matches the Task 25 contract and satisfies Task 10’s core hashing, storage, and audit requirements.
- Non-goals:
  No proof-pack generation, no OCR, no complete lab MRL auto-validation engine, no temperature excursion logic, no production-only S3 deployment work.
- Success criteria:
  Evidence routes are reachable through `AppModule`, uploads are stored outside the database under hash-based keys, list/detail/verify/graph responses match the FE contract, artifact actions create audit entries, and backend gates pass.
- Public interfaces:
  - `GET /lanes/:id/evidence`
  - `POST /lanes/:id/evidence`
  - `GET /lanes/:id/evidence/graph`
  - `GET /evidence/:id`
  - `GET /evidence/:id/verify`
  - `DELETE /evidence/:id`
  - `POST /partner/lab/results`
  - `POST /partner/logistics/temperature`
  - additive schema fields on `evidence_artifacts`
- Edge cases / failure modes:
  - Unsupported type or malformed payload: 400 fail closed.
  - Missing lane or inaccessible lane: 404/403 fail closed.
  - Storage write failure: no DB row or audit entry committed.
  - Audit failure after DB insert: transaction should fail and the artifact should not persist.
  - Verification mismatch: return mismatch details and mark `FAILED`.
  - Missing stored object during verify: treat as failed verification, not success.
- Rollout & monitoring:
  - Additive migration only.
  - Local object-store adapter for dev/test, same key semantics as production object storage.
  - Monitor upload failures, verify failures, and object-store read errors.
- Acceptance checks:
  - `npm run db:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test -- evidence.service.spec.ts`
  - `npm run test:e2e -- evidence.e2e-spec.ts`
  - `npm run test`
  - `npm run build`

### Dependencies

- Existing `HashingService`, `AuditService`, auth guards, and lane ownership resolution.
- Existing evidence-related tables in Prisma schema.
- `@nestjs/platform-express` multipart support already in the repo.

### Validation

- Unit tests prove service semantics and failure modes.
- E2E tests prove route registration and guard wiring through `AppModule`.
- Full backend gates pass after code and schema changes.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceController` | HTTP evidence and partner routes | `src/modules/evidence/evidence.module.ts` controllers, imported by `src/app.module.ts` | `evidence_artifacts`, `artifact_links`, `lanes`, `checkpoints` |
| `EvidenceService` | `EvidenceController` handlers | `src/modules/evidence/evidence.module.ts` provider factory | same evidence tables |
| `PrismaEvidenceStore` | `EvidenceService` persistence calls | `src/modules/evidence/evidence.module.ts` providers | `evidence_artifacts`, `artifact_links`, `lanes`, `checkpoints` |
| `LocalEvidenceObjectStore` | `EvidenceService.uploadArtifact()` and `verifyArtifact()` | `src/modules/evidence/evidence.module.ts` provider token | object-store root outside DB |
| evidence migration | N/A | `prisma/migrations/*`, followed by `npm run db:generate` | `evidence_artifacts`, `checkpoints` |

## Implementation (2026-03-22 20:13:31 +07)

### Goal

Implement the Task 25-facing slice of Task 10: evidence upload, list/detail/verify/graph routes, partner JSON ingestion, hash-based object storage, and append-only audit logging in a real Evidence module.

### What Changed

- `src/modules/evidence/evidence.service.ts`
  - Implemented artifact upload, list, detail, verify, graph, and partner ingestion flows.
  - Reused `HashingService` and `AuditService` for hash generation and append-only artifact audit entries.
  - Added temp-file cleanup after successful or failed uploads.
- `src/modules/evidence/evidence.controller.ts`
  - Added JWT lane evidence routes and API-key partner ingestion routes.
  - Added multipart parsing, query parsing, and partner lane-scope enforcement.
- `src/modules/evidence/evidence.module.ts`
  - Wired the real Evidence module into Nest with auth, hashing, audit, store, and object-storage providers.
- `src/modules/evidence/evidence.pg-store.ts`
  - Added raw `pg` persistence for evidence artifacts and graph edges.
  - Added transaction-aware audit-store reuse via `PrismaAuditStore.withExecutor(...)`.
- `src/modules/evidence/evidence.storage.ts`
  - Added local object storage using S3-style keys for dev/test execution.
- `src/modules/evidence/evidence.types.ts`
  - Added service/store/object-store contracts and FE-facing artifact/graph shapes.
- `src/modules/evidence/evidence.constants.ts`
  - Added pagination defaults and object-store provider token.
- `src/modules/evidence/evidence.service.spec.ts`
  - Added unit coverage for upload, verify, filters, graph, and authorization.
- `test/evidence.e2e-spec.ts`
  - Added AppModule-level route wiring coverage for list/upload/detail/verify/graph and partner ingestion.
- `prisma/schema.prisma`
  - Added additive artifact contract fields: `file_name`, `mime_type`, `file_size_bytes`, `source`, `checkpoint_id`, and `deleted_at`.
  - Added `ArtifactSource` enum and checkpoint-to-artifact relation.
- `prisma/migrations/20260322195800_add_evidence_contract_fields/migration.sql`
  - Added the reviewable SQL migration for the evidence contract fields and indexes.

### TDD Evidence

- RED:
  - `npm run test -- evidence.service.spec.ts --runInBand`
  - Failure reason: `Cannot find module './evidence.service' from 'modules/evidence/evidence.service.spec.ts'`
- GREEN:
  - `npm run test -- evidence.service.spec.ts --runInBand`
  - Result: 6/6 evidence service tests passed.
- RED:
  - `npm run test:e2e -- evidence.e2e-spec.ts --runInBand`
  - Failure reason: all evidence routes returned `404 Not Found` because the controller/module wiring did not exist.
- GREEN:
  - `npm run test:e2e -- evidence.e2e-spec.ts --runInBand`
  - Result: 6/6 evidence e2e tests passed.
- Note:
  - The first attempt to run the RED unit test in the fresh worktree failed with `jest: command not found` because the isolated worktree had no local `node_modules`. I used a temporary symlink to the main repo’s dependencies to continue the TDD loop, then removed the symlink before closeout.

### Tests Run

- `npm run test -- evidence.service.spec.ts --runInBand`
- `npm run test:e2e -- evidence.e2e-spec.ts --runInBand`
- `npm run typecheck`
- `npm run lint`
- `npm run db:generate`
- `npm run test`
- `npm run build`

All of the above passed in the isolated Task 10 worktree.

### Wiring Verification Evidence

- `EvidenceModule` is now a real Nest module in `src/modules/evidence/evidence.module.ts` and remains imported by `src/app.module.ts`.
- `EvidenceController` registers:
  - `GET /lanes/:id/evidence`
  - `POST /lanes/:id/evidence`
  - `GET /lanes/:id/evidence/graph`
  - `GET /evidence/:id`
  - `GET /evidence/:id/verify`
  - `POST /partner/lab/results`
  - `POST /partner/logistics/temperature`
- `test/evidence.e2e-spec.ts` proves those routes are reachable through `AppModule`.
- `PrismaEvidenceStore.asAuditStore()` reuses `PrismaAuditStore.withExecutor(...)`, so artifact writes and audit appends share the same database transaction client.

### Behavior Changes And Risk Notes

- Uploads fail closed on missing lanes, unsupported artifact types, bad query/body values, unauthorized exporter access, and missing partner lane scope.
- Audit appends are transaction-coupled with evidence row writes.
- Multipart temp files are deleted after processing to avoid filesystem leakage.
- Verification reads the stored object and compares its recomputed SHA-256 to the persisted hash.
- The default runtime object store is local filesystem-backed with S3-style keys. This preserves the public contract but is not yet a real AWS S3 adapter.

### Follow-Ups / Known Gaps

- Full Task 10 infrastructure scope still has two explicit gaps:
  - replace the local object-store adapter with a real S3 adapter for production
  - implement actual EXIF/GPS extraction for checkpoint photos
- Because those are not in the current contract-based slice, Task 10 should remain `in-progress` in Task Master until they are addressed.

## Review (2026-03-22 20:13:31 +07) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-10`
- Branch: `feature/task-10-evidence-ingestion`
- Scope: `working-tree`
- Commands Run: `git status -sb`, `git diff --stat`, `npm run typecheck`, `npm run lint`, `npm run db:generate`, `npm run test -- evidence.service.spec.ts --runInBand`, `npm run test:e2e -- evidence.e2e-spec.ts --runInBand`, `npm run test`, `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings after fixing partner lane-scope enforcement and multipart temp-file cleanup during QCHECK.

LOW
- The default object-store adapter is local filesystem-backed rather than real AWS S3. This is a scoped infrastructure gap, not a correctness bug in the current Task 25 contract path.

### Open Questions / Assumptions
- Assumed the current user request scoped Task 10 to the FE/backend contract needed for Task 25, rather than full production infrastructure parity.
- Assumed partner upload scope should be enforced by lane scope values in the API-key record even though the partner routes carry `laneId` in the request body instead of the URL.

### Recommended Tests / Validation
- `npm run test -- evidence.service.spec.ts --runInBand`
- `npm run test:e2e -- evidence.e2e-spec.ts --runInBand`
- `npm run typecheck`
- `npm run lint`
- `npm run db:generate`
- `npm run test`
- `npm run build`

### Rollout Notes
- Schema changes are additive only.
- Before marking Task 10 fully done, add the production S3 adapter and photo EXIF extraction without changing the HTTP contract established here.

## Implementation Summary (2026-03-23 11:11:00 +07)

### Goal Of The Change

Finish the remaining Task 10 production-facing evidence work: optional S3 storage, checkpoint photo EXIF/GPS extraction, contract-shaped artifact payloads, and `DELETE /evidence/:id` soft delete with artifact audit logging.

### What Changed (By File) And Why

- `package.json`, `package-lock.json`
  - Added `@aws-sdk/client-s3` and `exifr` so the evidence module can switch to real S3-backed object storage and parse checkpoint-photo EXIF/GPS metadata.
- `prisma/schema.prisma`
  - Added `AuditAction.DELETE` and `EvidenceArtifact.updatedAt` so soft deletes and updated contract timestamps are represented in the schema.
- `prisma/migrations/20260323150500_finish_evidence_task_10/migration.sql`
  - Added the database-side enum extension for `DELETE` and the additive `updated_at` column for evidence artifacts.
- `src/common/audit/audit.types.ts`
  - Extended the audit action union with `DELETE` for artifact soft-delete events.
- `src/modules/evidence/evidence.constants.ts`
  - Added a token for the photo metadata extractor.
- `src/modules/evidence/evidence.types.ts`
  - Added `updatedAt`, contract-facing `EvidenceArtifactResponse`, async object-store reads, and the photo metadata extractor contract.
- `src/modules/evidence/evidence.metadata.ts`
  - Added the EXIF/GPS extraction helper used for checkpoint photo uploads.
- `src/modules/evidence/evidence.metadata.spec.ts`
  - Added focused tests for EXIF timestamp, camera model, GPS extraction, and invalid-coordinate rejection.
- `src/modules/evidence/evidence.storage.ts`
  - Added the optional S3 adapter, env-based runtime store selection, and async object reads for verification flows.
- `src/modules/evidence/evidence.storage.spec.ts`
  - Added focused tests for local storage behavior and S3 command wiring.
- `src/modules/evidence/evidence.service.ts`
  - Added Task 25 contract mapping, checkpoint-photo metadata enrichment, async re-hash reads, and `deleteArtifact()` soft-delete audit flow.
- `src/modules/evidence/evidence.service.spec.ts`
  - Extended unit coverage for contract-shaped responses, checkpoint-photo metadata enrichment, and soft-delete audit behavior.
- `src/modules/evidence/evidence.pg-store.ts`
  - Added `updated_at` mapping, verification/delete timestamp updates, and include-deleted lookup support so soft deletes return a real artifact row for audit hashing.
- `src/modules/evidence/evidence.controller.ts`
  - Added `DELETE /evidence/:id` and wired mutating upload/delete paths through the auditor read-only guard.
- `src/modules/evidence/evidence.module.ts`
  - Switched evidence wiring to runtime-select the object store and explicitly construct the photo metadata extractor provider.
- `test/evidence.e2e-spec.ts`
  - Added the delete-route e2e and aligned mocked evidence payloads to the Task 25 contract.

### TDD Evidence

- Tests added/changed:
  - `src/modules/evidence/evidence.service.spec.ts`
  - `src/modules/evidence/evidence.metadata.spec.ts`
  - `src/modules/evidence/evidence.storage.spec.ts`
  - `test/evidence.e2e-spec.ts`
- RED:
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
  - Failure reason: Nest could not resolve `ExifPhotoMetadataExtractor` because its test seam constructor parameter was being treated as an injectable dependency.
- GREEN:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.metadata.spec.ts src/modules/evidence/evidence.storage.spec.ts`
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`

### Tests Run

- `npm run db:generate`
- `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.metadata.spec.ts src/modules/evidence/evidence.storage.spec.ts`
- `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

All of the above passed in `/Users/subhajlimanond/dev/zrl-task-10`.

### Wiring Verification Evidence

- `EvidenceModule` still registers `EvidenceController` and `EvidenceService`, and `EvidenceModule` remains imported by `src/app.module.ts`.
- `EvidenceController` now exposes the full Task 10 evidence surface:
  - `GET /lanes/:id/evidence`
  - `POST /lanes/:id/evidence`
  - `GET /lanes/:id/evidence/graph`
  - `GET /evidence/:id`
  - `GET /evidence/:id/verify`
  - `DELETE /evidence/:id`
  - `POST /partner/lab/results`
  - `POST /partner/logistics/temperature`
- `src/modules/evidence/evidence.module.ts` now selects `LocalEvidenceObjectStore` vs `S3EvidenceObjectStore` at runtime from env, and explicitly provides the EXIF metadata extractor.
- `test/evidence.e2e-spec.ts` proves the evidence routes are reachable through `AppModule`.

### Behavior Changes And Risk Notes

- The evidence API now returns the Task 25 contract shape with `storagePath`, `contentHashPreview`, and ISO `createdAt` / `updatedAt` timestamps.
- Checkpoint photo uploads enrich artifact metadata with extracted EXIF timestamp, GPS coordinates, and camera model when available.
- `DELETE /evidence/:id` is a soft delete only: the DB record is timestamped as deleted and audited, but the stored object is retained.
- S3 is opt-in: local storage remains the default for dev/test, and S3 activates only when the S3 env configuration is present or explicitly selected.

### Follow-Ups / Known Gaps

- The S3 adapter currently covers the evidence module’s direct put/get/delete needs only; bucket lifecycle, encryption, or replication policy remains an environment concern outside this branch.
- The EXIF helper validates GPS coordinate ranges, but it does not yet validate route-aware geography such as destination-country bounds.

## Review (2026-03-23 13:03:35 +07) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-10`
- Branch: `feature/task-10-evidence-ingestion`
- Scope: `working-tree`
- Commands Run: `git status --porcelain=v1`, `git diff --name-only`, `gt status`, `gt ls`, `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`, `npm run lint`, `npm run typecheck`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings after tightening checkpoint photo uploads to fail closed when EXIF/GPS capture metadata is missing.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed checkpoint photo uploads should fail closed on missing capture metadata based on the PRD requirement that checkpoint photos carry EXIF/GPS/timestamp data.
- Assumed the remaining route-aware geography validation is a follow-up enhancement rather than a pre-submit blocker for Task 10.

### Recommended Tests / Validation
- `npm run db:generate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Rollout Notes
- S3 activation remains opt-in via env, so dev/test stays on local storage unless S3 is explicitly configured.
- `DELETE /evidence/:id` remains a soft delete only; stored objects are retained for auditability.
