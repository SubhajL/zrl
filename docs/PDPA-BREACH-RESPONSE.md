# PDPA Breach Response Runbook

This runbook defines the minimum response path for ZRL incidents involving Thai PDPA-regulated personal data. The goal is to preserve evidence immediately, scope impact quickly, and keep the team capable of notifying the PDPA Office within 72 hours when required.

## Scope

Use this runbook when an incident affects or may affect:
- user emails, names, phone numbers, company contact details
- exporter settings and consent records
- data export archives
- any logs or attachments containing personal data

## Roles

- Incident Commander: owns timeline, decisions, and external approvals
- Engineering Lead: contains systems, preserves evidence, validates remediation
- Privacy Owner: determines PDPA notification/reporting obligations
- Communications Owner: prepares customer/regulator messaging

## T0-T72 Timeline

### T0-T2 hours

- Declare the incident and open a timestamped incident record.
- Freeze destructive operations that could alter evidence.
- Capture affected services, users, datasets, and first-known timestamps.
- Preserve:
  - relevant application logs
  - database records
  - object-store keys
  - deployment/version identifiers
- Rotate or revoke exposed secrets, credentials, API keys, or sessions if compromise is plausible.

### T2-T24 hours

- Classify the exposed data types and impacted users.
- Determine whether the event is confirmed, suspected, or contained.
- Document:
  - root cause hypothesis
  - time window of exposure
  - systems and regions affected
  - personal-data categories involved
  - containment actions completed
- Confirm whether any personal-data exports, consent records, or user profile endpoints were accessed abnormally.

### T24-T48 hours

- Decide whether PDPA Office notification is required.
- Draft the regulator/customer narrative with:
  - incident summary
  - likely impact
  - categories of personal data involved
  - number or estimate of affected data subjects
  - containment/remediation steps
  - contact point for follow-up
- Prepare targeted user communications if data-subject notification is required.

### T48-T72 hours

- Submit required PDPA Office notification if the threshold is met.
- Notify affected users when legally required or operationally prudent.
- Finalize:
  - confirmed timeline
  - corrective actions
  - monitoring added
  - follow-up owner and deadline

## Evidence Preservation Checklist

- Retain application logs with PII already redacted where possible.
- Export relevant DB rows before cleanup or replay.
- Record the exact migration/app version and infrastructure identifiers.
- Preserve audit entries and privacy request/export row IDs.
- Do not delete compromised data until legal/privacy review confirms the path.

## Minimum Incident Record

Every PDPA-relevant incident must capture:
- incident id
- detected at
- declared at
- reporter
- suspected root cause
- affected services
- personal-data categories involved
- estimated affected user count
- containment actions
- notification decision
- regulator notification timestamp if sent
- customer notification timestamp if sent
- remediation owner

## ZRL-Specific Checks

- Review `/users/me`, `/users/me/consent`, `/users/me/privacy-requests`, and `/users/me/data-export*` access patterns.
- Review `data_export_requests` for abnormal generation/download bursts.
- Review `privacy_consent_events` and `privacy_requests` for unauthorized changes.
- Review notification and settings logs through the redacting logger output, not raw unsanitized payloads.

## Post-Incident Follow-Up

- Add or tighten tests for the failed control.
- Add monitoring for the missed detection path.
- Update this runbook if the incident exposed an operational gap.
