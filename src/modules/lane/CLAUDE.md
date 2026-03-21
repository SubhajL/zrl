# Lane Module (Core Orchestration)

## What This Module Does
The Lane is the **atomic unit** of ZRL: `{Exporter + Batch + Destination + Route + Evidence + Rules + SLA}`.
All other modules (M1–M5) attach to a Lane. No evidence, checkpoint, or proof pack exists without a Lane ID.

## Key Rules
- Lane ID format: `LN-YYYY-NNN` (auto-generated, sequential per year)
- Batch ID format: `MNG-JPN-YYYYMMDD-NNN` (product-market-date-sequence)
- **State machine is enforced** — cannot skip states (e.g., CREATED → PACKED is invalid)
- Valid lifecycle: `CREATED → EVIDENCE_COLLECTING → VALIDATED → PACKED → CLOSED`
- Lane cannot transition to VALIDATED until completeness ≥ 95%
- Lane creation **snapshots** current rules — rule updates do not affect in-flight lanes
- Every state transition **MUST** create an audit entry

## Key Entities
- `Lane` — central entity, owns batch, route, checkpoints, evidence, packs
- `Batch` — product details (type, variety, quantity, origin, harvest date, grade)
- `Route` — logistics path with segments and carriers
- `Checkpoint` — chain-of-custody handoff point (GPS, photo, signature, temp)

## Dependencies
- Imports: `AuditModule`, `HashingModule`, `AuthModule`
- Used by: Every other module (M1–M5), all frontend screens

## Testing
- Unit: lane CRUD, state machine transitions (all valid + all invalid paths), ID generation
- Integration: API endpoints with auth, filtering, pagination
- Every operation must create audit entries — test for their presence
