# OCR Readiness Ledger

This report is the strict machine-checkable readiness ledger for the current first-pass OCR document scope.

It is generated conceptually from:

- `rules/document-matrix.yaml`
- `frontend/e2e/test-assets/ocr-forms/manifest.json`
- current classifier proof implemented in `34.9.4` to `34.9.6`
- current backend OCR integration implemented in `34.7.1` to `34.7.5`
- current browser OCR proof implemented in `34.9.7` to `34.9.10`

## Current Ledger Rules

A required `combo x document` slot is only `READY = yes` when all of these are complete:

1. committed fixture coverage exists
2. classifier proof is complete
3. backend OCR integration proof is complete where applicable
4. browser proof is complete for the exact required slot

The current ledger fails closed on missing proof layers, but the browser-proof layer now reflects the exhaustive `34.9.10` slot matrix rather than the earlier representative-only combo proof.

## Current Status

- Current first-pass required slots: derived from the live matrix and now includes `Grading Report`
- Fully ready slots under the strict standard: greater than `0` and derived from the live matrix/fixture/browser-proof inputs

This is expected.

Current work through `34.9.10` built:

- committed fixtures
- exhaustive classifier coverage for the current first-pass matrix labels and overrides
- backend OCR integration with explicit provenance
- exhaustive browser proof for every fixture-backed `combo x required document` slot that existed before the `34.10.4` matrix expansion
- `34.10.7` now extends downstream backend/browser/readiness parity to the added `Grading Report` slots

So the current strict ledger should show real gaps instead of prematurely marking combos `READY = yes`.

## Why This Exists

This ledger is the strict machine-checkable view of the current first-pass OCR proof state.

It makes the remaining scope explicit:

- `34.9.9` = strict ledger and gap report
- `34.9.10` = exhaustive browser proof for all required slots
- `34.10` = research-backed matrix expansion for extra supporting forms/certificates if required, followed by fixture/classifier/browser/readiness work for any newly justified document families

Current expansion boundary after `34.10.3`:

- the readiness ledger now reflects the grown matrix after `34.10.4`, including `Grading Report`
- `34.10.3` has now recorded the combo-by-combo decision boundary for future scope work in `docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md`
- downstream proof for `Grading Report` now exists across fixture, classifier, backend checklist impact, and browser matrix coverage after `34.10.5` to `34.10.7`
- `34.10.8` now closes the chain with a final traceability audit in `docs/OCR-34-10-8-TRACEABILITY-AUDIT.md`
- unresolved policy exceptions can now also appear on affected slots via `rules/ocr-policy-exceptions.yaml`; these annotations are additive review-needed signals and do not yet override the live rule packs
