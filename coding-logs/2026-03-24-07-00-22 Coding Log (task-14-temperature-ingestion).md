## Plan Draft A

### Overview
Implement Task 14.1-14.3 entirely inside the cold-chain module by adding lane-scoped temperature ingestion routes, additive temperature/excursion persistence, and service-owned excursion plus shelf-life calculations. Keep the scope limited to ingestion, detection, and reporting; do not add alert delivery or websocket fanout yet.

### Files To Change
- `prisma/schema.prisma`
  - add `TemperatureReading` and `Excursion` models plus any minimal supporting enums needed for direction/type/source.
- `prisma/migrations/20260324070022_task_14_temperature_ingestion/migration.sql`
  - additive SQL for the new cold-chain tables and indexes.
- `src/modules/cold-chain/cold-chain.types.ts`
  - expand cold-chain contracts for lane temperature context, ingestion input, stored readings, excursions, and report DTOs.
- `src/modules/cold-chain/cold-chain.pg-store.ts`
  - add lane-context lookup, reading persistence/query, and excursion persistence/query methods.
- `src/modules/cold-chain/cold-chain.service.ts`
  - add ingestion orchestration, CSV/JSON normalization support, excursion grouping/classification, and remaining shelf-life calculations.
- `src/modules/cold-chain/cold-chain.controller.ts`
  - add `POST /lanes/:id/temperature` and `GET /lanes/:id/temperature`, with JWT + lane-owner guards and multipart CSV support.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - add RED/GREEN unit coverage for ingestion, severity boundaries, downsampling, and shelf-life impact.
- `test/cold-chain.e2e-spec.ts`
  - add RED/GREEN route-level coverage for JSON ingestion, CSV ingestion, and lane temperature reads.
- `docs/PROGRESS.md`
  - append a terse Task 14 progress entry.

### Implementation Steps
1. TDD sequence:
   1) add failing service tests for storing readings, grouping excursions, severity boundaries, and shelf-life output.
   2) add failing e2e tests proving `/lanes/:id/temperature` accepts JSON and CSV and that `GET` forwards parsed filters.
   3) add the minimal schema/store/types needed to support those tests.
   4) implement service orchestration and controller parsing.
   5) run focused cold-chain tests, then repo gates.
2. `ColdChainService.ingestLaneReadings(laneId, payload)`
   - validate the lane/profile context, sort and normalize readings, store them, recompute excursions for the lane, and return readings/excursions/report together.
3. `ColdChainService.listLaneTemperatureData(laneId, query)`
   - load readings in range, downsample if requested, load stored excursions, and compute the current shelf-life report.
4. `ColdChainService.detectExcursions(context, readings)`
   - group contiguous out-of-range readings by direction, classify severity using deviation/duration rules, and emit lane-scoped excursion records.
5. `ColdChainService.calculateShelfLifeImpact(profile, excursions)`
   - calculate cumulative shelf-life reduction capped at 100% and remaining shelf-life days from the fruit profile.

### Test Coverage
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `ingestLaneReadings stores sorted readings and returns recomputed excursions`
    - lane ingestion persists readings and detection output.
  - `detectExcursions classifies minor, moderate, severe, and critical boundaries`
    - severity matrix is enforced at edge thresholds.
  - `listLaneTemperatureData downsamples readings by requested resolution`
    - chart queries return aggregated bucket values.
  - `calculateShelfLifeImpact caps cumulative reduction at one hundred percent`
    - remaining shelf-life never goes negative.
- `test/cold-chain.e2e-spec.ts`
  - `POST /lanes/:id/temperature accepts JSON reading batches`
    - lane temperature ingestion route is wired.
  - `POST /lanes/:id/temperature accepts CSV upload`
    - multipart CSV parsing works through the controller.
  - `GET /lanes/:id/temperature returns filtered lane temperature data`
    - lane-scoped read route forwards query filters and resolution.

### Decision Completeness
- Goal
  - deliver Task 14.1-14.3: ingestion endpoints, excursion detection, and shelf-life impact, without notification delivery.
- Non-goals
  - no websocket events
  - no notification/email/push dispatch
  - no evidence artifact creation for `TEMP_DATA`
  - no lane timeline integration yet
- Success criteria
  - `POST /lanes/:id/temperature` accepts JSON arrays and CSV files
  - readings persist to a new cold-chain table
  - excursions persist with severity, direction, type, timing, and impact
  - `GET /lanes/:id/temperature` returns filtered readings plus excursion/report data
  - all focused and repo-wide gates pass
- Public interfaces
  - new authenticated routes:
    - `POST /lanes/:id/temperature`
    - `GET /lanes/:id/temperature`
  - new schema:
    - `temperature_readings`
    - `excursions`
  - accepted query surface:
    - `from`
    - `to`
    - `resolution` in `raw | 5m | 15m | 1h`
- Edge cases / failure modes
  - invalid CSV or malformed JSON: fail closed with `400`
  - unknown lane: fail closed with `404`
  - empty ingestion batch: fail closed with `400`
  - out-of-order timestamps: service sorts before detection
  - no fruit profile: fail closed with `404`
  - single-reading interval ambiguity: use lane cold-chain cadence when available, otherwise `0` minutes
- Rollout & monitoring
  - additive migration only; no backfill required
  - no feature flag
  - watch build/typecheck and cold-chain e2e after merge
- Acceptance checks
  - `npm run db:generate`
  - `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Dependencies
- existing `ColdChainModule` wiring from Task 13
- existing auth guards from `AuthModule`
- additive Prisma migration support already in the repo

### Validation
- verify `ColdChainController` is registered through `ColdChainModule` and `AppModule`
- verify new lane-scoped routes use `JwtAuthGuard` + `LaneOwnerGuard`
- verify new store methods operate off `lanes`, `fruit_profiles`, and the new temperature tables only

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ColdChainController.ingestLaneTemperature()` | `POST /lanes/:id/temperature` | `src/modules/cold-chain/cold-chain.module.ts` controller registration | `temperature_readings`, `excursions`, `lanes`, `fruit_profiles` |
| `ColdChainController.getLaneTemperature()` | `GET /lanes/:id/temperature` | `src/modules/cold-chain/cold-chain.module.ts` controller registration | `temperature_readings`, `excursions`, `lanes`, `fruit_profiles` |
| `ColdChainService.ingestLaneReadings()` | cold-chain lane temperature POST route | injected via `ColdChainModule` provider factory | `temperature_readings`, `excursions` |
| `PrismaColdChainStore` lane temperature queries | `ColdChainService` ingestion/read orchestration | injected via `ColdChainModule` provider factory | `lanes`, `fruit_profiles`, `temperature_readings`, `excursions` |

## Plan Draft B

### Overview
Implement Task 14.1-14.3 with a lighter persistence seam by keeping excursion and shelf-life computation purely in service memory and persisting only raw readings initially. Recompute excursions on each GET call instead of storing them.

### Tradeoffs
- Fewer schema changes and less write complexity.
- Worse read latency and no durable excursion history.
- Weaker base for later alerting and SLA reporting, so it saves time now at the cost of rework for Task 14.4 and Task 25.

## Unified Execution Plan

### Overview
Use Draft A’s durable model: persist both readings and excursions in the cold-chain module, but keep the implementation intentionally narrow. The service will recompute excursions for the full lane dataset after each ingestion batch, overwrite the lane’s stored excursions in one transaction, and compute shelf-life impact from those stored excursions when serving reads.

### Files To Change
- `prisma/schema.prisma`
- `prisma/migrations/20260324070022_task_14_temperature_ingestion/migration.sql`
- `src/modules/cold-chain/cold-chain.types.ts`
- `src/modules/cold-chain/cold-chain.pg-store.ts`
- `src/modules/cold-chain/cold-chain.service.ts`
- `src/modules/cold-chain/cold-chain.controller.ts`
- `src/modules/cold-chain/cold-chain.service.spec.ts`
- `test/cold-chain.e2e-spec.ts`
- `docs/PROGRESS.md`

### Concrete Design Decisions
- Keep all new behavior in `cold-chain`; do not route temperature ingestion through evidence or lane services.
- Use lane-scoped endpoints under `ColdChainController` with `@Controller()` so the routes can live at `/lanes/:id/temperature` without moving lane controller ownership.
- Parse CSV manually with a narrow accepted header set: `timestamp`, `temperatureC` or `temperature`, and optional `deviceId`.
- Persist raw readings first, then recompute all lane excursions inside the cold-chain store transactionally.
- Group excursions by contiguous out-of-range readings with the same direction (`LOW` or `HIGH`).
- Severity rules:
  - `CRITICAL` if a low excursion crosses the fruit’s chilling threshold.
  - otherwise `SEVERE` if max deviation `>= 3°C` or duration `> 120` minutes.
  - otherwise `MODERATE` if max deviation `>= 2°C` or duration `> 30` minutes.
  - otherwise `MINOR`.
- Shelf-life impact is deterministic and capped:
  - `MINOR = 5%`
  - `MODERATE = 12%`
  - `SEVERE = 25%`
  - `CRITICAL = 100%`
  - cumulative reduction capped at `100%`
- Remaining shelf life uses `FruitProfile.shelfLifeMaxDays` as the optimistic baseline and floors at `0`.
- `GET /lanes/:id/temperature` returns:
  - downsampled `readings`
  - persisted `excursions`
  - computed `report`
  - `meta` including applied resolution and range bounds

### TDD Sequence
1. Add failing unit tests for:
   - sorted reading persistence
   - grouped excursion detection
   - severity boundary classification
   - shelf-life cap behavior
   - resolution downsampling
2. Add failing e2e tests for:
   - JSON lane temperature ingestion
   - CSV lane temperature ingestion
   - filtered lane temperature reads
3. Implement additive cold-chain types and store contracts.
4. Implement service detection/report logic.
5. Implement controller parsing and route wiring.
6. Add migration, run `db:generate`, and rerun focused + repo-wide gates.
7. Run formal `g-check` before any commit.

### Validation
- `npm run db:generate`
- `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
- `npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| lane temperature POST route | `POST /lanes/:id/temperature` | `src/modules/cold-chain/cold-chain.controller.ts` under `ColdChainModule` in `AppModule` | `temperature_readings`, `excursions` |
| lane temperature GET route | `GET /lanes/:id/temperature` | `src/modules/cold-chain/cold-chain.controller.ts` under `ColdChainModule` in `AppModule` | `temperature_readings`, `excursions` |
| `ColdChainService.ingestLaneReadings()` | cold-chain POST controller handler | `ColdChainModule` provider factory | `lanes`, `fruit_profiles`, `temperature_readings`, `excursions` |
| `ColdChainService.listLaneTemperatureData()` | cold-chain GET controller handler | `ColdChainModule` provider factory | `temperature_readings`, `excursions` |
| Task 14 migration | Prisma migration flow | `prisma/migrations/20260324070022_task_14_temperature_ingestion/migration.sql` | `temperature_readings`, `excursions` |

## Implementation Summary (2026-03-24 07:45 +07)

### Goal
Resume the interrupted Task 14 worktree, finish the remaining quality gates for Task 14.1-14.3, and synchronize Task Master status with the actual implementation state.

### What Changed
- `src/modules/cold-chain/cold-chain.controller.ts`
  - Removed the explicit `multer` memory storage option so the upload interceptor no longer leaks `any` through linted controller config.
  - Kept the lane-scoped JSON/CSV ingestion and filtered read routes intact.
- `src/modules/cold-chain/cold-chain.service.ts`
  - Converted promise-returning helpers that do not await (`classifyTemperature`, `detectExcursions`, `calculateShelfLifeImpact`) into non-`async` promise-returning methods so they satisfy the repo lint rules without changing their public async contract.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - Replaced one broad matcher-based assertion with explicit assertions on the returned ingestion result to avoid `any` leakage in the test.
- `test/cold-chain.e2e-spec.ts`
  - Replaced matcher objects using `expect.any(Date)` with explicit assertions on the recorded mock call payloads, removing the last unsafe-assignment lint failures.
- `docs/PROGRESS.md`
  - Added the Task 14 progress entry noting that subtasks 14.1-14.3 are complete and 14.4 remains pending.
- Task Master status (synced in `/Users/subhajlimanond/dev/zrl`)
  - `14.1`, `14.2`, and `14.3` were updated to `done`.
  - Parent task `14` remains `in-progress`.
  - `14.4` remains `pending`.

### TDD Evidence
- RED
  - No new RED run was recorded during this resume pass because the interrupted Task 14 branch already contained the implementation and focused tests when work resumed. This pass completed lint cleanup, validation, and status synchronization on top of that existing implementation.
- GREEN
  - `npm run db:generate`
  - `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

### Tests Run
- `npm run db:generate`
- `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
- `npm run test:e2e -- --runInBand test/cold-chain.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Wiring Verification Evidence
- `ColdChainController` still owns the live lane-scoped HTTP routes at `POST /lanes/:id/temperature` and `GET /lanes/:id/temperature`; the focused e2e suite proves both routes execute through the Nest app with auth guards in place.
- `ColdChainService.ingestLaneReadings()` persists readings via `PrismaColdChainStore.createTemperatureReadings()`, recomputes excursions from stored lane readings, replaces the lane’s persisted excursions, and returns an SLA summary.
- `ColdChainService.listLaneTemperatureData()` reads persisted readings and excursions from `PrismaColdChainStore`, downsamples readings by requested resolution, and computes the current shelf-life report.
- The additive Prisma migration and schema generate cleanly, so the runtime persistence path for `temperature_readings` and `excursions` is wired through Prisma generation.

### Behavior Changes And Risks
- Task 14.1-14.3 are now effectively complete on the feature branch: JSON/CSV ingestion, persisted excursion recomputation, downsampled lane reads, and shelf-life/SLA reporting all pass their focused and full-suite checks.
- Task 14 intentionally remains `in-progress` because alert delivery (`14.4`) is still not implemented.
- This resume pass did not add notification or websocket fanout, and it did not create `TEMP_DATA` evidence artifacts; those remain future-scope decisions.

### Follow-Ups / Known Gaps
- Formal skeptical review / `g-check` review artifact has not been added yet for this worktree.
- The Task Master data file is only present in the main checkout, so the status sync was applied there rather than inside the feature worktree.
