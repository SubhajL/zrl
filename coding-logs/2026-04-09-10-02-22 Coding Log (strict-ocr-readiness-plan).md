# Coding Log

## Plan Draft A

### Overview

The current OCR readiness program (`34.9.1` through `34.9.8`) delivered the originally planned layered proof model:

- committed fixture corpus
- exhaustive classifier coverage across current labels and override-bearing variants
- targeted backend OCR integration (`34.7.x`)
- one representative browser OCR path per supported combo
- initial browser matrix harness

That is enough for the original representative-readiness strategy, but it is **not** enough for the stricter standard now requested:

- every required document for every supported combo must have explicit proof coverage
- readiness must be machine-checkable per `combo x required document`
- supporting letters/certificates or threshold documents beyond the current 9 first-pass labels must be modeled explicitly, not implied informally
- browser proof should be expanded substantially, and any non-browser proof must be justified at the per-document level rather than assumed globally

The important consequence is: **`34.9.9` alone is too small for this stricter standard**.

The current matrix scope in `rules/document-matrix.yaml` is 9 supported combos with 75 required-document slots total:

- 6 combos x 8 docs = 48
- 3 combos x 9 docs = 27
- total = 75

So the remaining work should be split into:

1. `34.9.9` readiness accounting and strict coverage ledger
2. new follow-up task(s) for exhaustive per-required-document browser proof expansion
3. new follow-up task(s) for any extra supporting forms/certificates/approval letters not yet modeled in `rules/document-matrix.yaml`

### Files To Change

- `rules/document-matrix.yaml`
- `frontend/e2e/test-assets/ocr-forms/manifest.json`
- `frontend/e2e/helpers/ocr-assets.ts`
- `frontend/e2e/evidence-ocr-matrix.spec.ts`
- `frontend/e2e/evidence-ocr.spec.ts`
- `frontend/src/lib/ocr-assets.test.ts`
- `src/modules/evidence/ocr-fixture-manifest.ts`
- `src/modules/evidence/document-matrix.spec.ts`
- `src/modules/evidence/evidence.document-classifier.spec.ts`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
- `docs/PROGRESS.md`
- `docs/` new readiness report file or manifest if needed
- `coding-logs/...`

### Implementation Steps

1. Keep `34.9.9` narrow and honest:
   - build a strict readiness ledger for every required document of every supported combo
   - do not claim full readiness if browser proof is still representative-only
2. Add a new follow-up task for exhaustive browser coverage:
   - expand from one browser proof per combo to one browser proof per required document slot, unless a per-document waiver mechanism is explicitly accepted
3. Add another follow-up task if extra supporting letters/certificates must be included:
   - first model them explicitly in `rules/document-matrix.yaml`
   - then add fixture, classifier, backend, and browser proof like the current 9 first-pass labels

### Test Coverage

- `src/modules/evidence/document-matrix.spec.ts`
  - readiness ledger parity with supported combos and required documents
- `src/modules/evidence/evidence.document-classifier.spec.ts`
  - already largely complete for current 9 first-pass labels/overrides
- `frontend/e2e/evidence-ocr-matrix.spec.ts`
  - currently representative-per-combo
  - future expansion target: per-required-document matrix
- readiness manifest/report tests
  - each required document slot must map to proof sources

### Decision Completeness

- Goal
  - move from representative combo readiness to strict per-required-document readiness accounting
- Non-goals
  - do not silently treat informal external requirements as in-scope unless they are added to `rules/document-matrix.yaml`
  - do not mark all combos `READY = yes` before the ledger is complete
- Success criteria
  - every `combo x required document` slot is enumerated
  - each slot shows fixture proof, classifier proof, backend proof if relevant, browser proof status, and ready boolean
  - the report fails closed on missing proof
- Public interfaces changed
  - likely a new docs/report file or machine-readable readiness manifest
- Edge cases / failure modes
  - current representative browser coverage is mistaken for exhaustive proof
  - unmodeled support letters are assumed rather than encoded
  - readiness report drifts from `rules/document-matrix.yaml`
- Rollout / backout
  - additive only; readiness can remain partially complete without breaking runtime code

### Dependencies

- `rules/document-matrix.yaml` as the canonical document-requirement truth
- current committed OCR fixture manifest
- current classifier coverage and browser matrix harness
- backend provenance already added in `34.7.5`

### Validation

- first build the ledger and make it fail closed
- only then expand browser/document coverage based on actual gaps
- no readiness claim without explicit per-slot proof mapping

### Wiring Verification

| Component                           | Entry Point                             | Registration Location                                    | Schema/Table                                                            |
| ----------------------------------- | --------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| strict readiness ledger             | tests/docs/readiness manifest           | docs or helper module                                    | N/A                                                                     |
| exhaustive browser matrix expansion | Playwright OCR uploads                  | `frontend/e2e/evidence-ocr-matrix.spec.ts`               | persisted `evidence_artifact_analyses` read via `/api/zrl/evidence/:id` |
| extra supporting document modeling  | rules + fixtures + classifier + browser | `rules/document-matrix.yaml` plus existing OCR harnesses | `rules/document-matrix.yaml`, fixture manifest                          |

## Plan Draft B

### Overview

An alternative is to keep `34.9.9` broad and let it absorb all remaining strict-readiness work:

1. readiness accounting
2. exhaustive browser expansion
3. extra supporting-doc modeling if needed

This avoids Task Master churn but creates one oversized subtask that no longer matches the fine-grained `34.9.x` slicing used so far.

### Files To Change

- same overall surface as Draft A, but under one subtask umbrella

### Implementation Steps

1. Build readiness report
2. Expand browser matrix exhaustively
3. Extend matrix if extra documents are needed

### Test Coverage

- same as Draft A, but everything lands under `34.9.9`

### Decision Completeness

- Strength: less bookkeeping in Task Master
- Weakness: too large, less honest progress tracking, higher risk of partial completion being reported as one subtask done

### Dependencies

- same as Draft A

### Validation

- same as Draft A

### Wiring Verification

- same as Draft A

## Comparative Analysis

### Draft A Strengths

- Matches the repo’s current fine-grained `34.9.x` execution style.
- Keeps `34.9.9` appropriately narrow as readiness accounting/reporting.
- Makes the stricter standard explicit without retroactively pretending `34.9.8` already proved all required documents.
- Gives a clean place to add extra supporting-document modeling if required.

### Draft A Gaps

- Requires updating Task Master or at least the human task breakdown.

### Draft B Strengths

- Fewer bookkeeping updates.

### Draft B Gaps

- Too much scope for one subtask.
- Makes honest progress reporting harder.
- Increases the chance that readiness accounting is mixed with expensive browser expansion and unmodeled requirements in one step.

## Unified Execution Plan

### Overview

Use Draft A.

The stricter standard you want should be implemented in **three remaining phases**, not one:

1. `34.9.9` Strict readiness ledger and gap report
2. new follow-up subtask: exhaustive browser proof for all required document slots
3. optional new follow-up subtask: extend modeled document scope if extra supporting forms/certificates/approval letters are truly required and not yet captured in the matrix

### Exact Recommendation

#### Keep `34.9.9` as Readiness Accounting Only

Scope:

- Create a machine-checkable readiness manifest/report that enumerates all 75 current required-document slots from `rules/document-matrix.yaml`
- For each slot, track:
  - combo
  - required document label
  - committed fixture path(s)
  - classifier proof status
  - backend proof status if relevant
  - browser proof status
  - provenance/evidence source notes
  - ready boolean
  - blocker reason if not ready
- Make the report fail closed if any required slot lacks proof

Why this belongs in `34.9.9`:

- it matches the original phase-5 description: readiness accounting/reporting
- it gives an honest baseline before expanding proof breadth further

#### Add New Follow-Up Task: Exhaustive Browser Required-Doc Matrix

Recommended new subtask name:

- `34.9.10` Exhaustive browser OCR proof for all required document slots

Scope:

- Expand browser coverage from 9 representative combo proofs to all 75 current `combo x required document` slots
- Use committed fixtures only
- Reuse the existing browser matrix harness and lane-creation scenarios
- Group execution by document family if needed, but every slot must be represented in the readiness ledger

Why this should not be folded into `34.9.9`:

- it is materially larger
- it is execution-heavy rather than accounting-heavy
- it deserves its own pass/fail milestone

#### Add Optional New Follow-Up Task: Scope Expansion For Extra Supporting Documents

Recommended new subtask name:

- `34.9.11` Model and prove extra supporting forms/certificates/approval letters

Only create this if you confirm that the real standard requires documents beyond the current first-pass 9 labels.

Scope:

- update `rules/document-matrix.yaml`
- extend fixture corpus
- extend classifier coverage
- extend backend impact coverage if needed
- extend browser proof coverage
- extend readiness ledger

This is necessary because right now those extra forms are **not** represented in the canonical matrix, so claiming them in readiness would be untruthful.

### Concrete Deliverables By Phase

#### Phase A: `34.9.9` strict ledger

Files:

- new readiness manifest/report file under `docs/` or `frontend/e2e/test-assets/ocr-forms/`
- test file asserting exact parity with `rules/document-matrix.yaml`

Output:

- exact 75-slot readiness table
- explicit current gaps
- no guessed readiness

#### Phase B: `34.9.10` exhaustive browser proof

Files:

- `frontend/e2e/evidence-ocr-matrix.spec.ts`
- maybe helper metadata module for all required slots

Output:

- browser proof rows for every required slot
- no representative-only gaps left in the ledger

#### Phase C: `34.9.11` matrix scope expansion, if needed

Files:

- `rules/document-matrix.yaml`
- fixtures
- classifier tests
- browser matrix
- readiness ledger

Output:

- extra support letters/certs are formally modeled, not hand-waved

### Test Coverage

#### `34.9.9`

- readiness manifest parity test against all supported combos and required docs
- gap-report correctness tests

#### `34.9.10`

- Playwright browser OCR matrix expanded to all required document slots
- repeat selected families 3x for flake detection

#### `34.9.11`

- matrix parity
- classifier coverage
- browser coverage for new docs

### Decision Completeness

- Goal
  - move from representative readiness to strict per-required-document readiness
- Non-goals
  - do not silently extend scope beyond the current matrix without explicit modeling
- Measurable success criteria
  - all 75 current required slots are enumerated and proof-tracked
  - no combo is marked ready if any required slot is unproven
  - extra support letters only count after matrix inclusion
- Changed public interfaces
  - likely only readiness-report artifacts unless the matrix expands
- Edge cases
  - same document fixture reused across many combos
  - browser proof missing while classifier/backend proof exists
  - extra support letter demanded outside current matrix scope
- Rollout/backout
  - additive only
- Acceptance checks
  - readiness report test passes
  - browser matrix list is exhaustive for required slots
  - targeted live browser runs succeed across multiple families

### Dependencies

- current 9-label fixture corpus
- classifier coverage already completed in `34.9.4` to `34.9.6`
- backend OCR integration completed in `34.7.1` to `34.7.5`
- browser matrix harness completed in `34.9.7` to `34.9.8`

### Validation

1. Build ledger first
2. Mark current gaps honestly
3. Expand browser proofs only after the report exposes exact missing rows
4. If extra forms are needed, model them explicitly before counting them

### Wiring Verification

| Component                               | Entry Point            | Registration Location                                  | Schema/Table                                       |
| --------------------------------------- | ---------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| readiness ledger/report                 | tests/docs             | new report file + tests                                | N/A                                                |
| exhaustive required-slot browser matrix | Playwright suite       | `frontend/e2e/evidence-ocr-matrix.spec.ts`             | `evidence_artifacts`, `evidence_artifact_analyses` |
| optional extra supporting-doc modeling  | matrix + OCR harnesses | `rules/document-matrix.yaml` plus existing OCR modules | rule matrix + fixture manifest                     |

## Task Master Recommendation

Yes, the remaining OCR readiness scope should be split beyond `34.9.9`.

Because Task Master MCP is unavailable in the current session, I cannot update it directly right now. But I recommend the following exact change set once connectivity is restored:

1. Keep `34.9.9` with this exact title:
   - `Strict readiness ledger and gap report for all required OCR documents`

2. Add `34.9.10` with this exact title:
   - `Exhaustive browser OCR proof for all required combo-document slots`

3. Add `34.9.11` only if needed, with this exact title:
   - `Model and prove extra supporting OCR forms beyond first-pass matrix labels`

4. Mark the current state honestly:
   - `34.9.8` complete = representative browser combo matrix harness exists
   - `34.9.9` pending = strict ledger not yet created
   - `34.9.10` pending = exhaustive required-doc browser proof not yet created
   - `34.9.11` pending only if extra support letters/certs are confirmed in scope

## Outcome

`34.9.9` alone should not absorb the stricter standard. The correct next move is:

1. implement `34.9.9` as strict readiness accounting
2. then expand to a new exhaustive browser-proof subtask
3. then expand matrix scope only if extra documents are explicitly required

## 2026-04-09 10:38 ICT

- Goal: Add a durable project reference that explains the current OCR/runtime scope clearly, especially the difference between document-completeness checks, backend OCR integration, the exhaustive rule-data harness, and any future full document-derived compliance ambitions.
- What changed:
  - `docs/OCR-RUNTIME-SCOPE-REFERENCE.md`: Added a detailed reference covering:
    - glossary for MRL, phyto, VHT, GAP, invoice-family docs, and key authorities such as MAFF/QIA/NPPO
    - what `rules/document-matrix.yaml` actually defines
    - what the current runtime checks vs does not check yet
    - how the exhaustive rule-data harness relates to runtime document validation
    - current supported upload file types and where uploads happen in the product
    - what would be needed for full document-derived compliance `PASS/FAIL`
- TDD evidence:
  - No RED/GREEN test cycle applied because this was a documentation-only clarification artifact, not a runtime code change.
- Tests run and results:
  - No new test commands were required for this docs-only addition.
- Wiring verification evidence:
  - The reference was placed under `docs/` alongside the existing PRD/architecture/progress materials so it is discoverable as a canonical project explanation rather than buried in transient chat.
- Behavior changes and risk notes:
  - No runtime behavior changed.
  - The main value is reducing scope confusion before the stricter `34.9.9+` readiness work proceeds.
- Follow-ups and known gaps:
  - The document still describes the current first-pass modeled scope only. If extra support letters/certificates are brought into the canonical matrix later, the reference should be updated to reflect that expanded scope.

## 2026-04-09 10:47 ICT

- Goal: Add a compact summary view to the OCR runtime reference so the difference between current shipped scope and future stricter scope is easy to scan without reading the entire document.
- What changed:
  - `docs/OCR-RUNTIME-SCOPE-REFERENCE.md`: Added a `Current Scope vs Future Scope` table covering required-doc checks, OCR classification/completeness, certification expiry, MRL threshold comparison, browser proof depth, multiple filled-form variants, and full document-derived PASS/FAIL scope.
- TDD evidence:
  - No RED/GREEN cycle applied because this was a documentation-only refinement.
- Tests run and results:
  - No new test commands were required.
- Wiring verification evidence:
  - The new table was added directly into the existing OCR runtime reference so it stays colocated with the longer explanations rather than becoming a separate drift-prone note.
- Behavior changes and risk notes:
  - No runtime behavior changed.
- Follow-ups and known gaps:
  - If the matrix scope expands later to include extra support letters/certificates, the table should be revised to keep the current/future boundary truthful.

## 2026-04-09 10:55 ICT

- Goal: Extend the OCR runtime reference with a document-by-document operational table so it is easy to see, for each current evidence family, what artifact type it maps to, what upload formats are realistically supported today, and whether the runtime currently depends on OCR, metadata, or structured ingestion.
- What changed:
  - `docs/OCR-RUNTIME-SCOPE-REFERENCE.md`: Added a `Document-by-Document Runtime Reference` table covering:
    - `PHYTO_CERT`
    - `VHT_CERT`
    - `MRL_TEST`
    - `GAP_CERT`
    - invoice-family forms (`Export License`, `Commercial Invoice`, `Packing List`, `Transport Document`, `Delivery Note`)
    - `TEMP_DATA`
    - `CHECKPOINT_PHOTO`
    - `HANDOFF_SIGNATURE`
  - Added short interpretation notes explaining the meaning of `OCR + metadata`, `metadata-first fallback`, `structured file ingestion`, and `not in first-pass OCR matrix`.
- TDD evidence:
  - No RED/GREEN cycle applied because this was a documentation-only refinement.
- Tests run and results:
  - No new test commands were required.
- Wiring verification evidence:
  - The new table was added to the existing OCR scope reference so product/runtime questions about current evidence families can be answered from one canonical document.
- Behavior changes and risk notes:
  - No runtime behavior changed.
- Follow-ups and known gaps:
  - If the upload UI later adds explicit spreadsheet formats or a separate structured-lab import path, this table should be updated to reflect the new operational surface.

## Review (2026-04-09 16:58 ICT) - working-tree 34.7 + 34.9

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `feat/task-34-completed-subtasks`
- Scope: `working-tree`
- Commands Run: `git status --porcelain=v1`, `git diff --name-only`, `git diff --stat`, targeted `git diff -- <paths>`, Task `explore` review on 34.7 backend OCR integration and 34.9 OCR readiness files

### Findings

HIGH

- `src/modules/lane/lane.pg-store.ts`: lane-read artifact hydration dropped `latestAnalysisFieldCompleteness`, so `LaneService.getCompleteness()` could evaluate OCR-backed lab evidence differently from upload/reanalysis paths. Fix by selecting and mapping `analysis.field_completeness` through the lane store and proving it in tests.
- `src/modules/evidence/ocr-scope-expansion-audit.ts` and `docs/OCR-SCOPE-EXPANSION-AUDIT.md`: the scope audit hard-coded `Grading Report` as a non-document control even though it appears as a required document in live rule packs, making the "no extra standalone OCR families" conclusion false. Fix by surfacing rule-pack documents outside the current matrix honestly and updating tests/docs to reflect the actual repo state.
- `src/modules/evidence/ocr-readiness-ledger.ts`: browser proof remained hard-coded as representative-only combo coverage even after the exhaustive browser matrix landed, so the strict ledger would continue reporting false negatives. Fix by deriving browser proof from the same canonical slot source used by the browser matrix.

MEDIUM

- `src/modules/rules-engine/rules-engine.service.ts`: invoice-family filename fallback only lowercased/trimmed names, so normal filenames like `packing-list.pdf` or `commercial_invoice.pdf` would not satisfy the fallback path. Fix by comparing normalized slug forms and add regression tests.
- `frontend/src/lib/testing/ocr-browser-readiness-slots.ts`: browser required slots were duplicated in a local hard-coded combo/document map and only asserted one sentinel field per label, which can drift from `rules/document-matrix.yaml` and miss combo-specific OCR field regressions. Fix by generating slots and expected present fields from the shared matrix/manifest source.

LOW

- `src/modules/evidence/evidence.service.ts`: `reanalyzeArtifact()` would refresh completeness and publish side effects even when OCR analysis returned `null`, which makes the call look like a successful reanalysis when nothing new was persisted. Prefer a no-op guard or explicit failure behavior.

### Open Questions / Assumptions

- Assumed the immediate goal is to merge only the OCR `34.7` and `34.9` track, not unrelated repo changes currently in the working tree.
- Assumed the strict ledger should now treat exhaustive slot coverage as the source of truth rather than preserving historical representative-only status.

### Recommended Tests / Validation

- Focused backend tests for rules-engine, evidence service/store, lane service/store.
- Focused readiness tests for fixture manifest, readiness ledger, and scope audit.
- Frontend unit tests for browser readiness slot generation.

### Rollout Notes

- Do not open or merge a PR until these blockers are fixed; the current working tree includes at least one false audit conclusion and one stale readiness report path.
