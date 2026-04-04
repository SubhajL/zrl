# Japan Longan Source Truth Correction

Planning timestamp: 2026-04-04 22:47:25 ICT

## Plan Draft A

### 1. Overview

Correct `JAPAN/LONGAN` to match the primary-source reality for Thailand-origin exports. The current repo pack is proxy-based and likely false, so the safest implementation is to fail closed: remove the Japan longan ruleset, tighten the repository test to expect no pack, and let the live harness automatically move `longan-japan-air` into the unsupported matrix.

### 2. Files to Change

- `rules/japan/longan.yaml` — delete the incorrect Thailand-to-Japan longan ruleset.
- `rules/japan/longan-substances.csv` — delete the proxy/study pesticide CSV that currently overclaims support.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — replace the positive loader assertion with a fail-closed absence assertion for `JAPAN/LONGAN`.
- `docs/PROGRESS.md` — record that Japan longan was corrected to unsupported, not completed as an exhaustive pack.
- `coding-logs/2026-04-04-22-47-25 Coding Log (japan-longan-source-truth-correction).md` — append implementation, TDD, and review evidence.

### 3. Implementation Steps

#### TDD sequence

1. Rewrite the loader spec from "loads the repository japan longan rule file" to "does not load a repository japan longan rule file".
2. Run the focused loader spec and confirm it fails red because the repo still contains `rules/japan/longan.yaml`.
3. Delete the YAML and CSV so the loader returns `null` and the harness drops live support automatically.
4. Refactor minimally only if any docs or source comments still imply Japan longan support.
5. Run focused gates and then append implementation evidence to the Coding Log.

#### Functions / behaviors

- `RuleLoaderService.getRuleDefinition('JAPAN', 'LONGAN')` — should now return `null` because no repository file exists.
- `hasLiveRuleSupport()` in `frontend/src/lib/testing/lane-creation-scenarios.ts` — no code change planned; it already derives support from file existence and should automatically reclassify `longan-japan-air` as unsupported.
- Unsupported live lane matrix path — no code change planned; the existing `UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS` filter should pick up Japan longan after file deletion.

#### Expected behavior and edge cases

- `JAPAN/LONGAN` must fail closed because the current Thailand-origin support claim is not backed by a primary MAFF import standard.
- Other longan markets remain unchanged.
- The harness should continue covering longan, but only in the unsupported path for Japan.

### 4. Test Coverage

- `RuleLoaderService › does not load a repository japan longan rule file`
  - Verifies the repository no longer exposes a Japan longan pack.

### 5. Decision Completeness

- Goal
  - Remove false positive support for `JAPAN/LONGAN`.
- Non-goals
  - No runtime rules-engine logic change.
  - No frontend UI changes.
  - No attempt to create a Vietnam-origin longan market because the product model here is Thailand export lanes.
- Success criteria
  - `rules/japan/longan.yaml` and `rules/japan/longan-substances.csv` no longer exist.
  - Loader spec passes expecting no repository pack for Japan longan.
  - Harness support now derives `longan-japan-air` as unsupported without helper edits.
- Public interfaces
  - Rule repository contents only.
  - No API, schema, env, or migration changes.
- Edge cases / failure modes
  - Fail closed if future research is inconclusive: unsupported is safer than a fabricated ruleset.
  - If other code assumes every fruit has every market, tests should surface that.
- Rollout & monitoring
  - No feature flag.
  - Backout is restoring the deleted Japan longan files if a primary Thailand longan MAFF standard is found later.
  - Watch the lane-creation matrix for the unsupported Japan longan scenario.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npm run typecheck`

### 6. Dependencies

- MAFF conditional-release index showing `Thailand mango`, `Thailand mangosteen`, and `Vietnam longan`, but no `Thailand longan`.
- MAFF Thailand traveler/import pages showing Thai longan as prohibited while only Thai mango and mangosteen have explicit exception paths.

### 7. Validation

- Focused rules-loader spec green.
- Backend typecheck green.
- Manual sanity check that `longan-japan-air` is no longer in `LIVE_LANE_CREATION_SCENARIOS`.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Deleted `rules/japan/longan.yaml` | Rule repository filesystem scan | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| Deleted `rules/japan/longan-substances.csv` | YAML `substancesFile` load path | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Loader absence assertion | Jest service spec | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |
| Live support harness fallback | `LANE_CREATION_SCENARIOS` filtering | `frontend/src/lib/testing/lane-creation-scenarios.ts:hasLiveRuleSupport()` | N/A |

## Plan Draft B

### 1. Overview

Keep a minimal Japan longan pack but convert it into a document-only prohibition marker so the repo still carries an explicit "unsupported" artifact. This would preserve a Japan longan file while changing its metadata to indicate unsupported status and no executable pesticide surface.

### 2. Files to Change

- `rules/japan/longan.yaml`
- `rules/japan/longan-substances.csv`
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `frontend/src/lib/testing/lane-creation-scenarios.ts`
- `docs/PROGRESS.md`

### 3. Implementation Steps

#### TDD sequence

1. Change the loader test to assert an unsupported metadata state instead of an active pack.
2. Run red against the current proxy pack.
3. Rewrite the YAML to an unsupported/document-only marker and clear the CSV.
4. Update the harness to treat the marker as unsupported rather than live.
5. Run focused gates.

#### Functions / behaviors

- `hasLiveRuleSupport()` would need logic beyond file existence.
- Loader behavior would still return a rule definition, but it would be a no-op / marker pack.

#### Expected behavior and edge cases

- Reviewers get an explicit "Japan longan unsupported" file.
- The harness logic becomes more complex because file existence no longer implies support.

### 4. Test Coverage

- `RuleLoaderService › loads the repository japan longan unsupported marker`
- `lane-creation-scenarios` support filter unit or matrix coverage for unsupported marker packs

### 5. Decision Completeness

- Goal
  - Make Japan longan visibly unsupported without deleting the artifact.
- Non-goals
  - No attempt to synthesize a real exhaustive Thailand longan pack.
- Success criteria
  - Unsupported metadata is explicit and the harness does not treat it as live.
- Public interfaces
  - Rules repository metadata plus harness support semantics.
- Edge cases / failure modes
  - Risk of future contributors mistaking marker packs for real support.
- Rollout & monitoring
  - Requires changing the harness support contract.
- Acceptance checks
  - Same as Draft A plus harness tests.

### 6. Dependencies

- Same source basis as Draft A.

### 7. Validation

- Same as Draft A plus harness-specific assertions.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Japan longan unsupported marker | Rule repository load | `src/modules/rules-engine/rule-definition.files.ts` | N/A |
| Harness support override | Scenario filtering | `frontend/src/lib/testing/lane-creation-scenarios.ts` | N/A |

## Comparative Analysis & Synthesis

### Strengths

- Draft A is simpler and safer because it preserves the existing harness contract that live support equals file existence.
- Draft B keeps a visible repository artifact for unsupported status, which can be helpful for documentation.

### Gaps

- Draft A relies on docs/logging to explain why the pack disappeared.
- Draft B adds unnecessary semantics to the harness and risks future confusion.

### Trade-offs

- Draft A optimizes for truthfulness and minimal moving parts.
- Draft B optimizes for explicit unsupported markers at the cost of new repository and harness complexity.

### Repo Compliance

- Draft A better follows the existing data-driven pattern where only actually supported combos have rule files.
- Draft B would introduce a new unsupported-marker convention that does not exist elsewhere in the repo.

## Unified Execution Plan

### 1. Overview

Implement a fail-closed source-truth correction for `JAPAN/LONGAN`. Primary MAFF sources support `Thailand mango`, `Thailand mangosteen`, and `Vietnam longan`, but I could not verify a Thailand-origin Japan longan import standard; therefore the current proxy-based Japan longan pack should be removed rather than "completed" into a false exhaustive ruleset.

### 2. Files to Change

- `rules/japan/longan.yaml` — delete the unsupported pack.
- `rules/japan/longan-substances.csv` — delete the proxy pesticide list.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — replace the positive longan pack assertion with an absence assertion.
- `docs/PROGRESS.md` — record the correction from false support to unsupported.
- `coding-logs/2026-04-04-22-47-25 Coding Log (japan-longan-source-truth-correction).md` — append TDD, validation, and review evidence.

### 3. Implementation Steps

#### TDD sequence

1. Update `RuleLoaderService › loads the repository japan longan rule file` into `RuleLoaderService › does not load a repository japan longan rule file`.
2. Run the focused spec and capture the RED failure while the old longan files still exist.
3. Delete `rules/japan/longan.yaml` and `rules/japan/longan-substances.csv`.
4. Re-run the focused loader spec to GREEN and sanity-check the harness classification logic without changing harness code.
5. Update `docs/PROGRESS.md` and append the implementation summary.

#### Functions / behaviors

- `RuleLoaderService.getRuleDefinition('JAPAN', 'LONGAN')` should return `null`.
- `hasLiveRuleSupport()` should automatically move `longan-japan-air` from `LIVE_LANE_CREATION_SCENARIOS` to `UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS`.
- No runtime evaluator/controller/service changes are planned.

#### Expected behavior and edge cases

- Japan longan should be unsupported for Thailand-origin lanes until a primary-source MAFF standard proves otherwise.
- Other longan markets remain live or unsupported exactly as their own rule files determine.
- The correction should fail closed and remove the false sense of exhaustive pesticide coverage.

### 4. Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `does not load a repository japan longan rule file` — loader returns `null` for the removed pack.

### 5. Decision Completeness

- Goal
  - Correct the repo so it no longer claims support for Thailand-origin Japan longan.
- Non-goals
  - No new runtime unsupported-marker convention.
  - No attempt to model Vietnam-origin longan in the current Thailand-export product.
- Success criteria
  - Longan Japan rule files are deleted.
  - The focused loader spec passes expecting `null`.
  - Harness live support no longer includes `longan-japan-air`.
- Public interfaces
  - Rules repository content only.
  - No API, schema, env, CLI, or migration changes.
- Edge cases / failure modes
  - Fail closed if a future source pass remains inconclusive.
  - If a primary Thailand longan rule appears later, restore support in a dedicated PR with full source evidence.
- Rollout & monitoring
  - No feature flag.
  - Backout is restoring the deleted files.
  - Manual smoke: inspect scenario classification to ensure the unsupported path picks up Japan longan.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npm run typecheck`

### 6. Dependencies

- MAFF conditional-release index (`saisoku_index.html`) showing `タイ産マンゴウ`, `タイ産マンゴスチン`, and `ベトナム産りゅうがん`, but no `タイ産りゅうがん`.
- MAFF Thailand import/traveler pages showing `リュウガン` cannot be brought in from Thailand while mango and mangosteen have explicit exception language.

### 7. Validation

- Focused loader spec green.
- Backend typecheck green.
- Manual local check that `LIVE_LANE_CREATION_SCENARIOS` excludes `longan-japan-air`.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Deleted Japan longan rule file | Repository filesystem scan | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| Deleted Japan longan CSV | YAML `substancesFile` load | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Longan absence spec | Jest loader spec | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |
| Harness unsupported classification | Scenario support filter | `frontend/src/lib/testing/lane-creation-scenarios.ts:hasLiveRuleSupport()` | N/A |

### 9. Cross-Language Schema Verification

- No schema or migration work is involved in this correction.

### 10. Decision-Complete Checklist

- No open decisions remain for the implementer.
- No new public interfaces are introduced.
- The behavior change has direct test coverage in the loader spec.
- Validation commands are specific and scoped.
- Wiring verification covers the deleted repository files and the harness support path.
- No rollout or backout complexity beyond file restore exists.

## Implementation Summary

Timestamp: 2026-04-04 23:03:00 ICT

- Goal of the change
  - Correct the repo so it stops claiming Thailand-origin `JAPAN/LONGAN` support without a primary-source MAFF standard.
- What changed and why
  - `rules/japan/longan.yaml`
    - Deleted the proxy-backed Japan longan rule pack because the current source picture supports `Thailand mango`, `Thailand mangosteen`, and `Vietnam longan`, but not `Thailand longan`.
  - `rules/japan/longan-substances.csv`
    - Deleted the 10-row proxy/study pesticide CSV because an "exhaustive" Thailand-to-Japan longan list would have been fabricated.
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Replaced the old positive repository assertion with `does not load a repository japan longan rule file`.
  - `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
    - Added a focused harness test asserting `longan-japan-air` is excluded from `LIVE_LANE_CREATION_SCENARIOS` and included in `UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS`.
  - `docs/PROGRESS.md`
    - Recorded the fail-closed correction and the source basis.
  - `rules/AGENTS.md`
    - Updated the current-file snapshot so the local rules guide no longer advertises deleted Japan longan files.
- TDD evidence
  - RED
    - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - Failure reason: `RuleLoaderService › does not load a repository japan longan rule file` received the existing proxy `JAPAN/LONGAN` definition instead of `null`.
    - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
    - Failure reason: `longan-japan-air` was still present in `LIVE_LANE_CREATION_SCENARIOS`.
  - GREEN
    - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` ✅
    - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts` ✅
- Tests run
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` ✅
  - `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts` ✅
  - `npm run typecheck` ✅
  - `cd frontend && npx tsc --noEmit` ✅
  - `cd frontend && npm run lint` ✅
  - `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts` ✅
- Wiring verification evidence
  - `RuleLoaderService.getRuleDefinition('JAPAN', 'LONGAN')` now resolves `null` because `findRuleYamlFiles()` no longer finds `rules/japan/longan.yaml`.
  - `frontend/src/lib/testing/lane-creation-scenarios.ts:hasLiveRuleSupport()` is unchanged and still derives support from `rules/<market>/<product>.yaml` existence, so deleting the file moves `longan-japan-air` into the unsupported filter automatically.
- Source basis
  - MAFF conditional-release index: `https://www.maff.go.jp/pps/j/law/houki/saisoku_index.html`
    - shows `タイ産マンゴウ`, `タイ産マンゴスチン`, and `ベトナム産りゅうがん`, but no `タイ産りゅうがん`
  - MAFF Thailand traveler/import guidance: `https://www.maff.go.jp/pps/j/trip/memo/thai.html`
    - lists Thai `ランブータン、レイシなど` alongside mango/mangosteen as prohibited fresh fruit imports, with exception language only for mango and mangosteen
  - MAFF Thailand quick-search page: `https://www.maff.go.jp/pps/j/search/ikuni/th.html`
    - explicitly lists `リュウガン 持ち込めません`
- Behavior changes and risk notes
  - `JAPAN/LONGAN` now fails closed and is treated as unsupported for Thailand-origin lanes.
  - The lane-creation harness still covers Japan longan, but only in the unsupported matrix path.
  - Follow-up: if a primary MAFF Thailand-longan import standard is found later, restore support in a dedicated PR with the full source-backed pesticide/quarantine pack.

## Review (2026-04-04 23:00:44 ICT) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree (staged Japan longan correction)
- Commands Run: `git diff --cached --name-only`; `git diff --cached`; `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`; `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`; `npm run typecheck`; `cd frontend && npx tsc --noEmit`; `cd frontend && npm run lint`; `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts`

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
- Assumes the product scope remains Thailand-origin export lanes only; this change intentionally does not model Vietnam-origin longan.
- Assumes rule-file absence is the correct support contract for the live lane-creation harness.

### Recommended Tests / Validation
- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `cd frontend && npm test -- --runInBand --runTestsByPath src/lib/testing/lane-creation-scenarios.test.ts`
- `npm run typecheck`
- `cd frontend && npx tsc --noEmit`
- `cd frontend && npm run lint`

### Rollout Notes
- This is a fail-closed correction: Japan longan becomes unsupported immediately once the deleted rule files land.
- Backout is restoring `rules/japan/longan.yaml` and `rules/japan/longan-substances.csv` only if a primary Thailand-longan MAFF standard is found later.
