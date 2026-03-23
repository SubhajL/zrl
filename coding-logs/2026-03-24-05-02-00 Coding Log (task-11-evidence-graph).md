# Task 11 Evidence Graph

## Planning Context
- Date: 2026-03-24 05:02 ICT
- User request: plan and implement Task 11 in a clean worktree because the current checkout is not on `main`.
- Task Master state at planning start: Task `11` moved from `pending` to `in-progress`.
- Worktree: `/Users/subhajlimanond/dev/zrl-task-11` on branch `feature/task-11-evidence-graph`.
- Auggie semantic search returned partially stale snippets for the evidence module, so planning is based on direct file inspection plus exact-string searches of the current worktree for the authoritative shape.

## Plan Draft A

### Overview
Finish Task 11 by extending the existing evidence module rather than introducing a separate graph module. Keep graph construction, traversal, and integrity verification inside `EvidenceService` and `PrismaEvidenceStore`, reusing `artifact_links`, current upload link inputs, and the existing object store/hash verification path.

### Files To Change
- `src/modules/evidence/evidence.types.ts`
  - expand graph node/edge contracts to carry verification state, labels, and integrity results.
- `src/modules/evidence/evidence.service.ts`
  - add graph assembly, auto-parent link construction, cycle enforcement orchestration, and lane-level integrity verification.
- `src/modules/evidence/evidence.pg-store.ts`
  - add edge existence/cycle checks, lane/checkpoint parent artifact lookup helpers, graph traversal queries, and graph verification reads.
- `src/modules/evidence/evidence.controller.ts`
  - keep the existing graph route, and add a lane graph verification endpoint if the service surface needs one.
- `src/modules/evidence/evidence.service.spec.ts`
  - add RED/GREEN coverage for auto-linking, cycle rejection, graph payload shape, and tamper detection.
- `test/evidence.e2e-spec.ts`
  - extend the mocked graph endpoint contract and add lane graph verification endpoint coverage if added.
- `docs/PROGRESS.md`
  - append a terse Task 11 progress line after implementation.

### Implementation Steps
1. TDD sequence:
   1) add failing service tests for automatic parent-link creation, cycle rejection, richer lane graph output, and lane graph integrity verification.
   2) run the focused evidence service spec and confirm the failures point to the missing graph behavior.
   3) implement the smallest store/service changes to satisfy the unit tests.
   4) add or update e2e tests for the graph route contract and any new graph verification route.
   5) run focused e2e, then repo gates.
2. `EvidenceService.persistArtifact(...)`
   - build the effective link set by merging caller-provided links with automatic lineage links for earlier artifacts in the same lane and checkpoint.
   - delegate cycle-safe insertion to the store before the upload transaction commits.
3. `EvidenceService.getLaneGraph(laneId)`
   - return graph nodes derived from persisted artifacts plus edges from `artifact_links`, with verification status surfaced per node.
4. `EvidenceService.verifyLaneGraph(laneId, actor)`
   - load all artifacts for the lane, re-hash each stored object, compute invalid node ids, and append one lane-scoped audit entry for the verification action.
5. `PrismaEvidenceStore`
   - add helper methods for lane graph reads and cycle prevention without changing the schema.

### Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact auto-links checkpoint artifacts to prior lane artifacts`
    - proves lineage is created automatically on upload.
  - `uploadArtifact rejects link sets that would create a cycle`
    - DAG invariant fails closed.
  - `getLaneGraph returns verification-aware nodes and edges`
    - graph payload is richer than the current stub.
  - `verifyLaneGraph reports invalid nodes when stored content is tampered`
    - lane-wide integrity verification works.
- `test/evidence.e2e-spec.ts`
  - `GET /lanes/:id/evidence/graph returns graph visualization payload`
    - route wiring and response contract.
  - `POST /lanes/:id/evidence/graph/verify returns lane graph verification result`
    - route wiring for on-demand integrity verification.

### Decision Completeness
- Goal:
  - implement the real evidence DAG engine inside the current evidence module.
- Non-goals:
  - proof-pack generation.
  - temperature ingestion.
  - frontend visualization work beyond backend graph payload shape.
- Success criteria:
  - uploads create deterministic lineage edges.
  - graph traversal returns connected nodes and edges for a lane.
  - cycle-forming links are rejected.
  - lane-level graph verification re-hashes artifacts and identifies invalid nodes.
- Public interfaces:
  - existing `GET /lanes/:id/evidence/graph`
  - new `POST /lanes/:id/evidence/graph/verify` if added
  - existing multipart upload flow gains automatic parent-link behavior
- Edge cases / failure modes:
  - cycle attempts fail closed with `400`.
  - missing or unreadable stored objects fail closed during graph verification.
  - deleted artifacts are excluded from graph traversal and integrity checks.
- Rollout & monitoring:
  - no migration unless a missing schema gap is discovered.
  - use focused evidence tests first, then full backend gates.
  - backout is a revert of evidence-module changes only.
- Acceptance checks:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
  - `npm run db:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Dependencies
- Existing `EvidenceModule`, `HashingService`, `AuditService`, and object store contract.
- Existing `artifact_links` table and upload `links` input.

### Validation
- Verify the graph route is still wired through `EvidenceController`.
- Verify store methods are used by real service entry points rather than becoming dead helpers.
- Verify full-lane integrity reuses the same object store content hashes already used for single-artifact verification.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceService.persistArtifact()` graph logic | `POST /lanes/:id/evidence` and partner artifact creation | `src/modules/evidence/evidence.module.ts` provider | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.getLaneGraph()` | `GET /lanes/:id/evidence/graph` | `src/modules/evidence/evidence.controller.ts` | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.verifyLaneGraph()` | new lane graph verification route if added | `src/modules/evidence/evidence.controller.ts` | `evidence_artifacts`, object store paths, audit entries |
| `PrismaEvidenceStore` graph helpers | called by evidence service methods | `src/modules/evidence/evidence.module.ts` provider | `artifact_links`, `evidence_artifacts`, `lanes`, `checkpoints` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/PostgreSQL and TypeScript in this repo.

### Decision-Complete Checklist
- No open design decision remains for the implementer.
- Every public backend surface is named.
- Every behavior change has at least one failing test target.
- Validation commands are concrete and repo-valid.
- Wiring verification covers upload, graph read, verification, and persistence.

## Plan Draft B

### Overview
Keep Task 11 even narrower: do not add a new verification route, and keep graph verification behind the existing `GET /evidence/:id/verify` plus enriched lane graph metadata. Implement automatic lineage links and lane graph traversal only, and leave lane-wide verification as an internal helper for later proof-pack/dispute work.

### Files To Change
- Same evidence module files as Draft A, except avoid controller expansion unless absolutely necessary.

### Implementation Steps
1. Add failing tests for auto-linking, cycle rejection, and richer lane graph output.
2. Implement graph helpers inside the store and service.
3. Reuse the existing single-artifact verification route and expose node verification state through `getLaneGraph()`.
4. Skip a new route unless tests or contract needs force one.

### Test Coverage
- Same service tests except omit a lane graph verification endpoint test.
- Keep e2e scope to `GET /lanes/:id/evidence/graph`.

### Decision Completeness
- Goal:
  - land core DAG construction/traversal with minimal transport-surface change.
- Non-goals:
  - adding extra evidence endpoints unless necessary.
- Success criteria:
  - automatic edge creation and cycle rejection work.
  - lane graph endpoint returns useful DAG data.
- Public interfaces:
  - only existing graph endpoint changes shape.
- Edge cases / failure modes:
  - same fail-closed graph semantics as Draft A.
- Rollout & monitoring:
  - less surface area, lower controller churn.
- Acceptance checks:
  - focused evidence unit/e2e plus repo gates.

### Dependencies
- Same as Draft A.

### Validation
- Confirm the existing graph endpoint can carry enough state for Task 25 before adding new routes.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceService.persistArtifact()` graph logic | upload routes and partner artifact creation | `EvidenceModule` provider | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.getLaneGraph()` | existing graph endpoint | `EvidenceController` | `evidence_artifacts`, `artifact_links` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/PostgreSQL and TypeScript.

### Decision-Complete Checklist
- Narrower route surface.
- Lower risk, but less explicit verification transport coverage.

## Comparative Analysis & Synthesis

### Strengths
- Draft A fully satisfies the Task 11 wording by covering both traversal and explicit lane-level integrity verification.
- Draft B minimizes route churn and is less risky if the existing API surface is already sufficient for downstream consumers.

### Gaps
- Draft A adds one more controller path and corresponding tests.
- Draft B underspecifies how lane-level integrity verification becomes externally usable, which matters for the PRD and later dispute/proof-pack tasks.

### Trade-Offs
- Draft A is more complete and better aligned with the PRD.
- Draft B is smaller but likely leaves Task 11 partially finished.

### Compliance Check
- Both drafts preserve the current evidence module boundary and reuse existing hashing/audit/object-store infrastructure.
- Draft A better matches the evidence module `CLAUDE.md` testing requirements around graph integrity verification.

## Unified Execution Plan

### Overview
Implement Task 11 directly in the current evidence module. Add deterministic automatic lineage links during upload, prevent graph cycles in the store/service path, enrich the lane graph endpoint with stable node/edge metadata, and expose on-demand lane graph integrity verification through a dedicated lane route. Reuse the current object store and hashing service rather than inventing separate graph storage.

### Files To Change
- `src/modules/evidence/evidence.types.ts`
  - add richer graph node/edge and lane verification result contracts.
- `src/modules/evidence/evidence.service.ts`
  - add link planning, cycle-safe graph persistence, lane graph mapping, and lane graph verification.
- `src/modules/evidence/evidence.pg-store.ts`
  - add helper methods for automatic parent link discovery, cycle checks, graph traversal reads, and artifact verification reads.
- `src/modules/evidence/evidence.controller.ts`
  - keep `GET /lanes/:id/evidence/graph` and add `POST /lanes/:id/evidence/graph/verify`.
- `src/modules/evidence/evidence.service.spec.ts`
  - add RED/GREEN tests for auto-linking, cycle rejection, graph output, and lane verification.
- `test/evidence.e2e-spec.ts`
  - extend graph endpoint expectations and add lane verification route wiring.
- `docs/PROGRESS.md`
  - append a Task 11 completion note.

### Implementation Steps
1. TDD sequence:
   1) add failing evidence service tests for:
      - automatic parent/lineage links on upload
      - cycle rejection before link persistence
      - richer lane graph output
      - lane graph integrity verification result shape
   2) run the focused service spec and confirm red failures.
   3) implement the smallest store/service changes to satisfy the service tests.
   4) add failing e2e coverage for the new/updated graph routes.
   5) implement controller wiring and rerun focused e2e.
   6) run db generate, lint, typecheck, full test, and build.
2. `EvidenceService.persistArtifact(...)`
   - after artifact creation, compute automatic lineage links:
     - checkpoint artifact links to earlier artifacts in the same checkpoint when relevant
     - lane-level parent links from newly uploaded artifacts to the most recent earlier non-deleted artifacts in the lane
   - merge those with caller-provided links and reject any cycle-forming insertion before link writes.
3. `EvidenceService.getLaneGraph(laneId)`
   - map store graph rows into a stable frontend-friendly payload:
     - node `id`, `artifactId`, `artifactType`, `label`, `status`, `hashPreview`
     - edge `id`, `sourceArtifactId`, `targetArtifactId`, `relationshipType`
4. `EvidenceService.verifyLaneGraph(laneId, actor)`
   - iterate lane artifacts, re-hash from object storage, collect invalid node ids and counts, and create one audit entry for the lane verification action.
5. `PrismaEvidenceStore`
   - add methods to:
     - fetch candidate parent artifacts for auto-linking
     - test whether a proposed link would create a path back to the source
     - load full lane graph rows without deleted artifacts
     - load all lane artifacts for graph verification

### Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact auto-links a checkpoint photo to earlier lane artifacts`
    - ensures deterministic lineage edges are added.
  - `uploadArtifact rejects links that would introduce a graph cycle`
    - DAG enforcement fails closed.
  - `getLaneGraph maps node verification states and edge relationships`
    - graph visualization contract is stable.
  - `verifyLaneGraph flags invalid nodes and writes an audit entry`
    - lane-level integrity verification works end to end in service logic.
- `test/evidence.e2e-spec.ts`
  - `GET /lanes/:id/evidence/graph returns graph data`
    - existing graph route stays wired.
  - `POST /lanes/:id/evidence/graph/verify returns verification summary`
    - lane graph verification route is wired and protected.

### Decision Completeness
- Goal:
  - complete the evidence DAG engine for Task 11.
- Non-goals:
  - proof-pack generation, OCR, or temperature ingestion.
- Success criteria:
  - uploads can create deterministic lineage edges.
  - cycle-forming links are rejected.
  - lane graph traversal returns connected nodes and edges.
  - lane-level integrity verification returns `{ valid, invalidNodeIds, checkedCount }`.
- Public interfaces:
  - `GET /lanes/:id/evidence/graph`
  - `POST /lanes/:id/evidence/graph/verify`
  - enriched graph node/edge payload in `evidence.types.ts`
- Edge cases / failure modes:
  - cycle attempts: fail closed with `BadRequestException`
  - missing lane/artifact: fail closed with `NotFoundException`
  - unreadable stored object during verification: mark node invalid and fail verification result closed
  - deleted artifacts: excluded from traversal and verification
- Rollout & monitoring:
  - no schema migration unless a gap is discovered during implementation
  - validate focused evidence tests before running repo-wide gates
  - backout is revert-by-file of evidence module changes
- Acceptance checks:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
  - `npm run db:generate`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Dependencies
- `EvidenceModule` provider wiring
- `HashingService` and current object store contract
- `AuditService`
- existing `artifact_links` persistence

### Validation
- Verify graph read and graph verify are reachable from controller routes.
- Verify upload-time auto-linking is exercised through real `persistArtifact(...)` code paths.
- Verify no new helper is left without a runtime call site.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceService.persistArtifact()` DAG logic | `POST /lanes/:id/evidence`, partner ingest helpers | provider factory in `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.getLaneGraph()` | `GET /lanes/:id/evidence/graph` | `src/modules/evidence/evidence.controller.ts` | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.verifyLaneGraph()` | `POST /lanes/:id/evidence/graph/verify` | `src/modules/evidence/evidence.controller.ts` | `evidence_artifacts`, object store paths, `audit_entries` |
| `PrismaEvidenceStore` graph helpers | called by evidence service methods | `src/modules/evidence/evidence.module.ts` provider | `evidence_artifacts`, `artifact_links`, `lanes`, `checkpoints` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/PostgreSQL and TypeScript in this repo.

### Decision-Complete Checklist
- No open implementation decision remains.
- Every route and response shape change is named.
- Every behavior change has a failing test target.
- Validation commands are specific and repo-valid.
- Wiring verification covers service, controller, provider, and tables.

## 2026-03-24 05:04 ICT

- Goal: complete Task 11 in the isolated Task 11 worktree by turning the evidence graph path into a real DAG/integrity feature instead of a read-only stub.
- What changed:
  - `src/modules/evidence/evidence.types.ts`
    - Added lane graph verification result typing and expanded the evidence store contract with graph-specific helpers.
  - `src/modules/evidence/evidence.service.ts`
    - Added automatic predecessor-link creation on upload, cycle rejection before link persistence, lane-level graph verification, and safer cleanup handling.
  - `src/modules/evidence/evidence.pg-store.ts`
    - Added latest-parent lookup helpers, recursive cycle detection that ignores deleted artifacts, lane integrity-read queries, and stricter graph edge filtering.
  - `src/modules/evidence/evidence.controller.ts`
    - Added `POST /lanes/:id/evidence/graph/verify`.
  - `src/modules/evidence/evidence.service.spec.ts`
    - Added RED/GREEN coverage for automatic graph links, cycle rejection, and lane graph verification.
  - `test/evidence.e2e-spec.ts`
    - Added route coverage for lane graph verification and updated the graph mock contract.
  - `docs/PROGRESS.md`
    - Added the terse Task 11 progress entry.
- TDD evidence:
  - RED command: `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
    - Failed with three expected Task 11 gaps:
      - auto-link expectation unmet (`createArtifactLinks` not called)
      - cycle rejection test resolved instead of throwing
      - `TypeError: service.verifyLaneGraph is not a function`
  - RED command: `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
    - Failed with `expected 201 "Created", got 404 "Not Found"` for `POST /lanes/:id/evidence/graph/verify`
  - GREEN command: `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
    - Passed (`12/12`) after the service/store/controller graph changes.
  - GREEN command: `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
    - Passed (`8/8`) after the lane graph verification route was wired.
- Tests run and results:
  - `npm install` — passed in the fresh worktree; installed backend dependencies locally.
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts` — failed RED, then passed GREEN.
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts` — failed RED, then passed GREEN.
  - `npm run db:generate` — passed.
  - `npm run lint` — failed once on Prettier formatting only, then passed after formatting.
  - `npm run typecheck` — passed.
  - `npm test` — passed (`13/13` suites, `87/87` tests).
  - `npm run build` — passed.
- Wiring verification evidence:
  - `rg -n "verifyLaneGraph|findLatestArtifactForLane|findLatestArtifactForCheckpoint|linkCreatesCycle|listArtifactsForIntegrityCheck|evidence/graph/verify" src test`
    - Confirmed the new lane verification route, service entry point, store helpers, and test call sites are all wired.
  - `EvidenceController.verifyLaneEvidenceGraph()` now calls `EvidenceService.verifyLaneGraph()` through the existing `EvidenceModule` provider wiring.
  - `EvidenceService.persistArtifact()` now uses the new graph helpers in the same upload transaction path that all artifact creation flows already traverse, including partner artifact creation.
- Behavior changes and risk notes:
  - Evidence uploads now auto-create deterministic predecessor edges, which makes the lane graph connected without a separate graph-write API.
  - Lane graph verification fails closed: unreadable or mismatched objects mark the node `FAILED` and make the lane verification result invalid.
  - Cycle detection now ignores soft-deleted artifacts so deleted graph history does not block new valid links.
  - When the latest lane artifact and checkpoint artifact are the same node, the automatic link logic now keeps only the more specific checkpoint predecessor edge to respect the table’s unique `(source_artifact_id, target_artifact_id)` constraint.
- Follow-ups / known gaps:
  - The current automatic lineage heuristic is intentionally simple (`CHECKPOINT_PREDECESSOR` / `LANE_PREDECESSOR`) and may need richer domain-specific relationships once proof-pack and dispute workflows consume the graph more deeply.
  - Lane-level verification currently updates artifact verification statuses in place; if product semantics later require a fully historical verification stream, that should be modeled as a separate follow-up rather than changing this path silently.

## Review (2026-03-24 05:04:07 ICT) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-11`
- Branch: `feature/task-11-evidence-graph`
- Scope: `working-tree`
- Commands Run: `git status --short`; `git diff --name-only`; `git diff -- src/modules/evidence/evidence.service.ts src/modules/evidence/evidence.pg-store.ts src/modules/evidence/evidence.controller.ts src/modules/evidence/evidence.types.ts src/modules/evidence/evidence.service.spec.ts test/evidence.e2e-spec.ts`; `rg -n "verifyLaneGraph|findLatestArtifactForLane|findLatestArtifactForCheckpoint|linkCreatesCycle|listArtifactsForIntegrityCheck|evidence/graph/verify" src test`; `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`; `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`; `npm run db:generate`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed Task 11 can stay within the existing `artifact_links` table and current evidence transport surface, rather than introducing a separate graph-only persistence model.
- Assumed the lane graph verification route should be `POST` because it mutates verification status and writes an audit entry, even though the returned payload is report-like.

### Recommended Tests / Validation
- `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
- `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
- `npm run db:generate`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Rollout Notes
- No schema migration was required for Task 11, so rollout is application-code only.
- Existing lanes with evidence but no prior links will still graph correctly from the upload point forward; historical backfill of graph edges would be a separate follow-up if needed.

## Review (2026-03-24 05:55:35 +07) - working-tree post-rebase

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-11`
- Branch: `feature/task-11-evidence-graph`
- Scope: `working-tree`
- Commands Run: `git status -sb`; `git diff --stat`; `git diff -- src/modules/evidence/evidence.service.ts src/modules/evidence/evidence.pg-store.ts src/modules/evidence/evidence.types.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.controller.ts test/evidence.e2e-spec.ts`; `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`; `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed Task 11 should land on top of Task 9 rather than being restacked beneath it, so the rebased evidence service intentionally keeps both completeness-sync behavior and graph verification behavior.
- Assumed artifact links must stay lane-local; the working tree now rejects cross-lane targets before link creation.

### Recommended Tests / Validation
- `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
- `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Rollout Notes
- No schema migration is required; Task 11 is application-code only on top of the existing evidence tables.
- This rebased variant preserves Task 9 completeness updates and adds graph-specific guards for same-lane linking and cycle-sensitive verification.
