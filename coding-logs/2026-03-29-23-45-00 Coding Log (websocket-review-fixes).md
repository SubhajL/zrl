# Coding Log: WebSocket Review Tactical Fixes

## 2026-03-29 23:50 ICT

- Goal: Fix 3 findings from the WebSocket g-review: (1) disconnect on auth failure, (2) remove dead `_userId` parameter, (3) parameterize CORS origin.

- What changed:
  - `src/modules/notifications/notification.gateway.ts`
    - `handleConnection` now wraps auth logic in try/catch. On missing token or `verifyAccessToken` failure, calls `client.disconnect(true)` instead of throwing (Socket.IO swallows thrown exceptions in `handleConnection`). Also parameterized CORS origin via `WEBSOCKET_CORS_ORIGIN` env var (defaults to `true` for dev).
    - `emitTemperatureExcursion()` — removed dead `_userId` parameter. Now takes only the event.
  - `src/modules/notifications/notification.types.ts`
    - `NotificationRealtimeGateway.emitTemperatureExcursion()` — removed `userId` parameter from interface.
    - `NotificationFanoutPublisher.publishTemperatureExcursion()` — removed `userId` parameter from interface.
  - `src/modules/notifications/notification.pubsub.ts`
    - `publishTemperatureExcursion()` — removed `userId` parameter and `void userId` suppression. Now takes only the event.
  - `src/modules/notifications/notification.gateway.spec.ts`
    - Replaced `rejects with UnauthorizedException` test with two new tests: `disconnects the client when no bearer token is provided` and `disconnects the client when token verification fails`. Both verify `client.disconnect(true)` is called and `userId` is not set.

- TDD evidence:
  - RED: 2 new gateway tests failed with thrown `UnauthorizedException` because `handleConnection` didn't disconnect
  - GREEN: After wrapping in try/catch with `client.disconnect(true)`, all 9 gateway tests pass

- Tests run and results:
  - `npx jest src/modules/notifications/ --no-coverage` — 6 suites, 34 passed, 1 skipped
  - `npm test` — 33 suites, 257 passed, 9 skipped
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors
  - `npm run build` — success
  - 3x flakiness: 9/9 consistent across 3 runs

- Behavior changes and risk notes:
  - Unauthenticated WebSocket clients are now immediately disconnected instead of lingering without identity. Functionally equivalent (they couldn't do anything before), but now frees server resources.
  - CORS origin defaults to `true` (allow all) unless `WEBSOCKET_CORS_ORIGIN` is set. No behavioral change in dev/CI. Set `WEBSOCKET_CORS_ORIGIN=https://app.zrl.app` in production.
  - The `publishTemperatureExcursion` signature change is internal to the fanout layer. `RealtimeEventsService` calls `publishLaneEvent` directly, so no external callers are affected.

- Follow-ups / known gaps:
  - None. All 3 review findings resolved.
