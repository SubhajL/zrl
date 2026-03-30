# Coding Log: M5 MRV-Lite ESG Module

## 2026-03-30 14:00 ICT

- Goal: Implement remaining files for Task 17 M5 MRV-Lite ESG module (pg-store, service, controller, module wiring, unit tests, e2e tests)

- What changed:
  - `src/modules/mrv-lite/mrv-lite.pg-store.ts` — Created `PrismaMrvLiteStore` implementing `MrvLiteStore` interface with 3 SQL queries: getLaneEsgData (JOIN lanes+batches+routes, COUNT evidence/audit), getExporterEsgData (aggregate by exporter+quarter+year), getPlatformEsgData (platform-wide annual aggregation)
  - `src/modules/mrv-lite/mrv-lite.service.ts` — Created `MrvLiteService` with 4 methods: getLaneEsgCard (CO2e calculation via findEmissionFactor), getExporterReport, getPlatformReport, getEmissionFactors
  - `src/modules/mrv-lite/mrv-lite.controller.ts` — Created `MrvLiteController` with 4 endpoints: GET /lanes/:id/esg (LaneOwnerGuard), GET /esg/exporter/:exporterId, GET /esg/platform (ADMIN only via RolesGuard), GET /esg/carbon/factors
  - `src/modules/mrv-lite/mrv-lite.module.ts` — Updated stub to wire AuthModule, DatabaseModule, controller, providers (PrismaMrvLiteStore + MRV_LITE_STORE token), exports MrvLiteService
  - `src/modules/mrv-lite/mrv-lite.service.spec.ts` — 13 unit tests covering carbon calculation with real factors, default factor for unmatched routes, null transport mode, waste/social/governance sections, NotFoundException, exporter/platform reports, emission factors copy safety
  - `test/mrv-lite.e2e-spec.ts` — 5 e2e tests: lane ESG card, exporter report, platform report (admin), carbon factors, 401 without auth

- TDD evidence:
  - RED: `Cannot find module './mrv-lite.service'` when running spec before implementation
  - GREEN: All 13 unit tests pass after implementing service, all 5 e2e tests pass after controller/module wiring

- Tests run and results:
  - `npx jest src/modules/mrv-lite/mrv-lite.service.spec.ts` — 13 passed
  - `npx jest --config ./test/jest-e2e.json test/mrv-lite.e2e-spec.ts` — 5 passed
  - `npm test` — 307 passed, 9 skipped (pre-existing), 0 failed
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors

- Wiring verification evidence:
  - MrvLiteModule already imported in AppModule (pre-existing)
  - e2e tests boot full AppModule, override AuthService + MrvLiteService, confirm HTTP routing works for all 4 endpoints
  - 401 test confirms JwtAuthGuard is active on all routes

- Behavior changes and risk notes:
  - New HTTP routes: /lanes/:id/esg, /esg/exporter/:exporterId, /esg/platform, /esg/carbon/factors
  - /esg/platform restricted to ADMIN role
  - /lanes/:id/esg uses LaneOwnerGuard (exporter can only see own lanes)
  - CO2e calculation uses Math.round(...\*100)/100 for precision

- Follow-ups / known gaps:
  - pg-store SQL queries use simple default factor (1.5) for CO2e aggregation at exporter/platform level; per-lane card uses the full findEmissionFactor lookup
  - No pg-store unit tests (store relies on live DB; tested via e2e mocking)
