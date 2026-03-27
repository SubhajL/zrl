## Plan Draft A

### Overview
Extend the existing notifications module with explicit per-user channel targets and Redis-backed cross-instance fanout while preserving the current DB-first notification row as the source of truth. Keep the change additive: notification persistence remains canonical, websocket delivery remains best-effort UX, and external channel delivery fails closed when a user target or provider config is missing.

### Files to Change
- `package.json` - add Redis client/runtime dependencies needed for pubsub fanout.
- `prisma/schema.prisma` - add a `notification_channel_targets` model related to `users`.
- `prisma/migrations/*/migration.sql` - create the additive channel-target table and indexes.
- `src/app.module.ts` - ensure notification module wiring still reaches runtime after new providers are added.
- `src/modules/notifications/notification.module.ts` - register store/service/pubsub providers and lifecycle hooks.
- `src/modules/notifications/notification.constants.ts` - add Redis/pubsub tokens and event names.
- `src/modules/notifications/notification.types.ts` - add DTOs and store/service types for channel targets and pubsub payloads.
- `src/modules/notifications/notification.pg-store.ts` - read/write per-user channel targets and include them in delivery-target lookup.
- `src/modules/notifications/notification.service.ts` - expose channel-target APIs, publish created notifications to Redis, and keep DB-first semantics.
- `src/modules/notifications/notification.controller.ts` - add authenticated routes for getting/updating channel targets.
- `src/modules/notifications/notification.gateway.ts` - receive pubsub fanout and emit `notification.new` to local user rooms.
- `src/modules/notifications/notification.channels.ts` - use per-user LINE/push targets instead of global-only placeholders.
- `src/modules/notifications/notification.pubsub.ts` - Redis publisher/subscriber lifecycle and event dispatch.
- `src/modules/notifications/*.spec.ts` - unit coverage for new store/service/pubsub behavior.
- `test/notifications.e2e-spec.ts` - route coverage for channel-target endpoints and end-to-end delivery behavior.
- `docs/PROGRESS.md` - terse progress note for this slice.

### Implementation Steps
#### TDD Sequence
1. Add and/or extend store/service/controller/pubsub tests for channel-target CRUD, delivery targeting, and cross-instance fanout.
2. Run the focused test commands and confirm failure for the right missing symbols/routes/behavior.
3. Implement the smallest schema, store, service, and pubsub changes to satisfy those failures.
4. Refactor minimally to keep notification creation DB-first and transport wiring clear.
5. Run fast gates: focused tests, then lint, typecheck, and build.

#### Functions
- `NotificationService.getChannelTargets(userId)` - return the caller's stored LINE/push targets with no cross-user leakage.
- `NotificationService.updateChannelTargets(userId, input)` - upsert per-user delivery targets and normalize blanks to `null`.
- `NotificationService.notify(input)` - persist a notification, publish an internal `notification.created` event, then attempt configured external channels.
- `NotificationService.handlePublishedNotification(event)` - consume pubsub payloads and emit local websocket events for connected users.
- `PrismaNotificationStore.getChannelTargets(userId)` - fetch explicit per-user target data.
- `PrismaNotificationStore.upsertChannelTargets(userId, input)` - create/update the additive target row transactionlessly and idempotently.
- `PrismaNotificationStore.getDeliveryTarget(userId)` - include email plus per-user LINE/push targets in the resolved target object.
- `NotificationPubSub.publishNotificationCreated(event)` - publish the canonical fanout payload to Redis after DB persistence.
- `NotificationPubSub.subscribe()` - subscribe once on module init and forward payloads into the service/gateway path.
- `NotificationChannels.sendLine/sendPush()` - fail closed when user targets are absent; send only to explicit user-level destinations.

#### Expected Behavior / Edge Cases
- Notification rows are still written before any websocket or external delivery attempt.
- Missing Redis config degrades to local-only websocket fanout with warning logs; DB persistence still succeeds.
- Missing per-user LINE or push target causes that channel to be skipped, not inferred from env globals.
- Pubsub duplicate delivery must not create duplicate DB rows because pubsub only fans out already-created rows.
- Updating channel targets is idempotent and scoped to the authenticated user only.

### Test Coverage
- `notification.service.spec.ts`
  - `getChannelTargets returns only caller targets` - user-scoped settings fetch.
  - `updateChannelTargets upserts and normalizes blanks` - stable target persistence.
  - `notify publishes after persistence` - DB-first fanout ordering.
  - `notify skips line when user target missing` - fail-closed LINE behavior.
- `notification.pubsub.spec.ts`
  - `publishNotificationCreated emits redis event payload` - publisher uses canonical event.
  - `subscribe forwards parsed payload to service` - subscriber wiring works.
- `notification.controller.spec.ts`
  - `GET channel-targets returns authenticated user state` - scoped fetch route.
  - `PUT channel-targets updates explicit line/push targets` - scoped update route.
- `notification.channels.spec.ts`
  - `sendLine uses per-user line target` - no global recipient fallback.
  - `sendPush uses per-user push endpoint` - per-user push routing.
- `test/notifications.e2e-spec.ts`
  - `channel target routes require jwt` - auth enforcement.
  - `user can update and read own channel targets` - round-trip persistence.
  - `created notifications remain listed even without websocket` - DB remains source of truth.

### Decision Completeness
- Goal: close the two notification residuals by adding explicit user channel targets and multi-instance-safe live fanout.
- Non-goals: full durable outbox redesign, mobile push token verification UX, separate worker deployment, or frontend settings screens.
- Success criteria:
  - `GET/PUT /notifications/channel-targets` work with JWT scoping.
  - LINE and push delivery resolve user-specific targets from DB, not process-wide placeholders.
  - New notifications publish a Redis event and connected clients on any instance can receive `notification.new`.
  - If Redis is unavailable, notification persistence still succeeds and websocket delivery degrades safely.
- Public interfaces:
  - New DB table: `notification_channel_targets`.
  - New REST endpoints: `GET /notifications/channel-targets`, `PUT /notifications/channel-targets`.
  - New env vars: `REDIS_URL` for pubsub; existing LINE/push provider vars remain optional.
  - New internal pubsub topic/key: `notification.created`.
- Edge cases / failure modes:
  - Redis unavailable: fail open for persistence, fail closed for cross-instance fanout, log warning.
  - Missing user target: fail closed for LINE/push send.
  - Duplicate pubsub payload: only duplicate websocket emit risk, no duplicate DB rows.
  - Blank input values: normalized to `null` rather than empty-string targets.
- Rollout & monitoring:
  - Additive migration and optional Redis wiring; backout can disable Redis and leave table unused.
  - Watch logs for Redis connect/subscribe failures and channel-target-missing skips.
  - Keep existing unread/list APIs unchanged.
- Acceptance checks:
  - `npm run db:generate`
  - focused notification unit tests
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm run lint && npm run typecheck && npm run build`

### Dependencies
- Redis runtime reachable via `REDIS_URL` or existing local Docker Compose Redis service.
- Existing JWT auth and notification module wiring from Task 18.

### Validation
- Apply migration and generate Prisma client successfully.
- Verify channel-target endpoints round-trip and remain user-scoped.
- Verify notification creation still persists rows even if Redis or external channel config is absent.
- Verify published notifications are emitted through the gateway consumer path.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationPubSub` | `NotificationService.notify()` publishes and module init subscribes | `NotificationModule.providers` | N/A |
| `GET/PUT /notifications/channel-targets` | `NotificationController` HTTP routes | `NotificationModule.controllers`, `AppModule.imports` | `notification_channel_targets` |
| `PrismaNotificationStore.upsertChannelTargets()` | `NotificationService.updateChannelTargets()` | `NotificationModule.providers` | `notification_channel_targets` |
| Redis event `notification.created` | published after `notifications` insert, consumed by gateway fanout | `NotificationService` + `NotificationPubSub` | `notifications` |
| Migration `add_notification_channel_targets` | applied via Prisma migrate | `npx prisma migrate deploy` | `notification_channel_targets` |

### Decision-Complete Checklist
- No open design decisions remain for the implementer.
- Every new endpoint, env var, table, and event is named.
- Every behavior change has at least one planned test.
- Validation commands are concrete and scoped.
- Wiring verification covers pubsub, routes, store, and migration.
- Rollout/backout is specified.

## Plan Draft B

### Overview
Implement the same user-target and multi-instance goals with a narrower infrastructure change: add explicit per-user channel targets and use the Socket.IO Redis adapter as the only cross-instance fanout mechanism. This is simpler to wire but couples live fanout directly to websocket infrastructure and leaves less room for future non-socket consumers.

### Files to Change
- `package.json`
- `prisma/schema.prisma`
- `prisma/migrations/*/migration.sql`
- `src/main.ts` or websocket bootstrap wiring if Socket.IO adapter lives there
- `src/modules/notifications/notification.module.ts`
- `src/modules/notifications/notification.types.ts`
- `src/modules/notifications/notification.pg-store.ts`
- `src/modules/notifications/notification.service.ts`
- `src/modules/notifications/notification.controller.ts`
- `src/modules/notifications/notification.gateway.ts`
- `src/modules/notifications/notification.channels.ts`
- `src/modules/notifications/*.spec.ts`
- `test/notifications.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps
#### TDD Sequence
1. Add route and service tests for channel-target persistence plus gateway tests for redis-adapter-backed room emit behavior.
2. Run focused tests and confirm failure because target schema/routes and adapter wiring do not exist.
3. Implement target persistence and adapter wiring with the smallest set of changes.
4. Refactor only enough to keep bootstrap and gateway responsibilities clear.
5. Run focused tests, lint, typecheck, and build.

#### Functions
- `NotificationService.getChannelTargets()` / `updateChannelTargets()` - same scoped API as Draft A.
- `PrismaNotificationStore.upsertChannelTargets()` / `getChannelTargets()` - additive per-user target persistence.
- `NotificationChannels.sendLine/sendPush()` - route to explicit user-level targets.
- `bootstrapNotificationRedisAdapter(app)` - configure the Socket.IO Redis adapter for room propagation.

#### Expected Behavior / Edge Cases
- DB remains the source of truth for notifications.
- Cross-instance websocket propagation depends entirely on adapter availability.
- Missing Redis config leaves the gateway local-only with warning logs.
- No separate internal event payload exists beyond the notification object emitted to rooms.

### Test Coverage
- `notification.service.spec.ts`
  - `updateChannelTargets stores explicit line and push values` - target persistence.
  - `notify still persists row before channel dispatch` - DB-first create path.
- `notification.gateway.spec.ts`
  - `gateway emits to user room with adapter configured` - cross-instance-ready room emit.
- `notification.controller.spec.ts`
  - `channel target routes are jwt scoped` - no leakage.
- `notification.channels.spec.ts`
  - `line and push require per-user targets` - fail-closed delivery.
- `test/notifications.e2e-spec.ts`
  - `channel targets round-trip over HTTP` - endpoint behavior.

### Decision Completeness
- Goal: solve the two residuals with fewer new moving parts.
- Non-goals: internal notification event bus, outbox pattern, frontend settings UI.
- Success criteria:
  - per-user targets exist and are used for LINE/push delivery
  - websocket rooms propagate across instances when Redis is configured
  - persistence remains intact when Redis is absent
- Public interfaces:
  - `notification_channel_targets` table
  - `GET/PUT /notifications/channel-targets`
  - `REDIS_URL`
- Edge cases / failure modes:
  - adapter unavailable: local-only websocket
  - missing target: skip channel
  - websocket disconnected: unread polling remains canonical
- Rollout & monitoring:
  - additive schema
  - watch Redis adapter startup errors and delivery-skip logs
- Acceptance checks:
  - focused notification tests
  - lint/typecheck/build

### Dependencies
- Redis and `@socket.io/redis-adapter`

### Validation
- Verify adapter boots without breaking current websocket gateway.
- Verify target endpoints and delivery routing.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Socket.IO Redis adapter | Nest websocket server bootstrap | `main.ts` bootstrap path | N/A |
| `GET/PUT /notifications/channel-targets` | `NotificationController` | `NotificationModule.controllers` | `notification_channel_targets` |
| `PrismaNotificationStore.upsertChannelTargets()` | `NotificationService.updateChannelTargets()` | `NotificationModule.providers` | `notification_channel_targets` |
| LINE/push target lookup | `NotificationService.notify()` channel dispatch | `NotificationChannels` through `NotificationModule.providers` | `notification_channel_targets` |
| Migration `add_notification_channel_targets` | Prisma migrate | deployment migration path | `notification_channel_targets` |

### Decision-Complete Checklist
- Public surface is named.
- Tests cover each behavior change.
- Rollout/backout is specified.
- Wiring is explicit for bootstrap, routes, store, and migration.

## Comparative Analysis & Synthesis

### Strengths
- Draft A preserves a clean DB-first domain event boundary and keeps websocket fanout decoupled from the transport implementation.
- Draft B is smaller and simpler because it leans on the Socket.IO adapter directly.

### Gaps
- Draft A adds more moving parts and Redis lifecycle code to own.
- Draft B under-specifies how future non-socket consumers or side effects would reuse the same event and keeps fanout tightly coupled to websocket runtime.

### Trade-offs
- Draft A is better long-term architecture for the notification system because Redis pubsub becomes an app-level fanout path rather than only a socket transport concern.
- Draft B is cheaper to land, but it solves only the immediate websocket propagation problem and does not provide an internal event contract.

### Compliance Check
- Both drafts stay additive, keep DB-first persistence, follow existing Nest module patterns, and fail closed for missing user-level external channel targets.
- Draft A better matches the previously agreed long-term architecture: DB-first notifications plus explicit channel-target storage plus cross-instance pubsub fanout.

## Unified Execution Plan

### Overview
Implement explicit user-level notification channel targets and Redis-backed `notification.created` pubsub inside the existing notifications module. Persist notification rows first, publish a lightweight fanout event second, and subscribe on every instance so `notification.new` reaches local sockets regardless of which app instance created the notification.

### Files to Change
- `package.json` - add `redis` runtime dependency if absent.
- `prisma/schema.prisma` - add `NotificationChannelTarget` model and relation on `User`.
- `prisma/migrations/*/migration.sql` - additive channel-target migration.
- `src/modules/notifications/notification.constants.ts` - Redis and event constants.
- `src/modules/notifications/notification.types.ts` - DTOs/types for channel targets and pubsub payloads.
- `src/modules/notifications/notification.pg-store.ts` - target persistence and enriched delivery lookup.
- `src/modules/notifications/notification.service.ts` - scoped target APIs, DB-first notify path, pubsub publish/consume.
- `src/modules/notifications/notification.controller.ts` - `GET/PUT /notifications/channel-targets`.
- `src/modules/notifications/notification.gateway.ts` - local room fanout entrypoint for published events.
- `src/modules/notifications/notification.channels.ts` - send LINE/push using explicit user targets.
- `src/modules/notifications/notification.pubsub.ts` - Redis publisher/subscriber lifecycle with warning-only degradation.
- `src/modules/notifications/notification.module.ts` - provider wiring and exports.
- `src/modules/notifications/*.spec.ts` - unit tests for service/controller/channels/pubsub.
- `test/notifications.e2e-spec.ts` - authenticated HTTP route coverage and DB-first notification behavior.
- `docs/PROGRESS.md` - terse progress update.

### Implementation Steps
#### TDD Sequence
1. Add/extend specs for:
   - `NotificationService.updateChannelTargets`
   - `NotificationService.notify` publish-after-persist behavior
   - `NotificationController` channel-target routes
   - `NotificationChannels` LINE/push target resolution
   - `NotificationPubSub` publish/subscribe forwarding
2. Run focused tests and confirm RED for missing schema fields, missing routes, and missing pubsub wiring.
3. Implement the additive Prisma schema/migration and update store/types to satisfy the first failing tests.
4. Implement service/controller/channel/pubsub wiring, keeping the notification insert path canonical and fanout secondary.
5. Run focused unit/e2e tests, then `npm run db:generate`, `npm run lint`, `npm run typecheck`, and `npm run build`.

#### Functions
- `NotificationService.getChannelTargets(userId)` - returns the authenticated user’s current LINE and push destinations.
- `NotificationService.updateChannelTargets(userId, input)` - idempotent upsert with whitespace-to-null normalization.
- `NotificationService.notify(input)` - writes the notification row, resolves preferences/targets, publishes `notification.created`, and dispatches external channels.
- `NotificationService.handlePublishedNotification(event)` - turns a Redis event into local websocket emission.
- `PrismaNotificationStore.getDeliveryTarget(userId)` - includes `email`, `lineUserId`, and `pushEndpoint`.
- `NotificationPubSub.publishNotificationCreated(event)` - publishes serialized event payload when Redis is configured.
- `NotificationPubSub.subscribe(onEvent)` - subscribes on init, parses messages safely, and forwards them.
- `NotificationChannels.sendLine()` - requires both provider config and `lineUserId`.
- `NotificationChannels.sendPush()` - requires an explicit user `pushEndpoint` and configured webhook.

#### Expected Behavior / Edge Cases
- Persisted notifications remain visible via unread/list APIs even if websocket or Redis fanout fails.
- Redis absence or connection failure logs a warning and leaves live fanout local-only rather than breaking notification creation.
- External channels fail closed when user targets or provider config are missing.
- User updates may clear a stored target by sending empty input, which normalizes to `null`.
- Pubsub only carries already-created notification payloads, so replay or duplicate delivery cannot create duplicate DB rows.

### Test Coverage
- `src/modules/notifications/notification.service.spec.ts`
  - `updateChannelTargets creates new target row` - first-write upsert path.
  - `updateChannelTargets clears empty values` - blank normalization.
  - `notify publishes redis event after row insert` - DB-first ordering.
  - `notify skips line delivery without user target` - fail-closed channel behavior.
- `src/modules/notifications/notification.controller.spec.ts`
  - `GET /channel-targets returns caller targets` - scoped fetch.
  - `PUT /channel-targets updates caller targets` - scoped update.
- `src/modules/notifications/notification.channels.spec.ts`
  - `sendLine posts to configured provider for explicit target` - target-based LINE routing.
  - `sendPush posts to explicit endpoint only` - no global recipient fallback.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `publishNotificationCreated no-ops safely without redis` - degradation path.
  - `subscribe forwards parsed event to handler` - subscriber wiring.
- `test/notifications.e2e-spec.ts`
  - `channel target endpoints are jwt protected` - auth enforcement.
  - `channel target round trip persists per user` - end-to-end DB behavior.
  - `created notification still lists when fanout unavailable` - DB-first source of truth.

### Decision Completeness
- Goal: finish Task 18’s remaining architectural gaps without redesigning the rest of notifications.
- Non-goals: durable outbox, worker extraction, frontend settings UI, or provider verification flows.
- Success criteria:
  - `notification_channel_targets` exists and is used for LINE/push routing.
  - users can read/update their own channel targets via authenticated API.
  - `notification.created` is published after persistence and consumed for local websocket fanout.
  - notification persistence remains successful when Redis or external delivery is unavailable.
- Public interfaces:
  - DB schema: `NotificationChannelTarget` / `notification_channel_targets`.
  - HTTP: `GET /notifications/channel-targets`, `PUT /notifications/channel-targets`.
  - Env vars: `REDIS_URL` (optional), existing LINE/push provider vars.
  - Internal topic: `notification.created`.
- Edge cases / failure modes:
  - Redis down: fail open for stored notifications, fail closed for cross-instance live fanout.
  - Missing user target: LINE/push skipped with warning.
  - Invalid pubsub payload: ignored with warning.
  - Concurrent target updates: last write wins; no cross-user mutation path.
- Rollout & monitoring:
  - Additive migration; safe to deploy before clients use the new endpoints.
  - Backout by disabling Redis config and ignoring target routes; existing notification APIs stay intact.
  - Monitor Redis connectivity warnings and channel-skip counts in logs.
- Acceptance checks:
  - `npm run db:generate`
  - `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Redis reachable via `REDIS_URL` or local Compose service.
- Existing JWT guards and notifications module.

### Validation
- Prisma client generates and migration SQL is additive.
- Notification target endpoints round-trip data and remain user-scoped.
- Notification creation still stores rows with Redis disabled.
- With Redis mocked/enabled, published events reach the gateway emission path.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationChannelTarget` migration | Prisma deployment/app startup migration process | `prisma/migrations/.../migration.sql` via Prisma migrate | `notification_channel_targets` |
| `NotificationService.getChannelTargets/updateChannelTargets` | `NotificationController` authenticated routes | `NotificationModule.providers` + `NotificationModule.controllers` | `notification_channel_targets` |
| `NotificationPubSub` | publish from `NotificationService.notify`, subscribe on module init | `NotificationModule.providers` | N/A |
| `NotificationGateway.emitNotification` | `NotificationService.handlePublishedNotification` | `NotificationGateway` provider in `NotificationModule` | `notifications` |
| `NotificationChannels.sendLine/sendPush` | `NotificationService.notify` dispatch path | `NotificationModule.providers` | reads `notification_channel_targets`, `users.email`, `notifications` |

### Cross-Language Schema Verification
- TypeScript Prisma model and SQL migration will both use `notification_channel_targets`.
- The repo is TypeScript-only for this backend path; verification will be done with exact-string search across `src/`, `prisma/`, and `test/` before finalizing migration/table names.

### Decision-Complete Checklist
- No open decisions remain for implementation.
- Public interfaces, env vars, table names, and event names are explicitly listed.
- Each behavior change has at least one test.
- Validation commands are specific.
- Wiring verification covers every new component and migration.
- Rollout/backout and degradation behavior are specified.

## Implementation Summary (2026-03-28 04:35 ICT)

### Goal
Finish the two remaining Task 18 residues by adding explicit per-user notification targets and cross-instance-safe realtime fanout without regressing DB-first notification persistence.

### What Changed
- `package.json`, `package-lock.json`
  - Added the `redis` runtime dependency for in-process publish/subscribe fanout.
- `prisma/schema.prisma`
  - Added `NotificationChannelTarget` and a one-to-one relation from `User`.
- `prisma/migrations/20260328043200_add_notification_channel_targets/migration.sql`
  - Added the additive `notification_channel_targets` table.
- `src/modules/notifications/notification.types.ts`
  - Added channel-target types, enriched delivery targets, and a fanout publisher contract.
- `src/modules/notifications/notification.constants.ts`
  - Added the `notification.created` pubsub channel constant.
- `src/modules/notifications/notification.pg-store.ts`
  - Added `getChannelTargets` / `upsertChannelTargets` and joined per-user targets into delivery-target lookup.
- `src/modules/notifications/notification.service.ts`
  - Added scoped channel-target APIs and switched in-app fanout from direct gateway emit to a DB-first publish path.
- `src/modules/notifications/notification.controller.ts`
  - Added authenticated `GET /notifications/channel-targets` and `PUT /notifications/channel-targets`.
- `src/modules/notifications/notification.channels.ts`
  - LINE delivery now requires a stored `lineUserId`; push delivery now posts only to the configured provider webhook and includes the per-user `pushEndpoint` token in the payload, avoiding arbitrary user-controlled fetch URLs.
- `src/modules/notifications/notification.pubsub.ts`
  - Added Redis publisher/subscriber lifecycle with local fallback when Redis is not configured or unavailable.
- `src/modules/notifications/notification.module.ts`
  - Wired the new pubsub provider and switched `NotificationService` to token-based injection.
- `src/modules/notifications/*.spec.ts`, `test/notifications.e2e-spec.ts`
  - Added and updated focused unit/e2e coverage for channel targets, pubsub, and provider-based push/LINE routing.
- `docs/PROGRESS.md`
  - Added the progress entry for this slice.

### TDD Evidence
- RED:
  - Command: `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - Failure reasons:
    - missing `NotificationPubSub` module
    - missing `NotificationController.getChannelTargets/updateChannelTargets`
    - `NotificationService` still using direct `gateway.emitNotification`
    - LINE and push channel behavior still based on the old placeholder mapping
- GREEN:
  - Command: `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - Result: `5` suites passed, `18` tests passed.

### Tests Run
- `npm run db:generate` - passed
- `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts` - passed
- `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts` - passed
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run build` - passed

### Wiring Verification Evidence
- `NotificationController` channel-target routes are registered in `src/modules/notifications/notification.controller.ts` and wired through `NotificationModule` imported by `AppModule`.
- `NotificationService` is resolved from `NotificationModule.providers` with `NOTIFICATION_STORE` and `NOTIFICATION_FANOUT` tokens.
- `NotificationPubSub` is registered in `NotificationModule.providers`; it publishes from `NotificationService.notifyUsers()` and subscribes on module init.
- `NotificationGateway.emitNotification()` remains the only websocket emission point; pubsub now drives it instead of direct per-instance service calls.
- The migration and Prisma model both use `notification_channel_targets`.

### Behavior Changes And Risks
- Notification persistence still succeeds when Redis is missing; realtime delivery falls back to local gateway emit on the originating instance.
- LINE and push now fail closed when the user has not stored a target.
- Push no longer issues arbitrary backend fetches to user-controlled URLs; it posts to the configured provider webhook with the user target embedded in the payload.
- Remaining gap: websocket fanout is still in-process with the API app rather than a separately deployed worker tier, but it is now cross-instance-safe when Redis is configured.

### Follow-Ups / Known Gaps
- Add a real integration test against a live Redis instance if cross-instance websocket delivery becomes business-critical.
- If push delivery moves to a concrete provider, replace the generic `pushEndpoint` token semantics with a provider-specific contract and verification flow.

## Review (2026-03-28 04:36 ICT) - working-tree (notification channel-targets and pubsub slice)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree (targeted files: prisma/schema.prisma, prisma/migrations/20260328043200_add_notification_channel_targets/migration.sql, package.json, package-lock.json, src/modules/notifications/*, test/notifications.e2e-spec.ts, docs/PROGRESS.md)`
- Commands Run: `git diff -- prisma/schema.prisma prisma/migrations/20260328043200_add_notification_channel_targets/migration.sql package.json package-lock.json src/modules/notifications test/notifications.e2e-spec.ts docs/PROGRESS.md`; `rg -n "channel-targets|NOTIFICATION_FANOUT|NOTIFICATION_REDIS_CLIENT_FACTORY|notification.created|notification_channel_targets|publishNotificationCreated|emitNotification" src prisma test`; `npm run db:generate`; `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`; `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

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
- Assumed `pushEndpoint` is an opaque provider recipient token, not a raw device callback URL; the implementation now enforces provider-webhook posting rather than arbitrary backend fetches.
- Assumed local fallback websocket emit is acceptable when `REDIS_URL` is absent; cross-instance propagation still requires Redis to be configured in deployment.

### Recommended Tests / Validation
- Run one live Redis-backed integration smoke test in a shared environment to confirm cross-instance `notification.new` fanout across two app instances.
- Apply the migration and confirm `GET/PUT /notifications/channel-targets` round-trip against a real Postgres database, not only mocked controller/e2e wiring.

### Rollout Notes
- Deploy the additive `notification_channel_targets` migration before enabling clients to persist LINE/push targets.
- `REDIS_URL` remains optional; without it, notification persistence and local websocket fanout still work, but cross-instance live delivery does not.
- Existing notification list/unread/preferences APIs remain backward-compatible.

## Review (2026-03-28 06:37 ICT) - working-tree (final notification slice before submit)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree (targeted notification channel-target/pubsub files only)`
- Commands Run: `git diff -- prisma/schema.prisma prisma/migrations/20260328043200_add_notification_channel_targets/migration.sql package.json package-lock.json src/modules/notifications test/notifications.e2e-spec.ts docs/PROGRESS.md`; `rg -n "channel-targets|NOTIFICATION_FANOUT|NOTIFICATION_REDIS_CLIENT_FACTORY|notification.created|notification_channel_targets|publishNotificationCreated|emitNotification" src prisma test`; `npm run db:generate`; `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`; `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

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
- Assumed the generic `pushEndpoint` string is a provider recipient token; if a specific push vendor is chosen later, that contract should be narrowed and verified explicitly.
- Assumed deployment environments that need multi-instance websocket fanout will provide `REDIS_URL`.

### Recommended Tests / Validation
- Smoke-test two app instances against one Redis in a shared environment and confirm a notification created on instance A reaches a socket connected to instance B.
- Run the new migration against a real Postgres environment before enabling clients to persist channel targets in production.

### Rollout Notes
- This is additive and backward-compatible for existing notification APIs.
- Redis remains optional; missing Redis degrades to local-only websocket delivery while leaving persistence intact.
- The push path now avoids arbitrary backend fetches to user-controlled destinations by always posting to the configured provider webhook.

## CI Follow-Up (2026-03-28 06:40 ICT)

### Goal
Fix the failing `Database Migrations` GitHub check on PR `#32`.

### What Changed
- `prisma/migrations/20260327223000_add_notifications_module/migration.sql`
  - Changed `notifications.id`, `notifications.user_id`, `notifications.lane_id`, and `notification_preferences.id/user_id` from `UUID` to `TEXT`, matching the repo’s base schema.
- `prisma/migrations/20260328043200_add_notification_channel_targets/migration.sql`
  - Changed `notification_channel_targets.id/user_id` from `UUID` to `TEXT`, also matching the base schema.

### TDD / Validation Evidence
- Failure observed from GitHub Actions:
  - `notifications_user_id_fkey` could not be created because `users.id` is `text` while the notification migration used `uuid`.
- Validation:
  - `npm run db:generate` - passed
  - `DATABASE_URL='postgresql://zrl:zrl_dev_password@localhost:5433/zrl_ci_tmp?schema=public' npx prisma migrate deploy` - passed against a fresh disposable local database

### Risk Notes
- This fix only aligns migration SQL with the existing repo contract; it does not change the already-generated Prisma model surface.

## CI Follow-Up (2026-03-28 06:47 ICT)

### Goal
Fix the failing `Integration Tests` GitHub check on PR `#32`.

### What Changed
- `src/modules/notifications/notification.service.ts`
  - Added an explicit `@Inject(NotificationChannels)` annotation for the third constructor dependency so full Nest app bootstrap can resolve the dispatcher during e2e/app-module initialization.

### TDD / Validation Evidence
- Failure observed from local reproduction and GitHub Actions:
  - full e2e bootstrap failed with `Nest can't resolve dependencies of the NotificationService ... argument at index [2]`
- Validation:
  - `DATABASE_URL='postgresql://zrl:zrl_dev_password@localhost:5433/zrl_dev?schema=public' npm run test:e2e -- --runInBand` - passed (`10` suites, `55` tests)
  - `npm run test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/notifications/notification.controller.spec.ts src/modules/notifications/notification.channels.spec.ts src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts` - passed
  - `npm run lint` - passed
  - `npm run typecheck` - passed
  - `npm run build` - passed

### Risk Notes
- This is pure DI wiring; runtime behavior is unchanged beyond making the dispatcher resolvable in full application bootstrap paths.
