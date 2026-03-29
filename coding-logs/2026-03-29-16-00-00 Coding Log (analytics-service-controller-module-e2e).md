# Coding Log: Backend Analytics Module

## 2026-03-29 22:30 ICT

- Goal: Plan and implement the full Backend Analytics Module — 5 PRD-specified endpoints under `/analytics/` with SQL aggregation queries, RBAC scoping, and comprehensive tests.

- What changed:
  - `src/modules/analytics/analytics.types.ts` — New file. Response types (AnalyticsOverview, RejectionTrendPoint, CompletenessBracket, ExcursionHeatmapCell, ExporterLeaderboardEntry), query filter types (OverviewFilters, RejectionTrendFilters, etc.), LeaderboardSortField/RejectionTrendGranularity unions, and the AnalyticsStore interface with 5 methods.
  - `src/modules/analytics/analytics.pg-store.ts` — New file. PrismaAnalyticsStore implementing AnalyticsStore via raw SQL queries against the shared DATABASE_POOL. 5 methods: getOverview (COUNT/AVG/FILTER aggregation), getRejectionTrend (date_trunc GROUP BY), getCompletenessDistribution (CASE/WHEN bucketing with TS percentage), getExcursionHeatmap (excursions JOIN lanes GROUP BY product×severity), getExporterLeaderboard (lanes JOIN users GROUP BY exporter with hardcoded SORT_FIELD_MAP for safe ORDER BY).
  - `src/modules/analytics/analytics.pg-store.spec.ts` — New file. 10 unit tests: all 5 store methods, exporterId scoping, date range filtering, granularity, rejection rate computation, completeness percentages, zero-lane edge case, leaderboard sort defaults and limit.
  - `src/modules/analytics/analytics.service.ts` — New file. Injectable service with RBAC: EXPORTER role auto-scopes by actor.id, ADMIN/AUDITOR see all. Exports ANALYTICS_STORE Symbol token. Validates granularity (day/week/month set), sort field (avgCompleteness/laneCount/readyToShip set), limit clamping (max 100), and date strings (BadRequestException on invalid dates via parseDate helper).
  - `src/modules/analytics/analytics.service.spec.ts` — New file. 27 unit tests covering RBAC for all 5 methods, filter validation, date parsing, invalid date rejection, limit clamping, invalid sort/granularity handling, response wrappers.
  - `src/modules/analytics/analytics.controller.ts` — New file. 5 GET endpoints under `@Controller('analytics')` with `@UseGuards(JwtAuthGuard)`: overview, rejection-trend, completeness-distribution, excursion-heatmap, exporter-leaderboard. Delegates to service with query params and request.user.
  - `src/modules/analytics/analytics.controller.spec.ts` — New file. 5 unit tests verifying controller-to-service delegation.
  - `src/modules/analytics/analytics.module.ts` — New file. NestJS module importing AuthModule + DatabaseModule, providing PrismaAnalyticsStore via ANALYTICS_STORE token, exporting AnalyticsService.
  - `src/app.module.ts` — Modified. Added AnalyticsModule to imports array.
  - `test/analytics.e2e-spec.ts` — New file. 7 e2e tests: all 5 endpoints return 200 with correct response shapes, 401 without auth, query param forwarding (from/to dates).

- TDD evidence:
  - RED: `npx jest src/modules/analytics/analytics.pg-store.spec.ts` → "Cannot find module './analytics.pg-store'" (9 tests failed)
  - GREEN: After implementing pg-store → 9 tests passed
  - RED: `npx jest src/modules/analytics/analytics.service.spec.ts` → "Cannot find module './analytics.service'" (25 tests failed)
  - GREEN: After implementing service → 25 tests passed
  - RED: `npx jest src/modules/analytics/analytics.controller.spec.ts` → "Cannot find module './analytics.controller'" (5 tests failed)
  - GREEN: After implementing controller → 5 tests passed
  - GREEN: E2E → 7 tests passed

- Tests run and results:
  - `npx jest src/modules/analytics/ test/analytics.e2e-spec.ts --no-coverage` — 3 suites, 42 tests passed (27 service + 5 controller + 10 pg-store), 3 consecutive runs consistent
  - `npm test` — 33 suites passed, 255 tests passed, 9 skipped (pre-existing DB-only), 4 suites skipped
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors
  - `npm run build` — success

- Wiring verification evidence:
  - `AnalyticsModule` imported at `src/app.module.ts:16,29`
  - `AnalyticsController` registered at `analytics.module.ts:10`
  - `AnalyticsService` provided at `analytics.module.ts:13`, imported by `analytics.controller.ts:4`
  - `ANALYTICS_STORE` token defined in `analytics.service.ts:13`, provided in `analytics.module.ts:12`
  - `PrismaAnalyticsStore` provided in `analytics.module.ts:12`
  - All 5 `@Get` endpoints confirmed via grep on controller

- QCHECK review findings and fixes:
  - HIGH-1 (fixed): Added safety comment on ORDER BY interpolation in pg-store SORT_FIELD_MAP
  - HIGH-2 (fixed): Added `parseDate()` validation in service — invalid date strings now return 400 BadRequestException instead of 500
  - MEDIUM (noted): PARTNER role not explicitly scoped — low risk since partners use API keys not JWT, and data is aggregated
  - LOW (noted): `coldChainCoverage` returns raw count (frontend can derive percentage from totalLanes)
  - Added 3 new tests post-QCHECK: invalid from date, invalid to date, zero-lane overview edge case

- Behavior changes and risk notes:
  - New `/analytics/*` routes now available (5 GET endpoints, all require JWT auth)
  - No database migration — all queries read existing tables (lanes, excursions, users)
  - RBAC: EXPORTER auto-scoped to own data; ADMIN/AUDITOR see all
  - Frontend `analytics-data.ts` still computes client-side — switching to backend endpoints is a separate frontend task

- Follow-ups / known gaps:
  - Frontend wiring: update `frontend/src/lib/analytics-data.ts` to call backend `/analytics/*` endpoints instead of computing from all lanes
  - No Redis caching — may be needed under load
  - No live DB integration test (only mocked store e2e) — consider adding one like the cold-chain live e2e pattern
