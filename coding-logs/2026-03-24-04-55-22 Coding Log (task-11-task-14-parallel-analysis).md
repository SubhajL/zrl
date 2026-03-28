# Task 11 / Task 14 Parallel Analysis

## Planning Context
- Date: 2026-03-24 04:55 ICT
- User request: analyze whether Task 11 and Task 14 can be executed in parallel safely.
- Scope: sequencing and conflict analysis only; no implementation or Task Master status changes.
- Repo state note: the active checkout is on `feature/tasks-22-29-frontend-screens`, so implementation-shape analysis was taken from merged `main` via `git show main:...` for backend files.
- Auggie semantic search was used for high-level module overlap, then direct file inspection was used to verify the current merged backend shape because the retrieval snippets were partially stale.

## Plan Draft A

### Overview
Treat Task 11 and Task 14 as parallel-capable with ownership boundaries. Task 11 stays inside the evidence module and existing `artifact_links` lineage model, while Task 14 owns cold-chain ingestion, new temperature persistence, and lane temperature endpoints. Shared files are limited and can be managed by a deliberate schema owner.

### Files To Change
- Task 11 owner:
  - `src/modules/evidence/evidence.service.ts` - graph construction, traversal, integrity verification orchestration.
  - `src/modules/evidence/evidence.pg-store.ts` - subgraph queries, cycle detection support, graph verification reads.
  - `src/modules/evidence/evidence.types.ts` - graph DTO/contracts.
  - `src/modules/evidence/evidence.controller.ts` - if graph endpoint shape changes or verification routes expand.
  - `src/modules/evidence/evidence.service.spec.ts` - DAG and integrity tests.
  - `test/evidence.e2e-spec.ts` - graph endpoint wiring and verification flow.
- Task 14 owner:
  - `src/modules/cold-chain/cold-chain.service.ts` - reading ingestion, excursion detection, shelf-life logic.
  - `src/modules/cold-chain/cold-chain.pg-store.ts` - `TemperatureReading` / `Excursion` persistence.
  - `src/modules/cold-chain/cold-chain.controller.ts` - `/lanes/:id/temperature*` endpoints and CSV/JSON parsing.
  - `src/modules/cold-chain/cold-chain.types.ts` - reading, excursion, SLA DTOs.
  - `src/modules/lane/lane.types.ts` - only if lane detail must expose aggregated temperature state.
  - `prisma/schema.prisma` - additive `temperature_readings` / `excursions` models.
  - `prisma/migrations/*` - one additive migration for Task 14.
  - `src/modules/cold-chain/cold-chain.service.spec.ts` and `test/cold-chain.e2e-spec.ts` - focused TDD.

### Implementation Steps
1. TDD sequence per task:
   1) Add focused unit/e2e tests in the owning module.
   2) Confirm failures for the missing graph or temperature behavior.
   3) Implement the smallest service/store/controller changes to pass.
   4) Refactor only after green tests.
   5) Run task-scoped gates before any shared-schema integration.
2. Ownership split:
   - Task 11 owns all evidence graph semantics and `artifact_links`.
   - Task 14 owns all temperature domain semantics and any new temperature tables.
3. Shared-file policy:
   - Only one task edits `prisma/schema.prisma` at a time, or Task 14 owns schema and Task 11 avoids schema edits unless blocked.
   - Avoid touching `src/modules/lane/*` from Task 11.
   - Avoid touching `src/modules/evidence/*` from Task 14 unless temperature uploads are explicitly required to create `TEMP_DATA` evidence artifacts in the same task.

Function / component focus:
- `EvidenceService.getLaneGraph(laneId)` should evolve into real graph assembly and integrity-aware node mapping.
- `PrismaEvidenceStore.findArtifactGraphForLane(laneId)` should become the graph read/query owner.
- `ColdChainService.ingestLaneReadings(...)` should validate profile context, persist readings, and trigger excursion detection.
- `ColdChainService.detectExcursions(...)` should classify windows against fruit thresholds and create excursion records.

### Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `creates link graph without duplicate edges` - additive lineage works.
  - `rejects cycle-forming link` - DAG invariant fails closed.
  - `verifies subgraph integrity from stored hashes` - tampering is detected.
- `test/evidence.e2e-spec.ts`
  - `GET /lanes/:id/evidence/graph returns connected DAG` - HTTP graph contract.
  - `GET /evidence/:id/verify returns failed node data` - integrity result surfaces.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `ingests lane readings and stores them` - persistence baseline.
  - `detects chilling and heat excursions` - two-sided threshold logic.
  - `computes shelf life impact from excursions` - domain impact math.
- `test/cold-chain.e2e-spec.ts`
  - `POST /lanes/:id/temperature accepts JSON readings` - ingestion route works.
  - `POST /lanes/:id/temperature accepts CSV upload` - batch import path works.
  - `GET /lanes/:id/temperature returns chartable series` - retrieval contract.

### Decision Completeness
- Goal:
  - determine whether Tasks 11 and 14 can progress in parallel with low merge risk.
- Non-goals:
  - choosing the exact implementation details of either task.
  - starting a branch or worktree.
- Success criteria:
  - identify concrete write-scope separation.
  - identify real conflict points, not speculative ones.
  - provide an operational recommendation: parallel yes/no and under what constraints.
- Public interfaces:
  - Task 11: evidence graph endpoint(s) and graph DTOs.
  - Task 14: lane temperature ingestion/query endpoint(s), additive schema, and excursion DTOs.
- Edge cases / failure modes:
  - If Task 14 also chooses to create `TEMP_DATA` evidence artifacts on every ingest, it will overlap with Task 11 in `src/modules/evidence/*`.
  - If Task 11 needs new lineage columns or new graph metadata in Prisma, it will overlap with Task 14 in `prisma/schema.prisma`.
  - If both tasks edit lane detail DTOs/controller payloads simultaneously, merge conflicts are likely but shallow.
- Rollout & monitoring:
  - Prefer two worktrees with explicit file ownership.
  - Merge the schema-owning branch first if both require Prisma changes.
  - Watch for API-contract drift in lane detail and evidence graph endpoints.
- Acceptance checks:
  - `git diff --name-only` per worktree shows mostly disjoint file sets.
  - task-scoped unit/e2e commands stay green independently.
  - integrator rerun after merge: `npm run db:generate && npm run lint && npm run typecheck && npm test && npm run build`.

### Dependencies
- Task 11 depends on current Evidence module from Task 10 and existing `artifact_links`.
- Task 14 depends on current ColdChain module from Task 13 and Lane module from Task 6/7.
- Both rely on additive Prisma evolution if schema changes are needed.

### Validation
- Verify actual merged file locations under `main`.
- Verify current module wiring:
  - `EvidenceModule` is fully wired with controller/store/service/providers.
  - `ColdChainModule` is wired and injected into `LaneModule`.
- Verify current schema:
  - evidence tables already exist.
  - fruit profile table exists.
  - temperature/excursion tables do not yet exist.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceService.getLaneGraph()` | `GET /lanes/:id/evidence/graph` | `src/modules/evidence/evidence.controller.ts`, `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `artifact_links` |
| `PrismaEvidenceStore.findArtifactGraphForLane()` | called by `EvidenceService.getLaneGraph()` | `src/modules/evidence/evidence.module.ts` provider | `artifact_links` plus `evidence_artifacts` |
| `ColdChainService` ingestion methods | likely `POST /lanes/:id/temperature` and related reads | `src/modules/cold-chain/cold-chain.controller.ts`, `src/modules/cold-chain/cold-chain.module.ts` | new `temperature_readings`, `excursions` tables |
| Lane temperature routes | lane-scoped HTTP endpoints | probably `ColdChainController` under `AppModule` wiring | `lanes`, new temperature tables |
| Task 14 migration | Prisma migrate flow | `npm run db:migrate` | additive temperature tables only |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript in this repo.

### Decision-Complete Checklist
- No open architectural unknown remains about the main file ownership split.
- Public API surfaces likely to move are named.
- Each risky behavior has an associated test surface.
- Shared schema ownership is explicitly called out.
- Wiring verification covers both module entry points and schema touchpoints.

## Plan Draft B

### Overview
Treat Task 11 and Task 14 as effectively serial because both are likely to feed Task 25 and both may want to reshape lane detail payloads, evidence graph contracts, and temperature evidence behavior. This avoids integration churn at the cost of slower throughput.

### Files To Change
- Execute Task 11 first in:
  - `src/modules/evidence/*`
  - `test/evidence.e2e-spec.ts`
  - optional `prisma/schema.prisma` if graph metadata expands.
- Execute Task 14 second after Task 11 merges:
  - `src/modules/cold-chain/*`
  - `src/modules/lane/*` if lane detail exposes temperature summaries
  - `prisma/schema.prisma`
  - `test/cold-chain.e2e-spec.ts`

### Implementation Steps
1. Land Task 11 to stabilize evidence graph DTOs and lineage semantics.
2. Update Task 25 contract assumptions if needed.
3. Then land Task 14 against the settled evidence/lane shape.
4. Avoid any concurrent schema work.

### Test Coverage
- Same test groups as Draft A, but executed in series to reduce rebasing and merged-tree failures.

### Decision Completeness
- Goal:
  - minimize merge and contract churn, even if some parallelism is left unused.
- Non-goals:
  - maximizing throughput.
- Success criteria:
  - no overlapping backend schema edits land concurrently.
  - lane detail and Task 25 contract work stay stable.
- Public interfaces:
  - same as Draft A.
- Edge cases / failure modes:
  - slower critical-path progress.
  - Task 14 may wait unnecessarily on evidence work it does not truly depend on.
- Rollout & monitoring:
  - one branch at a time.
  - no dual-worktree integration burden.
- Acceptance checks:
  - each task lands cleanly from `main` without rebase conflict.

### Dependencies
- same dependency graph as Draft A, but executed conservatively.

### Validation
- rely on merged-tree stability rather than pre-planned ownership rules.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Task 11 graph components | evidence HTTP routes | `EvidenceModule` wiring | evidence tables only |
| Task 14 cold-chain components | cold-chain / lane temperature HTTP routes | `ColdChainModule` and possible `LaneModule` consumers | temperature tables plus `lanes` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript.

### Decision-Complete Checklist
- Serial approach removes most unresolved merge questions.
- Public interfaces are still the same, only the rollout changes.

## Comparative Analysis & Synthesis

### Strengths
- Draft A preserves throughput and matches the real module split: evidence vs cold-chain.
- Draft B minimizes coordination cost and schema conflict risk.

### Gaps
- Draft A depends on disciplined ownership; without it, Prisma and lane DTO conflicts are likely.
- Draft B sacrifices speed even though the codebase already separates the two domains reasonably well.

### Trade-Offs
- Draft A is ownership-driven parallelism.
- Draft B is safety-driven serialization.
- The real decision turns on whether Task 14 is allowed to stay out of `src/modules/evidence/*`.

### Compliance Check
- Both drafts respect the lane-centric and module-boundary rules from `AGENTS.md` and `CLAUDE.md`.
- Draft A better leverages the existing module structure.
- Draft B is safer if requirements are still fuzzy around `TEMP_DATA` evidence integration.

## Unified Execution Plan

### Overview
Tasks 11 and 14 can be run in parallel, but only as a controlled parallel pair, not as zero-overlap streams. The existing codebase gives a clean primary split: Task 11 is evidence-module work around `artifact_links`, while Task 14 is cold-chain ingestion and new temperature persistence. The two real collision points are Prisma schema ownership and any decision to treat temperature ingestion as an evidence-artifact workflow.

### Files To Change
- Task 11 preferred ownership:
  - `src/modules/evidence/evidence.service.ts`
  - `src/modules/evidence/evidence.pg-store.ts`
  - `src/modules/evidence/evidence.types.ts`
  - `src/modules/evidence/evidence.controller.ts`
  - `src/modules/evidence/evidence.service.spec.ts`
  - `test/evidence.e2e-spec.ts`
- Task 14 preferred ownership:
  - `src/modules/cold-chain/cold-chain.service.ts`
  - `src/modules/cold-chain/cold-chain.pg-store.ts`
  - `src/modules/cold-chain/cold-chain.controller.ts`
  - `src/modules/cold-chain/cold-chain.types.ts`
  - `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `test/cold-chain.e2e-spec.ts`
  - `prisma/schema.prisma`
  - one new `prisma/migrations/*`
- Shared / coordinator-owned if necessary:
  - `src/modules/lane/lane.types.ts`
  - `src/modules/lane/lane.service.ts`
  - `src/modules/lane/lane.controller.ts`
  - `docs/frontend-backend-contract-task-25.md` or Task 25 contract references, if response shapes shift

### Implementation Steps
1. TDD sequence for Task 11:
   1) add failing graph traversal / cycle / integrity tests.
   2) confirm current `getLaneGraph()` and store behavior are insufficient.
   3) implement the smallest graph-aware evidence changes.
   4) refactor graph DTO mapping if needed.
   5) run focused evidence unit/e2e and then backend gates.
2. TDD sequence for Task 14:
   1) add failing ingestion / excursion / shelf-life tests.
   2) confirm cold-chain module lacks lane temperature endpoints and persistence.
   3) implement the smallest cold-chain/store/controller/schema changes.
   4) refactor only after green.
   5) run focused cold-chain unit/e2e and then backend gates.
3. Coordination rules:
   - One task owns `prisma/schema.prisma`; do not edit it concurrently.
   - Task 14 should not touch `src/modules/evidence/*` unless the requirement is explicitly “every temperature ingest also becomes a `TEMP_DATA` evidence artifact”.
   - Task 11 should avoid `src/modules/lane/*` beyond read-only use of existing lane/checkpoint relations.
4. Integration order:
   - If only Task 14 changes Prisma, either branch can merge first.
   - If both need Prisma, schema owner merges first; the second task rebases and reruns gates.

### Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `returns connected lane graph with nodes and edges` - traversal works.
  - `rejects cycle-forming link creation` - DAG invariant enforced.
  - `flags tampered artifact during integrity verification` - fail closed.
- `test/evidence.e2e-spec.ts`
  - `GET /lanes/:id/evidence/graph returns graph visualization payload` - endpoint contract.
  - `GET /evidence/:id/verify reports invalid node hashes` - integrity API.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `stores lane readings from batch payload` - ingestion baseline.
  - `classifies excursions at boundary severities` - matrix coverage.
  - `computes remaining shelf life after cumulative impact` - SLA math.
- `test/cold-chain.e2e-spec.ts`
  - `POST /lanes/:id/temperature ingests readings` - route wiring.
  - `GET /lanes/:id/temperature returns time-series data` - chart contract.
  - `CSV upload rejects malformed rows fail closed` - ingestion safety.

### Decision Completeness
- Goal:
  - determine whether 11 and 14 are parallel-safe and define the constraints that make them safe.
- Non-goals:
  - finalize every DTO or schema field of either task.
- Success criteria:
  - clear recommendation on parallelism.
  - explicit file ownership map.
  - explicit list of shared conflict points.
- Public interfaces:
  - Task 11: evidence graph response(s), integrity verification response(s).
  - Task 14: lane temperature ingest/list endpoints, additive temperature schema.
- Edge cases / failure modes:
  - fail closed on graph tampering in Task 11.
  - fail closed on malformed temperature payloads / unsupported CSV rows in Task 14.
  - if Task 14 is expanded to auto-create `TEMP_DATA` evidence artifacts, it stops being cleanly parallel and should be coordinated with Task 11.
- Rollout & monitoring:
  - use separate worktrees.
  - define schema owner up front.
  - merge task with schema changes first when both touch Prisma.
  - rerun full backend gates after the second branch rebases.
- Acceptance checks:
  - task-local focused tests pass in each worktree.
  - merged-tree gates pass after rebase:
    - `npm run db:generate`
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`
    - `npm run build`

### Dependencies
- Current merged `main` already has:
  - Evidence module wired through `EvidenceModule`
  - graph endpoint stub via `EvidenceService.getLaneGraph()`
  - cold-chain profiles and lane cold-chain config validation
  - no persisted temperature/excursion models yet

### Validation
- Verified real merged file ownership via `git show main:...`.
- Verified current schema already contains:
  - `evidence_artifacts`
  - `artifact_links`
  - `fruit_profiles`
  - no `temperature_readings` / `excursions` models
- Verified lane module imports `ColdChainModule`, but evidence module does not import cold-chain.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceController` graph routes | `GET /lanes/:id/evidence/graph`, `GET /evidence/:id/verify` | `src/modules/evidence/evidence.module.ts` controllers | `evidence_artifacts`, `artifact_links` |
| `EvidenceService.getLaneGraph()` | called by `EvidenceController` | provider factory in `src/modules/evidence/evidence.module.ts` | `artifact_links` + `evidence_artifacts` |
| `ColdChainController` profile routes, future lane temperature routes | currently `/cold-chain/profiles*`, likely future `/lanes/:id/temperature*` | `src/modules/cold-chain/cold-chain.module.ts` controllers | `fruit_profiles`, future temperature tables |
| `LaneService` cold-chain config validation | lane create/update paths | provider factory in `src/modules/lane/lane.module.ts` | `lanes.cold_chain_*` fields |
| Task 14 migration | Prisma migrate path | committed migration + `npm run db:migrate` | future `temperature_readings`, `excursions` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript.

### Decision-Complete Checklist
- No open ambiguity remains about the main conflict points.
- The likely public interfaces are listed.
- Each task has concrete tests that would fail on the relevant defects.
- Validation commands are explicit.
- Wiring verification covers modules, endpoints, and schema touchpoints.
- Rollout/backout is defined in terms of worktree ownership and schema-first merge discipline.
