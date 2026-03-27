## Plan Draft A

### Overview
Implement Task 18 as a new `notifications` backend module with durable in-app storage, user preferences, REST APIs, and authenticated WebSocket fanout for live delivery. Wire real producer call sites for pack generation completion, cold-chain excursion detection, and rule updates, and keep email/LINE/push delivery as config-gated runtime adapters so the feature is live without fake infrastructure.

### Files to Change
- `package.json` - add Nest WebSocket/runtime dependencies if missing.
- `prisma/schema.prisma` - add notification enums/models and relations.
- `prisma/migrations/*/migration.sql` - create additive notification tables/indexes.
- `src/app.module.ts` - register `NotificationModule`.
- `src/common/auth/auth.types.ts` - add owner-resolution support if notification auth needs it.
- `src/common/auth/auth.guards.ts` - reuse JWT/RBAC patterns for notification routes.
- `src/modules/notifications/notification.module.ts` - module wiring.
- `src/modules/notifications/notification.constants.ts` - DI tokens and defaults.
- `src/modules/notifications/notification.types.ts` - records, DTO-facing shapes, channel/type enums.
- `src/modules/notifications/notification.pg-store.ts` - persistence/query layer.
- `src/modules/notifications/notification.service.ts` - orchestration, preferences, dispatch, unread counts.
- `src/modules/notifications/notification.controller.ts` - REST endpoints.
- `src/modules/notifications/notification.gateway.ts` - authenticated WebSocket gateway and user-room fanout.
- `src/modules/notifications/notification.channels.ts` - email/LINE/push/in-app channel senders and config gating.
- `src/modules/notifications/*.spec.ts` - unit coverage.
- `test/notifications.e2e-spec.ts` - route wiring and auth/in-app flow.
- `src/modules/evidence/proof-pack.service.ts` - emit pack-generated notification.
- `src/modules/cold-chain/cold-chain.service.ts` - emit excursion notification for new excursions.
- `src/modules/rules-engine/rules-engine.service.ts` - emit rule-change notification to affected exporters/admin audiences.
- `docs/PROGRESS.md` - terse progress note.

### Implementation Steps
#### TDD Sequence
1. Add Prisma schema tests/usage-facing unit tests and notification service/controller specs first.
2. Run focused tests and confirm failure due to missing module/store/schema symbols.
3. Implement smallest schema + store + service changes to pass unit tests.
4. Add e2e coverage for `/notifications` and websocket fanout, confirm RED.
5. Implement controller/module/gateway wiring, then rerun fast gates.

#### Functions
- `NotificationService.listNotifications(userId, filter)` - return paginated notifications scoped to a user and filters.
- `NotificationService.markAsRead(userId, notificationId)` - idempotently mark only the caller's notification read.
- `NotificationService.getUnreadCount(userId)` - return unread count for dashboard polling.
- `NotificationService.notify(input)` - persist notification, honor preferences, fan out through enabled channels.
- `NotificationService.updatePreferences(userId, input)` - store per-type/channel preference matrix.
- `NotificationGateway.handleConnection()` - authenticate JWT from handshake and join a per-user room.
- `NotificationGateway.emitNotification(userId, notification)` - send `notification.new`.
- `NotificationChannels.sendEmail/sendLine/sendPush/sendInApp()` - config-gated transports; fail closed per-channel, not for persistence.
- `ProofPackService.completeLeasedJob()` - emit pack-ready notification after pack persists.
- `ColdChainService.ingestLaneReadings()` - emit notifications for newly detected excursions after replace/store result.
- `RulesEngineService.createSubstance/updateSubstance()` - emit rule-update notifications after transaction success.

#### Expected Behavior / Edge Cases
- Notification persistence is the source of truth; channel delivery failures do not delete stored notifications.
- Missing external config disables that channel with warning logs; in-app storage still succeeds.
- Mark-read is idempotent and forbidden for another user’s notification.
- WebSocket delivery is best-effort for connected users only; unread API remains canonical.
- Rule update notification audience is limited to exporters with lanes in the affected market to avoid blasting all users.

### Test Coverage
- `notification.service.spec.ts`
  - `notify persists notification and unread state` - stored row is created before fanout.
  - `notify respects per-type channel preferences` - disabled channels are skipped.
  - `markAsRead ignores already-read notifications` - idempotent read behavior.
  - `getUnreadCount returns scoped count` - only caller notifications counted.
- `notification.gateway.spec.ts`
  - `rejects missing jwt handshake` - unauthenticated socket blocked.
  - `emits notification.new to user room` - active user receives payload.
- `notification.controller.spec.ts`
  - `lists filtered notifications` - read/type/page filters applied.
  - `marks notification as read` - success response and ownership enforcement.
- `test/notifications.e2e-spec.ts`
  - `GET /notifications requires jwt` - unauthorized without token.
  - `GET /notifications returns user-scoped rows` - no cross-user leakage.
  - `PATCH /notifications/:id/read marks row read` - read timestamp persists.
  - `GET /notifications/unread-count returns count` - dashboard-compatible API.
- `proof-pack.service.spec.ts`
  - `completeLeasedJob creates pack notification` - pack-ready producer wiring.
- `cold-chain.service.spec.ts`
  - `ingestLaneReadings creates excursion notification` - new excursions emit alert.
- `rules-engine.service.spec.ts`
  - `updateSubstance creates rule update notifications` - affected exporters notified.

### Decision Completeness
- Goal: ship backend notification substrate required by Task 18 with real REST, realtime, persistence, and producer wiring.
- Non-goals: frontend settings screens, Redis pub/sub, mobile push token lifecycle, full external provider credential management UI.
- Success criteria:
  - `/notifications`, `/notifications/:id/read`, `/notifications/unread-count` work with JWT scoping.
  - `notification.new` is emitted for connected users on new in-app notifications.
  - Pack-ready, excursion, and rule-update producers create durable notifications.
  - Preferences suppress disabled channels while leaving in-app persistence intact.
- Public interfaces:
  - New DB tables: `notifications`, `notification_preferences`.
  - New enums: notification type/channel/status if needed.
  - New REST endpoints under `/notifications`.
  - New WebSocket event: `notification.new`.
  - New env vars: optional SES/LINE/push config keys if transport adapters need them.
- Edge cases / failure modes:
  - External delivery provider unavailable: fail closed for that channel, keep stored notification and log warning.
  - No preference row exists: default to in-app enabled and external channels disabled.
  - Duplicate pack/excursion events: each producer call creates a separate notification unless dedupe key is intentionally added.
  - WebSocket disconnected: unread polling still shows notification.
- Rollout & monitoring:
  - Additive migration only.
  - Safe backout: stop using module/routes; tables can remain.
  - Watch logs for external channel skips/failures and notification creation errors.
- Acceptance checks:
  - `npm run db:generate`
  - focused unit specs for notification module and producer hooks
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm run lint && npm run typecheck && npm run build`

### Dependencies
- Nest WebSocket support packages if absent.
- Existing JWT auth service for REST and socket auth.
- Shared DB pool from Task 33.

### Validation
- Confirm migration applies and client generates.
- Confirm new routes appear via e2e.
- Confirm websocket connection authenticates and receives `notification.new`.
- Confirm producer tests prove pack/excursion/rule-update wiring.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationController` | HTTP `/notifications*` | `NotificationModule.controllers`, `AppModule.imports` | `notifications`, `notification_preferences` |
| `NotificationGateway` | WebSocket `/ws` notification fanout | `NotificationModule.providers`, Nest websocket runtime | `notifications` |
| `NotificationService.notify()` | Proof pack, cold-chain, rules-engine producer call sites | injected via `NotificationModule.exports` into producer modules | `notifications` |
| `NotificationPgStore` | service persistence/query methods | `NotificationModule.providers` | `notifications`, `notification_preferences` |
| Migration `add_notifications` | Prisma migration apply | `npx prisma migrate deploy` | `notifications`, `notification_preferences` |

### Decision-Complete Checklist
- No open design decisions remain for the implementer.
- Public interfaces and env vars are explicitly named.
- Every behavior change has at least one planned test.
- Validation commands are scoped and concrete.
- Wiring verification covers routes, gateway, service, and migration.

## Plan Draft B

### Overview
Implement Task 18 with a smaller first slice centered on in-app notifications only, plus a websocket gateway and stored preferences, while exposing channel intents in the schema but deferring actual external delivery transports. This reduces moving parts and lets Task 9.4 and 14.4 build on a stable notification core before SES/LINE specifics are introduced.

### Files to Change
- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `src/app.module.ts`
- `src/modules/notifications/notification.module.ts`
- `src/modules/notifications/notification.types.ts`
- `src/modules/notifications/notification.pg-store.ts`
- `src/modules/notifications/notification.service.ts`
- `src/modules/notifications/notification.controller.ts`
- `src/modules/notifications/notification.gateway.ts`
- `src/modules/evidence/proof-pack.service.ts`
- `src/modules/cold-chain/cold-chain.service.ts`
- `src/modules/rules-engine/rules-engine.service.ts`
- `src/modules/notifications/*.spec.ts`
- `test/notifications.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps
#### TDD Sequence
1. Add service and controller tests for in-app rows, unread count, and read marking.
2. Run RED tests showing missing models/service/module wiring.
3. Implement schema/store/service/controller.
4. Add websocket authentication/fanout tests.
5. Wire producers and rerun focused gates.

#### Functions
- `NotificationService.createInAppNotification()` - persist unread notification row for a target user.
- `NotificationService.listNotifications()` - paginated listing.
- `NotificationService.markRead()` - scoped mark-read behavior.
- `NotificationService.getUnreadCount()` - count unread rows.
- `NotificationGateway.emitNotification()` - socket room fanout only.
- Producer methods in proof-pack/cold-chain/rules-engine call the in-app service after success.

#### Expected Behavior / Edge Cases
- Only in-app channel exists at runtime; preferences are stored but only affect in-app enablement.
- External delivery is explicitly not attempted, avoiding fake integrations.
- WebSocket remains best-effort.

### Test Coverage
- `notification.service.spec.ts`
  - `createInAppNotification stores unread row` - durable persistence.
  - `listNotifications filters by type and read state` - query filtering.
  - `markRead is scoped to owner` - no cross-user mutation.
- `notification.gateway.spec.ts`
  - `authenticated client receives notification.new` - room fanout.
- `test/notifications.e2e-spec.ts`
  - `notification routes are jwt protected` - auth enforcement.
  - `unread-count reflects newly created notifications` - dashboard polling.
- Producer specs for pack/excursion/rule-update - service called and row created.

### Decision Completeness
- Goal: deliver a robust in-app notification substrate and realtime signal.
- Non-goals: SES, LINE, push provider delivery.
- Success criteria:
  - routes and websocket event work
  - producer hooks create stored notifications
  - unread counts and read updates are correct
- Public interfaces:
  - DB tables `notifications`, `notification_preferences`
  - REST `/notifications*`
  - WebSocket `notification.new`
- Edge cases / failure modes:
  - gateway unavailable: row still stored
  - no preferences: in-app defaults enabled
  - duplicate producer events: multiple rows allowed
- Rollout & monitoring:
  - additive migration
  - watch notification creation/read logs
- Acceptance checks:
  - focused unit and e2e tests
  - build/typecheck/lint

### Dependencies
- Nest WebSocket support packages.

### Validation
- Apply migration and generate client.
- Run notification unit/e2e suites and producer-focused tests.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationController` | HTTP `/notifications*` | `NotificationModule` + `AppModule` | `notifications` |
| `NotificationGateway` | JWT-authenticated socket connection | `NotificationModule.providers` | `notifications` |
| `NotificationService` | proof-pack/cold-chain/rules-engine call sites | exported from `NotificationModule` | `notifications`, `notification_preferences` |
| Migration `add_notifications` | Prisma migration apply | `npx prisma migrate deploy` | `notifications`, `notification_preferences` |

### Decision-Complete Checklist
- No open decisions remain.
- Public interfaces are named.
- Tests cover each behavior change.
- Validation commands are concrete.

## Comparative Analysis & Synthesis
- Draft A strength: satisfies the task text more fully by shipping real multi-channel adapters and preference-aware routing now.
- Draft A gap: wider surface area, more dependency risk, and more failure handling complexity.
- Draft B strength: faster, lower-risk core that cleanly unlocks downstream alert tasks.
- Draft B gap: under-delivers on “multi-channel” and leaves email/LINE/push as paper wiring.
- Trade-off: the repo currently has no notification infrastructure, Redis, or provider SDKs; overbuilding transports now would increase breakage risk, but not exposing any channel model would leave the design incomplete.
- Best synthesis: persist the full notification/prefs model and implement real runtime adapters for in-app plus config-gated email/LINE/push dispatch, while keeping those adapters lightweight and non-blocking. That gives real multi-channel code paths without coupling this batch to external credentials or queue infrastructure.

## Unified Execution Plan

### Overview
Implement a new `NotificationModule` that owns durable notification records, per-type/channel preferences, JWT-protected REST APIs, and authenticated WebSocket delivery for connected users. Wire pack generation, excursion detection, and rule updates into that module, and ship lightweight but real multi-channel adapters so in-app always works and external channels activate automatically when configured.

### Files to Change
- `package.json` - add websocket dependencies if absent.
- `prisma/schema.prisma` - add notification enums, `Notification`, and `NotificationPreference`.
- `prisma/migrations/*/migration.sql` - additive migration for notification tables and indexes.
- `src/app.module.ts` - import `NotificationModule`.
- `src/modules/notifications/notification.module.ts` - module wiring and exports.
- `src/modules/notifications/notification.constants.ts` - DI tokens, env defaults, gateway config.
- `src/modules/notifications/notification.types.ts` - domain types, filters, DTO shapes, channel adapters.
- `src/modules/notifications/notification.pg-store.ts` - DB operations for list/count/create/read/preferences and audience lookup.
- `src/modules/notifications/notification.service.ts` - canonical persistence + preference-aware dispatch orchestration.
- `src/modules/notifications/notification.controller.ts` - `/notifications`, `/:id/read`, `/unread-count`.
- `src/modules/notifications/notification.gateway.ts` - JWT handshake validation and `notification.new` room fanout.
- `src/modules/notifications/notification.channels.ts` - config-gated email/LINE/push/in-app senders.
- `src/modules/evidence/proof-pack.service.ts` - send pack-generated notification after completion.
- `src/modules/cold-chain/cold-chain.service.ts` - send excursion notifications for newly stored excursions.
- `src/modules/rules-engine/rules-engine.service.ts` - send rule-update notifications after substance create/update commits.
- `src/modules/notifications/*.spec.ts` - unit tests for service/controller/gateway/store behavior.
- `test/notifications.e2e-spec.ts` - end-to-end API and socket flow.
- `docs/PROGRESS.md` - note Task 18 completion and coverage.

### Implementation Steps
#### TDD Sequence
1. Add notification service/controller/gateway test scaffolds and e2e route expectations.
2. Run focused tests to capture RED failures from missing module/schema/runtime wiring.
3. Implement Prisma schema + migration + store primitives.
4. Implement service and controller until unit tests pass.
5. Implement gateway and socket auth/fanout until websocket tests pass.
6. Wire producer call sites in proof-pack, cold-chain, and rules-engine and extend focused tests.
7. Run formatter/lint/typecheck/build and focused e2e.

#### Functions
- `NotificationService.notifyUsers(input)` - accept typed notification creation input, persist per-recipient rows, dispatch to enabled channels, and emit websocket fanout.
- `NotificationService.listNotifications(userId, filter)` - filter by `read`, `type`, and page.
- `NotificationService.markAsRead(userId, notificationId)` - idempotent owner-scoped update.
- `NotificationService.getUnreadCount(userId)` - unread count query.
- `NotificationService.getPreferences(userId)` / `upsertDefaultPreferencesIfMissing(userId)` - ensure stable defaults.
- `NotificationPgStore.createNotifications()` - bulk insert notification rows.
- `NotificationPgStore.listNotifications()` - paginated ordered query.
- `NotificationPgStore.markNotificationRead()` - scoped update returning whether a row changed.
- `NotificationPgStore.listExporterUserIdsByMarket()` - rule-change audience resolution.
- `NotificationGateway.handleConnection()` - verify JWT and join `user:{id}` room.
- `NotificationGateway.emitNotification()` - emit `notification.new`.
- `NotificationChannels.send*()` - best-effort per-channel dispatch with logging.

#### Expected Behavior / Edge Cases
- In-app persistence is mandatory; if DB write fails, the notification is not considered sent.
- External channel failure does not roll back the stored notification.
- Default preferences: in-app enabled for all supported types; email/LINE/push disabled until explicitly enabled.
- Rule updates notify exporters with active lanes in the affected market plus admins/auditors.
- Excursion notifications only send for newly detected excursions in the latest ingest result, not every historical excursion replay.
- Read marking returns success whether the row was newly read or already read, but still forbids cross-user access.

### Test Coverage
- `src/modules/notifications/notification.service.spec.ts`
  - `notifyUsers creates rows before dispatch` - persistence-first behavior.
  - `notifyUsers skips disabled channels per preference` - preference routing.
  - `notifyUsers emits websocket for in-app recipients` - live fanout.
  - `getUnreadCount scopes to caller` - no leakage.
  - `markAsRead is idempotent and scoped` - owner-safe updates.
- `src/modules/notifications/notification.gateway.spec.ts`
  - `handleConnection rejects invalid jwt` - socket auth enforcement.
  - `emitNotification targets user room` - room-based delivery.
- `src/modules/notifications/notification.controller.spec.ts`
  - `GET /notifications maps filters correctly` - query parsing.
  - `PATCH /notifications/:id/read marks row read` - route-to-service wiring.
  - `GET /notifications/unread-count returns count payload` - dashboard contract.
- `test/notifications.e2e-spec.ts`
  - `GET /notifications requires JWT` - auth required.
  - `GET /notifications returns only caller notifications` - user scoping.
  - `PATCH /notifications/:id/read updates readAt` - durable read state.
  - `GET /notifications/unread-count reflects unread rows` - dashboard polling.
- Producer-focused specs
  - `proof-pack.service.spec.ts` - pack-ready notification created.
  - `cold-chain.service.spec.ts` - new excursions create notification rows.
  - `rules-engine.service.spec.ts` - rule updates create audience notifications.

### Decision Completeness
- Goal: complete Task 18 backend notification system with durable in-app alerts, realtime delivery, preference-aware multi-channel routing, and producer wiring.
- Non-goals:
  - frontend notification center/settings UI
  - Redis pub/sub or cross-instance socket broadcast
  - mobile device registration and true push provider delivery guarantees
  - scheduled certification expiry jobs from Task 9.4
- Success criteria:
  - Additive migration applied for notification tables.
  - All three REST endpoints work with JWT scoping.
  - `notification.new` is emitted for connected users.
  - Proof-pack, excursion, and rule-update producers create notifications.
  - Preferences suppress external channels by default and route correctly when enabled.
- Public interfaces:
  - DB schema: `notifications`, `notification_preferences`
  - REST: `GET /notifications`, `PATCH /notifications/:id/read`, `GET /notifications/unread-count`
  - WS: `notification.new`
  - Optional env vars: `AWS_SES_REGION`, `AWS_SES_FROM_EMAIL`, `LINE_CHANNEL_ACCESS_TOKEN`, `NOTIFICATIONS_PUSH_WEBHOOK_URL`
- Edge cases / failure modes:
  - Missing JWT on socket or HTTP: reject request/connection.
  - Channel adapter missing config: skip channel and log warning.
  - Notification write succeeds but websocket emit fails: row remains unread and API still exposes it.
  - Duplicate upstream producer call: separate rows are acceptable in this batch.
  - Fail closed vs fail open: DB persistence fails closed; external delivery fails open relative to stored notification.
- Rollout & monitoring:
  - Migration is additive and safe to deploy before app rollout.
  - No feature flag required; routes/gateway become live on deploy.
  - Monitor warning/error logs for skipped channels, dispatch failures, and notification creation failures.
  - Backout: revert app code; leave additive tables in place.
- Acceptance checks:
  - `npm run db:generate`
  - `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.gateway.spec.ts`
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Existing JWT auth service and guards.
- Shared DB pool module from Task 33.
- Nest WebSocket runtime packages if not already installed.

### Validation
- Generate Prisma client and verify migration SQL is additive.
- Run focused unit tests in RED then GREEN sequence.
- Run notifications e2e and confirm ownership/auth behavior.
- Verify runtime wiring with exact-string checks:
  - `rg -n "@Controller\\('notifications'\\)|notification.new|@WebSocketGateway|NotificationModule" src test`
  - `rg -n "NotificationService|notifyUsers" src | rg -v "spec"`

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationController` | HTTP `/notifications`, `/notifications/:id/read`, `/notifications/unread-count` | `src/modules/notifications/notification.module.ts`, `src/app.module.ts` | `notifications`, `notification_preferences` |
| `NotificationGateway` | JWT-authenticated websocket clients connect and receive `notification.new` | `src/modules/notifications/notification.module.ts` provider registration | `notifications` |
| `NotificationService.notifyUsers()` | called from proof-pack, cold-chain, and rules-engine services | `NotificationModule.exports` imported by producer modules | `notifications`, `notification_preferences` |
| `NotificationPgStore` | service persistence/query path | `NotificationModule.providers` with shared DB pool | `notifications`, `notification_preferences` |
| Notification migration | deploy-time DB change | Prisma migration applied via `npx prisma migrate deploy` | `notifications`, `notification_preferences` |

### Decision-Complete Checklist
- No open decisions remain for implementation.
- Every public interface is listed and named consistently.
- Every behavior change has planned unit/e2e coverage.
- Validation commands are explicit.
- Wiring verification covers each new runtime component and migration.

## Implementation (2026-03-27 22:33:00 +07)

### Goal
Implement Task 18 as a real backend notification substrate with durable storage, JWT-protected APIs, websocket fanout, preference-aware routing, and producer hooks from proof-pack, cold-chain, and rules-engine flows.

### What Changed
- `package.json`, `package-lock.json`
  - Added Nest websocket runtime packages, `socket.io`, `socket.io-client`, and `@aws-sdk/client-ses`.
- `prisma/schema.prisma`
  - Added `NotificationType`, `Notification`, and `NotificationPreference`, plus `User`/`Lane` relations.
- `prisma/migrations/20260327223000_add_notifications_module/migration.sql`
  - Added the notification enum, tables, and supporting indexes.
- `src/modules/notifications/*`
  - Added the new notification module, pg store, service, controller, gateway, channel dispatcher, constants, types, and unit tests.
  - Exposed `GET /notifications`, `PATCH /notifications/:id/read`, `GET /notifications/unread-count`, plus `GET/PUT /notifications/preferences`.
  - Implemented authenticated websocket room fanout for `notification.new`.
  - Implemented preference-aware multi-channel dispatch with in-app persistence and config-gated SES/LINE/push senders.
- `src/app.module.ts`
  - Registered `NotificationModule`.
- `src/modules/evidence/evidence.module.ts`, `src/modules/evidence/proof-pack.service.ts`, `src/modules/evidence/proof-pack.service.spec.ts`
  - Imported the notification module into evidence and emit pack-ready notifications after successful proof-pack completion.
- `src/modules/cold-chain/cold-chain.module.ts`, `src/modules/cold-chain/cold-chain.service.ts`, `src/modules/cold-chain/cold-chain.service.spec.ts`
  - Injected notification service into cold-chain and emit excursion notifications only for newly detected excursions.
- `src/modules/rules-engine/rules-engine.module.ts`, `src/modules/rules-engine/rules-engine.service.ts`, `src/modules/rules-engine/rules-engine.service.spec.ts`
  - Injected notification service into the rules engine and emit rule-change notifications after substance create/update transactions commit.
- `test/notifications.e2e-spec.ts`
  - Added route-level e2e coverage for auth, list/read/count behavior.
- `docs/PROGRESS.md`
  - Recorded Task 18 completion.

### TDD Evidence
- RED
  - `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.gateway.spec.ts`
  - Failed with missing module errors for `./notification.service`, `./notification.controller`, and `./notification.gateway`.
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - Failed with `404 Not Found` for `/notifications*` routes before `NotificationModule` was registered in `AppModule`.
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - Failed because producer hooks were not calling the notification service.
- GREEN
  - `npm run db:generate`
  - `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts test/proof-pack.e2e-spec.ts`
  - `npm run lint && npm run typecheck && npm run build`

### Tests Run
- `npm run db:generate`
- `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
- `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
- `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts test/proof-pack.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Wiring Verification Evidence
- `src/app.module.ts` imports `NotificationModule`, so `/notifications*` routes are reachable through the real Nest app.
- `src/modules/notifications/notification.module.ts` registers `NotificationController`, `NotificationGateway`, `PrismaNotificationStore`, `NotificationChannels`, and `NotificationService`.
- `src/modules/evidence/evidence.module.ts` imports `NotificationModule`, and `ProofPackService.completeLeasedJob()` now calls `notificationService.notifyLaneOwner(...)`.
- `src/modules/cold-chain/cold-chain.module.ts` imports `NotificationModule`, and `ColdChainService.ingestLaneReadings()` now calls `notifyAboutNewExcursions(...)`.
- `src/modules/rules-engine/rules-engine.module.ts` imports `NotificationModule`, and `RulesEngineService.createSubstance()` / `updateSubstance()` now call `notifyRuleChange(...)` after transaction success.
- `test/notifications.e2e-spec.ts` proves the `/notifications` controller is wired through `AppModule`.

### Behavior Changes And Risk Notes
- Fail closed for persistence: if `notifications` insert fails, no notification is considered delivered.
- Fail open for external channels: notification rows remain durable even if SES/LINE/push dispatch fails.
- Websocket fanout is best-effort and local-instance only; unread API remains the source of truth across reconnects.
- LINE and push delivery are intentionally config-gated and currently rely on deployment-time credentials/webhooks rather than user-managed destination identifiers.

### Follow-Ups / Known Gaps
- Realtime fanout is instance-local only; cross-instance broadcast still needs Redis/pub-sub if the deployment scales horizontally.
- Notification preferences API is additive and backend-only; frontend settings screens still need to consume it.

## Review (2026-03-27 22:36:07 +0700) - working-tree (task-18 notification slice)

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree (task 18 files only; ignored unrelated pre-existing local changes)
- Commands Run: `git diff --name-only -- ...`, `git diff -- ...`, `nl -ba src/modules/notifications/notification.service.ts`, `nl -ba src/modules/notifications/notification.pg-store.ts`, `nl -ba src/modules/notifications/notification.channels.ts`, `nl -ba src/modules/notifications/notification.controller.ts`, `nl -ba src/modules/notifications/notification.gateway.ts`, `nl -ba prisma/migrations/20260327223000_add_notifications_module/migration.sql`, `npm run db:generate`, `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`, `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`, `npm run test:e2e -- --runInBand test/auth.e2e-spec.ts test/proof-pack.e2e-spec.ts`, `npm run lint`, `npm run typecheck`, `npm run build`

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
- LINE delivery is intentionally fail-closed for now because no per-user LINE recipient mapping exists in the schema or settings surface yet.
- WebSocket fanout is instance-local only; unread polling remains the durable source of truth across reconnects and multi-instance deployments.

### Recommended Tests / Validation
- Add one focused unit test around `NotificationChannels` so the SES/push/LINE config-gating behavior stays explicit.
- Add a future websocket integration test with `socket.io-client` against a live Nest listener once realtime consumers are in active use.

### Rollout Notes
- Apply `prisma/migrations/20260327223000_add_notifications_module/migration.sql` before deploying the new app code.
- External channels remain safe if unconfigured: notifications persist in-app and logs will show channel skips.
