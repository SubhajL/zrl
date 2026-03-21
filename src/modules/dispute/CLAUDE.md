# Dispute Module (M4)

## What This Module Does
Auto-generates defense-grade dossiers when shipments face rejection, quality claims, or chargebacks. Reconstructs chain-of-custody timelines and provides forensic evidence for disputes.

## Key Rules
- Claim Defense Pack has 6 mandatory sections — all must be populated
- Defense pack generation target: <5 minutes
- Lane transitions to CLAIM_DEFENSE status when a dispute is triggered
- 5 dispute scenarios: customs rejection, buyer quality claim, insurance claim, grade dispute, cargo damage

## Defense Pack Sections
1. Executive Summary — lane facts, timeline overview
2. Chain-of-Custody Timeline — every handoff with timestamp, location, signer
3. Compliance Report — all rule checks pass/fail per substance
4. Temperature Forensics — temp graphs, excursion analysis, root cause
5. Visual Evidence — checkpoint photos with EXIF metadata
6. Audit Trail — complete hash-chained log extract

## Key Entities
- `Claim` — dispute record with type, claimant, status, financial impact
- `DefensePack` — generated 6-section PDF dossier
- `TimelineEvent` — reconstructed chronological event

## Dependencies
- Imports: `EvidenceModule` (proof packs), `ColdChainModule` (SLA reports), `AuditModule`, `LaneModule`

## Testing
- Timeline reconstruction: correct chronological order from mixed event sources
- All 6 sections render with sample data
- Generation <5 minutes
- Test with 10+ claim scenario fixtures
