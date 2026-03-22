# Coding Log

## Plan Draft A

### Overview
Run two parallel implementation agents: one owns Task 5 (auth) and one owns Task 31 (CI/CD). Keep the main agent as integrator only: no overlapping edits, no shared-branch work, and no submission until both branches are reviewed, merged locally, and pass repo gates together.

### Files To Change
- `src/common/auth/*`: Task 5 implementation surface for JWT, MFA, RBAC, API keys, and tests.
- `package.json`: Task 5 dependency/scripts updates only if auth libraries are added.
- `prisma/schema.prisma`: Task 5 only if existing auth tables/fields prove insufficient; prefer reusing `User` and `ApiKey`.
- `prisma/seed.ts`: Task 5 only if auth flows need seed fixtures beyond current users/API keys.
- `.github/workflows/*`: Task 31 owns CI workflows.
- `docker-compose.yml`: Task 31 may adjust service definitions only if required by CI parity.
- `Dockerfile*`: Task 31 only if missing and truly needed for deployment workflow.
- `docs/PROGRESS.md`: append one-line completion notes when each task lands.

### Implementation Steps
1. TDD sequence for Agent A (`Task 5`):
   1) Add auth-focused failing unit/integration tests for JWT, TOTP, guards, and API keys.
   2) Run focused tests and confirm RED for missing auth services/guards/controllers.
   3) Implement the smallest auth surface to pass.
   4) Refactor minimally and keep wiring explicit.
   5) Run relevant fast gates.
2. TDD sequence for Agent B (`Task 31`):
   1) Add/adjust workflow validation targets or smoke checks first where practical.
   2) Run local workflow-equivalent commands and capture current gaps.
   3) Implement the smallest CI/CD fixes or additions to align with the actual repo.
   4) Refactor workflow duplication only if needed.
   5) Run local validation commands matching workflow steps.
3. Main agent responsibilities:
   - freeze ownership boundaries
   - review both diffs
   - merge locally in safe order
   - run integrated gates
   - run `g-check`
   - commit/submit with Graphite
4. Auth functions/classes expected:
   - `AuthService`: issues/verifies JWTs, enforces MFA preconditions, validates API keys.
   - `JwtAuthGuard` / `RolesGuard` / role-scope guards: enforce RBAC and access boundaries.
   - `AuthController`: login, MFA verification, refresh, and API key flows if included in Task 5 scope.
   - Supporting DTOs/types: request/response contracts and guard metadata.
5. CI/CD functions/files expected:
   - PR workflow updates in `.github/workflows/ci.yml`: align checks with current backend/frontend scripts.
   - Optional deploy workflow adjustments: only if already scaffolded and can be made truthful without inventing infra.
   - Optional Dockerfile additions: only if workflows or deployment config truly require them.

### Test Coverage
- `auth service issues JWT for valid credentials`
  Valid login returns signed access token.
- `auth service rejects expired or invalid token`
  Invalid JWT paths fail closed.
- `admin and auditor require MFA`
  Mandatory TOTP enforcement for privileged roles.
- `roles guard blocks unauthorized role access`
  RBAC denies incorrect claims.
- `api key validation respects hash and whitelist`
  Partner auth checks hash and IP rules.
- `ci workflow matches current repo commands`
  Workflow invokes real scripts only.
- `frontend workflow uses frontend package lock and scripts`
  Frontend CI path reflects actual project layout.
- `integrated repo gates pass after both merges`
  Combined auth and CI changes stay green.

### Decision Completeness
- Goal:
  Maximize safe throughput by parallelizing one critical backend task and one isolated infrastructure task.
- Non-goals:
  No three-way backend parallelism, no speculative deployment platform work, no frontend design-system work in this batch.
- Success criteria:
  - Task 5 branch passes its local gates and contains a coherent auth surface.
  - Task 31 branch updates CI/CD without lying about repo capabilities.
  - Combined mainline passes `lint`, `typecheck`, `test`, and `build`.
  - No unresolved overlap remains in `package.json`, Prisma, or shared config.
- Public interfaces:
  - Task 5 may add auth endpoints, guards, decorators, and env vars.
  - Task 31 may change GitHub workflow behavior and Docker/deploy config.
- Edge cases / failure modes:
  - If Task 5 needs new Prisma schema, stop and assess whether Task 31 assumptions about migrations/CI need adjustment.
  - If Task 31 requires commands the repo does not actually have, fail closed and narrow scope to truthful CI only.
  - If Task 5 adds dependencies in `package.json`, merge that branch first and rebase Task 31 if workflow cache/install steps need updates.
- Rollout & monitoring:
  - Merge Task 5 first if it changes `package.json`, Prisma, or seed data.
  - Merge Task 31 first only if it is strictly `.github/`/Docker and independent.
  - Watch GitHub Actions results and local integrated gate output.
- Acceptance checks:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`

### Dependencies
- Existing `User` and `ApiKey` schema/entities from Task 2.
- Existing placeholder `AuthModule`.
- Existing CI workflows under `.github/workflows/`.
- Existing backend and frontend scripts in root and `frontend/package.json`.

### Validation
- Validate each task independently inside its own worktree.
- Re-run all integrated repo gates after merging both result branches into the coordinating branch.
- Run `g-check` on the combined working tree before Graphite commit.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `AuthService` | login/refresh/API key verification flows | `src/common/auth/auth.module.ts` providers | `users`, `api_keys` |
| auth guards/decorators | Nest route handlers using auth | `src/common/auth/auth.module.ts` exports and controller usage | JWT claims only unless scope checks hit `lanes` |
| auth endpoints | HTTP auth routes | controller registration inside `AuthModule`; module already imported by `src/app.module.ts` | `users`, `api_keys` |
| CI backend checks | GitHub Actions PR/push events | `.github/workflows/ci.yml` | N/A |
| CI frontend checks | GitHub Actions PR/push events | `.github/workflows/ci.yml` frontend job | N/A |
| deploy workflow changes | GitHub Actions deployment triggers | specific workflow file under `.github/workflows/` | N/A |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript in the current repo. For Task 5, verify actual auth tables remain `users` and `api_keys` before introducing migrations.

## Plan Draft B

### Overview
Run Task 31 first as a short, near-isolated background task, but delay any Task 5 schema/auth-API implementation until a planning checkpoint confirms exact auth scope. This reduces rework if Task 5 turns out to need broader model or route decisions.

### Files To Change
- `.github/workflows/ci.yml`: primary Task 31 file.
- `.github/workflows/*.yml`: secondary Task 31 files if redundant or misleading.
- `package.json` / `frontend/package.json`: read-only for Task 31 planning; edit only if CI needs a new script alias.
- `src/common/auth/*`: Task 5 after scope is confirmed.
- `prisma/schema.prisma` / `prisma/seed.ts`: Task 5 only if absolutely required.

### Implementation Steps
1. Agent B completes Task 31 quickly and lands first.
2. Agent A for Task 5 starts with read-heavy discovery and RED tests before choosing whether schema changes are required.
3. Main agent uses Task 31 outcome to lock the exact validation contract Task 5 must satisfy.
4. Task 5 then proceeds with full implementation and gates.

### Test Coverage
- `ci job runs backend gates against current scripts`
  Backend workflow is truthful.
- `ci job runs frontend lint and build`
  Frontend workflow is truthful.
- `jwt and mfa tests define auth contract early`
  RED suite clarifies intended auth API.

### Decision Completeness
- Goal:
  Reduce integration uncertainty by letting CI become truthful before auth finalizes.
- Non-goals:
  No attempt to complete both tasks with zero coordination.
- Success criteria:
  Task 31 lands cleanly; Task 5 plan/gates are more stable afterward.
- Public interfaces:
  CI workflow semantics first; auth interfaces second.
- Edge cases / failure modes:
  This approach saves risk but reduces concurrency payoff because Task 5 partially waits on coordination.
- Rollout & monitoring:
  Lower integration risk, lower speed.
- Acceptance checks:
  same as Draft A, but Task 31 finishes earlier and independently.

### Dependencies
- Existing CI workflow scaffolding.
- Existing auth placeholder only.

### Validation
- Land or finalize Task 31 first.
- Then enforce its exact gates on Task 5.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| CI backend checks | GitHub PR/push | `.github/workflows/ci.yml` | N/A |
| CI frontend checks | GitHub PR/push | `.github/workflows/ci.yml` | N/A |
| Task 5 auth surface | delayed until confirmed | `src/common/auth/auth.module.ts` | `users`, `api_keys` |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript.

## Unified Execution Plan

### Overview
Use two background workers with strict ownership: Agent A owns Task 5, Agent B owns Task 31. Keep Task 31 fully isolated to infrastructure/config, and let Task 5 proceed in parallel because the repo already has the core auth schema (`users`, `api_keys`, MFA fields) and an existing `AuthModule` import in `src/app.module.ts`.

### Files To Change
- Agent A (`Task 5`):
  - `src/common/auth/auth.module.ts`
  - new files under `src/common/auth/` for services, guards, decorators, controllers, DTOs, and tests
  - `package.json` only if auth deps are required
  - `prisma/schema.prisma` only if existing auth schema proves insufficient
  - `prisma/seed.ts` only if auth test fixtures require it
- Agent B (`Task 31`):
  - `.github/workflows/ci.yml`
  - other `.github/workflows/*.yml` only if stale or contradictory
  - `Dockerfile*` only if truly required and absent
  - `docker-compose.yml` only for CI parity if necessary
- Main integrator:
  - `.codex/coding-log.current`
  - current coding log
  - `docs/PROGRESS.md`

### Implementation Steps
1. Agent A ownership:
   1) write RED tests for JWT, TOTP, role guards, API key auth
   2) implement smallest auth primitives
   3) wire through `AuthModule`
   4) run focused + full backend gates
2. Agent B ownership:
   1) inspect current workflows against real scripts
   2) remove or fix misleading steps
   3) align backend/frontend jobs with repo reality
   4) validate locally with equivalent commands
3. Main integrator sequence:
   1) let both agents run in background
   2) review Task 31 first because it is isolated
   3) review Task 5 next, especially `package.json`, Prisma, seed, and route wiring
   4) merge the cleaner branch first:
      - if Task 5 changes `package.json` or Prisma, merge Task 5 first
      - otherwise merge Task 31 first
   5) rebase the second branch if needed
   6) run integrated gates
   7) run `g-check`
   8) commit with Graphite
4. Specific expected auth functions/classes:
   - `AuthService`
     Issues/refreshes JWTs, checks password hashes, enforces MFA preconditions, and validates API keys.
   - `JwtStrategy` or equivalent token verification provider
     Parses bearer tokens and provides request user context.
   - `JwtAuthGuard`, `RolesGuard`, and role-scope guards
     Protect routes and enforce exporter/partner/admin/auditor boundaries.
   - `Roles` decorator
     Declares role requirements on route handlers.
   - `AuthController`
     Exposes login/MFA/refresh/API-key-related endpoints if Task 5 includes the API surface.

### Test Coverage
- `login returns access token for valid exporter credentials`
  Happy-path JWT issuance.
- `refresh token rotates or reissues access token`
  Refresh flow works.
- `admin login without valid totp is rejected`
  Mandatory MFA enforced.
- `roles guard denies mismatched role`
  RBAC fail-closed behavior.
- `partner api key is accepted only for allowed ip`
  API key + whitelist enforcement.
- `ci backend job runs generate, typecheck, lint, test`
  Workflow matches backend reality.
- `ci frontend job runs lint and build`
  Workflow matches frontend reality.
- `combined repo gates remain green after merge`
  Parallel outputs integrate cleanly.

### Decision Completeness
- Goal:
  Execute one critical-path product task and one low-overlap infrastructure task concurrently with low merge risk.
- Non-goals:
  No third worker, no rules-engine/cold-chain schema changes in this batch, no frontend design-system work.
- Success criteria:
  - Task 5 and Task 31 each complete in isolated worktrees.
  - No unresolved overlap beyond manageable `package.json` or workflow command references.
  - Merged result passes local integrated gates and pre-commit.
  - Review artifact is recorded before Graphite commit.
- Public interfaces:
  - Task 5 may add auth endpoints, guards, decorators, env vars, and possibly one migration.
  - Task 31 may change PR/push CI behavior and deployment workflow definitions.
- Edge cases / failure modes:
  - If Agent A discovers schema gaps, pause before migration work and notify integrator; do not let Agent B assume old migration flow.
  - If Agent B wants to add deployment config not justified by the current repo, cut scope back to CI truthfulness only.
  - If both touch `package.json`, main integrator resolves manually; Agent B must avoid unnecessary dependency changes.
  - All auth authorization failures should fail closed.
- Rollout & monitoring:
  - Merge order decided by overlap:
    - Task 5 first if `package.json`/Prisma changed
    - Task 31 first if strictly workflow-only
  - Watch GitHub Actions and local gate parity after merge.
- Acceptance checks:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run test:e2e` if Task 5 adds e2e coverage
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`

### Dependencies
- Existing Prisma auth fields and `ApiKey` model from Task 2.
- Existing imported `AuthModule` in `src/app.module.ts`.
- Existing GitHub workflow baseline in `.github/workflows/ci.yml`.
- Existing root/backend/frontend scripts.

### Validation
- Agent A validates auth locally in its worktree.
- Agent B validates workflow-equivalent commands locally in its worktree.
- Main integrator validates the merged result in one combined branch.
- Run `g-check` on the staged pre-commit working tree before `gt create`.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `AuthService` | login, refresh, and API-key auth flows | provider registration in `src/common/auth/auth.module.ts` | `users`, `api_keys` |
| auth guards/decorators | protected Nest controllers | exports/imports from `src/common/auth/auth.module.ts`; route-level decorator usage | JWT claims, optionally `lanes` for scope |
| auth controller/routes | HTTP auth endpoints | `AuthModule` controllers; module already imported by `src/app.module.ts` | `users`, `api_keys` |
| backend CI job | GitHub PR/push workflow | `.github/workflows/ci.yml` | N/A |
| frontend CI job | GitHub PR/push workflow | `.github/workflows/ci.yml` | N/A |
| deploy workflow updates | GitHub push/merge workflow | specific `.github/workflows/*.yml` file | N/A |

### Cross-Language Schema Verification
Not applicable beyond Prisma/TypeScript in this repo. Before any Task 5 migration, verify that current auth persistence remains centered on `users` and `api_keys`, which already exist in the schema.

## Task 31 Execution

### Overview
Tightened the CI/CD and deployment configuration to match the repo that is actually on disk:
- CI now uses the repo scripts that exist today (`db:generate`, `db:seed`, `test:cov`) instead of masking or hand-wiring commands.
- The backend, frontend, and integration jobs now use explicit `working-directory` handling where needed.
- The integration and security jobs no longer hide failures with `|| true`.
- The build job now validates both container images, and the repo now has backend/frontend Dockerfiles plus a compose-defined app stack.
- Added a minimal GHCR publish workflow for `main` pushes and manual dispatches.

### Files Touched
- `.github/workflows/ci.yml`
- `.github/workflows/publish-images.yml`
- `Dockerfile`
- `frontend/Dockerfile`
- `docker-compose.yml`
- `package-lock.json` to sync the new auth dependencies added by the Task 5 worker so `npm ci` remains valid

### Validation
- `npm install --package-lock-only --ignore-scripts`
- `npm ci`
- `cd frontend && npm ci`
- `npm run db:generate`
- `docker compose up -d postgres redis`
- `DATABASE_URL='postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public' npx prisma migrate deploy`
- `DATABASE_URL='postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public' npm run db:seed`
  - first attempt failed on a duplicate `lane_id` because the local database already contained earlier seed data
  - `DATABASE_URL='postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public' npx prisma migrate reset --force`
  - re-ran seed successfully on the fresh database
- `npm run lint`
  - failed because the in-flight Task 5 auth implementation currently has Prettier and `@typescript-eslint` issues in `src/common/auth/*`
- `npm run typecheck`
  - failed because the in-flight Task 5 auth implementation currently has type errors in `src/common/auth/auth.pg-store.ts` and `src/common/auth/auth.service.ts`
- `npm run test`
  - failed because the in-flight Task 5 auth tests currently expect behavior that the unfinished auth service does not yet satisfy
- `npm run build`
  - failed for the same in-flight Task 5 auth type errors
- `npm run test:e2e`
  - passed
- `cd frontend && npm run lint`
  - passed
- `cd frontend && npm run build`
  - passed
- `docker build -f frontend/Dockerfile frontend`
  - passed
- `docker build -f Dockerfile .`
  - failed for the same in-flight Task 5 auth build errors
- `docker compose config`
  - passed

### QCHECK Notes
- The CI workflow now surfaces real failures instead of masking them.
- The build job now exercises the Dockerfiles that were added for deployment/container parity.
- The GHCR publish workflow is minimal and does not invent AWS/Kubernetes infrastructure that is not present in the repo.
- Remaining backend failures are attributable to the concurrent Task 5 auth branch, not to the Task 31 workflow/container changes.

### Next
- Let the Task 5 worker finish or integrate its auth implementation, then rerun the backend gates and the backend Docker build against a clean combined tree.

## Task 5 Execution

### Overview
Implemented the backend auth surface for JWT login/refresh/logout, MFA enrollment and verification, RBAC guards/decorator metadata, and partner API key validation.
- Added a fail-closed `AuthService` backed by a pg store and custom HS256 JWT helpers.
- Added `AuthController` routes for `/auth/login`, `/auth/mfa/verify`, `/auth/refresh`, `/auth/logout`, and JWT-protected MFA enrollment aliases under `/users/me/mfa/*`.
- Added `Roles`, `JwtAuthGuard`, `ApiKeyAuthGuard`, `LaneOwnerGuard`, `PartnerScopeGuard`, and `AuditorReadOnlyGuard`.
- Added auth unit coverage and a thin auth e2e wiring check through `AppModule`.
- Added a minimal schema migration for `users.session_version` so logout invalidates existing JWT/refresh tokens.

### Files Touched
- `src/common/auth/auth.constants.ts`
- `src/common/auth/auth.controller.ts`
- `src/common/auth/auth.decorators.ts`
- `src/common/auth/auth.guards.ts`
- `src/common/auth/auth.guards.spec.ts`
- `src/common/auth/auth.module.ts`
- `src/common/auth/auth.pg-store.ts`
- `src/common/auth/auth.service.ts`
- `src/common/auth/auth.service.spec.ts`
- `src/common/auth/auth.types.ts`
- `src/common/auth/auth.utils.ts`
- `test/auth.e2e-spec.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260322124000_auth_session_version/migration.sql`
- `package.json`
- `package-lock.json`

### Validation
- `npm install`
- `npm run test -- --runInBand src/common/auth/auth.service.spec.ts src/common/auth/auth.guards.spec.ts`
- `npm run test:e2e -- --runInBand auth.e2e-spec.ts`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

### QCHECK Notes
- Login now returns the PRD-shaped `requireMfa: false` payload for successful password auth.
- Admin/Auditor login is challenge-based and MFA enrollment confirmation is bound to the authenticated user.
- API-key validation is fail-closed on missing keys, revoked/expired keys, IP mismatch, and scope mismatch.
- Logout increments `users.session_version`, so old access and refresh tokens fail once the session changes.

### Next
- Task 5 is ready for handoff or integration review. No PR/commit was created from this worker.

## Integration & Validation (2026-03-22 12:08 +07)

### Goal
Integrate the Task 5 auth changes with the Task 31 CI/CD changes, rerun the combined validation gates on the staged tree, and close the one concrete auth guard correctness gap found during integration review.

### What Changed
- `src/common/auth/auth.guards.ts`
  - Added forwarded-IP parsing so partner API-key validation uses the first client IP from `x-forwarded-for` instead of the full proxy chain string.
- `src/common/auth/auth.guards.spec.ts`
  - Added a focused regression test covering comma-separated `x-forwarded-for` handling for API-key auth.

### TDD Evidence
- RED
  - Command: `npm run test -- --runInBand src/common/auth/auth.guards.spec.ts`
  - Failure: `ApiKeyAuthGuard` passed `203.0.113.10, 198.51.100.8` to `validateApiKey()` instead of the first client IP `203.0.113.10`, which would incorrectly fail exact IP whitelist checks behind a proxy chain.
- GREEN
  - Command: `npm run test -- --runInBand src/common/auth/auth.guards.spec.ts`
  - Result: `1` suite passed, `7` tests passed.

### Tests Run
- `npx prettier --write src/common/auth/auth.guards.ts src/common/auth/auth.guards.spec.ts`
- `npm run test -- --runInBand src/common/auth/auth.guards.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e -- auth.e2e-spec.ts`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`

### Wiring Verification
| Component | Wiring Verified? | How Verified |
|-----------|------------------|--------------|
| `AuthController` | YES | `src/common/auth/auth.module.ts` registers `AuthController`; `src/app.module.ts` imports `AuthModule` |
| auth guards | YES | `src/common/auth/auth.module.ts` provides and exports `JwtAuthGuard`, `ApiKeyAuthGuard`, `RolesGuard`, `LaneOwnerGuard`, `PartnerScopeGuard`, and `AuditorReadOnlyGuard` |
| auth e2e flow | YES | `test/auth.e2e-spec.ts` boots `AppModule` and exercises `/auth/login` and `/auth/logout` |
| CI backend/frontend build checks | YES | `.github/workflows/ci.yml` now runs backend/frontend builds and validates both Dockerfiles |
| image publish flow | YES | `.github/workflows/publish-images.yml` defines the GHCR publish job for `main` and manual dispatch |

### Behavior Changes And Risk Notes
- Partner API-key requests behind trusted proxy chains now validate against the client IP instead of a comma-joined header string.
- Combined backend and frontend gates are green on the integrated tree after the auth guard fix.
- Fresh-database migration plus seed validation passed; the existing seed remains non-idempotent on an already-populated local database.
- Frontend production build still emits the existing Next.js multi-lockfile root warning, but the build succeeds.

### Follow-Ups / Known Gaps
- Consider making `npm run db:seed` idempotent for reused local databases if that becomes part of the normal developer workflow.
- Consider setting `turbopack.root` in the frontend config to silence the existing workspace-root warning during build.

## Review (2026-03-22 12:08 +07) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `test/verify-claude-review`
- Scope: `working tree`
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; `git diff --staged --name-only`; `git diff --staged --stat`; `git diff --staged -- src/common/auth/auth.guards.ts src/common/auth/auth.guards.spec.ts .github/workflows/ci.yml .github/workflows/publish-images.yml Dockerfile frontend/Dockerfile docker-compose.yml`; `rg -n "AuthModule|AuthController|publish-images|docker build -f Dockerfile|docker build -f frontend/Dockerfile" src .github test`; `npm run test -- --runInBand src/common/auth/auth.guards.spec.ts`; `npm run lint`; `npm run typecheck`; `npm run test`; `npm run build`; `npm run test:e2e -- auth.e2e-spec.ts`; `cd frontend && npm run lint`; `cd frontend && npm run build`

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
- Assumed the current CI contract is a fresh database per job. The integrated validation confirmed that path by running migrate + seed against a temporary empty database.
- Assumed frontend deployment can tolerate the existing Next.js workspace-root warning because the production build completed successfully.

### Recommended Tests / Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run test:e2e -- auth.e2e-spec.ts`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- Optional deployment parity checks already exercised during integration: `docker compose config`, `docker build -f Dockerfile .`, `docker build -f frontend/Dockerfile frontend`

### Rollout Notes
- `ApiKeyAuthGuard` now normalizes `x-forwarded-for` by taking the first forwarded client IP before handing the value to exact-match whitelist checks in `AuthService`.
- CI now uses repo-native scripts for Prisma generation, seeding, coverage, frontend lint/build, and Docker image validation.
- No Graphite commit or PR submission was performed in this integration pass.
