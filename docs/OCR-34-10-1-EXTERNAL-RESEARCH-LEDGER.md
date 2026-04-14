# OCR 34.10.1 External Research Ledger

This document records the internet-backed research pass for Task `34.10.1`:

> Research authoritative external requirements for every supported combo.

This is a research ledger only.

- It does **not** change `rules/document-matrix.yaml`.
- It does **not** yet decide final modeling scope.
- It exists to feed `34.10.2` and `34.10.3`, where external findings are reconciled against the live rule packs and the current first-pass OCR matrix.
- Task Master note appending for `34.10` is currently failing in MCP (`taskmaster-ai_update_subtask`); until that is fixed, this file and `docs/PROGRESS.md` are the authoritative execution record for the logical `34.10.1` phase.

Follow-on output:

- `34.10.2` reconciliation result is recorded in `docs/OCR-34-10-2-RECONCILIATION-LEDGER.md`.

## Method

- Focus on authoritative or near-authoritative external sources first:
  - importing-country NPPO / quarantine authority pages
  - EU plant-health pages and legislation references
  - Thailand government export / phytosanitary procedure pages where importing-country protocol detail is surfaced publicly
- Record only what the source clearly supports.
- Separate:
  - baseline import/shipping documents
  - explicit phytosanitary / treatment declarations on existing documents
  - true extra standalone document families
  - low-confidence or indirect signals that still need reconciliation before modeling

## Source Set

### EU

- European Commission, Trade in plants & plant products from non-EU countries  
  `https://food.ec.europa.eu/plants/plant-health-and-biosecurity/trade-plants-plant-products-non-eu-countries_en`
- Commission Implementing Regulation (EU) 2019/2072 references surfaced via EUR-Lex / legislation mirrors for Annex VII and Annex XI
- COLEACP guidance summarizing Annex VII Point 61 mango fruit-fly options and phytosanitary-certificate additional declarations  
  `https://resources.colead.link/en/system/files/file_fields/2022/08/10/guidelinesontheexportfreshmangoaug2022.pdf`

### Japan

- MAFF Plant Protection Station, Regulations when Bringing Plants into Japan from Another Country  
  `https://www.maff.go.jp/pps/j/introduction/english.html`
- MAFF import-conditions search entry point  
  `https://www.pps.maff.go.jp/eximlist/Pages/exp/conditionE.xhtml`
- Thailand government page on special-case phytosanitary certificate issuance, which publicly lists Japan VHT treatment cases  
  `https://www.thailand.go.th/issue-focus-detail/001_03_362`

### Korea

- APQA Plant Protection Act page (phytosanitary certificate requirement)  
  `https://www.qia.go.kr/english/html/Plant/Plant_003.jsp`
- APQA pre-clearance inspection page  
  `https://www.qia.go.kr/english/html/Plant/Plant_009.jsp`
- Public protocol PDF: Plant Quarantine Import Requirements of Fresh Mango fruits from Thailand into the Republic of Korea  
  `https://www.opsmoac.go.th/tokyo-regulation-files-431991791825`
- Thailand government pages on special-case phytosanitary certificates and random plant pest inspection for special export  
  `https://www.thailand.go.th/issue-focus-detail/001_03_362`  
  `https://thailand.go.th/public/index.php/issue-focus-detail/001_03_330`
- APQA treatment standards page  
  `https://www.qia.go.kr/english/html/Plant/Plant_023-27.jsp`

## Combo-By-Combo Findings

### EU / MANGO

- External baseline clearly supported:
  - phytosanitary certificate required for regulated fresh fruit entering the EU
  - commercial trade/cargo documentation remains required operationally outside plant-health law
  - mango is subject to extra fruit-fly-related phytosanitary conditions under Annex VII Point 61 logic
- Strong external signal on existing-document controls:
  - mango phytosanitary certificate may need a specific additional declaration proving one of the accepted Tephritidae compliance options
  - traceability and treatment/systems-approach details may need to appear on the phytosanitary certificate or its attachment
- Candidate extra standalone families from external research:
  - none yet clearly justified as a separate uploaded OCR family from the source set alone
- Interpretation for follow-up:
  - strongest external expansion pressure is on richer field/declaration modeling for `Phytosanitary Certificate`, not on a clearly new standalone family

### EU / MANGOSTEEN

- External baseline clearly supported:
  - phytosanitary certificate required for regulated fresh fruit entering the EU
  - commercial trade/cargo documentation remains required operationally outside plant-health law
- Strong external signal on existing-document controls:
  - no strong public source in this pass proving a distinct mangosteen-only extra support form analogous to the mango fruit-fly dossier guidance
- Candidate extra standalone families from external research:
  - none clearly justified from this pass
- Interpretation for follow-up:
  - likely no new standalone OCR family from external evidence gathered so far; treat as baseline phyto + trade/cargo path pending rule-pack reconciliation

### EU / DURIAN

- External baseline clearly supported:
  - EU page explicitly says no phytosanitary certificate is needed for durian among the exempt fruits listed in Annex XII Part C context
  - commercial trade/cargo documents still remain operationally necessary for shipment/import workflows
- Strong external signal on existing-document controls:
  - external evidence weakens the phytosanitary-certificate basis for durian, rather than expanding plant-health document scope
- Candidate extra standalone families from external research:
  - none
- Interpretation for follow-up:
  - this is a high-value targeted reconciliation case for `34.10.2` because the external EU plant-health signal may narrow the phytosanitary portion of the current combo scope
  - this research finding does not by itself invalidate non-phyto rule-pack documents or broader business-process evidence already modeled elsewhere

### JAPAN / MANGO

- External baseline clearly supported:
  - phytosanitary certificate required for plant imports into Japan
  - import inspection required
- Strong external signal on existing-document controls:
  - Thailand government special-case page publicly lists Japan mango VHT requirements at `47C for 20 minutes`
  - Korea-style standalone VHT certificate is not clearly mandated by MAFF public pages retrieved here, but treatment evidence and phytosanitary certificate treatment details are strongly implied
- Candidate extra standalone families from external research:
  - no clearly justified new standalone family from this pass beyond the existing phyto/treatment path
- Interpretation for follow-up:
  - likely reinforces existing `VHT Certificate` plus phyto field modeling rather than adding a new support-letter family

### JAPAN / MANGOSTEEN

- External baseline clearly supported:
  - phytosanitary certificate required for plant imports into Japan
  - import inspection required
- Strong external signal on existing-document controls:
  - Thailand government special-case page publicly lists Japan mangosteen treatment at `46C for 58 minutes`
  - current repo docs already noted certificate-label / treatment-condition style controls; this pass adds external support that treatment-specific declarations matter
- Candidate extra standalone families from external research:
  - none clearly justified yet as a separate uploaded family
- Interpretation for follow-up:
  - strongest signal is still richer field modeling on existing phyto/treatment evidence, not a new standalone support document

### JAPAN / DURIAN

- External baseline clearly supported:
  - phytosanitary certificate required for plant imports into Japan
  - import inspection required
- Strong external signal on existing-document controls:
  - this pass did not find a durian-specific public treatment/extra-document protocol from MAFF comparable to the mango/mangosteen treatment signals surfaced via Thailand pages
- Candidate extra standalone families from external research:
  - none justified from this pass
- Interpretation for follow-up:
  - likely baseline phyto + trade/cargo path unless live rule-pack reconciliation exposes a modeled document that truly lacks external grounding

### KOREA / MANGO

- External baseline clearly supported:
  - phytosanitary certificate required under Korea plant quarantine law
  - APQA public pre-clearance page explicitly lists mango from Thailand under pre-clearance inspection
- Strong external signal on existing-document controls:
  - official public protocol PDF gives concrete orchard registration, packinghouse registration, VHT facility requirements, pre-clearance/on-site survey, labeling, sealing, inspection, and phytosanitary-certificate additional declaration requirements
  - required certificate additions include orchard/packinghouse identifier, treatment information, and pest-free declaration text
  - cartons/pallets require explicit labeling such as `For Korea` and treated/sealed markings in some cases
- Candidate extra standalone families from external research:
  - no clear standalone new document family yet, but there is strong support for explicit registration / packinghouse / treatment-reference fields on existing documents
- Interpretation for follow-up:
  - highest-confidence research result in this pass
  - very likely expands combo-specific field expectations and could justify modeling `Grading Report` only if the live rule packs, not the external protocol alone, make it a truly separate required uploaded document

### KOREA / MANGOSTEEN

- External baseline clearly supported:
  - phytosanitary certificate required under Korea plant quarantine law
- Strong external signal on existing-document controls:
  - Thailand special-case pages publicly indicate methyl bromide fumigation for mangosteen to Korea
  - random plant pest inspection page lists Korea fumigation workflows needing GMP, fumigation good-practice certification, plant export program registration letter, packaging operation certification, and methyl bromide fumigation certification
- Candidate extra standalone families from external research:
  - unresolved supporting-evidence candidates only: fumigation certification, packaging-operation certification, and export-program registration paperwork
  - current evidence does not yet establish whether these should become canonical uploaded OCR families versus exporter-side process prerequisites or supporting references on existing documents
- Interpretation for follow-up:
  - this is an unresolved reconciliation hotspot for `34.10.2`, not yet a justified matrix-expansion decision
  - confidence remains medium-to-low for standalone-family expansion because the clearest public evidence comes from Thailand export-procedure pages rather than a commodity-specific APQA import protocol retrieved in this pass

### KOREA / DURIAN

- External baseline clearly supported:
  - phytosanitary certificate required under Korea plant quarantine law for plant imports generally
- Strong external signal on existing-document controls:
  - no strong public commodity-specific Korea durian protocol was found in this pass
  - public Korea import-restriction compilations suggest many fresh fruits are prohibited except commodity-specific permitted regions, but this pass did not recover an authoritative APQA durian-from-Thailand commodity protocol
- Candidate extra standalone families from external research:
  - none justified from this pass
- Interpretation for follow-up:
  - treat as unresolved and high-priority for `34.10.2` reconciliation against the live rule pack; current external evidence is insufficient to justify matrix expansion

## Cross-Cutting Research Conclusions

### High-confidence conclusions

- EU mango has stronger phytosanitary-certificate declaration complexity than the current matrix explicitly surfaces.
- Japan generally requires phytosanitary certificates and inspections for plant imports, and Thailand public export pages support combo-specific treatment conditions for Japan mango and Japan mangosteen.
- Korea mango has the clearest publicly available commodity protocol and strongly supports richer fields on existing phyto/treatment evidence.

### Most likely true expansion candidate from this pass

- No combo is yet strong enough from external research alone to justify a new standalone OCR family without `34.10.2` reconciliation against live rule-pack scope.

### Most likely field-only expansions on existing families

- EU mango phytosanitary additional declaration / traceability / treatment basis
- JAPAN/MANGO treatment-reference and VHT proof details
- JAPAN/MANGOSTEEN treatment-reference / treatment-condition proof
- KOREA/MANGO orchard-registration, packinghouse-registration, seal/container, and VHT declaration fields

### Important unresolved items

- Whether `Grading Report` is externally justified as a true standalone support family across one or more combos, or is mainly a rule-pack/business-process requirement not strongly reflected in the public government sources gathered here
- Whether `KOREA/MANGOSTEEN` supporting paperwork belongs in the matrix at all as uploaded OCR families, or should remain only as exporter-process / reference evidence outside canonical OCR scope
- Whether the `EU/DURIAN` phytosanitary-certificate requirement in the current matrix should be narrowed when reconciled against the external EU plant-health exemption for durian
- Whether `KOREA/DURIAN` has a real commodity-specific import path in scope or should be considered externally under-supported until better official evidence is obtained

## Recommended Outputs For 34.10.2

- Compare each combo here against:
  - live rule-pack required documents
  - current matrix labels and field sets
  - current scope-audit conclusions
- For each combo, classify findings as exactly one of:
  - `keep current matrix only`
  - `expand fields on existing matrix document`
  - `add new standalone document family`
  - `external evidence weak / unresolved`

## Guardrails

- Do not add any new matrix label from this document alone.
- Treat Thailand procedural pages as useful but secondary to importing-country NPPO / law when conflicts appear.
- Prefer under-modeling to over-modeling until `34.10.2` reconciliation is complete.
