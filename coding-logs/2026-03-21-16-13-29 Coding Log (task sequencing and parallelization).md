# Task Sequencing And Parallelization

## Planning Context
- Date: 2026-03-21 16:13 ICT
- User request: analyze the next tasks and identify which work can run in parallel.
- Task Master snapshot used: 32 top-level tasks, 1 done, 0 in progress, 31 pending.
- Important anomaly: Task `1` is marked `done`, but all of its subtasks are still `pending`. For sequencing, treat the top-level status and dependency graph as authoritative; treat the stale subtasks as bookkeeping debt.
- Auggie semantic search was available. Direct file inspection also covered: `AGENTS.md`, `CLAUDE.md`, `package.json`, `frontend/package.json`, `src/app.module.ts`, `src/main.ts`, `prisma/schema.prisma`, `test/jest-e2e.json`, `frontend/next.config.ts`, `frontend/postcss.config.mjs`, `frontend/tsconfig.json`.

## Plan Draft A

### Overview
Prioritize the backend foundation on the critical path, while allowing the frontend design system to proceed in parallel because it is largely isolated from backend schema and service work. This minimizes downstream rework for audit, auth, and lane orchestration.

### Files To Change
- `prisma/schema.prisma`: core entity schema for tasks `2` and later `4`/`5`/`6`.
- `prisma/migrations/*`: initial migration output once schema stabilizes.
- `src/common/hashing/*`: Task `3` hashing service and tests.
- `src/common/auth/*`: future auth wiring once Task `2` lands.
- `src/common/audit/*`: future audit trail wiring once Tasks `2` and `3` land.
- `frontend/src/app/globals.css`: design tokens and theme primitives for Task `21`.
- `frontend/src/components/*`: shared design-system components for Task `21`.
- `frontend/src/app/layout.tsx`: font/theme/root shell wiring for Task `21`.
- `.github/workflows/*`: PR checks after scripts are stable enough for CI.

### Implementation Steps
1. TDD sequence:
   1) Add schema and hashing tests/stubs.
   2) Confirm migration or unit-test failures for the intended missing behavior.
   3) Implement the smallest schema and hashing changes to pass.
   4) Refactor only after the tests are green.
   5) Run fast gates: backend typecheck/lint/test, frontend lint/build where relevant.
2. Execute Task `2` first on the backend critical path:
   - Define `User`, `APIKey`, `Lane`, `Batch`, `Route`, `Checkpoint`, `EvidenceArtifact`, `ArtifactLink`, `ProofPack`, and `AuditEntry`.
   - Generate the initial migration and seed script.
3. Execute Task `3` in parallel with Task `2` where possible:
   - Implement content hashing first.
   - Then implement hash-chain computation and verification.
4. Execute Task `21` in parallel as an isolated frontend stream:
   - Tailwind/theme token setup.
   - Core UI components.
   - Layout primitives.
5. Start only Task `31.1` after commands are confirmed stable:
   - Add PR checks for existing scripts only.

### Test Coverage
- `prisma` migration validation:
  - `initial migration applies on empty database` — schema is internally consistent.
  - `seed script creates valid sample lane graph` — seed data respects FKs.
- `src/common/hashing`:
  - `hashBuffer returns deterministic sha256 digest` — same input, same hash.
  - `hashFile matches buffer hash` — streaming and in-memory agree.
  - `computeEntryHash uses deterministic field order` — chain hash is stable.
  - `verifyChain flags first tampered entry` — chain break location reported.
- `frontend/src/components`:
  - `Button renders primary and secondary variants` — base styling and props work.
  - `Modal traps focus and closes correctly` — accessibility baseline.
  - `ProgressBar renders completeness percent` — lane readiness primitive works.

### Decision Completeness
- Goal: unlock the true critical path while keeping frontend momentum.
- Non-goals: full lane CRUD, rule ingestion, analytics, or dispute workflows.
- Success criteria:
  - Task `2` produces a coherent Prisma schema plus migration.
  - Task `3` produces tested hashing utilities suitable for later audit/evidence use.
  - Task `21` produces shared frontend primitives without binding to unstable APIs.
  - Task `31.1` runs only existing stable quality gates.
- Public interfaces:
  - DB schema in `prisma/schema.prisma`.
  - Shared frontend component surface under `frontend/src/components`.
  - CI workflow commands mirroring current package scripts.
- Edge cases / failure modes:
  - Fail closed on audit/hash schema uncertainty; do not guess hash-chain shape.
  - Avoid coupling components to backend DTOs that do not exist yet.
  - Avoid CI workflows that assume Docker or Playwright before those assets exist.
- Rollout & monitoring:
  - Local/dev only for this phase.
  - Backout is revert-by-file if migration or CI config proves premature.
- Acceptance checks:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`

### Dependencies
- PostgreSQL available locally for migration verification.
- Existing NestJS module scaffolding under `src/common` and `src/modules`.
- Existing Next.js scaffold under `frontend/src/app`.

### Validation
- Prisma migration applies cleanly.
- Hashing service unit tests cover determinism and tamper detection.
- Frontend build/lint pass with the shared component library introduced.
- PR workflow mirrors real commands already passing locally.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Prisma core schema | `prisma/schema.prisma` | `prisma.config.ts` and `package.json` db scripts | `users`, `api_keys`, `lanes`, `batches`, `routes`, `checkpoints`, `evidence_artifacts`, `artifact_links`, `proof_packs`, `audit_entries` |
| `HashingService` | service methods called by evidence/audit workflows later | `src/common/hashing/hashing.module.ts`, imported by `src/app.module.ts` | N/A |
| Frontend design tokens | `frontend/src/app/layout.tsx` and app pages | `frontend/src/app/globals.css` and imported components | N/A |
| Shared UI components | Next.js route components under `frontend/src/app/*` | `frontend/src/components/*` exports | N/A |
| PR checks workflow | GitHub pull request events | `.github/workflows/pr-checks.yml` | N/A |

## Plan Draft B

### Overview
Prioritize Task `21` first because it is the cleanest standalone deliverable with the least dependency risk, while a second backend stream handles schema and hashing. This optimizes visible progress and keeps backend-critical work moving without blocking frontend implementation.

### Files To Change
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/*`
- `frontend/src/lib/*` only if token helpers are genuinely needed
- `prisma/schema.prisma`
- `src/common/hashing/*`
- `.github/workflows/pr-checks.yml`

### Implementation Steps
1. TDD sequence:
   1) Add frontend component render/accessibility tests and hashing unit tests.
   2) Confirm failures on missing exports/tokens/behaviors.
   3) Implement design tokens and core components.
   4) Implement hashing and schema changes.
   5) Add CI only after commands are exercised locally.
2. Frontend-first stream:
   - Build design tokens.
   - Build core components and layout primitives.
   - Avoid any API client or feature screen coupling.
3. Backend support stream:
   - Build hashing service.
   - Build Prisma schema.
4. Hold auth, audit, and lane work until the backend support stream is green.

### Test Coverage
- `frontend`:
  - `Card respects theme tokens` — core surfaces map to design system.
  - `StatusDot reflects success warning error` — status primitives are correct.
  - `BottomNav hides above mobile breakpoint` — responsive primitive behavior.
- `hashing`:
  - `hashString handles unicode content` — Thai and mixed content hash correctly.
  - `verifyChain succeeds for genesis-only entry` — first-entry case covered.
- `prisma`:
  - `audit entry schema preserves append-only fields` — required fields exist.

### Decision Completeness
- Goal: start the least-coupled visible deliverable while backend fundamentals advance.
- Non-goals: feature screens, auth endpoints, lane CRUD.
- Success criteria:
  - Shared components exist and are reusable by later screens.
  - Hashing and schema work do not block each other materially.
  - No frontend work depends on nonexistent APIs.
- Public interfaces:
  - Design system exports.
  - Prisma models.
  - Hashing service methods.
- Edge cases / failure modes:
  - Frontend token choices should not embed domain logic.
  - Schema work should not assume finalized API contracts.
- Rollout & monitoring:
  - No deployment impact.
  - Local gates only.
- Acceptance checks:
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `npm test`
  - `npm run typecheck`

### Dependencies
- Existing Next.js scaffold and Tailwind v4 setup.
- Existing NestJS `HashingModule` placeholder.
- Prisma already configured in package scripts.

### Validation
- Components render in the app shell without backend dependencies.
- Hashing service tests pass independently.
- Prisma schema change is internally consistent before audit/auth start.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Theme tokens | `frontend/src/app/layout.tsx` | `frontend/src/app/globals.css` | N/A |
| Core UI components | route components under `frontend/src/app/*` | `frontend/src/components/*` | N/A |
| `HashingService` | common service calls | `src/common/hashing/hashing.module.ts` | N/A |
| Core Prisma schema | migration scripts and Prisma client generation | `prisma.config.ts`, `package.json` db scripts | see Draft A tables |

## Comparative Analysis & Synthesis

### Strengths
- Draft A better protects the backend critical path and reduces rework risk for auth/audit/lane.
- Draft B gives the fastest visible product progress and keeps frontend contributors unblocked.

### Gaps
- Draft A risks underutilizing frontend bandwidth if backend work dominates attention.
- Draft B risks overvaluing visible UI progress if schema and hashing stall.

### Trade-Offs
- Draft A is dependency-optimized.
- Draft B is visibility-optimized.
- Both agree that Task `4`, `5`, and `6` are blocked on foundational backend work.

### Compliance Check
- Both drafts respect the existing scaffold.
- Both avoid inventing missing APIs or directories.
- Both follow the repo’s “extend existing structure” rule.

## Unified Execution Plan

### Overview
Use three parallel workstreams now, with a fourth optional stream once commands are stable. Treat Task Master task `21` as the official next task, but do not run it in isolation; pair it with backend foundations so the critical path continues to shrink.

### Files To Change
- `frontend/src/app/globals.css`
- `frontend/src/app/layout.tsx`
- `frontend/src/components/*`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `src/common/hashing/*`
- `.github/workflows/pr-checks.yml`

### Implementation Steps
1. TDD sequence:
   1) Add frontend component tests, hashing tests, and migration verification scaffolding.
   2) Run them to confirm red failures.
   3) Implement the smallest passing changes in each workstream.
   4) Refactor only after greens.
   5) Run fast gates per stream, then repo-level gates.
2. Start these now in parallel:
   - Stream A: Task `21` Frontend design system.
   - Stream B: Task `2` Database schema design.
   - Stream C: Task `3` SHA-256 hashing service.
3. Start this next, but only after local commands are stable:
   - Stream D: Task `31.1` PR checks workflow.
4. Do not start these yet:
   - Task `4` Audit trail: blocked by `2` and `3`.
   - Task `5` Auth/RBAC: blocked by `2`.
   - Task `6` Lane CRUD/orchestration: blocked by `2`, `4`, and `5`.
   - Most remaining frontend screens: blocked by `21` plus backend APIs.
5. Clean up Task Master bookkeeping soon:
   - Either close or re-open Task `1` subtasks so they no longer contradict the completed parent.

### Test Coverage
- `frontend/src/components/*.test.tsx`
  - `renders shared primitives with variants` — shared UI contract.
  - `supports keyboard interaction` — accessibility baseline.
- `src/common/hashing/*.spec.ts`
  - `produces deterministic hashes and verifies chains` — integrity baseline.
- `prisma` validation
  - `migration applies and seed data loads` — database baseline.
- `.github/workflows/pr-checks.yml`
  - `workflow mirrors working local commands` — CI baseline.

### Decision Completeness
- Goal: maximize parallel throughput without violating dependency order.
- Non-goals: complete feature modules or screen flows this turn.
- Success criteria:
  - At least three independent streams can progress simultaneously.
  - No started stream depends on unfinished predecessors.
  - Downstream tasks `4`, `5`, and `6` become more actionable, not less.
- Public interfaces:
  - Design system exports under `frontend/src/components`.
  - Prisma schema and migration history.
  - Hashing service method contract.
  - GitHub Actions PR workflow.
- Edge cases / failure modes:
  - If schema design churn is high, avoid merging auth/audit work against moving models.
  - If frontend components need data contracts, stop at mock-safe primitives instead.
  - If CI scripts fail locally, do not codify them in workflows yet.
- Rollout & monitoring:
  - Sequence merges so schema and hashing land before audit/auth/lane.
  - Watch for generated-client drift after Prisma changes.
- Acceptance checks:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`

### Dependencies
- Task Master dependencies:
  - Task `21` depends on `1` only and is actionable now.
  - Task `2` depends on `1` only and is actionable now.
  - Task `3` depends on `1` only and is actionable now.
  - Task `31` depends on `1` only, but only subtask `31.1` is low-risk immediately.

### Validation
- Confirm each stream passes its local gates before integration.
- Confirm `prisma generate` and migration behavior after schema changes.
- Confirm frontend app still builds with the new component exports.
- Confirm CI workflow uses commands that have already passed locally.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Task `21` design system | Next.js App Router pages | `frontend/src/app/layout.tsx`, `frontend/src/app/globals.css`, `frontend/src/components/*` | N/A |
| Task `2` schema | Prisma CLI and generated client | `prisma.config.ts`, `package.json` db scripts | core relational tables listed above |
| Task `3` hashing service | common service consumption by later modules | `src/common/hashing/hashing.module.ts`, imported by `src/app.module.ts` | N/A |
| Task `31.1` PR workflow | GitHub PR events | `.github/workflows/pr-checks.yml` | N/A |

### Decision-Complete Checklist
- No open sequencing decisions remain for the implementer.
- The immediate parallelizable tasks are named and dependency-safe.
- Blocked tasks are explicitly identified.
- Validation commands match scripts already on disk.
- Wiring verification covers each immediate workstream.
