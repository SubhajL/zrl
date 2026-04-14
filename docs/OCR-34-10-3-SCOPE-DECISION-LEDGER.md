# OCR 34.10.3 Scope Decision Ledger

This document records Task `34.10.3`:

> Produce a combo-by-combo scope decision ledger separating true standalone document families from field-only constraints and non-document controls.

This is the decision-phase output that closes the planning boundary before `34.10.4`.

- It does **not** yet change `rules/document-matrix.yaml`.
- It converts the `34.10.1` research and `34.10.2` reconciliation into explicit per-combo decisions.
- It is the authoritative input for `34.10.4`, where any approved new standalone document families can be modeled in the matrix.
- Task Master note appending for `34.10` is currently failing in MCP (`taskmaster-ai_update_subtask`); until that is fixed, this file and `docs/PROGRESS.md` are the authoritative execution record for the logical `34.10.3` phase.

## Decision Model

Each combo is decided on four axes:

1. `Standalone-family decision`
   - `ADD`
   - `DO NOT ADD`
   - `DEFER / UNRESOLVED`
2. `Existing-document field-expansion decision`
   - `EXPAND`
   - `NO CHANGE`
   - `DEFER / UNRESOLVED`
3. `Supporting-paperwork out-of-scope decision`
   - `KEEP OUT OF OCR SCOPE`
   - `DEFER / UNRESOLVED`
4. `Blocked / unresolved reason`
   - concrete reason when any decision cannot yet be closed truthfully

## Governing Rules

- A new standalone OCR family is approved only when the combined evidence is strong enough from:
  - the live rule packs
  - current OCR scope guardrails
  - external research where available
- Operational evidence stays out of first-pass OCR scope unless the product explicitly broadens the OCR program beyond formal document families.
- Field-only constraints remain on existing matrix documents unless there is a stronger reason to elevate them into a separate upload family.
- Conflicting evidence must stay deferred rather than being forced into a yes/no decision.

## Combo Decision Table

| Combo              | Standalone-family decision | Existing-document field-expansion decision                       | Supporting-paperwork out-of-scope decision                                                | Blocked / unresolved reason                                                                                                              | Rationale                                                                                                                                                                                                      |
| ------------------ | -------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EU/MANGO`         | `ADD` `Grading Report`     | `EXPAND` `Phytosanitary Certificate`                             | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rules require `Grading Report`; external research also supports richer phyto declarations, traceability, and treatment-basis fields.                                                                      |
| `EU/MANGOSTEEN`    | `ADD` `Grading Report`     | `NO CHANGE`                                                      | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rule mismatch is real, but external research did not surface a separate mangosteen-only standalone family or stronger field-expansion need.                                                               |
| `EU/DURIAN`        | `ADD` `Grading Report`     | `DEFER / UNRESOLVED`                                             | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | External EU plant-health guidance weakens the basis for the current `Phytosanitary Certificate` requirement in the live rule pack.       | The unresolved conflict is about `Phytosanitary Certificate`, not about `Grading Report`. Keep the phyto decision deferred, but do not let that block the stronger live-rule-backed `Grading Report` addition. |
| `JAPAN/MANGO`      | `ADD` `Grading Report`     | `EXPAND` `Phytosanitary Certificate` and `VHT Certificate`       | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rules require `Grading Report`, and external research plus current matrix overrides already support richer treatment-reference and phyto declaration semantics.                                           |
| `JAPAN/MANGOSTEEN` | `ADD` `Grading Report`     | `EXPAND` `Phytosanitary Certificate` and `VHT Certificate`       | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rules require `Grading Report`, and both external research and current matrix notes support stronger treatment-condition fields on the existing phyto/VHT path.                                           |
| `JAPAN/DURIAN`     | `ADD` `Grading Report`     | `NO CHANGE`                                                      | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rules require `Grading Report`, and this pass did not find a competing external basis for another new family or a current field-expansion need.                                                           |
| `KOREA/MANGO`      | `ADD` `Grading Report`     | `EXPAND` `Phytosanitary Certificate` and `VHT Certificate`       | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | None                                                                                                                                     | Live rules require `Grading Report`; the Korea mango protocol is the strongest external field-expansion signal in the whole research set.                                                                      |
| `KOREA/MANGOSTEEN` | `ADD` `Grading Report`     | `EXPAND` `Phytosanitary Certificate` treatment/fumigation fields | `DEFER / UNRESOLVED` for extra fumigation / registration paperwork outside current matrix | Extra exporter-process paperwork exists in research, but current evidence does not yet prove it belongs in canonical uploaded OCR scope. | The safe decision is to advance `Grading Report`, preserve likely phyto field expansion, and keep the extra paperwork outside canonical scope until stronger evidence appears.                                 |
| `KOREA/DURIAN`     | `ADD` `Grading Report`     | `NO CHANGE`                                                      | `KEEP OUT OF OCR SCOPE` for operational evidence labels                                   | Commodity-specific import-path evidence remains weak externally.                                                                         | The external uncertainty is real, but it does not override the present live-rule `Grading Report` mismatch. No separate field-expansion signal was strong enough in this pass.                                 |

## Cross-Cutting Scope Decisions

### Approved for advancement to `34.10.4`

- `Grading Report`
  - approved as the only new standalone-family candidate to advance toward matrix modeling
  - current basis is strongest across all combos because the live rule packs already require it everywhere and the earlier scope audit already isolated it as the main missing document label

### Approved as field-expansion-only work on existing matrix documents

- `EU/MANGO`
  - `Phytosanitary Certificate`
- `JAPAN/MANGO`
  - `Phytosanitary Certificate`
  - `VHT Certificate`
- `JAPAN/MANGOSTEEN`
  - `Phytosanitary Certificate`
  - `VHT Certificate`
- `KOREA/MANGO`
  - `Phytosanitary Certificate`
  - `VHT Certificate`
- `KOREA/MANGOSTEEN`
  - `Phytosanitary Certificate` treatment/fumigation details

### Explicitly kept out of first-pass OCR scope

- `Product Photos`
- `Temperature Log`
- `SLA Summary`
- `Excursion Report`
- `Handoff Signatures`

These remain required operational evidence in the live rule packs, but they are not approved here as formal first-pass OCR document-family additions.

### Explicitly deferred / unresolved

- `EU/DURIAN` phytosanitary scope
  - unresolved conflict between the live rule pack and external EU phyto exemption signal
- `KOREA/MANGOSTEEN` extra fumigation / registration paperwork
  - unresolved whether those records belong in canonical uploaded OCR scope at all

## What 34.10.4 Should Do Next

- Update `rules/document-matrix.yaml` only for the approved standalone-family change:
  - add `Grading Report` for all supported combos
- Do **not** use the unresolved `EU/DURIAN` phyto conflict as a reason to block the `Grading Report` addition; the deferred question there is only the future status of `Phytosanitary Certificate`.
- Do **not** add extra Korea mangosteen exporter-process paperwork as standalone OCR families in `34.10.4`.
- Field-expansion work on existing phyto/VHT documents may follow after the standalone-family modeling decision is reflected in the matrix, but should remain explicitly scoped and traceable.

## Why This Is The Honest Cut Line

- It preserves the strongest rule-pack-backed missing family (`Grading Report`) without over-promoting weaker exporter-process paperwork into canonical OCR scope.
- It keeps operational evidence out of the formal first-pass OCR matrix.
- It preserves unresolved contradictions instead of hiding them in a premature matrix update.
