# Evidence Module (M2)

## What This Module Does
Manages the evidence lifecycle: upload → SHA-256 hash → S3 storage → DAG linking → completeness scoring → proof pack generation. The evidence graph is a tamper-evident DAG where modifying any artifact invalidates downstream hashes.

## Key Rules
- Every artifact **MUST** receive a SHA-256 content hash on upload — this is core to the product
- **MUST NOT** store evidence files in the database — use S3 with hash references
- S3 key format: `evidence/{lane_id}/{artifact_type}/{hash}.{ext}`
- Evidence is never orphaned — every artifact belongs to a Lane ID
- Three proof pack types (Regulator, Buyer, Defense) generated from the **SAME** evidence graph — different views, not different data
- Proof pack generation requires lane completeness ≥ 95%
- Each generated pack includes a verification hash and QR code

## Artifact Types
`MRL_TEST`, `VHT_CERT`, `PHYTO_CERT`, `CHECKPOINT_PHOTO`, `TEMP_DATA`, `HANDOFF_SIGNATURE`, `INVOICE`, `GAP_CERT`

## Key Entities
- `EvidenceArtifact` — uploaded file with content_hash, S3 path, type, verification status
- `ArtifactLink` — DAG edge connecting artifacts (source → target with relationship type)
- `ProofPack` — generated PDF with content_hash, pack_type (REGULATOR/BUYER/DEFENSE)

## Dependencies
- Imports: `HashingModule`, `AuditModule`, `LaneModule`
- Used by: `DisputeModule` (defense packs), frontend evidence tab

## Testing
- Hash determinism: same file → same hash, always
- Upload creates audit entry
- Hash verification: re-compute from S3, compare with stored
- DAG: no cycles, graph traversal from any node, integrity verification
- Pack generation: <30 seconds, includes QR code, hash matches stored value
