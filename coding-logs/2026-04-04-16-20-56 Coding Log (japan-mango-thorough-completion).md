# Japan Mango Thorough Completion

## Planning Context

- Date: 2026-04-04 ICT
- User request: research, plan, and implement `JAPAN/MANGO` thoroughly.
- Auggie semantic search used for rule metadata schema, loader parsing, snapshot contracts, and repository tests.
- Direct sources inspected before planning:
  - `rules/japan/mango.yaml`
  - `rules/japan/mango-substances.csv`
  - `src/modules/rules-engine/rules-engine.types.ts`
  - `src/modules/rules-engine/rules-engine.utils.ts`
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `docs/PROGRESS.md`
  - `coding-logs/2026-04-03-18-58-25 Coding Log (japan-mango-pesticide-enforcement).md`
- External sources inspected before planning:
  - MAFF Thailand mango quarantine standard page
  - MAFF Thailand cargo condition index
  - CAA residue standards page
  - MHLW legacy residue standards page
  - CAA food-classification PDF
  - MAFF export-MRL reference PDF that explicitly points to JFCRF as a third-party source

## Plan Draft A

### 1. Overview

Attempt to finish `JAPAN/MANGO` as a fully exhaustive pack in one batch by replacing the current 12-row curated CSV with a commodity-complete mango list and promoting the pack to an exhaustive coverage state. Also upgrade the non-pesticide metadata to reflect the exact MAFF Thailand mango quarantine standard.

### 2. Files to Change

- `rules/japan/mango.yaml` — promote metadata, add official-source comments, encode exact quarantine/VHT parameters.
- `rules/japan/mango-substances.csv` — replace curated subset with a full mango-specific residue table.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — assert exhaustive metadata and updated row count.
- `test/rules-engine.e2e-spec.ts` — assert the ruleset endpoint exposes the revised metadata.
- `docs/PROGRESS.md` — record completion of the Japan mango pack.

### 3. Implementation Steps

#### TDD sequence

1. Add or tighten tests for the intended exhaustive metadata and exact VHT details.
2. Run the focused rules-engine tests and confirm failure because the current pack is still curated.
3. Replace the YAML/CSV data with the smallest change that satisfies the new expectations.
4. Refactor only comments/notes if needed for clarity.
5. Run fast gates: focused tests, typecheck, lint.

#### Functions / behaviors touched

- `loadRuleDefinitionFromFile()` / `buildRuleDefinition()`
  - No logic changes expected, but these functions are the runtime entry point that must continue to parse the richer YAML metadata.
- Repository rule-pack data files
  - Move `JAPAN/MANGO` from curated to exhaustive by changing only explicit rule data, not service behavior.

#### Expected behavior and edge cases

- The pack should only be marked exhaustive if the row set is demonstrably commodity-complete.
- If any official source remains inaccessible or unverifiable, the implementation must fail closed and avoid overstating exhaustiveness.
- VHT metadata must encode cultivar-specific treatment nuance without nested objects because metadata parameters only accept scalar values.

### 4. Test Coverage

- `RuleLoaderService loads csv-backed substances from the repository rule files`
  - Verifies revised Japan mango metadata and row count.
- `RulesEngine e2e returns repository ruleset metadata`
  - Verifies HTTP payload exposes the revised metadata.

### 5. Decision Completeness

- Goal
  - Make `JAPAN/MANGO` fully exhaustive and primary-backed in this batch.
- Non-goals
  - No service-layer rule-evaluation logic changes.
  - No UI redesign beyond existing metadata surfaces.
- Success criteria
  - The pack is truthfully promotable to exhaustive status.
  - The pesticide row set is demonstrably complete for Japan mango.
  - The exact MAFF quarantine conditions are encoded in structured metadata.
- Public interfaces
  - Rule-pack YAML/CSV contents.
  - Existing `/rules/.../ruleset` payload fields only.
- Edge cases / failure modes
  - If the source row set is incomplete, do not promote the metadata.
  - If the treatment differs by cultivar, encode the alternate path explicitly.
  - Fail closed on unverifiable commodity coding.
- Rollout & monitoring
  - Additive repository data change only; no migration.
  - Watch focused rules-loader and rules-engine e2e coverage.
- Acceptance checks
  - Focused repository rule-loader test passes.
  - Rules-engine e2e passes.
  - Typecheck/lint remain green.

### 6. Dependencies

- Access to an official or otherwise defensible complete Japan mango MRL list.

### 7. Validation

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
- `npm run typecheck`
- `npm run lint`

### 8. Wiring Verification

| Component                           | Entry Point                                               | Registration Location                                       | Schema/Table                                                                   |
| ----------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `rules/japan/mango.yaml`            | `RuleLoaderService.loadFromDisk()` and lane/ruleset reads | auto-discovered from `rules/` by the existing loader        | `rule_sets.payload`, `rule_versions.payload`, `lane_rule_snapshots.rules` JSON |
| `rules/japan/mango-substances.csv`  | loaded through `substancesFile` resolution                | referenced by `rules/japan/mango.yaml`                      | `substances` table and `lane_rule_snapshots.rules.substances`                  |
| Repository rule-loader spec updates | Jest rule-loader test entry point                         | `src/modules/rules-engine/rule-loader.service.spec.ts`      | N/A                                                                            |
| Rules-engine e2e updates            | Nest HTTP ruleset endpoint                                | `test/rules-engine.e2e-spec.ts` through existing app wiring | N/A                                                                            |

## Plan Draft B

### 1. Overview

Treat this as a truthfulness-hardening pass for `JAPAN/MANGO`: keep the curated 12-row pesticide pack unless a commodity-complete source can be proven, but substantially improve the pack by replacing overstated metadata, grounding the non-pesticide side in the exact MAFF Thailand mango standard, and aligning comments/tests with what the current evidence actually supports.

### 2. Files to Change

- `rules/japan/mango.yaml` — add source headers, downgrade source-quality truthfully, refresh retrieval date, and encode the exact MAFF phytosanitary/VHT constraints plus operational GAP note.
- `rules/japan/mango-substances.csv` — rewrite source headers to explicitly state this is a curated 12-row subset built from JFCRF plus official classification and positive-list references.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — update assertions for truthful source-quality and richer non-pesticide parameters.
- `test/rules-engine.e2e-spec.ts` — assert the Japan mango ruleset metadata returned over HTTP remains truthful.
- `docs/PROGRESS.md` — record the Japan mango hardening outcome and remaining completeness gap if exhaustive promotion is still not supportable.

### 3. Implementation Steps

#### TDD sequence

1. Tighten the repository Japan mango rule-loader test and the rules-engine e2e assertions first.
2. Run those focused tests and confirm failure against the current `PRIMARY_ONLY` / sparse metadata pack.
3. Update the YAML and CSV with the smallest truthful changes to satisfy the new tests.
4. Refactor comments/notes only after the tests are green.
5. Run focused tests, typecheck, lint, and any small supporting checks.

#### Functions / behaviors touched

- `RuleLoaderService` repository file load path
  - Existing parser must continue loading the revised metadata without service-code changes.
- `RulesEngineService.getRuleSnapshot()`
  - Existing endpoint contract must surface the updated data exactly as stored.

#### Expected behavior and edge cases

- Coverage stays curated unless a complete row set is proven.
- `sourceQuality` must move to `PRIMARY_PLUS_SECONDARY` because the numeric MRL rows depend on JFCRF, which MAFF/CAA point to but do not own.
- `commodityCode` stays null unless a real official commodity code is found; classification can be captured in comments/source notes instead.
- VHT metadata must carry cultivar-specific treatment options and certificate statements using flat scalar keys.
- GAP should remain clearly labeled as a ZRL/exporter-compliance baseline, not a MAFF import condition.

### 4. Test Coverage

- `RuleLoaderService loads csv-backed substances from the repository rule files`
  - Verifies truthful source-quality, retrieval date, VHT details, and curated row count.
- `RulesEngine e2e returns Japan mango metadata`
  - Verifies the HTTP ruleset endpoint exposes the revised metadata.

### 5. Decision Completeness

- Goal
  - Make the current `JAPAN/MANGO` pack maximally accurate and defensible with the sources available today.
- Non-goals
  - No attempt to fabricate exhaustive coverage.
  - No runtime rule-evaluation behavior change.
  - No unrelated Japan combo edits.
- Success criteria
  - No over-claiming remains in Japan mango metadata/comments.
  - Exact MAFF Thailand mango quarantine/VHT rules are encoded in metadata.
  - Tests pin the truthful status so later edits cannot silently drift back to `PRIMARY_ONLY`.
- Public interfaces
  - Existing rule-pack YAML/CSV and `/rules/.../ruleset` payload only.
- Edge cases / failure modes
  - If official commodity code remains unavailable, leave null rather than inventing one.
  - If cultivar-specific VHT paths differ, encode both primary and alternate thresholds as scalar parameters.
  - Fail closed on exhaustiveness claims.
- Rollout & monitoring
  - Additive data-only repo change, no migration.
  - Watch focused repository and e2e tests.
- Acceptance checks
  - Japan mango rule-loader assertions pass with the richer metadata.
  - Rules-engine e2e passes with the new truthfulness contract.
  - Typecheck and lint remain green.

### 6. Dependencies

- MAFF Thailand mango import-condition page.
- CAA/MHLW residue standards pages.
- CAA food-classification PDF.
- MAFF export-MRL reference PDF confirming JFCRF’s role.

### 7. Validation

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
- `npm run typecheck`
- `npm run lint`

### 8. Wiring Verification

| Component                           | Entry Point                                               | Registration Location                                       | Schema/Table                                                                   |
| ----------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `rules/japan/mango.yaml`            | `RuleLoaderService.loadFromDisk()` and lane/ruleset reads | auto-discovered from `rules/` by the existing loader        | `rule_sets.payload`, `rule_versions.payload`, `lane_rule_snapshots.rules` JSON |
| `rules/japan/mango-substances.csv`  | loaded through `substancesFile` resolution                | referenced by `rules/japan/mango.yaml`                      | `substances` table and `lane_rule_snapshots.rules.substances`                  |
| Repository rule-loader spec updates | Jest rule-loader test entry point                         | `src/modules/rules-engine/rule-loader.service.spec.ts`      | N/A                                                                            |
| Rules-engine e2e updates            | Nest HTTP ruleset endpoint                                | `test/rules-engine.e2e-spec.ts` through existing app wiring | N/A                                                                            |

## Comparative Analysis

- Draft A strength
  - It aims directly at the sequence goal of a fully exhaustive Japan mango pack.
- Draft A gap
  - The currently accessible sources do not prove a complete commodity-specific mango row set, so promoting exhaustiveness now would likely reintroduce the same over-claiming problem we are trying to eliminate.
- Draft B strength
  - It is fully supportable with the evidence already gathered and materially improves pack quality.
- Draft B gap
  - It does not finish the long-term exhaustiveness objective.
- Key trade-off
  - Draft A optimizes for ambition; Draft B optimizes for defensible correctness.
- Compliance check
  - Draft B better matches the repo’s recent shift toward truthful metadata labels and fail-closed precision claims.

## Unified Execution Plan

### 1. Overview

Implement the truthful-hardening path for `JAPAN/MANGO` now, and only promote further if a commodity-complete source becomes provable during the same batch. The implementation will tighten the non-pesticide side with exact MAFF Thailand mango requirements, align `sourceQuality` and comments with the fact that the pesticide rows depend on JFCRF, and pin the result with focused tests and progress/coding-log evidence.

### 2. Files to Change

- `rules/japan/mango.yaml`
  - Add source-comment headers.
  - Refresh `retrievedAt`.
  - Change `sourceQuality` to `PRIMARY_PLUS_SECONDARY`.
  - Keep `coverageState` curated unless full row coverage is proven.
  - Encode the exact MAFF phytosanitary certificate and VHT treatment/cultivar parameters.
  - Clarify GAP as an operational baseline rather than a MAFF import condition.
- `rules/japan/mango-substances.csv`
  - Rewrite header comments to explicitly describe the 12-row curated-high-risk status, JFCRF reliance, CAA food classification grounding, and the positive-list fallback basis.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Tighten the Japan mango repository assertions.
- `test/rules-engine.e2e-spec.ts`
  - Add or tighten expectations on the ruleset metadata for Japan mango.
- `docs/PROGRESS.md`
  - Record the Japan mango hardening batch and note whether exhaustive completion is still pending.

### 3. Implementation Steps

#### TDD sequence

1. Update focused tests first:
   - repository rule-loader Japan mango assertions
   - rules-engine e2e Japan mango metadata assertions
2. Run the focused tests and confirm they fail because the current pack still says `PRIMARY_ONLY` and lacks the richer MAFF-backed parameters.
3. Update `rules/japan/mango.yaml` and `rules/japan/mango-substances.csv`.
4. Re-run focused tests until green.
5. Run `npm run typecheck` and `npm run lint`.
6. Append the implementation summary, TDD evidence, and source notes to this Coding Log.

#### Function/test outline

- `RuleLoaderService › loads csv-backed substances from the repository rule files`
  - Pin the truthful Japan mango metadata and curated row count.
- `RulesEngine e2e › returns the Japan mango ruleset snapshot`
  - Verify the API exposes the same metadata contract the admin UI and lane snapshots rely on.

#### Expected behavior and edge cases

- `JAPAN/MANGO` remains `CURATED_HIGH_RISK` unless a full row set is proven during implementation.
- `sourceQuality` becomes `PRIMARY_PLUS_SECONDARY`.
- `commodityCode` remains null unless an official code is found.
- VHT metadata includes the general `47C for 20 minutes` path plus the alternate `46.5C for 10 minutes` option for Nang Klang Wan, encoded as scalar fields.
- The phytosanitary certificate metadata explicitly records the certificate statements MAFF requires.

### 4. Test Coverage

- `RuleLoaderService loads csv-backed substances from the repository rule files`
  - Japan mango source-quality and MAFF VHT parameters.
- `RulesEngine e2e returns repository ruleset metadata`
  - Japan mango metadata survives the HTTP snapshot path.

### 5. Decision Completeness

- Goal
  - Deliver the most defensible current Japan mango pack the repository can support today.
- Non-goals
  - No fabricated exhaustive promotion.
  - No service logic change.
  - No work on other Japan packs in this batch.
- Success criteria
  - The pack no longer overstates its pesticide-source quality.
  - The MAFF Thailand mango quarantine standard is structurally represented.
  - Focused tests pin the new truthfulness contract.
- Public interfaces
  - Rule-pack files and existing ruleset endpoint payload only.
- Edge cases / failure modes
  - Fail closed on missing commodity code.
  - Fail closed on exhaustive claims.
  - Encode cultivar-specific VHT alternates using flat scalar parameters.
- Rollout & monitoring
  - Additive data-only change; no migration/backout concern beyond reverting the pack files.
  - Monitor focused repository tests and rules-engine e2e.
- Acceptance checks
  - Focused rule-loader and rules-engine e2e tests pass.
  - Backend typecheck and lint pass.
  - `docs/PROGRESS.md` and this Coding Log are updated.

### 6. Dependencies

- MAFF Thailand mango quarantine standard.
- CAA/MHLW positive-list and food-classification references.
- MAFF export-MRL source-reference PDF.

### 7. Validation

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
- `npm run typecheck`
- `npm run lint`

### 8. Wiring Verification

| Component                                              | Entry Point                                                                   | Registration Location                              | Schema/Table                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| `rules/japan/mango.yaml`                               | `RuleLoaderService.loadFromDisk()` and `RulesEngineService.getRuleSnapshot()` | repository auto-discovery in existing rules loader | `rule_sets.payload`, `rule_versions.payload`, `lane_rule_snapshots.rules` |
| `rules/japan/mango-substances.csv`                     | `loadRuleDefinitionFromFile()` via `substancesFile`                           | referenced by the YAML only                        | `substances` table and `lane_rule_snapshots.rules.substances`             |
| `src/modules/rules-engine/rule-loader.service.spec.ts` | Jest repo rule-load test run                                                  | existing backend test harness                      | N/A                                                                       |
| `test/rules-engine.e2e-spec.ts`                        | Nest HTTP `/rules/markets/:market/products/:product/ruleset`                  | existing app bootstrap in e2e harness              | N/A                                                                       |

## 2026-04-04 16:27 ICT

- Goal: make `JAPAN/MANGO` materially more correct and defensible without overstating it as exhaustive before a commodity-complete Japan mango row set is proven.
- What changed:
  - `rules/japan/mango.yaml`
    - Added source-comment headers with the MAFF Thailand mango quarantine standard, CAA/MHLW residue references, JFCRF support, and the MAFF export reference PDF.
    - Changed `metadata.sourceQuality` from `PRIMARY_ONLY` to `PRIMARY_PLUS_SECONDARY`.
    - Refreshed `metadata.retrievedAt` to `2026-04-04`.
    - Kept `coverageState: CURATED_HIGH_RISK` and `commodityCode: null`.
    - Replaced vague phytosanitary/VHT metadata with exact MAFF-backed scalar parameters:
      - phytosanitary certificate statements
      - approved Thai mango cultivars
      - default `47C for 20 minutes` treatment
      - alternate `46.5C for 10 minutes` path for Nang Klang Wan
      - registration / verification / packaging-seal controls
    - Clarified that `GAP_CERT` is a ZRL operational baseline, not a MAFF import condition.
  - `rules/japan/mango-substances.csv`
    - Rewrote the header comments to make the pack’s limits explicit:
      - current source check date
      - CAA/MHLW primary-source basis
      - JFCRF as the supporting third-party numeric source
      - 12-row curated-high-risk scope
      - `0.01 mg/kg` positive-list fallback basis
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Tightened the repository Japan mango assertions for truthful source quality, retrieval date, exact phytosanitary/VHT parameters, and the GAP baseline note.
  - `test/rules-engine.e2e-spec.ts`
    - Updated the ruleset contract mock + assertions so the HTTP snapshot path now pins the new Japan mango metadata.
  - `docs/PROGRESS.md`
    - Recorded the Japan mango hardening outcome and the remaining exhaustiveness gap.
- TDD evidence:
  - Tests added/changed:
    - `RuleLoaderService › loads csv-backed substances from the repository rule files`
    - `RulesEngineController (e2e) › GET /rules/markets/JAPAN/products/MANGO/ruleset returns the current rule snapshot`
  - RED:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - Failure reason: expected `PRIMARY_PLUS_SECONDARY` but the repository pack still reported `PRIMARY_ONLY`.
  - GREEN:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - Result: `10/10` tests passed after the YAML/CSV update.
  - Note:
    - The e2e contract test is mock-backed; it was updated in the same batch to pin the HTTP-facing metadata contract after the repository pack truthfulness change.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` — passed
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts` — passed
  - `npm run typecheck` — passed
  - `npm run lint` — passed
- Wiring verification evidence:
  - `rules/japan/mango.yaml` remains auto-discovered by `RuleLoaderService.loadFromDisk()` and feeds `RulesEngineService.getRuleSnapshot()`.
  - `rules/japan/mango-substances.csv` remains loaded only through `substancesFile` from the Japan mango YAML.
  - `test/rules-engine.e2e-spec.ts` still exercises the existing `/rules/markets/:market/products/:product/ruleset` controller path with no new runtime registrations.
- Behavior changes and risk notes:
  - `JAPAN/MANGO` now describes its pesticide evidence more honestly and its MAFF quarantine path far more precisely.
  - No runtime enforcement logic changed; only explicit rule-pack data and contract assertions changed.
  - The pack still fails closed on exhaustiveness: it remains curated until a defensible complete mango table is captured.
- Source notes:
  - MAFF’s Thailand mango standard provides the strongest current evidence for cultivar scope and VHT/phytosanitary treatment detail.
  - CAA/MHLW residue pages establish the positive-list framework and current official reference surface.
  - The MAFF export MRL reference PDF explicitly identifies JFCRF as a third-party Japan MRL search system, which is why `PRIMARY_ONLY` was no longer defensible for the current 12-row numeric set.
  - The CAA food-classification PDF lists Mango under “Assorted tropical and sub-tropical fruits”; no separate official commodity code was found in this batch, so `commodityCode` stays null.
- Follow-ups / known gaps:
  - `JAPAN/MANGO` is still not finished as an exhaustive pack because the repository still carries only the 12-row curated high-risk subset.
  - The next step to truly complete this combo is to capture a defensible commodity-complete Japan mango MRL row set and only then reconsider `coverageState`.

## Review (2026-04-04 16:27 ICT) - working-tree targeted japan-mango scope

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: working tree, targeted to the Japan mango pack and its focused tests/log entry
- Commit SHA reviewed against: `9afde7c968390eebc2d49c04e40f116ed869e1ab`
- Commands Run:
  - `git diff -- rules/japan/mango.yaml rules/japan/mango-substances.csv src/modules/rules-engine/rule-loader.service.spec.ts test/rules-engine.e2e-spec.ts docs/PROGRESS.md '.codex/coding-log.current' 'coding-logs/2026-04-04-16-20-56 Coding Log (japan-mango-thorough-completion).md'`
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`

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

- Assumed the correct outcome for this batch is a truthfulness hardening, not a forced promotion to exhaustive coverage.
- Assumed leaving `commodityCode` null is preferable to inventing a pseudo-code from classification text.

### Recommended Tests / Validation

- When a full Japan mango row set is added later, rerun the repository rule-loader spec with an exact row-count assertion and add one spot-check test for several newly added substances.
- If this batch is submitted, include a quick admin-rules-page smoke so the richer VHT parameter set is visible and acceptable in the metadata UI.

### Rollout Notes

- Data-only rules-pack change; no migration or runtime wiring change.
- Main residual risk is documentation drift if a later author promotes `coverageState` without first replacing the curated CSV with a defensible commodity-complete row set.

## 2026-04-04 16:49 ICT

- Goal: finish `JAPAN/MANGO` as an exhaustive commodity pack comparable to `KOREA/MANGO`, while still telling the truth about source quality and the two non-numeric source limits.
- What changed:
  - `rules/japan/mango-substances.csv`
    - Replaced the curated 12-row subset with the full `191`-row JFCRF Mango commodity table snapshot (`food_group_detail?id=11600`) retrieved on `2026-04-04`.
    - Added `destinationLimitType` to the CSV so the two special source rows can be represented explicitly:
      - `ETHYLENE DIBROMIDE (EDB)` as `NON_DETECT`
      - `GIBBERELLIN` as `PHYSIOLOGICAL_LEVEL`
    - Encoded both special rows with `destinationMrl: 0` in storage while preserving the real source meaning in the qualifier and note fields.
  - `rules/japan/mango.yaml`
    - Promoted `metadata.coverageState` from `CURATED_HIGH_RISK` to `FULL_EXHAUSTIVE`.
    - Updated the source comments to say the CSV now snapshots the full `191`-row commodity table.
    - Kept `sourceQuality: PRIMARY_PLUS_SECONDARY` because the numeric row set still comes from JFCRF, which MAFF/CAA reference but do not own.
  - `src/modules/rules-engine/rules-engine.types.ts`
    - Added optional `destinationLimitType` support on rule substances.
  - `src/modules/rules-engine/rule-definition.files.ts`
    - Added CSV parsing/validation for `destinationLimitType`.
  - `src/modules/rules-engine/rules-engine.utils.ts`
    - Defaulted missing qualifiers to `NUMERIC`.
    - Skipped stringency calculation for non-numeric limit types.
  - `src/modules/rules-engine/rules-engine.service.ts`
    - Added special handling for qualified limits:
      - `NON_DETECT` rows behave as zero-tolerance hard stops
      - `PHYSIOLOGICAL_LEVEL` rows are surfaced as `UNKNOWN` instead of inventing a numeric threshold
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Tightened Japan mango repository assertions to `FULL_EXHAUSTIVE`, `191` rows, and explicit checks for `ACETAMIPRID` plus `EDB`.
  - `src/modules/rules-engine/rules-engine.service.spec.ts`
    - Added explicit unit coverage for `NON_DETECT` and `PHYSIOLOGICAL_LEVEL` handling.
  - `test/rules-engine.e2e-spec.ts`
    - Updated the public ruleset contract mock/assertions for `FULL_EXHAUSTIVE`.
  - `src/modules/lane/lane.types.ts`
  - `frontend/src/lib/types.ts`
    - Extended shared contract types with the optional limit qualifier.
  - `docs/PROGRESS.md`
    - Recorded completion of the exhaustive Japan mango pack.
- TDD evidence:
  - Tests added/changed:
    - `RuleLoaderService › loads csv-backed substances from the repository rule files`
    - `RulesEngineService › evaluateLane treats a non-detect Japan mango row as a zero-tolerance hard stop`
    - `RulesEngineService › evaluateLane leaves physiological-level Japan mango rows as unknown rather than inventing a numeric threshold`
    - `RulesEngineController (e2e) › GET /rules/markets/JAPAN/products/MANGO/ruleset returns the current rule snapshot`
  - RED:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
    - Failure reason: expected `FULL_EXHAUSTIVE` but the repository pack still reported `CURATED_HIGH_RISK`.
  - GREEN:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
    - Result: `25/25` tests passed after the exhaustive CSV + qualifier support landed.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts` — passed
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts` — passed
  - `npm run typecheck` — passed
  - `npm run lint` — passed
  - `cd frontend && npx tsc --noEmit` — passed
  - `cd frontend && npm run lint` — passed
- Wiring verification evidence:
  - `rules/japan/mango.yaml` still enters runtime only through `RuleLoaderService.loadFromDisk()` and `RulesEngineService.getRuleSnapshot()`.
  - `rules/japan/mango-substances.csv` still flows solely through `substancesFile: ./mango-substances.csv`.
  - The qualifier field is preserved in the rule snapshot JSON contract and consumed in `RulesEngineService.buildLabValidation()`.
- Behavior changes and risk notes:
  - `JAPAN/MANGO` is now exhaustive on commodity row coverage (`191` rows), not just curated.
  - The pack still truthfully reports `PRIMARY_PLUS_SECONDARY`.
  - `ETHYLENE DIBROMIDE (EDB)` now fails closed on any detected residue.
  - `GIBBERELLIN` no longer gets a fabricated numeric threshold; it stays `UNKNOWN` when measured because the source only says “no more than physiological level contained naturally.”
- Source notes:
  - JFCRF glossary confirms:
    - `N.D.` = `Not Detected`
    - `※` = `no more than physiological level contained naturally`
  - That glossary meaning is what drove the new qualifier support instead of forcing both rows into ordinary numeric thresholds.
- Follow-ups / known gaps:
  - CAS numbers and local-language aliases are still not populated across the full `191`-row Japan mango pack.
  - The admin `substances` table still stores numeric threshold fields only, so its list view does not expose the new qualifier semantics even though lane/ruleset snapshots do.

## 2026-04-04 17:03 ICT

- Goal: tighten the exhaustive `JAPAN/MANGO` evidence so the new limit qualifiers are explicitly proven from repository load through runtime evaluation.
- What changed:
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Added exact qualifier assertions for three repository-loaded Japan mango rows:
      - `ACETAMIPRID` -> `NUMERIC`
      - `ETHYLENE DIBROMIDE (EDB)` -> `NON_DETECT`
      - `GIBBERELLIN` -> `PHYSIOLOGICAL_LEVEL`
  - `src/modules/rules-engine/rules-engine.service.spec.ts`
    - Updated the `EDB` unit test fixture to set `destinationLimitType: 'NON_DETECT'` explicitly so the test exercises the qualifier branch rather than only a raw zero limit.
- TDD evidence:
  - Tests added/changed:
    - `RuleLoaderService › loads the repository japan mango rule file`
    - `RulesEngineService › evaluateLane treats a non-detect Japan mango row as a zero-tolerance hard stop`
  - RED:
    - Not captured as a separate failing run for this follow-up because this was review-driven assertion hardening on an already-green implementation, not a product-code behavior change.
  - GREEN:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
    - Result: `25/25` tests passed.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts` — passed
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts` — passed
- Wiring verification evidence:
  - Repository CSV qualifier values still flow through `parseRuleSubstancesCsv()` -> `buildRuleDefinition()` -> `RulesEngineService.buildLabValidation()`.
- Follow-ups / known gaps:
  - The engine still treats `UNKNOWN` lab rows as non-blocking at the aggregate level (`valid: true` unless there is a `FAIL` or document block). That is pre-existing behavior, but it is more visible now that `JAPAN/MANGO` is exhaustive.

## Review (2026-04-04 17:03 ICT) - working-tree targeted japan-mango exhaustive scope

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: working tree, targeted to the exhaustive `JAPAN/MANGO` pack, qualifier runtime wiring, and focused tests
- Commit SHA reviewed against: `9afde7c`
- Commands Run:
  - `git diff -- rules/japan/mango.yaml rules/japan/mango-substances.csv src/modules/rules-engine/rules-engine.types.ts src/modules/rules-engine/rule-definition.files.ts src/modules/rules-engine/rules-engine.utils.ts src/modules/rules-engine/rules-engine.service.ts src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts test/rules-engine.e2e-spec.ts src/modules/lane/lane.types.ts frontend/src/lib/types.ts docs/PROGRESS.md 'coding-logs/2026-04-04-16-20-56 Coding Log (japan-mango-thorough-completion).md'`
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`

### Findings

CRITICAL

- No findings.

HIGH

- No findings.

MEDIUM

- No findings.

LOW

- `FULL_EXHAUSTIVE` now means exhaustive commodity row coverage, but the pack still lacks populated CAS values and aliases for most rows. That does not break the current loader/evaluator, but it weakens matching ergonomics for labs that report synonyms rather than the exact JFCRF label. The runtime currently falls back to exact substance-name matching plus CAS when present. Consider a later enrichment pass if real lab payloads drift from the JFCRF naming surface.

### Open Questions / Assumptions

- Assumed it is acceptable for `sourceQuality` to remain `PRIMARY_PLUS_SECONDARY` even though row coverage is exhaustive, because the exhaustive numeric surface still comes from JFCRF rather than a first-party MAFF/CAA export.
- Assumed the existing aggregate semantics for `UNKNOWN` lab rows remain intentional for this batch and should not be changed under the Japan-mango rule-authoring task alone.

### Recommended Tests / Validation

- Add one integration-level lane evaluation test that uses the real repository-loaded Japan mango definition plus a partial MRL result file, so the team can make an explicit product decision about whether exhaustive packs with many unmeasured rows should remain aggregate-`PASS` with `hasUnknowns: true`.
- When real partner lab payload samples are available, run a synonym/CAS matching smoke against the `191`-row dataset to quantify whether alias enrichment is needed.

### Rollout Notes

- No migration required.
- This remains a data-and-rules-engine contract change.
- The main residual product risk is interpretation of aggregate `PASS` when exhaustive packs still contain many `UNKNOWN` rows from partial test panels.
