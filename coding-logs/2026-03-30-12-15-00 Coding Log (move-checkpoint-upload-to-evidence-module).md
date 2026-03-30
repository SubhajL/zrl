# Coding Log: Move Checkpoint Upload Endpoint to Evidence Module

## 2026-03-30 12:15 ICT

- Goal: Fix DI resolution bug where `LaneController` injects `EvidenceService` but `LaneModule` no longer imports `EvidenceModule` (forwardRef was removed in prior refactoring). Solution: move the checkpoint upload endpoint from `LaneController` to a new `CheckpointEvidenceController` in `EvidenceModule`, keeping the dependency one-directional (EvidenceModule -> LaneModule).

- What changed:
  - `src/modules/evidence/checkpoint-evidence.controller.ts` -- NEW file. Contains `CheckpointEvidenceController` with `@Controller('lanes')` prefix and `@Post(':id/checkpoints')` endpoint. Moved from `LaneController`: the multipart checkpoint upload handler, `parseCreateCheckpointInput`, `getMetadataNumber`, `getMetadataDate`, `createCheckpointUploadInterceptor`, and related types/constants.
  - `src/modules/evidence/checkpoint-evidence.controller.spec.ts` -- NEW file. Three unit tests: creates checkpoint with photo+signature artifacts, returns 400 for missing photo, returns 400 for missing signature.
  - `src/modules/lane/lane.controller.ts` -- REMOVED: `EvidenceService` import/injection, `@Post(':id/checkpoints')` multipart handler, `CHECKPOINT_FILE_SIZE_LIMIT_BYTES`, `UploadedMultipartFile`/`UploadedCheckpointFiles`/`DiskStorageFactory` types, `parseCreateCheckpointInput`, `createCheckpointUploadInterceptor`, `getMetadataNumber`, `getMetadataDate`, `parseNumberLike`/`parseOptionalNumberLike`/`parsePositiveIntegerLike` (now dead code), and unused imports (`UploadedFiles`, `UseInterceptors`, `FileFieldsInterceptor`, `rm`, `randomUUID`, `tmpdir`, `extname`, `diskStorage`, `ArtifactSource`, `CreateCheckpointInput`). Constructor reduced to `constructor(private readonly laneService: LaneService) {}`.
  - `src/modules/evidence/evidence.module.ts` -- Added `CheckpointEvidenceController` to controllers array. Fixed MEDIUM issue: changed factory parameter type from `unknown` to `LaneReconciler` and removed `as never` cast. Added `import type { LaneReconciler }` from lane types.

- TDD evidence:
  - RED: `checkpoint-evidence.controller.spec.ts` failed with `Cannot find module './checkpoint-evidence.controller'`
  - GREEN: All 3 tests passed after creating `checkpoint-evidence.controller.ts`

- Tests run and results:
  - `npm run typecheck` -- 0 errors
  - `npm run lint` -- 0 errors
  - `npm test` -- 34 suites passed, 4 skipped, 269 tests passed, 9 skipped, 0 failures

- Wiring verification evidence:
  - `grep -n "EvidenceService" src/modules/lane/lane.controller.ts` -- ZERO results
  - `grep -rn "forwardRef" src/modules/lane/ src/modules/evidence/` -- ZERO results
  - `grep -n "evidence" src/modules/lane/lane.module.ts` -- ZERO results
  - `CheckpointEvidenceController` found in: `evidence.module.ts:19` (import), `evidence.module.ts:43` (controllers array)

- Behavior changes and risk notes:
  - URL remains identical: `POST /lanes/:id/checkpoints` -- no client-side changes needed.
  - The endpoint is now served by `EvidenceModule` instead of `LaneModule`. Since `EvidenceModule` already imports `LaneModule` and has access to `LaneService`, and has its own `EvidenceService`, DI resolution is clean.
  - E2e tests using `AppModule` (which imports both modules) continue to pass with no changes.

- Follow-ups / known gaps:
  - None. The DI resolution bug is fully fixed.
