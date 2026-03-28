# Task 19 Planning Log

## Plan Draft A

### Overview
Extend the existing `NotificationGateway` and Redis-backed pubsub path into the single realtime entry point for authenticated websocket delivery. Add lane-room subscription support, emit the missing lane-scoped events at the services that own those state transitions, and keep market-wide `rule.updated` delivery on user rooms so the implementation reuses current notification fanout instead of creating a second websocket stack.

### Files to Change
- `src/modules/notifications/notification.gateway.ts` - add lane subscribe/unsubscribe handlers, lane access checks, and lane-room emit helpers.
- `src/modules/notifications/notification.pubsub.ts` - fan out generalized realtime events across Redis with local fallback.
- `src/modules/notifications/notification.constants.ts` - define new realtime pubsub channel names.
- `src/modules/notifications/notification.types.ts` - add event payload types, gateway/publisher contracts, and lane subscription DTOs.
- `src/modules/notifications/notification.service.ts` - publish websocket events for existing notification-originated flows (`temperature.excursion`, `pack.generated`, `rule.updated`).
- `src/modules/notifications/notification.module.ts` - export the realtime service/gateway dependencies needed by lane and evidence modules.
- `src/modules/lane/lane.module.ts` - import notification wiring and inject realtime publisher into `LaneService`.
- `src/modules/lane/lane.service.ts` - emit `lane.status.changed` and `checkpoint.recorded` from canonical state mutation points.
- `src/modules/evidence/evidence.module.ts` - inject realtime publisher into `EvidenceService`.
- `src/modules/evidence/evidence.service.ts` - emit `evidence.uploaded` after committed artifact persistence.
- `src/modules/notifications/notification.gateway.spec.ts` - cover auth, subscribe/unsubscribe, and room-scoped emission.
- `src/modules/notifications/notification.pubsub.spec.ts` - cover serialization and replay for the new realtime envelopes.
- `src/modules/notifications/notification.service.spec.ts` - verify websocket publishing for temperature excursions, pack completion, and rule updates.
- `src/modules/lane/lane.service.spec.ts` - verify status-change and checkpoint event emission.
- `src/modules/evidence/evidence.service.spec.ts` - verify artifact upload event emission after persistence.
- `test/notifications.e2e-spec.ts` or `test/notifications.realtime.e2e-spec.ts` - integration coverage for connection lifecycle and multi-client lane broadcasts.

### Implementation Steps
#### TDD sequence
1. Add failing gateway/pubsub tests for lane subscriptions and generic lane event replay.
2. Run the focused notification test set and confirm failures for missing subscribe handlers and missing generic realtime fanout.
3. Implement the smallest gateway/types/pubsub changes to make those tests pass.
4. Add failing service tests for `lane.status.changed`, `checkpoint.recorded`, `evidence.uploaded`, `pack.generated`, and `rule.updated`.
5. Run the focused service tests and confirm failures at the expected missing publish calls.
6. Implement the producer hooks in notification, lane, and evidence services.
7. Add an integration websocket test with two clients subscribed to the same lane and confirm it fails before wiring completion.
8. Implement any remaining module wiring and refactor minimally.
9. Run format, focused tests, then repo gates (`lint`, `typecheck`, `build`, relevant e2e).

#### Functions and behavior
- `NotificationGateway.handleSubscribeLane()` - authenticate an already-connected socket for lane access, canonicalize the requested lane identifier, and join `lane:<internalLaneId>`.
- `NotificationGateway.handleUnsubscribeLane()` - leave the lane room idempotently so stale subscriptions do not linger.
- `NotificationGateway.emitLaneEvent()` - emit any lane-scoped realtime event into the canonical room.
- `NotificationGateway.emitRuleUpdated()` - emit market-wide rule updates into user rooms for the permitted audience.
- `NotificationPubSub.publishLaneEvent()` - serialize and publish lane-scoped realtime envelopes to Redis, with local fallback when Redis is unavailable.
- `NotificationPubSub.publishRuleUpdated()` - serialize and publish user-scoped rule update envelopes to Redis.
- `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()` - keep durable notification creation, and additionally publish `temperature.excursion` into the lane room.
- `NotificationService.notifyLaneOwner()` - when the type is `PACK_GENERATED`, also publish a `pack.generated` lane event.
- `NotificationService.notifyMarketAudience()` - when the type is `RULE_CHANGE`, also publish `rule.updated` to the resolved audience.
- `LaneService.transition()` and `LaneService.reconcileAutomaticTransitions()` - emit `lane.status.changed` after each committed transition, including automatic transitions.
- `LaneService.createCheckpoint()` / `LaneService.updateCheckpoint()` - emit `checkpoint.recorded` after the checkpoint is persisted.
- `EvidenceService.persistArtifact()` - emit `evidence.uploaded` only after the transaction commits and the artifact is durable.

#### Expected behavior and edge cases
- Subscription fails closed for users without lane access.
- Admin and auditor users may subscribe to any lane.
- Exporters may subscribe only to owned lanes.
- Partner JWT users are denied lane subscription until a lane-assignment model exists.
- Subscription accepts either internal lane IDs or public `LN-...` IDs, but room names canonicalize to the internal lane ID.
- Redis failure falls back to local gateway emission; cross-instance fanout is reduced but the current instance still works.
- Lane events are emitted only after durable state changes, not before transactions commit.

### Test Coverage
- `src/modules/notifications/notification.gateway.spec.ts`
  - `rejects lane subscription without lane access` - unauthorized subscription fails closed.
  - `joins canonical lane room for public lane id` - public ID canonicalizes to room.
  - `leaves lane room on unsubscribe` - unsubscribe is idempotent.
  - `emits lane.status.changed to lane room` - lane room receives transition event.
  - `emits rule.updated to user room` - market update targets user room.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `publishes and replays lane realtime events` - serialized lane envelopes round-trip.
  - `publishes and replays rule update events` - user-scoped rule updates round-trip.
- `src/modules/notifications/notification.service.spec.ts`
  - `publishes temperature excursion realtime event` - excursion notification emits websocket event.
  - `publishes pack generated realtime event` - pack notification emits lane event.
  - `publishes rule updated realtime event` - rule change emits websocket event.
- `src/modules/lane/lane.service.spec.ts`
  - `emits lane status change after manual transition` - old/new statuses broadcast.
  - `emits lane status changes during reconciliation` - automatic transitions broadcast sequentially.
  - `emits checkpoint recorded after create` - created checkpoint broadcasts sequence.
  - `emits checkpoint recorded after update` - updated checkpoint broadcasts sequence.
- `src/modules/evidence/evidence.service.spec.ts`
  - `emits evidence uploaded after artifact commit` - artifact event includes completeness.
  - `does not emit upload event when persistence fails` - no realtime event on rollback.
- `test/notifications.realtime.e2e-spec.ts`
  - `broadcasts lane events to subscribed authorized clients` - multiple clients receive lane event.
  - `rejects unauthorized lane subscription` - forbidden user cannot join lane room.

### Decision Completeness
- Goal
  - Deliver all Task 19 websocket events through a single authenticated NestJS Socket.IO gateway with lane-room subscriptions.
- Non-goals
  - No new partner lane-assignment model.
  - No frontend client implementation.
  - No DB schema changes or migrations.
- Success criteria
  - All seven Task 19 event types are emitted from committed producer paths.
  - Lane subscriptions are JWT-authenticated and access-controlled.
  - Focused unit/integration tests prove room subscription, fanout, and multi-client delivery.
  - Existing notification/cold-chain flows continue to pass.
- Public interfaces
  - WebSocket client emits: `lane.subscribe`, `lane.unsubscribe`.
  - WebSocket server emits: `lane.status.changed`, `evidence.uploaded`, `checkpoint.recorded`, `temperature.excursion`, `pack.generated`, `rule.updated`, `notification.new`.
  - No REST/API schema changes.
  - No env var or migration changes.
- Edge cases / failure modes
  - Missing token: fail closed at connection.
  - Unauthorized lane subscription: fail closed with websocket exception.
  - Public/internal lane ID mismatch: canonicalize or reject.
  - Redis unavailable: fail open locally, fail closed cross-instance.
  - Producer exception after DB commit but before websocket publish: durable data remains committed; realtime event may be missed but notification persistence remains intact where applicable.
- Rollout & monitoring
  - No feature flag.
  - Safe additive rollout because websocket topics are new or expanded only.
  - Watch app logs for websocket auth failures and pubsub warnings.
  - Backout is code rollback only; no schema rollback required.
- Acceptance checks
  - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/notifications.realtime.e2e-spec.ts`
  - `npm run lint && npm run typecheck && npm run build`

### Dependencies
- Existing `NotificationModule`, `AuthService`, Redis pubsub optional path, and lane ownership resolution in auth store.
- Socket.IO test client dependency already present or must be added if missing.

### Validation
- Prove direct gateway emission via unit tests.
- Prove Redis serialization/replay via pubsub unit tests.
- Prove lane access control and multi-client lane delivery via websocket e2e.
- Re-run existing notification/cold-chain focused tests to catch regressions.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationGateway` lane subscribe handlers | Socket.IO `/ws` messages `lane.subscribe` and `lane.unsubscribe` | `src/modules/notifications/notification.module.ts` provider registration | `lanes` lookup via auth/notification store |
| Generic lane realtime pubsub | Producer service calls into `NotificationPubSub.publishLaneEvent()` | `src/modules/notifications/notification.module.ts` via `NOTIFICATION_FANOUT` | Redis channels only, no DB schema |
| `LaneService` realtime producer hooks | `POST /lanes/:id/transition`, automatic reconciliation, checkpoint routes | `src/modules/lane/lane.module.ts` factory injection into `LaneService` | `lanes`, `checkpoints` |
| `EvidenceService` upload realtime hook | artifact upload routes and partner ingestion paths | `src/modules/evidence/evidence.module.ts` factory injection into `EvidenceService` | `evidence_artifacts`, `lanes` completeness |
| `NotificationService` pack/excursion/rule websocket hooks | proof-pack completion, cold-chain ingestion, rule updates | already injected into proof-pack, cold-chain, rules-engine modules | `notifications`, `lanes`, `users` |
| Websocket integration test | Nest `AppModule` boot in test harness | `test/notifications.realtime.e2e-spec.ts` | existing seeded test tables only |

### Cross-Language Schema Verification
- TypeScript-only backend for this task.
- Verified existing table names by direct inspection:
  - `lanes`
  - `checkpoints`
  - `notifications`
  - `users`
- No migration required.

### Decision-Complete Checklist
- No open decisions remain for the implementer.
- Every public websocket event and client message is named.
- Every behavior change has at least one failing test target.
- Validation commands are concrete and scoped.
- Wiring verification covers each new realtime component.
- Rollout/backout is additive and documented.

## Plan Draft B

### Overview
Keep the existing `NotificationGateway` narrowly focused on transport, and add a dedicated `RealtimeEventsService` inside the notification module to own all websocket event publishing. Use a generic typed envelope for all lane-scoped realtime events so producers call one service instead of growing `NotificationService` into a mixed persistence-plus-realtime coordinator.

### Files to Change
- `src/modules/notifications/notification.gateway.ts` - add auth and lane subscription transport handlers only.
- `src/modules/notifications/realtime-events.service.ts` - new service with typed publish helpers for lane and market/user events.
- `src/modules/notifications/notification.pubsub.ts` - move generic realtime serialization into pubsub behind the new service.
- `src/modules/notifications/notification.types.ts` - define lane event unions and publisher contracts.
- `src/modules/notifications/notification.module.ts` - register/export `RealtimeEventsService`.
- `src/modules/notifications/notification.service.ts` - delegate websocket event work to `RealtimeEventsService` rather than talking to pubsub directly.
- `src/modules/lane/lane.module.ts` - inject `RealtimeEventsService` into `LaneService`.
- `src/modules/lane/lane.service.ts` - publish status/checkpoint events through `RealtimeEventsService`.
- `src/modules/evidence/evidence.module.ts` - inject `RealtimeEventsService` into `EvidenceService`.
- `src/modules/evidence/evidence.service.ts` - publish upload events through `RealtimeEventsService`.
- `src/modules/notifications/*.spec.ts`, `src/modules/lane/lane.service.spec.ts`, `src/modules/evidence/evidence.service.spec.ts`, `test/notifications.realtime.e2e-spec.ts` - test the new service and runtime wiring.

### Implementation Steps
#### TDD sequence
1. Add failing tests around a new `RealtimeEventsService` contract and generic lane-room publishing.
2. Run focused notification tests and confirm failures for the missing service and missing gateway subscription handlers.
3. Implement the new realtime service plus gateway/pubsub transport support.
4. Add failing producer tests for lane, evidence, and notification-originated flows.
5. Implement the smallest producer changes to publish after successful persistence/transition.
6. Add websocket e2e coverage for subscription lifecycle and multi-client broadcasts.
7. Run focused tests, then broader gates.

#### Functions and behavior
- `RealtimeEventsService.publishLaneStatusChanged()` - wrap `lane.status.changed` payload construction and fanout.
- `RealtimeEventsService.publishEvidenceUploaded()` - publish evidence completion score updates after durable artifact creation.
- `RealtimeEventsService.publishCheckpointRecorded()` - publish checkpoint create/update activity.
- `RealtimeEventsService.publishTemperatureExcursion()` - publish lane-scoped excursion events independently from inbox notifications.
- `RealtimeEventsService.publishPackGenerated()` - publish pack readiness to the lane room.
- `RealtimeEventsService.publishRuleUpdated()` - resolve the notification audience and emit `rule.updated` to user rooms.
- `NotificationGateway.handleSubscribeLane()` / `handleUnsubscribeLane()` - own transport and access control only.

#### Expected behavior and edge cases
- Same access model as Draft A, but producers depend only on `RealtimeEventsService`, not gateway/pubsub primitives.
- Fail closed on unauthorized subscribe attempts.
- Fail open locally on Redis outage.
- Preserve `notification.new` behavior independently from other realtime events.

### Test Coverage
- `src/modules/notifications/realtime-events.service.spec.ts`
  - `publishes lane status changed through fanout` - typed helper forwards envelope.
  - `publishes pack generated through fanout` - lane event helper used.
  - `publishes rule updated to audience user rooms` - user-scoped helper fans out.
- `src/modules/notifications/notification.gateway.spec.ts`
  - `joins canonical lane room for public lane id` - public ID canonicalized.
  - `rejects unauthorized lane subscribe` - fail closed.
  - `emits lane events to room` - gateway transport works.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `round trips generic lane event envelopes` - generic serialization works.
  - `round trips user-scoped rule update envelopes` - user event serialization works.
- `src/modules/lane/lane.service.spec.ts`
  - `publishes manual lane transition event` - old/new status fanout.
  - `publishes checkpoint record event on update` - sequence fanout.
- `src/modules/evidence/evidence.service.spec.ts`
  - `publishes upload event with artifact type and completeness` - artifact event payload correct.
- `test/notifications.realtime.e2e-spec.ts`
  - `delivers lane event to all subscribed authorized clients` - broadcast verified.

### Decision Completeness
- Goal
  - Add a reusable realtime publishing layer for all Task 19 websocket events.
- Non-goals
  - No lane-assignment model for partner users.
  - No new durable queueing or guaranteed replay.
- Success criteria
  - Producers use one typed service for all non-`notification.new` websocket events.
  - Lane-room auth and fanout behave correctly under tests.
  - No regression in existing notification endpoints or event flows.
- Public interfaces
  - Client messages: `lane.subscribe`, `lane.unsubscribe`.
  - Server messages: Task 19 event set.
  - No DB/API/env changes.
- Edge cases / failure modes
  - Unauthorized or unknown lane subscriptions fail closed.
  - Redis outage falls back locally.
  - Producer failures do not roll back committed business data merely because websocket emission failed.
- Rollout & monitoring
  - Additive rollout.
  - Monitor logs for websocket auth denials and pubsub publish warnings.
  - Backout is code rollback only.
- Acceptance checks
  - Same focused test commands as Draft A, plus the new realtime service spec if created.

### Dependencies
- Existing notification module infrastructure and AuthService lane ownership resolution.
- Optional socket.io client package for integration tests.

### Validation
- Unit tests for the new realtime abstraction.
- Integration websocket tests through real Socket.IO connections.
- Existing notification/cold-chain/rules/proof-pack tests remain green.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `RealtimeEventsService` | invoked from lane, evidence, and notification services | `src/modules/notifications/notification.module.ts` provider/export | `lanes`, `notifications`, `users` lookups only |
| Gateway lane subscription handlers | Socket.IO `/ws` messages | `src/modules/notifications/notification.module.ts` | `lanes` |
| Lane realtime hooks | lane transition/checkpoint service methods | `src/modules/lane/lane.module.ts` injection | `lanes`, `checkpoints` |
| Evidence realtime hook | committed artifact uploads | `src/modules/evidence/evidence.module.ts` injection | `evidence_artifacts`, `lanes` |
| Rule update websocket hook | rules-engine change notification flow | `src/modules/rules-engine/rules-engine.module.ts` through `NotificationService` delegation | `lanes`, `users`, `notifications` |

### Cross-Language Schema Verification
- TypeScript-only backend.
- No migration.
- Existing tables verified by direct inspection: `lanes`, `checkpoints`, `notifications`, `users`.

### Decision-Complete Checklist
- Public websocket contract named.
- All producer call sites identified.
- Tests listed for every behavior change.
- Validation commands concrete.
- Wiring verification covers new service and call sites.

## Comparative Analysis

### Strengths
- Draft A keeps the file count smaller and changes the existing notification stack in place.
- Draft B keeps persistence notifications and websocket publishing separated, which is cleaner for ongoing maintenance.

### Gaps
- Draft A risks making `NotificationService` absorb too many unrelated realtime responsibilities.
- Draft B adds one more service and test surface, so it costs slightly more implementation churn.

### Trade-offs
- Draft A is faster if the task were only a couple of new events.
- Draft B is the better fit because Task 19 spans multiple producer modules and mixes lane-scoped and market-scoped websocket events.

### Compliance Check
- Both drafts follow repo constraints: additive change, no migration, auth fail-closed, and tests-first delivery.
- Draft B better respects module boundaries because lane/evidence producers can depend on a focused realtime publisher instead of the full notification persistence service.

## Unified Execution Plan

### Overview
Implement Task 19 by extending the existing `/ws` gateway with JWT-authenticated lane subscriptions while introducing a focused `RealtimeEventsService` inside the notification module for all non-`notification.new` websocket publishing. Keep `notification.new` on the current inbox path, add Redis-backed generic realtime fanout for lane/user events, and wire producers at the exact state-transition points in lane, evidence, proof-pack, rules, and cold-chain services.

### Files to Change
- `src/modules/notifications/notification.gateway.ts` - add subscribe/unsubscribe handlers, lane access checks, room helpers, and generic lane/user event emission.
- `src/modules/notifications/realtime-events.service.ts` - new focused realtime publisher abstraction.
- `src/modules/notifications/notification.pubsub.ts` - generic serialize/publish/replay for lane events and rule updates.
- `src/modules/notifications/notification.constants.ts` - new realtime channel constants.
- `src/modules/notifications/notification.types.ts` - typed realtime payloads, envelope types, and service contracts.
- `src/modules/notifications/notification.module.ts` - register/export `RealtimeEventsService`.
- `src/modules/notifications/notification.service.ts` - delegate `temperature.excursion`, `pack.generated`, and `rule.updated` to the realtime service.
- `src/modules/lane/lane.module.ts` - import `NotificationModule` and inject `RealtimeEventsService`.
- `src/modules/lane/lane.service.ts` - publish status/checkpoint realtime events.
- `src/modules/evidence/evidence.module.ts` - inject `RealtimeEventsService`.
- `src/modules/evidence/evidence.service.ts` - publish `evidence.uploaded` after durable commit.
- `src/modules/notifications/notification.gateway.spec.ts`
- `src/modules/notifications/realtime-events.service.spec.ts`
- `src/modules/notifications/notification.pubsub.spec.ts`
- `src/modules/notifications/notification.service.spec.ts`
- `src/modules/lane/lane.service.spec.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `test/notifications.realtime.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps
#### TDD sequence
1. Add failing tests for gateway lane subscribe/unsubscribe behavior and generic lane/user event emission.
2. Run `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/realtime-events.service.spec.ts` and confirm failures for the missing realtime abstraction.
3. Implement `RealtimeEventsService`, typed envelopes, gateway subscription handlers, and pubsub replay.
4. Add failing producer tests in notification, lane, and evidence specs for the missing publish calls.
5. Run the focused producer suite and confirm failures at the correct missing call sites.
6. Implement producer hooks in:
   - `NotificationService` for `temperature.excursion`, `pack.generated`, `rule.updated`
   - `LaneService` for `lane.status.changed`, `checkpoint.recorded`
   - `EvidenceService` for `evidence.uploaded`
7. Add failing websocket e2e coverage for multi-client lane-room delivery and unauthorized subscribe rejection.
8. Wire modules, make the smallest fixes needed, then rerun focused tests until green.
9. Run `npm run lint`, `npm run typecheck`, `npm run build`, the focused unit suites, and the websocket e2e suite.
10. Run a skeptical review, then formal `g-check`, fix issues if found, and append the implementation summary to this Coding Log.

#### Functions and behavior
- `NotificationGateway.handleSubscribeLane(client, body)` - resolve token-authenticated user access, canonicalize the requested lane identifier to the internal lane ID, and join the lane room.
- `NotificationGateway.handleUnsubscribeLane(client, body)` - leave the canonical lane room safely even if the socket was not joined.
- `NotificationGateway.emitLaneEvent(eventName, laneId, payload)` - emit lane-scoped events to all subscribed authorized clients.
- `NotificationGateway.emitUserEvent(eventName, userId, payload)` - emit market-wide/user-targeted realtime events such as `rule.updated`.
- `RealtimeEventsService.publishLaneStatusChanged(...)` - publish `{ laneId, oldStatus, newStatus }`.
- `RealtimeEventsService.publishEvidenceUploaded(...)` - publish `{ laneId, artifactId, type, completeness }`.
- `RealtimeEventsService.publishCheckpointRecorded(...)` - publish `{ laneId, checkpointId, sequence }`.
- `RealtimeEventsService.publishTemperatureExcursion(...)` - publish the existing temperature excursion payload to the lane room.
- `RealtimeEventsService.publishPackGenerated(...)` - publish `{ laneId, packId, packType }`.
- `RealtimeEventsService.publishRuleUpdated(...)` - publish `{ marketId, changedSubstances }` to the resolved market audience on user rooms.
- `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()` - persist the durable notification, then publish `temperature.excursion`.
- `NotificationService.dispatchCreatedNotifications()` / `notifyUsers()` path - when creating `PACK_GENERATED` or `RULE_CHANGE` notifications, additionally call the realtime publisher.
- `LaneService.transition()` and `reconcileAutomaticTransitions()` - publish after each committed status mutation.
- `LaneService.createCheckpoint()` / `updateCheckpoint()` - publish after checkpoint persistence and audit write.
- `EvidenceService.persistArtifact()` - publish after transaction success, using the updated completeness score if available.

#### Expected behavior and edge cases
- Connections still require JWT at handshake.
- `lane.subscribe` and `lane.unsubscribe` accept internal IDs or public `LN-...` IDs, but the gateway canonicalizes to the internal lane room so producer fanout stays consistent.
- Exporters may subscribe only to owned lanes; admins/auditors may subscribe to any lane; partner JWT users are rejected until explicit assignment support exists.
- Redis outage falls back to local emission and logs a warning.
- Websocket publish failures never roll back already-committed domain state.
- `temperature.excursion` becomes lane-room scoped; `notification.new` remains user-room scoped.

### Test Coverage
- `src/modules/notifications/notification.gateway.spec.ts`
  - `rejects websocket connections without a bearer token` - handshake auth still enforced.
  - `joins canonical lane room for authorized public lane subscription` - public lane ID accepted and canonicalized.
  - `rejects lane subscription for unauthorized exporter` - access denied.
  - `leaves canonical lane room on unsubscribe` - unsubscribe path works.
  - `emits lane scoped events to lane room` - generic lane emit works.
  - `emits rule updated to user room` - user-scoped emit works.
- `src/modules/notifications/realtime-events.service.spec.ts`
  - `publishes lane status changed through fanout` - typed lane event helper forwards payload.
  - `publishes evidence uploaded through fanout` - upload helper forwards payload.
  - `publishes pack generated through fanout` - pack helper forwards payload.
  - `publishes temperature excursion through fanout` - excursion helper forwards payload.
  - `publishes rule updated to market audience` - audience resolution produces user-targeted events.
- `src/modules/notifications/notification.pubsub.spec.ts`
  - `publishes and replays generic lane realtime events` - lane envelope round-trip.
  - `publishes and replays rule update user events` - user envelope round-trip.
  - `falls back to local emit when redis publish fails` - local delivery preserved.
- `src/modules/notifications/notification.service.spec.ts`
  - `publishes temperature excursion realtime event after durable notification` - cold-chain path emits websocket event.
  - `publishes pack generated realtime event after durable notification` - proof-pack path emits websocket event.
  - `publishes rule updated realtime event after durable notification` - rules path emits websocket event.
- `src/modules/lane/lane.service.spec.ts`
  - `emits lane status changed after manual transition` - manual transitions broadcast.
  - `emits lane status changes during automatic reconciliation` - automatic transitions broadcast.
  - `emits checkpoint recorded after checkpoint create` - create path broadcasts.
  - `emits checkpoint recorded after checkpoint update` - update path broadcasts.
- `src/modules/evidence/evidence.service.spec.ts`
  - `emits evidence uploaded after artifact commit` - durable upload publishes payload.
  - `does not emit evidence uploaded when transaction fails` - rollback path stays quiet.
- `test/notifications.realtime.e2e-spec.ts`
  - `broadcasts lane events to all subscribed authorized clients` - multi-client lane delivery works.
  - `does not deliver lane events to unsubscribed clients` - room boundaries enforced.
  - `rejects unauthorized lane subscribe attempts` - fail-closed access control.

### Decision Completeness
- Goal
  - Deliver the full Task 19 websocket event surface with authenticated room-based subscriptions and real producer wiring.
- Non-goals
  - No frontend implementation.
  - No new durable replay/outbox system.
  - No partner assignment model beyond fail-closed rejection.
- Success criteria
  - All Task 19 events are produced from real runtime call sites.
  - Gateway supports lane subscribe/unsubscribe with authorization.
  - Unit tests cover payload publishing and room routing.
  - Integration tests prove authorized multi-client lane delivery.
  - Existing notification, cold-chain, proof-pack, and rules tests remain green.
- Public interfaces
  - New client websocket messages:
    - `lane.subscribe` with `{ laneId: string }`
    - `lane.unsubscribe` with `{ laneId: string }`
  - Server websocket events:
    - `lane.status.changed`
    - `evidence.uploaded`
    - `checkpoint.recorded`
    - `temperature.excursion`
    - `pack.generated`
    - `rule.updated`
    - `notification.new`
  - No REST endpoint changes, no migrations, no env var changes.
- Edge cases / failure modes
  - Missing/invalid token: fail closed at connection.
  - Unauthorized lane subscription: fail closed and do not join room.
  - Unknown lane ID: fail closed and do not join room.
  - Redis publish failure: emit locally and log warning.
  - Post-commit realtime publish failure: business state stays committed; websocket event best-effort only.
- Rollout & monitoring
  - Additive rollout with no schema sequencing.
  - Monitor websocket auth denials and Redis pubsub warnings in logs.
  - Backout is straightforward code rollback.
- Acceptance checks
  - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/realtime-events.service.spec.ts src/modules/notifications/notification.pubsub.spec.ts`
  - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/notifications.realtime.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies
- Existing `AuthService` token verification and lane ownership resolution.
- Existing Socket.IO gateway under `/ws`.
- Existing Redis pubsub path as optional cross-instance fanout.
- Existing lane/evidence/proof-pack/rules/cold-chain producer services.

### Validation
- Focused notification unit suite proves gateway, fanout, and typed publisher behavior.
- Focused lane/evidence/service tests prove producer call sites.
- Websocket e2e proves lifecycle, auth, room membership, and broadcasting.
- Repo gates prove compile/lint/build integrity.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `NotificationGateway` lane subscription handlers | Socket.IO namespace `/ws` messages `lane.subscribe` / `lane.unsubscribe` | `src/modules/notifications/notification.module.ts` provider list | `lanes` table via auth/store lookup |
| `RealtimeEventsService` | Called by notification, lane, and evidence services after durable state change | `src/modules/notifications/notification.module.ts` provider/export | No new schema; reads `lanes`, `users`, `notifications` context only |
| Generic realtime pubsub envelope handling | `RealtimeEventsService` delegates to `NotificationPubSub` | `src/modules/notifications/notification.module.ts` via `NOTIFICATION_FANOUT` | Redis channels only |
| Lane transition realtime wiring | `LaneService.transition()` and `LaneService.reconcileAutomaticTransitions()` | `src/modules/lane/lane.module.ts` factory injects `RealtimeEventsService` | `lanes` |
| Checkpoint realtime wiring | `LaneService.createCheckpoint()` and `LaneService.updateCheckpoint()` | `src/modules/lane/lane.module.ts` factory injects `RealtimeEventsService` | `checkpoints`, `lanes` |
| Evidence upload realtime wiring | `EvidenceService.persistArtifact()` after successful transaction | `src/modules/evidence/evidence.module.ts` factory injects `RealtimeEventsService` | `evidence_artifacts`, `lanes` |
| Pack generated realtime wiring | `ProofPackService.completeLeasedJob()` via `NotificationService.notifyLaneOwner()` delegation | existing `EvidenceModule` -> `NotificationService` -> `RealtimeEventsService` chain | `proof_packs`, `notifications` |
| Temperature excursion realtime wiring | `ColdChainService.notifyAboutNewExcursions()` via `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()` | existing `ColdChainModule` -> `NotificationService` -> `RealtimeEventsService` chain | `excursions`, `notifications`, `lanes` |
| Rule update realtime wiring | `RulesEngineService.notifyRuleChange()` via `NotificationService.notifyMarketAudience()` delegation | existing `RulesEngineModule` -> `NotificationService` -> `RealtimeEventsService` chain | `lanes`, `users`, `notifications` |
| Websocket e2e test harness | Nest app boot plus Socket.IO client connections | `test/notifications.realtime.e2e-spec.ts` | existing test DB only |

### Cross-Language Schema Verification
- Auggie semantic search was available; plan also uses direct file inspection for exact wiring.
- This task is TypeScript-only.
- Verified schema/table names directly in the codebase:
  - `lanes`
  - `checkpoints`
  - `notifications`
  - `users`
  - `proof_packs`
  - `excursions`
  - `evidence_artifacts`
- No migration or schema change is required.

### Decision-Complete Checklist
- No open decisions remain for implementation.
- Every websocket interface is named consistently.
- Every behavior change has explicit tests.
- Validation commands are specific.
- Wiring verification covers every new component and producer path.
- Rollout/backout is specified and additive.

## Implementation (2026-03-28 13:58:32 +07) - Task 19 websocket realtime events

### Goal
- Implement the remaining Task 19 realtime websocket surface on top of the existing notification gateway, including lane-room subscriptions and producer wiring from lane, evidence, cold-chain, proof-pack, and rules flows.

### What Changed
- `src/modules/notifications/notification.types.ts`, `notification.constants.ts`, `notification.gateway.ts`, `notification.pubsub.ts`, `notification.module.ts`, `notification.pg-store.ts`
  - Added lane subscription contracts, canonical lane access lookup, generic lane/user realtime fanout interfaces, and Redis-backed lane/user event replay on the existing `/ws` namespace.
- `src/modules/notifications/realtime-events.service.ts`
  - Added a focused realtime publisher that owns `lane.status.changed`, `evidence.uploaded`, `checkpoint.recorded`, `temperature.excursion`, `pack.generated`, and `rule.updated`.
- `src/modules/notifications/notification.service.ts`
  - Kept durable inbox notification creation intact, but delegated supplemental websocket publishing to `RealtimeEventsService` so pack/rule/temperature events are emitted once from the canonical notification path.
- `src/modules/lane/lane.module.ts`, `src/modules/lane/lane.service.ts`
  - Injected `RealtimeEventsService` and publish lane status/checkpoint events directly from committed transition/checkpoint mutation points.
- `src/modules/evidence/evidence.module.ts`, `src/modules/evidence/evidence.service.ts`
  - Injected `RealtimeEventsService` and publish `evidence.uploaded` only after artifact persistence succeeds, including the post-evaluation completeness score.
- Tests
  - Added/expanded coverage in `src/modules/notifications/notification.gateway.spec.ts`, `src/modules/notifications/realtime-events.service.spec.ts`, `src/modules/notifications/notification.pubsub.spec.ts`, `src/modules/notifications/notification.service.spec.ts`, `src/modules/lane/lane.service.spec.ts`, `src/modules/lane/lane-timeline.spec.ts`, `src/modules/evidence/evidence.service.spec.ts`, and `test/notifications.realtime.e2e-spec.ts`.

### TDD Evidence
- RED
  - Command:
    - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/realtime-events.service.spec.ts`
  - Key failure reason:
    - Missing `RealtimeEventsService`, missing `handleSubscribeLane` / `handleUnsubscribeLane`, and missing generic `publishLaneEvent` / `publishUserEvent`.
- GREEN
  - Command:
    - `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/realtime-events.service.spec.ts`
- RED
  - Command:
    - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - Key failure reason:
    - Notification, lane, and evidence services were not yet emitting the new realtime events from committed mutation paths.
- GREEN
  - Command:
    - `npm test -- --runInBand src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
- Wiring-only verification
  - `test/notifications.realtime.e2e-spec.ts` was added after the transport layer was already green, so there is no separate RED run for that file; it was used to prove real Socket.IO subscription and multi-client delivery behavior.

### Tests Run
- `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/realtime-events.service.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`
- `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts test/notifications.realtime.e2e-spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### Wiring Verification Evidence
- `NotificationGateway` lane subscription handlers are registered on the existing `/ws` gateway in `src/modules/notifications/notification.gateway.ts` and provided by `src/modules/notifications/notification.module.ts`.
- Lane room access is canonicalized through `PrismaNotificationStore.findLaneRealtimeAccess()` in `src/modules/notifications/notification.pg-store.ts`, which resolves either internal lane IDs or public `LN-...` IDs to the internal lane room key.
- `LaneService.transition()` / `reconcileAutomaticTransitions()` and `createCheckpoint()` / `updateCheckpoint()` now publish realtime events directly after committed state changes in `src/modules/lane/lane.service.ts`.
- `EvidenceService.persistArtifact()` now publishes `evidence.uploaded` after transaction success in `src/modules/evidence/evidence.service.ts`.
- `NotificationService.notifyLaneOwnerAboutTemperatureExcursions()`, `notifyUsers()`, and `notifyMarketAudience()` now delegate pack/rule/excursion websocket publishing to `RealtimeEventsService` in `src/modules/notifications/notification.service.ts`.
- The runtime socket path was verified with a real Socket.IO client in `test/notifications.realtime.e2e-spec.ts`.

### Behavior Changes And Risk Notes
- `lane.subscribe` and `lane.unsubscribe` accept internal or public lane IDs, but the gateway canonicalizes all room membership to `lane:<internalLaneId>`.
- Exporters may only subscribe to owned lanes; admins and auditors may subscribe broadly; partner JWT users fail closed because there is still no explicit lane-assignment model.
- `notification.new` remains user-room scoped.
- The new lane/user websocket events are best-effort after durable state changes; if websocket publish fails, business data stays committed.

### Follow-Ups / Known Gaps
- The broader non-DB `lane.e2e` / `evidence.e2e` AppModule harness still boots background workers without configured DB-backed stores and fails for that pre-existing reason; Task 19 validation therefore stayed scoped to the notification/realtime slice plus affected unit suites.

## Review (2026-03-28 13:58:32 +07) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; `git diff -- src/modules/notifications src/modules/lane src/modules/evidence test/notifications.realtime.e2e-spec.ts`; focused `npm test`; focused `npm run test:e2e`; `npm run lint`; `npm run typecheck`; `npm run build`

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
- Assumed Task 19 lane subscriptions should fail closed for JWT-authenticated partner users until a lane-assignment model exists.
- Assumed preserving `notification.new` on user rooms while moving the other Task 19 events to lane/user realtime channels is the least disruptive contract change.

### Recommended Tests / Validation
- Run the notification websocket e2e against a real multi-instance Redis-backed environment if cross-instance room fanout needs operational proof beyond the local fallback path.
- When the broader no-DB AppModule e2e harness is cleaned up, add one lane/evidence route smoke that asserts websocket fanout from the controller path instead of only from the service path.

### Rollout Notes
- Additive change only: no migrations, no new env vars, no contract removal.
- Expect warning logs from existing certification/proof-pack workers in notification e2e harnesses where DB-backed stores are intentionally absent; those are pre-existing and not introduced by Task 19.


## Review (2026-03-28 14:00:02 +07) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; `git diff --staged`; `npm test -- --runInBand src/modules/notifications/notification.gateway.spec.ts src/modules/notifications/realtime-events.service.spec.ts src/modules/notifications/notification.pubsub.spec.ts src/modules/notifications/notification.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/cold-chain/cold-chain.service.spec.ts`; `npm run test:e2e -- --runInBand test/notifications.e2e-spec.ts test/notifications.realtime.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

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
- Assumed `rule.updated` should remain user-room scoped while lane-scoped operational events use lane rooms.
- Assumed exporter/admin/auditor lane subscription behavior is sufficient for Task 19 and partner JWT lane subscriptions should continue to fail closed.

### Recommended Tests / Validation
- Verify cross-instance lane-room delivery in an environment with Redis enabled and multiple app instances.
- Add a broader controller-path websocket smoke once the existing no-DB AppModule worker-harness issue is cleaned up.

### Rollout Notes
- Additive websocket change only: no schema migration, no REST contract break, no env var change.
- Notification e2e still logs pre-existing worker startup errors because those harnesses intentionally omit DB-backed worker stores; the tested notification routes and websocket flows still pass.
