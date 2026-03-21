-- SHA-256 hash format validation (lowercase hex, 64 chars)
ALTER TABLE "evidence_artifacts" ADD CONSTRAINT "chk_evidence_content_hash"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "proof_packs" ADD CONSTRAINT "chk_proof_pack_content_hash"
  CHECK ("content_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "audit_entries" ADD CONSTRAINT "chk_audit_payload_hash"
  CHECK ("payload_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "audit_entries" ADD CONSTRAINT "chk_audit_prev_hash"
  CHECK ("prev_hash" ~ '^[0-9a-f]{64}$');

ALTER TABLE "audit_entries" ADD CONSTRAINT "chk_audit_entry_hash"
  CHECK ("entry_hash" ~ '^[0-9a-f]{64}$');

-- MFA enforcement: Admin and Auditor roles must have MFA enabled
ALTER TABLE "users" ADD CONSTRAINT "chk_admin_auditor_mfa"
  CHECK (
    (role NOT IN ('ADMIN', 'AUDITOR'))
    OR (mfa_enabled = true)
  );
