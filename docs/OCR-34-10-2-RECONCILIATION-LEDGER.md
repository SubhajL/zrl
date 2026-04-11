# OCR 34.10.2 Reconciliation Ledger

This document records Task `34.10.2`:

> Reconcile external findings against the live rule packs and current OCR matrix.

This is still a decision-input artifact.

- It does **not** yet change `rules/document-matrix.yaml`.
- It takes `docs/OCR-34-10-1-EXTERNAL-RESEARCH-LEDGER.md` and compares it directly to the live rule packs and the current first-pass OCR matrix.
- It is intended to feed `34.10.3`, where each combo is turned into an explicit scope decision.
- Task Master note appending for `34.10` is currently failing in MCP (`taskmaster-ai_update_subtask`); until that is fixed, this file and `docs/PROGRESS.md` are the authoritative execution record for the logical `34.10.2` phase.

Follow-on output:

- `34.10.3` scope decisions are recorded in `docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md`.

## Inputs Compared

- External research: `docs/OCR-34-10-1-EXTERNAL-RESEARCH-LEDGER.md`
- Current baseline/scope guardrail: `docs/OCR-SCOPE-EXPANSION-AUDIT.md`
- Canonical current OCR matrix: `rules/document-matrix.yaml`
- Live runtime rule packs:
  - `rules/eu/durian.yaml`
  - `rules/eu/mango.yaml`
  - `rules/eu/mangosteen.yaml`
  - `rules/japan/durian.yaml`
  - `rules/japan/mango.yaml`
  - `rules/japan/mangosteen.yaml`
  - `rules/korea/durian.yaml`
  - `rules/korea/mango.yaml`
  - `rules/korea/mangosteen.yaml`

## Current Structural Reality

Across all 9 supported combos, the live rule packs already require more labels than the first-pass OCR matrix currently models.

### Live rule-pack labels not fully modeled in the current OCR matrix

- `Grading Report`
  - present in all 9 live rule packs
  - absent from `rules/document-matrix.yaml`
- `Product Photos`
  - present in all 9 live rule packs
  - intentionally excluded from first-pass OCR scope as operational evidence
- `Temperature Log`
  - present in all 9 live rule packs
  - intentionally excluded from first-pass OCR scope as operational evidence
- `SLA Summary`
  - present in all 9 live rule packs
  - intentionally excluded from first-pass OCR scope as operational evidence
- `Excursion Report`
  - present in all 9 live rule packs
  - intentionally excluded from first-pass OCR scope as operational evidence
- `Handoff Signatures`
  - present in all 9 live rule packs
  - intentionally excluded from first-pass OCR scope as operational evidence

### First reconciliation conclusion

The external research did **not** create the main matrix-expansion signal from scratch.

The strongest repo-internal mismatch already exists in the live rule packs themselves:

- `Grading Report` is a true required document label in the live rules
- but it remains outside the current first-pass OCR matrix

That means `34.10.2` should treat `Grading Report` as the highest-confidence standalone-family candidate for `34.10.3`, subject to confirming that it belongs in canonical OCR scope rather than being intentionally deferred.

## Reconciliation Axes Used

Each combo is reconciled on two independent axes, plus an unresolved flag when needed:

- standalone-family signal
  - `no change`
  - `candidate new standalone family`
  - `unresolved`
- existing-document field-expansion signal
  - `no change`
  - `expand existing document fields`
  - `unresolved`
- overall unresolved status
  - used only when conflicting evidence prevents a clean near-term recommendation

The reconciliation here is based on the combined view of:

1. current matrix labels and field rules
2. live rule-pack required documents
3. external research strength
4. existing first-pass OCR scope guardrails

## Combo-By-Combo Reconciliation

### EU / MANGO

- Matrix currently models:
  - `Phytosanitary Certificate`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Export License`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external research strongly supports richer phyto declaration / traceability / treatment-basis fields
  - live rule pack independently confirms `Grading Report` is a real required document label
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `expand existing document fields` on `Phytosanitary Certificate`
- Overall unresolved status:
  - no
- Notes:
  - `Grading Report` is the concrete missing standalone family signal
  - `Phytosanitary Certificate` also likely needs field expansion

### EU / MANGOSTEEN

- Matrix currently models the same 8 labels as other non-treatment EU combos
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external research does not independently surface a mangosteen-only new family
  - live rule pack still requires `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `no change`
- Overall unresolved status:
  - no
- Notes:
  - strongest standalone-family signal comes from live rules, not external sources

### EU / DURIAN

- Matrix currently models:
  - `Phytosanitary Certificate` plus the other standard trade/regulatory labels
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external EU plant-health guidance weakens the basis for `Phytosanitary Certificate`
  - live rule pack still includes `Phytosanitary Certificate` and `Grading Report`
- Standalone-family signal:
  - `unresolved`
- Existing-document field-expansion signal:
  - `unresolved`
- Overall unresolved status:
  - yes
- Notes:
  - this combo cannot be cleanly resolved in `34.10.2`
  - `34.10.3` must explicitly separate two questions:
    - whether `Grading Report` belongs in canonical OCR scope
    - whether `Phytosanitary Certificate` should remain for `EU/DURIAN` despite the EU durian exemption signal

### JAPAN / MANGO

- Matrix currently models:
  - `Phytosanitary Certificate`
  - `VHT Certificate`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Export License`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external research reinforces treatment-reference and phyto declaration complexity
  - live rules confirm `Grading Report` as a required document label
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `expand existing document fields` on `Phytosanitary Certificate` and `VHT Certificate`
- Overall unresolved status:
  - no
- Notes:
  - likely dual outcome in `34.10.3`: add `Grading Report`, and expand fields on existing phyto/VHT documents

### JAPAN / MANGOSTEEN

- Matrix currently models:
  - `Phytosanitary Certificate`
  - `VHT Certificate`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Export License`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external research supports stronger treatment-condition fields on the existing phyto/VHT path
  - live rules independently confirm `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `expand existing document fields` on `Phytosanitary Certificate` and `VHT Certificate`
- Overall unresolved status:
  - no
- Notes:
  - field expansion on existing treatment evidence also remains likely

### JAPAN / DURIAN

- Matrix currently models the standard non-treatment 8-label set
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - no strong new family from external research alone
  - live rule pack still requires `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `no change`
- Overall unresolved status:
  - no
- Notes:
  - unlike `EU/DURIAN`, there is no conflicting external phyto-exemption signal in this pass

### KOREA / MANGO

- Matrix currently models:
  - `Phytosanitary Certificate`
  - `VHT Certificate`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Export License`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - strongest combo-specific external support for richer field rules on existing documents
  - live rules independently require `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `expand existing document fields` on `Phytosanitary Certificate` and `VHT Certificate`
- Overall unresolved status:
  - no
- Notes:
  - likely dual outcome in `34.10.3`: add `Grading Report`, and expand field expectations on `Phytosanitary Certificate` and `VHT Certificate`

### KOREA / MANGOSTEEN

- Matrix currently models the standard non-VHT 8-label set
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external research shows unresolved supporting paperwork around fumigation / registration processes
  - live rule pack independently requires `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `expand existing document fields` on phytosanitary treatment/fumigation details already partly represented in the matrix
- Overall unresolved status:
  - yes
- Notes:
  - the high-confidence action is still `Grading Report`
  - the fumigation / registration paperwork remains unresolved and should not be promoted ahead of `34.10.3`

### KOREA / DURIAN

- Matrix currently models the standard non-treatment 8-label set
- Live rule pack additionally requires:
  - `Grading Report`
  - operational evidence labels intentionally outside first-pass OCR scope
- External reconciliation result:
  - external commodity-specific evidence remains weak
  - live rule pack still requires `Grading Report`
- Standalone-family signal:
  - `candidate new standalone family` via `Grading Report`
- Existing-document field-expansion signal:
  - `no change`
- Overall unresolved status:
  - yes
- Notes:
  - combo-level import-path uncertainty remains, but it does not erase the current live-rule `Grading Report` mismatch

## Cross-Cutting Reconciliation Conclusions

### 1. `Grading Report` is now the dominant standalone-family candidate

This conclusion is stronger than in `34.10.1` because it is now supported by:

- the live rule packs for all 9 combos
- the earlier scope-expansion audit, which already identified it as the main extra rule-pack label outside the first-pass matrix
- the absence of any competing externally proven new family that is stronger than the rule-pack mismatch

### 2. The operational evidence labels remain intentionally out of first-pass OCR scope

These labels remain outside the canonical first-pass OCR matrix and should **not** be treated as immediate candidates for `34.10.4`:

- `Product Photos`
- `Temperature Log`
- `SLA Summary`
- `Excursion Report`
- `Handoff Signatures`

They are live-rule requirements, but they are operational evidence artifacts rather than the formal first-pass OCR document families described by the matrix comments and current audit docs.

### 3. Several combos also imply field expansion on existing documents

The two-axis structure above intentionally preserves the fact that standalone-family and field-expansion outcomes can both be true for the same combo:

- `EU/MANGO` on `Phytosanitary Certificate`
- `JAPAN/MANGO` on `Phytosanitary Certificate` and `VHT Certificate`
- `JAPAN/MANGOSTEEN` on `Phytosanitary Certificate` and `VHT Certificate`
- `KOREA/MANGO` on `Phytosanitary Certificate` and `VHT Certificate`
- `KOREA/MANGOSTEEN` on phytosanitary treatment/fumigation fields already partly represented in the matrix

### 4. Two unresolved exceptions still need explicit handling in `34.10.3`

- `EU/DURIAN`
  - current live rule pack includes `Phytosanitary Certificate`
  - external EU source suggests durian is exempt from that plant-health requirement
  - this needs an explicit keep/narrow/remove decision at the matrix level
- `KOREA/MANGOSTEEN`
  - exporter-process paperwork exists in the research record
  - current evidence does not yet prove it should become canonical uploaded OCR scope

## Recommended Inputs For 34.10.3

For each combo, `34.10.3` should produce a decision row with separate columns for:

- standalone-family decision
- existing-document field-expansion decision
- supporting-paperwork out-of-scope decision
- blocked / unresolved reason

## Working Recommendation

If `34.10.3` is executed conservatively and truthfully, the most likely near-term decision set is:

- add `Grading Report` as the only new standalone family candidate advanced toward matrix modeling
- keep operational evidence labels out of first-pass OCR scope
- separately preserve and evaluate field expansion on existing phyto/VHT documents
- leave `EU/DURIAN` and Korea-mangosteen-extra-paperwork explicitly unresolved until the decision ledger step closes them cleanly
