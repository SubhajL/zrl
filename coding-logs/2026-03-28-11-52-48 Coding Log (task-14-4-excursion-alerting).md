## Plan Draft A

### Overview
Implement Task `14.4` by extending the existing cold-chain ingestion flow so newly detected excursions trigger severity-aware notifications and a dedicated realtime websocket event. Keep the runtime ownership split simple: cold-chain decides what happened, notifications decides how to fan it out, and the lane breach flag is persisted atomically alongside excursion replacement.

### Files To Change
- `prisma/schema.prisma`
  - add a nullable lane-level critical breach timestamp on `Lane`.
- `prisma/migrations/<new_task_14_4_migration>/migration.sql`
  - additive SQL for the new lane breach column.
- `src/modules/cold-chain/cold-chain.types.ts`
  - extend the cold-chain store contract if excursion replacement needs to persist the breach flag transactionally.
- `src/modules/cold-chain/cold-chain.pg-store.ts`
  - update excursion replacement transaction to set the lane breach flag when critical excursions exist.
- `src/modules/cold-chain/cold-chain.service.ts`
  - replace the generic excursion notification call with severity-aware alert orchestration.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - add RED/GREEN coverage for severity-aware alert payloads and critical escalation.
- `src/modules/notifications/notification.types.ts`
  - add explicit websocket event contracts for `temperature.excursion`.
- `src/modules/notifications/notification.constants.ts`
  - add a pubsub channel constant for the excursion event.
- `src/modules/notifications/notification.gateway.ts`
  - emit `temperature.excursion` to the authenticated user room.
- `src/modules/notifications/notification.pubsub.ts`
  - publish and receive the new excursion websocket event through Redis.
- `src/modules/notifications/notification.service.ts`
  - add a dedicated temperature-excursion alert method with severity-based channel escalation.
- `src/modules/notifications/notification.service.spec.ts`
  - add RED/GREEN coverage for moderate/severe/critical channel policy and websocket fanout.
- `src/modules/notifications/notification.gateway.spec.ts`
  - add gateway coverage for `temperature.excursion`.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - add pubsub coverage for the new event serialization/fanout path.
- `docs/PROGRESS.md`
  - append a terse task progress note after implementation.

### Implementation Steps
1. TDD sequence:
   1) add failing notification-service tests for severity-based minimum channels and websocket publishing.
   2) add failing cold-chain service tests for calling the dedicated excursion alert path with the right payload.
   3) add failing gateway/pubsub tests for `temperature.excursion`.
   4) add the additive lane schema/migration and store update for the critical breach flag.
   5) implement the smallest service/gateway/pubsub changes to pass.
   6) run focused unit tests, then relevant repo gates.
2. `NotificationService.notifyLaneOwnerAboutTemperatureExcursions(...)`
   - resolve the lane owner once, create the notification row, publish `notification.new`, publish `temperature.excursion`, and dispatch channels using the maximum of stored preferences and the severity minimum policy.
3. `ColdChainService.notifyAboutNewExcursions(...)`
   - dedupe newly detected excursions against the previous stored set, compute the highest new severity, and call the dedicated notification service method with a stable payload.
4. `PrismaColdChainStore.replaceExcursions(...)`
   - keep excursion deletion/reinsert transactional and set `lanes.cold_chain_sla_breached_at` when at least one critical excursion exists in the replacement set.
5. Expected behavior and edge cases:
   - no new excursions means no websocket event and no new notification row.
   - moderate alerts force email if a delivery target exists, even if stored preferences disable email.
   - severe alerts force push in addition to email and in-app.
   - critical alerts force every supported channel and persist the lane breach timestamp without clearing it later.
   - realtime fanout failures fail open for ingestion; breach persistence does not.

### Test Coverage
- `src/modules/notifications/notification.service.spec.ts`
  - `notifyLaneOwnerAboutTemperatureExcursions escalates moderate alerts to email`
    - moderate severity forces email dispatch and websocket event.
  - `notifyLaneOwnerAboutTemperatureExcursions escalates critical alerts across all channels`
    - critical severity forces in-app, email, push, and line.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `ingestLaneReadings dispatches a severity-aware excursion alert`
    - new excursion batches call the dedicated alert method.
  - `ingestLaneReadings does not alert when no new excursions were introduced`
    - identical excursion sets stay quiet.
- `src/modules/notifications/notification.gateway.spec.ts`
  - `emitTemperatureExcursion emits temperature.excursion to the recipient room`
    - websocket event name and payload shape stay correct.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `publishes and replays serialized temperature excursion events`
    - Redis pubsub forwards the new event correctly.

### Decision Completeness
- Goal
  - Finish Task `14.4` by making excursion detection produce severity-aware notifications and a dedicated realtime websocket event.
- Non-goals
  - no new HTTP endpoints.
  - no TEMP_DATA evidence artifact generation.
  - no frontend websocket consumption changes.
- Success criteria
  - new excursion ingestion emits `temperature.excursion`.
  - severity policy matches Task Master: minor in-app, moderate email, severe push, critical all channels.
  - critical excursions persist a lane-level breach timestamp.
  - focused cold-chain and notification tests pass.
- Public interfaces
  - websocket event: `temperature.excursion`.
  - DB schema: nullable `lanes.cold_chain_sla_breached_at`.
  - no new env vars or REST contracts.
- Edge cases / failure modes
  - missing lane owner: fail open, log warning, skip delivery.
  - missing email/push/line target: keep the notification row and websocket event, log channel skip.
  - Redis unavailable: fall back to direct gateway emit.
  - duplicate ingestion of the same ongoing excursion: no duplicate alert row.
- Rollout & monitoring
  - additive migration only; backout is column-unused-safe.
  - watch cold-chain ingest logs plus notification channel warning logs.
- Acceptance checks
  - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts`
  - `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
  - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`

### Dependencies
- existing `ColdChainModule` -> `NotificationModule` wiring.
- existing authenticated notification websocket namespace `/ws`.
- existing notification channel dispatcher and delivery target store.

### Validation
- confirm `ColdChainService.ingestLaneReadings()` still flows through the cold-chain module provider factory.
- confirm the new websocket event is emitted through `NotificationGateway` and `NotificationPubSub`.
- confirm the lane breach flag update occurs inside the excursion replacement transaction.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ColdChainService.notifyAboutNewExcursions()` | `ColdChainService.ingestLaneReadings()` | `src/modules/cold-chain/cold-chain.module.ts` provider factory | `excursions`, `lanes` |
| `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()` | called from cold-chain service after ingestion | `src/modules/notifications/notification.module.ts` provider | `notifications`, `notification_preferences`, `notification_channel_targets` |
| `NotificationGateway.emitTemperatureExcursion()` | websocket fanout for alert recipients | `src/modules/notifications/notification.module.ts` provider | N/A |
| `NotificationPubSub.publishTemperatureExcursion()` | redis-backed cross-instance fanout | `src/modules/notifications/notification.module.ts` provider | Redis channel + websocket only |
| migration for `cold_chain_sla_breached_at` | applied by Prisma migration flow | Prisma migration registration | `lanes.cold_chain_sla_breached_at` |

### Cross-Language Schema Verification
Not applicable beyond TypeScript and Prisma in this repo.

## Plan Draft B

### Overview
Implement Task `14.4` with the smallest possible application-surface change by keeping channel escalation inside `ColdChainService`, emitting the websocket event directly from the notification gateway, and persisting the lane breach flag through a separate cold-chain store call after excursion replacement. This reduces notification-service refactoring but pushes policy logic into the domain service.

### Files To Change
- same core files as Draft A, but with less refactoring inside `src/modules/notifications/notification.service.ts`.

### Implementation Steps
1. Add a direct websocket-publisher abstraction and call it from `ColdChainService`.
2. Keep `NotificationService.notifyLaneOwner(...)` for row creation.
3. Add a separate `ColdChainStore.markLaneSlaBreached(...)` call after `replaceExcursions(...)`.

### Test Coverage
- same focused tests as Draft A, but with more mocking in cold-chain service tests.

### Decision Completeness
- Goal
  - ship Task `14.4` with minimal notification-layer changes.
- Non-goals
  - same as Draft A.
- Success criteria
  - same as Draft A.
- Public interfaces
  - same as Draft A.
- Edge cases / failure modes
  - separate post-write breach update can drift from excursion persistence if it fails.
- Rollout & monitoring
  - same as Draft A.
- Acceptance checks
  - same as Draft A.

### Dependencies
- same as Draft A.

### Validation
- verify the direct websocket publisher is exported and injected without creating a new module cycle.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| direct websocket publisher | cold-chain service alert hook | notification module export | N/A |
| post-write lane breach updater | cold-chain service alert hook | cold-chain store | `lanes.cold_chain_sla_breached_at` |

### Cross-Language Schema Verification
Not applicable beyond TypeScript and Prisma in this repo.

### Tradeoffs
- Draft B touches fewer notification internals.
- Draft B weakens transactional consistency for the breach flag and duplicates channel policy in cold-chain.
- Draft B makes the websocket fanout path less cohesive with the existing notification pubsub flow.

## Comparative Analysis & Synthesis

### Strengths
- Draft A keeps notification delivery policy in the notifications module, which already owns preferences, fanout, and channel dispatch.
- Draft A preserves transactional integrity for the lane breach flag by folding it into excursion replacement.
- Draft B is marginally smaller in raw file edits.

### Gaps
- Draft B underspecifies how websocket delivery should behave in multi-instance deployments.
- Draft B invites drift between stored notification policy and cold-chain-specific policy code.

### Trade-offs
- Draft A costs a bit more refactoring in `notification.service.ts` and `notification.pubsub.ts`.
- Draft A yields the cleaner runtime model: cold-chain emits a domain event, notifications handles transport, persistence, and fanout.

### Compliance Check
- Draft A better matches LEVER and module-boundary rules because it extends existing notification wiring instead of bypassing it.
- Both drafts stay additive, but only Draft A avoids a partial-write breach flag path.

## Unified Execution Plan

### Overview
Implement Task `14.4` by extending the existing cold-chain ingestion path with a dedicated severity-aware excursion alert API in the notifications module, plus a dedicated websocket event `temperature.excursion`. Persist the critical lane breach timestamp inside the existing excursion replacement transaction so alerting stays fail-open while lane breach persistence stays consistent with stored excursion state.

### Files To Change
- `prisma/schema.prisma`
  - add nullable `coldChainSlaBreachedAt` mapped to `cold_chain_sla_breached_at` on `Lane`.
- `prisma/migrations/<new_task_14_4_migration>/migration.sql`
  - additive migration for the new lane column.
- `src/modules/cold-chain/cold-chain.types.ts`
  - extend the store contract only if needed for the transactional breach update path.
- `src/modules/cold-chain/cold-chain.pg-store.ts`
  - set the breach timestamp during `replaceExcursions(...)` whenever critical excursions are present.
- `src/modules/cold-chain/cold-chain.service.ts`
  - compute the highest new severity and call the dedicated notification service method.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - cover severity-aware alert dispatch and duplicate suppression.
- `src/modules/notifications/notification.types.ts`
  - add `TemperatureExcursionRealtimeEvent` plus fanout/gateway interface methods.
- `src/modules/notifications/notification.constants.ts`
  - add the new Redis channel constant.
- `src/modules/notifications/notification.gateway.ts`
  - emit `temperature.excursion` to the lane owner room.
- `src/modules/notifications/notification.pubsub.ts`
  - serialize, publish, subscribe, and replay the new event.
- `src/modules/notifications/notification.service.ts`
  - add `notifyLaneOwnerAboutTemperatureExcursions(...)`, shared helper(s) for row creation and effective preference merging, and severity-policy helpers.
- `src/modules/notifications/notification.service.spec.ts`
  - cover moderate and critical escalation rules.
- `src/modules/notifications/notification.gateway.spec.ts`
  - assert event name/payload.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - assert cross-instance event replay.
- `docs/PROGRESS.md`
  - add a short Task `14.4` completion note after green verification.

### Concrete Design Decisions
- Keep cold-chain as the detector and notifications as the delivery-policy owner.
- Reuse `EXCURSION_ALERT` as the stored notification type; do not create a second persisted notification type.
- Treat severity policy as minimum required channels:
  - `MINOR`: in-app only.
  - `MODERATE`: in-app + email.
  - `SEVERE`: in-app + email + push.
  - `CRITICAL`: in-app + email + push + line.
- Publish `temperature.excursion` regardless of user channel preferences so realtime operators still receive the domain event.
- Keep ingestion fail-open for downstream delivery failures: channel/websocket errors should not roll back readings or excursion persistence.
- Keep the lane breach flag sticky: once set, later non-critical updates do not clear it in this task.

### Implementation Steps
1. TDD sequence:
   1) add failing notification-service tests for severity policy and websocket publishing.
   2) add failing gateway/pubsub tests for `temperature.excursion`.
   3) add failing cold-chain service tests for the dedicated excursion-alert method and duplicate suppression.
   4) add the additive schema + migration and the transactional breach update in the cold-chain store.
   5) implement the smallest notification/gateway/pubsub changes to pass.
   6) implement the cold-chain service call-site changes to pass.
   7) run focused tests, then `lint`, `typecheck`, and the relevant backend build/test gates.
2. `NotificationService.notifyLaneOwnerAboutTemperatureExcursions(laneId, payload)`
   - resolve the owner once, create a notification row for `EXCURSION_ALERT`, publish `notification.new`, publish `temperature.excursion`, and dispatch channels using merged effective preferences.
3. `NotificationService.buildExcursionAlertPreference(severity, storedPreference)`
   - combine the stored preference with the severity floor so mandatory channels are always enabled for that alert.
4. `NotificationGateway.emitTemperatureExcursion(userId, event)`
   - emit the new event into the existing `/ws` authenticated room model.
5. `NotificationPubSub.publishTemperatureExcursion(userId, event)`
   - use a dedicated Redis channel and replay to the gateway when Redis is present, or fall back to direct gateway emission.
6. `PrismaColdChainStore.replaceExcursions(laneId, excursions)`
   - after replacing excursions, set `lanes.cold_chain_sla_breached_at` to the earliest critical start time when the batch contains any critical excursions.
7. `ColdChainService.notifyAboutNewExcursions(...)`
   - compute `newExcursions`, derive `highestSeverity`, build a concise payload, and delegate to the dedicated notification service method.

### Test Coverage
- `src/modules/notifications/notification.service.spec.ts`
  - `notifyLaneOwnerAboutTemperatureExcursions escalates moderate alerts to email`
    - moderate severity overrides stored email-off preference.
  - `notifyLaneOwnerAboutTemperatureExcursions escalates severe alerts to push`
    - severe severity enables push in addition to email/in-app.
  - `notifyLaneOwnerAboutTemperatureExcursions escalates critical alerts across all channels`
    - critical severity enables line and marks the websocket payload breached.
- `src/modules/notifications/notification.gateway.spec.ts`
  - `emitTemperatureExcursion emits temperature.excursion to the recipient room`
    - gateway event name and payload remain stable.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `publishes and replays serialized temperature excursion events`
    - pubsub round-trip works with the new event.
- `src/modules/cold-chain/cold-chain.service.spec.ts`
  - `ingestLaneReadings dispatches the highest new excursion severity`
    - only newly introduced excursions are reported.
  - `ingestLaneReadings suppresses duplicate alerts for unchanged ongoing excursions`
    - repeated ingestion does not spam.

### Decision Completeness
- Goal
  - complete Task Master subtask `14.4` with severity-aware delivery, websocket fanout, and persistent critical breach tracking.
- Non-goals
  - no REST API additions.
  - no frontend subscription changes.
  - no new audit entries or evidence artifacts for temperature data in this task.
- Success criteria
  - `temperature.excursion` is emitted for new excursions.
  - severity policy matches Task Master requirements.
  - critical excursions persist the lane breach timestamp additively.
  - focused tests and relevant backend gates pass.
- Public interfaces
  - websocket event: `temperature.excursion`.
  - DB schema: `lanes.cold_chain_sla_breached_at TIMESTAMP NULL`.
  - no new env vars, CLI flags, or HTTP payloads.
- Edge cases / failure modes
  - missing owner: log warning, skip row/channel/websocket delivery.
  - missing delivery targets: websocket + notification row still happen; skipped channels log warnings.
  - Redis unavailable: direct gateway emit fallback.
  - duplicate ongoing excursions: no duplicate alert row or websocket event.
  - backfilled critical data: breach timestamp becomes the earliest critical excursion start seen so far.
- Rollout & monitoring
  - additive migration only; backout is safe by leaving the column unused.
  - monitor cold-chain ingest logs, notification channel warnings, and websocket pubsub warnings.
- Acceptance checks
  - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts`
  - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
  - `npm run lint`
  - `npm run typecheck`

### Dependencies
- existing `NotificationModule` exports and `ColdChainModule` import.
- existing Redis-backed notification fanout fallback path.
- existing `EXCURSION_ALERT` notification type and delivery-target persistence.

### Validation
- verify `ColdChainService` is still instantiated via `src/modules/cold-chain/cold-chain.module.ts`.
- verify `NotificationGateway` remains registered in `src/modules/notifications/notification.module.ts`.
- verify `NotificationPubSub` subscribes to both `notification.created` and `temperature.excursion`.
- verify the new lane flag update executes in `PrismaColdChainStore.replaceExcursions(...)`, not in a detached post-write call.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ColdChainService.notifyAboutNewExcursions()` | `ColdChainService.ingestLaneReadings()` | `src/modules/cold-chain/cold-chain.module.ts` | `excursions`, `temperature_readings` |
| `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()` | called from cold-chain after excursion recompute | `src/modules/notifications/notification.module.ts` | `notifications`, `notification_preferences`, `notification_channel_targets` |
| `NotificationGateway.emitTemperatureExcursion()` | Redis fallback or pubsub replay | `src/modules/notifications/notification.module.ts` | N/A |
| `NotificationPubSub.publishTemperatureExcursion()` | notification service fanout | `src/modules/notifications/notification.module.ts` | Redis pubsub only |
| migration `cold_chain_sla_breached_at` | Prisma migration application | Prisma CLI and generated SQL | `lanes.cold_chain_sla_breached_at` |

### Cross-Language Schema Verification
Not applicable beyond Prisma + TypeScript in this repo.

## 2026-03-28 11:58 ICT

- Goal: implement Task `14.4` by adding severity-aware excursion alert delivery, the `temperature.excursion` websocket event, and a persistent critical breach flag on `lanes`.
- What changed:
  - `prisma/schema.prisma`
    - added nullable `Lane.coldChainSlaBreachedAt` mapped to `cold_chain_sla_breached_at`.
  - `prisma/migrations/20260328120000_task_14_4_excursion_alerting/migration.sql`
    - added the additive lane breach timestamp column.
  - `src/modules/cold-chain/cold-chain.service.ts`
    - changed new-excursion alerting to use a dedicated notification path and added severity-based logging.
  - `src/modules/cold-chain/cold-chain.pg-store.ts`
    - made `replaceExcursions(...)` persist the earliest critical breach timestamp transactionally with excursion replacement.
  - `src/modules/notifications/notification.types.ts`
    - added explicit temperature-excursion alert and realtime event contracts plus fanout/gateway methods.
  - `src/modules/notifications/notification.constants.ts`
    - added the Redis channel constant for `temperature.excursion`.
  - `src/modules/notifications/notification.gateway.ts`
    - added `emitTemperatureExcursion(...)` to the existing authenticated `/ws` gateway.
  - `src/modules/notifications/notification.pubsub.ts`
    - added Redis publish/subscribe handling for `temperature.excursion` with direct gateway fallback.
  - `src/modules/notifications/notification.service.ts`
    - added `notifyLaneOwnerAboutTemperatureExcursions(...)`, severity-floor channel escalation, and shared notification dispatch plumbing.
  - `src/modules/notifications/notification.service.spec.ts`
    - added moderate and critical alert policy tests.
  - `src/modules/notifications/notification.gateway.spec.ts`
    - added websocket event coverage for `temperature.excursion`.
  - `src/modules/notifications/notification.pubsub.spec.ts`
    - added Redis round-trip coverage for the new realtime event.
  - `src/modules/cold-chain/cold-chain.service.spec.ts`
    - updated ingestion coverage for the dedicated alert path and duplicate suppression.
  - `docs/PROGRESS.md`
    - appended the terse task-completion note.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts`
    - failed with `TypeError: service.notifyLaneOwnerAboutTemperatureExcursions is not a function`.
  - RED: `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
    - failed with missing `emitTemperatureExcursion` / `publishTemperatureExcursion` methods.
  - RED: `npm test -- --runInBand src/modules/cold-chain/cold-chain.service.spec.ts`
    - failed because cold-chain still called the old generic `notifyLaneOwner(...)` path.
  - GREEN: `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`
    - all focused cold-chain/notification unit tests passed.
- Tests run and results:
  - `npx prisma format --schema prisma/schema.prisma`
    - passed.
  - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`
    - passed.
  - `npm run typecheck`
    - passed.
  - `npm run lint`
    - passed.
  - `npm run build`
    - passed.
- Wiring verification evidence:
  - `ColdChainService.ingestLaneReadings()` still calls `notifyAboutNewExcursions()` after `replaceExcursions()`; that hook now delegates to `NotificationService.notifyLaneOwnerAboutTemperatureExcursions(...)`.
  - `NotificationService.notifyLaneOwnerAboutTemperatureExcursions(...)` still uses the existing notification row creation path, then fans out `notification.new` plus `temperature.excursion` through `NotificationPubSub`.
  - `NotificationPubSub` now subscribes to both `notification.created` and `temperature.excursion`, with direct gateway fallback when Redis is unavailable.
  - `NotificationGateway.emitTemperatureExcursion()` emits into the existing authenticated `/ws` room model.
  - `PrismaColdChainStore.replaceExcursions(...)` updates `lanes.cold_chain_sla_breached_at` in the same transaction that rewrites the lane’s excursion set.
- Behavior changes and risk notes:
  - moderate alerts now force email delivery attempts, severe alerts add push, and critical alerts add every configured channel; missing targets still fail open and log warnings.
  - the lane breach flag is sticky in this task: once a critical excursion has been seen, later non-critical updates do not clear `cold_chain_sla_breached_at`.
  - websocket event delivery is best-effort and intentionally does not roll back reading/excursion persistence.
- Follow-ups / known gaps:
  - the new `cold_chain_sla_breached_at` field is persisted but not yet surfaced through lane detail/list APIs.
  - no frontend websocket consumer changes were made in this task.

## 2026-03-28 12:06 ICT

- Goal: raise confidence from code-shape coverage to live runtime confidence for Task `14.4`.
- What changed:
  - `src/modules/cold-chain/cold-chain.pg-store.ts`
    - fixed both raw SQL insert paths to generate UUID ids explicitly for `temperature_readings` and `excursions`.
  - `src/modules/cold-chain/cold-chain.pg-store.spec.ts`
    - added a real Postgres-backed integration spec covering `createTemperatureReadings(...)` and `replaceExcursions(...)` with sticky critical breach persistence.
  - `docs/PROGRESS.md`
    - appended the runtime-confidence pass note.
- TDD evidence:
  - RED: `DATABASE_URL=$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env) npm test -- --runInBand src/modules/cold-chain/cold-chain.pg-store.spec.ts`
    - failed with `null value in column "id" of relation "excursions" violates not-null constraint`.
  - GREEN: `DATABASE_URL=$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env) npm test -- --runInBand src/modules/cold-chain/cold-chain.pg-store.spec.ts`
    - passed after adding explicit UUID generation to both raw insert paths.
- Tests run and results:
  - `npm run db:generate`
    - passed.
  - `npx prisma migrate deploy`
    - passed; applied pending local migrations through `20260328120000_task_14_4_excursion_alerting`.
  - `psql "$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env | sed 's/[?]schema=public$//')" -c "select column_name, data_type from information_schema.columns where table_name = 'lanes' and column_name = 'cold_chain_sla_breached_at';"`
    - passed; returned `cold_chain_sla_breached_at | timestamp without time zone`.
  - `DATABASE_URL=$(sed -n 's/^DATABASE_URL=\"\\(.*\\)\"/\\1/p' .env) npm test -- --runInBand src/modules/cold-chain/cold-chain.pg-store.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`
    - passed.
  - `npm run typecheck`
    - passed.
  - `npm run lint`
    - passed.
  - `npm run build`
    - passed.
- Wiring verification evidence:
  - the live DB-backed `PrismaColdChainStore` spec now proves `createTemperatureReadings(...)` can insert rows into `temperature_readings` and `replaceExcursions(...)` can insert rows into `excursions` while updating `lanes.cold_chain_sla_breached_at`.
  - the migration deploy output confirms the new lane column exists in the same database the app is configured to use locally.
  - the focused notification/cold-chain suite stayed green after the raw SQL fix, so the DB repair did not regress the alerting flow.
- Behavior changes and risk notes:
  - before this pass, live temperature ingestion would have failed on both raw insert paths because the SQL migrations created UUID primary keys without DB-level defaults; this is now fixed.
  - the remaining gap is test-layer, not implementation-layer: there is still no full HTTP e2e harness using a real Postgres DB for `/lanes/:id/temperature`.
- Follow-ups / known gaps:
  - expose `cold_chain_sla_breached_at` through lane read models if operators need it in the API/UI.

## Review (2026-03-28 12:06 ICT) - working-tree (task-14.4 scope)

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree, limited to Task `14.4` files and the DB-confidence follow-up
- Commands Run: `git diff -- prisma/schema.prisma prisma/migrations/20260328120000_task_14_4_excursion_alerting/migration.sql src/modules/cold-chain/cold-chain.pg-store.ts src/modules/cold-chain/cold-chain.pg-store.spec.ts src/modules/cold-chain/cold-chain.service.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/notifications/notification.constants.ts src/modules/notifications/notification.gateway.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/notification.service.ts src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.types.ts docs/PROGRESS.md`, focused unit tests, live DB-backed cold-chain store spec, `npx prisma migrate deploy`, `npm run typecheck`, `npm run lint`, `npm run build`

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
- Assumed the sticky breach timestamp is the intended product behavior because the task asks for a critical SLA breach flag, not automatic breach clearance semantics.
- Assumed realtime websocket delivery should remain independent of stored notification preferences for operator visibility.

### Recommended Tests / Validation
- Add one real HTTP e2e test against Postgres for `POST /lanes/:id/temperature` when the repo gets a DB-backed cold-chain harness.
- If the lane API is expected to expose breach state soon, add a lane read-path test once that field is surfaced.

### Rollout Notes
- Local migration has been applied successfully; deploy environments still need the additive migration before live temperature ingestion uses this code.
- No backward-incompatible API changes were introduced; rollback remains code rollback plus leaving the nullable lane column unused.
