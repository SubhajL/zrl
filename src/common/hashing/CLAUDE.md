# Hashing Service

## What This Module Does
Core SHA-256 content hashing used across all modules. This is **critical to the product** — every evidence artifact, audit entry, and proof pack depends on it.

## Key Rules
- All hashes are SHA-256, lowercase hex strings
- File hashing **MUST** use streaming (not full buffer) for large files
- Hash chain for audit: `entry_hash = SHA-256(timestamp + actor + action + entity_type + entity_id + payload_hash + prev_hash)`
- Genesis hash (first entry in chain) uses a known constant, not empty string

## API
- `hashFile(stream: ReadableStream): Promise<string>` — streaming file hash
- `hashString(content: string): Promise<string>` — string content hash
- `hashBuffer(buffer: Buffer): string` — synchronous buffer hash
- `computeEntryHash(entry): string` — audit chain hash
- `verifyArtifactHash(id, storedHash): Promise<boolean>` — re-hash from S3 and compare
- `verifyChain(entries): {valid, firstInvalidIndex?}` — walk the audit chain

## Testing (≥95% coverage required)
- Determinism: same input → same hash
- Uniqueness: different input → different hash
- Streaming matches buffer hash for same file
- Chain verification: valid chain passes, tampered chain fails at correct position
- Edge cases: empty file, >100MB file, unicode content
