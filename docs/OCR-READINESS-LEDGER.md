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

- Current first-pass required slots: `75`
- Fully ready slots under the strict standard: greater than `0` and derived from the live matrix/fixture/browser-proof inputs

This is expected.

Current work through `34.9.10` built:

- committed fixtures
- exhaustive classifier coverage for the current first-pass matrix labels and overrides
- backend OCR integration with explicit provenance
- exhaustive browser proof for every `combo x required document` slot

So the current strict ledger should show real gaps instead of prematurely marking combos `READY = yes`.

## Why This Exists

This ledger is the strict machine-checkable view of the current first-pass OCR proof state.

It makes the remaining scope explicit:

- `34.9.9` = strict ledger and gap report
- `34.9.10` = exhaustive browser proof for all required slots
- `34.10` = research-backed matrix expansion for extra supporting forms/certificates if required, followed by fixture/classifier/browser/readiness work for any newly justified document families
