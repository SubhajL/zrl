## Plan Draft A

### Overview
Close the remaining confidence gap for Task `14.4` by adding a real Postgres-backed HTTP e2e test for the lane temperature routes. Keep the existing mocked cold-chain e2e suite for fast controller-contract coverage and add a separate live-DB harness that exercises `AppModule`, auth guards, the real cold-chain service/store, persistence, and notification side effects.

### Files To Change
- `test/cold-chain-live.e2e-spec.ts`
  - add a DB-backed end-to-end test for `POST /lanes/:id/temperature` and `GET /lanes/:id/temperature`.
- `docs/PROGRESS.md`
  - append a terse note after the live-DB route test passes.

### Implementation Steps
1. TDD sequence:
   1) add a failing live-DB e2e spec that boots `AppModule`, overrides only `AuthService`, seeds a real exporter/lane/profile, and hits the HTTP routes.
   2) run the new test and capture the first real runtime failure.
   3) make the smallest code or harness change needed.
   4) rerun the live-DB test plus the focused cold-chain/notification suite.
   5) run `typecheck`, `lint`, and `build`.
2. `createApp()`
   - bootstrap the real Nest app against the configured local Postgres DB while disabling unrelated background workers.
3. live route test
   - seed a mango lane in logger mode, ingest a JSON batch that produces a critical excursion, assert HTTP response shape, then verify persisted readings, excursion rows, notification rows, and lane breach state directly from Postgres.
4. readback test
   - call `GET /lanes/:id/temperature` for the same lane and assert the persisted readings/excursions/SLA summary flow back through the real controller/service/store path.

### Test Coverage
- `test/cold-chain-live.e2e-spec.ts`
  - `POST /lanes/:id/temperature persists readings, excursions, notifications, and the lane breach flag`
    - real HTTP write path reaches Postgres-backed cold-chain and notification stores.
  - `GET /lanes/:id/temperature returns the persisted live DB state`
    - real HTTP read path returns stored readings/excursions/SLA.

### Decision Completeness
- Goal
  - prove the cold-chain temperature HTTP routes work end-to-end against the real local Postgres database.
- Non-goals
  - no frontend changes.
  - no additional domain behavior beyond verification scaffolding.
  - no replacement of the existing mocked e2e suite.
- Success criteria
  - the live-DB e2e spec passes.
  - route writes persist readings, excursions, notifications, and breach state.
  - route reads return the persisted data for the same public lane id.
- Public interfaces
  - no API contract changes; only new tests.
- Edge cases / failure modes
  - worker side effects must stay disabled in the harness.
  - seeded fixture rows must clean up even if the test fails.
- Rollout & monitoring
  - test-only change; no rollout risk.
- Acceptance checks
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(...\)"$/\1/p' .env) npm test -- --runInBand test/cold-chain-live.e2e-spec.ts`
  - focused cold-chain/notification suite
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies
- local Postgres reachable at the repo’s configured `DATABASE_URL`
- existing cold-chain migration state already applied

### Validation
- verify `ColdChainController` is exercised through `AppModule`, not a mocked `ColdChainService`.
- verify `LaneOwnerGuard` still runs with only `AuthService` overridden.
- verify the test uses the public lane id on the HTTP path and the internal lane id in DB assertions.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ColdChainController` live POST/GET routes | Supertest against `AppModule` | `src/modules/cold-chain/cold-chain.module.ts`, `src/app.module.ts` | `lanes`, `temperature_readings`, `excursions` |
| `LaneOwnerGuard` | HTTP auth guard chain | `src/common/auth/auth.module.ts` | `lanes` owner lookup |
| `NotificationService` side effect | cold-chain ingestion alert hook | `src/modules/notifications/notification.module.ts` | `notifications` |

## Plan Draft B

### Overview
Extend `test/cold-chain.e2e-spec.ts` in place with one live-DB scenario while keeping the existing mocked tests in the same file. This minimizes file count but mixes two very different harness styles.

### Tradeoffs
- Fewer files.
- Worse readability and slower local iteration because mocked and live-DB cases share setup concerns.

## Unified Execution Plan

### Overview
Add a dedicated live-DB cold-chain e2e file that boots `AppModule` with real cold-chain and notification services, overrides only `AuthService`, seeds a lane/profile directly in Postgres, and proves `POST` plus `GET /lanes/:id/temperature` work end-to-end using the public lane id. Keep the existing mocked file unchanged for fast contract coverage.

### Files To Change
- `test/cold-chain-live.e2e-spec.ts`
- `docs/PROGRESS.md`

### Concrete Design Decisions
- Use a separate file, not the existing mocked e2e suite.
- Override only `AuthService` so HTTP auth/ownership still runs but cold-chain logic stays real.
- Disable proof-pack and certification-expiry workers in the test harness.
- Seed `fruit_profiles` idempotently with `ON CONFLICT` so the test does not depend on prior seeding.
- Use a critical excursion batch so the test proves the strongest persistence path: excursion row, notification row, and `cold_chain_sla_breached_at`.

### Implementation Steps
1. Add the failing live-DB e2e file.
2. Run it and fix the first runtime issue.
3. Keep cleanup explicit for notifications, readings, excursions, lanes, and users.
4. Run the new live-DB test, then the focused cold-chain/notification suite, then main gates.

### Test Coverage
- `POST /lanes/:id/temperature persists readings, excursions, notifications, and the lane breach flag`
- `GET /lanes/:id/temperature returns the persisted live DB state`

### Decision Completeness
- Goal
  - finish the remaining end-to-end confidence gap for Task `14.4`.
- Non-goals
  - no API changes.
- Success criteria
  - live DB-backed HTTP route test passes against the configured local DB.
- Public interfaces
  - none changed.
- Edge cases / failure modes
  - test data isolation and worker suppression are mandatory.
- Rollout & monitoring
  - test-only change.
- Acceptance checks
  - same as Draft A.

### Dependencies
- same as Draft A.

### Validation
- same as Draft A.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| live cold-chain HTTP path | Supertest `POST/GET /lanes/:id/temperature` | `AppModule` + `ColdChainModule` + `AuthModule` | `lanes`, `fruit_profiles`, `temperature_readings`, `excursions`, `notifications` |

## 2026-03-28 12:36 +07 Implementation Summary

### Goal
Close the remaining Task `14.4` confidence gap by proving the cold-chain temperature HTTP routes against the real local Postgres database, then fix any production defects surfaced by that live request path.

### What Changed
- `test/cold-chain-live.e2e-spec.ts`
  - added a dedicated live-DB e2e harness that boots `AppModule`, overrides only `AuthService`, disables background workers, seeds `fruit_profiles`/`users`/`lanes`, posts a critical temperature batch through the public lane ID route, and verifies persisted readings, excursions, notification rows, breach timestamps, plus live GET readback.
- `src/modules/notifications/notification.pg-store.ts`
  - fixed `PrismaNotificationStore.listDeliveryTargets()` to qualify `users.id` in the joined SQL filter so cold-chain excursion alerts no longer fail with `column reference "id" is ambiguous`.
- `src/modules/notifications/notification.pg-store.spec.ts`
  - added a DB-backed regression test that proves `listDeliveryTargets()` returns user rows joined with channel targets.
- `docs/PROGRESS.md`
  - appended the final Task `14.4` confidence closeout note.

### TDD Evidence
- Added/changed tests
  - `test/cold-chain-live.e2e-spec.ts`
    - `POST /lanes/:id/temperature persists readings, excursions, notifications, and the lane breach flag`
    - `GET /lanes/:id/temperature returns the persisted live DB state`
  - `src/modules/notifications/notification.pg-store.spec.ts`
    - `listDeliveryTargets returns users joined with channel targets`
- RED command
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm run test:e2e -- --runInBand test/cold-chain-live.e2e-spec.ts`
- RED failure reason
  - first run exposed a harness bug (`ingestCriticalBatch(...).expect is not a function`), then the corrected live request exposed the production defect: `PrismaNotificationStore.listDeliveryTargets()` failed with `column reference "id" is ambiguous`, causing `POST /lanes/:id/temperature` to return HTTP `500` during critical excursion notification fanout.
- GREEN commands
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm test -- --runInBand src/modules/notifications/notification.pg-store.spec.ts`
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm run test:e2e -- --runInBand test/cold-chain-live.e2e-spec.ts`
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm test -- --runInBand src/modules/notifications/notification.pg-store.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/cold-chain/cold-chain.pg-store.spec.ts`
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts test/cold-chain-live.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Tests Run
- `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm test -- --runInBand src/modules/notifications/notification.pg-store.spec.ts`
  - passed
- `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm run test:e2e -- --runInBand test/cold-chain-live.e2e-spec.ts`
  - passed
- `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm test -- --runInBand src/modules/notifications/notification.pg-store.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/cold-chain/cold-chain.pg-store.spec.ts`
  - passed
- `DATABASE_URL=$(sed -n 's/^DATABASE_URL="\(.*\)"/\1/p' .env) npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts test/cold-chain-live.e2e-spec.ts`
  - passed
- `npm run typecheck`
  - passed
- `npm run lint`
  - passed
- `npm run build`
  - passed

### Wiring Verification Evidence
- `ColdChainController.ingestLaneTemperature()` and `ColdChainController.getLaneTemperature()` are exercised through `AppModule` in `test/cold-chain-live.e2e-spec.ts`; the harness overrides only `AuthService`, so the real controller, `JwtAuthGuard`, `LaneOwnerGuard`, `ColdChainService`, `PrismaColdChainStore`, and `NotificationService` stay wired.
- `ColdChainService.ingestLaneReadings()` still resolves the public lane ID to the internal lane row ID through `findLaneTemperatureContext()`, writes `temperature_readings`, replaces `excursions`, updates `lanes.cold_chain_sla_breached_at`, and triggers `notifyLaneOwnerAboutTemperatureExcursions()`.
- `PrismaNotificationStore.listDeliveryTargets()` is on the runtime path through `NotificationService.dispatchCreatedNotifications()`; the live HTTP e2e reproduced the ambiguous-column failure before the SQL qualification fix, and the DB-backed store spec now covers that join directly.

### Behavior Changes And Risks
- Behavior change
  - critical cold-chain HTTP ingestion is now proven end-to-end against the real DB path, not just controller mocks or store-level tests.
  - notification fanout for excursion alerts no longer fails on joined delivery-target lookups.
- Fail-open vs fail-closed
  - the notification-store SQL bug previously failed closed at the request level by surfacing a `500`; the fix restores the intended successful path without changing the fail-closed behavior for missing ownership/authentication.
- Residual risk
  - the route still logs an error-level message for critical excursions by design; the green e2e output includes that log line.

### Skeptical Review Notes
- Reviewed the touched diff after green runs.
- No additional defects found in the new live harness or the notification-store fix.
- The repo still contains unrelated pre-existing uncommitted changes outside this slice; none were reverted.

### Follow-Ups / Known Gaps
- If lane detail/read models should expose `cold_chain_sla_breached_at`, that remains a separate product/API follow-up.


## Review (2026-03-28 13:24 +07) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; `git diff --stat`; grouped `git diff --unified=3` inspections across audit/auth/lane/evidence, cold-chain, and notifications files; direct reads of the new migration and new spec files; `DATABASE_URL=... npm test -- --runInBand src/modules/notifications/notification.pg-store.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/cold-chain/cold-chain.pg-store.spec.ts`; `DATABASE_URL=... npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts test/cold-chain-live.e2e-spec.ts`; `npm run typecheck`; `npm run lint`; `npm run build`

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
- Assumed the intended review target is the full current working tree, including the untracked migration/spec files shown by `git status`.
- Assumed the previously run green gates are the acceptance bar for this batch and no additional frontend/runtime deployment checks are required before PR submission.

### Recommended Tests / Validation
- Re-run the existing focused cold-chain/notification suite in CI.
- Re-run mocked plus live cold-chain e2e in CI.
- Ensure the additive Prisma migration is deployed before promotion to any environment that receives temperature ingestion traffic.

### Rollout Notes
- `prisma/migrations/20260328120000_task_14_4_excursion_alerting/migration.sql` must land before code that writes `lanes.cold_chain_sla_breached_at`.
- The worktree is a broad backend batch on top of `main`; the PR description should call out the public-lane-ID behavior expansion and the new cold-chain notification/breach-path changes clearly so reviewers understand the combined scope.
