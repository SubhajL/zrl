# Japan Durian Exhaustive Completion

Planning timestamp: 2026-04-04 17:50:23 ICT

## Plan Draft A

### 1. Overview

Replace the current proxy-heavy Japan durian pack with a primary-source-backed exhaustive pack. The pesticide side will use the official JFCRF commodity classification that actually covers durian, and the non-pesticide side will use the MAFF import-condition database result for `Durio zibethinus` fresh fruit to encode the truthful normal-inspection / phytosanitary-certificate path with no special Annex treatment.

### 2. Files to Change

- `rules/japan/durian.yaml` — refresh metadata, source comments, commodity code, and non-pesticide checks.
- `rules/japan/durian-substances.csv` — replace the 10 proxy/monitoring rows with the exhaustive official explicit row set for the durian classification.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — tighten repository durian assertions to the new exhaustive metadata and row content.
- `docs/PROGRESS.md` — record completion of the exhaustive Japan durian pack.
- `coding-logs/2026-04-04-17-50-23 Coding Log (japan-durian-exhaustive-completion).md` — append implementation evidence after the code change.

### 3. Implementation Steps

#### TDD sequence

1. Add or update the repository durian loader test with the target metadata and explicit row expectations.
2. Run the focused loader spec and confirm it fails for the right reason against the current 10-row proxy pack.
3. Replace the YAML/CSV with the smallest truthful primary-source-backed change to satisfy the new assertions.
4. Refactor only if needed for clarity in comments or notes; avoid runtime code changes unless the source format demands it.
5. Run the focused fast gates for the touched area.

#### Functions / behaviors

- `loadRuleDefinitionFromFile()` — no planned logic change; it should continue loading YAML + CSV and preserve `destinationLimitType` for durian rows.
- `buildRuleDefinition()` — no planned logic change; it should continue normalizing the exhaustive metadata.
- Repository durian rule definition — will move to `FULL_EXHAUSTIVE`, use the specific durian-applicable commodity code, and encode phytosanitary handling as a required non-pesticide check while omitting special treatment checks.

#### Expected behavior and edge cases

- Durian should load as a Japan ruleset with exhaustive explicit JFCRF row coverage for its actual commodity classification.
- The explicit row set may be very small; the pack still remains exhaustive because the default 0.01 mg/kg fallback stays active for unspecified pesticides.
- Special non-numeric source rows such as `※` must be preserved via `destinationLimitType` rather than converted into invented numeric thresholds.

### 4. Test Coverage

- `RuleLoaderService › loads the repository japan durian rule file`
  - Verifies exhaustive metadata and commodity code.
  - Verifies no VHT certificate requirement.
  - Verifies explicit row count and qualifier handling.

### 5. Decision Completeness

- Goal
  - Finish `JAPAN/DURIAN` as a truthful exhaustive pack comparable in rigor to `KOREA/MANGO` and `JAPAN/MANGO`.
- Non-goals
  - Do not add new backend rule-evaluation behavior unless the source format forces it.
  - Do not invent durian-specific Thai comparator data just to pad the CSV.
- Success criteria
  - Durian YAML metadata is primary-source-backed and exhaustive.
  - Durian CSV contains the full explicit JFCRF row set for the durian-applicable classification.
  - Loader tests assert the new row count, qualifier, and metadata and pass.
- Public interfaces
  - No API shape changes.
  - No schema or migration changes.
  - Rule-pack payload changes only in content for `JAPAN/DURIAN`.
- Edge cases / failure modes
  - If the durian-applicable classification has only one explicit row, keep it and rely on `defaultDestinationMrlMgKg: 0.01` for the rest.
  - Fail closed on bad CSV formatting or invalid qualifier values via the existing loader behavior.
- Rollout & monitoring
  - No feature flag.
  - Rollback is reverting the YAML/CSV/test/docs changes.
  - Watch for loader regressions and lane evaluation changes on unlisted substances.
- Acceptance checks
  - Focused loader spec passes.
  - Relevant backend typecheck/lint pass if touched.
  - `docs/PROGRESS.md` reflects the new completed pack.

### 6. Dependencies

- Official JFCRF MRL system commodity classification pages and XLSX export.
- Official MAFF import-condition database result for `Durio zibethinus` fresh fruit.

### 7. Validation

- `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- `npm run typecheck`
- targeted lint for touched backend files if needed

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `rules/japan/durian.yaml` | Rules loader filesystem scan | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| `rules/japan/durian-substances.csv` | Loaded from `substancesFile` in durian YAML | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Durian repository loader test | Jest service spec | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |

## Plan Draft B

### 1. Overview

Minimize change surface by treating Japan durian as an exhaustive default-fallback pack: keep runtime behavior intact, reduce the explicit CSV to only the official specific entries for the durian classification, and encode the MAFF import-condition outcome as generic phytosanitary handling instead of country-specific treatment logic.

### 2. Files to Change

- `rules/japan/durian.yaml`
- `rules/japan/durian-substances.csv`
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `docs/PROGRESS.md`

### 3. Implementation Steps

#### TDD sequence

1. Update the loader spec to assert the minimal exhaustive shape.
2. Run it red against the current proxy pack.
3. Rewrite the durian YAML/CSV to the minimal primary-source pack.
4. Run the focused rules-engine gates.
5. Record evidence in the coding log.

#### Functions / behaviors

- No runtime code changes planned.
- Reuse the already-shipped qualifier support if the explicit durian row uses `※`.

#### Expected behavior and edge cases

- Durian may end up with one explicit qualifier row plus the general fallback; that is acceptable if it matches the official classification exactly.
- `GAP_CERT` stays operational, not regulatory.

### 4. Test Coverage

- `RuleLoaderService › loads the repository japan durian rule file`
  - Covers exhaustive metadata, one explicit row, and no special-treatment document.

### 5. Decision Completeness

- Goal
  - Make Japan durian exhaustive with the smallest truthful data surface.
- Non-goals
  - No extra controller/e2e changes.
- Success criteria
  - The pack has zero proxy pesticide rows.
  - All sources cited are primary.
- Public interfaces
  - Rule content only.
- Edge cases / failure modes
  - Small explicit row set is not a failure if the official classification is narrow.
- Rollout & monitoring
  - Same as Draft A.
- Acceptance checks
  - Same as Draft A, focused on the loader spec.

### 6. Dependencies

- Same as Draft A.

### 7. Validation

- Same as Draft A.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `rules/japan/durian.yaml` | Rule repository reload | `src/modules/rules-engine/rule-definition.files.ts` | N/A |
| `rules/japan/durian-substances.csv` | YAML `substancesFile` load | `src/modules/rules-engine/rule-definition.files.ts` | N/A |

## Comparative Analysis & Synthesis

### Strengths

- Draft A is stronger on evidence and explicitly names the MAFF database result and JFCRF classification relationship.
- Draft B is stronger on keeping the implementation surface small and resisting unnecessary runtime churn.

### Gaps

- Draft A could over-specify test expansion beyond what is necessary for this pack.
- Draft B understates the need to explain why an exhaustive durian CSV can be much smaller than mango or Korea mango.

### Trade-offs

- Draft A optimizes for future reviewer clarity.
- Draft B optimizes for minimal code churn.

### Repo Compliance

- Both drafts follow the repo’s data-driven rules-engine pattern and avoid hardcoding MRLs in code.
- Both drafts preserve the existing loader/evaluator wiring and stay within TDD expectations.

## Unified Execution Plan

### 1. Overview

Finish `JAPAN/DURIAN` by replacing the current proxy/mixed rule pack with the actual durian-applicable Japan classification and MAFF import-condition result. The pack will become exhaustive and primary-source-backed while keeping the runtime implementation unchanged unless the source data demands otherwise.

### 2. Files to Change

- `rules/japan/durian.yaml` — set truthful source headers, promote to `FULL_EXHAUSTIVE`, set `PRIMARY_ONLY`, refresh retrieval date, set `commodityCode: 25839`, and encode required phytosanitary handling plus operational GAP note.
- `rules/japan/durian-substances.csv` — replace the 10 proxy rows with the explicit JFCRF row set for `その他の果実(アセロラを除く。)` as retrieved on `2026-04-04`.
- `src/modules/rules-engine/rule-loader.service.spec.ts` — assert the new metadata and explicit row content, including qualifier handling.
- `docs/PROGRESS.md` — mark `JAPAN/DURIAN` complete as the next exhaustive pack.
- `coding-logs/2026-04-04-17-50-23 Coding Log (japan-durian-exhaustive-completion).md` — append the TDD and validation evidence.

### 3. Implementation Steps

#### TDD sequence

1. Update `RuleLoaderService › loads the repository japan durian rule file` with the target metadata:
   - `coverageState: FULL_EXHAUSTIVE`
   - `sourceQuality: PRIMARY_ONLY`
   - `commodityCode: '25839'`
   - no `VHT Certificate`
   - explicit row count `1`
   - first row `GIBBERELLIN` with `destinationLimitType: PHYSIOLOGICAL_LEVEL`
2. Run the focused loader spec and capture the failing output against the current 10-row proxy pack.
3. Rewrite `rules/japan/durian.yaml` and `rules/japan/durian-substances.csv` to match the official sources.
4. Re-run the focused loader spec to green.
5. Run fast gates (`typecheck`, lint if needed), then update `docs/PROGRESS.md` and append the implementation summary.

#### Functions / behaviors

- `parseRuleSubstancesCsv()` will continue to parse `destinationLimitType`; no code change expected.
- `loadRuleDefinitionFromFile()` will continue to hydrate the durian pack from YAML + CSV; no wiring change expected.
- Durian lane evaluation will continue using the explicit specific row when present and the existing `defaultDestinationMrlMgKg: 0.01` fallback for all other unlisted substances.

#### Expected behavior and edge cases

- Japan durian’s exhaustive explicit row set is expected to be small because the durian-applicable commodity classification only exposes one special explicit row in JFCRF.
- The pack remains exhaustive because the explicit row set is complete for that classification and the positive-list fallback remains encoded.
- The `PHYSIOLOGICAL_LEVEL` qualifier must remain non-numeric; the evaluator already treats it as `UNKNOWN` rather than inventing a limit.

### 4. Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads the repository japan durian rule file` — exhaustive metadata, commodity code, no VHT, one explicit qualifier row.

### 5. Decision Completeness

- Goal
  - Make `JAPAN/DURIAN` the third completed exhaustive pack in the sequence.
- Non-goals
  - No frontend/admin changes.
  - No new evaluator behavior unless the durian source format breaks current support.
- Success criteria
  - Zero proxy pesticide rows remain in durian CSV.
  - YAML cites only primary sources.
  - Loader spec passes with the new metadata and row expectation.
  - Progress log records completion.
- Public interfaces
  - Rules payload content for `JAPAN/DURIAN` only.
  - No route, DTO, env, or schema changes.
- Edge cases / failure modes
  - If official source retrieval becomes inconsistent, fail closed by keeping loader assertions strict and documenting the evidence.
  - If the explicit row is non-numeric, preserve it via qualifier rather than coercion.
- Rollout & monitoring
  - No feature flag.
  - Backout is reverting the rule/test/doc change set.
  - Watch for downstream consumers assuming “exhaustive” implies a large explicit row count.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
  - `npm run typecheck`
  - lint only if touched files require it

### 6. Dependencies

- JFCRF `food_group_detail?id=25839` / Excel export for `その他の果実(アセロラを除く。)`.
- MAFF import-condition database result for `ドリアン (Durio zibethinus)` fresh fruit.

### 7. Validation

- Focused loader spec green.
- Backend typecheck green.
- Manual source cross-check:
  - JFCRF classification `25839` contains one explicit `ジベレリン` row with `※`.
  - MAFF import-condition DB reports `0` prohibited, `1` normal-inspection result, and `0` special Annex measures.

### 8. Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `rules/japan/durian.yaml` | Rule load / reload and lane snapshot creation | `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()` | N/A |
| `rules/japan/durian-substances.csv` | Loaded from durian YAML `substancesFile` | `src/modules/rules-engine/rule-definition.files.ts:parseRuleSubstancesCsv()` | N/A |
| Durian repository loader spec | Jest execution path | `src/modules/rules-engine/rule-loader.service.spec.ts` | N/A |


## Implementation (2026-04-04 18:05:28 ICT) - japan-durian-exhaustive-completion

- Goal: finish `JAPAN/DURIAN` as an exhaustive, truthful Japan rule pack backed by the actual durian-applicable commodity classification rather than Thai monitoring proxies.
- What changed:
  - `rules/japan/durian.yaml`
    - Replaced the old proxy-based source notes with the current MAFF import-condition database basis plus official positive-list references.
    - Promoted the pack from `PROXY_MIXED` to `FULL_EXHAUSTIVE`.
    - Refreshed `retrievedAt` / `effectiveDate` to `2026-04-04`.
    - Set `commodityCode: '25839'` for `その他の果実(アセロラを除く。)`.
    - Encoded the non-pesticide side as standard phytosanitary handling from the MAFF DB result: `0` prohibited, `1` normal-inspection result, `0` Annex 1-2 measures, `0` Annex 2-2 measures.
    - Kept `GAP_CERT` as an explicit ZRL operational baseline rather than a MAFF import condition.
  - `rules/japan/durian-substances.csv`
    - Replaced the previous 10 proxy/monitoring-driven pesticide rows with the exhaustive explicit JFCRF snapshot for the durian-applicable classification retrieved on `2026-04-04`.
    - The explicit row set is `1` row: `GIBBERELLIN` / `ジベレリン` with `destinationLimitType: PHYSIOLOGICAL_LEVEL`.
    - Preserved Japan's positive-list fallback truthfully by keeping the explicit row small and relying on `defaultDestinationMrlMgKg: 0.01` for unlisted pesticides.
  - `src/modules/rules-engine/rule-loader.service.spec.ts`
    - Tightened the repository durian assertions to the new exhaustive metadata, retrieval date, commodity code, missing VHT certificate, and the single qualifier row.
  - `docs/PROGRESS.md`
    - Recorded completion of `JAPAN/DURIAN` as the third exhaustive pack in the current sequence.
- TDD evidence:
  - Tests added/changed:
    - `RuleLoaderService › loads the repository japan durian rule file`
  - RED:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
    - Failure reason: the updated durian loader spec failed immediately because the repo still reported `coverageState: PROXY_MIXED` instead of the new exhaustive contract.
  - GREEN:
    - Command: `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`
- Tests run:
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts` ✅
  - `npm run typecheck` ✅
  - `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts` ✅
- Wiring verification evidence:
  - `rules/japan/durian.yaml` is still loaded through `src/modules/rules-engine/rule-definition.files.ts:loadRuleDefinitionFromFile()`.
  - `rules/japan/durian-substances.csv` is still wired through the YAML `substancesFile` path and parsed by `parseRuleSubstancesCsv()` in `src/modules/rules-engine/rule-definition.files.ts`.
  - Runtime evaluation for the small explicit row set remains covered by existing qualifier + fallback logic in `src/modules/rules-engine/rules-engine.service.ts`, with the repository-specific shape enforced by `rule-loader.service.spec.ts`.
- Behavior changes and risk notes:
  - The durian pack now tells the truth: exhaustive does not mean “many explicit rows”; it means the explicit row set is complete for the durian-applicable classification and the 0.01 mg/kg fallback covers everything else.
  - Source quality stays `PRIMARY_PLUS_SECONDARY`, not `PRIMARY_ONLY`, because the explicit pesticide surface still comes from JFCRF even though the import-condition side is primary MAFF.
  - Residual risk: downstream readers may assume a one-row exhaustive CSV is suspicious; the YAML/CSV comments now explain why that is the correct official result.
- Follow-ups / known gaps:
  - `JAPAN/MANGOSTEEN` is the next pack in sequence.
  - If we want stronger reviewer confidence later, add a durian-specific `RulesEngineService` smoke that combines the `GIBBERELLIN` qualifier with an unlisted pesticide fallback in one snapshot.

## Review (2026-04-04 18:05:28 ICT) - working-tree (Japan durian pack scope)

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working tree (`rules/japan/durian.yaml`, `rules/japan/durian-substances.csv`, `src/modules/rules-engine/rule-loader.service.spec.ts`, `docs/PROGRESS.md`)
- Commands Run: `git status --porcelain=v1`; `git diff --name-only -- rules/japan/durian.yaml rules/japan/durian-substances.csv src/modules/rules-engine/rule-loader.service.spec.ts docs/PROGRESS.md`; `git diff -- rules/japan/durian.yaml rules/japan/durian-substances.csv src/modules/rules-engine/rule-loader.service.spec.ts docs/PROGRESS.md`; `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts`; `npm run typecheck`; `npx eslint src/modules/rules-engine/rule-loader.service.spec.ts`

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
- Assumed the MAFF import-condition database result with `all countries` applicability is sufficient for the Japan-side non-pesticide basis without a Thailand-specific carve-out.
- Assumed the more specific JFCRF bucket `25839` supersedes the broad parent `11900` for durian because the parent bucket lists durian by name and the child bucket narrows that same family by excluding only acerola.

### Recommended Tests / Validation
- Existing focused loader spec is sufficient for this change set.
- Optional future hardening: add a durian-specific `RulesEngineService` evaluation test covering one `GIBBERELLIN` result plus one unlisted pesticide result.

### Rollout Notes
- No API, schema, or migration changes.
- Backout is reverting the durian YAML/CSV/spec/docs slice only.
- Main operational caveat is interpretive, not technical: reviewers should expect a one-row explicit CSV because the rule pack relies on the existing 0.01 mg/kg fallback for all other pesticides.
