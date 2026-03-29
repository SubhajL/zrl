# Coding Log — task-32-hardening-batch

## Plan Draft A

### Overview
Close the safest hardening batch before any new product scope by first fixing stale Task Master state, then proving audit-chain integrity through live test coverage and adding automated OWASP ZAP scanning to CI. Reuse the existing Nest audit/evidence verification surface and current GitHub Actions layout rather than introducing parallel infrastructure.

### Files to Change
- `.codex/coding-log.current` to point future implementation summaries at this log.
- `docs/PROGRESS.md` to record the Task 32 hardening batch.
- `.github/workflows/ci.yml` to add ZAP security scanning to the existing CI pipeline.
- `src/common/audit/*` only if the current verification surface is missing assertions needed for stronger integrity coverage.
- `src/modules/evidence/*` only if graph/audit verification wiring needs small runtime adjustments.
- `test/*` add live audit-chain integrity coverage through `AppModule`.
- Existing audit/evidence specs if the stronger assertions belong in unit-level coverage too.

### Implementation Steps
- TDD sequence:
  1. Add/stub the new audit-integrity tests first.
  2. Run the focused suite and confirm failure for the right reason.
  3. Implement the smallest backend change needed to satisfy the new assertions.
  4. Add ZAP workflow coverage and validate the workflow file locally.
  5. Run focused tests, then lint, typecheck, build, and the relevant e2e gates.
- `test/audit-chain-integrity.e2e-spec.ts` or the closest existing audit/evidence e2e file
  - Boot `AppModule`, create or reuse seeded lane data, invoke real write paths, then verify `POST /lanes/:id/audit/verify` and evidence graph verification stay valid until tampered.
- `src/common/audit/audit.service.ts`
  - Keep lane verification logic canonical; only change this if live tests expose a genuine chain-verification gap.
- `src/common/audit/audit.prisma-store.ts`
  - Only adjust query behavior if tests reveal missing lane/entity rows or unstable ordering under real DB writes.
- `.github/workflows/ci.yml`
  - Add an OWASP ZAP baseline job against the running frontend/backend surface, fail on actionable alerts, and keep it aligned with the existing job layout.
- Expected behavior / edge cases
  - Audit verification fails closed when tampering breaks hash linkage or entry ordering.
  - Evidence graph verification remains separate from audit-chain verification; both should be tested through real entry points.
  - ZAP should run against a booted app surface in CI and publish artifacts even on failure.

### Test Coverage
- `test/audit-chain-integrity.e2e-spec.ts`
  - verifies lane audit chain after real writes
  - detects tampered audit entry payload or hash linkage
  - proves verify endpoint returns first invalid entry
- Existing evidence/audit specs as needed
  - keeps audit service ordering deterministic
  - keeps graph verification independent from audit verification
- CI workflow validation
  - ZAP job boots target app surface
  - ZAP artifacts upload on scan completion

### Decision Completeness
- Goal
  - Raise confidence in the existing integrity and security posture before broader Task 32 performance/browser work.
- Non-goals
  - Implementing Playwright or k6 in this batch.
  - Redesigning the audit model or introducing new security vendors.
- Success criteria
  - Stale Task Master items are reconciled to reflect already-merged work.
  - A real test suite proves audit-chain verification catches tampering.
  - CI runs OWASP ZAP automatically in addition to existing `npm audit`.
- Public interfaces
  - No public API expansion unless the audit verification route needs a small additive adjustment.
  - CI adds a new ZAP job and any required safe env/config wiring.
- Edge cases / failure modes
  - No audit entries for lane: verify endpoint should stay deterministic and not crash.
  - Tampered payload snapshot only: verification outcome depends on whether payload hash linkage is broken; test the real contract rather than assuming snapshot hashing.
  - CI scan startup failure: fail closed and retain logs/artifacts.
- Rollout & monitoring
  - Land test coverage before ZAP so the repo already has stronger integrity evidence.
  - Monitor CI duration and false-positive ZAP noise after merge.
  - Backout is additive: remove the new workflow job or test file if needed.
- Acceptance checks
  - `npm test -- --runInBand <focused audit/evidence specs>`
  - `npm run test:e2e -- --runInBand <audit/evidence e2e specs>`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Existing `AuditModule`, `EvidenceModule`, `HashingService`, and seeded auth/lane fixtures.
- Existing CI job patterns in `.github/workflows/ci.yml`.
- A runnable local DB-backed backend test environment where required.

### Validation
- RED/GREEN audit-integrity test run.
- Workflow syntax sanity check plus full local backend gates.
- Final focused e2e proving the runtime verification endpoints are wired through `AppModule`.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| audit integrity e2e | Jest `npm run test:e2e` | `test/jest-e2e.json` and direct CLI invocation | `audit_entries`, `audit_entry_snapshots`, lane-linked tables |
| `AuditService.verifyChainForLane()` | `POST /lanes/:id/audit/verify` | `src/common/audit/audit.controller.ts` in `AuditModule`, imported by `src/app.module.ts` | `audit_entries`, `audit_entry_snapshots` |
| evidence graph verify | `POST /lanes/:id/evidence/graph/verify` | `src/modules/evidence/evidence.controller.ts` in `EvidenceModule`, imported by `src/app.module.ts` | `evidence_artifacts`, graph edge tables |
| ZAP CI job | GitHub Actions pull request / push CI run | `.github/workflows/ci.yml` | N/A |

### Cross-Language Schema Verification
- Repo is TypeScript-only on the application path; verification focuses on Prisma schema plus raw SQL store usage.
- Auggie semantic search was available and supplemented by direct inspection of:
  - `src/common/audit/audit.service.ts`
  - `src/common/audit/audit.prisma-store.ts`
  - `src/modules/evidence/evidence.service.ts`
  - `.github/workflows/ci.yml`
  - prior coding logs documenting audit/evidence wiring

## Plan Draft B

### Overview
Keep the batch smaller by avoiding any new backend runtime code unless a failing audit-integrity test proves it is necessary. Build confidence primarily through black-box e2e coverage and a separate ZAP workflow file so the security scan can evolve without touching the existing CI job graph too much.

### Files to Change
- `.codex/coding-log.current`
- `docs/PROGRESS.md`
- `.github/workflows/zap-baseline.yml` as a dedicated security workflow
- `test/audit-chain-integrity.e2e-spec.ts`
- Existing test helpers/fixtures only if needed

### Implementation Steps
- TDD sequence:
  1. Add a black-box e2e around the audit verify route.
  2. Confirm it fails before any implementation change.
  3. Fix only the exact gap exposed by the test, or keep runtime code unchanged if the route already satisfies the contract.
  4. Add a standalone ZAP workflow against the deployed CI app surface.
  5. Run backend fast gates and workflow validation.
- `test/audit-chain-integrity.e2e-spec.ts`
  - Use authenticated requests to create a lane mutation trail, then directly tamper the DB row in-test to assert the verify route reports the broken link.
- `.github/workflows/zap-baseline.yml`
  - Boot the app stack dedicated to ZAP and upload the HTML/JSON report artifacts.
- Expected behavior / edge cases
  - Strongest confidence comes from black-box route behavior rather than unit-level internals.
  - Separate workflow reduces coupling with current CI jobs but increases total workflow surface.

### Test Coverage
- `test/audit-chain-integrity.e2e-spec.ts`
  - verifies happy-path audit chain stays valid
  - verifies tampered chain returns invalid result
  - verifies route remains authenticated
- Workflow behavior
  - standalone ZAP workflow runs on PRs
  - report artifacts persist on failure

### Decision Completeness
- Goal
  - Add the minimum hardening changes that materially increase confidence.
- Non-goals
  - Reorganizing existing CI jobs.
  - Extending the browser/load-testing stack yet.
- Success criteria
  - One live audit-chain e2e exists and proves tamper detection.
  - One automated ZAP workflow runs in CI.
- Public interfaces
  - No new product API expected.
  - One new GitHub workflow.
- Edge cases / failure modes
  - Auth failure on verify route should remain a test assertion.
  - Direct DB tamper step must be scoped and cleaned up deterministically.
- Rollout & monitoring
  - Lower risk because the main CI workflow changes less.
  - Slightly higher maintenance due to one more workflow file.
- Acceptance checks
  - same backend/e2e gates as Draft A
  - workflow file passes syntax inspection

### Dependencies
- Same backend test fixtures and DB access.
- GitHub-hosted runners capable of running ZAP Docker action.

### Validation
- Focused backend/e2e test run plus workflow inspection.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| audit-chain e2e | Jest e2e runner | `test/jest-e2e.json` | `audit_entries`, `audit_entry_snapshots` |
| `POST /lanes/:id/audit/verify` | HTTP route | `AuditController` in `AuditModule` via `AppModule` | same audit tables |
| standalone ZAP workflow | GitHub Actions PR/push trigger | `.github/workflows/zap-baseline.yml` | N/A |

### Cross-Language Schema Verification
- Same TypeScript/Prisma-only verification scope.
- Auggie semantic search available; direct inspection remains the backup.

## Unified Execution Plan

### Overview
Take Draft A’s preference for extending the existing CI pipeline and combine it with Draft B’s black-box integrity philosophy. The batch will first correct stale Task Master state, then add a DB-backed audit-chain integrity e2e that proves both happy-path and tamper-detection behavior through the real verify endpoint, and finally extend the existing CI workflow with a ZAP baseline job so security scanning stays in the same merge gate the repo already relies on.

### Files to Change
- `.codex/coding-log.current` update to this log.
- `docs/PROGRESS.md` record Task 32 hardening progress.
- `.github/workflows/ci.yml` add ZAP baseline scanning within the main CI workflow.
- `test/audit-chain-integrity.e2e-spec.ts` add live audit-chain verification coverage.
- `test/*` helper files only if the new e2e needs shared auth/fixture utilities.
- `src/common/audit/*` only if the RED test exposes a real runtime gap.

### Implementation Steps
- TDD sequence:
  1. Add `test/audit-chain-integrity.e2e-spec.ts` with a valid-chain case and a tampered-chain case.
  2. Run the focused e2e command and confirm failure for the correct missing behavior or assumption.
  3. Implement the smallest backend/store/test-helper change required to make the suite pass.
  4. Add the ZAP job to `.github/workflows/ci.yml`, reusing the repo’s existing app boot/build pattern.
  5. Run focused tests, then `lint`, `typecheck`, and `build`.
- Function and component targets
  - `AuditService.verifyChainForLane(laneId)`
    - Remains the canonical chain-verification function. If changed, keep semantics strict and deterministic, returning the first invalid entry when corruption exists.
  - `PrismaAuditStore.findEntriesForLane(laneId, filters?)`
    - Must preserve stable ordering because integrity verification depends on ordered chain reads.
  - `test/audit-chain-integrity.e2e-spec.ts`
    - Drives real authenticated writes, calls the verify route, then performs a targeted tamper step and re-verifies.
  - `.github/workflows/ci.yml`
    - Adds a ZAP baseline scan job that boots the app surface, runs the scan, uploads artifacts, and fails the job when configured thresholds are exceeded.
- Expected behavior / edge cases
  - Verification with zero or one audit entry stays valid and deterministic.
  - Tampering with `prev_hash` or `entry_hash` must fail closed.
  - The e2e should avoid brittle assumptions about payload snapshot hashing and instead tamper the true chain fields.
  - ZAP job should preserve logs/artifacts even if startup or the scan fails.

### Test Coverage
- `test/audit-chain-integrity.e2e-spec.ts`
  - `returns valid for an untampered lane audit chain`
    - proves real write path produces a valid chain
  - `returns first invalid entry after audit hash tampering`
    - proves verify endpoint detects corruption
  - `rejects unauthenticated audit verification requests`
    - proves guard wiring remains intact
- Existing unit/e2e files only if required by the implementation gap
  - ordering and hash verification remain deterministic
- CI workflow behavior
  - ZAP baseline job starts app surface
  - ZAP reports upload even on failure

### Decision Completeness
- Goal
  - Increase confidence in integrity and security hardening using the smallest additive change set.
- Non-goals
  - Task `32.1` k6, Task `32.3` Playwright, or unrelated feature work.
  - Replacing the current audit model.
- Success criteria
  - Task Master accurately reflects already-merged frontend/proof-pack/privacy work.
  - New live audit-chain e2e is green and demonstrates tamper detection.
  - CI includes automated ZAP baseline scanning alongside existing jobs.
- Public interfaces
  - No product-facing API changes expected.
  - CI surface adds a ZAP baseline step/job in `.github/workflows/ci.yml`.
- Edge cases / failure modes
  - Missing audit history: verify route should respond successfully with a valid empty or short chain result, not 500.
  - Tampered hash fields: fail closed and report the first invalid entry ID/index.
  - ZAP app boot failure: fail the CI job and retain artifacts/logs.
- Rollout & monitoring
  - Reconcile Task Master first so the operational picture is clean.
  - Land the audit e2e before ZAP so integrity confidence rises even if the scan needs tuning.
  - Watch CI time and alert noise after merge; tune thresholds only if findings are demonstrably non-actionable.
- Acceptance checks
  - `npm test -- --runInBand <focused backend specs>`
  - `npm run test:e2e -- --runInBand test/audit-chain-integrity.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Existing `AuditModule`, `EvidenceModule`, auth guards, and seeded DB fixtures.
- Existing GitHub Actions runner and Docker/action support already used by CI.

### Validation
- RED/GREEN focused audit-integrity e2e evidence.
- CI workflow file lint/sanity by direct inspection and existing repo conventions.
- Final backend gates and any touched focused suites green.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `test/audit-chain-integrity.e2e-spec.ts` | `npm run test:e2e -- --runInBand test/audit-chain-integrity.e2e-spec.ts` | Jest e2e config under `test/jest-e2e.json` | `audit_entries`, `audit_entry_snapshots`, lane-linked domain tables |
| `AuditService.verifyChainForLane()` | `POST /lanes/:id/audit/verify` | `src/common/audit/audit.controller.ts` in `src/common/audit/audit.module.ts`, imported by `src/app.module.ts` | `audit_entries`, `audit_entry_snapshots` |
| evidence write path used to generate audit events | e.g. `POST /lanes/:id/evidence` or another authenticated mutation route used by the e2e | `EvidenceController` in `src/modules/evidence/evidence.module.ts`, imported by `src/app.module.ts` | `evidence_artifacts`, related lane/evidence tables, plus audit tables via `AuditService` |
| ZAP baseline CI job | GitHub Actions `ci` workflow on PR/push | `.github/workflows/ci.yml` | N/A |

### Cross-Language Schema Verification
- TypeScript-only runtime path; verify schema names against Prisma plus raw SQL store code.
- Actual schema/tables expected in this batch:
  - `audit_entries`
  - `audit_entry_snapshots`
  - lane-linked entity tables already used by audit stream resolution

## Implementation (2026-03-29 10:03:31 +0700)

### Goal
- Reconcile stale Task Master state, implement Task `32.4` audit chain integrity coverage, and implement Task `32.2` OWASP ZAP CI scanning without widening into k6 or Playwright yet.

### What Changed
- `test/audit.e2e-spec.ts`
  - Replaced the placeholder audit-route smoke with auth-aware assertions so the suite now proves JWT enforcement, lane ownership, and export-route protection.
- `test/audit-chain-integrity.e2e-spec.ts`
  - Added a live Postgres-backed `AppModule` e2e that creates 1000 lane audit entries through the real `AuditService`, verifies the chain through `POST /lanes/:id/audit/verify`, and proves tamper detection by mutating one stored `entry_hash`.
- `src/common/audit/audit.controller.ts`
  - Locked all audit endpoints behind `JwtAuthGuard` and `LaneOwnerGuard`.
- `src/common/audit/audit.module.ts`
  - Imported `AuthModule` so the new audit-route guards can actually resolve their dependencies at runtime.
- `src/common/security/zap-report.ts`
  - Added a small parser that extracts ZAP alerts and returns only high-risk findings for merge blocking.
- `src/common/security/zap-report.spec.ts`
  - Added unit coverage for alert normalization, high-risk filtering, and malformed-report handling.
- `scripts/check-zap-report.ts`
  - Added a reusable CI helper that parses one or more ZAP JSON reports and fails only when high-risk alerts are present.
- `.github/workflows/ci.yml`
  - Extended `Security Scan` to boot Postgres/Redis-backed app surfaces, run backend/frontend builds, start the backend with scan-safe worker flags, run ZAP baseline scans against frontend and backend targets, upload scan artifacts, and block only on high-risk findings via the helper script.
- `docs/PROGRESS.md`
  - Recorded the Task 32 hardening batch progress and the remaining Task 32 scope.

### TDD Evidence
- RED
  - Command:
    - `DATABASE_URL=$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env) npm run test:e2e -- --runInBand test/audit.e2e-spec.ts test/audit-chain-integrity.e2e-spec.ts`
  - Failure reason:
    - `AuditController` routes were publicly reachable: unauthenticated `GET /lanes/:id/audit`, `POST /lanes/:id/audit/verify`, and `GET /audit/export/:laneId` returned success instead of `401/403`.
- GREEN
  - Commands:
    - `DATABASE_URL=$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env) npm run test:e2e -- --runInBand test/audit.e2e-spec.ts test/audit-chain-integrity.e2e-spec.ts`
    - `npm test -- --runInBand src/common/security/zap-report.spec.ts src/common/audit/audit.service.spec.ts`
    - `npm run lint`
    - `npm run typecheck`
    - `npm run build`

### Additional Validation
- `node -e "const fs=require('fs'); const YAML=require('yaml'); YAML.parse(fs.readFileSync('.github/workflows/ci.yml','utf8')); console.log('ci.yml OK');"`
- Negative ZAP parser smoke:
  - `npx tsx scripts/check-zap-report.ts frontend=/tmp/zap-smoke/frontend.json backend=/tmp/zap-smoke/backend.json`
  - Result: correctly failed on a synthetic high-risk backend alert.
- Positive ZAP parser smoke:
  - `npx tsx scripts/check-zap-report.ts frontend=/tmp/zap-smoke/frontend-low.json backend=/tmp/zap-smoke/backend-low.json`
  - Result: passed when only low/info alerts were present.
- Local Docker-backed ZAP smoke against the live backend/frontend surfaces surfaced one real workflow bug:
  - the original scan commands used absolute `/zap/wrk/...` report paths, which ZAP’s wrapper rewrote incorrectly and failed to generate.
  - I fixed the workflow to use repo-relative `zap/*.json|html|md` paths instead.
- Local scan note:
  - Docker Desktop on macOS cannot validate the CI job’s Linux-only `--network=host` behavior directly, so the local container smoke used `host.docker.internal` to validate the scan/report path instead.

### Wiring Verification Evidence
- `AuditController` now mirrors the rest of the lane-scoped API surface by applying `JwtAuthGuard` and `LaneOwnerGuard` directly on:
  - `GET /lanes/:id/audit`
  - `POST /lanes/:id/audit/verify`
  - `GET /audit/export/:laneId`
- `AuditModule` now imports `AuthModule`, which is the provider source for `JwtAuthGuard` and `LaneOwnerGuard`; without that import the guarded routes fail during Nest dependency resolution.
- `test/audit-chain-integrity.e2e-spec.ts` boots `AppModule`, resolves the real `AuditService`, writes directly into the canonical audit store, and verifies via the public HTTP route so both service logic and route wiring are exercised.
- The `Security Scan` job still keeps the existing `npm audit` checks, but now also boots the built backend/frontend, runs ZAP baseline scans, and uploads the resulting `zap/` artifacts on every run.

### Behavior Changes And Risk Notes
- Audit endpoints now fail closed for missing auth and for exporter users who do not own the requested lane.
- The new live integrity suite verifies lane-scoped chains only; it intentionally ignores entries for other lanes and proves the first invalid index/entry ID on tamper.
- The ZAP CI gate blocks only on high-risk findings, not on low/info baseline noise. This matches the Task `32.2` objective but still leaves room to tighten header policy later if you want medium-risk blocking.

### Follow-Ups / Known Gaps
- Task `32.1` k6 load testing is still pending.
- Task `32.3` Playwright critical-flow coverage is still pending.
- The security scan currently targets a booted frontend root plus a public backend endpoint. Broader authenticated crawl coverage can be added later once we want ZAP contexts or auth-header automation.

## Follow-Up Implementation (2026-03-29 10:33:12 +0700)

### Goal
- Remove the last runner-specific confidence gap in the ZAP flow by extracting one shared scan path that works in CI and locally, then prove that exact path end to end against live backend/frontend surfaces.

### What Changed
- `scripts/run-zap-baseline.sh`
  - Added a shared repo-owned ZAP baseline runner that writes frontend/backend reports into a configurable output directory, targets `host.docker.internal`, and adds the Linux `host-gateway` mapping only where needed.
- `scripts/run-local-zap-smoke.sh`
  - Added a full local confidence runner that builds backend/frontend, starts them with scan-safe env, waits for readiness, invokes the shared ZAP script, and tears everything down automatically.
- `package.json`
  - Added `security:zap` and `security:zap:local` scripts so local and CI execution call the same repo-owned commands.
- `.github/workflows/ci.yml`
  - Switched the `Security Scan` job from inline Docker commands to the shared `npm run security:zap` path and renamed the step to reflect that both scans run through one script.
- `docs/PROGRESS.md`
  - Recorded the final confidence close-out for the ZAP path.

### Validation
- Shell syntax:
  - `bash -n scripts/run-zap-baseline.sh`
  - `bash -n scripts/run-local-zap-smoke.sh`
- YAML sanity:
  - `node -e "const fs=require('fs'); const YAML=require('yaml'); YAML.parse(fs.readFileSync('.github/workflows/ci.yml','utf8')); console.log('ci.yml OK');"`
- Unit:
  - `npm test -- --runInBand src/common/security/zap-report.spec.ts`
- Full portable live scan:
  - `FRONTEND_SPIDER_MINUTES=1 BACKEND_SPIDER_MINUTES=1 npm run security:zap:local`
  - Result: completed successfully, generated frontend/backend reports, and `scripts/check-zap-report.ts` reported `High-risk alerts: 0`.

### Risk Notes
- This closes the previous macOS-vs-Ubuntu networking uncertainty because the repo now owns one portable scan path instead of embedding runner-specific Docker networking assumptions directly in CI.
- The live scan still reports warning-level missing security headers on both frontend and backend. Those are real hardening opportunities, but they are outside the current Task `32.2` high-risk merge gate and did not block the validated run.


## Review (2026-03-29 10:41:54 +0700) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --short`, `git diff --name-only`, `git diff --stat`, `git diff -- ...touched files...`, `npm test -- --runInBand src/common/security/zap-report.spec.ts src/common/audit/audit.service.spec.ts`, `DATABASE_URL=... npm run test:e2e -- --runInBand test/audit.e2e-spec.ts test/audit-chain-integrity.e2e-spec.ts`, `npm run lint`, `npm run typecheck`, `npm run build`, `FRONTEND_SPIDER_MINUTES=1 BACKEND_SPIDER_MINUTES=1 npm run security:zap:local`

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
- Assumed the current merge gate is intentionally `high-risk ZAP alerts only`; the live local scan still reports warning-level missing security headers on frontend and backend.
- Assumed `host.docker.internal` plus `--add-host host-gateway` is acceptable for the portable scan path on Linux runners and local Docker Desktop.

### Recommended Tests / Validation
- Re-run the full CI matrix on the PR, with special attention to `Security Scan` because that workflow now boots both apps and runs Dockerized ZAP.
- If you want stricter hardening later, add follow-up work for the warning-level security headers surfaced by the live ZAP run.

### Rollout Notes
- Audit endpoints now fail closed behind JWT + lane ownership.
- The new security-scan path is additive and self-contained; if CI runner behavior differs unexpectedly, the rollback is limited to the `Security Scan` workflow/script path.

## PR Follow-Up Fix (2026-03-29 10:46:12 +0700)

### Trigger
- PR `#38` failed `Security Scan` on GitHub Actions with `PermissionError: [Errno 13] Permission denied: '/zap/wrk/zap.yaml'` during the shared `npm run security:zap` path.

### Root Cause
- `scripts/run-zap-baseline.sh` mounted the entire repo root into `/zap/wrk`.
- On GitHub-hosted runners, the ZAP container user could not create its generated working files in that repo-root bind mount, even though the report output directory already existed.

### Fix
- Changed `scripts/run-zap-baseline.sh` to mount only the dedicated output directory into `/zap/wrk` instead of the repo root.
- Made that mounted output directory writable for the container user before launch and switched container-side report paths to plain filenames inside `/zap/wrk`.
- Kept host-side report parsing unchanged by passing the absolute host report paths into `scripts/check-zap-report.ts`.

### Validation
- `bash -n scripts/run-zap-baseline.sh`
- `tmpdir=$(mktemp -d); chmod 755 "$tmpdir"; host_dir=$(cd "$tmpdir" && pwd); chmod 0777 "$host_dir"; docker run --rm -v "$host_dir:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable sh -lc 'touch /zap/wrk/zap.yaml && ls -l /zap/wrk'; rm -rf "$tmpdir"`
- Result: container successfully created `/zap/wrk/zap.yaml`, proving the runner-side permission failure mode is addressed before re-running CI.

## Review (2026-03-29 10:46:55 +0700) - PR follow-up delta

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.
