# Shared Rule Pack Metadata

## Plan Draft A

### Overview

Add shared, machine-readable metadata to every rule pack so the rules system can state whether a pack is curated, proxy-mixed, or primary/exhaustive, and can carry structured non-pesticide checks without burying that information in comments. Keep the first implementation backward-compatible by exposing the metadata through the existing ruleset snapshot/API path without changing enforcement semantics yet.

### Files to Change

- `src/modules/rules-engine/rules-engine.types.ts`
  - Add typed metadata models for coverage state, source quality, retrieval date, commodity code, and non-pesticide checks.
- `src/modules/rules-engine/rules-engine.utils.ts`
  - Parse and validate the new YAML metadata fields and preserve them in snapshots.
- `src/modules/rules-engine/rule-definition.files.ts`
  - Keep CSV parsing unchanged for now; only YAML-level metadata changes in this batch.
- `src/modules/lane/lane.types.ts`
  - Extend lane snapshot payload/contracts to carry the new metadata.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Add repository-loader and inline-YAML tests for the new metadata.
- `test/rules-engine.e2e-spec.ts`
  - Assert the ruleset endpoint returns the new metadata.
- `frontend/src/lib/types.ts`
  - Extend frontend rule snapshot types.
- `rules/korea/mango.yaml`
  - Backfill truthful metadata on the strongest current pack.
- `rules/japan/mango.yaml`
  - Backfill truthful metadata.
- `rules/japan/durian.yaml`
  - Backfill truthful metadata.
- `rules/japan/mangosteen.yaml`
  - Backfill truthful metadata.
- `rules/japan/longan.yaml`
  - Backfill truthful metadata.

### Implementation Steps

1. TDD sequence
   1. Add loader test coverage for inline metadata parsing and one repository pack assertion.
   2. Add ruleset e2e coverage for metadata serialization.
   3. Run tests and confirm failures due to missing fields/types.
   4. Implement the smallest backend type/parser/snapshot changes.
   5. Backfill metadata to the five existing YAML packs.
   6. Update frontend types to match the backend contract.
   7. Run focused tests, then lint/typecheck/build.
2. Add typed shared metadata.
   - `coverageState`
   - `sourceQuality`
   - `retrievedAt`
   - `commodityCode`
   - `nonPesticideChecks`
3. Keep this batch backward-compatible.
   - Metadata is additive and optional in code.
   - Existing rule evaluation stays unchanged.
4. Backfill current packs with truthful values.
   - `KOREA/MANGO` as primary-source numeric pack with structured VHT requirement.
   - Japan packs as curated/proxy-mixed where appropriate.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads shared rule metadata from inline yaml`
  - `loads repository korea mango metadata`
- `test/rules-engine.e2e-spec.ts`
  - `GET ruleset returns shared rule metadata`

### Decision Completeness

- Goal
  - Add one shared metadata model across the rules system and backfill current packs.
- Non-goals
  - Do not make any pack exhaustive in this batch.
  - Do not change evaluation rules beyond carrying metadata.
- Success criteria
  - All current YAML packs parse with shared metadata.
  - Ruleset API returns the metadata.
  - Frontend types accept the metadata without breakage.
- Public interfaces
  - Rule YAML schema expands.
  - `RuleSnapshotPayload` expands.
  - Frontend `RuleSnapshot` expands.
- Edge cases / failure modes
  - Invalid enum-like metadata value: fail closed at load time.
  - Missing metadata in old packs: allowed during transition only if tests/fixtures cover optional handling.
- Rollout & monitoring
  - Backward-compatible additive rollout.
  - No migration or feature flag needed.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
  - `npm run typecheck && npm run lint && npm run build`

### Dependencies

- Existing YAML rule packs under `rules/`
- Existing ruleset snapshot serialization path

### Validation

- Loader tests prove parsing.
- E2E proves the HTTP ruleset contract.
- Typecheck proves frontend/backend contract alignment.

### Wiring Verification

| Component                     | Entry Point                                            | Registration Location                                                       | Schema/Table                     |
| ----------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------- |
| Shared metadata in YAML       | `RuleLoaderService.getRuleDefinition()`                | `buildRuleDefinition()` in `src/modules/rules-engine/rules-engine.utils.ts` | N/A                              |
| Metadata in rule snapshots    | `RulesEngineService.getRuleSnapshot()`                 | `buildRuleSnapshotPayload()` and lane/evidence snapshot adapters            | `lane_rule_snapshots.rules` JSON |
| Metadata in ruleset API       | `GET /rules/markets/:market/products/:product/ruleset` | `src/modules/rules-engine/rules-engine.controller.ts`                       | response payload only            |
| Frontend metadata consumption | lane detail/admin rule consumers                       | `frontend/src/lib/types.ts` and callers                                     | response payload only            |

## Plan Draft B

### Overview

Add only the backend/shared metadata contract first, without touching the existing YAML packs yet, then backfill the rule files in a separate follow-up. This is safer if the metadata vocabulary is likely to change, but it delays the repo-wide honesty improvement the user explicitly asked for.

### Files to Change

- Same backend/frontend type files as Draft A.
- Skip the five existing rule YAML files in this batch.

### Implementation Steps

1. Add additive metadata types and parser support.
2. Add tests using temporary inline YAML only.
3. Expose the metadata through ruleset payloads.
4. Backfill current packs later.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads optional rule metadata from inline yaml`
- `test/rules-engine.e2e-spec.ts`
  - `GET ruleset returns optional metadata fields when present`

### Decision Completeness

- Goal
  - Introduce the shared metadata schema with minimal file churn.
- Non-goals
  - Do not backfill existing packs yet.
- Success criteria
  - Code can parse and return metadata when present.
- Public interfaces
  - Same additive contract changes as Draft A.
- Edge cases / failure modes
  - Existing repo still over-claims precision until backfill is done.
- Rollout & monitoring
  - Lowest-risk technical rollout, weaker product value.
- Acceptance checks
  - Same focused tests and gates as Draft A.

### Dependencies

- Same as Draft A.

### Validation

- Inline loader tests and ruleset API serialization.

### Wiring Verification

| Component                  | Entry Point                         | Registration Location | Schema/Table    |
| -------------------------- | ----------------------------------- | --------------------- | --------------- |
| Optional metadata contract | `RuleLoaderService` and ruleset API | same as Draft A       | same as Draft A |

## Comparative Analysis

### Strengths

- Draft A delivers the actual outcome the user asked for: shared metadata plus immediate backfill.
- Draft B minimizes churn if the metadata vocabulary is unstable.

### Gaps

- Draft A touches more files.
- Draft B leaves the repo in a still-misleading state.

### Trade-offs

- Draft A optimizes for truthful repo state now.
- Draft B optimizes for staging the contract before content.

### Compliance

- Both plans preserve the repo’s file-backed rules architecture and additive snapshot contract.
- Draft A better matches the rule-authoring plan already recorded in the coding logs.

## Unified Execution Plan

### Overview

Implement the shared metadata contract and backfill the five existing YAML rule packs in the same batch, but keep the runtime enforcement logic unchanged. The metadata must flow from YAML to rule snapshot to HTTP payload to frontend types so later combo-by-combo exhaustiveness work has a stable foundation.

### Files to Change

- `src/modules/rules-engine/rules-engine.types.ts`
- `src/modules/rules-engine/rules-engine.utils.ts`
- `src/modules/lane/lane.types.ts`
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `test/rules-engine.e2e-spec.ts`
- `frontend/src/lib/types.ts`
- `rules/korea/mango.yaml`
- `rules/japan/mango.yaml`
- `rules/japan/durian.yaml`
- `rules/japan/mangosteen.yaml`
- `rules/japan/longan.yaml`

### Implementation Steps

1. TDD sequence
   1. Add a temporary-YAML loader test for shared metadata parsing.
   2. Add repository-pack assertions for Korea mango metadata.
   3. Add ruleset e2e coverage for metadata serialization.
   4. Run the focused tests and confirm RED failures.
   5. Implement the smallest backend type/parser/snapshot changes.
   6. Backfill the five repository YAML files.
   7. Update frontend types.
   8. Run focused tests, then repo gates.
2. Add shared metadata types
   - `RuleCoverageState`
   - `RuleSourceQuality`
   - `RuleNonPesticideCheck`
   - `RuleMetadata`
3. Extend snapshot contracts
   - `RuleSetDefinition`
   - `RuleSnapshotPayload`
   - `LaneRuleSnapshot`
   - `LaneRuleSnapshotPayload`
4. Backfill current packs with truthful metadata
   - Korea mango: primary-source thresholds, structured VHT check, commodity code
   - Japan mango: curated-high-risk
   - Japan durian/mangosteen/longan: proxy-mixed where applicable

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads shared rule metadata from inline yaml` - parser supports new metadata.
  - `loads repository korea mango rule metadata` - repository pack carries fields.
- `test/rules-engine.e2e-spec.ts`
  - `GET /rules/.../ruleset returns shared rule metadata` - API exposes metadata.

### Decision Completeness

- Goal
  - Add one shared metadata layer across the rules system and backfill existing packs.
- Non-goals
  - No exhaustive source recapture yet.
  - No new enforcement logic yet.
- Success criteria
  - Shared metadata exists in code and in all five current YAML rule packs.
  - Ruleset API returns the metadata.
  - Focused backend/e2e tests pass.
- Public interfaces
  - YAML rule definition schema now accepts metadata.
  - Snapshot payload and lane snapshot payload now include metadata.
  - Frontend `RuleSnapshot` now includes metadata.
- Edge cases / failure modes
  - Unsupported metadata value: loader throws and pack fails closed.
  - Missing `retrievedAt` or `commodityCode`: allowed if metadata omitted entirely, but repository packs in this batch must include them.
  - Non-pesticide check missing parameters: parser rejects malformed check definitions.
- Rollout & monitoring
  - Additive, no migration.
  - Backout by reverting YAML metadata and additive contract changes.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies

- Current repository rule packs and ruleset endpoint.

### Validation

- Loader, e2e, typecheck, lint, build.

### Wiring Verification

| Component                           | Entry Point                                                  | Registration Location                                                                         | Schema/Table                                          |
| ----------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Rule metadata in YAML               | `RuleLoaderService.loadFromDisk()` and `getRuleDefinition()` | parsed in `src/modules/rules-engine/rules-engine.utils.ts` via `loadRuleDefinitionFromFile()` | N/A                                                   |
| Rule metadata in ruleset payload    | `RulesEngineService.getRuleSnapshot()`                       | `buildRuleSnapshotPayload()` and `RulesEngineController.getRuleSet()`                         | response payload and `lane_rule_snapshots.rules` JSON |
| Rule metadata in lane snapshots     | lane creation / evidence consumers                           | `src/modules/lane/*` snapshot contracts and existing adapters                                 | `lane_rule_snapshots.rules` JSON                      |
| Rule metadata in frontend consumers | frontend rules and lane detail consumers                     | `frontend/src/lib/types.ts`                                                                   | response payload only                                 |

## 2026-04-04 11:33 +07

- Goal: Add shared rule-pack metadata across the rules system: coverage state, source quality, retrieval date, commodity code, and structured non-pesticide checks.
- What changed:
  - `src/modules/rules-engine/rules-engine.types.ts`
    - Added shared rule metadata types: `RuleCoverageState`, `RuleSourceQuality`, `RuleNonPesticideCheckType`, `RuleNonPesticideCheckStatus`, `RuleMetadata`, and `RuleNonPesticideCheck`.
    - Extended `RuleSetDefinition`, `RuleSnapshotPayload`, and `RuleDefinitionSource` to carry the new metadata.
  - `src/modules/rules-engine/rules-engine.utils.ts`
    - Added metadata parsing/validation in `buildRuleDefinition()`.
    - Extended `buildRuleSnapshotPayload()` and `adaptLaneSnapshotToRulePayload()` so metadata survives loader -> snapshot -> consumer flows.
  - `src/modules/lane/lane.types.ts`
    - Extended lane snapshot contracts to carry rule metadata.
  - `src/modules/lane/lane.pg-store.ts`
    - Persisted `metadata` and `labPolicy` into `rule_snapshots.rules` JSON during lane creation.
  - `src/modules/evidence/evidence.pg-store.ts`
    - Added metadata/labPolicy hydration from stored lane rule snapshots so evidence-side consumers keep the new fields.
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Added RED/GREEN coverage for inline YAML metadata parsing and repository Korea/Japan metadata loading.
  - `test/rules-engine.e2e-spec.ts`
    - Extended mocked ruleset payloads/assertions to include shared metadata.
    - Disabled the unrelated proof-pack worker in this focused rules-engine e2e harness so the ruleset tests can execute reliably.
  - `frontend/src/lib/types.ts`
    - Added frontend `RuleMetadata` and `RuleNonPesticideCheck` types and extended `RuleSnapshot`.
  - `rules/japan/mango.yaml`
    - Backfilled shared metadata with truthful `CURATED_HIGH_RISK` / `PRIMARY_ONLY` status and structured non-pesticide checks.
  - `rules/japan/durian.yaml`
    - Backfilled shared metadata with truthful `PROXY_MIXED` / `PRIMARY_PLUS_SECONDARY` status and structured non-pesticide checks.
  - `rules/japan/mangosteen.yaml`
    - Backfilled shared metadata with truthful `PROXY_MIXED` / `PRIMARY_PLUS_SECONDARY` status and structured non-pesticide checks, including informational VHT exemption metadata.
  - `rules/japan/longan.yaml`
    - Backfilled shared metadata with truthful `PROXY_MIXED` / `PRIMARY_PLUS_SECONDARY` status and structured non-pesticide checks.
  - `rules/korea/mango.yaml`
    - Backfilled shared metadata with truthful `PRIMARY_PARTIAL` / `PRIMARY_ONLY` status, commodity code `ap105050006`, and structured VHT metadata.
- TDD evidence:
  - Tests added/changed:
    - `RuleLoaderService › loads a rule definition from YAML and computes derived fields`
    - `RuleLoaderService › loads csv-backed substances from the repository rule files`
    - `RuleLoaderService › loads the repository korea mango rule file`
    - `RulesEngineController (e2e) › GET /rules/markets/KOREA/products/MANGO/ruleset returns lab policy and fallback metadata`
  - RED command:
    - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - Failure reason: `definition.metadata` was `undefined` because rule metadata did not exist in the parser/types yet.
  - Additional RED command:
    - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
    - Failure reason: the focused rules-engine e2e harness booted the unrelated proof-pack worker without a configured store; fixed by disabling that worker in this e2e file before validating the new ruleset metadata assertions.
  - GREEN commands:
    - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` -> 9/9 passed
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts` -> 7/7 passed
  - `npm run typecheck` -> passed
  - `cd frontend && npx tsc --noEmit` -> passed
  - `npm run lint` -> passed
  - `cd frontend && npm run lint` -> passed
  - `npm run build` -> passed
  - `cd frontend && npm run build` -> passed
- Wiring verification evidence:
  - `RuleLoaderService.loadFromDisk()` still discovers repository YAMLs and now loads the additive metadata via `buildRuleDefinition()` in `src/modules/rules-engine/rules-engine.utils.ts`.
  - `RulesEngineService.getRuleSnapshot()` returns metadata through `buildRuleSnapshotPayload()`.
  - `PrismaLaneStore.createLaneBundle()` now persists metadata into `rule_snapshots.rules` JSON so lane creation snapshots retain the new fields.
  - `PrismaEvidenceStore.findLaneById()` now hydrates metadata from stored snapshots so evidence/proof-pack consumers see the same rule metadata.
  - The HTTP ruleset endpoint `/rules/markets/:market/products/:product/ruleset` exposes the metadata through the existing controller/service path.
- Behavior changes and risk notes:
  - Rule packs now declare explicit precision/provenance metadata instead of relying on comments or logs alone.
  - The new metadata is additive only; no rule-evaluation logic changed in this batch.
  - Fail-closed behavior: malformed metadata causes rule loading to fail rather than silently downgrading semantics.
- Follow-ups / known gaps:
  - The admin rules page now has the types needed for metadata, but it does not yet render the new fields.
  - The Korea mango YAML still has stale top-file comment text from before the 64-row MFDS population; the new metadata reduces ambiguity, but the comments should still be cleaned up.
  - Exhaustiveness is still a future combo-by-combo source-capture task; this batch only adds shared metadata and truthful labels.

## Review (2026-04-04 11:33 +07) - working-tree

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; `git diff --name-only`; focused `git diff` on touched rule-metadata files; `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`; `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`; `npm run typecheck`; `cd frontend && npx tsc --noEmit`; `npm run lint`; `cd frontend && npm run lint`; `npm run build`; `cd frontend && npm run build`

### Findings

CRITICAL

- No findings.

HIGH

- No findings.

MEDIUM

- No findings.

LOW

- `frontend/src/lib/types.ts` now exposes the metadata contract, but there is still no UI surface showing these fields. That is acceptable for this batch because the user asked for shared metadata plumbing, not display.

### Open Questions / Assumptions

- Assumed `coverageState` is intentionally a truthful summary label, not an enforcement input.
- Assumed `commodityCode` may be `null` when the repo does not yet have a trustworthy official code for a pack.

### Recommended Tests / Validation

- Add one backend integration test that creates a lane and proves the persisted `rule_snapshots.rules` JSON retains `metadata` on reload.
- Add one lane-detail or admin-page rendering test once the UI starts displaying the new metadata.

### Rollout Notes

- Additive, no migration required.
- Safe to ship before any combo-by-combo exhaustiveness work because no evaluation logic changed.

## Implementation (2026-04-04 11:41:57 +07) - admin-rules-metadata-ui

### Goal

Render the new shared rule-pack metadata in the admin rules UI so operators can see coverage state, source quality, retrieval date, commodity code, and structured non-pesticide checks for each supported market/product pack.

### What Changed

- `frontend/src/lib/rules-data.ts`
  - Extended the admin loader shape with `rulesetsByMarket`.
  - Added per-market/per-product ruleset fetches against `/api/zrl/rules/markets/:market/products/:product/ruleset`.
  - Treated `400`/`404` as unsupported combos instead of hard failures so the page can render partial market coverage truthfully.
- `frontend/src/app/(app)/admin/rules/page.tsx`
  - Added a `Rule Pack Metadata` section above the substance table.
  - Rendered per-pack cards showing product, version, coverage/source badges, retrieval date, commodity code, document count, substance count, and structured non-pesticide checks.
  - Reused the existing shared type contract from the frontend metadata plumbing.
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - Backfilled mocked loader payloads with `rulesetsByMarket`.
  - Added coverage proving the metadata card renders for supported packs.
  - Tightened the heading assertion to use the heading accessible name rather than brittle exact text matching that broke once the product emoji was rendered.

### TDD Evidence

- Added/changed tests:
  - `RulesAdminPage renders markets and live substances from the loader`
  - `RulesAdminPage renders shared metadata for supported rule packs`
- RED:
  - Command: `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`
  - Failure: `getByText('Mango pack')` failed because the rendered heading was split by the product emoji, so the assertion did not match visible accessible content.
- GREEN:
  - Command: `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`

### Tests Run

- `cd frontend && npx prettier --write 'src/app/(app)/admin/rules/page.test.tsx'` - passed
- `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'` - passed (`4/4`)
- `cd frontend && npm run lint` - passed
- `cd frontend && npx tsc --noEmit` - passed
- `cd frontend && npm run build` - passed

### Wiring Verification

- Admin data entry point remains `loadRulesAdminData()` in `frontend/src/lib/rules-data.ts`, now with explicit ruleset fetches per known product.
- The admin page consumes `data.rulesetsByMarket[selectedMarket]` in `frontend/src/app/(app)/admin/rules/page.tsx`, so the new metadata card is wired directly off the backend ruleset endpoint contract rather than duplicated frontend constants.
- The rendering path is covered by `frontend/src/app/(app)/admin/rules/page.test.tsx`.

### Behavior Changes And Risks

- The admin page now shows truthful metadata for each supported pack in the selected market.
- Unsupported market/product combinations fail open in the UI as “not available” rather than aborting the whole page load when the backend returns `400` or `404`.
- Risk remains that fetching all known products per market adds extra requests; acceptable at current scale, but if the supported matrix expands materially this should move to a backend aggregate endpoint.

### Follow-ups / Known Gaps

- The admin page does not yet sort or filter rule packs; it renders whatever order the loader returns.
- If the product matrix grows beyond the current four fruit types, replace the frontend constant list with a backend-supported combos endpoint.

## Review (2026-04-04 11:41:57 +07) - admin-rules-metadata-ui

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; focused `git diff -- frontend/src/lib/rules-data.ts frontend/src/app/'(app)'/admin/rules/page.tsx frontend/src/app/'(app)'/admin/rules/page.test.tsx`; `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`; `cd frontend && npm run lint`; `cd frontend && npx tsc --noEmit`; `cd frontend && npm run build`

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

- Assumed the current four-product list is the intended initial supported matrix for the admin page.
- Assumed ignoring `400` and `404` on per-product ruleset fetches is correct because those statuses represent unsupported combos rather than page-level errors.

### Recommended Tests / Validation

- Add one loader-level frontend test that mocks a `404` ruleset response for an unsupported combo and proves the page still renders supported packs for the market.
- Add an end-to-end admin test once the backend/frontend local harness is stable enough to exercise live ruleset responses.

### Rollout Notes

- Pure UI/data-loader extension on top of the additive metadata contract.
- No persistence or enforcement logic changed in this follow-up.

## Review (2026-04-04 11:47:35 +07) - g-check working-tree shared-rule-pack-metadata

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: `git status --porcelain=v1`; scoped `git diff` on metadata/UI files; `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`; `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`; `npm run typecheck`; `npm run lint`; `npm run build`; `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`; `cd frontend && npm run lint`; `cd frontend && npx tsc --noEmit`; `cd frontend && npm run build`

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

- Assumed this PR should include only the shared metadata contract, YAML backfill, admin UI rendering, and the active coding log, not the unrelated dirty files already present in the repo.
- Assumed the frontend product matrix remains the current four fruit types until a backend-supported combos index exists.

### Recommended Tests / Validation

- Add a frontend loader test that explicitly simulates mixed supported and unsupported market/product ruleset responses and proves the admin page degrades cleanly.
- Add one lane snapshot persistence integration test that round-trips `metadata` through lane creation and reload.

### Rollout Notes

- Ready to submit as one atomic change set.
- No review findings blocked submission.
