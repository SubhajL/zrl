# OCR Scope Expansion Audit

This document records the current repo-state answer that closed the earlier optional scope-expansion question and now serves as the baseline for any later `34.10` research-backed matrix expansion work:

> Are there additional standalone supporting forms / approval letters / certificate families that should be added beyond the current first-pass OCR matrix labels?

## Current Answer

The current first-pass OCR matrix covers these standalone OCR document families:

The current first-pass OCR matrix labels remain:

- `Phytosanitary Certificate`
- `VHT Certificate`
- `MRL Test Results`
- `GAP Certificate`
- `Grading Report`
- `Export License`
- `Commercial Invoice`
- `Packing List`
- `Transport Document`
- `Delivery Note`

The live rule packs still contain additional required labels outside that first-pass matrix, but `Grading Report` is no longer one of them after `34.10.4`.

## What The Repo-State Audit Actually Shows

The current rules contain two different kinds of scope outside the first-pass OCR matrix:

- true required document labels that are still unmodeled in `rules/document-matrix.yaml`
- extra controls that are better understood today as field/rule constraints rather than separate upload document families

Examples:

- `KOREA/MANGO`
  - overseas inspection
  - registration
  - allowed varieties
  - these are currently modeled as VHT/treatment evidence constraints

- `KOREA/MANGOSTEEN`
  - fumigation requirement
  - registered packinghouse requirement
  - pest-control program requirement
  - overseas inspection / registration controls
  - these are currently modeled on the phytosanitary/treatment path, not as separate standalone upload documents

- `JAPAN/MANGOSTEEN`
  - certificate-label control
  - treatment/cooling/humidity conditions
  - these are currently modeled as phyto/VHT field requirements, not a separate letter/certificate family

## What This Means

- The earlier scope-audit question is now partly closed: `Grading Report` has been promoted into the matrix.
- The final end-to-end closure for that promotion is now recorded in `docs/OCR-34-10-8-TRACEABILITY-AUDIT.md`.
- The honest implementation is still to record that some required rule-pack labels remain outside the fixture/classifier/browser-proven OCR subset and that operational controls should not be invented as standalone document uploads.
- If new supporting documents are later confirmed through authoritative combo-by-combo research, they must first be added explicitly to `rules/document-matrix.yaml` before entering fixture/classifier/browser/readiness scope.
