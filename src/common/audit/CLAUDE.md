# Audit Trail Service

## What This Module Does
Append-only, hash-chained audit log recording every system action. This is a **MUST NOT modify** component — the schema is append-only and hash-chained by design.

## Key Rules
- **MUST NOT** modify the audit log schema — it is append-only and hash-chained
- **MUST NOT** allow UPDATE or DELETE on audit entries — enforce at database level
- Each entry references previous entry's hash — tampering invalidates the chain
- Retention: 10 years
- Every lane operation, evidence upload, checkpoint, pack generation, and state change creates an audit entry

## Audit Entry Schema
| Field | Type | Description |
|-------|------|-------------|
| entry_id | UUID | Unique identifier |
| timestamp | ISO 8601 UTC | Event time |
| actor | String | User ID or "system" |
| action | Enum | UPLOAD, SIGN, GENERATE, VERIFY, CREATE, UPDATE |
| entity_type | Enum | LANE, ARTIFACT, CHECKPOINT, PROOF_PACK |
| entity_id | UUID | Associated entity |
| payload_hash | SHA-256 | Hash of associated content |
| prev_hash | SHA-256 | Hash of previous entry |
| entry_hash | SHA-256 | This entry's computed hash |

## Dependencies
- Imports: `HashingModule`
- Used by: Every module that creates auditable actions

## Testing
- Chain integrity: valid chain passes, tampered entry fails at exact position
- Concurrent entry creation maintains chain order (transaction-based)
- No UPDATE/DELETE operations succeed on audit table
- Export produces valid JSON with all hash fields
