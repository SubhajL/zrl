# Coding Log

## Plan Draft A

### Overview

Promote `EU/MANGO` from a truthful partial placeholder to a truthful exhaustive pack backed by the European Commission's live EU Pesticides Database API and current plant-health/TRACES pages. Keep the runtime fail-closed by extending the rule schema for official mango rows that have no numeric MRL so the harness and lane evaluation do not invent thresholds.

### Files to Change

- `rules/eu/mango.yaml` - promote metadata, commodity code, source notes, and lab policy to the official exhaustive state.
- `rules/eu/mango-substances.csv` - replace the empty placeholder with the full current Commission mango row snapshot.
- `src/modules/rules-engine/rules-engine.types.ts` - add a truthful destination-limit variant for official no-numeric-MRL rows.
- `src/modules/rules-engine/rule-definition.files.ts` - accept the new CSV `destinationLimitType` value.
- `src/modules/rules-engine/rules-engine.utils.ts` - normalize the new limit type and keep stringency/risk null when no numeric threshold exists.
- `src/modules/rules-engine/rules-engine.service.ts` - evaluate the new limit type as `UNKNOWN` rather than pass/fail.
- `src/modules/rules-engine/rule-loader.service.spec.ts` - assert exhaustive EU mango metadata and full CSV loading.
- `src/modules/rules-engine/rules-engine.service.spec.ts` - cover the no-numeric EU limit behavior.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts` - assert `mango-eu-air` remains live-supported.
- `docs/PROGRESS.md` - log the completed EU mango upgrade.

### Implementation Steps

TDD sequence:

1. Add/update loader, runtime, and harness tests for exhaustive EU mango and the new no-numeric limit type.
2. Run the focused tests and confirm they fail for the expected reasons.
3. Implement the smallest schema/runtime changes plus the EU mango data conversion to make them pass.
4. Refactor only if needed to keep limit-type handling readable.
5. Run focused fast gates, then broader lint/typecheck/Playwright checks.

Functions and behaviors:

- `parseDestinationLimitType()` in `rule-definition.files.ts`
  Accept the new CSV enum value for official EU rows with no published numeric MRL.
- `buildRuleDefinition()` path in `rules-engine.utils.ts`
  Preserve null stringency/risk for non-numeric rows and keep the rest of the snapshot unchanged.
- `RulesEngineService.buildLabValidation()`
  Treat the new limit type as explicit-but-non-numeric so matched lab rows become `UNKNOWN`, not `PASS` or `FAIL`.

Expected behavior and edge cases:

- Numeric EU mango rows evaluate normally.
- Commission rows with `displayMrl: null` stay explicit in the pack and produce `UNKNOWN`.
- Duplicate API display names with identical effective limits are merged into one operational row with combined notes.
- Duplicate API display names with conflicting effective limits would fail closed and block the authoring pass.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads the repository eu mango rule file` - exhaustive metadata and row count are loaded.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `evaluateLane leaves explicit no-numeric EU mango rows as unknown` - no invented numeric threshold.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - `treats eu mango as supported live coverage` - live harness still exposes the EU path.
- `frontend/e2e/lane-creation-matrix.spec.ts`
  - `creates lane for mango-eu-air` - live browser harness stays green.

### Decision Completeness

- Goal
  Make `EU/MANGO` a truthful exhaustive pack from current official EU sources and keep live quality-check harness coverage green.
- Non-goals
  Add new EU fruit packs, generalize a reusable Commission importer, or create non-official proxy thresholds.
- Success criteria
  `EU/MANGO` loads as `FULL_EXHAUSTIVE`, contains the current official mango commodity snapshot, supports current live lane creation, and preserves official no-numeric rows without inventing pass/fail thresholds.
- Public interfaces
  No API or DB schema changes. Internal rule CSV/YAML schema gains one additional `destinationLimitType` variant.
- Edge cases / failure modes
  - API duplicate rows: merge only when effective limit semantics match; otherwise fail closed.
  - Null MRL rows: model explicitly as non-numeric unknowns.
  - Unlisted measured substances: apply the official EU `0.01 mg/kg` fallback when no specific MRL exists.
- Rollout & monitoring
  No flag. Backout is reverting the EU mango files plus limit-type code. Watch focused loader/runtime/harness tests.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`
  - `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`
  - `cd frontend && npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-eu-air'`
  - `npm run typecheck`
  - `npm run lint`
  - `cd frontend && npm run lint`

### Dependencies

- Live European Commission plant-health, TRACES, MRL legislation, and EU Pesticides Database API endpoints.

### Validation

Verify the loader spec first, then the runtime unknown-limit test, then the frontend harness unit test, then the targeted Playwright live scenario and lint/typecheck gates.

### Wiring Verification

| Component                                         | Entry Point                                                                                      | Registration Location                                                  | Schema/Table                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `rules/eu/mango.yaml` metadata + lab policy       | `RuleLoaderService.loadFromDisk()` via `getRuleDefinition()` and lane create flows               | auto-discovered from `rules/` directory                                | `lane_rule_snapshots.rules` JSON payload                              |
| `rules/eu/mango-substances.csv` official snapshot | `loadRuleDefinitionFromFile()` -> `buildRuleDefinition()` -> `RulesEngineService.evaluateLane()` | referenced by `substancesFile` in YAML                                 | `lane_rule_snapshots.rules.substances` and `substances` sync payloads |
| new `destinationLimitType` enum variant           | `loadRuleDefinitionFromFile()` and `RulesEngineService.buildLabValidation()`                     | `rule-definition.files.ts` parser + `rules-engine.utils.ts` normalizer | in-memory rule snapshot only                                          |
| frontend EU mango harness assertion               | Jest + Playwright lane matrix                                                                    | imported by `frontend/e2e/lane-creation-matrix.spec.ts`                | N/A                                                                   |

## Plan Draft B

### Overview

Make `EU/MANGO` exhaustive without broadening runtime enums by encoding official null-MRL rows into a conservative numeric representation where possible and using notes alone for the rest. This keeps the code diff smaller but leans harder on author judgment.

### Files to Change

- `rules/eu/mango.yaml`
- `rules/eu/mango-substances.csv`
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
- `docs/PROGRESS.md`

### Implementation Steps

TDD sequence:

1. Tighten the EU loader and harness tests.
2. Confirm the loader spec fails on stale partial expectations.
3. Update the EU YAML/CSV only, without runtime enum changes.
4. Run focused and broader gates.
5. Review the diff for any dishonest numeric coercions.

Functions and behaviors:

- Keep existing parser/runtime untouched.
- Encode only numeric API rows in the CSV.
- Use the official EU default fallback to cover unlisted substances.

Expected behavior and edge cases:

- Smallest code change.
- Null-MRL rows are omitted from the CSV and only described in comments/notes.
- Duplicate numeric rows are merged during CSV authoring.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads the repository eu mango rule file` - exhaustive metadata and numeric row count.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - `treats eu mango as supported live coverage` - harness remains positive.
- `frontend/e2e/lane-creation-matrix.spec.ts`
  - `creates lane for mango-eu-air` - live browser flow still works.

### Decision Completeness

- Goal
  Deliver an exhaustive operational EU mango pack with minimal code churn.
- Non-goals
  Add new limit-type semantics or preserve every non-numeric row structurally.
- Success criteria
  Loader and harness stay green and the EU CSV contains all numeric Commission mango rows.
- Public interfaces
  No code contract changes.
- Edge cases / failure modes
  - Null-MRL rows are dropped from structured evaluation.
  - Duplicate rows are manually merged in the CSV.
  - Fallback remains `0.01 mg/kg`.
- Rollout & monitoring
  No flag. Watch for review feedback on omitted non-numeric rows.
- Acceptance checks
  Same command set as Draft A, except no dedicated runtime-spec addition.

### Dependencies

- Same Commission sources and API.

### Validation

Loader spec, frontend harness unit test, targeted Playwright, lint, typecheck.

### Wiring Verification

| Component                           | Entry Point                             | Registration Location               | Schema/Table                             |
| ----------------------------------- | --------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `rules/eu/mango.yaml`               | `RuleLoaderService.getRuleDefinition()` | auto-discovered from `rules/`       | `lane_rule_snapshots.rules` JSON payload |
| `rules/eu/mango-substances.csv`     | loader -> snapshot -> lane evaluation   | `substancesFile` in YAML            | snapshot payload only                    |
| frontend EU mango harness assertion | Jest + Playwright                       | scenario import in lane matrix spec | N/A                                      |

## Comparative Analysis

### Strengths

- Draft A is fully truthful to the official API, including explicit no-numeric rows.
- Draft B is smaller and faster if the current runtime model were already sufficient.

### Gaps

- Draft A requires a small internal enum/runtime extension.
- Draft B drops official explicit rows with `displayMrl: null`, which weakens the claim that the pack is exhaustive.

### Trade-offs

- Draft A increases internal complexity slightly to preserve source truth.
- Draft B keeps implementation shallow but risks turning "exhaustive" into "all numeric rows only."

### Compliance Check

- Draft A aligns better with the repo's truthfulness and fail-closed guidance.
- Draft B is acceptable only if we deliberately downgrade the pack label, which would not satisfy the user request.

## Unified Execution Plan

### Overview

Implement Draft A. Use the official Commission backend API to replace the placeholder EU mango pack with a current exhaustive snapshot, add the smallest truthful runtime support for explicit no-numeric MRL rows, and keep the live quality-check harness green through loader, runtime, frontend unit, and targeted Playwright verification.

### Files to Change

- `rules/eu/mango.yaml` - upgrade to `FULL_EXHAUSTIVE`, set commodity code `0163030`, refresh sources and lab fallback.
- `rules/eu/mango-substances.csv` - add the Commission mango snapshot with merged duplicate notes and explicit limit-type annotations.
- `src/modules/rules-engine/rules-engine.types.ts` - add a new non-numeric limit type for official rows without a published numeric MRL.
- `src/modules/rules-engine/rule-definition.files.ts` - parse the new limit type from CSV.
- `src/modules/rules-engine/rules-engine.utils.ts` - preserve null stringency/risk for the new type.
- `src/modules/rules-engine/rules-engine.service.ts` - evaluate the new type as `UNKNOWN`.
- `src/modules/rules-engine/rule-loader.service.spec.ts` - move EU mango expectations from partial/document-only/empty to exhaustive/full-pesticide/full snapshot.
- `src/modules/rules-engine/rules-engine.service.spec.ts` - add one focused no-numeric EU row test.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts` - assert `mango-eu-air` support.
- `docs/PROGRESS.md` - record the EU mango completion.

### Implementation Steps

TDD sequence:

1. Update `rule-loader.service.spec.ts` to expect `EU/MANGO` exhaustive metadata, `FULL_PESTICIDE`, commodity code `0163030`, fallback `0.01`, and a nonzero substance count.
2. Add a focused `rules-engine.service.spec.ts` case proving the new EU no-numeric limit type yields `UNKNOWN`.
3. Add a frontend harness unit assertion for `mango-eu-air`.
4. Run those focused tests and confirm RED on the stale code/data.
5. Implement the enum/parser/runtime changes.
6. Generate and commit the truthful Commission-backed `rules/eu/mango-substances.csv` and updated YAML metadata.
7. Run focused GREEN tests, then `npm run lint`, `npm run typecheck`, `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`, `cd frontend && npm run lint`, and targeted Playwright for `mango-eu-air`.
8. Append implementation evidence and then run formal `g-check` on the working tree.

Functions and behaviors:

- `parseDestinationLimitType()` and CSV parse path
  Accept a new limit type for official non-numeric rows.
- `buildRuleDefinition()`
  Keep `stringencyRatio` and `riskLevel` null when the EU source publishes no numeric threshold.
- `RulesEngineService.buildLabValidation()`
  Return explicit `UNKNOWN` for matched no-numeric rows; preserve normal numeric evaluation and official 0.01 fallback for unlisted substances.

Expected behavior and edge cases:

- All current official EU mango numeric MRL rows are machine-readable in the CSV.
- All current official EU mango null-MRL rows remain represented explicitly with notes.
- Duplicate API rows are merged only when name, limit type, and numeric threshold align.
- If the API contains conflicting duplicate semantics, stop and fail closed instead of guessing.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads the repository eu mango rule file` - exhaustive metadata, fallback, and row snapshot load.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `evaluateLane leaves explicit no-numeric EU mango rows as unknown` - truthful no-numeric handling.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - `treats eu mango as supported live coverage` - unit harness support stays aligned with rule files.
- `frontend/e2e/lane-creation-matrix.spec.ts`
  - `creates lane for mango-eu-air` - live browser harness stays green.

### Decision Completeness

- Goal
  Deliver a truthful exhaustive `EU/MANGO` rule pack and keep the quality-check harness green.
- Non-goals
  General-purpose EU importer tooling, other EU fruits, or non-official market assumptions.
- Success criteria
  `rules/eu/mango.yaml` loads as `FULL_EXHAUSTIVE`, `sourceQuality: PRIMARY_ONLY`, `commodityCode: 0163030`, `labPolicy.enforcementMode: FULL_PESTICIDE`, and the CSV contains the current official Commission snapshot with explicit treatment of no-numeric rows.
- Public interfaces
  No external API changes. Internal rule CSV schema extends `destinationLimitType`.
- Edge cases / failure modes
  - No-numeric source rows -> explicit `UNKNOWN`, fail closed.
  - Duplicate source rows -> merge only if semantically identical; otherwise stop.
  - Unlisted lab result substances -> official EU default fallback `0.01 mg/kg`.
- Rollout & monitoring
  No migration or flag. Backout is reverting this pack plus the internal enum change. Monitor focused tests and targeted Playwright.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`
  - `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`
  - `cd frontend && npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-eu-air'`
  - `npm run typecheck`
  - `npm run lint`
  - `cd frontend && npm run lint`

### Dependencies

- European Commission plant-health import page
- European Commission TRACES page
- European Commission EU legislation on MRLs page
- European Commission EU Pesticides Database backend API (`products` and `product/{id}/mrls`)

### Validation

Start with focused RED/GREEN tests, then run backend/frontend lint and typecheck, then the targeted live Playwright EU mango scenario.

### Wiring Verification

| Component                                           | Entry Point                                                                                      | Registration Location                                                                                      | Schema/Table                                                        |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `rules/eu/mango.yaml` exhaustive metadata           | `RuleLoaderService.getRuleDefinition('EU', 'MANGO')`, lane create, rule snapshot endpoints       | auto-loaded from `rules/eu/mango.yaml`                                                                     | `lane_rule_snapshots.rules` JSON payload                            |
| `rules/eu/mango-substances.csv` Commission snapshot | `loadRuleDefinitionFromFile()` -> `buildRuleDefinition()` -> `RulesEngineService.evaluateLane()` | `substancesFile: ./mango-substances.csv` in YAML                                                           | `lane_rule_snapshots.rules.substances` and synced `substances` rows |
| new `destinationLimitType` variant                  | CSV parse + lane lab validation                                                                  | `rule-definition.files.ts`, `rules-engine.utils.ts`, `rules-engine.service.ts`                             | in-memory rule snapshot only                                        |
| `mango-eu-air` harness support assertion            | frontend Jest + Playwright lane matrix                                                           | `frontend/src/lib/testing/lane-creation-scenarios.test.ts` and `frontend/e2e/lane-creation-matrix.spec.ts` | N/A                                                                 |

## Implementation (2026-04-05 10:47:49 +07) - eu-mango-truthful-exhaustive-quality-check-harness

### Goal

Promote `EU/MANGO` from the current truthful placeholder to a truthful exhaustive Commission-backed pack and keep the live quality-check harness green.

### What Changed

- `rules/eu/mango.yaml`
  - Replaced the old partial/deferred notes with current official Commission source notes, promoted the pack to `FULL_EXHAUSTIVE`, set commodity code `0163030`, and moved lab enforcement to `FULL_PESTICIDE` with the EU `0.01 mg/kg` fallback.
- `rules/eu/mango-substances.csv`
  - Replaced the placeholder file with the live Commission mango snapshot from `product/76/mrls?lang=EN`: `520` raw rows merged into `516` unique operational substance names, including `13` explicit `NO_NUMERIC_LIMIT` rows.
- `src/modules/rules-engine/rules-engine.types.ts`
  - Added `NO_NUMERIC_LIMIT` as a first-class `destinationLimitType`.
- `src/modules/rules-engine/rule-definition.files.ts`
  - Extended CSV parsing to accept `NO_NUMERIC_LIMIT`.
- `src/modules/rules-engine/rules-engine.utils.ts`
  - Preserved null stringency/risk for the new limit type instead of forcing numeric semantics.
- `src/modules/rules-engine/rules-engine.service.ts`
  - Treats `NO_NUMERIC_LIMIT` like an explicit non-numeric limit: matched lab rows become `UNKNOWN`, not synthetic pass/fail results.
- `src/modules/lane/lane.types.ts`
  - Widened lane snapshot payload typing to carry the new limit type.
- `frontend/src/lib/types.ts`
  - Widened frontend rule snapshot typing to carry the new limit type.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Updated the EU mango repository test from partial/document-only/empty to exhaustive/full-pesticide/full-snapshot expectations.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - Added focused coverage for an explicit EU no-numeric row resolving to `UNKNOWN`.
- `frontend/src/lib/testing/lane-creation-scenarios.test.ts`
  - Added explicit positive harness support coverage for `mango-eu-air`.
- `docs/PROGRESS.md`
  - Appended the EU mango completion entry.

### TDD Evidence

RED

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - Failed because `rules/eu/mango.yaml` still reported `PRIMARY_PARTIAL` instead of `FULL_EXHAUSTIVE`.
- `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`
  - Failed because the new EU no-numeric row was still treated as numeric `0` and returned `FAIL` instead of `UNKNOWN`.

GREEN

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`
- `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`

### Tests Run

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` ✅
- `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts` ✅
- `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts` ✅
- `npm run lint` ✅
- `npm run typecheck` ✅
- `cd frontend && npm run lint` ✅
- `cd frontend && npm run typecheck` ✅
- `cd frontend && npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-eu-air'` ✅

### Wiring Verification Evidence

- `rules/eu/mango.yaml` -> `RuleLoaderService` auto-loads the pack through `substancesFile: ./mango-substances.csv` (`rules/eu/mango.yaml:75`).
- The new limit type is wired through the loader/parser/runtime path: `rule-definition.files.ts:88-99`, `rules-engine.types.ts:148`, `rules-engine.utils.ts:287`, `rules-engine.service.ts:800`.
- Lane snapshot typing now carries the new limit type via `src/modules/lane/lane.types.ts:305`, which unblocks `lane.rules-resolver.ts` returning the `RulesEngineService.getRuleSnapshot()` payload.
- Live frontend harness coverage remains wired through `frontend/src/lib/testing/lane-creation-scenarios.ts:99`, the unit assertion in `frontend/src/lib/testing/lane-creation-scenarios.test.ts:49-54`, and Playwright matrix consumption in `frontend/e2e/lane-creation-matrix.spec.ts`.

### Behavior Changes And Risk Notes

- `EU/MANGO` is now a real exhaustive pack rather than a document-only placeholder.
- The Commission's explicit no-numeric mango rows stay represented structurally and fail closed as `UNKNOWN` instead of being dropped or coerced into fake numeric thresholds.
- Duplicate Commission display names were merged only where their effective limit semantics matched exactly; the authoring path would have failed closed on any conflicting duplicates.
- Residual risk: this pack is a point-in-time snapshot of a live Commission API, so future source drift will require a refresh rather than silently changing runtime behavior.

### Follow-ups / Known Gaps

- No new importer tool was added; the CSV is still a checked-in snapshot rather than a reusable sync script.
- Other EU fruits still need their own source-truth passes.

## Review (2026-04-05 10:47:49 +07) - working-tree (eu-mango targeted diff)

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree (targeted to the EU mango implementation files; unrelated AGENTS/local-note leftovers excluded)
- Commit: cf70693
- Commands Run: `git diff -- rules/eu/mango.yaml rules/eu/mango-substances.csv src/modules/rules-engine/rule-definition.files.ts src/modules/rules-engine/rules-engine.types.ts src/modules/rules-engine/rules-engine.utils.ts src/modules/rules-engine/rules-engine.service.ts src/modules/lane/lane.types.ts frontend/src/lib/types.ts src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts frontend/src/lib/testing/lane-creation-scenarios.test.ts docs/PROGRESS.md .codex/coding-log.current`, `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`, `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`, `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`, `npm run lint`, `npm run typecheck`, `cd frontend && npm run lint`, `cd frontend && npm run typecheck`, `cd frontend && npx playwright test e2e/lane-creation-matrix.spec.ts --grep 'creates lane for mango-eu-air'`

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

- Assumed the repo should preserve the Commission API as a point-in-time checked-in snapshot rather than adding a reusable sync/import tool in the same change.
- Assumed the existing runtime treatment of explicit non-numeric limits as `UNKNOWN` with `hasUnknowns: true` is the intended contract to follow for EU rows, matching the pre-existing physiological-level behavior.

### Recommended Tests / Validation

- If this is batched into a PR, rerun the same targeted loader/runtime/frontend/Playwright gates on the clean PR branch.
- On the next EU fruit pass, consider one additional focused runtime assertion that mixed numeric + `NO_NUMERIC_LIMIT` lab results still preserve the correct per-row statuses in the snapshot payload.

### Rollout Notes

- No migration or flag.
- Main residual risk is source drift: the Commission API is live, so future rule refreshes must intentionally regenerate the snapshot rather than silently relying on changed remote data.

## 2026-04-05 12:45 ICT

- Goal: Reduce PR-to-merge elapsed time by removing fake CI serialization, canceling stale PR-head runs, adding a fast staged-file-aware pre-commit path, and enabling GitHub auto-merge.
- What changed:
  - `.github/workflows/ci.yml`: added workflow concurrency, removed fake `needs` edges from `Integration Tests`, `Playwright E2E`, `Performance Smoke`, and `Build`, and made Node cache dependency paths explicit for root and mixed root/frontend jobs.
  - `.github/workflows/claude-code-review.yml`, `.github/workflows/auto-approve.yml`, `.github/workflows/claude.yml`: added workflow concurrency so superseded advisory PR-head runs get canceled instead of spending more runner time.
  - `.githooks/pre-commit`: added a repo-tracked pre-commit entry point that delegates to the staged-file-aware fast-check script.
  - `scripts/run-fast-staged-checks.sh`: added staged-file-aware fast checks that run backend `typecheck`/`lint`/`check:prisma-runtime`, frontend `typecheck`/`lint`, or no-op when the staged diff is unrelated.
  - `scripts/run-full-validation.sh`: added one explicit manual full-validation script for the slow local path.
  - `scripts/install-git-hooks.sh`: added a repo-local installer for `core.hooksPath=.githooks` and used it in the current checkout.
  - `docs/PROGRESS.md`: appended the human-readable progress entry for this CI/PR/merge-time work.
  - `prisma/AGENTS.md`, `rules/AGENTS.md`, `src/AGENTS.md`, `test/AGENTS.md`: auto-generated inventory sections refreshed via the repo's existing AGENTS sync hook after the new tracked files were added.
- TDD evidence:
  - RED: `STAGED_FILES=$'docs/PROGRESS.md' bash scripts/run-fast-staged-checks.sh` failed with `scripts/run-fast-staged-checks.sh: line 8: mapfile: command not found` on the repo's macOS Bash, proving the first implementation was not portable enough for local hooks.
  - GREEN: `bash -n .githooks/pre-commit scripts/install-git-hooks.sh scripts/run-fast-staged-checks.sh scripts/run-full-validation.sh` passed.
  - GREEN: `node -e "const fs=require('fs'); const yaml=require('yaml'); ['.github/workflows/ci.yml','.github/workflows/claude-code-review.yml','.github/workflows/auto-approve.yml','.github/workflows/claude.yml'].forEach((file)=>yaml.parse(fs.readFileSync(file,'utf8'))); console.log('workflow yaml ok');"` returned `workflow yaml ok`.
  - GREEN: `STAGED_FILES=$'docs/PROGRESS.md' bash scripts/run-fast-staged-checks.sh` returned `No relevant staged files for fast pre-commit checks; relying on CI.`
  - GREEN: `STAGED_FILES=$'src/main.ts' bash scripts/run-fast-staged-checks.sh` passed backend `npm run typecheck`, `npm run lint`, and `npm run check:prisma-runtime`.
  - GREEN: `STAGED_FILES=$'frontend/src/app/page.tsx' bash scripts/run-fast-staged-checks.sh` passed frontend `npm run typecheck` and `npm run lint`.
- Tests run and results:
  - `bash scripts/install-git-hooks.sh` -> passed (`Configured core.hooksPath=.githooks`).
  - `gh repo edit SubhajL/zrl --enable-auto-merge` -> returned successfully.
  - `gh api repos/SubhajL/zrl --jq '.allow_auto_merge'` -> `true`.
  - `gh api -X PATCH repos/SubhajL/zrl -f allow_auto_merge=true --jq '.allow_auto_merge'` -> `true`.
  - `gh api graphql -f query='query { repository(owner:"SubhajL", name:"zrl") { autoMergeAllowed } }'` -> `{"data":{"repository":{"autoMergeAllowed":true}}}`.
- Wiring verification evidence:
  - CI cancellation is now wired at the workflow level in `.github/workflows/ci.yml`, so new commits on the same PR head cancel in-flight superseded runs.
  - The long-running `Build`, integration, Playwright, and perf jobs no longer wait on unrelated upstream jobs and can now start immediately on the same PR head.
  - Local commit-time checks are now wired through `.githooks/pre-commit` -> `scripts/run-fast-staged-checks.sh`, and the current checkout is configured to use that hooks path.
  - Auto-merge is wired at the repository level for `SubhajL/zrl`, so PRs can be marked for auto-merge once required checks pass.
- Behavior Changes And Risk Notes:
  - Commit-time validation is intentionally narrower and faster; the authoritative slow path remains CI plus `scripts/run-full-validation.sh`.
  - Fresh clones will not pick up the new pre-commit hook until `bash scripts/install-git-hooks.sh` is run or `core.hooksPath` is set another way.
  - Advisory workflow concurrency now cancels superseded heads, which is intended, but it also means prior stale bot comments/reviews can stop mid-run when a new commit lands.
- Follow-ups / Known Gaps:
  - The current CI workflow still keeps backend lint/typecheck/tests inside a single `Backend Tests` job and frontend lint/build inside a single `Frontend Tests` job; if wall-clock time is still too high after this DAG cleanup, the next step is splitting those into separate required jobs without disrupting branch protection naming.
  - The repo does not yet auto-install `.githooks` on clone; if you want that enforced for collaborators, add the installer to the preferred bootstrap path later.

## Review (2026-04-05 12:45 ICT) - working-tree (CI + PR merge-time improvements)

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree (limited to the CI/workflow/hook changes from this session; unrelated pre-existing untracked files excluded)
- Commit: bf89318 (working tree)
- Commands Run: `git status --short`, `CODEX_ALLOW_LARGE_OUTPUT=1 git diff --stat`, `CODEX_ALLOW_LARGE_OUTPUT=1 git diff -- prisma/AGENTS.md rules/AGENTS.md src/AGENTS.md test/AGENTS.md`, `CODEX_ALLOW_LARGE_OUTPUT=1 git diff -- .github/workflows/ci.yml .github/workflows/claude-code-review.yml .github/workflows/auto-approve.yml .github/workflows/claude.yml .githooks/pre-commit scripts/install-git-hooks.sh scripts/run-fast-staged-checks.sh scripts/run-full-validation.sh`, `node -e "const fs=require('fs'); const yaml=require('yaml'); ['.github/workflows/ci.yml','.github/workflows/claude-code-review.yml','.github/workflows/auto-approve.yml','.github/workflows/claude.yml'].forEach((file)=>yaml.parse(fs.readFileSync(file,'utf8'))); console.log('workflow yaml ok');"`, `bash -n .githooks/pre-commit scripts/install-git-hooks.sh scripts/run-fast-staged-checks.sh scripts/run-full-validation.sh`, `STAGED_FILES=$'docs/PROGRESS.md' bash scripts/run-fast-staged-checks.sh`, `STAGED_FILES=$'src/main.ts' bash scripts/run-fast-staged-checks.sh`, `STAGED_FILES=$'frontend/src/app/page.tsx' bash scripts/run-fast-staged-checks.sh`, `gh api repos/SubhajL/zrl --jq '.allow_auto_merge'`, `gh api graphql -f query='query { repository(owner:"SubhajL", name:"zrl") { autoMergeAllowed } }'`

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

- Assumed it is acceptable for `.githooks` installation to remain an explicit repo bootstrap step rather than silently mutating every collaborator's local Git config outside this checkout.
- Assumed keeping existing CI job names stable was safer than splitting every quality gate into new required-check names in the same change.

### Recommended Tests / Validation

- Push a PR branch and confirm GitHub starts `Build`, `Integration Tests`, `Playwright E2E`, and `Performance Smoke` immediately instead of waiting on `Backend Tests` / `Frontend Tests`.
- On a fresh clone, run `bash scripts/install-git-hooks.sh` and confirm a mixed staged diff executes both backend and frontend fast checks through `.githooks/pre-commit`.

### Rollout Notes

- Existing local clones need `bash scripts/install-git-hooks.sh` once to adopt the tracked pre-commit hook.
- Repository auto-merge is enabled, but individual PRs still need to be set to auto-merge after required checks go green.

## Review (2026-04-06 20:46 +07) - working-tree (rules-engine non-numeric gate + EU durian)

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree (tracked rules-engine/frontend/progress changes plus the new untracked `rules/eu/durian.*` pack files)
- Commands Run: `git status --porcelain=v1`, `git diff --name-only`, `git diff --stat`, `git diff -- src/modules/rules-engine/rules-engine.service.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/rules-engine/rule-loader.service.spec.ts frontend/src/lib/testing/lane-creation-scenarios.test.ts docs/PROGRESS.md`, `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`, `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts`, `cd frontend && npm test -- --runInBand src/lib/testing/lane-creation-scenarios.test.ts`, `npm run typecheck`, `npm run lint`, `cd frontend && npm run typecheck`, `cd frontend && npm run lint`, `node ... product/83/mrls?lang=EN` Commission API checks

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

- Assumed the intended fail-closed correction was only for measured explicit non-numeric rows, not a broader change to make all missing exhaustive-pack substances block aggregate validation.
- Assumed `EU/DURIAN` should follow the same Commission snapshot authoring pattern already established for `EU/MANGO`, including checked-in CSV data and explicit `NO_NUMERIC_LIMIT` encoding.

### Recommended Tests / Validation

- If this is split into a PR, run the same focused loader/runtime/frontend gates on the PR branch.
- Add one targeted Playwright matrix assertion for `durian-eu-sea` so the new live-support path is covered at browser level, not only in unit tests.

### Rollout Notes

- The new aggregate semantics intentionally stop reporting overall `PASS` when a measured row has an explicit non-numeric destination limit; downstream consumers already read `valid`, `status`, and `blockingReasons` generically, so no additional wiring issue was found.
- `EU/DURIAN` remains a point-in-time Commission snapshot, so future source drift still requires intentional regeneration rather than runtime scraping.

## 2026-04-07 13:55 ICT

- Goal: Implement Task Master 34.1 by adding a machine-readable supported document matrix and required field schemas for the first-pass OCR/form-completeness scope.
- What changed:
  - `rules/document-matrix.yaml`: Added a source-traceable data file for the supported first-pass official/formal artifact subset across the 9 live supported market/product rule packs. Captures required document coverage, canonical field keys, source URLs, confidence, and combo-specific field overrides.
  - `src/modules/evidence/document-matrix.ts`: Added a typed loader and parser for the document matrix so later OCR/evidence code can consume it without hardcoding document policy in services.
  - `src/modules/evidence/document-matrix.spec.ts`: Added unit tests covering the matrix structure and an exact cross-check that the matrix supported combos match the live `rules/*.yaml` tree.
  - `docs/PROGRESS.md`: Logged completion of Task Master 34.1 and the next intended step.
- TDD evidence:
  - RED test added first: `src/modules/evidence/document-matrix.spec.ts` imported `./document-matrix` before the loader existed, producing the expected module-not-found failure in the editor/type layer.
  - GREEN command: `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts`
  - Additional validation: `npm run typecheck`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` -> passed (`2` tests)
  - `npm run typecheck` -> passed
- Wiring verification:
  - `rules/document-matrix.yaml` is read by `loadSupportedDocumentMatrix()` in `src/modules/evidence/document-matrix.ts`.
  - `src/modules/evidence/document-matrix.spec.ts` proves the matrix stays aligned with the live rule tree by loading all current `rules/*.yaml` definitions through `findRuleYamlFiles()` + `loadRuleDefinitionFromFile()` and asserting exact combo parity.
- Behavior changes and risk notes:
  - No runtime behavior changed yet; this batch only adds the authoritative machine-readable matrix needed for later OCR/extraction work.
  - `Export License`, `VHT Certificate`, and some trade-document labels remain explicitly confidence-tagged/ambiguous rather than overstated as clean government form templates.
- Follow-ups and known gaps:
  - Task Master `34.2` should add derived analysis storage/types before any OCR provider integration.
  - The matrix currently covers only the official/formal first-pass subset and intentionally excludes operational artifacts like temperature logs and product photos.

## 2026-04-07 14:00 ICT

- Goal: Implement Task Master 34.2 by adding additive storage and typed models for derived evidence document analysis results.
- What changed:
  - `prisma/schema.prisma`: Added `ArtifactAnalysisStatus` plus new `EvidenceArtifactAnalysis` model linked to both `EvidenceArtifact` and `Lane`.
  - `prisma/migrations/20260407070000_add_evidence_artifact_analysis_model/migration.sql`: Added the additive `evidence_artifact_analyses` table, enum, indexes, and foreign keys.
  - `src/modules/evidence/evidence.types.ts`: Added typed analysis record/response contracts and exposed optional `latestAnalysis` on evidence artifacts.
  - `src/modules/evidence/evidence.pg-store.ts`: Added a lateral join to load the latest derived analysis per artifact without mutating the source artifact row shape.
  - `src/modules/evidence/evidence.service.ts`: Added response mapping for `latestAnalysis` so evidence APIs can surface derived analysis cleanly.
  - `src/modules/evidence/evidence.service.spec.ts`: Added coverage proving lane artifact responses can include the latest derived analysis.
  - `src/modules/evidence/evidence.pg-store.spec.ts`: Added a DB-backed test for the latest-analysis join path (runs when `DATABASE_URL` is configured).
  - `docs/PROGRESS.md`: Logged Task Master 34.2 completion.
- TDD evidence:
  - RED path: updated `evidence.service.spec.ts` to expect `latestAnalysis` on `EvidenceArtifactRecord`, which failed immediately because the type/model did not exist yet.
  - GREEN commands:
    - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/document-matrix.spec.ts`
    - `npm run typecheck`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/document-matrix.spec.ts` -> passed (`27` tests); existing auto-verify unit-test log noise remains from the previously known mock edge case.
  - `npm run typecheck` -> passed.
- Wiring verification:
  - `EvidenceArtifactAnalysis` is linked to `EvidenceArtifact` + `Lane` in `prisma/schema.prisma` and the additive migration.
  - `PrismaEvidenceStore` now returns `latestAnalysis` through the same artifact read/list code paths used by `EvidenceService.listLaneArtifacts()` and `EvidenceService.getArtifact()`.
  - `EvidenceService.mapArtifact()` now exposes the typed latest analysis in API-facing artifact responses.
- Behavior changes and risk notes:
  - No OCR extraction runs yet; this batch only adds the typed storage/wiring needed for later analyzer integration.
  - The DB-backed store test for the new join is conditional on `DATABASE_URL`, matching the repo's existing DB-backed evidence-store spec pattern.
- Follow-ups and known gaps:
  - Task Master `34.3` should add the OCR provider abstraction and local extraction flow.
  - No analysis create/update service/store methods exist yet; those will land with the actual analyzer orchestration.

## 2026-04-07 14:12 ICT

- Goal: Implement Task Master 34.3 by adding a local open-source OCR provider abstraction for later document-analysis wiring.
- What changed:
  - `src/modules/evidence/evidence.constants.ts`: Added a new DI token for the evidence document analysis provider.
  - `src/modules/evidence/evidence.types.ts`: Added provider availability and text-extraction contracts.
  - `src/modules/evidence/evidence.document-analysis.ts`: Added `TesseractEvidenceDocumentAnalysisProvider`, including binary discovery, optional OCRmyPDF preprocessing detection, local command execution, and clean unavailable-binary errors.
  - `src/modules/evidence/evidence.document-analysis.spec.ts`: Added focused tests for provider availability, deterministic tesseract command invocation, and clean failure when OCR is unavailable.
  - `src/modules/evidence/evidence.module.ts`: Wired the local OCR provider into the Nest evidence module through the new token.
  - `docs/PROGRESS.md`: Logged Task Master 34.3 completion.
- TDD evidence:
  - RED test added first in `evidence.document-analysis.spec.ts`, which failed because the provider file and token did not exist yet.
  - First GREEN attempt exposed a real test/setup mismatch around mocked OCRmyPDF availability; tightened the mocks so preprocessing expectations are explicit.
  - GREEN command: `npm test -- --runInBand src/modules/evidence/evidence.document-analysis.spec.ts`
  - Additional validation: `npm run typecheck`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.document-analysis.spec.ts` -> passed (`3` tests)
  - `npm run typecheck` -> passed
- Wiring verification:
  - `TesseractEvidenceDocumentAnalysisProvider` is registered in `EvidenceModule` through `EVIDENCE_DOCUMENT_ANALYSIS_PROVIDER`.
  - The provider is consumable by later OCR orchestration work without changing current upload flows.
  - Local environment check confirmed `tesseract` is installed, `ocrmypdf` is not, and installed language packs include `eng`, `tha`, `jpn`, and `kor`.
- Behavior changes and risk notes:
  - No artifact uploads invoke OCR yet; this batch only adds the provider abstraction and local extraction implementation.
  - OCRmyPDF support is optional and detected at runtime so local development does not break when it is absent.
- Follow-ups and known gaps:
  - Task Master 34.4 should implement document classification/field extraction logic on top of this provider.
  - Task Master 34.6 will wire analyzer invocation into upload/reanalysis flows.

## 2026-04-07 14:24 ICT

- Goal: Implement Task Master 34.4 by adding deterministic document classification and field extraction rules for the first-pass supported document set.
- What changed:
  - `src/modules/evidence/evidence.constants.ts`: Added a new DI token for the evidence document classifier.
  - `src/modules/evidence/evidence.types.ts`: Added classifier result and interface contracts.
  - `src/modules/evidence/evidence.document-classifier.ts`: Added `MatrixDrivenEvidenceDocumentClassifier`, which loads `rules/document-matrix.yaml`, selects candidate documents by combo + artifact type, scores matches from OCR text/file hints, extracts normalized fields with conservative regexes and existing metadata keys, and returns missing/low-confidence field lists.
  - `src/modules/evidence/evidence.document-classifier.spec.ts`: Added focused tests for phytosanitary classification, GAP metadata reuse, and unsupported-document failure.
  - `src/modules/evidence/evidence.module.ts`: Wired the classifier into the evidence module through the new token.
  - `docs/PROGRESS.md`: Logged Task Master 34.4 completion.
- TDD evidence:
  - RED test added first in `evidence.document-classifier.spec.ts`, failing immediately because the classifier file and token did not exist.
  - First GREEN attempt exposed a strict test expectation issue around `mustStateFruitFlyFree`; updated the test to match the classifier's correct extraction from the sample OCR text.
  - GREEN command: `npm test -- --runInBand src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.document-analysis.spec.ts`
  - Additional validation: `npm run typecheck`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.document-analysis.spec.ts` -> passed (`6` tests)
  - `npm run typecheck` -> passed
- Wiring verification:
  - `MatrixDrivenEvidenceDocumentClassifier` is registered in `EvidenceModule` through `EVIDENCE_DOCUMENT_CLASSIFIER`.
  - The classifier loads the machine-readable rules asset from `rules/document-matrix.yaml` and reuses existing evidence metadata field names already normalized in `EvidenceService`.
  - The classifier is available for later OCR orchestration without altering current upload flows yet.
- Behavior changes and risk notes:
  - Classification/extraction is intentionally conservative and heuristic; unsupported or weakly matched documents return `FAILED` classification instead of guessing.
  - Regex extraction currently targets the first-pass official/formal subset only and should expand cautiously as more fixtures are added.
- Follow-ups and known gaps:
  - Task Master 34.6 should orchestrate OCR + classification on upload/reanalysis and persist analysis rows into `evidence_artifact_analyses`.
  - Task Master 34.5 field-completeness evaluation should be folded into or revisited during orchestration if the current extracted-field/missing-field output needs stricter matrix-level semantics.

## 2026-04-07 14:40 ICT

- Goal: Implement Task Master 34.6 by wiring derived OCR/classification into evidence upload and adding safe on-demand reanalysis for stored artifacts.
- What changed:
  - `src/modules/evidence/evidence.types.ts`: Added typed create-analysis input for store writes and kept the derived analysis contract explicit and separate from source artifact truth.
  - `src/modules/evidence/evidence.pg-store.ts`: Added `createArtifactAnalysis(...)` so derived analyzer results persist as additive rows in `evidence_artifact_analyses`.
  - `src/modules/evidence/evidence.service.ts`: Added post-upload `autoAnalyzeArtifactAfterUpload(...)`, shared `runArtifactAnalysis(...)`, and public `reanalyzeArtifact(...)`; upload now attempts OCR/classification after persistence and integrity verification, while failures log and fail open.
  - `src/modules/evidence/evidence.controller.ts`: Added `POST /evidence/:id/reanalyze` for explicit reruns against already stored artifacts.
  - `src/modules/evidence/evidence.module.ts`: Finished factory wiring so the service receives the document analysis provider and classifier in the real Nest runtime path.
  - `src/modules/evidence/evidence.service.spec.ts`: Added RED/GREEN coverage proving upload persists derived analysis when rule context exists and that `reanalyzeArtifact()` reruns analysis and stores a fresh result.
  - `docs/PROGRESS.md`: Logged Task Master 34.6 completion.
- TDD evidence:
  - RED tests were added first in `evidence.service.spec.ts` for upload-time `createArtifactAnalysis(...)` persistence and explicit `reanalyzeArtifact()` support.
  - First GREEN attempt exposed a real fixture gap: the upload test lane lacked `ruleSnapshot`, so the new fail-open analysis path correctly no-op'd. Updated the fixture to include rule context instead of weakening the service guard.
  - GREEN commands:
    - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.document-analysis.spec.ts`
    - `npm run typecheck`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.document-analysis.spec.ts` -> passed (`32` tests); the previously known auto-verify mock log noise (`Artifact not found`) still appears in one unit path but does not fail the suite.
  - `npm run typecheck` -> passed.
- Wiring verification:
  - `EvidenceService.persistArtifact()` now calls `autoAnalyzeArtifactAfterUpload(...)` after artifact persistence, auto verification, and lane graph verification.
  - `runArtifactAnalysis(...)` reads the stored object through the existing object-store abstraction, checks OCR provider availability, requires lane rule context, runs OCR + matrix-driven classification, and persists the derived row through `PrismaEvidenceStore.createArtifactAnalysis(...)`.
  - `EvidenceController.reanalyzeArtifact()` routes `POST /evidence/:id/reanalyze` into the same service path used for upload-time analysis, preserving lane ownership checks.
  - `EvidenceModule` injects both `EVIDENCE_DOCUMENT_ANALYSIS_PROVIDER` and `EVIDENCE_DOCUMENT_CLASSIFIER` into the real service factory, so the behavior is wired in production code rather than test-only mocks.
- Behavior changes and risk notes:
  - Source evidence integrity remains unchanged: OCR/classification outputs are stored only as additive derived analysis rows and never overwrite source metadata, hashes, or files.
  - Analysis degrades gracefully when OCR is unavailable, lane rule context is missing, or extraction/classification fails; uploads and artifact reads still succeed.
  - Current persistence writes a new derived analysis row per run rather than mutating prior results, which preserves analyzer lineage for future versioning/comparison.
- Follow-ups and known gaps:
  - Task Master `34.5` still needs a decision on whether the current `missingFieldKeys` / `lowConfidenceFieldKeys` output is sufficient or should be formalized into stricter matrix-level completeness scoring semantics.
  - The frontend does not yet surface the persisted OCR/classification results, so this batch completes backend orchestration but not analyst-facing review UX.

## 2026-04-07 14:50 ICT

- Goal: Implement Task Master 34.5 by formalizing required-field completeness evaluation per artifact while keeping it separate from the existing lane completeness score.
- What changed:
  - `src/modules/evidence/evidence.types.ts`: Added a first-class `EvidenceDocumentFieldCompleteness` contract and attached it to classifier output, derived-analysis write input, stored analysis records, and API responses.
  - `src/modules/evidence/evidence.document-classifier.ts`: Formalized matrix-driven completeness evaluation so each matched document now produces `supported`, `documentMatrixVersion`, `expectedFieldKeys`, `presentFieldKeys`, `missingFieldKeys`, `lowConfidenceFieldKeys`, and `unsupportedFieldKeys` from the existing document matrix. Also tightened a few generic regexes so unsupported-field reporting stays truthful instead of noisy.
  - `prisma/schema.prisma`: Added additive `fieldCompleteness` JSON storage on `EvidenceArtifactAnalysis` and fixed the previously incomplete `Lane` opposite relation for analysis rows so Prisma client generation succeeds.
  - `prisma/migrations/20260407075500_add_field_completeness_to_evidence_artifact_analyses/migration.sql`: Added the additive `field_completeness` JSONB column.
  - `src/modules/evidence/evidence.pg-store.ts`: Persisted and hydrated `fieldCompleteness` through analysis writes and latest-analysis reads.
  - `src/modules/evidence/evidence.service.ts`: Mapped persisted field completeness through upload/reanalysis writes and API-facing `latestAnalysis` responses.
  - `src/modules/evidence/evidence.document-classifier.spec.ts`: Added RED/GREEN coverage for supported completeness output, unsupported classification output, and unsupported-field reporting on GAP metadata reuse.
  - `src/modules/evidence/evidence.service.spec.ts`: Added RED/GREEN assertions proving upload/reanalysis persistence and latest-analysis API mapping now include `fieldCompleteness`.
  - `src/modules/evidence/evidence.pg-store.spec.ts`: Extended the DB-backed latest-analysis read path to cover `field_completeness` hydration when `DATABASE_URL` is configured.
  - `docs/PROGRESS.md`: Logged Task Master 34.5 completion.
- TDD evidence:
  - RED tests were added first in classifier/service/store specs to assert a new `fieldCompleteness` object on classifier output, persisted analysis writes, and latest-analysis API responses.
  - Initial RED run failed for the intended reason: no `fieldCompleteness` support existed in the contracts or mappings.
  - First GREEN pass exposed two real correctness issues and one schema issue:
    - completeness was being computed before some Japan/Korea declaration-derived fields were finalized;
    - unsupported-field reporting was polluted by overly broad generic regex matches (`date`, `exporter`, and GAP `issuer` reuse);
    - `npm run db:generate` surfaced that `EvidenceArtifactAnalysis.lane` already existed in Prisma but `Lane` lacked the opposite relation field.
  - Fixed all three rather than weakening the tests.
  - RED command:
    - `npm test -- --runInBand src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - GREEN commands:
    - `npm test -- --runInBand src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts`
    - `npm run typecheck`
    - `npm run db:generate`
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts` -> passed (`29` tests, `3` skipped DB-conditional tests depending on local env path); the previously known auto-verify unit-test log noise (`Artifact not found`) still appears in one mock-heavy evidence-service path but does not fail the suite.
  - `npm run typecheck` -> passed.
  - `npm run db:generate` -> passed after adding the missing `Lane.analyses` opposite relation field.
- Wiring verification:
  - `MatrixDrivenEvidenceDocumentClassifier.analyze()` now computes and returns the formal `fieldCompleteness` payload directly from `rules/document-matrix.yaml` versioned expectations.
  - `EvidenceService.runArtifactAnalysis()` passes the classifier-produced `fieldCompleteness` into `createArtifactAnalysis(...)`, so upload-time and reanalysis-time analysis rows persist the same semantics.
  - `PrismaEvidenceStore.createArtifactAnalysis()` writes the payload to `evidence_artifact_analyses.field_completeness`, and the existing latest-analysis lateral join now hydrates it back into `EvidenceArtifactRecord.latestAnalysis`.
  - `EvidenceService.mapArtifactAnalysis()` exposes the persisted field completeness on artifact list/detail API responses under `latestAnalysis.fieldCompleteness`.
- Behavior changes and risk notes:
  - Lane completeness remains unchanged; the new field-completeness result is explicit additive analysis only and does not silently redefine the existing rules-engine score.
  - Older analysis rows can still have `fieldCompleteness: null`; only new analyses created after this change are guaranteed to include the new payload.
  - `unsupportedFieldKeys` is intentionally strict: it now reflects fields actually extracted and persisted that are outside the matched matrix schema, which makes it useful for drift detection without flooding responses from generic undefined placeholders.
- Follow-ups and known gaps:
  - Frontend evidence/lane-detail screens still do not render `latestAnalysis.fieldCompleteness`, so analysts cannot yet review the new completeness signal visually.
  - If desired later, the repo can backfill historical analysis rows by re-running `POST /evidence/:id/reanalyze`; this batch intentionally did not add automatic backfill or reinterpret old rows.

## 2026-04-07 15:00 ICT

- Goal: Surface `latestAnalysis.fieldCompleteness` in the lane detail Evidence tab and add operator-triggered reanalysis/backfill flows on top of the existing backend `POST /evidence/:id/reanalyze` path.
- What changed:
  - `frontend/src/lib/types.ts`: Expanded the shared frontend evidence contract to include `latestAnalysis`, `EvidenceArtifactAnalysis`, and `EvidenceDocumentFieldCompleteness` so the lane detail UI can consume the live backend response shape directly.
  - `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.tsx`: Added inline document-analysis display per artifact, including detected document label, confidence, summary text, and field-completeness breakdown (`present`, `missing`, `low confidence`, `unsupported extract`). Added row-level `Reanalyze` and a category-level `Backfill Missing Analysis` action that only appears when at least one artifact lacks analysis or field-completeness data.
  - `frontend/src/app/(app)/lanes/[laneId]/_components/lane-detail-tabs.tsx`: Wired the new UI actions to the existing app proxy routes, calling `POST /api/zrl/evidence/:id/reanalyze` for single-item reruns and bulk backfill, then refreshing the page.
  - `frontend/src/lib/lane-detail-data.test.ts`: Updated the backend evidence fixture shape to include `latestAnalysis.fieldCompleteness` so lane-detail loading stays aligned with the current backend contract.
  - `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx`: Added RED/GREEN coverage for inline completeness rendering, row-level reanalysis, and bulk backfill.
  - `frontend/src/app/(app)/lanes/[laneId]/page.test.tsx`: Added RED/GREEN coverage proving lane detail calls the correct reanalyze endpoint for both single-artifact and bulk backfill actions.
  - `docs/PROGRESS.md`: Logged the frontend/operator completion slice.
- TDD evidence:
  - RED tests were added first in `tab-evidence.test.tsx` and `page.test.tsx` to assert new `latestAnalysis` rendering plus `Reanalyze` / `Backfill Missing Analysis` behavior.
  - Initial RED failures were the expected contract gaps: the frontend `EvidenceArtifact` type had no `latestAnalysis`, and `TabEvidenceProps` had no reanalyze/backfill callbacks.
  - A later GREEN pass exposed one real brittle test issue in `page.test.tsx`: the previous exact-count assertion for `Phytosanitary Certificate` was no longer valid once the analysis badge rendered the same label. Updated the test to assert semantic presence rather than the old duplicate count.
  - RED path was established through the new Jest expectations before implementing the component and type changes.
  - GREEN commands:
    - `cd frontend && npm test -- --runInBand --runTestsByPath "src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx" "src/app/(app)/lanes/[laneId]/page.test.tsx" "src/lib/lane-detail-data.test.ts"`
    - `cd frontend && npm run lint`
    - `cd frontend && npm run typecheck`
- Tests run and results:
  - `cd frontend && npm test -- --runInBand --runTestsByPath "src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx" "src/app/(app)/lanes/[laneId]/page.test.tsx" "src/lib/lane-detail-data.test.ts"` -> passed (`38` tests).
  - `cd frontend && npm run lint` -> passed.
  - `cd frontend && npm run typecheck` -> passed.
- Wiring verification:
  - `LaneDetailTabs` now passes `onReanalyzeArtifact` and `onBackfillAnalysis` into `TabEvidence`, and both functions call the existing app proxy at `/api/zrl/evidence/:id/reanalyze`.
  - The app proxy route `frontend/src/app/api/zrl/[...path]/route.ts` already forwards `POST` requests generically, so no additional route file was needed for the frontend backfill flow.
  - `TabEvidence` only exposes the bulk backfill action when at least one artifact has `latestAnalysis === null` or `latestAnalysis.fieldCompleteness === null`, which matches the intended older-artifact backfill use case.
- Behavior changes and risk notes:
  - The new UI augments existing integrity verification UX; it does not replace hash verification status or lane completeness.
  - Bulk backfill currently runs sequential logical reruns via `Promise.all` from the browser against the existing single-artifact endpoint. This is minimal and correct for the current repo stage, but a future dedicated bulk backend endpoint could improve large-lane ergonomics.
  - The Evidence tab now shows more repeated document labels, so brittle tests or selectors should prefer semantic roles/text combinations rather than exact duplicate counts.
- Follow-ups and known gaps:
  - Task Master `34.7` remains pending: extracted fields are visible in the UI now, but backend rules/certification consumers do not yet use them beyond the existing metadata-driven flows.
  - Task Master `34.9` remains pending: there are no dedicated operator docs or richer scanned-document fixture sets yet for the new reanalysis/backfill UX.

## Review (2026-04-07 15:08 ICT) - working-tree Task 34 completed subtasks

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree` focused on completed Task 34 subtasks (`34.1`-`34.6` and the current `34.8` UI slice)
- Commands Run:
  - `git status --short --branch`
  - `git diff --stat`
  - targeted file reads and semantic retrieval over evidence/frontend Task 34 files
  - `cd frontend && npm test -- --runInBand --runTestsByPath "src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx" "src/app/(app)/lanes/[laneId]/page.test.tsx" "src/lib/lane-detail-data.test.ts"`
  - `cd frontend && npm run lint && npm run typecheck`

### Findings

CRITICAL

- No findings.

HIGH

- No findings after fix.

MEDIUM

- No findings.

LOW

- The working tree still contains unrelated modified/untracked files outside the Task 34 scope (`docs/DEPLOYMENT-REFERENCE.md`, several older coding logs, local `.local/`, guide-file edits, and other pre-existing changes). This is not a correctness bug in Task 34 itself, but it means any commit/PR from the current branch must isolate the intended Task 34 subset carefully.

### Open Questions / Assumptions

- Assumed it is acceptable to mark the current frontend/operator slice as satisfying the practical UI portion of `34.8`, even though `34.7` and `34.9` remain pending overall in Task 34.
- Assumed bulk backfill should only target the first-pass analyzable Task 34 artifact set (`PHYTO_CERT`, `VHT_CERT`, `MRL_TEST`, `GAP_CERT`, `INVOICE`) and not operational evidence types.

### Recommended Tests / Validation

- Before merge, run the focused backend Task 34 suite again from repo root so the commit/PR includes both frontend and backend confidence in one pass:
  - `npm test -- --runInBand src/modules/evidence/evidence.document-analysis.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts`
  - `npm run typecheck`
  - `npm run db:generate`
- If a PR is created from an isolated branch, verify the diff excludes unrelated non-Task-34 worktree changes.

### Rollout Notes

- Initial review found one real issue in the new frontend bulk backfill flow: it targeted every artifact missing analysis, including unsupported operational types. This would have created noisy failed analyses outside the Task 34 OCR scope. The fix restricted bulk backfill to the analyzable artifact set and added a regression test in `tab-evidence.test.tsx`.
- With that fix applied, no remaining correctness findings were identified in the reviewed Task 34 surface.
