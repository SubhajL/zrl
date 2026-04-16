# Coding Log: shared-document-catalog

## Plan Draft A

### Overview

Extract a backend-owned shared document catalog from the existing document matrix and fixture manifest so document semantics are loaded once and reused by the OCR classifier, rules engine checklist matching, readiness ledger, browser slot generation, and test helpers. Keep the existing matrix and manifest files as source data, but add one typed composition layer that resolves canonical document identity, checklist-matching semantics, combo applicability, and fixture-backed browser metadata.

### Files to Change

- `src/modules/evidence/document-catalog.ts`
  Compose matrix + fixture manifest into a shared typed catalog and expose lookup helpers.
- `src/modules/evidence/document-catalog.spec.ts`
  New contract tests for shared catalog semantics and cross-consumer parity.
- `src/modules/evidence/document-matrix.spec.ts`
  Move CI invariants onto the shared catalog where appropriate.
- `src/modules/evidence/evidence.document-classifier.ts`
  Consume shared catalog definitions instead of raw matrix documents where possible.
- `src/modules/evidence/ocr-readiness-ledger.ts`
  Use the catalog for document/fixture/combo lookups instead of parallel matrix/manifest lookups.
- `src/modules/rules-engine/rules-engine.service.ts`
  Replace hardcoded checklist document identity matching with catalog-backed semantics.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  Add/adjust tests proving catalog-backed matching for invoice-family labels and negative cases.
- `frontend/src/lib/testing/ocr-browser-readiness-slots.ts`
  Generate browser slots from a machine-readable catalog export instead of directly from manifest rows.
- `frontend/src/lib/testing/ocr-browser-readiness-slots.test.ts`
  Assert browser slots remain in parity with the catalog-backed required slot set.
- `frontend/e2e/helpers/backend.ts`
  Reuse exported catalog/browser-slot identity metadata for seeded helper expectations if needed.
- `src/modules/evidence/document-catalog.browser.ts`
  Small JSON-safe export for frontend/browser-slot consumers.

### Implementation Steps

#### TDD sequence

1. Add/stub catalog contract tests.
2. Run the new tests and confirm they fail for missing catalog wiring.
3. Implement the smallest typed catalog layer to satisfy backend tests.
4. Rewire rules engine and readiness ledger to use the catalog.
5. Rewire browser slot generation and helpers to use the catalog export.
6. Refactor minimally for naming and shared helper clarity.
7. Run fast gates, then broader targeted gates.

#### Functions and behavior

- `loadDocumentCatalog()`
  Load the document matrix and fixture manifest once, normalize them into catalog entries, and expose canonical per-document/per-combo semantics.

- `getDocumentCatalogEntry(documentLabel)`
  Return the canonical shared document entry for one label, including artifact type, matrix metadata, fixture metadata, and checklist matching family.

- `buildDocumentCatalogBrowserSlots()`
  Produce JSON-safe browser slot inputs from the same catalog so frontend tests stop recomputing semantics independently.

- `resolveChecklistDocumentMatch(documentLabel, artifact)`
  Replace the current rules-engine switch with catalog-backed matching rules, including invoice-family fallback behavior and exact artifact-type matches.

#### Edge cases

- Fixture-backed and non-fixture-backed documents must remain distinguishable.
- Override-backed variants must preserve explicit variant field completeness.
- Unsupported labels must fail closed.
- No runtime call site should need to know both matrix and manifest shapes after extraction.

### Test Coverage

- `src/modules/evidence/document-catalog.spec.ts`
  - `loads canonical catalog entries from matrix and manifest`
    One source composes shared document semantics.
  - `derives checklist identity semantics for invoice-family documents`
    Catalog captures rules-engine matching behavior.
  - `exposes exact browser slot metadata for fixture-backed labels`
    Browser slots come from catalog, not ad hoc joins.
  - `fails closed when matrix and fixture semantics drift`
    Catalog invariants catch split-brain data.

- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `matches grading report through catalog-backed invoice family`
    No hardcoded special-case switch needed.

- `frontend/src/lib/testing/ocr-browser-readiness-slots.test.ts`
  - `stays in parity with catalog-backed required slots`
    Frontend consumes shared catalog output.

### Decision Completeness

- Goal
  Implement `Arch #1` by centralizing shared document semantics into one consumable catalog layer.
- Non-goals
  Do not implement `Arch #2` proof-coverage split or `Arch #3` machine-readable 34.10 decision artifacts.
- Success criteria
  Backend and frontend consumers no longer duplicate matrix+manifest joins or hardcoded checklist identity logic.
- Public interfaces
  No API or DB schema changes. Internal TypeScript module surface only.
- Edge cases / failure mode
  Fail closed if matrix and fixture manifest drift or if a required document lacks catalog metadata.

### Wiring Verification

| Component                     | Wiring Verified? | How Verified                                                                |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `document-catalog.ts`         | Planned          | Must be imported by rules engine, readiness ledger, and browser-slot export |
| `document-catalog.browser.ts` | Planned          | Must be imported by frontend browser-slot generator                         |

## Plan Draft B

### Overview

Minimize the extraction by keeping the existing matrix loader as the canonical backend source and only adding a small adapter module for checklist matching plus a separate slot-builder helper for frontend use. This lowers immediate change volume but leaves more semantics split between backend and frontend.

### Files to Change

- `src/modules/evidence/document-matrix.ts`
  Extend existing document definitions with optional checklist/browser metadata.
- `src/modules/evidence/document-matrix.spec.ts`
  Add assertions for the new metadata.
- `src/modules/rules-engine/rules-engine.service.ts`
  Read the extra metadata from matrix-derived entries.
- `frontend/src/lib/testing/ocr-browser-readiness-slots.ts`
  Reuse a generated export from backend tooling or a shared static file.

### Implementation Steps

#### TDD sequence

1. Add matrix metadata tests.
2. Confirm failure.
3. Extend matrix loader and consumers.
4. Backfill slot builder.
5. Run targeted validation.

### Test Coverage

- `document-matrix.spec.ts`
  - `exposes checklist matching metadata`
- `rules-engine.service.spec.ts`
  - `uses matrix metadata for invoice-family checklist matching`

### Decision Completeness

- Goal
  Reduce duplication quickly with minimal extraction.
- Non-goals
  Full catalog abstraction or frontend/backend shared slot export.
- Success criteria
  Rules engine stops hardcoding labels; browser slots still remain correct.
- Edge cases
  Manifest and matrix semantics can still drift because fixture data is only indirectly modeled.

### Wiring Verification

| Component                | Wiring Verified? | How Verified                 |
| ------------------------ | ---------------- | ---------------------------- |
| Extended matrix metadata | Planned          | Must be read by rules engine |

## Comparative Analysis & Synthesis

### Strengths

- Draft A gives a real catalog boundary and aligns with the architectural goal.
- Draft B is lower-risk in file count and may land faster.

### Gaps

- Draft B does not actually eliminate split semantics between matrix, manifest, and browser slots.
- Draft A needs careful scoping so it does not become an `Arch #2` rewrite.

### Trade-offs

- Draft A changes more files but pays down the structural gap directly.
- Draft B preserves more existing code but only partially addresses the architecture slice.

### Compliance Check

- Both drafts preserve existing data files and avoid new top-level runtime architecture.
- Draft A better fits the stated architectural change and repo guidance to extend existing modules with explicit, typed data.

## Unified Execution Plan

### Overview

Implement a backend-owned shared `DocumentCatalog` module that composes `rules/document-matrix.yaml` and the OCR fixture manifest into canonical document entries plus a JSON-safe browser-slot export. Rewire the rules engine checklist matcher, readiness ledger, and browser slot generator to consume this catalog, and keep the classifier aligned by using catalog-backed expected semantics rather than parallel raw lookups.

### Files to Change

- `src/modules/evidence/document-catalog.ts`
- `src/modules/evidence/document-catalog.spec.ts`
- `src/modules/evidence/document-catalog.browser.ts`
- `src/modules/evidence/evidence.document-classifier.ts`
- `src/modules/evidence/ocr-readiness-ledger.ts`
- `src/modules/evidence/document-matrix.spec.ts`
- `src/modules/rules-engine/rules-engine.service.ts`
- `src/modules/rules-engine/rules-engine.service.spec.ts`
- `frontend/src/lib/testing/ocr-browser-readiness-slots.ts`
- `frontend/src/lib/testing/ocr-browser-readiness-slots.test.ts`
- `docs/PROGRESS.md`

### Implementation Steps

#### TDD sequence

1. Add `document-catalog.spec.ts` with catalog contract tests covering `Grading Report`, fixture-backed labels, checklist-match families, and browser-slot metadata.
2. Add/adjust rules-engine and browser-slot tests so they assert catalog-backed behavior explicitly.
3. Run the focused tests and confirm red failures for the missing catalog module and wiring.
4. Implement `document-catalog.ts` with:
   - canonical entry composition from matrix + fixture manifest
   - per-combo required slot enumeration
   - checklist matching family metadata
   - fixture variant completeness accessors
5. Implement `document-catalog.browser.ts` as a JSON-safe export consumed by frontend slot generation.
6. Rewire `rules-engine.service.ts`, `ocr-readiness-ledger.ts`, and `ocr-browser-readiness-slots.ts`.
7. Keep classifier behavior stable; only replace duplicated raw lookups where the catalog gives stricter semantics without broadening scope.
8. Run targeted tests, then lint/typecheck, then rerun the focused test set three times for flake detection.
9. Update `docs/PROGRESS.md` and append implementation/review notes to this log.

#### Functions and behavior

- `loadDocumentCatalog()`
  Load matrix + fixture manifest and return a typed catalog object with entries, combo slots, and shared identity metadata.

- `getCatalogEntryByLabel(label)`
  Shared lookup used by classifier, readiness, and rules engine.

- `enumerateFixtureBackedRequiredSlots()`
  Return canonical `combo x document` slots with fixture and variant metadata for browser proof.

- `matchChecklistDocumentAgainstArtifact(entry, artifact)`
  Encapsulate rules-engine checklist semantics for exact artifact matches and invoice-family fallback.

### Test Coverage

- `src/modules/evidence/document-catalog.spec.ts`
  - `composes matrix and manifest into canonical entries`
  - `enumerates fixture-backed required slots across all combos`
  - `captures checklist matching family for invoice-family labels`
  - `exposes variant-specific expected field completeness`
  - `fails closed when fixture metadata is missing for fixture-backed labels`

- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `uses catalog-backed matching for grading report`
  - `does not match unrelated checkpoint photos for invoice-family labels`

- `frontend/src/lib/testing/ocr-browser-readiness-slots.test.ts`
  - `builds slots from catalog-backed browser export`
  - `preserves explicit variant completeness for override slots`

- `src/modules/evidence/document-matrix.spec.ts`
  - `keeps catalog parity with matrix-backed labels and fixture-backed labels`

### Decision Completeness

- Goal
  Finish `Arch #1` by extracting a shared document catalog and wiring the current consumers to it.
- Non-goals
  No schema/API changes, no proof-coverage file, no 34.10 decision-artifact rewrite.
- Success criteria
  One catalog module owns document identity semantics and browser-slot metadata; rules engine, readiness ledger, and browser slots consume it; targeted tests pass.
- Public interfaces
  Internal module interfaces only.
- Operational expectations
  Fail closed on semantic drift; no fallback to stale hardcoded label switches.
- Failure modes
  Missing catalog entry, unsupported fixture variant, or matrix/manifest mismatch should throw in tests and fail runtime consumers loudly.

### Wiring Verification

| Component                     | Wiring Verified? | How Verified                                                            |
| ----------------------------- | ---------------- | ----------------------------------------------------------------------- |
| `document-catalog.ts`         | Planned          | Search imports in rules engine, readiness ledger, browser export, tests |
| `document-catalog.browser.ts` | Planned          | Search imports in `ocr-browser-readiness-slots.ts`                      |
| checklist matcher extraction  | Planned          | Search production call site in `rules-engine.service.ts`                |

## Implementation (2026-04-16 13:38 +07)

### What Changed

- Added [src/modules/evidence/document-catalog.ts](/Users/subhajlimanond/dev/zrl/src/modules/evidence/document-catalog.ts) as the shared document-semantics composition layer. It now owns:
  - canonical entries composed from the matrix and fixture manifest
  - checklist category and match-mode semantics
  - fixture-backed required-slot enumeration
  - conservative checklist matching that requires the canonical artifact family before filename fallback
- Added [src/modules/evidence/document-catalog.browser.ts](/Users/subhajlimanond/dev/zrl/src/modules/evidence/document-catalog.browser.ts) so frontend browser-slot generation can consume a JSON-safe catalog export instead of rebuilding slot semantics from the manifest directly.
- Rewired [src/modules/rules-engine/rules-engine.service.ts](/Users/subhajlimanond/dev/zrl/src/modules/rules-engine/rules-engine.service.ts) to use catalog-backed checklist category resolution and artifact matching.
- Rewired [src/modules/evidence/ocr-readiness-ledger.ts](/Users/subhajlimanond/dev/zrl/src/modules/evidence/ocr-readiness-ledger.ts) to consume catalog entries and catalog-backed fixture slots instead of separate matrix/manifest joins.
- Rewired [src/modules/evidence/evidence.document-classifier.ts](/Users/subhajlimanond/dev/zrl/src/modules/evidence/evidence.document-classifier.ts) to load candidate document semantics from the catalog rather than directly from the raw matrix loader.
- Rewired [frontend/src/lib/testing/ocr-browser-readiness-slots.ts](/Users/subhajlimanond/dev/zrl/frontend/src/lib/testing/ocr-browser-readiness-slots.ts) to consume the shared browser export.
- Added catalog contract coverage in [src/modules/evidence/document-catalog.spec.ts](/Users/subhajlimanond/dev/zrl/src/modules/evidence/document-catalog.spec.ts) and tightened negative rules-engine coverage so non-invoice artifacts cannot satisfy invoice-family checklist items by filename alone.

### Validation

- Red phase:
  - `npm test -- --runInBand src/modules/evidence/document-catalog.spec.ts src/modules/evidence/document-matrix.spec.ts`
  - `cd frontend && npm test -- --runInBand src/lib/testing/ocr-browser-readiness-slots.test.ts`
- Green phase:
  - `npm test -- --runInBand src/modules/evidence/document-catalog.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/ocr-readiness-ledger.spec.ts`
  - `cd frontend && npm test -- --runInBand src/lib/testing/ocr-browser-readiness-slots.test.ts`
  - `npm run typecheck`
  - `npm run lint -- src/modules/evidence/document-catalog.ts src/modules/evidence/document-catalog.browser.ts src/modules/evidence/document-catalog.spec.ts src/modules/evidence/document-matrix.ts src/modules/evidence/ocr-fixture-manifest.ts src/modules/evidence/ocr-readiness-ledger.ts src/modules/evidence/evidence.document-classifier.ts src/modules/rules-engine/rules-engine.service.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/document-matrix.spec.ts`
  - `cd frontend && npm run typecheck`
  - `cd frontend && npm run lint -- src/lib/testing/ocr-browser-readiness-slots.ts src/lib/testing/ocr-browser-readiness-slots.test.ts`
- Repeat-run reliability:
  - backend focused suite passed 3 consecutive runs
  - frontend slot test passed 3 consecutive runs

### Wiring Verification

| Component                     | Wiring Verified? | How Verified                                                                                        |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| `document-catalog.ts`         | YES              | Imported by rules engine, readiness ledger, classifier, document-matrix spec, and catalog spec      |
| `document-catalog.browser.ts` | YES              | Imported by `frontend/src/lib/testing/ocr-browser-readiness-slots.ts` and its test                  |
| checklist matcher extraction  | YES              | `RulesEngineService.buildChecklist()` still calls `artifactSatisfiesDocument()`, now catalog-backed |

## Review (2026-04-16 13:44 +07) - working-tree staged Arch #1

### Reviewed

- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree staged Arch #1 shared document catalog change set
- Commands Run: `CODEX_ALLOW_LARGE_OUTPUT=1 git diff --staged --stat`; `CODEX_ALLOW_LARGE_OUTPUT=1 git diff --staged -- src/modules/evidence/document-catalog.ts src/modules/rules-engine/rules-engine.service.ts frontend/src/lib/testing/ocr-browser-readiness-slots.ts | sed -n '1,260p'`; `npm test -- --runInBand src/modules/evidence/document-catalog.spec.ts src/modules/evidence/document-matrix.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/evidence.document-classifier.spec.ts src/modules/evidence/ocr-readiness-ledger.spec.ts`; `cd frontend && npm test -- --runInBand src/lib/testing/ocr-browser-readiness-slots.test.ts`; `npm run typecheck`; `npm run lint -- src/modules/evidence/document-catalog.ts src/modules/evidence/document-catalog.browser.ts src/modules/evidence/document-catalog.spec.ts src/modules/evidence/document-matrix.ts src/modules/evidence/ocr-fixture-manifest.ts src/modules/evidence/ocr-readiness-ledger.ts src/modules/evidence/evidence.document-classifier.ts src/modules/rules-engine/rules-engine.service.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/evidence/document-matrix.spec.ts`; `cd frontend && npm run typecheck`; `cd frontend && npm run lint -- src/lib/testing/ocr-browser-readiness-slots.ts src/lib/testing/ocr-browser-readiness-slots.test.ts`

### Findings

CRITICAL

- No findings.

HIGH

- No findings.

MEDIUM

- No findings.

LOW

- Residual risk only: `DocumentCatalog` now caches repo-backed document semantics in-process. That matches the current static-test/runtime use, but live hot-reload semantics for matrix/fixture file edits are not part of this change and are still restart-bound.

### Open Questions / Assumptions

- Assumed `Arch #1` scope ends at shared semantic consumption by classifier, rules engine, readiness ledger, and browser slot generation, without also refactoring every seeded helper to build its uploads dynamically from the catalog.
- Assumed the browser export remains test-only code and will not be bundled into runtime client code.

### Recommended Tests / Validation

- Keep the focused catalog/rules/readiness/browser suite as the fast regression gate for future document-scope changes.
- If `Arch #2` lands later, add a catalog-vs-proof-coverage contract test so readiness stops relying on hardcoded proof sets.

### Rollout Notes

- Internal-only TypeScript/module refactor; no API, schema, or migration impact.
- Unrelated local files remain outside the staged change set (`.gitignore`, `prisma/AGENTS.md`, `rules/AGENTS.md`, `test/AGENTS.md`, older untracked coding log, and the Task 25 doc).
