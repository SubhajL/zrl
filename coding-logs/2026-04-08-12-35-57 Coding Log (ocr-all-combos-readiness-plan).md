# Coding Log

## Plan Draft A

### Overview

Promote the current OCR/form-completeness feature from a proof-of-path implementation into a fully operational, committed, reusable corpus and test program that makes every currently supported document-matrix combo truly `READY = yes`. Keep the current additive evidence-analysis architecture intact. Expand by building a canonical OCR fixture corpus for every supported document label, tightening matrix-driven extraction for combo-specific fields, and adding layered validation that proves upload -> OCR -> classification -> persistence -> UI rendering across all current live supported market/product pairs.

The supported scope today is exactly the `9` live combos in `rules/document-matrix.yaml` and the `9` first-pass document labels in that matrix. China and longan are out of scope until rule support exists and the matrix is expanded.

### Files To Change

- `frontend/e2e/test-assets/ocr-forms/**` - committed canonical OCR-visible fixtures, organized by document label and combo variant.
- `frontend/e2e/evidence-ocr.spec.ts` - keep as the smoke path or convert into a shared helper-driven suite.
- `frontend/e2e/evidence-ocr-matrix.spec.ts` - new parameterized browser E2E coverage across committed fixture combinations.
- `frontend/e2e/helpers/backend.ts` - extend helper polling and optional upload helpers for reusable OCR checks.
- `frontend/e2e/helpers/ocr-fixtures.ts` or similar - central fixture metadata registry for browser E2E expectations.
- `src/modules/evidence/evidence.document-classifier.ts` - extend extraction and combo-specific field logic for all matrix labels and market/product overrides.
- `src/modules/evidence/evidence.document-classifier.spec.ts` - expand to one fixture-backed classification case per supported document label plus combo-specific variants.
- `src/modules/evidence/evidence.service.spec.ts` - add upload/reanalysis orchestration coverage for more than just `PHYTO_CERT`.
- `src/modules/evidence/evidence.pg-store.spec.ts` - add DB-backed latest-analysis persistence/hydration cases for multi-label coverage where worth the runtime cost.
- `src/modules/evidence/document-matrix.spec.ts` - keep structural parity and add stricter expectations around per-label combo applicability where useful.
- `test/evidence.e2e-spec.ts` - extend backend HTTP E2E to cover artifact detail returning persisted analysis for at least one representative upload path.
- `rules/document-matrix.yaml` - only if new clarifying notes or matrix-level extraction expectations must be made more explicit; avoid unnecessary churn.
- `.github/workflows/ci.yml` - preserve OCR runtime install and extend only if more language/data support is required.
- `docs/PROGRESS.md` - record each readiness phase honestly.
- `coding-logs/...` - append implementation and review evidence.

### Implementation Steps

TDD sequence:

1. Define what `READY = yes` means in testable terms for this repo:
   - committed canonical fixture exists for every required matrix document label and every combo-specific variant
   - classifier has a passing fixture-backed unit case for every supported document label and override path
   - service/reanalysis path has representative orchestration coverage for each artifact type family
   - browser E2E proves rendered `latestAnalysis.fieldCompleteness` for every live combo using at least one representative required formal document, plus extra E2Es for labels whose combo-specific rules materially differ
2. Add a fixture registry first, without changing runtime behavior.
3. Add failing classifier tests for currently uncovered labels and combo-specific fields.
4. Implement the smallest extraction/scoring improvements to make those unit tests pass.
5. Add failing browser E2Es in grouped phases, using committed fixtures and backend polling helpers.
6. Fix any persistence/seed/CI/runtime gaps exposed by fresh-stack runs.
7. Add documentation/progress updates only after the tests prove the new readiness status.

Detailed phase order:

Phase 1 - Canonical fixture corpus and registry

- Create a committed fixture tree under `frontend/e2e/test-assets/ocr-forms/` with one directory per document label.
- Prefer PNGs for text-centric OCR fixtures to avoid PDF preprocessing dependence unless the layout specifically requires PDF realism.
- Add a machine-readable manifest (TS or JSON) that records:
  - combo applicability
  - expected document label
  - expected artifact type
  - expected present fields
  - expected missing fields
  - expected low-confidence or unsupported fields
- Encode separate variants only when the matrix or rule-pack logic actually differs by combo.

Phase 2 - Classifier completeness by document label

- Expand `evidence.document-classifier.spec.ts` from the current three tests into a fixture-backed matrix.
- Add explicit unit cases for:
  - `Phytosanitary Certificate` base case
  - `Phytosanitary Certificate` combo-specific cases: `JAPAN/MANGO`, `JAPAN/MANGOSTEEN`, `KOREA/MANGOSTEEN`
  - `VHT Certificate` cases: `JAPAN/MANGO`, `JAPAN/MANGOSTEEN`, `KOREA/MANGO`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`
  - `Export License`
- Only after RED, extend classifier extraction/scoring logic. The current code mostly extracts common generic fields and only has special logic for phytosanitary declarations.

Phase 3 - Representative orchestration and persistence tests

- Extend `evidence.service.spec.ts` so reanalysis/upload orchestration is not only proven for `PHYTO_CERT`.
- Add representative tests for:
  - `VHT_CERT`
  - `MRL_TEST`
  - `GAP_CERT`
  - `INVOICE` with different matrix labels selected from OCR text
- Add one DB-backed persistence/hydration case for a non-phyto trade document, if that improves confidence without excessive test cost.

Phase 4 - Browser E2E readiness matrix

- Keep `frontend/e2e/evidence-ocr.spec.ts` as the simplest smoke path.
- Add `frontend/e2e/evidence-ocr-matrix.spec.ts` that parameterizes committed fixture uploads by scenario.
- Split browser assertions into three groups:
  - smoke: one path per document family
  - combo-specific: only when matrix-required fields differ
  - action paths: `Reanalyze` and `Backfill Missing Analysis`
- Do not create 72 redundant browser tests if a smaller set of representative paths plus unit coverage can prove the same runtime contract. Only add full browser duplication where combo-specific UI/persistence behavior differs.

Phase 5 - Readiness accounting and docs

- Introduce a committed readiness manifest or generated report that marks each combo/template pair as ready only when all required evidence exists.
- Use it to drive human-readable documentation in `docs/PROGRESS.md` and possibly a future operator-facing OCR test inventory.

### Test Coverage

- `src/modules/evidence/document-matrix.spec.ts`
  - keep combo parity with live rule files
  - add explicit assertions for all `9` document labels and override-bearing combos
- `src/modules/evidence/evidence.document-classifier.spec.ts`
  - one fixture-backed case per supported document label
  - extra cases for combo-specific field overrides
  - one unsupported/ambiguous negative case per artifact family where useful
- `src/modules/evidence/evidence.service.spec.ts`
  - upload/reanalysis orchestration for each analyzable artifact type family
- `src/modules/evidence/evidence.pg-store.spec.ts`
  - latest-analysis hydration for representative non-phyto labels
- `test/evidence.e2e-spec.ts`
  - upload route plus artifact detail returning `latestAnalysis`
- `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx`
  - rendering for more than one document label and low-confidence/missing field states
- `frontend/e2e/evidence-ocr.spec.ts`
  - keep single end-to-end smoke for upload -> OCR -> UI
- `frontend/e2e/evidence-ocr-matrix.spec.ts`
  - parameterized ready-combo browser coverage

### Decision Completeness

- Goal
  - Make every currently supported matrix combo (`9` combos) operationally ready for OCR/form-completeness with committed fixtures, classifier coverage, orchestration coverage, and browser proof of rendered analysis.
- Non-goals
  - Add China or longan OCR support before their rule support exists.
  - Add operational evidence OCR for `CHECKPOINT_PHOTO`, `TEMP_DATA`, or `HANDOFF_SIGNATURE`.
  - Introduce a first-class fumigation artifact type unless current matrix/document modeling becomes insufficient.
- Success criteria
  - Every required matrix document label has a committed canonical fixture.
  - Every combo-specific matrix override has at least one committed fixture and passing classifier test.
  - Browser E2E coverage proves persisted OCR field completeness for each live combo via representative uploads.
  - A committed readiness table/report can truthfully mark every supported combo `READY = yes`.
- Public interfaces changed
  - none required by default
  - possible new committed fixture manifest under `frontend/e2e/test-assets/ocr-forms/`
  - possible docs/report file for readiness inventory
- Edge cases / failure modes
  - OCR drift from environment/font rendering
  - overfitting fixtures to current regexes rather than realistic forms
  - false confidence from reusing one generic trade-document layout across semantically distinct labels
  - CI runtime differences if Tesseract language packages drift
- Rollout / backout
  - additive only; backout is reverting fixture and test additions plus any classifier changes
  - no migration or API rollback expected
- Acceptance checks
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- test/evidence.e2e-spec.ts`
  - `cd frontend && npm run typecheck`
  - `cd frontend && npm run test:e2e:list`
  - `cd frontend && npm run test:e2e -- e2e/evidence-ocr.spec.ts`
  - targeted `cd frontend && npm run test:e2e -- e2e/evidence-ocr-matrix.spec.ts`
  - `npm run lint`
  - `npm run typecheck`

### Dependencies

- Existing authoritative rule packs under `rules/` for the `9` supported combos
- `rules/document-matrix.yaml` as the canonical first-pass OCR scope
- Tesseract runtime and language packs in CI/local Playwright flows
- Committed OCR fixture corpus to be authored

### Validation

- Build the fixture corpus first, but do not mark readiness from fixture existence alone.
- RED-first on classifier tests for each missing label/override.
- Then browser E2Es in phases with fresh-stack startup.
- Repeat the critical smoke/browser matrix runs 3 times sequentially after each phase to detect flake.

### Wiring Verification

| Component                          | Entry Point                                         | Registration Location                                                                  | Schema/Table                                                                     |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| OCR fixture corpus                 | Playwright/browser E2E and classifier fixture tests | `frontend/e2e/**`, `src/modules/evidence/*.spec.ts`                                    | N/A                                                                              |
| Fixture registry/manifest          | test loaders and E2E parameterization               | new helper module under `frontend/e2e/helpers` or `src/modules/evidence/test-fixtures` | N/A                                                                              |
| classifier extraction improvements | `MatrixDrivenEvidenceDocumentClassifier.analyze()`  | `src/modules/evidence/evidence.module.ts` DI wiring already exists                     | `evidence_artifact_analyses.field_completeness` via service/store                |
| browser OCR matrix E2E             | Evidence tab upload UI                              | `frontend/e2e/*.spec.ts`                                                               | persisted `evidence_artifact_analyses` rows read through `/api/zrl/evidence/:id` |
| readiness report                   | docs or generated artifact                          | docs or test helper wiring                                                             | N/A                                                                              |

## Plan Draft B

### Overview

Minimize browser-E2E explosion by treating classifier fixture coverage as the main proof and requiring only one or two browser E2Es per document family plus one per combo-specific override family. This gets to truthful readiness faster with less CI cost, but it relies more heavily on source-level tests and less on full upload/UI repetition.

### Files To Change

- same core files as Draft A, but prefer a shared fixture library colocated under `src/modules/evidence/test-fixtures/`
- smaller browser E2E surface under `frontend/e2e/evidence-ocr.spec.ts` plus one additional matrix spec for overrides only

### Implementation Steps

1. Build a backend-owned canonical fixture corpus with manifest entries for every label/override.
2. Drive classifier tests directly from that corpus.
3. Add one browser E2E per document family:
   - phytosanitary
   - treatment/VHT
   - lab report
   - certification/GAP
   - trade documents
4. Add one browser E2E per combo-specific override family:
   - `JAPAN/MANGO` phyto/VHT
   - `JAPAN/MANGOSTEEN` phyto/VHT
   - `KOREA/MANGO` VHT
   - `KOREA/MANGOSTEEN` phyto fumigation
5. Mark combo readiness from the combined matrix of classifier + browser coverage instead of one browser test per combo/document permutation.

### Test Coverage

- heavier on `evidence.document-classifier.spec.ts`
- lighter browser count
- same service/store coverage expectations

### Decision Completeness

- Goal
  - same as Draft A
- Non-goals
  - same as Draft A
- Success criteria
  - every combo/document requirement is backed by either direct browser proof or shared fixture-backed classifier proof, with browser coverage for each family and each override pattern
- Trade-off
  - less CI time, but more reasoning required to justify `READY = yes`

### Dependencies

- same as Draft A

### Validation

- prioritize fixture-driven unit coverage first
- keep browser matrix small and stable

### Wiring Verification

| Component                 | Entry Point                                          | Registration Location                 | Schema/Table                           |
| ------------------------- | ---------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| shared OCR fixtures       | classifier tests and optional browser upload helpers | evidence tests + frontend E2E helpers | N/A                                    |
| family-level browser E2Es | Evidence tab upload UI                               | `frontend/e2e`                        | persisted `evidence_artifact_analyses` |

## Comparative Analysis

### Strengths

- Draft A gives the clearest human-auditable path from combo requirements to runtime/browser evidence.
- Draft B reduces CI volume and duplicate browser time while still preserving good confidence if the fixture manifest is strong.

### Gaps

- Draft A risks overbuilding too many browser tests if implemented mechanically.
- Draft B makes `READY = yes` more dependent on a carefully maintained readiness manifest and clear traceability from fixture to combo.

### Trade-offs

- Draft A optimizes for explicitness and low ambiguity.
- Draft B optimizes for maintainability and CI speed.

### Compliance With Repo Best Practices

- Both drafts preserve the current additive evidence-analysis model and reuse existing matrix/rule-pack wiring.
- Both avoid inventing new top-level runtime architecture.
- Draft B better follows the repo preference for minimal correct changes, provided the readiness accounting stays explicit.

## Unified Execution Plan

### Overview

Use a hybrid of Draft A and Draft B.

Make every current OCR combo `READY = yes` by building a committed canonical fixture corpus for all `9` matrix document labels and all combo-specific override variants, then use that corpus in two ways:

- exhaustive classifier-level coverage for every label and override
- selective browser E2E coverage for every live combo plus every override family, without multiplying redundant full-browser cases for every label in every combo

This preserves truthfulness, leverages the already completed exhaustive rule-pack work, and keeps CI/runtime cost acceptable.

The existing exhaustive combo work already gives the program strong invariants:

- which combos are truly supported is already encoded in `rules/*.yaml` and proven by `document-matrix.spec.ts`
- document requirement truth has already been established in rule-pack and progress logs
- some combos have specific non-pesticide/document nuances already locked down:
  - `JAPAN/MANGO`: phyto statements + cultivar/treatment/VHT nuance
  - `JAPAN/DURIAN`: no VHT, standard phyto only
  - `JAPAN/MANGOSTEEN`: VHT restored, steam-heat/humidity/cooling details
  - `KOREA/MANGO`: VHT/overseas inspection path
  - `KOREA/DURIAN`: no VHT, simple phyto path
  - `KOREA/MANGOSTEEN`: MB fumigation details belong on `PHYTO_CERT`, not a fabricated separate artifact
  - EU combos: no VHT, shared trade-document expectations, explicit ambiguity for `Export License`

### Files To Change

- `frontend/e2e/test-assets/ocr-forms/manifest.ts` or `manifest.json`
- `frontend/e2e/test-assets/ocr-forms/phyto/*.png`
- `frontend/e2e/test-assets/ocr-forms/vht/*.png`
- `frontend/e2e/test-assets/ocr-forms/mrl/*.png`
- `frontend/e2e/test-assets/ocr-forms/gap/*.png`
- `frontend/e2e/test-assets/ocr-forms/trade/*.png`
- `frontend/e2e/evidence-ocr.spec.ts`
- `frontend/e2e/evidence-ocr-matrix.spec.ts`
- `frontend/e2e/helpers/backend.ts`
- `frontend/e2e/helpers/ocr-fixtures.ts`
- `src/modules/evidence/evidence.document-classifier.ts`
- `src/modules/evidence/evidence.document-classifier.spec.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `src/modules/evidence/evidence.pg-store.spec.ts`
- `test/evidence.e2e-spec.ts`
- `.github/workflows/ci.yml`
- `docs/PROGRESS.md`

### Implementation Steps

1. Freeze the readiness definition
   - Add a human-readable planning note or manifest comments that define `READY = yes` exactly:
     - committed fixture coverage exists for every required label and every override-bearing combo
     - classifier proof exists for every supported label/override
     - browser proof exists for each live combo and each override-bearing family
     - no reliance on `.local` files or runtime-generated-only assets

2. Build the committed fixture corpus
   - Create canonical OCR-visible fixtures for these `9` matrix labels:
     - `Phytosanitary Certificate`
     - `VHT Certificate`
     - `MRL Test Results`
     - `GAP Certificate`
     - `Commercial Invoice`
     - `Packing List`
     - `Transport Document`
     - `Delivery Note`
     - `Export License`
   - Use PNGs by default, generated cleanly from text/layout templates and committed to the repo.
   - Add variant fixtures only where matrix or rule semantics differ:
     - `phyto-japan-mango`
     - `phyto-japan-mangosteen`
     - `phyto-korea-mangosteen`
     - `vht-japan-mango`
     - `vht-japan-mangosteen`
     - `vht-korea-mango`
     - one base `phyto-common`
     - one base `mrl-common`
     - one base `gap-common`
     - one base each for the five trade-document labels

3. Expand classifier logic and tests first
   - Add RED fixture-backed unit cases per label and override.
   - Extend `evidence.document-classifier.ts` minimally, likely by:
     - adding extraction regexes/metadata mapping for currently uncovered labels
     - adding explicit per-label extraction helpers only where the common-field extractor becomes too muddy
     - adding combo-specific field derivation for:
       - `JAPAN/MANGOSTEEN` phyto `packageMarkingForJapan`
       - `KOREA/MANGOSTEEN` phyto `fumigationDetails`
       - all `VHT` override fields now only documented in the matrix, not actually extracted today
   - Keep unsupported/fail-closed behavior when a fixture does not match confidently.

4. Add representative service/store/backend E2E coverage
   - Extend service tests so each artifact family is proven through upload/reanalysis orchestration.
   - Add a backend HTTP E2E path that proves uploaded evidence can later surface persisted `latestAnalysis` for at least one non-phyto label.

5. Add browser E2E readiness coverage
   - Keep the existing smoke `frontend/e2e/evidence-ocr.spec.ts`.
   - Add a parameterized `evidence-ocr-matrix.spec.ts` with one browser case per live combo using the most combo-relevant required document:
     - `EU/DURIAN` -> base phyto or MRL
     - `EU/MANGO` -> base phyto or GAP
     - `EU/MANGOSTEEN` -> base phyto or MRL
     - `JAPAN/DURIAN` -> base phyto
     - `JAPAN/MANGO` -> phyto override fixture
     - `JAPAN/MANGOSTEEN` -> VHT or phyto override fixture
     - `KOREA/DURIAN` -> base phyto
     - `KOREA/MANGO` -> VHT override fixture
     - `KOREA/MANGOSTEEN` -> phyto fumigation override fixture
   - Add one additional browser test per important non-phyto document family if the UI rendering or classifier path differs materially.

6. Add readiness accounting
   - Create a manifest-driven report or tested table that maps:
     - combo
     - required documents
     - committed fixtures present
     - classifier tests present
     - browser proofs present
     - readiness boolean
   - This can live as a TS module used by tests, plus a docs export if helpful.

7. Validate in widening rings
   - fixture-backed classifier tests
   - service/store/backend E2E
   - focused browser OCR matrix
   - repeat critical browser tests 3 sequential times
   - full lint/typecheck

### Test Coverage

- Matrix structure
  - `src/modules/evidence/document-matrix.spec.ts`
- Classifier correctness
  - `src/modules/evidence/evidence.document-classifier.spec.ts`
  - target: full label and override coverage
- Upload/reanalysis orchestration
  - `src/modules/evidence/evidence.service.spec.ts`
- Persistence hydration
  - `src/modules/evidence/evidence.pg-store.spec.ts`
- Backend HTTP wiring
  - `test/evidence.e2e-spec.ts`
- UI rendering and action wiring
  - `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx`
- Browser OCR happy paths
  - `frontend/e2e/evidence-ocr.spec.ts`
  - `frontend/e2e/evidence-ocr-matrix.spec.ts`

### Decision Completeness

- Goal
  - Truthfully mark all `9` supported OCR/form combos as ready.
- Non-goals
  - Expand beyond the current matrix or invent new artifact types prematurely.
- Measurable success criteria
  - Every current combo has at least one passing browser OCR path using a committed fixture.
  - Every current required document label has a committed fixture and passing classifier proof.
  - Every override-bearing combo has explicit fixture + classifier proof for the override fields.
  - Readiness manifest/table shows no missing entries.
- Public interfaces
  - new committed fixture corpus and possibly a readiness-manifest module
  - no required API/schema changes expected
- Edge cases / failure modes
  - OCR drift, false-positive document scoring among trade docs, over-reliance on metadata for labels that should be OCR-visible
- Rollout / backout
  - additive only; revert fixtures/tests/classifier deltas if needed
- Acceptance checks
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- test/evidence.e2e-spec.ts`
  - `cd frontend && npm run test:e2e -- e2e/evidence-ocr.spec.ts`
  - `cd frontend && npm run test:e2e -- e2e/evidence-ocr-matrix.spec.ts`
  - repeat the browser OCR matrix 3 times sequentially
  - `cd frontend && npm run typecheck`
  - `npm run lint`
  - `npm run typecheck`

### Dependencies

- already completed exhaustive rule packs and their documented invariants
- current document matrix
- CI OCR runtime packages
- committed fixture authoring effort

### Validation

- Phase gates:
  - Gate 1: committed fixtures + classifier coverage for all labels
  - Gate 2: override-bearing combos proven in classifier tests
  - Gate 3: service/store/backend E2E representative paths green
  - Gate 4: browser OCR matrix green
  - Gate 5: readiness report shows all `READY = yes`

### Wiring Verification

| Component                          | Entry Point                                                                                    | Registration Location                                              | Schema/Table                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| fixture corpus                     | classifier tests + Playwright uploads                                                          | `frontend/e2e/test-assets/ocr-forms/**`, helper modules            | N/A                                                |
| classifier extraction improvements | `EvidenceService.runArtifactAnalysis()` via `MatrixDrivenEvidenceDocumentClassifier.analyze()` | `src/modules/evidence/evidence.module.ts`                          | `evidence_artifact_analyses.field_completeness`    |
| browser OCR matrix                 | Evidence tab upload -> `/api/zrl/lanes/:id/evidence` -> `/api/zrl/evidence/:id`                | existing frontend lane detail + evidence controller/service wiring | `evidence_artifacts`, `evidence_artifact_analyses` |
| readiness manifest/report          | tests/docs                                                                                     | helper module + docs                                               | N/A                                                |

## 2026-04-08 13:02 ICT

- Goal: Implement Task Master `34.9.1` by creating the committed canonical OCR fixture corpus baseline for all 9 first-pass document labels.
- What changed:
  - `frontend/e2e/test-assets/ocr-forms/manifest.json`: Added the canonical OCR fixture manifest for the current first-pass matrix. It records every document label, artifact type, committed asset path, and applicable combos.
  - `frontend/e2e/test-assets/ocr-forms/official/phytosanitary-certificate-base.svg`: Added a committed base phytosanitary form asset.
  - `frontend/e2e/test-assets/ocr-forms/treatment/vht-certificate-base.svg`: Added a committed base treatment/VHT form asset.
  - `frontend/e2e/test-assets/ocr-forms/lab/mrl-test-results-base.svg`: Added a committed base MRL lab-report asset.
  - `frontend/e2e/test-assets/ocr-forms/certifications/gap-certificate-base.svg`: Added a committed base GAP certificate asset.
  - `frontend/e2e/test-assets/ocr-forms/trade/*.svg`: Added committed base trade-document assets for `Commercial Invoice`, `Packing List`, `Transport Document`, `Delivery Note`, and `Export License`.
  - `src/modules/evidence/document-matrix.spec.ts`: Added a guard test that loads `rules/document-matrix.yaml`, reads the committed OCR fixture manifest, asserts exact document-label parity, and verifies each manifest asset path exists on disk.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` failed with `ENOENT: no such file or directory, open '.../frontend/e2e/test-assets/ocr-forms/manifest.json'`, proving the committed corpus was missing.
  - GREEN: the same command passed after adding the manifest and base SVG assets.
  - Note: an initial RED attempt hit a Jest JSON dynamic-import limitation; I adjusted the test to use `readFile()` so the failure reflected the actual missing manifest instead of the runner limitation.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` -> passed.
  - same focused test repeated twice -> passed both times.
  - `cd frontend && npm run typecheck` -> passed.
  - `npm run lint` -> passed.
- Wiring verification evidence:
  - The new corpus is intentionally not wired into runtime product code yet; for `34.9.1` it is a committed source-of-truth test asset set consumed by the new backend guard test.
  - `src/modules/evidence/document-matrix.spec.ts` now links the fixture corpus back to `rules/document-matrix.yaml`, so later fixture additions/removals cannot silently drift away from the current supported first-pass document labels.
- Behavior changes and risk notes:
  - This phase only establishes the committed baseline corpus. It does not yet add combo-specific override variants or classifier/browser consumption.
  - Assets are SVG rather than PDF/PNG to keep them reviewable and deterministic in git. Later phases can rasterize or consume them as needed for OCR execution.
- Follow-ups and known gaps:
  - The corpus currently contains one base asset per matrix label only; override-bearing combos still need dedicated variants in the next slice.
  - No browser or classifier code consumes the manifest yet; that belongs to later `34.9` phases.

## Review (2026-04-08 13:07 ICT) - working-tree 34.9.1 fixture corpus

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: current working tree
- Scope: `34.9.1` committed OCR fixture corpus baseline (`frontend/e2e/test-assets/ocr-forms/**`, `src/modules/evidence/document-matrix.spec.ts`)
- Commands Run: focused `document-matrix` jest runs x3, `cd frontend && npm run typecheck`, `npm run lint`, targeted file inspection

### Findings

No findings.

Residual risks / gaps:

- The new corpus is intentionally only the base-label layer; combo-specific override fixtures are still required before the broader OCR readiness program can claim full coverage.
- The assets are reviewable SVG templates rather than already-rasterized OCR binaries, so later phases need to standardize how tests consume or rasterize them for classifier/browser OCR runs.

### Open Questions / Assumptions

- Assumed SVG is the right committed canonical source format for this phase because it is deterministic, reviewable in git, and can be transformed later without locking the repo into one rasterization pipeline yet.

### Recommended Tests / Validation

- Next phase should add one consumer test that loads the manifest directly in frontend/helpers or classifier test code, not just the backend parity guard.
- When combo-specific variants are added, extend the guard to assert at least one override fixture exists for each override-bearing matrix combo.

### Rollout Notes

- No runtime product behavior changed in this slice.
- The new manifest/test pairing makes future fixture drift against `rules/document-matrix.yaml` visible early.

## 2026-04-08 13:22 ICT

- Goal: Implement the combo-specific override fixture slice after `34.9.1` by adding committed OCR variants for every matrix document/market combo with `marketSpecificFieldRules`.
- What changed:
  - `frontend/e2e/test-assets/ocr-forms/manifest.json`: Extended the base fixture manifest with `variants` entries for all override-bearing combos.
  - Added override-specific phytosanitary fixture assets:
    - `frontend/e2e/test-assets/ocr-forms/official/phytosanitary-certificate-japan-mango.svg`
    - `frontend/e2e/test-assets/ocr-forms/official/phytosanitary-certificate-japan-mangosteen.svg`
    - `frontend/e2e/test-assets/ocr-forms/official/phytosanitary-certificate-korea-mangosteen.svg`
  - Added override-specific treatment/VHT fixture assets:
    - `frontend/e2e/test-assets/ocr-forms/treatment/vht-certificate-japan-mango.svg`
    - `frontend/e2e/test-assets/ocr-forms/treatment/vht-certificate-japan-mangosteen.svg`
    - `frontend/e2e/test-assets/ocr-forms/treatment/vht-certificate-korea-mango.svg`
  - `src/modules/evidence/document-matrix.spec.ts`: Added a guard test that derives every override-bearing combo from `rules/document-matrix.yaml`, verifies a manifest variant exists for each one, checks exact override-field parity, and asserts the variant asset path exists on disk.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` failed with `expect(received).toBeDefined()` for the missing override variant entry.
  - GREEN: the same command passed after adding the six variant assets and manifest entries.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` -> passed.
  - same focused test repeated twice -> passed both times.
  - `cd frontend && npm run typecheck` -> passed.
  - `npm run lint` -> passed.
- Wiring verification evidence:
  - The override corpus remains a committed source-of-truth asset layer, still intentionally not wired into runtime product code yet.
  - The new guard test now ties variant existence and declared override keys directly back to the matrix `marketSpecificFieldRules`, so later fixture/classifier work cannot drift silently on override-bearing combos.
- Behavior changes and risk notes:
  - This slice completes the committed override-fixture layer only. Runtime classifier extraction still does not consume most of these override fields yet; that belongs to the next classifier-completeness phase.
  - The manifest now has a stable minimal structure for later phases: one base asset per document plus optional `variants` with `combo`, `assetPath`, and `requiredFieldKeys`.
- Follow-ups and known gaps:
  - The next phase should consume these variant fixtures in classifier/unit tests so the override assets become executable evidence, not only committed inventory.
  - Trade-document labels currently have no combo-specific overrides, so they remain base-only fixtures for now.

## Review (2026-04-08 13:24 ICT) - working-tree 34.9.2 override fixture corpus

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: current working tree
- Scope: override-bearing OCR fixture variants in `frontend/e2e/test-assets/ocr-forms/**` plus the matrix guard in `src/modules/evidence/document-matrix.spec.ts`
- Commands Run: focused `document-matrix` jest runs x3, `cd frontend && npm run typecheck`, `npm run lint`, targeted file inspection

### Findings

No findings.

Residual risks / gaps:

- The new variants are inventory-level proof only until classifier/browser tests actually consume them.
- The manifest structure is still JSON-only; if later phases need richer comments or generated expectations, a TypeScript companion may still be useful.

### Open Questions / Assumptions

- Assumed the override fixture scope is complete because the current matrix only declares `marketSpecificFieldRules` for `Phytosanitary Certificate` and `VHT Certificate`.

### Recommended Tests / Validation

- Next phase should add fixture-driven classifier tests for all six override variants.
- After classifier consumption exists, add one browser matrix test per override family rather than only relying on manifest parity.

### Rollout Notes

- No runtime product behavior changed in this slice.
- This materially reduces the risk of later claiming combo-specific OCR readiness without committed override assets on disk.

## 2026-04-08 13:36 ICT

- Goal: Implement the richer fixture-expectation manifest slice after the base and override corpus so later classifier/browser tests can consume canonical expected completeness data from one source.
- What changed:
  - `frontend/e2e/test-assets/ocr-forms/manifest.json`: Enriched every base fixture entry with `expectedFieldCompleteness` containing canonical `presentFieldKeys`, `missingFieldKeys`, `lowConfidenceFieldKeys`, and `unsupportedFieldKeys` arrays. Also enriched every override variant with its own `expectedFieldCompleteness` payload.
  - `src/modules/evidence/document-matrix.spec.ts`: Strengthened the fixture-manifest guards so they now require executable expectation payloads, not only inventory entries. The test verifies every base document has expected completeness arrays and every override variant includes expected completeness that contains its matrix override fields.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` failed because `document.expectedFieldCompleteness` and `variant.expectedFieldCompleteness` were undefined in the manifest.
  - GREEN: the same command passed after enriching the manifest with explicit completeness payloads.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/document-matrix.spec.ts` -> passed.
  - same focused test repeated twice -> passed both times.
  - `cd frontend && npm run typecheck` -> passed.
  - `npm run lint` -> passed.
- Wiring verification evidence:
  - The richer manifest is still intentionally a committed fixture registry rather than runtime product state.
  - The backend guard test now ties fixture expectations to the current matrix shape closely enough that later classifier/browser tests can consume the manifest as executable expected-output data instead of re-encoding expectations per test.
- Behavior changes and risk notes:
  - This slice still does not change runtime OCR behavior. It upgrades the fixture registry from asset inventory to expectation-bearing test data.
  - The present/missing field expectations are currently canonical author intent for the committed SVG fixtures; the next classifier-test slice must prove the runtime actually matches them.
- Follow-ups and known gaps:
  - A loader/helper module for consuming the manifest in classifier/browser tests is still pending; for this slice the JSON file remains the canonical source and the backend guard test is the only direct consumer.
  - The classifier currently cannot satisfy many of these expectations yet, especially the override-bearing fields. That is the next implementation slice.

## Review (2026-04-08 13:38 ICT) - working-tree 34.9.3 expectation manifest

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: current working tree
- Scope: enriched OCR fixture expectation manifest in `frontend/e2e/test-assets/ocr-forms/manifest.json` and the stronger parity guards in `src/modules/evidence/document-matrix.spec.ts`
- Commands Run: focused `document-matrix` jest runs x3, `cd frontend && npm run typecheck`, `npm run lint`, targeted file inspection

### Findings

No findings.

Residual risks / gaps:

- The expectation payloads are only as good as the committed fixture text and author intent until classifier/browser tests start consuming them.
- The manifest is still JSON, so it does not yet give type-safe imports to frontend/backend tests.

### Open Questions / Assumptions

- Assumed keeping the richer expectation registry in JSON is acceptable for this slice because the next consumer phase can still add a thin typed loader without changing the canonical data file.

### Recommended Tests / Validation

- Next phase should add a typed loader/helper for this manifest and immediately consume it from `evidence.document-classifier.spec.ts`.
- After classifier consumption exists, add a browser helper that can map a fixture entry directly to upload expectations.

### Rollout Notes

- No runtime product behavior changed in this slice.
- This makes future OCR readiness work less duplicative because expected field-completeness is now centralized instead of being re-encoded ad hoc in each test.

## 2026-04-08 16:52 ICT

- Goal: Implement the next OCR readiness slice after `34.9.3` by adding a typed manifest/helper layer and consuming the committed fixture registry from backend tests instead of re-encoding fixture expectations inline.
- What changed:
  - `src/modules/evidence/ocr-fixture-manifest.ts`: Added a typed loader/parser for `frontend/e2e/test-assets/ocr-forms/manifest.json`, plus small helpers to read committed fixture assets and convert SVG text layers into deterministic OCR-like plain text for backend tests.
  - `src/modules/evidence/ocr-fixture-manifest.spec.ts`: Added focused coverage proving the manifest loads through the typed helper and that committed SVG fixtures can be converted into stable text inputs.
  - `src/modules/evidence/document-matrix.spec.ts`: Replaced the duplicated inline JSON manifest parsing with the shared typed manifest loader so the matrix guards now exercise the same helper that later classifier/browser tests can reuse.
  - `src/modules/evidence/evidence.document-classifier.spec.ts`: Reworked the phyto coverage to consume committed fixture data through the new helper, covering both the base phytosanitary fixture and the `JAPAN/MANGO` override fixture with manifest-backed field-completeness expectations.
  - `src/modules/evidence/evidence.document-classifier.ts`: Tightened the minimal phyto extraction needed for the committed fixtures by adding explicit extraction for `packageDescription`, `commodityDescription`, `authorizedOfficer`, and `treatmentReference`, and by narrowing `shipmentReference` extraction so phyto treatment-reference lines do not get misclassified.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` initially failed because the new SVG helper flattened fixture text too aggressively into one line and because the phyto extractor did not yet read several committed fixture fields.
  - GREEN: the same focused command passed after preserving line boundaries in the SVG helper, adding the minimal phyto extraction fields, and tightening the manifest-backed expectations in the classifier spec.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` -> passed.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - `document-matrix.spec.ts` and `evidence.document-classifier.spec.ts` now both consume the same typed helper path in `ocr-fixture-manifest.ts`, so future OCR readiness slices can reuse one canonical manifest loader instead of parsing JSON ad hoc in each test.
  - The new helper reads the already-committed fixture assets under `frontend/e2e/test-assets/ocr-forms/**`, keeping test truth anchored to committed corpus files rather than inline OCR text literals.
  - The classifier changes remain local to the evidence module and only extend existing extraction logic; no module wiring or runtime upload flow changed.
- Behavior changes and risk notes:
  - Runtime product behavior is unchanged for this slice; the helper is currently test-only infrastructure and the classifier extension only makes existing phyto extraction less shallow.
  - Classifier coverage is still narrow overall: this slice only converts the base phyto and `JAPAN/MANGO` phyto override paths to manifest-backed fixture tests.
- Follow-ups and known gaps:
  - The same manifest/helper path should now be extended across the remaining base labels and override variants in `evidence.document-classifier.spec.ts`.
  - Browser helpers still do not consume the typed manifest yet; that should land before the broader `evidence-ocr-matrix.spec.ts` rollout.

## 2026-04-08 17:32 ICT

- Goal: Implement the first backend consumer integration slice after `34.9.4` by making certification-expiry consumers use persisted OCR-derived expiry fields when raw artifact metadata is missing them.
- What changed:
  - `src/modules/rules-engine/rules-engine.types.ts`: Extended the lane-artifact and certification-scan artifact shapes with optional `latestAnalysisExtractedFields` so downstream rules logic can consume persisted OCR output without treating it as source truth.
  - `src/modules/lane/lane.pg-store.ts`: Updated `listEvidenceArtifactsForLane()` to hydrate the latest analysis extracted fields through a lateral join on `evidence_artifact_analyses`, so lane evaluation can see OCR-derived expiry data.
  - `src/modules/rules-engine/rules-engine.pg-store.ts`: Updated active certification scan queries to hydrate the same latest extracted fields for scheduled expiry warnings.
  - `src/modules/rules-engine/rules-engine.service.ts`: Kept metadata-first behavior but changed certification expiry parsing to fall back to `latestAnalysisExtractedFields.expiryDate` / related keys when metadata lacks expiry fields. Applied that shared fallback to upload-time alerts, lane certification status/checklist evaluation, and daily scan warning logic.
  - `src/modules/evidence/evidence.service.ts`: Changed the upload flow to pass the just-created OCR analysis extracted fields into the immediate certification alert hook, so upload-time alerting can benefit from OCR-derived expiry dates in the same request path.
  - `src/modules/rules-engine/rules-engine.service.spec.ts`: Added focused RED/GREEN coverage proving upload-time alerts, lane evaluation, and scheduled certification scans all honor OCR-derived expiry dates when metadata is missing.
  - `src/modules/evidence/evidence.service.spec.ts`: Added upload-path coverage proving `notifyCertificationAlertForArtifact()` receives OCR-extracted expiry fields after analysis completes.
- TDD evidence:
  - RED: focused rules/evidence tests initially failed because certification consumers only read raw artifact metadata and the upload path did not pass freshly generated OCR extracted fields into the immediate alert hook.
  - GREEN: the same focused suite passed after threading latest analysis extracted fields through the relevant artifact shapes and using them as a metadata fallback only for expiry parsing.
- Tests run and results:
  - `npm test -- --runInBand src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.service.spec.ts src/modules/lane/lane.service.spec.ts` -> passed.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - Upload-time path: `EvidenceService.persistArtifact()` now captures the result of `runArtifactAnalysis()` and passes `analysis.extractedFields` into `RulesEngineService.notifyCertificationAlertForArtifact(...)` through the existing certification-alert hook.
  - Lane evaluation path: `LaneStore.listEvidenceArtifactsForLane()` now returns `latestAnalysisExtractedFields`, and `RulesEngineService.evaluateLane()` consumes that through the existing certification status helpers.
  - Scheduled scan path: `RulesEngineStore.listLatestActiveCertificationArtifacts()` now returns the same extracted-field payload for `scanCertificationExpirations()`.
- Behavior changes and risk notes:
  - This slice is intentionally narrow: only certification expiry consumers use OCR-derived extracted fields, and only as a fallback when artifact metadata lacks expiry data.
  - MRL/lab parsing still reads source metadata only; that remains for later `34.7.x` slices.
- Follow-ups and known gaps:
  - Next backend integration slice should target the next smallest rules consumer, likely OCR-derived lab-result presence/shape checks before any broader numeric MRL parsing from OCR text.
  - The focused evidence suite still emits an existing non-failing mocked-path log about automatic artifact verification on one upload test path; this predates the new 34.7.1 change.

## 2026-04-08 18:39 ICT

- Goal: Implement `34.9.5` by extending manifest-backed classifier coverage beyond the initial phyto slice to the remaining committed base document labels and one representative VHT override path.
- What changed:
  - `src/modules/evidence/evidence.document-classifier.spec.ts`: Added manifest-driven classifier coverage for the remaining base non-override labels backed by committed fixtures:
    - `MRL Test Results`
    - `GAP Certificate`
    - `Commercial Invoice`
    - `Packing List`
    - `Transport Document`
    - `Delivery Note`
    - `Export License`
      and added one representative VHT override case for `KOREA/MANGO`.
  - `src/modules/evidence/evidence.document-classifier.ts`: Extended the matrix-driven extractor just enough to read the structured fields exposed by those committed fixtures, including:
    - VHT fields such as `commodityName`, `treatmentFacility`, `treatmentDate`, `treatmentMethod`, `operatorOrInspector`, `overseasInspectionReference`
    - MRL report fields such as `accreditationReference`, `sampleId`, `sampleOriginCountry`, `sampleReceiptDate`, `analysisDate`, `analyticalMethod`, `analyteTable`, `authorizedSignatory`
    - GAP fields such as `schemeName`, `farmOrSiteId`, `farmLocation`, `certificationBody`
    - trade-document fields across invoice, packing list, transport document, delivery note, and export license
  - The extractor was also tightened to avoid cross-document leakage from overly broad generic regexes. In particular:
    - `authorizedOfficer` no longer piggybacks on `authorized signatory`
    - `placeOfOrigin` and `packageDescription` are restricted so trade/lab documents do not accidentally populate phyto-only fields
    - `laboratoryName` matching now prefers `laboratory name` / `lab name` rather than any bare `laboratory` token
    - VHT-specific regexes for `targetCoreTemperatureC` and `linkedPhytoCertificateNumber` were narrowed to the committed form layouts
  - The VHT base fixture was intentionally not asserted as a standalone base case because every live supported VHT combo in the matrix carries override-specific required fields. The slice instead uses the committed `KOREA/MANGO` override fixture as the representative VHT classifier proof.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` initially failed because the classifier still lacked many structured fields for the committed trade/MRL/GAP fixtures and a few generic regexes were overmatching across document families.
  - Subsequent RED iterations exposed two real subtleties:
    - VHT base fixtures cannot be asserted against a live supported combo without override-required fields
    - the committed Korea VHT override fixture intentionally omits one base VHT field (`lotOrConsignmentId`), so the spec had to assert the shared present fields actually present in the committed asset rather than every theoretical base VHT field
  - GREEN: the focused OCR suite passed after adding the missing field extraction, narrowing the over-broad regexes, and adjusting the VHT coverage to match the real committed fixtures and matrix semantics.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` -> initial RED on the intended new classifier assertions.
  - same focused command -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - The new classifier logic remains in `MatrixDrivenEvidenceDocumentClassifier.analyze()` and is exercised through the existing evidence module DI wiring; no new runtime entry points were introduced.
  - `evidence.document-classifier.spec.ts` continues to consume the shared `ocr-fixture-manifest.ts` helper, so the test truth stays anchored to the committed fixture corpus rather than inline OCR strings.
  - `document-matrix.spec.ts`, `ocr-fixture-manifest.spec.ts`, and the expanded classifier spec all now use the same committed fixture registry, which keeps `34.9` slices aligned around one source of readiness truth.
- Behavior changes and risk notes:
  - Runtime classifier behavior is materially improved for the committed VHT, MRL, GAP, and trade-document forms in this slice, but exhaustive override coverage is still incomplete.
  - The extractor remains intentionally regex-driven and conservative; this slice improves fidelity for the committed fixtures without attempting to solve all OCR variance up front.
  - VHT coverage is still partial overall: only the `KOREA/MANGO` override was added in this slice, not the remaining VHT override fixtures.
- Follow-ups and known gaps:
  - The next OCR readiness slice should continue the same manifest-backed classifier strategy across the remaining override-bearing fixtures, especially the remaining phyto and VHT variants.
  - Browser helpers still do not consume the typed fixture manifest yet; that should happen before the broader browser OCR matrix rollout.

## 2026-04-08 19:27 ICT

- Goal: Implement `34.9.6` by extending manifest-backed classifier coverage across the remaining committed override-bearing fixtures that were still missing after `34.9.5`.
- What changed:
  - `src/modules/evidence/evidence.document-classifier.spec.ts`: Added manifest-backed override coverage for the remaining committed classifier override fixtures:
    - `JAPAN/MANGOSTEEN` phytosanitary certificate
    - `KOREA/MANGOSTEEN` phytosanitary certificate
    - `JAPAN/MANGO` VHT certificate
    - `JAPAN/MANGOSTEEN` VHT certificate
  - `src/modules/evidence/evidence.document-classifier.ts`: Added the missing structured extraction needed for those fixtures:
    - phyto override fields: `packageMarkingForJapan`, `fumigationDetails`
    - VHT override fields: `allowedVariety`, `maffVerificationReference`, `humidityRequirement`, `coolingRequirement`
  - The rest of the classifier behavior stayed unchanged; this slice only filled the remaining override field gaps required by the committed fixtures and matrix semantics.
- TDD evidence:
  - RED: `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` failed for the intended reason because those committed override fixtures were already classifying to the right document types, but the specific combo-required override fields were not yet extracted.
  - GREEN: the same focused OCR suite passed after adding the minimal override-field extraction for the committed phyto and VHT fixtures.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` -> initial RED on the new override assertions.
  - same focused command -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - The new extraction remains inside `MatrixDrivenEvidenceDocumentClassifier.analyze()` and uses the same committed fixture-manifest helper path already established in earlier `34.9` slices.
  - No runtime entry points, service wiring, or persistence behavior changed; this is a classifier-readiness slice only.
  - The expanded override spec now covers all currently committed matrix override fixtures except the already-covered `JAPAN/MANGO` phyto and `KOREA/MANGO` VHT paths from earlier slices.
- Behavior changes and risk notes:
  - Runtime classifier fidelity improves for the remaining committed override fixtures, but this is still fixture-driven readiness proof, not a claim that browser/runtime OCR is complete across all combos.
  - The extractor remains regex-driven and conservative; this slice intentionally filled only the exact override fields needed by the committed forms.
- Follow-ups and known gaps:
  - The remaining `34.9` work should now move to browser OCR matrix coverage and readiness accounting rather than more backend classifier fixture breadth.
  - Browser helpers still do not consume the typed fixture manifest yet; that should happen before the broader browser OCR matrix rollout.

## 2026-04-08 19:32 ICT

- Goal: Implement `34.9.7` as the first browser-readiness slice by removing the ad hoc generated OCR upload asset from the existing Playwright smoke test and switching that smoke path onto the committed fixture corpus through a shared helper.
- What changed:
  - `frontend/e2e/helpers/ocr-assets.ts`: Added a tiny helper that resolves and loads committed OCR fixtures from `frontend/e2e/test-assets/ocr-forms/**` as binary buffers suitable for Playwright file uploads.
  - `frontend/e2e/evidence-ocr.spec.ts`: Replaced the in-test canvas-generated phyto image with the committed `official/phytosanitary-certificate-japan-mango.svg` fixture loaded through the new helper. The smoke test now uploads a real committed asset instead of constructing a one-off image inline.
  - `frontend/src/lib/ocr-assets.test.ts`: Added a focused Jest test proving the new helper resolves the committed OCR fixture path correctly and loads the expected fixture contents as a binary buffer.
- TDD evidence:
  - RED: the first attempt placed the helper test under `frontend/e2e/helpers/`, which failed in two useful ways:
    - Jest did not discover it because frontend unit tests only include `src/**/*.test.{ts,tsx}`
    - Playwright test listing tried to execute it as an e2e file and failed because `describe` is not defined in the Playwright runtime
  - GREEN: moving the helper test into `frontend/src/lib/ocr-assets.test.ts` fixed the test-layer mismatch while keeping the Playwright smoke test change intact.
- Tests run and results:
  - `npm test -- --runInBand src/lib/ocr-assets.test.ts` -> passed.
  - repeated `npm test -- --runInBand src/lib/ocr-assets.test.ts` -> passed again.
  - `npm run test:e2e:list` -> passed and confirmed the Playwright suite now lists only real browser tests.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - The existing runtime browser smoke entry point remains `frontend/e2e/evidence-ocr.spec.ts`, which is still listed by `playwright test --list` after the change.
  - The smoke test now depends on the committed fixture corpus under `frontend/e2e/test-assets/ocr-forms/**` through a reusable helper instead of an inline canvas generator, which is the intended bridge into the later browser OCR matrix rollout.
  - No frontend route or backend API wiring changed in this slice.
- Behavior changes and risk notes:
  - This slice does not yet add more browser OCR scenarios; it makes the existing one truthful and reusable by anchoring it to committed assets.
  - The helper currently loads fixtures by relative path, not via the typed backend manifest helper. That is acceptable for this slice but should still be unified before the broader browser OCR matrix rollout if we want one shared manifest-driven source of truth across backend and frontend tests.
- Follow-ups and known gaps:
  - `34.9.8` should add the broader browser OCR matrix proof, likely by introducing a new `frontend/e2e/evidence-ocr-matrix.spec.ts` that uses the committed fixture helper for one real browser path per supported combo.
  - `34.9.9` should then cover readiness accounting/reporting so `READY = yes` is backed by committed classifier, browser, and backend proof.

## 2026-04-08 20:03 ICT

- Goal: Implement `34.9.8` by adding the broader browser OCR matrix proof: one real browser OCR path per currently supported combo, driven by committed fixtures rather than ad hoc generated assets.
- What changed:
  - `frontend/e2e/evidence-ocr-matrix.spec.ts`: Added a new Playwright matrix spec that creates a real lane for each supported combo and uploads one representative committed OCR fixture for that combo. The current matrix coverage is:
    - `EU/DURIAN` -> base phyto
    - `EU/MANGO` -> GAP
    - `EU/MANGOSTEEN` -> MRL
    - `JAPAN/DURIAN` -> base phyto
    - `JAPAN/MANGO` -> phyto override
    - `JAPAN/MANGOSTEEN` -> VHT override
    - `KOREA/DURIAN` -> base phyto
    - `KOREA/MANGO` -> VHT override
    - `KOREA/MANGOSTEEN` -> phyto override
  - `frontend/e2e/helpers/backend.ts`: Extended the browser helper result shape to include `documentLabel` so matrix tests can assert both OCR classification and field-completeness behavior.
  - `frontend/e2e/helpers/ocr-assets.ts`: Extended the committed-fixture helper so Playwright can render SVG fixture assets into PNG buffers before upload. This aligned the matrix browser flow with the current live OCR runtime behavior, which completed successfully for rendered PNG uploads but not for raw SVG uploads.
  - `frontend/e2e/evidence-ocr.spec.ts`: Updated the existing smoke test to use the same rendered-PNG fixture path so the single smoke flow and the broader matrix now share one browser upload strategy.
  - `frontend/src/lib/ocr-assets.test.ts`: Expanded the helper unit coverage to prove additional committed VHT fixture content is being loaded correctly.
- TDD evidence:
  - RED: the first browser matrix implementation uploaded raw committed SVG fixtures directly. Fast static checks passed, but a focused live Playwright run (`japan-mango-phyto-override`) failed because the uploaded artifact never reached OCR analysis completion within the poll timeout.
  - Investigation showed the lane/evidence UI upload path succeeded, but the backend analysis did not complete for raw SVG uploads in the live browser flow.
  - GREEN: switching the browser helper to render committed SVG fixtures into PNG buffers before upload aligned the matrix path with the already-working smoke behavior. After that change, focused live matrix runs passed for both:
    - `japan-mango-phyto-override`
    - `korea-mango-vht-override`
- Tests run and results:
  - `npm run test:e2e:list` -> passed and listed the new browser OCR matrix cases.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
  - `npm test -- --runInBand src/lib/ocr-assets.test.ts` -> passed.
  - repeated `npm test -- --runInBand src/lib/ocr-assets.test.ts` -> passed again.
  - `npm run test:e2e -- --project=chromium -g "browser OCR matrix proof for japan-mango-phyto-override"` -> passed after the PNG-render helper change.
  - `npm run test:e2e -- --project=chromium -g "browser OCR matrix proof for korea-mango-vht-override"` -> passed.
- Wiring verification evidence:
  - The new browser matrix spec is listed by `playwright test --list`, so it is wired into the existing Playwright suite.
  - Lane creation uses the existing `completeLaneCreationFlow()` helper and the existing live lane-creation scenarios, rather than a separate seeded-only harness.
  - Artifact analysis polling still uses the existing authenticated backend helper, so the new tests exercise the same browser + backend path already used by the OCR smoke test.
- Behavior changes and risk notes:
  - This slice materially increases browser-side readiness proof: there is now one committed-fixture browser OCR path mapped to each currently supported combo.
  - The matrix spec currently renders SVG fixtures to PNG before upload because that is what the live OCR/browser path proved reliable for. This is acceptable for readiness proof, but it means the browser matrix is still proving OCR behavior through rendered image uploads rather than raw SVG ingestion.
  - I only executed two focused live matrix cases in this implementation turn, not the full nine-case browser suite, to keep runtime bounded while still proving the new harness works across more than one artifact family.
- Follow-ups and known gaps:
  - `34.9.9` should now focus on readiness accounting/reporting so `READY = yes` becomes machine-checkable against classifier proof, backend integration proof, and browser proof.
  - If CI runtime permits later, running the full new browser matrix suite would provide stronger execution evidence beyond the two focused cases already exercised here.

## 2026-04-09 11:01 ICT

- Goal: Implement `34.9.9` as a strict machine-checkable OCR readiness ledger and gap report for every currently required `combo x document` slot.
- What changed:
  - `src/modules/evidence/ocr-readiness-ledger.ts`: Added a backend-owned readiness ledger builder that derives all current required slots from `rules/document-matrix.yaml`, enriches them with committed fixture coverage from the typed OCR manifest helper, and records current classifier/backend/browser proof status for each slot.
  - `src/modules/evidence/ocr-readiness-ledger.spec.ts`: Added focused tests proving the strict ledger enumerates all current required slots (`75`) and fails closed whenever any proof layer is incomplete.
  - `src/modules/evidence/document-matrix.spec.ts`: Added a guard proving the strict readiness ledger can be built for every current required slot and that its slot count matches the live matrix requirements.
  - `docs/OCR-READINESS-LEDGER.md`: Added a human-readable readiness report describing the strict ledger rules, current slot count, current fully-ready count, and why the strict standard still reports `0` fully-ready slots after representative browser coverage.
- TDD evidence:
  - No meaningful RED run was needed beyond the new focused ledger tests because this slice is additive reporting/ledger logic built directly on the already-completed matrix/fixture/classifier/browser state. The first focused run of the new ledger suite passed and correctly showed the intended fail-closed behavior: the strict ledger counts `75` current required slots and marks `0` as fully ready because browser proof is still representative, not exhaustive.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/ocr-readiness-ledger.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/ocr-fixture-manifest.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts` -> passed.
  - repeated same focused command -> passed again.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - The strict ledger is built from the same backend-owned canonical sources already used elsewhere in the OCR program:
    - `rules/document-matrix.yaml`
    - `src/modules/evidence/document-matrix.ts`
    - `src/modules/evidence/ocr-fixture-manifest.ts`
  - This keeps readiness accounting aligned with the actual supported combos/documents rather than duplicating the browser matrix spec or hardcoding totals in docs only.
  - The report is explicit that representative combo browser proof from `34.9.8` is tracked as partial proof and does not count as full per-slot readiness.
- Behavior changes and risk notes:
  - No runtime upload/compliance behavior changed.
  - The important product-facing outcome is honesty: under the stricter standard, the project now has a machine-checkable report showing that current readiness is incomplete rather than overclaiming `READY = yes`.
- Follow-ups and known gaps:
  - The next remaining OCR readiness task should expand browser proof from representative combo coverage to all required `combo x document` slots.
  - If extra support letters/certificates become canonical scope later, they must first be added to `rules/document-matrix.yaml` and then to the strict ledger.

## 2026-04-09 11:21 ICT

- Goal: Implement `34.9.10` by expanding browser OCR proof from representative combo coverage to every current required `combo x document` slot.
- What changed:
  - `frontend/src/lib/testing/ocr-browser-readiness-slots.ts`: Added a frontend-local canonical slot generator that expands the current supported combo/document requirements into all `75` current browser-proof slots using:
    - the committed OCR fixture manifest JSON
    - the live lane-creation scenario inventory
    - the current first-pass required document mapping per supported combo
  - `frontend/src/lib/testing/ocr-browser-readiness-slots.test.ts`: Added a focused unit test proving the exhaustive slot generator enumerates all `75` current required slots.
  - `frontend/e2e/evidence-ocr-matrix.spec.ts`: Reworked the browser OCR matrix to consume the generated slot list instead of the earlier hardcoded 9-case representative list. The Playwright suite now defines one browser OCR proof test for every current required slot, while keeping the same committed-fixture upload strategy and analysis assertions.
- TDD evidence:
  - The first implementation pass surfaced only one real coding issue: the frontend slot generator needed a narrower artifact-type cast after filtering out non-form artifact families. Once tightened, frontend unit/lint/typecheck passed cleanly.
  - No semantic RED iteration was needed beyond that because `34.9.10` is primarily an exhaustive expansion of the already-working browser matrix harness rather than a new OCR behavior change.
- Tests run and results:
  - `npm test -- --runInBand src/lib/testing/ocr-browser-readiness-slots.test.ts src/lib/ocr-assets.test.ts` -> passed.
  - `npm run test:e2e:list` -> passed and listed `75` browser OCR slot tests plus the existing smoke/assertion case.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
  - `npm run test:e2e -- --project=chromium -g "browser OCR matrix proof for eu-mango-commercial-invoice"` -> passed.
  - `npm run test:e2e -- --project=chromium -g "browser OCR matrix proof for japan-mango-vht-certificate"` -> passed.
- Wiring verification evidence:
  - The exhaustive browser slot list is driven by canonical inputs instead of handwritten test duplication:
    - committed OCR fixture manifest JSON
    - live lane creation scenarios
    - current combo/document requirement mapping used for the strict readiness ledger
  - The Playwright matrix spec is listed by `playwright test --list` and now expands to the full current slot count rather than representative combo coverage only.
  - The runtime browser path is unchanged: lane creation -> evidence upload -> backend OCR analysis -> artifact analysis polling -> UI visibility assertion.
- Behavior changes and risk notes:
  - This materially closes the main gap exposed by the strict ledger: browser proof is now defined for every current required slot rather than only one slot per combo.
  - I did not execute all `75` browser cases in this turn; instead I validated the exhaustive harness structurally plus two focused live slot runs from different document families (`Commercial Invoice` and `VHT Certificate`). The rest of the matrix now exists in the suite and can be exercised by CI or later bounded batches.
  - The frontend-local slot generator currently hardcodes the current first-pass combo/document mapping rather than parsing YAML directly in frontend runtime. That keeps the frontend harness simple, but if the matrix changes later this mapping and the backend strict ledger must remain aligned.
- Follow-ups and known gaps:
  - The next strict-readiness follow-up should decide whether the slot generator should be derived from a generated/shared artifact instead of the current frontend-local mapping.
  - Any extra support letters/certificates still require explicit matrix modeling before they can enter the exhaustive browser program.

## 2026-04-09 11:26 ICT

- Goal: Fully execute the exhaustive `34.9.10` browser OCR matrix instead of only proving the new 75-slot harness with selected spot checks.
- What changed:
  - No product code changes were needed after the exhaustive matrix harness landed.
  - The work in this step was full execution validation of the entire `frontend/e2e/evidence-ocr-matrix.spec.ts` suite.
- TDD evidence:
  - No new RED/GREEN code cycle was required because the exhaustive browser suite was already implemented in the immediately prior `34.9.10` step.
  - The key execution proof here is that the full browser matrix was actually run end-to-end and completed successfully.
- Tests run and results:
  - `npm run test:e2e -- --project=chromium e2e/evidence-ocr-matrix.spec.ts` -> passed.
  - Result: `76` tests passed in about `2.1m`.
  - This includes:
    - `1` matrix-count assertion test
    - `75` browser OCR slot proofs (every current required `combo x document` slot)
- Wiring verification evidence:
  - The exhaustive matrix is no longer just syntactically listed by Playwright; it has now been executed successfully across all current required slots.
  - This closes the main strict-readiness browser gap that `34.9.9` was explicitly reporting.
- Behavior changes and risk notes:
  - No runtime code changed.
  - The main readiness effect is evidence quality: browser proof now exists not just in the suite definition but in a successful full-suite execution pass.
  - A prior transient local Prisma/Playwright webServer startup race was observed during earlier spot runs, but the clean full-suite run completed successfully without requiring further product changes.
- Follow-ups and known gaps:
  - The remaining OCR readiness gap is no longer browser execution breadth for the current first-pass matrix.
  - The only remaining scope question is whether extra support letters/certificates beyond the current matrix labels should be modeled explicitly as a follow-on task.

## 2026-04-09 11:30 ICT

- Goal: Implement `34.9.11` honestly by determining whether the current rule packs justify any additional standalone OCR document families beyond the first-pass matrix labels.
- What changed:
  - `src/modules/evidence/ocr-scope-expansion-audit.ts`: Added a small audit helper that compares the live rule-pack `requiredDocuments` against the current first-pass OCR matrix labels and explicitly records which remaining controls are non-document constraints rather than missing OCR form families.
  - `src/modules/evidence/ocr-scope-expansion-audit.spec.ts`: Added focused tests proving that the current repo state does **not** justify any extra standalone OCR document families beyond the first-pass matrix labels.
  - `src/modules/evidence/document-matrix.spec.ts`: Added a guard asserting the scope-expansion audit returns no extra standalone document families outside the current first-pass matrix.
  - `docs/OCR-SCOPE-EXPANSION-AUDIT.md`: Added a human-readable report explaining the current conclusion: extra compliance controls do exist, but they are modeled today as field/rule constraints on the existing first-pass documents rather than separate upload document families.
  - `docs/OCR-RUNTIME-SCOPE-REFERENCE.md`: Updated the OCR runtime scope reference with the same explicit conclusion so the current matrix boundary stays truthful.
- TDD evidence:
  - RED/GREEN was minimal here because the implementation is an additive audit/reporting slice grounded in the current rule packs. The only failing iteration was a test-file syntax miss (missing closing brace), which was corrected immediately; the focused audit suite then passed.
- Tests run and results:
  - `npm test -- --runInBand src/modules/evidence/ocr-scope-expansion-audit.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/evidence/ocr-readiness-ledger.spec.ts` -> passed.
  - `npm run typecheck` -> passed.
- Wiring verification evidence:
  - The audit is backend-owned and grounded in the same canonical inputs as the rest of the OCR readiness program:
    - live `rules/*.yaml` rule packs
    - `rules/document-matrix.yaml`
  - This means the conclusion is not a documentation opinion; it is derived from the actual repo state.
- Behavior changes and risk notes:
  - No runtime upload/OCR/compliance behavior changed.
  - The key outcome is scope clarity: the current rule packs do not justify inventing extra standalone OCR document families beyond the first-pass matrix labels.
  - What remains outside first-pass scope today are non-document controls and field-level constraints such as registration, overseas inspection, certificate-label control, and fumigation/treatment declarations.
- Follow-ups and known gaps:
  - If the business later decides those controls require separate uploaded support letters/certificates, they must first be added explicitly to `rules/document-matrix.yaml` before entering fixture/classifier/browser readiness scope.
