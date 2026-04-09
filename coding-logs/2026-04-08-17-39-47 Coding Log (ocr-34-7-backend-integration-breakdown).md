# Coding Log

## Plan Draft A

### Overview

Define an exact backend-only decomposition for Task `34.7` so the OCR integration work proceeds in small, auditable slices without drifting into the broader `34.9` readiness program. The repo already completed fixture corpus work (`34.9.1`-`34.9.4`) and has now landed the first backend consumer slice (`34.7.1`) that lets certification expiry checks fall back to OCR-derived expiry fields. The remaining `34.7.x` slices should continue that pattern: use persisted OCR extracted fields to improve backend compliance logic only where the matrix and current product behavior justify it, while keeping raw artifact metadata and underlying evidence hashes as source truth.

The clean decomposition is:

1. `34.7.1` Certification expiry fallback from OCR-extracted expiry fields.
2. `34.7.2` Lab-report presence and shape fallback from OCR-extracted lab schema fields.
3. `34.7.3` Trade-document checklist satisfaction via OCR-resolved document labels.
4. `34.7.4` Reanalysis-driven lane compliance recomputation and persistence refresh.
5. `34.7.5` Backend contract surfacing for OCR-influenced compliance decisions.

This keeps the backend integration work ordered from lowest risk to highest coupling:

- first, certification expiry, which is already structurally isolated
- then, document-presence compliance signals
- then, orchestration consistency after reanalysis
- finally, explicit API surfacing so consumers can see OCR-influenced compliance state without inferring it indirectly

### Files To Change

- `src/modules/rules-engine/rules-engine.service.ts`
- `src/modules/rules-engine/rules-engine.types.ts`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
- `src/modules/rules-engine/rules-engine.pg-store.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `src/modules/evidence/evidence.pg-store.ts`
- `src/modules/lane/lane.pg-store.ts`
- `src/modules/lane/lane.service.ts`
- `src/modules/lane/lane.service.spec.ts`
- `src/modules/evidence/evidence.controller.ts`
- `test/evidence.e2e-spec.ts`
- `docs/PROGRESS.md`

Not every file must change in every subtask. The list above is the bounded backend surface across `34.7.1` to `34.7.5`.

### Implementation Steps

1. Keep `34.7.1` narrow: certification expiry fallback only.
2. Add `34.7.2` next: use OCR-derived lab-report extracted fields only for report-structure presence/shape checks when raw metadata lacks structured lab payloads.
3. Add `34.7.3`: let checklist/document-satisfaction logic use OCR-resolved `documentLabel` for invoice-class trade docs when `metadata.documentType` is absent.
4. Add `34.7.4`: make on-demand reanalysis trigger lane-level reevaluation and persisted completeness refresh so OCR-backed compliance improvements are not visible only on later reads.
5. Add `34.7.5`: expose OCR-influenced compliance provenance in backend responses so operators and tests can tell when a compliance result came from metadata fallback vs OCR-derived fields.

### Test Coverage

- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - certification fallback cases
  - lab-report shape fallback cases
  - trade-document satisfaction cases
- `src/modules/evidence/evidence.service.spec.ts`
  - upload and reanalysis orchestration into rules consumers
- `src/modules/lane/lane.service.spec.ts`
  - lane completeness recomputation after reanalysis
- `test/evidence.e2e-spec.ts`
  - backend HTTP artifact detail and lane/detail compliance paths for one representative non-certification OCR-driven case

### Decision Completeness

- Goal
  - Make backend compliance logic consume persisted OCR extracted fields in small, fail-closed, metadata-first slices.
- Non-goals
  - Do not parse full numeric MRL chemistry values from free OCR text in this batch.
  - Do not redefine evidence hashes or source metadata as mutable truth.
  - Do not add new artifact types or expand OCR to operational evidence.
- Success criteria
  - Each `34.7.x` slice changes one bounded backend compliance behavior.
  - Every change remains additive and fail-closed.
  - OCR-derived fields only influence compliance when the source metadata is absent or insufficient for the current check.
- Public interfaces changed
  - Minimal backend response enrichments only in `34.7.5`.
  - No new DB schema required for the planned `34.7.x` slices because `evidence_artifact_analyses` already stores `extracted_fields` and `field_completeness`.
- Edge cases / failure modes
  - OCR-extracted fields disagree with raw metadata.
  - OCR-extracted fields exist but are low-confidence or incomplete.
  - Reanalysis changes compliance semantics after initial upload.
- Rollout / backout
  - All slices are additive and can be reverted independently.
- Acceptance checks
  - Focused rules/evidence/lane tests per subtask.
  - Root `npm run typecheck` after each slice.

### Dependencies

- `rules/document-matrix.yaml`
- persisted `evidence_artifact_analyses.extracted_fields`
- current `RulesEngineService.evaluateLane()` and certification alert paths
- current `EvidenceService.runArtifactAnalysis()` and `reanalyzeArtifact()` orchestration

### Validation

- RED-first for each backend consumer change.
- Keep each subtask bounded to one behavior family.
- Run fast unit gates first, add e2e only where the changed backend contract needs proof.

### Wiring Verification

| Component                                             | Entry Point                                                                                                | Registration Location                                                       | Schema/Table                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| OCR-derived certification expiry fallback             | `EvidenceService.persistArtifact()` and `RulesEngineService.evaluateLane()/scanCertificationExpirations()` | existing `EvidenceModule`, `RulesEngineModule`, `LaneModule` wiring         | `evidence_artifacts`, `evidence_artifact_analyses.extracted_fields` |
| OCR-derived lab-report structure fallback             | `RulesEngineService.buildLabValidation()`                                                                  | existing `RulesEngineModule`                                                | `evidence_artifacts`, `evidence_artifact_analyses.extracted_fields` |
| OCR-derived trade-doc label satisfaction              | `RulesEngineService.artifactSatisfiesDocument()`                                                           | existing `RulesEngineModule`                                                | `evidence_artifacts`, `evidence_artifact_analyses.document_label`   |
| Reanalysis-driven lane compliance refresh             | `POST /evidence/:id/reanalyze` via `EvidenceController.reanalyzeArtifact()`                                | existing `EvidenceModule` and lane reconciler wiring                        | `lanes.completeness_score`, `evidence_artifact_analyses`            |
| OCR-influenced compliance provenance in API responses | existing artifact detail / lane completeness HTTP paths                                                    | existing `EvidenceController` / `LaneService` / `RulesEngineService` wiring | response-only, no new table                                         |

## Plan Draft B

### Overview

An alternative decomposition is to keep all rules-engine changes together before touching orchestration. In that model:

1. certification fallback
2. lab-report fallback
3. trade-doc satisfaction
4. backend response surfacing
5. reanalysis recomputation

This front-loads read-path semantics and delays orchestration until last.

### Files To Change

- same bounded file surface as Draft A

### Implementation Steps

1. Finish all read-path rules-engine integrations first.
2. Surface the results in backend responses.
3. Only then reconcile reanalysis-time write/update behavior.

### Test Coverage

- Heavier on `rules-engine.service.spec.ts`
- Later additions to `evidence.service.spec.ts` and lane tests

### Decision Completeness

- Strength: keeps rules logic clustered.
- Weakness: temporarily leaves reanalysis as a stale compliance state producer, which is surprising for operators.

### Dependencies

- same as Draft A

### Validation

- same as Draft A

### Wiring Verification

- same runtime surfaces as Draft A

## Comparative Analysis

### Draft A Strengths

- Preserves the smallest-correct-slice approach.
- Matches the current repo architecture where evidence upload/reanalysis is the source of analysis writes and rules-engine is the source of compliance reads.
- Avoids exposing OCR-influenced compliance state before reanalysis can consistently recompute it.

### Draft A Gaps

- Requires touching orchestration earlier.

### Draft B Strengths

- Keeps more changes local to the rules engine first.

### Draft B Gaps

- Creates a temporary inconsistency: backend read paths could understand more OCR-derived compliance semantics than the reanalysis write path refreshes into lane state.
- Makes `34.7.5` less honest because surfaced backend state might still depend on stale persisted completeness.

## Unified Execution Plan

### Overview

Use Draft A. Define `34.7.1` through `34.7.5` as follows.

### Exact Subtask Definitions

#### `34.7.1` Certification Expiry Fallback From OCR Fields

- Scope
  - Use persisted OCR extracted expiry fields for certification expiry checks when raw artifact metadata lacks expiry values.
  - Cover upload-time certification alerts, lane evaluation certification alerts/checklist status, and scheduled certification scans.
- In scope files
  - `src/modules/rules-engine/rules-engine.service.ts`
  - `src/modules/rules-engine/rules-engine.types.ts`
  - `src/modules/rules-engine/rules-engine.pg-store.ts`
  - `src/modules/lane/lane.pg-store.ts`
  - `src/modules/evidence/evidence.service.ts`
  - tests in rules/evidence/lane
- Non-goals
  - no lab/MRL logic changes
  - no checklist satisfaction changes outside certification expiry state
- Success criteria
  - expired or valid cert state can be computed from OCR `expiryDate` fallback when metadata is empty
  - metadata still wins when present

#### `34.7.2` Lab Report Presence/Shape Fallback From OCR Fields

- Scope
  - Improve `RuleLabValidationResult` gating when `MRL_TEST` artifacts lack structured metadata results but OCR extracted fields clearly prove the document is a lab report and whether required report-schema fields are present.
  - This subtask should affect only document-structure / blocking-reason behavior, not numeric pesticide pass/fail calculations.
- Exact behavior
  - If raw `metadata.results` is absent and OCR confirms a supported `MRL Test Results` document with the required report-schema fields present, the backend should stop treating the artifact as “missing document” and instead treat it as “document present but structured numeric results unavailable,” using an explicit blocked/unknown path.
  - If OCR confirms the document is incomplete, continue fail-closed.
- In scope files
  - `src/modules/rules-engine/rules-engine.service.ts`
  - `src/modules/rules-engine/rules-engine.types.ts`
  - `src/modules/lane/lane.pg-store.ts`
  - `src/modules/rules-engine/rules-engine.service.spec.ts`
  - maybe `src/modules/evidence/evidence.service.spec.ts` for upload path proof
- Non-goals
  - do not parse analyte numeric tables from OCR free text into runtime pesticide validation yet
  - do not relax zero-false-negative MRL policy
- Success criteria
  - compliance shifts from “missing MRL document” to “present but blocked/unknown” only when OCR-backed report-structure evidence is strong enough
  - no numeric PASS is ever inferred from OCR-only text

#### `34.7.3` Trade Document Checklist Satisfaction Via OCR Document Label

- Scope
  - Let checklist/document-satisfaction logic recognize invoice-class evidence (`INVOICE` artifact type) from persisted OCR `documentLabel` when `metadata.documentType` is absent.
  - Apply only to document-presence matching for `Commercial Invoice`, `Packing List`, `Transport Document`, `Delivery Note`, and `Export License`.
- Exact behavior
  - In `artifactSatisfiesDocument()`, preserve current metadata-first matching.
  - Add fallback to OCR `latestAnalysis.documentLabel` for invoice-class artifacts.
  - This should improve checklist presence/missing output only, not other compliance semantics.
- In scope files
  - `src/modules/rules-engine/rules-engine.service.ts`
  - `src/modules/lane/lane.pg-store.ts` or evidence-evaluation query owners if `documentLabel` hydration is needed separately from `extracted_fields`
  - `src/modules/evidence/evidence.pg-store.ts` only if shared hydration helpers are reused
  - tests in rules-engine and backend evidence/lane paths
- Non-goals
  - do not use OCR label fallback for operational evidence types
  - do not change certification expiry or MRL logic here
- Success criteria
  - invoice-class artifacts can satisfy the correct trade-document checklist item from OCR classification alone when metadata labeling is absent
  - false positives across trade docs remain covered by conservative tests

#### `34.7.4` Reanalysis-Driven Lane Compliance Refresh

- Scope
  - Ensure `POST /evidence/:id/reanalyze` reruns any now-supported backend compliance consequences after a new analysis row is written.
  - Recompute lane evaluation/completeness and any applicable certification alert consequences after reanalysis, not only on fresh uploads or later reads.
- Exact behavior
  - After successful reanalysis, refresh lane completeness score through the existing evaluation path.
  - Trigger the same narrow certification alert reevaluation path when the artifact is a certification type.
  - Keep the flow fail-open for non-critical follow-on errors, consistent with current upload behavior.
- In scope files
  - `src/modules/evidence/evidence.service.ts`
  - `src/modules/evidence/evidence.service.spec.ts`
  - possibly `src/modules/lane/lane.service.spec.ts`
  - `test/evidence.e2e-spec.ts` if one real reanalyze HTTP proof is needed
- Non-goals
  - no bulk backend endpoint
  - no new workers
- Success criteria
  - backend compliance state refreshed by reanalysis matches what a fresh upload of the same artifact would now produce

#### `34.7.5` Backend Contract Surfacing For OCR-Influenced Compliance Decisions

- Scope
  - Make OCR-influenced backend compliance outcomes explicit in API-facing payloads so operators, frontend tests, and future readiness reporting can see when OCR-derived fields affected a result.
  - Keep this additive and minimal.
- Exact behavior
  - Add narrow provenance fields in the most relevant backend response contracts, likely on lane completeness / certification alert structures and possibly artifact detail analysis summaries.
  - Example shape: indicate whether a certification expiry decision or document-satisfaction decision used raw metadata vs OCR fallback.
  - Only expose provenance for behaviors already integrated by `34.7.1` to `34.7.4`.
- In scope files
  - `src/modules/rules-engine/rules-engine.types.ts`
  - `src/modules/rules-engine/rules-engine.service.ts`
  - `src/modules/lane/lane.service.ts`
  - `src/modules/evidence/evidence.controller.ts` or lane controller surface if needed
  - `test/evidence.e2e-spec.ts` or lane e2e coverage
- Non-goals
  - no new database schema unless absolutely required
  - no frontend work in this subtask
- Success criteria
  - backend consumers can tell when a compliance outcome depended on OCR-derived fields
  - this becomes the stable backend contract for later `34.9.6+` readiness accounting and UI confidence surfacing

### Test Coverage

- `34.7.1`
  - rules-engine: certification alert + checklist + scan fallback tests
  - evidence service: upload path passes OCR extracted fields into alert hook
- `34.7.2`
  - rules-engine: MRL document present vs blocked distinctions with OCR-only lab schema evidence
- `34.7.3`
  - rules-engine: invoice-class checklist satisfaction from OCR label fallback
- `34.7.4`
  - evidence service: reanalysis recomputes lane score and certification side effects
  - one HTTP path if needed
- `34.7.5`
  - unit + e2e contract assertions for provenance fields

### Decision Completeness

- Goal
  - Turn `34.7` into five bounded backend compliance integration slices that are explicit, ordered, and testable.
- Non-goals
  - Do not collapse `34.7` into the broader fixture/browser/readiness program under `34.9`.
  - Do not introduce full OCR-to-structured-chemistry parsing in this batch.
- Measurable success criteria
  - Each subtask changes one primary backend consumer family.
  - Later subtasks do not need to redefine earlier scope.
  - The sequence supports your intended order: `34.7.1`, `34.7.2`, `34.7.3`, then back to `34.9.5`, then `34.7.4`, `34.7.5`.
- Changed public interfaces
  - likely only `34.7.5`
- Edge cases and failure modes
  - metadata/OCR disagreement
  - incomplete or low-confidence OCR
  - stale lane score after reanalysis
  - trade-doc misclassification among invoice-family labels
- Rollout and backout expectations
  - each subtask remains revertible on its own
- Concrete acceptance checks
  - focused unit tests for each slice
  - root `npm run typecheck`
  - e2e only where the changed API contract must be proven

### Dependencies

- existing OCR persistence under `evidence_artifact_analyses`
- current evidence upload/reanalysis orchestration
- current lane completeness endpoint and evidence detail endpoint
- current document matrix semantics

### Validation

- Use RED-first per subtask.
- Prefer metadata-first + OCR-fallback semantics unless the subtask explicitly justifies stronger OCR usage.
- Avoid touching browser/UI in `34.7`.

### Wiring Verification

| Component                                | Entry Point                                                 | Registration Location                                  | Schema/Table                                                                 |
| ---------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `34.7.1` certification fallback          | upload alert, lane completeness read, scheduled expiry scan | existing evidence/rules-engine/lane modules            | `evidence_artifacts`, `evidence_artifact_analyses.extracted_fields`          |
| `34.7.2` lab-report shape fallback       | lane completeness / rules evaluation                        | existing rules-engine + lane read path                 | `evidence_artifact_analyses.extracted_fields`, optional `field_completeness` |
| `34.7.3` trade-doc OCR label matching    | lane completeness checklist generation                      | existing rules-engine + lane read path                 | `evidence_artifact_analyses.document_label`                                  |
| `34.7.4` reanalysis compliance refresh   | `POST /evidence/:id/reanalyze`                              | existing `EvidenceController` -> `EvidenceService`     | `lanes.completeness_score`, `evidence_artifact_analyses`                     |
| `34.7.5` compliance provenance surfacing | lane completeness and/or artifact detail responses          | existing lane/evidence controllers and service mappers | response contract only unless a persisted provenance need emerges            |

## Outcome

This plan defines the exact scope of `34.7.1` through `34.7.5` using the current codebase and your intended execution order.

Recommended next action:

- Treat the already landed certification fallback slice as the authoritative definition of `34.7.1`.
- Use the definitions above as the source of truth for `34.7.2` through `34.7.5`.

## 2026-04-08 18:17 ICT

- Goal: Implement `34.7.2` by making backend MRL/lab validation distinguish between an unproven `MRL_TEST` artifact and an OCR-proven `MRL Test Results` document when structured numeric metadata is missing, without deriving numeric chemistry pass/fail from OCR text.
- What changed:
  - `src/modules/rules-engine/rules-engine.types.ts`: Extended `RuleLaneArtifact` with optional `latestAnalysisDocumentLabel` and `latestAnalysisFieldCompleteness` so rules evaluation can use persisted OCR classification context in addition to extracted fields.
  - `src/modules/evidence/evidence.pg-store.ts`: Updated `listArtifactsForEvaluation()` to hydrate latest analysis document label, extracted fields, and field-completeness data into the artifacts that feed `RulesEngineService.evaluateLane()`.
  - `src/modules/rules-engine/rules-engine.service.ts`: Added a narrow `hasOcrBackedLabDocument()` helper and used it in `buildLabValidation()`. The rules engine now:
    - treats `MRL_TEST` artifacts with real structured metadata results as present, as before
    - treats `MRL_TEST` artifacts without metadata results and without OCR proof of a supported lab report as still effectively missing for `FULL_PESTICIDE` enforcement (`MRL_TEST_REQUIRED`)
    - treats OCR-proven `MRL Test Results` documents without structured numeric metadata as present but blocked (`MRL_RESULTS_REQUIRED`), while keeping per-substance outputs conservative as `UNKNOWN`
    - does not infer any numeric PASS/FAIL chemistry values from OCR text alone
  - `src/modules/rules-engine/rules-engine.service.spec.ts`: Added RED/GREEN coverage for the two new distinctions:
    - unproven `MRL_TEST` artifact stays in the missing-document bucket
    - OCR-proven `MRL Test Results` artifact becomes present-but-blocked when numeric metadata results are unavailable
  - `src/modules/evidence/evidence.service.spec.ts`: Added upload-path coverage proving lane evaluation receives OCR-derived lab analysis context for `MRL_TEST` artifacts.
  - `src/modules/evidence/evidence.pg-store.spec.ts`: Added a DB-backed regression test proving `listArtifactsForEvaluation()` now includes the latest analysis document label, extracted fields, and field-completeness payload needed by the rules engine.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts` failed for the expected reasons:
    - the rules engine treated every `MRL_TEST` artifact as present regardless of OCR proof
    - the evaluation store path still dropped latest analysis context before calling the rules engine
  - GREEN: after hydrating latest analysis context into evaluation artifacts and adding the narrow OCR-backed lab-document gate, the focused suite passed.
  - No full free-text OCR-to-chemistry parsing was introduced; RED/GREEN stayed aligned with the planned `34.7.2` scope.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts` -> initial RED on the intended new assertions.
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts` -> passed.
  - repeated `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts` -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - `EvidenceService.persistArtifact()` already uses `listArtifactsForEvaluation()` before calling `RulesEngineService.evaluateLane()`. By extending that store method, the new OCR-backed lab-document semantics flow through existing runtime wiring without adding new entry points.
  - `RuleLaneArtifact` now carries the exact latest-analysis fields needed by `buildLabValidation()`, and the changed properties are consumed by a real runtime caller rather than test-only code.
  - The DB-backed store test proves the persisted `evidence_artifact_analyses` row shape is actually available to lane evaluation.
- Behavior changes and risk notes:
  - This slice is intentionally conservative: OCR can now prove that an artifact is a real MRL report, but it still cannot produce numeric PASS/FAIL pesticide outcomes without structured metadata results.
  - For `FULL_PESTICIDE` enforcement, the behavior now cleanly distinguishes:
    - no proven MRL report -> `MRL_TEST_REQUIRED`
    - OCR-proven report with no structured numeric data -> `MRL_RESULTS_REQUIRED`
  - UNKNOWN per-substance rows remain present in the latter case, which is the safer behavior because it avoids false PASS claims while still showing the blocked review surface.
  - The focused evidence suite still emits the existing non-failing mocked-path verification log from an unrelated test path; this predates `34.7.2`.
- Follow-ups and known gaps:
  - `34.7.3` should next cover OCR-backed trade-document checklist satisfaction via persisted `documentLabel` for invoice-family artifacts.
  - `34.7.4` still needs reanalysis-driven lane compliance refresh so later OCR-supported rules changes are applied consistently after manual reanalysis.

## 2026-04-08 18:32 ICT

- Goal: Implement `34.7.3` by letting OCR-resolved document labels satisfy invoice-family trade-document checklist items when source metadata labeling is absent, while removing the overly broad behavior where any `INVOICE` artifact satisfied every invoice-family requirement.
- What changed:
  - `src/modules/rules-engine/rules-engine.service.ts`: Tightened `artifactSatisfiesDocument()` for invoice-family documents. Matching order is now:
    - metadata `documentType` / `documentName`
    - persisted OCR `latestAnalysisDocumentLabel`
    - filename fallback only
      The previous blanket `artifactType === 'INVOICE'` shortcut was removed for invoice-family labels, which prevents one generic invoice artifact from satisfying `Commercial Invoice`, `Packing List`, `Transport Document`, `Delivery Note`, and `Export License` simultaneously.
  - `src/modules/lane/lane.pg-store.ts`: Extended `listEvidenceArtifactsForLane()` to hydrate `latestAnalysisDocumentLabel` alongside extracted fields so lane completeness reads use the same OCR-backed trade-document semantics as upload-time evaluation.
  - `src/modules/rules-engine/rules-engine.service.spec.ts`: Added RED/GREEN coverage proving:
    - OCR `Packing List` classification can satisfy only the `Packing List` checklist item when metadata is absent
    - a generic `INVOICE` artifact with no metadata or OCR label no longer satisfies invoice-family checklist items by accident
    - the earlier weighted-scoring baseline still passes when an explicit `Commercial Invoice` metadata label is present
  - `src/modules/evidence/evidence.service.spec.ts`: Added upload-path coverage proving OCR document labels flow into lane evaluation inputs for invoice-family artifacts.
  - `src/modules/evidence/evidence.pg-store.spec.ts`: Added a DB-backed regression test proving `listArtifactsForEvaluation()` exposes persisted OCR trade-document labels.
  - `src/modules/lane/lane.service.spec.ts`: Added lane completeness coverage proving the lane read path now passes OCR document labels through to rules evaluation.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts src/modules/lane/lane.service.spec.ts` failed for the intended reasons:
    - OCR-labeled `Packing List` artifacts still caused `Commercial Invoice` to appear present
    - a generic `INVOICE` artifact still satisfied all invoice-family documents
  - GREEN: after removing the blanket invoice artifact-type shortcut and hydrating OCR document labels on the lane read path, the same focused suite passed.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/evidence/evidence.pg-store.spec.ts src/modules/lane/lane.service.spec.ts` -> initial RED on the intended checklist assertions.
  - same focused command -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - Upload-time path: `EvidenceService.persistArtifact()` already feeds `RulesEngineService.evaluateLane()` from `listArtifactsForEvaluation()`, and that store path already hydrates `latestAnalysisDocumentLabel` after the `34.7.2` work.
  - Lane-read path: `LaneService.getCompleteness()` uses `LaneStore.listEvidenceArtifactsForLane()`, which now hydrates the same OCR document label field, so both runtime evaluation paths are aligned.
  - The changed rules logic is consumed by real runtime entry points rather than test-only code.
- Behavior changes and risk notes:
  - This fixes a real false-positive risk: previously, any one `INVOICE` artifact could satisfy all invoice-family checklist requirements with no metadata or OCR proof.
  - The new behavior is more conservative and more truthful: invoice-family checklist satisfaction now depends on explicit metadata, OCR classification, or a filename that clearly indicates the specific document.
  - Filename fallback remains in place as the least-trusted fallback, preserving some tolerance for legacy/manual uploads without reintroducing the broad artifact-type bug.
  - The focused evidence suite still emits the same existing non-failing mocked verification log from an unrelated test path; this predates `34.7.3`.
- Follow-ups and known gaps:
  - `34.7.4` should next make `POST /evidence/:id/reanalyze` refresh lane completeness and related OCR-backed compliance consequences, so manual reanalysis immediately applies the newer backend semantics.
  - `34.7.5` should later expose OCR-influenced compliance provenance in backend contracts instead of leaving consumers to infer it from checklist changes.

## 2026-04-08 18:46 ICT

- Goal: Implement `34.7.4` by making `POST /evidence/:id/reanalyze` refresh the backend compliance consequences that now depend on persisted OCR analysis, instead of only writing a new analysis row and returning artifact detail.
- What changed:
  - `src/modules/evidence/evidence.service.ts`: Updated `reanalyzeArtifact()` so it now:
    - reloads the owning lane
    - reruns artifact analysis with the lane context
    - refreshes lane completeness using the existing rules-engine evaluation path
    - persists the updated completeness score
    - republishes the evidence-updated realtime event with the refreshed completeness
    - reruns lane transition reconciliation through the existing reconciler path
    - rechecks certification alerts using the fresh analysis extracted fields when the artifact is a certification type
  - `src/modules/evidence/evidence.service.ts`: Added a small shared helper, `refreshLaneComplianceAfterAnalysis()`, so reanalysis can reuse the same post-analysis compliance refresh semantics without duplicating the rules-evaluation and certification-alert logic.
  - `src/modules/evidence/evidence.service.spec.ts`: Added RED/GREEN coverage proving:
    - reanalysis refreshes lane completeness and reconciliation after writing a new analysis row
    - reanalysis rechecks certification alerts using the freshly created OCR analysis fields
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/lane/lane.service.spec.ts` failed for the intended reasons because `reanalyzeArtifact()` only reran OCR analysis and returned artifact detail; it did not call `listArtifactsForEvaluation()`, `evaluateLane()`, `updateLaneCompletenessScore()`, `reconcileAfterEvidenceChange()`, or `notifyCertificationAlertForArtifact()`.
  - GREEN: the same focused suite passed after wiring reanalysis through the new shared post-analysis refresh helper.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/lane/lane.service.spec.ts` -> initial RED on the intended reanalysis side-effect assertions.
  - same focused command -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - Runtime entry point remains `POST /evidence/:id/reanalyze` in `src/modules/evidence/evidence.controller.ts`, which already delegates to `EvidenceService.reanalyzeArtifact()`.
  - The new behavior is wired entirely through existing runtime collaborators already used in upload-time flows:
    - `EvidenceArtifactStore.listArtifactsForEvaluation()`
    - `RulesEngineService.evaluateLane()`
    - `EvidenceArtifactStore.updateLaneCompletenessScore()`
    - `RealtimeEventsService.publishEvidenceUploaded()`
    - `LaneReconciler.reconcileAfterEvidenceChange()`
    - `RulesEngineService.notifyCertificationAlertForArtifact()`
  - No new module wiring or controller routes were needed.
- Behavior changes and risk notes:
  - Reanalysis is now much closer to upload-time semantics for OCR-backed compliance effects, which is what operators need once classifier/rules integration has expanded.
  - The implementation is intentionally narrow: it refreshes existing completeness/certification consequences but does not add new worker queues, batch jobs, or a new HTTP response contract.
  - Realtime publication still uses the existing `publishEvidenceUploaded()` event instead of introducing a separate reanalysis-specific event, which keeps this slice small but may eventually deserve a more explicit event name if consumers need to distinguish upload vs reanalysis.
  - The focused evidence suite still emits the same existing non-failing mocked verification log from an unrelated upload-path test; this predates `34.7.4`.
- Follow-ups and known gaps:
  - `34.7.5` should next make OCR-influenced compliance provenance explicit in backend-facing contracts so callers can tell whether a completeness or certification decision came from metadata or OCR fallback.
  - There is still no dedicated HTTP e2e proof for reanalysis-driven completeness refresh; that can be added later if we want stronger transport-level coverage.

## 2026-04-08 18:54 ICT

- Goal: Implement `34.7.5` by surfacing minimal provenance in backend compliance responses so callers can tell when checklist, lab-validation, and certification outcomes depended on metadata, OCR document labels, OCR extracted fields, or simple artifact-type/file-name fallbacks.
- What changed:
  - `src/modules/rules-engine/rules-engine.types.ts`: Added additive provenance fields to existing response contracts:
    - `RuleChecklistItem.provenance`
    - `RuleLabValidationResult.evidenceSource`
    - `RuleCertificationAlert.evidenceSource`
  - `src/modules/rules-engine/rules-engine.service.ts`: Added small internal provenance helpers by changing checklist matching to return both match state and match source. The rules engine now reports:
    - checklist provenance as one of `ARTIFACT_TYPE`, `METADATA_DOCUMENT_TYPE`, `OCR_DOCUMENT_LABEL`, or `FILE_NAME_FALLBACK`
    - lab validation evidence source as one of `METADATA_STRUCTURED_RESULTS`, `OCR_DOCUMENT_ANALYSIS`, `ARTIFACT_TYPE_ONLY`, or `null`
    - certification alert evidence source as `METADATA_EXPIRY`, `OCR_EXTRACTED_FIELDS`, or `null`
  - `src/modules/rules-engine/rules-engine.service.ts`: Refactored metadata expiry parsing slightly by extracting `readExpiryDateFromMetadata()` so certification provenance can truthfully distinguish metadata-derived expiry from OCR fallback-derived expiry.
  - `src/modules/rules-engine/rules-engine.service.spec.ts`: Added RED/GREEN assertions proving:
    - OCR-backed trade-document checklist satisfaction exposes `OCR_DOCUMENT_LABEL`
    - OCR-backed MRL blocked states expose `OCR_DOCUMENT_ANALYSIS`
    - certification validity based on OCR-derived expiry exposes `OCR_EXTRACTED_FIELDS`
  - `src/modules/lane/lane.service.spec.ts`: Updated lane completeness expectations to prove the additive provenance fields flow through the existing completeness response surface unchanged.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts` failed for the intended reason because the backend already computed OCR-influenced outcomes but returned no explicit provenance.
  - GREEN: the same focused suite passed after adding the small provenance fields to the rules-engine response shapes and populating them from the existing matching / expiry / lab-validation logic.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts` -> initial RED on the new provenance assertions.
  - same focused command -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - `LaneService.getCompleteness()` already returns the raw `RuleLaneEvaluation` produced by `RulesEngineService.evaluateLane()`, so the new provenance fields automatically surface through the existing lane completeness API without controller or module wiring changes.
  - The changed types are consumed by real runtime callers and tests, not dead response-only additions.
  - No persistence, controller route, or module registration changes were required.
- Behavior changes and risk notes:
  - This slice is additive only: existing status/score behavior is unchanged, but backend callers can now tell why a result was considered present, blocked, valid, or expired.
  - The provenance model is intentionally narrow and current-state-focused. It explains the evidence source used by the current evaluation, not a complete chain of fallback attempts.
  - No frontend work was required, but the new fields now make later readiness reporting and UI confidence surfacing possible without re-deriving logic client-side.
  - The focused evidence suite still emits the same existing non-failing mocked verification log from an unrelated upload-path test; this predates `34.7.5`.
- Follow-ups and known gaps:
  - The next OCR readiness slices under `34.9` can now reference these backend provenance fields instead of inferring OCR influence indirectly.
  - If transport-level proof becomes important, a later e2e test can assert the lane completeness HTTP payload exposes the new provenance fields end-to-end.
