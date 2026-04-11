# OCR Runtime Scope Reference

## Purpose

This document explains what the current OCR/form-completeness system in ZRL does and does not do.

It is intended to answer four recurring questions clearly:

1. What does `rules/document-matrix.yaml` actually define?
2. What does the current runtime system actually check from uploaded lane evidence?
3. What is the difference between the exhaustive rule-data harness and OCR-derived document checks?
4. What would still be needed to reach full document-derived compliance `PASS/FAIL` from uploaded forms alone?

This document reflects the current implemented system as of the current OCR readiness work through:

- `34.7.1` to `34.7.5`
- `34.9.1` to `34.9.10`
- `34.10.1` to `34.10.8`

## Short Answer

The current system supports:

- required-document presence checks
- OCR-based document classification
- OCR-based field completeness checks
- limited backend use of OCR-derived fields
- threshold-based MRL validation when structured numeric lab results already exist

The current system does **not** yet generally support:

- full numeric threshold extraction from uploaded PDFs/images via OCR alone
- full cross-document consistency validation across all submitted forms
- automatic semantic validation of every approval letter/supporting certificate unless it is explicitly modeled in the matrix

## Current Scope vs Future Scope

| Area                                                                   | Current Version                                                                           | Future / Not Yet Implemented                                                               |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Supported document scope                                               | Current first-pass matrix labels in `rules/document-matrix.yaml`                          | Extra approval/support letters or certificate families only after explicit matrix modeling |
| Required-document checks                                               | Yes, per supported combo                                                                  | Same, but can expand if the matrix expands                                                 |
| OCR document classification                                            | Yes, for analyzable artifact families                                                     | Broader only if new artifact/document families are added                                   |
| OCR field completeness                                                 | Yes                                                                                       | Broader semantic/value checks still pending                                                |
| Combo-specific override fields                                         | Yes, for currently modeled phyto/VHT overrides                                            | Additional overrides only if new matrix requirements are added                             |
| Certification expiry validation                                        | Yes, metadata first with OCR fallback in limited cases                                    | Could be broadened if more cert types/fields are modeled                                   |
| Trade-document checklist satisfaction                                  | Yes, with metadata first and OCR label fallback                                           | Could be hardened further with more cross-document rules                                   |
| MRL threshold comparison                                               | Yes, when structured numeric lab data already exists in artifact metadata                 | Full OCR-derived numeric extraction and comparison still pending                           |
| MRL PDF/image-only numeric PASS/FAIL                                   | No, not generally                                                                         | Would require OCR table extraction + numeric normalization + qualifier handling            |
| Cross-document consistency (dates, shipment refs, linked certificates) | No, not generally                                                                         | Future scope if reconciliation rules are explicitly added                                  |
| Browser OCR proof                                                      | Yes, exhaustive for the current fixture-backed first-pass set, including `Grading Report` | Must expand again when the matrix grows ahead of fixtures/browser proof                    |
| Multiple filled variants per form family                               | Not required for the current first-pass completeness scope                                | Recommended for robustness hardening or stricter readiness                                 |
| Full document-derived PASS/FAIL from uploads alone                     | No                                                                                        | Requires stronger extraction, reconciliation, and rule-comparison layers                   |

### Current conclusion for extra supporting forms/certificates

As of the current first-pass OCR matrix, the modeled standalone OCR document families include `Grading Report` in addition to the earlier baseline labels.

This is a repo-state conclusion, not a claim that the real-world standards can never require more. If later combo-by-combo external research confirms additional supporting forms or approval letters, that expansion should proceed as explicit follow-on scope rather than being silently assumed into the current matrix.

What does exist are extra compliance controls such as:

- registration requirements
- overseas inspection requirements
- certificate-label control
- fumigation/treatment declaration requirements

But in the current modeled system these are treated as:

- field requirements on existing documents
- treatment/certification constraints
- or non-document operational controls

They are **not** yet grounded as separate upload document families.

At the same time, some live rule-pack required documents still sit outside that first-pass matrix and should be treated as explicit future modeling scope rather than implicitly dismissed.

Current planning state after `34.10.3`:

- `docs/OCR-34-10-3-SCOPE-DECISION-LEDGER.md` records the explicit decision boundary for future matrix work.
- `Grading Report` has now advanced into matrix modeling via `34.10.4`.
- operational evidence (`Product Photos`, `Temperature Log`, `SLA Summary`, `Excursion Report`, `Handoff Signatures`) remains outside first-pass OCR document-family scope.
- unresolved items such as `EU/DURIAN` phyto scope and Korea mangosteen exporter-process paperwork remain deferred until separately closed.
- machine-readable unresolved OCR/policy exceptions now live in `rules/ocr-policy-exceptions.yaml`; this currently records the `EU/DURIAN` phytosanitary dispute without changing live rule enforcement.
- `docs/OCR-34-10-8-TRACEABILITY-AUDIT.md` now records the final end-to-end proof that `Grading Report` moved from research through matrix, fixtures, classifier, browser proof, and readiness accounting.

## Glossary

### Core Terms

- **OCR**: Optical Character Recognition. Extracting text from uploaded files such as PDFs or images.
- **Lane**: The system’s atomic unit of work. A lane represents an exporter + shipment/batch + destination + route + evidence + rules context.
- **Artifact**: An uploaded evidence file associated with a lane.
- **Field completeness**: Whether a required document field was detected as present, missing, low confidence, or unsupported.

### Documents and Certificates

- **Phytosanitary Certificate** (`PHYTO_CERT`)
  - Official plant-health export certificate
  - In practice, Thailand-side official plant-health evidence used for destination import checks

- **VHT Certificate** (`VHT_CERT`)
  - Vapor Heat Treatment evidence/certificate/record
  - Used for combos where treatment proof is required

- **MRL Test Results** (`MRL_TEST`)
  - Laboratory residue analysis report
  - Contains pesticide residue test results for a sample

- **GAP Certificate** (`GAP_CERT`)
  - Good Agricultural Practices certificate
  - Production/process certification evidence

- **Export License**
  - Exporter authorization/registration evidence on the Thailand side
  - In the current upload model, this is uploaded under `INVOICE` and distinguished by OCR/metadata document labeling

- **Commercial Invoice**
  - Trade invoice for the shipment

- **Grading Report**
  - Quality/grading evidence currently modeled in the matrix under `INVOICE`
  - Committed fixture coverage now exists via `34.10.5`
  - Classifier support now exists via `34.10.6`
  - Downstream backend checklist proof and browser matrix proof now exist via `34.10.7`

- **Packing List**
  - Package/consignment breakdown document

- **Transport Document**
  - Shipment/transport evidence, such as airway bill style documentation

- **Delivery Note**
  - Delivery/handoff acknowledgment document

### Organizations and Authorities

- **NPPO**: National Plant Protection Organization
  - Government plant-health authority

- **MAFF**: Ministry of Agriculture, Forestry and Fisheries of Japan

- **QIA**: Korea Animal and Plant Quarantine Agency

- **MFDS**: Ministry of Food and Drug Safety of Korea

- **Department of Agriculture**
  - In this project context, typically Thailand’s Department of Agriculture

### Regulatory / Lab Terms

- **MRL**: Maximum Residue Limit
  - Maximum legally allowed pesticide residue level in food, usually expressed in `mg/kg`

- **Structured lab data**
  - Machine-readable numeric residue data already present in artifact metadata
  - In the current system, this usually means `metadata.results` on an `MRL_TEST` artifact
  - It is **not** the same thing as OCR text extracted from a PDF/image

## What `rules/document-matrix.yaml` Actually Defines

`rules/document-matrix.yaml` is the canonical first-pass OCR/document-completeness contract.

It defines:

1. **Which combos are supported**

- Example: `JAPAN/MANGO`, `EU/DURIAN`, `KOREA/MANGOSTEEN`

2. **Which documents are required for each supported combo**

- Example: `JAPAN/MANGO` requires:
  - `Phytosanitary Certificate`
  - `VHT Certificate`
  - `MRL Test Results`
  - `GAP Certificate`
  - `Export License`
  - `Commercial Invoice`
  - `Packing List`
  - `Transport Document`
  - `Delivery Note`

3. **Which artifact type each document maps to**

- Example:
  - `Phytosanitary Certificate` -> `PHYTO_CERT`
  - `MRL Test Results` -> `MRL_TEST`
  - `Export License` -> `INVOICE`

4. **Which fields are required on each document**

- Example: `MRL Test Results` requires fields like:
  - `reportNumber`
  - `laboratoryName`
  - `sampleId`
  - `analysisDate`
  - `analyteTable`
  - `resultUnits`

5. **Which combo-specific override fields are required**

- Example:
  - `JAPAN/MANGO` phyto requires `mustStateFruitFlyFree` and `treatmentReference`
  - `KOREA/MANGOSTEEN` phyto requires `fumigationDetails`
  - `JAPAN/MANGO` VHT requires `allowedVariety` and `maffVerificationReference`

### What the matrix does **not** define

The matrix does **not** by itself define:

- full cross-document consistency rules
- all business validation derived from comparing one submitted document against another
- all threshold calculations from OCR text
- extra support letters/certificates unless they are explicitly added to the matrix

## What the Current Version Actually Checks

### 1. Required document presence for a lane

Given a lane’s combo, the rules engine checks whether required documents are present.

This can be satisfied by:

- artifact type
- explicit document metadata
- OCR document label fallback
- file-name fallback in a few cases

The result appears in lane completeness/checklist output.

### 2. OCR document classification

For analyzable artifact types:

- `PHYTO_CERT`
- `VHT_CERT`
- `MRL_TEST`
- `GAP_CERT`
- `INVOICE`

the system can classify uploaded documents into labels such as:

- `Phytosanitary Certificate`
- `VHT Certificate`
- `MRL Test Results`
- `Commercial Invoice`
- etc.

### 3. Field completeness

For supported document types, the system records:

- expected fields
- present fields
- missing fields
- low-confidence fields
- unsupported fields

This is the main purpose of the current OCR/form-completeness version.

### 4. Limited backend use of OCR-derived fields

The current backend integration uses OCR-derived data in a bounded way:

- certification expiry fallback from OCR-extracted expiry fields
- lab report presence/shape fallback from OCR analysis
- invoice-family checklist satisfaction from OCR document labels
- reanalysis-driven lane compliance refresh
- provenance fields showing whether a decision used metadata or OCR

### 5. Real threshold validation only when structured numeric data exists

The rules engine can produce real MRL validation outcomes such as:

- `PASS`
- `FAIL`
- `BLOCKED`
- `UNKNOWN`

but only when it has structured numeric residue results available.

Today, that usually means:

- `MRL_TEST` artifact metadata already includes structured `results`

The current system does **not** yet generally derive those numeric residue rows from OCR text alone.

## What the Current Version Does **Not** Check Yet

The current version does **not** yet provide full document-derived compliance validation from uploaded forms alone.

### Not yet generally implemented

1. **Full numeric analyte extraction from OCR text**

- Example not yet generally supported:
  - user uploads an MRL PDF only
  - system OCRs full analyte table numerically
  - system compares every analyte to rule thresholds
  - system returns full regulatory PASS/FAIL from that PDF alone

2. **Full cross-document consistency checks**

- Example not yet generally implemented:
  - invoice reference in packing list matches commercial invoice
  - transport document shipment reference matches invoice and delivery note
  - phyto/VHT references match one another
  - exporter/consignee/date relationships are validated across all docs

3. **General semantic validation of support letters/certificates not in the matrix**

- If a document family is not explicitly represented in `rules/document-matrix.yaml`, the current readiness/test program does not treat it as canonical scope

4. **All-threshold validation from OCR text alone for all combos**

- The exhaustive regulatory truth exists in the rule packs
- but the current runtime does not yet ingest all those values from uploaded documents automatically

## How the Exhaustive Data Harness Fits In

This is the most important distinction.

### The exhaustive rule/data harness does

- define canonical regulatory truth for each supported combo
- define required documents for each combo
- define threshold data such as MRL rules in the rule packs / CSV files
- validate that the rule packs themselves are complete, explicit, and internally consistent

### The exhaustive rule/data harness does **not** do

- automatically read all lane uploads and derive all regulatory values from them
- replace the need for OCR extraction
- guarantee that all attached PDFs/images contain machine-readable numbers ready for direct threshold comparison

So:

- the harness defines **what should be checked**
- the runtime only checks **what it can currently derive from lane inputs + metadata + OCR + existing structured data**

## Does the Current System Extract Numbers From an Uploaded MRL PDF and Compare Them to Thresholds?

### Short answer

No, not reliably in the full numeric sense.

### What happens today with an uploaded `MRL_TEST` PDF/image

The system can usually:

1. upload the file
2. classify it as `MRL Test Results`
3. extract structure/completeness fields such as:
   - `reportNumber`
   - `laboratoryName`
   - `sampleId`
   - `analysisDate`
   - `analyteTable`
   - `resultUnits`
   - `authorizedSignatory`
4. conclude that the document is present and structurally plausible

But it does **not** yet generally:

- OCR the analyte table into complete numeric residue rows
- compare those parsed rows to all rule thresholds automatically

So:

- `MRL PDF only` -> usually document presence/completeness and possibly blocked/unknown
- `MRL with structured metadata.results` -> current rules engine can do real threshold comparison

## File Types Currently Supported In the UI

The frontend evidence upload UI currently accepts:

- `.pdf`
- `.jpg`
- `.jpeg`
- `.png`
- `.csv`
- `.json`

Code reference:

- `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.tsx`

### Not currently in the visible frontend accept list

- `.xlsx`
- `.xls`
- raw `.svg` in the normal end-user upload input

### Important nuance

Playwright OCR readiness tests currently render committed SVG fixtures into PNGs before upload because that proved reliable in the browser OCR path. That is a test harness strategy, not evidence that normal user-facing SVG upload is a supported product workflow.

## Where Users Upload Evidence Today

Users upload files in the lane **Evidence** tab.

Current upload entries include:

- `Upload MRL Test Report`
- `Upload VHT Certificate`
- `Upload Phytosanitary Certificate`
- `Upload GAP Certificate`
- `Upload Invoice`
- `Upload Temperature Data`
- `Upload Checkpoint Photo`
- `Upload Handoff Signature`

Relevant files:

- `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.tsx`
- `src/modules/evidence/evidence.controller.ts`

## Does the Current UI Have a Separate Structured Lab Data Upload Surface?

No dedicated separate structured-lab-data screen was found.

Today the practical path is:

- upload an `MRL_TEST` artifact
- optionally attach structured metadata when the caller/integration provides it
- rules-engine uses structured `metadata.results` when available

So “structured lab data” in the current system means the backend artifact metadata is already machine-readable, not that the UI has a dedicated spreadsheet-import wizard.

## Document-by-Document Runtime Reference

| Document / Certificate    | Artifact Type       | Typical Intended Upload Formats Today | Current Runtime Uses                                                                                 | Notes                                                                                                                               |
| ------------------------- | ------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Phytosanitary Certificate | `PHYTO_CERT`        | PDF, JPG, JPEG, PNG                   | OCR + metadata, with metadata-first fallback where available                                         | Official plant-health form. OCR completeness is well-covered, and backend currently uses expiry fallback from OCR in limited cases. |
| VHT Certificate           | `VHT_CERT`          | PDF, JPG, JPEG, PNG                   | OCR + metadata, with metadata-first fallback where available                                         | Treatment evidence. OCR supports combo-specific override fields for Japan/Korea cases.                                              |
| MRL Test Results          | `MRL_TEST`          | PDF, JPG, JPEG, PNG, JSON, CSV        | OCR for document structure/completeness; structured metadata for actual numeric threshold comparison | OCR can prove the doc is a real lab report, but full numeric PASS/FAIL currently depends on structured `metadata.results`.          |
| GAP Certificate           | `GAP_CERT`          | PDF, JPG, JPEG, PNG                   | OCR + metadata, with metadata-first fallback where available                                         | Certification evidence with completeness support and limited backend expiry handling.                                               |
| Export License            | `INVOICE`           | PDF, JPG, JPEG, PNG                   | OCR + metadata document labeling                                                                     | Currently uploaded through the invoice-family slot and distinguished by `documentLabel` / metadata document type.                   |
| Commercial Invoice        | `INVOICE`           | PDF, JPG, JPEG, PNG                   | OCR + metadata document labeling                                                                     | Trade-document checklist can now use OCR label fallback when metadata document typing is absent.                                    |
| Packing List              | `INVOICE`           | PDF, JPG, JPEG, PNG                   | OCR + metadata document labeling                                                                     | Same invoice-family behavior as above.                                                                                              |
| Transport Document        | `INVOICE`           | PDF, JPG, JPEG, PNG                   | OCR + metadata document labeling                                                                     | Same invoice-family behavior as above.                                                                                              |
| Delivery Note             | `INVOICE`           | PDF, JPG, JPEG, PNG                   | OCR + metadata document labeling                                                                     | Same invoice-family behavior as above.                                                                                              |
| Temperature Data          | `TEMP_DATA`         | CSV, JSON                             | Structured file ingestion, not OCR-first                                                             | This is outside the first-pass OCR matrix. Runtime cold-chain logic reads structured uploads.                                       |
| Checkpoint Photo          | `CHECKPOINT_PHOTO`  | JPG, JPEG, PNG                        | Not in first-pass OCR matrix                                                                         | Evidence is stored and verified, but first-pass OCR completeness does not model this family.                                        |
| Handoff Signature         | `HANDOFF_SIGNATURE` | PDF, JPG, JPEG, PNG                   | Not in first-pass OCR matrix                                                                         | Stored as evidence and used in checklist/completeness by artifact type, but not modeled as OCR form-completeness today.             |

### Practical interpretation of the table

- **OCR + metadata** means the current runtime can use OCR-derived analysis for classification/completeness and may also use metadata where available.
- **Metadata-first fallback** means runtime compliance logic prefers structured metadata when present and only falls back to OCR in the bounded cases already implemented.
- **Structured file ingestion** means the path is currently based on machine-readable uploads rather than OCR form extraction.
- **Not in first-pass OCR matrix** means the artifact family is in the product, but the current OCR/form-completeness program does not treat it as part of the canonical first-pass form scope.

## Current Version Checks vs Does Not Check Yet

### Current version checks

- required document present/missing for the combo
- OCR document classification
- OCR field completeness
- combo-specific OCR override fields for supported fixtures
- certification expiry state with metadata-first and limited OCR fallback
- MRL threshold comparison when structured numeric residue data already exists
- OCR-backed lab-document presence vs blocked/unknown distinction
- OCR-backed trade-document label fallback
- OCR provenance in backend compliance output

### Current version does **not** check yet

- full analyte-table numeric extraction from OCR text alone
- full PASS/FAIL from uploaded PDFs/images alone across all combos
- full cross-document consistency
- full support-letter/certificate semantics outside the modeled matrix
- exhaustive value-level reconciliation across all submitted documents in a lane

## What Would Be Needed For Full Document-Derived PASS/FAIL

To reach the stronger target of true compliance decisions derived from uploaded forms alone, the system would need additional capabilities.

### 1. Stronger document modeling

- expand `rules/document-matrix.yaml` if more document families are required
- explicitly model any support letters / approval letters / extra certificates

### 2. Full structured numeric extraction from OCR

- table extraction from lab reports
- analyte name normalization
- numeric value extraction with units
- qualifier handling (`N.D.`, `<LOQ`, etc.)
- confidence/error handling for partial rows

### 3. Cross-document reconciliation

- shipment reference consistency
- date consistency
- linked certificate/reference consistency
- exporter/consignee/commodity consistency across forms

### 4. Document-to-rule comparison layer

- compare extracted numeric values directly to rule thresholds
- compare extracted treatment fields to required treatment parameters
- compare extracted expiry/issue dates to validity windows

### 5. Higher-confidence fixture/test program

- multiple filled variants per form family if robustness to layout/issuer variation is required
- exhaustive browser proof for every fixture-backed `combo x document` slot
- readiness ledger that tracks proof coverage per slot

## What “Ready” Means Today vs Stronger Future Version

### Current OCR readiness meaning

- required docs are modeled
- committed fixtures exist
- classifier proof exists
- backend OCR integration exists in limited, truthful places
- browser OCR proof exists exhaustively for the current fixture-backed slot set, including the added `Grading Report` family

### Stronger future readiness meaning

- every required document slot has explicit proof
- browser proof may be exhaustive per slot
- multiple filled versions may be tested per form family
- extra support documents are modeled explicitly
- value-level regulatory PASS/FAIL can be derived from uploaded documents where required

## Practical Guidance For Now

If your immediate question is:

> Do we need 4-5 filled variants per form for the current first-pass OCR completeness version?

The answer is:

- **Not required** for the current first-pass document-completeness scope
- **Useful and recommended** for later robustness hardening
- **Required** only if the product goal becomes broader than first-pass completeness and moves into layout/issuer variance resilience or full document-derived compliance validation

If your immediate question is:

> Can a user upload an MRL PDF and have the current system extract numbers and compare them to thresholds automatically?

The answer is:

- **Not generally from OCR alone today**
- threshold comparison is currently reliable when structured numeric result data already exists in artifact metadata

## References

- `rules/document-matrix.yaml`
- `src/modules/evidence/evidence.document-classifier.ts`
- `src/modules/evidence/evidence.types.ts`
- `src/modules/rules-engine/rules-engine.service.ts`
- `src/modules/evidence/evidence.controller.ts`
- `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.tsx`
- `coding-logs/2026-04-08-12-35-57 Coding Log (ocr-all-combos-readiness-plan).md`
- `coding-logs/2026-04-08-17-39-47 Coding Log (ocr-34-7-backend-integration-breakdown).md`
