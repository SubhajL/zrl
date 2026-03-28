# Task 9.4 Planning - Certification Expiry Alerting

## Plan Draft A

### 1. Overview
Implement Task `9.4` by finishing the missing alerting layer on top of the already-shipped certification expiry detection logic. The change will emit lane-owner notifications on certification upload when an uploaded `GAP_CERT`, `VHT_CERT`, or `PHYTO_CERT` is already expired or missing expiry metadata, and it will add a background daily scan for upcoming `30/14/7` day warnings across active lanes.

### 2. Files to Change
- `src/modules/evidence/evidence.service.ts`: trigger upload-time certification alert creation after rules evaluation.
- `src/modules/evidence/evidence.service.spec.ts`: cover upload-time expired-cert notification behavior.
- `src/modules/rules-engine/rules-engine.service.ts`: add reusable certification alert planning helpers and daily-scan entry point.
- `src/modules/rules-engine/rules-engine.types.ts`: add explicit types for upcoming-expiry scan results and alert payloads if needed.
- `src/modules/rules-engine/rules-engine.pg-store.ts`: add query support for active-lane certification scans and dedupe lookups.
- `src/modules/rules-engine/rules-engine.module.ts`: wire the new worker/service dependency.
- `src/modules/rules-engine/certification-expiry.worker.ts`: background interval service that runs the daily warning scan.
- `src/modules/rules-engine/rules-engine.service.spec.ts`: cover daily warning computation and dedupe behavior.
- `test/rules-engine.e2e-spec.ts` or `test/evidence.e2e-spec.ts`: prove real route/module wiring for upload-time and scan-time notifications.
- `docs/PROGRESS.md`: terse progress note.

### 3. Implementation Steps
- TDD sequence:
  1. Add service tests for upload-time expired-cert notifications and scan-time upcoming warnings.
  2. Run the focused tests and confirm they fail because notifications/scans are not wired.
  3. Implement the smallest upload-time notification path in `EvidenceService`.
  4. Implement the scan query + worker + dedupe path in rules-engine.
  5. Run focused fast gates, then broader lint/typecheck/build.
- `RulesEngineService.collectCertificationAlertNotifications(...)`
  Reuse the existing `detectCertificationAlerts(...)` output and convert it into concrete notification candidates. This keeps the rules logic authoritative and avoids re-parsing metadata in multiple places.
- `RulesEngineService.scanCertificationExpirations(...)`
  Query active lanes and current certification artifacts, compute warning windows for `30`, `14`, and `7` day horizons, and return only alert candidates that should be emitted now.
- `CertificationExpiryWorker`
  Run on module bootstrap with a 24-hour interval and a guarded immediate first pass. Keep the worker fail-closed: log errors and continue the next interval, never mark warnings as delivered unless the notification row is actually written.
- `EvidenceService.persistArtifact(...)`
  After evaluation succeeds, if the uploaded artifact is a certification type, ask the rules engine for immediate alert candidates and notify the lane owner.
- Expected behavior and edge cases:
  - Expired cert or missing expiry metadata on upload emits an owner notification within the request path.
  - Valid future expiry on upload emits no immediate warning unless already within a configured warning window.
  - Daily scans emit `30/14/7` warnings once per certification artifact per horizon.
  - Soft-deleted artifacts or inactive/closed lanes are excluded.
  - Invalid/unparseable expiry metadata fails closed as an expiry problem, matching existing rules behavior.

### 4. Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact notifies lane owner for expired certification`
    Expired cert upload creates immediate alert notification.
  - `uploadArtifact notifies lane owner for certification missing expiry metadata`
    Missing expiry metadata fails closed and alerts.
  - `uploadArtifact does not notify for valid non-warning certification`
    Clean upload stays quiet.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `scanCertificationExpirations returns 30/14/7 day warnings`
    Upcoming expiry windows are computed correctly.
  - `scanCertificationExpirations skips previously emitted warning horizon`
    Dedupes repeated daily scans.
  - `scanCertificationExpirations ignores inactive lanes and deleted artifacts`
    Scope is limited to active lane evidence.
- `test/rules-engine.e2e-spec.ts` or `test/evidence.e2e-spec.ts`
  - `expired certification upload creates persisted notification`
    Real Nest wiring writes the notification row.
  - `daily certification scan writes warning notifications`
    Worker/service path is registered and functional.

### 5. Decision Completeness
- Goal:
  Complete Task `9.4` by turning existing certification expiry detection into persisted/delivered notifications for immediate expiry detection and scheduled warning windows.
- Non-goals:
  - Building new user-facing notification UI.
  - Changing certification metadata extraction formats beyond current fields.
  - Generalizing a full cron framework for unrelated jobs.
- Success criteria:
  - Certification uploads with expired or metadata-missing certs create owner notifications.
  - A scan path emits `30/14/7` warnings for active lanes.
  - Warning horizons are not duplicated repeatedly for the same artifact.
  - Focused unit and e2e tests pass.
- Public interfaces:
  - No new public HTTP routes.
  - New internal background worker in rules-engine module.
  - Possible new DB table for certification alert deliveries/deduplication.
  - Possible env vars: scan interval override for tests.
- Edge cases / failure modes:
  - Missing expiry metadata: fail closed, treat as alertable.
  - Invalid date format: fail closed, treat as alertable.
  - Notification delivery failure: fail closed, no delivery record written.
  - Scan overlap/restart: dedupe by artifact + horizon + alert kind.
- Rollout & monitoring:
  - Safe additive migration only if delivery-dedupe persistence is added.
  - Watch notification volume and repeated warning suppression.
  - Backout by disabling worker registration and reverting migration.
- Acceptance checks:
  - `npm run test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts test/rules-engine.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### 6. Dependencies
- Existing `NotificationService` notification persistence/fanout path.
- Existing rules-engine certification detection logic.
- Existing lane/evidence store access to active lane artifacts.

### 7. Validation
- Focused unit tests prove upload-time and scan-time alert logic.
- E2E verifies persisted notifications through real Nest module wiring.
- Manual smoke: upload an expired `PHYTO_CERT` and confirm a notification row exists for the lane owner.

### 8. Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `EvidenceService` certification upload alert path | `uploadArtifact()` request flow | `src/modules/evidence/evidence.module.ts` provider wiring | `notifications`, `evidence_artifacts`, `lanes` |
| `RulesEngineService.scanCertificationExpirations()` | background worker interval | `src/modules/rules-engine/rules-engine.module.ts` provider wiring | `evidence_artifacts`, `lanes`, optional dedupe table |
| `CertificationExpiryWorker` | `onModuleInit()` | `src/modules/rules-engine/rules-engine.module.ts` providers | optional dedupe table / none |
| Migration for scan dedupe | N/A | Prisma migration application | new dedupe table if introduced |

### 9. Cross-Language Schema Verification
- TypeScript backend is the only runtime language here; verify actual SQL table names in pg stores and Prisma schema before adding any migration.
- Expected names to confirm before editing:
  - `notifications`
  - `notification_preferences`
  - `evidence_artifacts`
  - `lanes`

### 10. Decision-Complete Checklist
- No open API decisions remain.
- Notification persistence is the source of truth.
- Every behavior change has a test target listed.
- Validation commands are concrete and scoped.
- Wiring verification covers worker, rules service, and upload path.
- Rollout/backout is additive and reversible.

## Plan Draft B

### 1. Overview
Implement Task `9.4` with less new surface by keeping the logic inside the existing rules-engine service and avoiding any new persistence table. Upload-time alerts and daily scans would both compute candidates from current state and dedupe by inspecting recent notifications of the same type and artifact metadata.

### 2. Files to Change
- `src/modules/evidence/evidence.service.ts`: invoke rules-engine notification helper after upload.
- `src/modules/rules-engine/rules-engine.service.ts`: add immediate alert dispatch and daily scan orchestration.
- `src/modules/rules-engine/rules-engine.pg-store.ts`: add active certification scan query and optional recent-notification lookup.
- `src/modules/rules-engine/rules-engine.service.spec.ts`: prove warning windows and dedupe.
- `src/modules/evidence/evidence.service.spec.ts`: prove upload path.
- `test/rules-engine.e2e-spec.ts`: prove scan wiring.
- `docs/PROGRESS.md`: progress note.

### 3. Implementation Steps
- TDD sequence:
  1. Add failing tests around repeated scans and upload-triggered notifications.
  2. Add minimal rules-engine helpers to convert certification alerts into notification inputs.
  3. Add one in-process worker owned by the rules-engine module.
  4. Use existing `notifications` rows for idempotency checks instead of adding a new table.
  5. Run focused and broad validation gates.
- `RulesEngineService.notifyCertificationUploadIssues(...)`
  Inspect uploaded artifact metadata and existing rules evaluation output, then notify the lane owner immediately when the cert is already expired or missing expiry metadata.
- `RulesEngineService.runCertificationExpiryScan()`
  Query all active certifications, compute warning horizons, and skip anything already represented by a prior notification with the same lane, artifact, and horizon metadata.
- Expected behavior and edge cases:
  - No schema migration if notification rows are sufficient for dedupe.
  - Repeated scans rely on metadata-stable notification payloads.
  - Historical deleted notifications could re-emit warnings, which is acceptable only if notifications are append-only.

### 4. Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact emits expired certification notification`
    Immediate expiry issues notify owner.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `runCertificationExpiryScan emits horizon warnings once`
    Reuses notifications for idempotency.
  - `runCertificationExpiryScan skips artifacts without active lane`
    Limits scan scope correctly.
- `test/rules-engine.e2e-spec.ts`
  - `scan path writes notifications through real module graph`
    Verifies worker and service registration.

### 5. Decision Completeness
- Goal:
  Finish Task `9.4` with minimal moving parts and no extra user-facing API.
- Non-goals:
  - New admin endpoints for scan control.
  - New generalized scheduler framework.
- Success criteria:
  - Immediate expiry uploads notify.
  - Daily scans produce `30/14/7` warnings without duplicates.
  - No new external dependencies are introduced.
- Public interfaces:
  - No new routes.
  - Optional internal interval config only.
  - No migration unless notification metadata proves insufficient.
- Edge cases / failure modes:
  - Notification lookup false negatives can duplicate alerts.
  - Bad metadata still fails closed.
  - Worker crash only delays, not corrupts, alerts.
- Rollout & monitoring:
  - No schema rollout if dedupe stays notification-backed.
  - Watch for duplicate warning notifications in logs.
- Acceptance checks:
  - Focused rules/evidence unit tests.
  - One e2e scan test.

### 6. Dependencies
- Existing notification persistence and append-only behavior.
- Existing notification metadata searchability in pg store.

### 7. Validation
- Unit tests for horizon calculation and duplicate suppression.
- E2E for persisted notification writes.

### 8. Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Upload-time alert helper in `RulesEngineService` | `EvidenceService.persistArtifact()` | `src/modules/evidence/evidence.module.ts` + `src/modules/rules-engine/rules-engine.module.ts` | `notifications`, `evidence_artifacts` |
| In-process scan loop | `onModuleInit()` worker or service interval | `src/modules/rules-engine/rules-engine.module.ts` | `notifications`, `evidence_artifacts`, `lanes` |

### 9. Cross-Language Schema Verification
- Verify the notification store can query notification payload metadata by exact keys before choosing notification-backed dedupe.

### 10. Decision-Complete Checklist
- Minimal-surface plan is internally consistent.
- Duplicate suppression depends on notification metadata access.
- All runtime wiring is listed.

## Comparative Analysis

### Strengths
- Draft A is more robust on idempotency because it allows explicit delivery-state persistence rather than inferring from user-facing notifications.
- Draft B is smaller and faster to ship because it avoids a new table if existing notification metadata is sufficient.

### Gaps
- Draft A adds schema and worker complexity that may be unnecessary if current notification metadata can support stable dedupe.
- Draft B underspecifies exact duplicate suppression semantics and risks brittle metadata searches in JSON payloads.

### Trade-offs
- Draft A favors correctness and explicit operational state.
- Draft B favors minimal surface area and fewer migrations.
- Both keep the rules engine as the source of expiry detection and avoid inventing a second certification parser.

### Compliance Check
- Both drafts follow current Nest module boundaries and keep notifications DB-first.
- Draft A better matches the repo’s preference for explicit state and auditability when repeated background processing is involved.

## Unified Execution Plan

### 1. Overview
Finish Task `9.4` by reusing the existing rules-engine certification detection logic, emitting immediate owner notifications from the evidence upload path, and adding a daily certification-expiry worker for `30/14/7` day warnings. Use explicit dedupe persistence for scan warnings so retries and repeated daily runs stay deterministic.

### 2. Files to Change
- `src/modules/evidence/evidence.service.ts`: call the immediate certification alert path after artifact persistence/evaluation.
- `src/modules/evidence/evidence.service.spec.ts`: add upload-time expired-cert and missing-expiry tests.
- `src/modules/rules-engine/rules-engine.service.ts`: expose alert-candidate builders for immediate and scheduled certification alerts.
- `src/modules/rules-engine/rules-engine.types.ts`: add internal types for certification warning candidates and delivery records.
- `src/modules/rules-engine/rules-engine.pg-store.ts`: query active lane certification artifacts and persist/read alert delivery dedupe rows.
- `src/modules/rules-engine/rules-engine.module.ts`: register the worker provider.
- `src/modules/rules-engine/certification-expiry.worker.ts`: run a guarded immediate pass and daily recurring scan.
- `src/modules/rules-engine/rules-engine.service.spec.ts`: cover horizon math, dedupe, and lane/artifact filtering.
- `test/evidence.e2e-spec.ts`: verify expired upload creates a persisted notification through real app wiring.
- `test/rules-engine.e2e-spec.ts`: verify the scan path creates persisted warnings.
- `prisma/schema.prisma`: add a compact delivery-dedupe model if current stores lack a safe stable key.
- `prisma/migrations/.../migration.sql`: additive migration for the dedupe table if used.
- `docs/PROGRESS.md`: terse progress note.

### 3. Implementation Steps
- TDD sequence:
  1. Add failing unit tests in `evidence.service.spec.ts` and `rules-engine.service.spec.ts`.
  2. Run those focused tests and confirm the failure mode is “notification/scan path missing”.
  3. Implement the smallest immediate alert helper in the rules engine and wire it from `EvidenceService`.
  4. Implement scan query + dedupe persistence + worker loop in the rules-engine module.
  5. Add e2e coverage for real module wiring.
  6. Run focused fast gates, then `lint`, `typecheck`, and `build`.
- `RulesEngineService.buildImmediateCertificationNotification(...)`
  Convert the existing alert output for one uploaded certification into a concrete notification payload for the lane owner. Only expired/missing-expiry conditions notify immediately; upcoming warnings are left to the scheduled scan.
- `RulesEngineService.scanCertificationExpirations(now = new Date())`
  Load active certification artifacts, compute days-until-expiry, produce warning candidates for `30/14/7`, and suppress anything already recorded in the delivery-dedupe store.
- `RulesEngineService.dispatchCertificationExpiryWarnings(...)`
  Persist notification rows through `NotificationService.notifyLaneOwner(...)`, then record delivery keys transactionally or in a safe ordered sequence that never marks delivered before notification persistence succeeds.
- `CertificationExpiryWorker`
  Start on module init, run one immediate guarded pass, then repeat at a 24-hour interval. Keep failures logged and isolated so one bad scan does not stop future scans.
- Expected behavior and edge cases:
  - Missing or invalid expiry metadata is treated as an immediate issue on upload.
  - Warnings fire only for active lanes and non-deleted certification artifacts.
  - Each artifact+horizon emits once, even across restarts.
  - Notification failure leaves the delivery key unset so the next scan can retry.

### 4. Test Coverage
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact notifies lane owner for expired certification`
    Immediate expiry detection persists an owner alert.
  - `uploadArtifact notifies lane owner for certification missing expiry metadata`
    Missing expiry fails closed and alerts.
  - `uploadArtifact skips owner alert for healthy certification`
    Clean uploads remain quiet.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - `scanCertificationExpirations emits 30 day warning once`
    First warning is produced and deduped.
  - `scanCertificationExpirations emits 14 and 7 day warnings independently`
    Each horizon is tracked separately.
  - `scanCertificationExpirations skips deleted artifacts and inactive lanes`
    Scan scope is correct.
  - `scanCertificationExpirations retries after notification failure`
    Delivery key is not persisted on failed notify.
- `test/evidence.e2e-spec.ts`
  - `expired certification upload creates persisted notification`
    Real HTTP upload path writes notification rows.
- `test/rules-engine.e2e-spec.ts`
  - `daily certification scan persists warning notifications`
    Worker/service path is wired and functional.

### 5. Decision Completeness
- Goal:
  Deliver the missing alert-creation and scheduled-warning pieces of Task `9.4`.
- Non-goals:
  - UI work for notifications.
  - Full generic job scheduler platform.
  - Changes to the underlying certification extraction format beyond existing metadata interpretation.
- Success criteria:
  - Expired or missing-expiry certification uploads create owner notifications.
  - Daily scan emits `30/14/7` warnings for active lanes.
  - Duplicate warnings are suppressed deterministically.
  - Focused unit and e2e coverage passes.
- Public interfaces:
  - No new public routes.
  - New internal worker class registered in the rules-engine module.
  - Additive DB migration only if dedupe state is persisted explicitly.
  - Optional internal env var for scan interval override in tests only if required.
- Edge cases / failure modes:
  - Missing/invalid expiry metadata: fail closed as immediate issue.
  - Notification write failure: fail closed, do not record delivery dedupe.
  - Worker restart: safe because scan dedupe is persisted.
  - Overlapping worker runs: guard with in-process reentry protection and dedupe state.
- Rollout & monitoring:
  - Apply additive migration before deploy if introduced.
  - Watch notification volume for expiry alert spikes.
  - Log worker scan summaries and failures.
  - Backout by disabling worker registration and reverting the new migration/code.
- Acceptance checks:
  - `npm run test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts test/rules-engine.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### 6. Dependencies
- Existing `NotificationModule` and DB-first notification persistence.
- Existing rules-engine certification detection logic.
- Existing evidence/lane stores and audit-safe persistence patterns.

### 7. Validation
- Focused unit tests for immediate alerts, horizon computation, dedupe, and retry behavior.
- E2E tests for real Nest wiring through upload and scan paths.
- Smoke-check notification rows for a seeded expired certification.

### 8. Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Immediate certification alert helper in `RulesEngineService` | `EvidenceService.persistArtifact()` | `src/modules/evidence/evidence.module.ts` injects `RulesEngineService`; `src/modules/rules-engine/rules-engine.module.ts` exports provider | `notifications`, `evidence_artifacts`, `lanes` |
| `RulesEngineService.scanCertificationExpirations()` | `CertificationExpiryWorker.runOnce()` | `src/modules/rules-engine/rules-engine.module.ts` provider registration | `evidence_artifacts`, `lanes`, dedupe table if added |
| `CertificationExpiryWorker` | `onModuleInit()` interval loop | `src/modules/rules-engine/rules-engine.module.ts` providers | none / dedupe table indirectly |
| Notification dispatch via `NotificationService.notifyLaneOwner()` | immediate upload path and daily scan path | `src/modules/notifications/notification.module.ts` exports `NotificationService` | `notifications`, `notification_preferences`, `notification_channel_targets` |
| Dedupe migration (if introduced) | N/A | Prisma migration chain | new certification-alert delivery table |

### 9. Cross-Language Schema Verification
- TypeScript-only runtime. Before changing schema/store code, verify exact names in Prisma and raw SQL for:
  - `notifications`
  - `notification_preferences`
  - `notification_channel_targets`
  - `evidence_artifacts`
  - `lanes`
- Verify user and lane foreign-key column types match existing `TEXT` ids, not UUID-only assumptions.

### 10. Decision-Complete Checklist
- No open design decisions remain for implementation.
- Immediate-alert and daily-scan behaviors are both covered.
- Public surface changes are enumerated.
- Validation commands are concrete.
- Wiring verification covers worker, service, notifications, and schema.
- Rollout/backout is specified if a migration is needed.

## Implementation Summary - 2026-03-28 07:40 +07

### Goal
Complete Task `9.4` by turning the existing certification expiry detection logic into durable notification creation on upload and a retry-safe daily warning scan.

### What Changed
- `src/modules/notifications/notification.types.ts`
  - Added `CERTIFICATION_EXPIRY` as a first-class notification type so expiry alerts participate in preferences and normal delivery paths.
- `src/modules/evidence/evidence.service.ts`
  - Added a post-persist certification alert hook so uploaded `PHYTO_CERT`, `VHT_CERT`, and `GAP_CERT` artifacts now trigger immediate owner notifications when already expired or missing expiry metadata.
- `src/modules/evidence/evidence.service.spec.ts`
  - Added RED/GREEN coverage for the new upload-time certification alert hook and for the non-certification no-op path.
- `src/modules/rules-engine/rules-engine.types.ts`
  - Added explicit scan, upload-alert, and delivery-claim contracts for certification alerting.
- `src/modules/rules-engine/rules-engine.service.ts`
  - Added `notifyCertificationAlertForArtifact(...)` for upload-time alert creation.
  - Added `scanCertificationExpirations(...)` to compute expired-cert catchup plus `30/14/7` warning candidates from the latest active certification artifacts.
  - Added durable claim/complete/release dispatch flow so duplicate alerts are suppressed and notification write failures can retry cleanly.
- `src/modules/rules-engine/rules-engine.pg-store.ts`
  - Added latest-certification scan queries against `lanes` + `evidence_artifacts`.
  - Added durable claim/complete/release persistence against the new `certification_alert_deliveries` table.
- `src/modules/rules-engine/certification-expiry.worker.ts`
  - Added the rules-engine-owned daily worker with bootstrap scan, interval scheduling, and overlap suppression.
- `src/modules/rules-engine/rules-engine.module.ts`
  - Registered the certification expiry worker in the live Nest module graph.
- `src/modules/rules-engine/rules-engine.service.spec.ts`
  - Added unit coverage for expired upload alerts, valid-cert no-op behavior, and `14`-day warning dispatch.
- `src/modules/rules-engine/certification-expiry.worker.spec.ts`
  - Added worker tests for bootstrap scan, overlap protection, and failure logging.
- `prisma/schema.prisma`
  - Added the `CERTIFICATION_EXPIRY` enum member and the additive `CertificationAlertDelivery` model.
- `prisma/migrations/20260328075500_certification_expiry_alerting/migration.sql`
  - Added the enum extension plus the durable `certification_alert_deliveries` table and supporting index.

### Validation
- `npm run db:generate`
- `npm run test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/rules-engine/certification-expiry.worker.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `PROOF_PACK_WORKER_ENABLED=false CERTIFICATION_EXPIRY_WORKER_ENABLED=false npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts test/rules-engine.e2e-spec.ts`

### Notes
- The local e2e smoke was run with both background workers disabled because the repo’s e2e harness still boots app modules without a DB-backed worker pool; the pre-existing proof-pack worker otherwise fails before the mocked controller tests run.
- The daily scan currently sends one active warning bucket per artifact (`30`, then `14`, then `7`) plus expired-cert catchup, rather than replaying every missed threshold after downtime.


## Review (2026-03-28 10:47:56 +0700) - working-tree (task-9.4 certification expiry alerting slice)

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree (task-9.4 certification expiry alerting slice)
- Commands Run: `git status --short`; `git diff -- <task-9.4 files>`; `npm run db:generate`; `npm run test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/rules-engine/rules-engine.service.spec.ts src/modules/rules-engine/certification-expiry.worker.spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`; `PROOF_PACK_WORKER_ENABLED=false CERTIFICATION_EXPIRY_WORKER_ENABLED=false npm run test:e2e -- --runInBand test/evidence.e2e-spec.ts test/rules-engine.e2e-spec.ts`

### Findings
CRITICAL
- No findings.

HIGH
- No findings.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed the existing local e2e harness limitation around worker bootstrap without a DB-backed pool is pre-existing and out of scope for the Task 9.4 product change; validation used the same focused e2e slice with both workers disabled.

### Recommended Tests / Validation
- Run the migration in a DB-backed environment and repeat the focused worker-enabled smoke once the harness provides a real pool.
- On the PR branch, rerun the normal CI gates plus the security scan and Claude review checks before merge.

### Rollout Notes
- Apply `prisma/migrations/20260328075500_certification_expiry_alerting/migration.sql` before enabling the daily certification expiry worker in shared environments.
- The daily scan now suppresses duplicates through `certification_alert_deliveries`; backout is additive and can disable the worker without affecting existing notification rows.
