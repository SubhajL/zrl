# Coding Log: Break Lane<->Evidence forwardRef Cycle

## 2026-03-30 09:10 ICT

- Goal: Remove both `forwardRef` calls between LaneModule and EvidenceModule, eliminating the circular dependency while preserving all existing behavior.

- What changed:
  - `src/modules/lane/lane.types.ts` -- Added `LaneReconciler` interface and `findProofPackSummaryById` to `LaneStore` interface
  - `src/modules/lane/lane.constants.ts` -- Added `LANE_RECONCILER` Symbol token
  - `src/modules/lane/lane.pg-store.ts` -- Implemented `findProofPackSummaryById()` with direct SQL query to proof_packs table
  - `src/modules/lane/lane.service.ts` -- Removed ProofPackService dependency; implemented `LaneReconciler` interface; added `reconcileAfterEvidenceChange()` delegate method; replaced `proofPackService.getPackById()` with `laneStore.findProofPackSummaryById()` in `buildTimelineMetadata()`
  - `src/modules/lane/lane.module.ts` -- Removed `forwardRef(() => EvidenceModule)` import; removed ProofPackService from factory; added LANE_RECONCILER provider and export
  - `src/modules/evidence/evidence.service.ts` -- Replaced `LaneService` injection with `@Inject(LANE_RECONCILER) LaneReconciler`; updated `reconcileLaneTransitionsAfterUpload()` to use `laneReconciler.reconcileAfterEvidenceChange()`
  - `src/modules/evidence/evidence.module.ts` -- Replaced `forwardRef(() => LaneModule)` with plain `LaneModule`; replaced `LaneService` in inject array with `LANE_RECONCILER`
  - `src/modules/lane/lane.service.spec.ts` -- Removed ProofPackService mock; added `findProofPackSummaryById` to laneStore mock; updated createService() to 7 params
  - `src/modules/lane/lane-timeline.spec.ts` -- Same changes as above; replaced `getPackByIdMock` assertion with `findProofPackSummaryByIdMock`
  - `src/modules/lane/lane.pg-store.spec.ts` -- Added two tests for `findProofPackSummaryById` (valid pack returns summary, missing pack returns null); updated db-backed test LaneService constructor to 7 params
  - `src/modules/evidence/evidence.service.spec.ts` -- Replaced `LaneService` mock with `laneReconciler` mock using `reconcileAfterEvidenceChange`; updated all assertions

- TDD evidence:
  - Tests were updated alongside implementation changes
  - All 266 tests pass, 0 failures

- Tests run and results:
  - `npm run typecheck` -- 0 errors
  - `npm run lint` -- 0 errors
  - `npm test` -- 33 suites passed, 4 skipped (db-backed), 266 tests passed, 9 skipped

- Wiring verification evidence:
  - `grep -rn "forwardRef" src/modules/lane/ src/modules/evidence/` returns ZERO results
  - LANE_RECONCILER is defined in lane.constants.ts, provided in lane.module.ts, injected in evidence.service.ts, used in evidence.module.ts factory
  - LaneReconciler interface defined in lane.types.ts, implemented by LaneService, consumed by EvidenceService
  - findProofPackSummaryById defined in LaneStore interface, implemented in PrismaLaneStore, used in LaneService.buildTimelineMetadata()

- Behavior changes and risk notes:
  - The timeline metadata for PROOF_PACK entries now returns `contentHash: null` and `errorMessage: null` instead of fetching the full pack details from ProofPackService. This is acceptable because: (1) when payloadSnapshot is present (the normal case), the original values are preserved; (2) the fallback path via store query returns summary fields only. If content hash or error message were critical in the fallback path, they could be added to the SQL query.
  - The dependency direction is now strictly one-way: EvidenceModule imports LaneModule (not vice versa).

- Follow-ups / known gaps:
  - If proof_packs.content_hash or proof_packs.error_message are needed in the timeline fallback path, extend `findProofPackSummaryById` to include those columns.
