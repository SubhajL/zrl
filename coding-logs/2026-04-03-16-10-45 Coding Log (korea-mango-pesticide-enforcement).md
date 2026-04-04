# Korea Mango Pesticide Enforcement

## Plan Draft A

### Overview

Implement source-backed Korea mango pesticide enforcement by extending the existing rules-engine snapshot model with a `labPolicy`, converting Korea mango from document-only support to destination-MRL enforcement, and loading the official MFDS mango pesticide list into `rules/korea/mango-substances.csv`. To stay accurate, destination MRL enforcement will be mandatory while Thai-comparison metadata becomes optional for rule-file substances when no Thai primary source is in scope for this task.

### Files To Change

- `rules/korea/mango.yaml`
  - Keep QIA import-condition documents and add Korea pesticide enforcement policy.
- `rules/korea/mango-substances.csv`
  - Replace the header-only placeholder with MFDS-backed mango pesticide rows.
- `src/modules/rules-engine/rules-engine.types.ts`
  - Add `labPolicy`, richer lab result statuses, optional Thai-comparison metadata, aliases, and fallback metadata.
- `src/modules/rules-engine/rules-engine.utils.ts`
  - Parse/validate the new rule schema with fail-closed defaults.
- `src/modules/rules-engine/rule-definition.files.ts`
  - Support enriched CSV columns and optional fields.
- `src/modules/rules-engine/rules-engine.service.ts`
  - Enforce `FULL_PESTICIDE` policy, Korea `0.01 mg/kg` fallback, alias matching, and blocking reasons.
- `src/modules/rules-engine/rules-engine.pg-store.ts`
  - Persist nullable Thai-comparison metadata for source-accurate rule imports.
- `prisma/schema.prisma`
  - Make `substances` Thai-comparison metadata nullable if needed by the source-backed design.
- `prisma/migrations/<new>`
  - Apply nullable-column change for `thai_mrl`, `stringency_ratio`, and `risk_level` if needed.
- `prisma/seed.ts`
  - Keep seed compatibility with the adjusted schema.
- `src/modules/evidence/evidence.service.ts`
  - Normalize MRL payload rows, require supported units, and preserve reporting metadata.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - Add repository tests for Korea mango policy and enriched CSV parsing.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - Add evaluation tests for fallback/default MRL enforcement and fail-closed behavior.
- `src/modules/evidence/evidence.service.spec.ts`
  - Add upload normalization and rejection tests for unsupported units.
- `test/rules-engine.e2e-spec.ts`
  - Add API-level smoke for enriched snapshot/evaluation payloads.
- `frontend/src/lib/types.ts`
  - Accept nullable Thai-comparison metadata in rule payloads.
- `frontend/src/lib/rules-data.ts`
  - Preserve nullable values without breaking admin display.
- `frontend/src/app/(app)/admin/rules/page.tsx`
  - Render blank/placeholder when Thai-comparison data is absent.
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - Lock the updated nullable display contract.

### Implementation Steps

1. TDD sequence
   1. Add rule-loader tests for `labPolicy`, aliases, and nullable Thai-comparison fields.
   2. Add rules-engine tests for Korea fallback enforcement, required `MRL_TEST`, unknown substance handling, and missing threshold behavior.
   3. Add evidence upload tests for lab-row normalization and unsupported-unit rejection.
   4. Run tests and confirm failures for the intended reasons.
   5. Implement parser/type/service/store changes.
   6. Re-run focused tests, then lint, typecheck, build, and e2e.
2. Extend the rule schema.
   - Add `labPolicy` to `RuleDefinitionSource` and `RuleSnapshotPayload`.
   - Add optional `aliases`, `sourceRef`, `note`, and nullable `thaiMrl`/`stringencyRatio`/`riskLevel` support.
3. Implement fail-closed evaluation semantics.
   - `FULL_PESTICIDE` rules must block on missing/unsupported data.
   - If Korea provides no specific mango MRL for a measured pesticide, apply official default `0.01 mg/kg`.
4. Normalize lab uploads.
   - Accept `mg/kg` and `ppm` only.
   - Convert to canonical `valueMgKg`.
   - Reject unsupported units and malformed rows before persistence.
5. Populate Korea mango data.
   - Use official MFDS mango code `ap105050006`.
   - Load the official mango list from `foodView.do`.
   - Use official MFDS pesticide info endpoint `infoView.do` for `casNum` when available.
   - Preserve source comments showing QIA and MFDS evidence paths.
6. Adjust persistence/UI for nullable Thai-comparison metadata.
   - Keep enforcement accurate even when Thai comparator values are unavailable from this task’s primary-source set.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads repository korea mango pesticide policy`
  - `loads csv rows with aliases and nullable thai mrl`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `evaluateLane fails closed when korea policy requires pesticide evidence`
  - `evaluateLane applies korea default 0.01 mg/kg when no specific row exists`
  - `evaluateLane uses specific mango threshold before fallback`
  - `evaluateLane matches by alias and cas when present`
  - `evaluateLane blocks on unsupported lab row units`
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact normalizes ppm rows to mg/kg`
  - `uploadArtifact rejects unsupported mrl units`
- `test/rules-engine.e2e-spec.ts`
  - `GET ruleset returns korea mango lab policy`
  - `evaluation payload includes blocking reasons`
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - `renders dash for missing thai comparator metadata`

### Decision Completeness

- Goal
  - Make `KOREA/MANGO` a fully pesticide-enforced market/product pair using official Korea sources.
- Non-goals
  - No runtime scraping.
  - No OCR/PDF extraction.
  - No broader Korea market rollout beyond mango in this batch.
- Success criteria
  - `rules/korea/mango.yaml` declares pesticide enforcement.
  - `rules/korea/mango-substances.csv` contains official MFDS mango rows.
  - Evaluation blocks when pesticide evidence is missing or invalid.
  - Specific Korea mango MRLs are enforced when present.
  - Official Korea fallback `0.01 mg/kg` is used only when no specific row exists.
- Public interfaces
  - Expanded rule YAML/CSV schema.
  - Expanded snapshot/evaluation payload types.
  - Potential DB migration for nullable comparator metadata.
- Edge cases / failure modes
  - Missing `MRL_TEST` artifact under `FULL_PESTICIDE`: fail closed.
  - Unsupported unit: reject upload.
  - Missing CAS but exact/alias name present: evaluate by name/alias.
  - Specific mango row exists: use that row, never fallback.
  - No specific mango row exists: use official `0.01 mg/kg` default.
- Rollout & monitoring
  - Additive rollout on `KOREA/MANGO` only.
  - Backout by reverting the `labPolicy` to document-only and restoring the placeholder CSV.
  - Watch upload rejections and blocked lab validations.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/rules-engine.e2e-spec.ts`
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`
  - `npm run lint && npm run typecheck && npm run build`
  - `cd frontend && npm run lint && npm run typecheck`

### Dependencies

- Official QIA page for Thai mango import conditions.
- Official QIA 2024-2025 Thai mango orchard/packinghouse list.
- Official MFDS food autocomplete endpoint for mango code.
- Official MFDS `foodView.do` endpoint for mango Korea MRL rows.
- Official MFDS `infoView.do` endpoint for per-pesticide `casNum`.

### Validation

- Focused unit tests prove parser and evaluator behavior.
- E2E proves enriched rule snapshot shape and blocking semantics.
- Frontend tests prove nullable comparator metadata does not break rule display.

### Wiring Verification

| Component                               | Entry Point                                                     | Registration Location                                    | Schema/Table                                                                  |
| --------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `labPolicy` in `rules/korea/mango.yaml` | `RulesEngineService.getRuleSnapshot()` -> `evaluateLane()`      | auto-loaded via `loadRuleDefinitionFromFile()`           | `lane_rule_snapshots.rules` JSON                                              |
| Korea mango CSV rows                    | `loadRuleDefinitionFromFile()`                                  | declared by `substancesFile` in `rules/korea/mango.yaml` | `lane_rule_snapshots.rules.substances`; `substances` table sync               |
| Upload normalization                    | `EvidenceService.uploadArtifact()` -> `buildArtifactMetadata()` | existing evidence module wiring                          | `evidence_artifacts.metadata` JSON                                            |
| Nullable comparator metadata migration  | Prisma migration at app boot/deploy                             | `prisma migrate deploy`                                  | `substances.thai_mrl`, `substances.stringency_ratio`, `substances.risk_level` |
| Admin UI nullable display               | rules admin page fetch/render flow                              | existing frontend route wiring                           | response payload only                                                         |

## Plan Draft B

### Overview

Keep the database schema unchanged and implement Korea mango enforcement without nullable comparator changes by storing MFDS rows with destination limits only in the lane snapshot while skipping sync into the shared `substances` table for repository-loaded definitions that lack Thai-comparison metadata. This reduces migration scope but creates a split between snapshot truth and the admin list/store.

### Files To Change

- `rules/korea/mango.yaml`
- `rules/korea/mango-substances.csv`
- `src/modules/rules-engine/rules-engine.types.ts`
- `src/modules/rules-engine/rules-engine.utils.ts`
- `src/modules/rules-engine/rule-definition.files.ts`
- `src/modules/rules-engine/rules-engine.service.ts`
- `src/modules/rules-engine/rules-engine.pg-store.ts`
  - special-case sync skipping for comparator-incomplete rows
- `src/modules/evidence/evidence.service.ts`
- focused tests

### Implementation Steps

1. Add policy and CSV parsing.
2. Evaluate against snapshot rows only.
3. Skip shared-substances-table sync for comparator-incomplete imported rows.
4. Keep admin market substances view limited to fully comparable rows.

### Test Coverage

- `rules-engine.service.spec.ts`
  - `evaluateLane uses snapshot-only korea rows`
- `rules-engine.pg-store.spec.ts`
  - `syncRuleDefinition skips comparator-incomplete rows`

### Decision Completeness

- Goal
  - Ship Korea mango enforcement with fewer schema changes.
- Non-goals
  - No admin-side comparator completeness for Korea rows.
- Success criteria
  - Lane evaluation works from snapshots.
- Public interfaces
  - Rule schema expands, DB schema unchanged.
- Edge cases / failure modes
  - Admin substances list may not reflect repository rows.
- Rollout & monitoring
  - Lower migration risk, higher model inconsistency risk.
- Acceptance checks
  - same focused tests as Draft A, excluding migration

### Dependencies

- Same official source set as Draft A.

### Validation

- Snapshot/evaluation tests plus targeted store tests.

### Wiring Verification

| Component                | Entry Point              | Registration Location                                | Schema/Table                          |
| ------------------------ | ------------------------ | ---------------------------------------------------- | ------------------------------------- |
| Snapshot-only Korea rows | `evaluateLane()` callers | `RuleLoaderService` + existing lane snapshot storage | `lane_rule_snapshots.rules` JSON only |
| Sync skip branch         | `syncRuleDefinition()`   | `RulesEnginePgStore`                                 | `substances` table unchanged          |

## Comparative Analysis & Synthesis

### Strengths

- Draft A keeps the model honest: repository-loaded rule substances, persisted substances, and frontend types all represent the same source-backed truth.
- Draft B reduces migration work.

### Gaps

- Draft B introduces an avoidable split-brain state between snapshots and the shared substances store.
- Draft A requires a small but real schema/type migration.

### Trade-Offs

- Draft A is more work, but more coherent and easier to reason about long-term.
- Draft B is faster, but the admin rules surface becomes misleading for Korea mango.

### Compliance

- Draft A better follows the repo’s “explicit rules” principle and avoids hidden special cases.
- Both drafts respect the existing rule-loader and lane-snapshot architecture.

## Unified Execution Plan

### Overview

Implement Korea mango pesticide enforcement by keeping QIA import-condition documents in the YAML, adding an explicit Korea `labPolicy`, loading the official MFDS mango pesticide list into the rule CSV, and enforcing specific Korea mango MRLs plus the official `0.01 mg/kg` default fallback. To stay source-accurate, Thai comparator metadata becomes optional across the rules-engine substance model instead of being invented where no Thai source is part of this task.

### Files To Change

- `rules/korea/mango.yaml`
  - Add `labPolicy` with `FULL_PESTICIDE` enforcement and Korea fallback metadata.
- `rules/korea/mango-substances.csv`
  - Replace placeholder with MFDS-backed mango pesticide rows.
- `src/modules/rules-engine/rules-engine.types.ts`
  - Add `labPolicy`, optional comparator metadata, aliases, notes, fallback metadata, and richer evaluation statuses.
- `src/modules/rules-engine/rules-engine.utils.ts`
  - Parse new schema and validate fail-closed defaults.
- `src/modules/rules-engine/rule-definition.files.ts`
  - Parse enriched CSV columns and optional values.
- `src/modules/rules-engine/rules-engine.service.ts`
  - Enforce Korea mango specific-vs-fallback logic and blocking reasons.
- `src/modules/evidence/evidence.service.ts`
  - Normalize and validate MRL rows at upload time.
- `src/modules/rules-engine/rules-engine.pg-store.ts`
  - Persist nullable comparator metadata consistently.
- `prisma/schema.prisma`
  - Make `substances.cas`, `thaiMrl`, `stringencyRatio`, and `riskLevel` nullable only if source-backed data requires it.
- `prisma/migrations/<new>`
  - Apply the corresponding nullable-column change.
- `prisma/seed.ts`
  - Keep seeds working with nullable comparator metadata.
- `frontend/src/lib/types.ts`
  - Reflect nullable comparator metadata.
- `frontend/src/lib/rules-data.ts`
  - Preserve optional values.
- `frontend/src/app/(app)/admin/rules/page.tsx`
  - Render nullable comparator values safely.
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - Lock UI behavior.
- `src/modules/rules-engine/rule-loader.service.spec.ts`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `test/rules-engine.e2e-spec.ts`

### Implementation Steps

1. TDD sequence
   1. Add loader tests for `labPolicy`, enriched CSV rows, and nullable comparator fields.
   2. Add evaluator tests for:
      - required pesticide evidence
      - specific Korea mango threshold precedence
      - official `0.01 mg/kg` fallback
      - unsupported units
      - alias/name matching
   3. Add evidence upload tests for canonical `mg/kg` normalization.
   4. Add frontend rule-admin display test for nullable comparator values.
   5. Run the new tests to capture RED failures.
   6. Implement the smallest code changes to pass.
   7. Run focused tests, then lint/typecheck/build.
2. Research-backed data preparation
   - Use official mango food code `ap105050006`.
   - Pull official Korea mango `krList` rows from `foodView.do`.
   - Pull per-pesticide `casNum` from `infoView.do` when available.
   - Strip MFDS markup like `<sup>†</sup>`, `<sup>T</sup>`, and `(E)` down to numeric enforcement values while preserving source note metadata when useful.
3. Schema and parser work
   - Add `labPolicy` and optional comparator metadata.
   - Allow CSV rows to carry:
     - `name`
     - `aliases`
     - `cas`
     - `thaiMrl`
     - `destinationMrl`
     - `sourceRef`
     - `note`
4. Enforcement logic
   - `FULL_PESTICIDE` requires a usable `MRL_TEST`.
   - If a measured pesticide matches a specific Korea mango row, use that specific limit.
   - If no specific Korea mango row exists, apply official default `0.01 mg/kg`.
   - Missing/unsupported measurement data blocks validation.
5. Upload normalization
   - Accept `mg/kg` and `ppm` only.
   - Convert `ppm` to `mg/kg` equivalently.
   - Preserve original unit and reporting metadata.
6. Persistence/UI alignment
   - Make comparator metadata optional end-to-end rather than storing guessed Thai values.
   - Render missing comparator values as blank/`-` in admin surfaces.

### Test Coverage

- `src/modules/rules-engine/rule-loader.service.spec.ts`
  - `loads repository korea mango lab policy`
  - `loads korea mango csv with nullable thai comparator fields`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `evaluateLane blocks when korea mango full pesticide evidence is missing`
  - `evaluateLane uses specific korea mango mrl before fallback`
  - `evaluateLane applies official korea default mrl for unmapped pesticide`
  - `evaluateLane rejects unsupported units`
  - `evaluateLane matches aliases and optional cas`
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact canonicalizes mrl rows to valueMgKg`
  - `uploadArtifact rejects unsupported pesticide result units`
- `test/rules-engine.e2e-spec.ts`
  - `GET ruleset returns korea mango lab policy and fallback metadata`
  - `lane evaluation exposes pesticide blocking reasons`
- `frontend/src/app/(app)/admin/rules/page.test.tsx`
  - `renders missing thai comparator cells safely`

### Decision Completeness

- Goal
  - Fully enforce `KOREA/MANGO` pesticide compliance using official Korea sources.
- Non-goals
  - No runtime scraping or scheduled rule auto-refresh.
  - No broader market rollout beyond Korea mango.
  - No attempt to infer Thai comparator values without primary-source backing.
- Success criteria
  - Korea mango has a real `labPolicy`.
  - Official MFDS mango MRL rows are on disk in the rule CSV.
  - Lane evaluation blocks on missing/invalid pesticide evidence.
  - Specific Korea mango MRLs are enforced first; `0.01 mg/kg` fallback is used only when no specific row exists.
  - UI/tests remain green with optional comparator metadata.
- Public interfaces
  - Expanded rule YAML/CSV schema.
  - Expanded rule snapshot/evaluation payload.
  - DB migration to nullable comparator metadata if required by implementation.
- Edge cases / failure modes
  - `MRL_TEST` absent under full policy: fail closed.
  - Specific row absent: apply `0.01 mg/kg` fallback.
  - Specific row present with markup note: enforce numeric base value.
  - Unsupported unit: reject upload.
  - Comparator data absent: allowed, display as missing, not guessed.
- Rollout & monitoring
  - Additive rollout on `KOREA/MANGO`.
  - Backout by reverting YAML policy and CSV.
  - Watch blocked validations and evidence upload rejection messages.
- Acceptance checks
  - `npm test -- --runInBand src/modules/rules-engine/rule-loader.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/rules-engine.e2e-spec.ts`
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run typecheck`

### Dependencies

- QIA fruit import conditions: `https://www.qia.go.kr/plant/imQua/plant_fruit_cond.jsp`
- QIA 2024-2025 Thai mango list: `https://www.qia.go.kr/viewwebQiaCom.do?id=63979&type=3_79afph`
- MFDS food autocomplete endpoint: `/residue/ajax/mrls/autoComplete.do`
- MFDS food MRL endpoint: `/residue/ajax/mrls/foodView.do?code=ap105050006`
- MFDS pesticide info endpoint: `/residue/ajax/prd/infoView.do?pesticideCode=<code>`
- MFDS default MRL rule page: `https://www.foodsafetykorea.go.kr/residue/prd/mrls/list.do`

### Validation

- Focused unit tests prove parser, upload normalization, and enforcement logic.
- Rules e2e confirms the public payload exposes enough detail for backend/frontend consumers.
- Frontend test confirms nullable comparator metadata is safe to display.

### Wiring Verification

| Component                                        | Entry Point                                                                  | Registration Location                                                  | Schema/Table                                                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `rules/korea/mango.yaml` `labPolicy`             | `RulesEngineService.getRuleSnapshot()` and all lane evaluation callers       | auto-loaded by `RuleLoaderService`                                     | `lane_rule_snapshots.rules` JSON                                                                |
| `rules/korea/mango-substances.csv` official rows | `loadRuleDefinitionFromFile()` -> `syncRuleDefinition()` -> `evaluateLane()` | `substancesFile` in the YAML and `RulesEnginePgStore.syncSubstances()` | `substances` table and `lane_rule_snapshots.rules.substances`                                   |
| Upload normalization in `EvidenceService`        | `uploadArtifact()` path for `MRL_TEST` artifacts                             | existing evidence module                                               | `evidence_artifacts.metadata` JSON                                                              |
| Nullable comparator metadata migration           | Prisma migration at deploy/test setup time                                   | `prisma migrate deploy` / test DB boot                                 | `substances.cas`, `substances.thai_mrl`, `substances.stringency_ratio`, `substances.risk_level` |
| Frontend nullable display                        | admin rules page data rendering                                              | existing route/component wiring                                        | response payload only                                                                           |

### Notes

- Auggie semantic search unavailable (`HTTP 429`); the plan is based on direct file inspection and official-source research.
- Inspected files: `src/modules/rules-engine/CLAUDE.md`, `src/modules/rules-engine/rules-engine.types.ts`, `src/modules/rules-engine/rules-engine.utils.ts`, `src/modules/rules-engine/rule-definition.files.ts`, `src/modules/rules-engine/rules-engine.service.ts`, `src/modules/rules-engine/rules-engine.pg-store.ts`, `src/modules/evidence/evidence.service.ts`, `src/modules/evidence/evidence.controller.ts`, `frontend/src/lib/types.ts`, `frontend/src/lib/rules-data.ts`, `frontend/src/app/(app)/admin/rules/page.tsx`, `prisma/schema.prisma`, `prisma/migrations/20260322142000_add_rules_engine_store/migration.sql`.
- Official-source findings locked for implementation:
  - QIA requires Thai mango vapor-heat treatment at `47°C` or above for `20 minutes` plus registration and overseas inspection.
  - QIA published the Thailand mango 2024-2025 orchard/packinghouse list on `2024-09-19`.
  - MFDS mango food code is `ap105050006`.
  - MFDS currently returns `64` Korea MRL rows for mango.
  - MFDS states the default agricultural pesticide MRL is `0.01 mg/kg` when no specific limit is set.

## 2026-04-03 17:00 ICT — Implementation Session

- Goal: Complete Korea mango pesticide enforcement implementation left unfinished from prior session
- What changed:
  - `rules/korea/mango.yaml` — added `labPolicy` block with `FULL_PESTICIDE` enforcement mode and `defaultDestinationMrlMgKg: 0.01`
  - `rules/korea/mango-substances.csv` — populated with 64 official MFDS mango pesticide rows (food code `ap105050006`), CAS numbers from `infoView.do`, Korean aliases, source references
  - `src/modules/rules-engine/rules-engine.types.ts` — added `RuleLabPolicy`, `RuleLabEnforcementMode`, `RuleLabValidationStatus`, `RuleLabLimitSource`; made `cas`, `thaiMrl`, `stringencyRatio`, `riskLevel` nullable on `RuleSubstanceDefinition` and `RuleSubstanceRecord`; added `labPolicy` to `RuleSetDefinition`/`RuleSnapshotPayload`; added `blockingReasons`, `status`, `limitSource` to lab validation result types
  - `src/modules/rules-engine/rules-engine.utils.ts` — extended `buildRuleDefinition` to parse `labPolicy`, aliases, nullable Thai comparator fields, sourceRef, note
  - `src/modules/rules-engine/rule-definition.files.ts` — relaxed CSV required headers to `['name', 'destinationMrl']`; added parsing for aliases (pipe-delimited), nullable cas/thaiMrl, sourceRef, note
  - `src/modules/rules-engine/rules-engine.service.ts` — `buildLabValidation` now supports `FULL_PESTICIDE` enforcement (blocks on missing MRL_TEST), alias matching via `findMeasuredResult`, specific-vs-default-fallback logic, `limitSource` tracking, `blockingReasons`
  - `src/modules/evidence/evidence.service.ts` — added `normalizeMrlTestResults` for ppm→mg/kg canonicalization and unsupported unit rejection in `buildArtifactMetadata`
  - `src/modules/rules-engine/rules-engine.pg-store.ts` — updated `SubstanceRow` and `mapSubstance` for nullable fields; updated `bumpRuleVersionsForMarket` to include `aliases`/`sourceRef`/`note` defaults; guarded `computeStringencyRatio` against null thaiMrl in `updateSubstance`
  - `prisma/schema.prisma` — made `cas`, `thaiMrl`, `stringencyRatio`, `riskLevel` nullable on `Substance` model
  - `prisma/migrations/20260403160000_nullable_substance_comparator_fields/migration.sql` — `ALTER COLUMN ... DROP NOT NULL` for four columns
  - `src/modules/lane/lane.types.ts` — added `labPolicy` and nullable substance fields to `LaneRuleSnapshot` and `LaneRuleSnapshotPayload`
  - `src/modules/lane/lane.service.ts` — wired `labPolicy` and substance field defaults through snapshot adapter
  - `src/modules/evidence/evidence.controller.ts` — same snapshot adapter wiring
  - `frontend/src/lib/types.ts` — made `MrlSubstance.thaiMrl`, `stringencyRatio`, `riskLevel` nullable
  - `frontend/src/app/(app)/admin/rules/page.tsx` — updated column renderers to show `-` for null comparator values
  - `frontend/src/app/(app)/admin/rules/page.test.tsx` — added test for nullable comparator display
  - `src/modules/rules-engine/rule-loader.service.spec.ts` — added tests for Korea mango labPolicy and enriched CSV parsing
  - `src/modules/rules-engine/rules-engine.service.spec.ts` — added tests for FULL_PESTICIDE blocking, specific-vs-fallback enforcement, alias matching; fixed existing test fixtures for `aliases`/`sourceRef`/`note`
  - `src/modules/evidence/evidence.service.spec.ts` — added tests for ppm→mg/kg normalization and unsupported unit rejection
  - `test/rules-engine.e2e-spec.ts` — added Korea mango e2e test for labPolicy and nullable substance serialization
- TDD evidence:
  - RED: 4 backend + 1 frontend test failures confirmed before implementation
  - GREEN: all 339 backend + 3 frontend tests pass after implementation, 3x stable
  - e2e: 7/7 pass with mocked services + real DB init
- Tests run and results:
  - `npm test`: 339 passed, 9 skipped, 0 failed (3x consistent)
  - `cd frontend && npm test -- page.test.tsx`: 3 passed (3x consistent)
  - `npx jest --config ./test/jest-e2e.json test/rules-engine.e2e-spec.ts`: 7 passed
  - `npm run typecheck`: 0 errors
  - `npm run lint`: 0 errors
  - `npm run build`: success (backend NestJS + frontend Next.js)
  - `cd frontend && npx tsc --noEmit && npm run lint`: clean
- g-check review: No CRITICAL/HIGH findings. MEDIUM: snapshot adapter pattern duplicated in 2 locations (acceptable). LOW: Korean notation in CSV notes column (informational only).
- Behavior changes and risk notes:
  - Korea mango lanes now get `FULL_PESTICIDE` enforcement — missing MRL_TEST artifacts block validation
  - Unmapped pesticides evaluated against official Korea fallback `0.01 mg/kg`
  - Existing Japan/China lanes unaffected (no labPolicy = DOCUMENT_ONLY behavior preserved)
  - Migration must run before app deploy (nullable columns required for MFDS data with no Thai comparators)
- Follow-ups / known gaps:
  - No live-DB e2e test (e2e is mocked at service layer, but unit tests cover enforcement logic end-to-end)
  - Admin substances API still requires non-nullable `cas`/`thaiMrl` via `RuleSubstanceInput` — intentional for manual admin entries
  - Other Korea products (mangosteen, durian, longan) not yet implemented

## Review (2026-04-04 11:14 +07) - system

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: rules-engine market-rule precision review (Japan x4, Korea mango)
- Commands Run: git rev-parse --show-toplevel; git branch --show-current; git status --porcelain=v1; git log -n 10 --oneline --decorate; git log/blame on rule files; focused rule-loader Jest run; direct reads of rules/_.yaml, rules/_-substances.csv, rule-loader/rules-engine/frontend harness files, docs/PROGRESS.md, coding logs
- Sources: AGENTS.md; rules/AGENTS.md; src/AGENTS.md; test/AGENTS.md; docs/PROGRESS.md; src/modules/rules-engine/rule-loader.service.spec.ts; frontend/src/lib/testing/lane-creation-scenarios.ts; frontend/e2e/lane-creation-matrix.spec.ts; coding-logs for Korea mango + Japan mango/durian/mangosteen/longan

### High-Level Assessment

- The implemented market-rule surface is real and runtime-relevant, not just planned. The repo currently supports six on-disk YAML rule packs: EU/MANGO, JAPAN/MANGO, JAPAN/DURIAN, JAPAN/MANGOSTEEN, JAPAN/LONGAN, and KOREA/MANGO.
- The live frontend matrix derives support from actual rule-file existence, so these pairs directly affect runtime test behavior.
- Precision is uneven across the five reviewed combinations. KOREA/MANGO is the closest to an official, commodity-specific, threshold-backed pack because it carries 64 MFDS mango rows with explicit source annotations and dedicated enforcement logic.
- The Japan packs are implemented and tested, but several of their own logs and CSV headers acknowledge curated subsets, proxy thresholds, or secondary-source operational claims. They are good operational rule packs, not yet 100% exhaustive regulatory datasets.
- Repo traceability is also slightly inconsistent: git history supports PR mapping for Japan #67/#68/#69/#71, but the KOREA/MANGO PR number is not cleanly represented by commit metadata even though the file history points to commit/PR #66.

### Strengths

- Runtime rule loading is backed by repository YAML/CSV files and covered by focused loader tests.
- The frontend live-scenario harness uses actual on-disk rule support instead of a hardcoded allowlist.
- Korea mango enforcement includes explicit fallback/default-limit semantics and nullable comparator handling instead of inventing Thai values.
- Japan x4 packs capture the main document-policy split correctly at a high level: mango/longan include VHT, durian/mangosteen do not.

### Key Risks / Gaps (severity ordered)

HIGH

- Japan durian thresholds are not exact commodity-specific Japan limits yet. rules/japan/durian-substances.csv explicitly says Japan MRLs use a mango proxy where durian-specific JFCRF values are unverifiable. Impact: the current numeric checks may reject or allow based on proxy values rather than exact durian entries.
- Japan mangosteen thresholds are not exact commodity-specific Japan limits yet. rules/japan/mangosteen-substances.csv uses multiple “Japan mango MRL proxy” rows, and rules/japan/mangosteen.yaml cites FreshPlaza for the VHT exemption path instead of a primary Japanese government notice. Impact: both pesticide precision and quarantine-proof provenance are short of “100% correct”.
- Japan longan operational policy is not fully primary-source grounded. rules/japan/longan.yaml uses an academic host-status paper plus a study article, but the repo does not cite a primary MAFF/MHLW import-condition page for Thai longan VHT. Several numeric rows also appear to rely on mango proxy values. Impact: the “VHT required” conclusion is plausible, but not yet documented to primary-source standard inside the rule pack.

MEDIUM

- Japan mango is implemented and internally consistent, but its own log says the 12 rows are only the highest-risk substances and not the full Japan mango MRL list. Impact: “FULL_PESTICIDE” in code is exhaustive only relative to the curated file, not exhaustive relative to the full commodity database.
- KOREA/MANGO is strongest on numeric precision, but rules/korea/mango.yaml still contains stale note text saying the official database did not expose stable commodity-level values and that substances were deferred, while the companion CSV now contains 64 populated rows. Impact: source comments and actual data state have drifted, which weakens reviewer confidence.
- PR traceability for KOREA/MANGO is muddy. git log for rules/korea/mango.yaml points to commit 4feea6e / PR #66, but the commit message is “remove EU mango test that references uncommitted rule files”, not a Korea mango enforcement description. Impact: auditability of the user-facing PR mapping table is weaker than for Japan #67/#68/#69/#71.
- docs/PROGRESS.md has not been updated with the April 3 rule-authoring batch, so the codebase and human progress log are out of sync for this workstream.

LOW

- rules/AGENTS.md current-state text is stale; it omits several now-present rule files.
- The current coding-log pointer still targets the Korea mango log only, even though the broader rule-authoring batch spans multiple later logs.

### Nit-Picks / Nitty Gritty

- JAPAN/MANGO lacks source-comment headers in YAML while the later Japan files include them. This is a documentation consistency gap, not a runtime bug.
- “FULL_PESTICIDE” overstates certainty when the backing CSV is knowingly curated or proxy-based. The engine behavior is fine; the naming/metadata layer is what over-claims exhaustiveness.
- The table PR mapping should be generated from git history or a release manifest instead of maintained manually.

### Tactical Improvements (1–3 days)

1. Add a per-rule metadata block such as `coverage: FULL_OFFICIAL | CURATED_HIGH_RISK | PROXY_MIXED` and `sourceQuality: PRIMARY_ONLY | PRIMARY_PLUS_SECONDARY` to every YAML pack.
2. Fix the stale Korea mango YAML comments so the file accurately describes the now-populated 64-row MFDS CSV.
3. Update docs/PROGRESS.md with the April 3 rule-authoring batch and note the exact implemented combos.
4. Add a small manifest file mapping market/product packs to commit SHA and PR number so tables like the user’s can be generated instead of hand-maintained.

### Strategic Improvements (1–6 weeks)

1. Build a commodity-specific evidence capture workflow for each rule pack: archived source URL, retrieval date, commodity code, screenshot/HTML snapshot, parser version, and reviewer signoff.
2. Split regulatory-document policy from pesticide-threshold completeness. A pack should be able to be “operationally supported” while still marked “threshold coverage partial”.
3. Create a reproducible extraction pipeline for official commodity MRL tables, including regression tests that compare row counts and hashes against checked-in CSV outputs.
4. Add exhaustive cross-check tests that fail if a rule pack contains proxy-derived rows without explicit `limitSource=PROXY` metadata.

### Big Architectural Changes (only if justified)

- Proposal: promote rule packs from plain YAML/CSV to a provenance-aware rule registry with pack metadata, source artifacts, extraction manifests, and coverage states.
  - Pros:
    - makes “100% correct and exhaustive” measurable instead of implied
    - separates operational readiness from regulatory completeness
    - improves auditability for future compliance reviews
  - Cons:
    - more authoring overhead
    - requires schema/API updates for metadata exposure
  - Migration Plan:
    - add optional metadata fields first
    - backfill existing six packs without changing enforcement behavior
    - make UI/tests surface coverage state
    - later require metadata for new packs only
  - Tests/Rollout:
    - loader tests for new metadata
    - fixture validation on every rule pack
    - no enforcement-path change until metadata adoption is complete

### Open Questions / Assumptions

- Assumed the review target is current repository truth, not external regulatory truth beyond what is cited in the repo.
- Assumed the user’s “100% correct and exhaustive” standard means primary-source, commodity-specific, no proxy thresholds, and complete published MRL coverage for the commodity.


## Review (2026-04-04 17:34 ICT) - working-tree korea-mango admin sync scope

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: working tree, limited to `frontend/src/app/(app)/admin/rules/page.test.tsx` and `coding-logs/2026-04-03-16-10-45 Coding Log (korea-mango-pesticide-enforcement).md`
- Commit SHA reviewed against: `e47940f`
- Commands Run:
  - `git diff -- 'frontend/src/app/(app)/admin/rules/page.test.tsx' 'coding-logs/2026-04-03-16-10-45 Coding Log (korea-mango-pesticide-enforcement).md'`
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/admin/rules/page.test.tsx'`
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

- Assumed this PR is intentionally limited to test/log sync for the already-merged Korea mango metadata refresh.

### Recommended Tests / Validation

- None beyond the focused admin rules page test and standard frontend lint already run for this small sync.

### Rollout Notes

- Test/docs-only sync.
- No runtime behavior change.
