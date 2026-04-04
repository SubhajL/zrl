# Korea Durian Exhaustive Completion

Planning timestamp: 2026-04-04 23:23:55 ICT

## Plan Draft A

### 1. Overview

Finish `KOREA/DURIAN` as the next truthful Korea pack by pairing Korea QIA’s simple Thai durian import path with MFDS’s direct durian residue page. The pack should be smaller and simpler than Korea mango: no special VHT/MB treatment, only phytosanitary handling plus the direct durian MFDS row set and Korea’s official `0.01 mg/kg` fallback when no specific durian MRL exists.

### 2. Files to Change

- `rules/korea/durian.yaml` — new Korea durian rule pack with shared metadata, direct QIA phytosanitary requirements, direct MFDS commodity code, and no VHT.
- `rules/korea/durian-substances.csv` — new Korea durian pesticide table from MFDS `foodView.do` for the durian code.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — add repository coverage for the Korea durian pack.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts` — add a support-filter assertion so `durian-korea-air` becomes an explicit live combo.
- `docs/PROGRESS.md` — record completion of the Korea durian pack.
- `coding-logs/2026-04-04-23-23-55 Coding Log (korea-durian-exhaustive-completion).md` — append implementation, TDD, and review evidence.

### 3. Implementation Steps

#### TDD sequence

1. Add the target Korea durian loader assertion and the harness-support assertion.
2. Run the focused backend/frontend tests and confirm they fail red because the Korea durian rule files do not exist yet.
3. Add `rules/korea/durian.yaml` and `rules/korea/durian-substances.csv` with the smallest truthful source-backed contents.
4. Re-run focused tests to green, then run typecheck/lint gates.
5. Update `docs/PROGRESS.md` and append implementation evidence.

#### Functions / behaviors

- `loadRuleDefinitionFromFile()` / `RuleLoaderService.getRuleDefinition()` — no logic changes planned; existing repository loading should pick up the new Korea durian files automatically.
- `hasLiveRuleSupport()` in `frontend/src/lib/testing/lane-creation-scenarios.ts` — no logic changes planned; `durian-korea-air` should move into `LIVE_LANE_CREATION_SCENARIOS` as soon as the YAML exists.
- Korea durian pack — should declare `FULL_EXHAUSTIVE`, `PRIMARY_ONLY`, `commodityCode: ap105051059`, direct phytosanitary handling, direct MFDS durian thresholds, and the official `0.01 mg/kg` fallback.

#### Expected behavior and edge cases

- No `VHT Certificate` or special-treatment metadata should be present, because the current QIA page lists Thai durian in the general importable-fruit table rather than in a special treatment row.
- The explicit MFDS durian row set is small (`3` rows), but the pack can still be exhaustive because Korea’s published default `0.01 mg/kg` rule covers unlisted pesticides.
- Numeric values that include a dagger marker in MFDS should be stored as numeric MRLs with the marker preserved in `note`, not faked as qualifiers.

### 4. Test Coverage

- `RuleLoaderService › loads the repository korea durian rule file`
  - Verifies metadata, no VHT requirement, direct commodity code, and explicit row shape.
- `lane creation scenario support filters › treats korea durian as supported live coverage`
  - Verifies the harness activates `durian-korea-air` from actual rule-file presence.

### 5. Decision Completeness

- Goal
  - Implement `KOREA/DURIAN` as the next exhaustive Korea pack.
- Non-goals
  - No rules-engine runtime changes.
  - No Playwright matrix updates beyond file-existence activation.
  - No Korea mangosteen or longan work in this slice.
- Success criteria
  - `rules/korea/durian.yaml` and `rules/korea/durian-substances.csv` exist and load cleanly.
  - The loader spec passes with direct Korea durian metadata and row expectations.
  - The harness-support test shows `durian-korea-air` as live-supported.
- Public interfaces
  - New Korea durian repository rule pack only.
  - No API, schema, env, or migration changes.
- Edge cases / failure modes
  - If MFDS exposes only three direct durian rows, keep the pack exhaustive and rely on the official `0.01 mg/kg` fallback for the rest.
  - If any future QIA source contradicts the general-table reading, bias toward fail-closed and adjust the YAML in a follow-up.
- Rollout & monitoring
  - Additive rollout on `KOREA/DURIAN` only.
  - Backout is reverting the Korea durian YAML/CSV/spec/docs slice.
  - Harness monitoring comes from the existing live/unsupported scenario split.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
  - `npm run typecheck`
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npm run lint`

### 6. Dependencies

- QIA fruit import conditions page (`plant_fruit_cond.jsp`)
- MFDS `autoComplete.do` food lookup for durian code
- MFDS `foodView.do` for durian thresholds
- MFDS `infoView.do` for pesticide CAS numbers

### 7. Validation

- Focused loader test green.
- Focused harness-support test green.
- Backend/frontend type and lint gates green.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `rules/korea/durian.yaml` | Rule repository filesystem scan | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| `rules/korea/durian-substances.csv` | YAML `substancesFile` parse path | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Korea durian loader spec | Jest service spec | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |
| Korea durian live-support activation | Scenario support filter | `frontend/src/lib/testing/lane-creation-scenarios.ts:hasLiveRuleSupport()` | N/A |

## Plan Draft B

### 1. Overview

Keep the implementation even narrower by only adding the Korea durian YAML/CSV and the loader spec, relying on existing implicit harness activation without any new frontend test. This minimizes the diff, but leaves the support transition less explicit.

### 2. Files to Change

- `rules/korea/durian.yaml`
- `rules/korea/durian-substances.csv`
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `docs/PROGRESS.md`

### 3. Implementation Steps

#### TDD sequence

1. Add the Korea durian loader test.
2. Run red against missing files.
3. Add the pack files.
4. Run focused backend gates only.

#### Functions / behaviors

- Same runtime behavior as Draft A.

#### Expected behavior and edge cases

- Harness activation would still happen automatically, but without an explicit test to catch future regressions.

### 4. Test Coverage

- `RuleLoaderService › loads the repository korea durian rule file`

### 5. Decision Completeness

- Goal
  - Ship Korea durian with the smallest possible file set.
- Non-goals
  - No harness-support test.
- Success criteria
  - Loader passes and the files exist.
- Public interfaces
  - Same as Draft A.
- Edge cases / failure modes
  - Support activation might regress later without direct harness coverage.
- Rollout & monitoring
  - Same as Draft A.
- Acceptance checks
  - Same as Draft A minus frontend support test.

### 6. Dependencies

- Same as Draft A.

### 7. Validation

- Same as Draft A, but narrower.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Korea durian YAML/CSV | Rules loader | `src/modules/rules-engine/rule-definition.files.ts` | N/A |

## Comparative Analysis & Synthesis

### Strengths

- Draft A is stronger because it makes the Korea durian support flip explicit in both backend and harness tests.
- Draft B is smaller, but that smallness is mostly artificial because the harness activation is a behavior change worth locking down.

### Gaps

- Draft B leaves the live-support transition untested.
- Draft A adds one extra frontend test, but that cost is low.

### Trade-offs

- Draft A optimizes for clearer coverage.
- Draft B optimizes for a slightly smaller diff.

### Repo Compliance

- Both drafts keep the existing data-driven architecture and avoid runtime logic changes.
- Draft A better matches the repo’s recent honesty-first harness work.

## Unified Execution Plan

### 1. Overview

Implement `KOREA/DURIAN` as the next exhaustive Korea pack by combining the direct QIA phytosanitary path for Thai durian with the direct MFDS durian residue page. The resulting pack should be small but complete: three explicit MFDS durian rows under commodity code `ap105051059`, no special treatment requirement, and the official Korea `0.01 mg/kg` fallback for all other pesticides.

### 2. Files to Change

- `rules/korea/durian.yaml` — new Korea durian rule pack with `FULL_EXHAUSTIVE`, `PRIMARY_ONLY`, `retrievedAt: 2026-04-04`, `commodityCode: ap105051059`, `PHYTO_CERT` plus `GAP_CERT` checks, and no `VHT`.
- `rules/korea/durian-substances.csv` — new 3-row MFDS durian snapshot with aliases, CAS numbers, direct Korea MRLs, and notes preserving MFDS dagger markers where present.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — add the Korea durian repository assertion.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts` — assert that `durian-korea-air` is now live-supported.
- `docs/PROGRESS.md` — record Korea durian completion.
- `coding-logs/2026-04-04-23-23-55 Coding Log (korea-durian-exhaustive-completion).md` — append implementation and review evidence.

### 3. Implementation Steps

#### TDD sequence

1. Add the backend loader spec and frontend harness-support test.
2. Run:
   - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
   - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
   and confirm they fail because the Korea durian files do not yet exist.
3. Create `rules/korea/durian.yaml` and `rules/korea/durian-substances.csv` with the direct official source-backed contents.
4. Re-run the same focused tests to green.
5. Run type/lint gates and update progress/logging.

#### Functions / behaviors

- `RuleLoaderService.getRuleDefinition('KOREA', 'DURIAN')` should begin returning a real repository pack.
- `LIVE_LANE_CREATION_SCENARIOS` should now include `durian-korea-air`.
- No rules-engine service logic changes are required because Korea durian uses the existing numeric-limit plus default-fallback model already exercised by Korea mango.

#### Expected behavior and edge cases

- Korea durian should require `Phytosanitary Certificate` and `MRL Test Results`, but not `VHT Certificate`.
- The explicit row set should contain:
  - `Carbaryl : NAC` = `30`
  - `Chlorpyrifos` = `0.4`
  - `Clothianidin` = `0.9`
- All unlisted pesticides remain governed by `defaultDestinationMrlMgKg: 0.01`.

### 4. Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads the repository korea durian rule file` — metadata, no VHT, direct row count, direct row content.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - `treats korea durian as supported live coverage` — live support derives from the new YAML.

### 5. Decision Completeness

- Goal
  - Finish the next supported Korea fruit pack after mango.
- Non-goals
  - No Korea mangosteen or longan changes in this slice.
  - No runtime rules-engine modifications.
- Success criteria
  - Korea durian files load successfully.
  - Focused backend and frontend support tests pass.
  - Progress and coding log are updated.
- Public interfaces
  - New repository rule pack only.
  - No schema/API/env/CLI changes.
- Edge cases / failure modes
  - Small row count is still exhaustive because the direct MFDS durian page plus the official fallback rule define the whole enforcement surface.
  - If future MFDS data changes, the CSV row count will need refresh in a dedicated update.
- Rollout & monitoring
  - One-pack PR only.
  - Backout is reverting the durian slice.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
  - `npm run typecheck`

## Implementation Summary

Timestamp: 2026-04-04 23:35 ICT

### Goal

Implement `KOREA/DURIAN` as the next source-backed Korea rule pack with an exhaustive Korea-specific residue snapshot and truthful non-pesticide checks.

### What Changed

- `rules/korea/durian.yaml`
  - Added the Korea durian pack with `FULL_EXHAUSTIVE`, `PRIMARY_ONLY`, `retrievedAt: 2026-04-04`, `commodityCode: ap105051059`, `PHYTO_CERT` and `GAP_CERT` metadata, and no `VHT` requirement.
- `rules/korea/durian-substances.csv`
  - Added the direct MFDS durian residue snapshot with the full current explicit row set (`3` rows) plus notes preserving the MFDS dagger markers.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Added repository coverage for the Korea durian pack, including metadata, fallback policy, document requirements, and exact row assertions.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - Added a harness-support regression test so `durian-korea-air` must be treated as supported once the YAML exists.
- `docs/PROGRESS.md`
  - Recorded Korea durian completion and the next target (`KOREA/MANGOSTEEN`).

### TDD Evidence

- Added/changed tests
  - `RuleLoaderService › loads the repository korea durian rule file`
  - `lane creation scenario support filters › treats korea durian as supported live coverage`
- RED
  - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - Failure reason: `ENOENT: no such file or directory, open '/Users/subhajlimanond/dev/zrl/rules/korea/durian.yaml'`
  - Command: `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
  - Failure reason: `durian-korea-air` was still classified as unsupported because no Korea durian YAML existed.
- GREEN
  - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - Result: passed (`11` tests, `1` suite)
  - Command: `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
  - Result: passed (`2` tests, `1` suite)

### Tests Run

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
- `npm run typecheck`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`
- `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts frontend/src/lib/testing/lane-creation-scenarios.test.ts`
- `git diff --check -- docs/PROGRESS.md frontend/src/lib/testing/lane-creation-scenarios.test.ts rules/korea/durian.yaml rules/korea/durian-substances.csv src/modules/rules-engine/rule-loader.service.spec.ts`

### Wiring Verification Evidence

- Rule file load path
  - `src/modules/rules-engine/rule-definition.files.ts:185` exports `loadRuleDefinitionFromFile()`.
  - `src/modules/rules-engine/rule-definition.files.ts:201` wires CSV parsing through `parseRuleSubstancesCsv()`.
- CSV parse path
  - `src/modules/rules-engine/rule-definition.files.ts:101` defines `parseRuleSubstancesCsv()`.
- Harness support activation
  - `frontend/src/lib/testing/lane-creation-scenarios.ts:38` defines `hasLiveRuleSupport()`.
  - `frontend/src/lib/testing/lane-creation-scenarios.ts:282` builds `LIVE_LANE_CREATION_SCENARIOS` from that filter.
  - `frontend/src/lib/testing/lane-creation-scenarios.ts:286` builds `UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS` from the inverse.

### Behavior Changes And Risk Notes

- `KOREA/DURIAN` is now an active supported combo wherever support is derived from repository rule-file presence.
- The pack is intentionally exhaustive despite only `3` explicit rows because MFDS publishes the commodity-specific row set directly and Korea's official default fallback remains `0.01 mg/kg` for unlisted pesticides.
- The non-pesticide side fails closed against special-treatment assumptions: the pack does not claim `VHT` or `MB` because the current QIA page surfaces Thai durian only in the general phytosanitary table.

### Follow-Ups / Known Gaps

- `KOREA/MANGOSTEEN` is the next Korea pack and likely has a more complex special-treatment path than durian.
- `rules/AGENTS.md` remains dirty in the wider working tree from prior local guide drift; keep the Korea durian PR isolated to the substantive rule/test/docs files unless the guide update is intentionally batched.

## Review (2026-04-04 23:42 +07) - working-tree Korea durian slice

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status --short`; `git diff -- docs/PROGRESS.md frontend/src/lib/testing/lane-creation-scenarios.test.ts rules/korea/durian.yaml rules/korea/durian-substances.csv src/modules/rules-engine/rule-loader.service.spec.ts`; `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`; `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`; `npm run typecheck`; `cd frontend && npx tsc --noEmit`; `cd frontend && npm run lint`; `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts frontend/src/lib/testing/lane-creation-scenarios.test.ts`

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

- Assumes the current MFDS durian commodity page (`ap105051059`) plus the published Korea `0.01 mg/kg` fallback defines the full Korea enforcement surface for durian.
- Assumes the QIA general-table treatment for Thai durian remains correct and no hidden special-treatment bulletin overrides it.

### Recommended Tests / Validation

- Keep the focused loader spec and harness-support test in the PR gate.
- After merge, a broader lane-creation matrix run can exercise `durian-korea-air` through the browser flow, but this is a residual confidence check rather than a blocker for the rules-pack PR.

### Rollout Notes

- Fail-closed posture is preserved: the pack does not claim any special treatment such as `VHT` or `MB` without a primary-source QIA basis.
- Isolate the PR to the Korea durian rule/test/docs files only; do not include unrelated local `AGENTS.md` drift or untracked local artifacts.
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npm run lint`

### 6. Dependencies

- QIA import conditions page: `https://www.qia.go.kr/plant/imQua/plant_fruit_cond.jsp`
- MFDS list page: `https://www.foodsafetykorea.go.kr/residue/prd/mrls/list.do`
- MFDS food autocomplete JSON: `https://www.foodsafetykorea.go.kr/residue/ajax/mrls/autoComplete.do?searchValue=%EB%91%90%EB%A6%AC%EC%95%88&searchFlag=food`
- MFDS durian food view JSON: `https://www.foodsafetykorea.go.kr/residue/ajax/mrls/foodView.do?code=ap105051059`
- MFDS pesticide info JSON:
  - `.../infoView.do?pesticideCode=P00111`
  - `.../infoView.do?pesticideCode=P00131`
  - `.../infoView.do?pesticideCode=P00332`

### 7. Validation

- QIA and MFDS sources both align with the pack.
- Focused backend/frontend tests plus type/lint checks are green.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `rules/korea/durian.yaml` | Rules loader cache reload | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| `rules/korea/durian-substances.csv` | YAML `substancesFile` parse path | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Korea durian loader spec | Jest service spec | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |
| Korea durian harness support test | Scenario support filter | `frontend/src/lib/testing/lane-creation-scenarios.ts:hasLiveRuleSupport()` | N/A |

### 9. Cross-Language Schema Verification

- No schema or migration work is involved.

### 10. Decision-Complete Checklist

- No open design decisions remain.
- Public behavior changes are listed explicitly.
- Every behavior change has at least one test.
- Validation commands are scoped and concrete.
- Wiring verification covers repository load and harness activation.
