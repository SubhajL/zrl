# Lane Wizard Cold-Chain Config

Planning timestamp: 2026-04-04 12:16:20 ICT

## Plan Draft A

### Overview

Restore the lane creation wizard so its cold-chain route step matches the backend contract already enforced by `ColdChainService`. Manual mode should carry no device/frequency fields, while Logger and Telemetry should collect and submit `deviceId` and `dataFrequencySeconds`, with review-step visibility and focused frontend test coverage.

This keeps the change tightly scoped to the current UI mismatch. The backend validator and persistence flow already support the richer payload and should remain unchanged unless a concrete bug appears during verification.

### Files to Change

- `frontend/src/app/(app)/lanes/new/page.tsx`
  - Add route-step state, conditional inputs, client-side validation messaging, payload wiring, and review-step rows for cold-chain device/frequency.
- `frontend/src/app/(app)/lanes/new/page.test.tsx`
  - Add tests for conditional route inputs, mode-specific validation, review rendering, and submit payload shape.
- `frontend/e2e/helpers/lane-wizard.ts`
  - Keep helper aligned with the restored UI if labels/test ids need minor adjustments.
- `coding-logs/2026-04-04-12-16-20 Coding Log (lane-wizard-cold-chain-config).md`
  - Record the plan and, later, implementation evidence.

### Implementation Steps

1. TDD sequence
   1. Add/extend lane wizard tests for Logger/Telemetry conditional fields and payload.
   2. Run the focused test file and confirm RED failures because the current UI lacks those inputs and review rows.
   3. Implement the smallest page changes to render and submit the fields.
   4. Refactor minimally by extracting shared validation helpers if needed.
   5. Run focused frontend gates plus a targeted Playwright repro.
2. Add cold-chain route state in the page component
   - `coldChainDeviceId`
   - `coldChainDataFrequencySeconds`
3. Add client-side validation derived from backend rules
   - `MANUAL`: no extra fields
   - `LOGGER`: device ID required, frequency required, integer `300–900`
   - `TELEMETRY`: device ID required, frequency required, integer `1–60`
4. Render route-step inputs conditionally
   - show both fields for Logger/Telemetry
   - hide both for Manual
   - include concise helper copy for allowed frequency ranges
5. Include the values in request payload and review summary
   - send `coldChainConfig.deviceId` and `coldChainConfig.dataFrequencySeconds` only when mode is not Manual
   - add stable review test ids for device/frequency rows
6. Keep E2E helper alignment
   - only adjust helper selectors if the restored UI labels/test ids differ from the existing helper assumptions

### Test Coverage

- `frontend/src/app/(app)/lanes/new/page.test.tsx`
  - `shows device and frequency inputs for logger mode` - conditional fields render
  - `shows device and frequency inputs for telemetry mode` - conditional fields render
  - `hides device and frequency inputs for manual mode` - manual stays simple
  - `blocks next review when logger config is incomplete` - client validation gates step 2
  - `blocks next review when telemetry frequency exceeds 60 seconds` - telemetry constraint enforced
  - `includes cold-chain config details in review summary` - review rows render with test ids
  - `submits logger cold-chain config in lane create payload` - request matches backend contract
- `frontend/e2e/helpers/lane-wizard.ts`
  - no dedicated unit test, but targeted Playwright repro should pass once UI is restored

### Decision Completeness

- Goal
  - Make the lane wizard’s cold-chain configuration semantically match the backend validator and domain model.
- Non-goals
  - Do not change backend cold-chain validation rules in this batch.
  - Do not redesign the whole lane wizard flow.
- Success criteria
  - Logger and Telemetry lanes can be configured in the UI without backend rejection caused by missing device/frequency data.
  - Review step surfaces the entered device/frequency values.
  - Focused frontend tests pass.
  - The previous Playwright failure waiting for `Device ID` is resolved.
- Public interfaces
  - Frontend lane-create request body now conditionally includes `coldChainConfig.deviceId` and `coldChainConfig.dataFrequencySeconds`.
  - No backend API shape change.
- Edge cases / failure modes
  - Manual mode must fail open by omitting extra fields.
  - Logger invalid range should fail closed in the UI and not advance to review.
  - Telemetry invalid range should fail closed in the UI and not advance to review.
  - Switching from Logger/Telemetry back to Manual should not send stale config fields.
- Rollout & monitoring
  - Frontend-only rollout; no migration or feature flag.
  - Watch for lane-create 400s related to cold-chain config after the change.
- Acceptance checks
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
  - `cd frontend && npm run lint`
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-japan-air'`

### Dependencies

- Existing backend validator in `src/modules/cold-chain/cold-chain.service.ts`
- Existing lane create controller/service wiring
- Existing Playwright helper/scenario contract

### Validation

- Focused unit coverage on the lane wizard page
- One targeted Playwright repro for the original broken supported scenario
- Optional broader matrix rerun once the first repro passes

### Wiring Verification

| Component                         | Entry Point                                | Registration Location                       | Schema/Table                                                   |
| --------------------------------- | ------------------------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| Route-step cold-chain inputs      | `LaneCreationWizard` step 2 render path    | `frontend/src/app/(app)/lanes/new/page.tsx` | N/A                                                            |
| Lane create payload config        | `handleCreateLane()` POST `/api/zrl/lanes` | same page component                         | backend `lanes.cold_chain_*` fields via existing service/store |
| Review-step device/frequency rows | `StepReview` render path                   | same page component                         | N/A                                                            |
| Playwright helper route fill      | `completeLaneWizardToReview()`             | `frontend/e2e/helpers/lane-wizard.ts`       | N/A                                                            |

## Plan Draft B

### Overview

Keep the UI simpler by only collecting `deviceId` in the route step and auto-defaulting frequency by mode in the frontend payload (`600` for Logger, `30` for Telemetry). This would reduce operator friction, but it introduces hidden defaults that are not currently expressed in the backend or the scenario fixtures.

This plan optimizes for a shorter form, but it invents policy in the frontend and weakens explicit operator control over monitoring cadence.

### Files to Change

- `frontend/src/app/(app)/lanes/new/page.tsx`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`
- maybe `frontend/src/lib/testing/lane-creation-scenarios.ts` if scenario expectations need simplification

### Implementation Steps

1. Add only a `Device ID` field for non-manual modes.
2. Derive frequency automatically from the selected mode.
3. Render derived frequency in the review step as informational text.
4. Submit both values to the backend.

### Test Coverage

- `auto-fills logger frequency in payload`
- `auto-fills telemetry frequency in payload`
- `requires device id for instrumented modes`

### Decision Completeness

- Goal
  - Reduce operator input burden while satisfying backend requirements.
- Non-goals
  - Do not expose frequency choice in the UI.
- Success criteria
  - Lane create succeeds for Logger/Telemetry with only device ID entered.
- Public interfaces
  - Frontend behavior changes by silently defaulting frequency.
- Edge cases / failure modes
  - Hidden defaults can diverge from real device cadence.
  - Scenario fixtures become less truthful if they still carry explicit frequencies.
- Rollout & monitoring
  - Simpler rollout, but riskier semantics.
- Acceptance checks
  - same frontend checks as Draft A

### Dependencies

- Same as Draft A, with stronger dependency on team approval for implicit defaults.

### Validation

- Focused page tests and a targeted Playwright repro.

### Wiring Verification

| Component                    | Entry Point          | Registration Location                       | Schema/Table                                      |
| ---------------------------- | -------------------- | ------------------------------------------- | ------------------------------------------------- |
| Auto-default frequency logic | `handleCreateLane()` | `frontend/src/app/(app)/lanes/new/page.tsx` | backend `lanes.cold_chain_data_frequency_seconds` |
| Device-only UI               | route step           | same page component                         | N/A                                               |

## Comparative Analysis

### Strengths

- Draft A matches the existing backend/domain contract exactly and keeps user intent explicit.
- Draft B shortens the form.

### Gaps

- Draft A adds two more user inputs in the route step.
- Draft B invents frontend defaults that are not declared anywhere in the backend contract.

### Trade-offs

- Draft A favors correctness and explicit monitoring configuration.
- Draft B favors UX brevity but hides important cold-chain behavior.

### Compliance

- Draft A aligns with the cold-chain module guidance (`Manual`, `Logger`, `Telemetry` with real cadence differences).
- Draft B risks violating the repo preference for explicit domain-critical behavior.

## Unified Execution Plan

### Overview

Implement explicit cold-chain device and frequency inputs in the lane wizard for Logger and Telemetry, keep Manual mode simple, and align the review step and POST payload with the backend validator already in place. Do this as a frontend-focused fix with tests first, because the backend contract and persistence path are already correct.

### Files to Change

- `frontend/src/app/(app)/lanes/new/page.tsx`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`
- `frontend/e2e/helpers/lane-wizard.ts` only if selector alignment is needed

### Implementation Steps

1. TDD sequence
   1. Add focused page tests for conditional inputs, mode validation, review rendering, and POST payload.
   2. Run the lane page test file and confirm failures due to missing fields/review rows.
   3. Implement route-step state and validation in `page.tsx`.
   4. Re-run focused tests until green.
   5. Run `lint`, `tsc`, and a targeted Playwright repro.
2. Add route-step state
   - `coldChainDeviceId: string`
   - `coldChainDataFrequencySeconds: string`
3. Add validation helper logic in the page
   - `getColdChainConfigError(mode, deviceId, frequency)` returns a user-facing error or `null`
   - enforce `LOGGER` frequency `300–900`
   - enforce `TELEMETRY` frequency `1–60`
4. Update `StepRoute`
   - render conditional `Device ID` input for Logger/Telemetry
   - render conditional `Data Frequency (seconds)` input for Logger/Telemetry
   - show concise helper text and validation error state
5. Update navigation gating
   - disable `Next: Review` on step 2 when the current cold-chain config is invalid
6. Update `handleCreateLane`
   - omit device/frequency for Manual
   - include parsed integer values for Logger/Telemetry in `coldChainConfig`
7. Update `StepReview`
   - show device/frequency rows when present
   - add stable `data-testid` values for Playwright and page tests
8. Keep Playwright helper aligned
   - verify existing labels remain `Device ID` and `Data Frequency (seconds)` so no helper change is needed unless the rendered markup differs

### Test Coverage

- `frontend/src/app/(app)/lanes/new/page.test.tsx`
  - `renders conditional cold-chain inputs for logger and telemetry`
  - `disables next review when logger device id is missing`
  - `disables next review when logger frequency is out of range`
  - `disables next review when telemetry frequency exceeds 60 seconds`
  - `renders device and frequency in the review step`
  - `submits cold-chain config for telemetry lanes`

### Decision Completeness

- Goal
  - Align the lane wizard with the explicit backend cold-chain contract.
- Non-goals
  - No backend validator changes.
  - No broader lane-wizard redesign.
- Success criteria
  - Frontend no longer sends invalid logger/telemetry payloads.
  - Logger/Telemetry users can enter the required monitoring config.
  - The original Playwright route-step timeout is eliminated.
- Public interfaces
  - Frontend POST `/api/zrl/lanes` body changes only by including already-supported fields.
- Edge cases / failure modes
  - Manual mode strips stale config and remains valid.
  - Non-numeric frequency fails closed before review.
  - Mode switches preserve user-entered values unless they would cause an invalid payload to be submitted; hidden manual state is not sent.
- Rollout & monitoring
  - Frontend-only deployment.
  - Watch for any remaining lane-create 400s related to cold-chain config.
- Acceptance checks
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
  - `cd frontend && npm run lint`
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-japan-air'`

### Dependencies

- Existing `ColdChainService.validateLaneConfiguration()`
- Existing lane create POST route and store persistence
- Existing Playwright matrix/scenario contract

### Validation

- Focused page tests first
- Then a single Playwright repro of the original failure
- Expand to more matrix cases only after the first supported case passes

### Wiring Verification

| Component                 | Entry Point                               | Registration Location                                  | Schema/Table                                                                                             |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Conditional route inputs  | `LaneCreationWizard` step 2               | `frontend/src/app/(app)/lanes/new/page.tsx`            | N/A                                                                                                      |
| Route-step validation     | step 2 navigation disable/error rendering | same page component                                    | N/A                                                                                                      |
| Cold-chain payload fields | `handleCreateLane()` POST                 | same page component to existing `/api/zrl/lanes` proxy | backend `lanes.cold_chain_mode`, `lanes.cold_chain_device_id`, `lanes.cold_chain_data_frequency_seconds` |
| Review rows               | `StepReview` render                       | same page component                                    | N/A                                                                                                      |
| Browser flow helper       | Playwright spec import                    | `frontend/e2e/helpers/lane-wizard.ts`                  | N/A                                                                                                      |

### Decision-Complete Checklist

- No open decision remains about Manual/Logger/Telemetry semantics.
- Validation rules match the current backend validator exactly.
- The changed request payload fields already exist in the backend contract.
- Focused tests cover both render and payload behavior.

## Implementation Summary

Timestamp: 2026-04-04 13:32 +07

- Restored explicit cold-chain configuration in `frontend/src/app/(app)/lanes/new/page.tsx`.
  - Added `coldChainDeviceId` and `coldChainDataFrequencySeconds` state.
  - Added `getColdChainConfigError()` with frontend rules matching `ColdChainService.validateLaneConfiguration()`.
  - Step 2 now conditionally renders `Device ID` and `Data Frequency (seconds)` for `Logger` and `Telemetry`.
  - Step 2 blocks `Next: Review` when logger/telemetry config is invalid.
  - Lane create payload now sends `coldChainConfig.deviceId` and `coldChainConfig.dataFrequencySeconds` for non-manual modes only.
  - Step 3 review now renders stable `data-testid` values for existing summary rows plus `device-id` and `data-frequency-seconds`.
- Extended `frontend/src/app/(app)/lanes/new/page.test.tsx` coverage for:
  - conditional route-step inputs
  - mode-specific validation errors
  - review-step rendering of cold-chain config
  - payload submission shape for telemetry mode

## Validation

- `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
  - PASS (`21/21`)
- `cd frontend && npx tsc --noEmit`
  - PASS
- `cd frontend && npm run lint`
  - PASS
- Targeted Playwright repro:
  - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-japan-air'`
  - Original failure resolved: the run no longer times out waiting for `Device ID`, and the review step now shows device/frequency correctly.
  - Remaining issue: submit stays on `/lanes/new` because the live create-lane request returns backend `500 Internal server error`.
  - Reproduced directly with authenticated `curl` against `http://127.0.0.1:3400/api/zrl/lanes`, confirming the backend error is not a Playwright selector problem.

## Residual Risk

- Frontend/domain alignment for cold-chain lane creation is now restored.
- The live end-to-end lane creation flow still has a backend-side failure after submit for the mango/japan/logger case and needs separate server-side debugging.

## Backend Follow-Up

Timestamp: 2026-04-04 14:46 +07

### Root Cause

- The remaining `POST /api/zrl/lanes` failure was not caused by cold-chain payload parsing.
- Direct in-process repro of `LaneService.create()` against the real AppModule surfaced the actual exception:
  - `Error: Invalid metadata.`
  - thrown from `src/modules/rules-engine/rules-engine.utils.ts`
  - during rule-loader cache refresh while reading repository YAML files
- The stale file was `rules/eu/mango.yaml`, which was still in the old pre-metadata schema and lacked both `metadata` and `labPolicy`.
- Because the loader reloads every YAML on disk, that stale EU file broke rule resolution for otherwise valid lane creation requests such as `JAPAN + MANGO`.

### Fix

- Updated `rules/eu/mango.yaml` to the current shared rule-pack schema:
  - added `metadata.coverageState`
  - added `metadata.sourceQuality`
  - added `metadata.retrievedAt`
  - added `metadata.commodityCode`
  - added `metadata.nonPesticideChecks`
  - added `labPolicy` with `DOCUMENT_ONLY` enforcement, which is more truthful for the current EU pack because numeric substance thresholds are still deferred in the CSV
- Added a repository regression test in `src/modules/rules-engine/rule-loader.service.spec.ts` that explicitly loads `rules/eu/mango.yaml`.

### Validation

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - PASS (`10/10`)
- `npm run typecheck`
  - PASS
- `npx eslint 'src/modules/rules-engine/rule-loader.service.spec.ts'`
  - PASS
- `npm run build`
  - PASS
- Direct in-process lane create repro with `LOGGER` config against the real AppModule
  - PASS (`OK LN-2026-021 LOGGER logger-mango-jp-01 600`)
- Authenticated local `curl` via `http://127.0.0.1:3400/api/zrl/lanes`
  - PASS (`201 Created`)
- Targeted Playwright repro
  - `cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1:3400 npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-japan-air'`
  - PASS (`1 passed`)

### Outcome

- The original frontend route-step mismatch is fixed.
- The backend rule-loader crash caused by a stale EU rule file is fixed.
- The end-to-end `mango-japan-air` lane-create browser flow now passes locally.

## Korea Mango Completion

Timestamp: 2026-04-04 14:51 +07

### Goal

- Finish `KOREA/MANGO` as the first fully trusted pack in the current sequence by promoting only the claims that the official MFDS and QIA sources support today.

### What Changed

- `rules/korea/mango.yaml`
  - Updated source comments to remove stale “deferred CSV” language.
  - Re-verified the official-source description and changed `metadata.coverageState` from `PRIMARY_PARTIAL` to `FULL_EXHAUSTIVE`.
  - Updated `metadata.retrievedAt` to `2026-04-04`.
  - Enriched the structured `VHT` check with `overseasInspectionRequired`, `registrationRequired`, and the current allowed Thailand mango varieties string.
- `rules/korea/mango-substances.csv`
  - Updated extraction date to `2026-04-04`.
  - Added explicit comment that the current commodity-specific snapshot row count is `64`.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Tightened the repository Korea mango test to assert `FULL_EXHAUSTIVE`, `2026-04-04`, the richer VHT parameters, and exactly `64` rows.
- `test/rules-engine.e2e-spec.ts`
  - Updated the mocked Korea mango ruleset contract to `FULL_EXHAUSTIVE` and the richer VHT metadata.
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - Updated the admin metadata-card expectations to reflect `FULL_EXHAUSTIVE` and the richer structured VHT fields.

### Source Verification

- QIA direct crawl on `2026-04-04` confirms the Thailand mango import condition includes:
  - phytosanitary certificate
  - vapor-heat treatment at `47℃` or above for `20` minutes
  - Korean overseas production-site inspection / registration controls
- MFDS direct crawl on `2026-04-04` confirms:
  - mango is listed under the tropical fruit group
  - when no specific MRL exists, Korea applies `0.01 mg/kg`
- The repository Korea mango CSV currently contains `64` commodity-specific rows for food code `ap105050006`, so the pack is now modeled as exhaustive relative to the current official commodity-specific row set plus the official fallback rule.

### TDD Evidence

- No RED run was intentionally produced for this batch.
- Reason: this was a truth-label and provenance promotion on top of already-passing behavior; forcing a RED run would have only reflected changed assertions for newly verified metadata, not a pre-existing runtime defect.
- GREEN commands:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`
  - `npm run typecheck`
  - `cd frontend && npx tsc --noEmit`

### Wiring Verification Evidence

- `rules/korea/mango.yaml`
  - runtime entry point: `RuleLoaderService.getRuleDefinition()` -> `RulesEngineService.getRuleSnapshot()` -> lane/rules-admin flows
  - registration: repository auto-load via `substancesFile` and rule-directory scan
  - schema: serialized through `lane_rule_snapshots.rules.metadata`
- `rules/korea/mango-substances.csv`
  - runtime entry point: `loadRuleDefinitionFromFile()` -> `buildRuleDefinition()` -> `evaluateLane()`
  - registration: linked from `rules/korea/mango.yaml`
  - schema: `lane_rule_snapshots.rules.substances`
- Admin metadata rendering
  - runtime entry point: `loadRulesAdminData()` -> admin rules page metadata cards
  - registration: existing frontend route and loader wiring
  - schema: API ruleset payload only

### Outcome

- `KOREA/MANGO` is now the first pack I would treat as complete in the current sequence.
- The next unresolved pack is `JAPAN/MANGO`.

## Review (2026-04-04 17:27 ICT) - working-tree lane-wizard cold-chain scope

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: working tree, limited to `frontend/src/app/(app)/lanes/new/page.tsx` and `frontend/src/app/(app)/lanes/new/page.test.tsx`
- Commit SHA reviewed against: `2af28ff`
- Commands Run:
  - `git diff -- 'frontend/src/app/(app)/lanes/new/page.tsx' 'frontend/src/app/(app)/lanes/new/page.test.tsx'`
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npm run lint`

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

- Assumed the intended product contract is explicit operator entry for `deviceId` and `dataFrequencySeconds` in non-manual modes rather than hidden frontend defaults.
- Assumed `Manual` should continue omitting those fields entirely from the lane-create payload.

### Recommended Tests / Validation

- Re-run one live Playwright lane-create scenario after merge so the browser path confirms the restored route-step fields still match the helper expectations.

### Rollout Notes

- Frontend-only behavior change.
- No migration required.
- Main residual risk is later drift if the backend cold-chain contract changes without corresponding wizard updates.
