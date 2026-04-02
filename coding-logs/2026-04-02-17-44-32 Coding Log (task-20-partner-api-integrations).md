# Task 20 Partner API Integrations

## 2026-04-02 17:44 ICT

### Plan Draft A

#### Overview

Implement a new backend integration module that fetches partner data from configured vendor APIs, normalizes it into ZRL-native lab/temperature/certification payloads, and hands it off to the existing evidence and cold-chain services. Finish the user-facing ACFS path by wiring the existing GAP certificate field in the lane creation wizard into authenticated ACFS lookup/import calls.

#### Files to Change

- `src/integrations/integrations.module.ts`: register controller and service.
- `src/integrations/integrations.controller.ts`: lane-scoped import routes and ACFS lookup route.
- `src/integrations/integrations.service.ts`: provider fetch/retry/rate-limit/cache orchestration.
- `src/integrations/integrations.types.ts`: provider enums, DTO shapes, normalized records.
- `src/integrations/integrations.service.spec.ts`: provider normalization/retry/cache tests.
- `test/integrations.e2e-spec.ts`: endpoint wiring and auth/ownership checks.
- `src/app.module.ts`: wire the new module.
- `src/modules/evidence/evidence.service.ts`: add generic certification import path and feed temperature imports into cold-chain.
- `src/modules/evidence/evidence.service.spec.ts`: evidence-side partner temperature/certification tests.
- `src/modules/evidence/evidence.module.ts`: inject cold-chain into evidence service.
- `frontend/src/app/(app)/lanes/new/page.tsx`: use existing GAP field during submit.
- `frontend/src/app/(app)/lanes/new/page.test.tsx`: verify lookup/import requests in create flow.

#### Implementation Steps

TDD sequence:

1. Add backend integration service/controller specs for one provider path and ACFS lookup/import.
2. Run failing backend tests and confirm missing module/service behavior.
3. Implement the smallest integration module + service + controller path to pass.
4. Add evidence service tests for temperature import feeding cold-chain and GAP artifact creation.
5. Run failing evidence tests and implement the smallest service changes to pass.
6. Add frontend lane-create test for GAP lookup/import flow.
7. Run failing frontend test, implement submit flow, then refactor minimally.
8. Run focused fast gates, then broader lint/typecheck/test coverage for touched areas.

Functions:

- `PartnerIntegrationsService.importLabResults(provider, laneId, reference, actor)`: fetch provider payload, normalize it, and create an `MRL_TEST` artifact.
- `PartnerIntegrationsService.importTemperatureData(provider, laneId, reference, actor)`: fetch provider telemetry, normalize it, create `TEMP_DATA`, and feed M3 ingestion.
- `PartnerIntegrationsService.lookupAcfsCertificate(certificateNumber)`: fetch and cache ACFS lookup results for one hour.
- `PartnerIntegrationsService.importAcfsCertificate(laneId, certificateNumber, actor)`: lookup ACFS, fail closed on invalid cert, and create a `GAP_CERT` artifact.
- `EvidenceService.createPartnerCertificationArtifact(...)`: persist `GAP_CERT` imports through the same audit/object-store path as other artifacts.
- `EvidenceService.createPartnerTemperatureArtifact(...)`: additionally push normalized readings into `ColdChainService.ingestLaneReadings`.

#### Test Coverage

- `src/integrations/integrations.service.spec.ts`
  - `imports Central Lab payload into normalized MRL results`
  - `imports SGS multi-residue payload into normalized MRL results`
  - `imports Thai Airways telemetry into normalized readings`
  - `imports Kerry telemetry into normalized readings`
  - `caches ACFS lookup results for one hour`
  - `retries transient provider failures with exponential backoff`
  - `fails closed on invalid ACFS certification`
- `test/integrations.e2e-spec.ts`
  - `POST /lanes/:id/integrations/lab-results/:provider/import enforces lane ownership`
  - `POST /lanes/:id/integrations/temperature/:provider/import enforces lane ownership`
  - `GET /integrations/certifications/acfs/:certificateNumber returns lookup payload`
  - `POST /lanes/:id/integrations/certifications/acfs/import imports GAP certification`
- `src/modules/evidence/evidence.service.spec.ts`
  - `partner temperature import persists artifact and ingests readings`
  - `partner certification import persists GAP artifact metadata`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`
  - `creates lane then imports GAP certificate when provided`
  - `blocks create on invalid GAP lookup response`

#### Decision Completeness

- Goal: complete Task 20 with real runtime adapters, not placeholder directories.
- Non-goals: vendor-specific webhooks, SFTP daemons, persistent sync-job history, background schedulers.
- Success criteria:
  - Task 20 endpoints exist and are wired into `AppModule`.
  - Lab/logistics imports create artifacts through existing evidence flow.
  - Temperature imports also create M3 readings/excursions/SLA updates.
  - ACFS lookups return normalized validity data and can create `GAP_CERT`.
  - Lane wizard uses the existing GAP field during submit.
- Public interfaces:
  - `POST /lanes/:id/integrations/lab-results/:provider/import`
  - `POST /lanes/:id/integrations/temperature/:provider/import`
  - `GET /integrations/certifications/acfs/:certificateNumber`
  - `POST /lanes/:id/integrations/certifications/acfs/import`
  - New env vars for partner base URLs, API keys, timeout, and rate limit.
- Edge cases / failure modes:
  - Unknown provider: fail closed with `400`.
  - Provider 4xx invalid reference: fail closed with `422`.
  - Provider 5xx/network error: retry 3 times, then `502`.
  - ACFS invalid certificate: fail closed, do not create artifact.
  - Temperature payload without normalized readings: fail closed.
  - Lane wizard with GAP certificate but failed lookup: stop before lane creation.
- Rollout & monitoring:
  - No migration required.
  - Feature is env-driven; missing base URL disables provider usage through failing requests.
  - Log provider failures and watch import error rate.
- Acceptance checks:
  - `npm test -- --runInBand src/integrations/integrations.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/integrations.e2e-spec.ts`
  - `cd frontend && npm test -- --runInBand src/app/'(app)'/lanes/new/page.test.tsx`
  - `npm run lint && npm run typecheck && npm run build`

#### Dependencies

- Existing `EvidenceService`, `ColdChainService`, `Auth` guards, and frontend `requestAppJson`.
- Direct `process.env` reads; no new config subsystem.

#### Validation

- Verify import routes return artifacts and ingestion summaries.
- Verify ACFS lookup caches repeated lookups.
- Verify lane wizard performs lookup before create and import after create.

#### Wiring Verification

| Component                          | Entry Point                                                        | Registration Location                                          | Schema/Table                                                           |
| ---------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PartnerIntegrationsController`    | HTTP import and lookup routes                                      | `src/integrations/integrations.module.ts`, `src/app.module.ts` | none                                                                   |
| `PartnerIntegrationsService`       | controller methods                                                 | injected in `src/integrations/integrations.module.ts`          | none                                                                   |
| evidence temperature import update | `POST /partner/logistics/temperature` and integration import route | `src/modules/evidence/evidence.module.ts`                      | `temperature_readings`, `temperature_excursions`, `evidence_artifacts` |
| evidence GAP import                | ACFS import route                                                  | `src/modules/evidence/evidence.module.ts`                      | `evidence_artifacts`, `artifact_links`, `audit_entries`                |
| lane wizard GAP flow               | `handleCreateLane()`                                               | `frontend/src/app/(app)/lanes/new/page.tsx`                    | none                                                                   |

### Plan Draft B

#### Overview

Implement only a normalization/orchestration layer and reuse the existing partner ingestion endpoints as the sole runtime API. The lane wizard would call ACFS lookup first, then create the lane, then call the existing partner artifact endpoint for `GAP_CERT` if verification succeeds.

#### Files to Change

- `src/integrations/integrations.service.ts`
- `src/integrations/integrations.service.spec.ts`
- `src/app.module.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/evidence/evidence.controller.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `frontend/src/app/(app)/lanes/new/page.tsx`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`

#### Implementation Steps

TDD sequence:

1. Add service specs for provider normalization and ACFS lookup.
2. Add evidence controller/service specs for new generic partner certification endpoint.
3. Implement service logic and reuse existing partner routes where possible.
4. Add frontend tests and wire submit flow.
5. Run focused gates and broader verification.

Functions:

- `PartnerIntegrationsService.fetchAndNormalize*` methods.
- `EvidenceService.createPartnerCertificationArtifact`.
- `EvidenceController.createPartnerCertificationArtifact`.

#### Test Coverage

- Provider normalization/retry/cache unit tests.
- Evidence controller/service tests for certification artifact import.
- Frontend lane-create flow test.

#### Decision Completeness

- Goal: complete the adapter logic with minimal new API surface.
- Non-goals: dedicated lane-scoped import endpoints or provider-specific controllers.
- Success criteria:
  - provider payloads normalize correctly,
  - ACFS lookup works with caching,
  - evidence/cold-chain import paths accept normalized partner payloads,
  - lane wizard uses the GAP field.
- Public interfaces:
  - possibly one generic certification import endpoint added to evidence controller,
  - ACFS lookup route,
  - env vars for partner URLs/keys/timeouts.
- Edge cases:
  - same as Draft A, but generic partner endpoints carry more provider-shape branching.
- Rollout & monitoring:
  - smaller route surface, but more provider-specific conditionals inside evidence.

#### Dependencies

- Existing evidence controller path is reused heavily.

#### Validation

- Same focused backend/frontend gates as Draft A.

#### Wiring Verification

| Component                     | Entry Point                                           | Registration Location                     | Schema/Table                          |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| integration service           | evidence controller and lane wizard support endpoints | `src/app.module.ts`                       | none                                  |
| evidence certification import | evidence controller route                             | `src/modules/evidence/evidence.module.ts` | `evidence_artifacts`, `audit_entries` |

### Comparative Analysis

- Draft A strengths:
  - keeps vendor-specific import logic out of the evidence controller,
  - creates explicit runtime entry points for the remaining Task 20 surface,
  - maps cleanly to lane ownership guards and Task 20 subtasks.
- Draft A gaps:
  - adds more files and endpoints.
- Draft B strengths:
  - fewer routes and less module wiring.
- Draft B gaps:
  - pushes provider-specific branching into the evidence module,
  - blurs the distinction between normalized partner ingestion and external adapter orchestration,
  - makes future provider expansion harder.
- Choice:
  - prefer Draft A. It is more explicit, keeps responsibilities separated, and better matches the repo’s module boundaries.

### Unified Execution Plan

#### Overview

Add a dedicated `src/integrations/` runtime module that owns provider fetch/normalize/retry/rate-limit/cache behavior and exposes lane-scoped import routes plus an authenticated ACFS lookup route. Reuse the existing evidence pipeline for artifact persistence, extend partner temperature imports to feed M3, and wire the existing GAP certificate field in the lane wizard into the new ACFS flow.

#### Files to Change

- `src/integrations/integrations.module.ts`
- `src/integrations/integrations.controller.ts`
- `src/integrations/integrations.service.ts`
- `src/integrations/integrations.types.ts`
- `src/integrations/integrations.service.spec.ts`
- `test/integrations.e2e-spec.ts`
- `src/app.module.ts`
- `src/modules/evidence/evidence.module.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `frontend/src/app/(app)/lanes/new/page.tsx`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`

#### Implementation Steps

TDD sequence:

1. Add `src/integrations/integrations.service.spec.ts` covering Central Lab, SGS, Thai Airways, Kerry, ACFS cache, retry, and failure handling.
2. Run the spec and confirm failure because the module/service does not exist.
3. Add `test/integrations.e2e-spec.ts` for lookup/import route wiring and auth.
4. Implement `integrations.types.ts`, `integrations.service.ts`, `integrations.controller.ts`, `integrations.module.ts`, and wire `src/app.module.ts`.
5. Add evidence service tests for temperature-to-cold-chain ingestion and GAP artifact import.
6. Implement evidence service/module changes with the smallest API expansion (`createPartnerCertificationArtifact` and temperature ingestion hook).
7. Add/update frontend lane-create tests for pre-create ACFS lookup and post-create GAP import.
8. Implement the lane wizard submit flow using the existing `gapCertificate` field.
9. Run focused gates, then lint/typecheck/build, then skeptical review.

Functions:

- `PartnerIntegrationsService.importLabResults`
- `PartnerIntegrationsService.importTemperatureData`
- `PartnerIntegrationsService.lookupAcfsCertificate`
- `PartnerIntegrationsService.importAcfsCertificate`
- `EvidenceService.createPartnerCertificationArtifact`
- `EvidenceService.createPartnerTemperatureArtifact`
- `LaneCreationWizard.handleCreateLane`

Expected behavior and edge cases:

- Central Lab and SGS normalize into one canonical `results` array with numeric values and trace metadata.
- Thai Airways and Kerry normalize into one canonical `readings` array with ISO timestamps, `temperatureC`, and `deviceId`.
- ACFS lookup caches success and invalid responses for one hour to avoid repeated partner calls.
- Integration routes retry transient network/provider errors with exponential backoff and return `502` after exhaustion.
- Unknown provider or malformed provider payload fails closed with `400`/`422`.
- GAP validation occurs before lane creation in the wizard; failed validation blocks create. Successful validation triggers a post-create GAP artifact import.

#### Test Coverage

- `src/integrations/integrations.service.spec.ts`
  - `importLabResults central lab normalizes and persists results`
  - `importLabResults sgs normalizes multi residue results`
  - `importTemperatureData thai airways normalizes readings`
  - `importTemperatureData kerry normalizes readings`
  - `lookupAcfsCertificate caches repeated lookups`
  - `provider fetch retries transient failures`
  - `importAcfsCertificate rejects invalid certificates`
- `test/integrations.e2e-spec.ts`
  - `GET /integrations/certifications/acfs/:certificateNumber requires auth`
  - `POST /lanes/:id/integrations/... uses lane ownership guard`
  - `ACFS import route returns GAP artifact payload`
- `src/modules/evidence/evidence.service.spec.ts`
  - `createPartnerTemperatureArtifact ingests cold chain readings`
  - `createPartnerCertificationArtifact stores GAP metadata`
- `frontend/src/app/(app)/lanes/new/page.test.tsx`
  - `submit validates GAP certificate before creating lane`
  - `submit imports GAP certificate after lane creation`

#### Decision Completeness

- Goal: ship the entire remaining Task 20 scope with real runtime wiring.
- Non-goals: background polling schedulers, SFTP workers, persistent sync job tables, vendor webhooks.
- Success criteria:
  - Task 20 routes, service, and frontend hookup are on disk and wired.
  - Each provider has normalization tests.
  - Temperature imports update both evidence and cold-chain state.
  - ACFS lookup is cached for one hour and lane creation uses the existing GAP field.
- Public interfaces:
  - `GET /integrations/certifications/acfs/:certificateNumber`
  - `POST /lanes/:id/integrations/lab-results/:provider/import`
  - `POST /lanes/:id/integrations/temperature/:provider/import`
  - `POST /lanes/:id/integrations/certifications/acfs/import`
  - env vars:
    - `CENTRAL_LAB_API_BASE_URL`
    - `CENTRAL_LAB_API_KEY`
    - `SGS_API_BASE_URL`
    - `SGS_API_KEY`
    - `THAI_AIRWAYS_API_BASE_URL`
    - `THAI_AIRWAYS_API_KEY`
    - `KERRY_API_BASE_URL`
    - `KERRY_API_KEY`
    - `ACFS_API_BASE_URL`
    - `INTEGRATION_HTTP_TIMEOUT_MS`
    - `INTEGRATION_RATE_LIMIT_PER_MINUTE`
- Edge cases / failure modes:
  - fail closed for invalid or malformed provider payloads,
  - fail closed for invalid GAP certificates,
  - fail closed after retry exhaustion,
  - do not create cold-chain readings when no normalized readings were produced,
  - do not create GAP artifacts on ACFS lookup failures.
- Rollout & monitoring:
  - no migration/backfill required,
  - provider routes are inactive unless env vars are configured,
  - log provider name + failure class, watch repeated `502`s and invalid payload errors.
- Acceptance checks:
  - `npm test -- --runInBand src/integrations/integrations.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/integrations.e2e-spec.ts`
  - `cd frontend && npm test -- --runInBand "src/app/(app)/lanes/new/page.test.tsx"`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

#### Dependencies

- Existing auth, evidence, cold-chain, and frontend request helpers.
- Direct `process.env` configuration, global `fetch`, and no new database schema.

#### Validation

- Verify lookup/import responses manually through focused e2e tests.
- Verify repeated ACFS lookups reuse the cache in unit tests.
- Verify post-import evidence artifact metadata and cold-chain ingestion counts.

#### Wiring Verification

| Component                                                             | Entry Point                                                     | Registration Location                                                   | Schema/Table                                                           |
| --------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `PartnerIntegrationsModule`                                           | Nest runtime bootstrap                                          | `src/app.module.ts` imports module                                      | none                                                                   |
| `PartnerIntegrationsController`                                       | HTTP routes under `/integrations` and `/lanes/:id/integrations` | `src/integrations/integrations.module.ts` controllers                   | none                                                                   |
| `PartnerIntegrationsService`                                          | controller calls                                                | `src/integrations/integrations.module.ts` providers                     | none                                                                   |
| `EvidenceService.createPartnerCertificationArtifact`                  | ACFS import route                                               | `src/modules/evidence/evidence.module.ts` provider factory              | `evidence_artifacts`, `artifact_links`, `audit_entries`                |
| `EvidenceService.createPartnerTemperatureArtifact` cold-chain handoff | partner/integration temperature import route                    | `src/modules/evidence/evidence.module.ts` with `ColdChainModule` import | `temperature_readings`, `temperature_excursions`, `evidence_artifacts` |
| lane wizard GAP submit flow                                           | `handleCreateLane()`                                            | `frontend/src/app/(app)/lanes/new/page.tsx`                             | none                                                                   |

## 2026-04-02 17:57 ICT

- Goal: implement the remaining Task 20 partner adapter/runtime wiring and close the last top-level task on the board.
- What changed:
  - `src/integrations/integrations.types.ts`, `src/integrations/integrations.service.ts`, `src/integrations/integrations.controller.ts`, `src/integrations/integrations.module.ts`
    - Added the new partner integration module with provider-specific lab/logistics import methods, ACFS lookup/import, retry/backoff, in-memory rate limiting, and ACFS lookup caching.
  - `src/app.module.ts`
    - Registered `PartnerIntegrationsModule` so the new routes are live at runtime.
  - `src/modules/evidence/evidence.service.ts`, `src/modules/evidence/evidence.module.ts`
    - Added `createPartnerCertificationArtifact`, extended partner metadata handling for `GAP_CERT`, and made partner temperature imports feed `ColdChainService.ingestLaneReadings` when normalized readings are present.
  - `test/integrations.e2e-spec.ts`, `src/integrations/integrations.service.spec.ts`, `src/modules/evidence/evidence.service.spec.ts`
    - Added focused backend tests for provider normalization, retry behavior, ACFS caching/validation, route wiring, and evidence-to-cold-chain handoff.
  - `frontend/src/app/(app)/lanes/new/page.tsx`, `frontend/src/app/(app)/lanes/new/page.test.tsx`
    - Wired the existing GAP certificate field into pre-create ACFS lookup and post-create GAP artifact import, including the duplicate-lane prevention path when the post-create import fails.
- TDD evidence:
  - RED: `npm test -- --runInBand src/integrations/integrations.service.spec.ts test/integrations.e2e-spec.ts`
    - Failed because `./integrations.service` did not exist.
  - GREEN: `npm test -- --runInBand src/integrations/integrations.service.spec.ts`
    - Passed after adding the integration service/module.
  - RED: `npm run test:e2e -- --runInBand test/integrations.e2e-spec.ts`
    - Failed because the existing proof-pack/certification background workers booted in a no-DB harness.
  - GREEN: `npm run test:e2e -- --runInBand test/integrations.e2e-spec.ts`
    - Passed after disabling those workers in the focused e2e harness.
  - RED: `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
    - Failed because temperature imports did not call cold-chain and `createPartnerCertificationArtifact` did not exist.
  - GREEN: `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
    - Passed after adding the evidence helper and M3 handoff.
  - RED: `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
    - Failed because the lane wizard ignored `gapCertificate` and posted straight to `/api/zrl/lanes`.
  - GREEN: `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
    - Passed after ACFS lookup/import wiring landed.
- Tests run and results:
  - `npm test -- --runInBand src/integrations/integrations.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
    - Passed.
  - `npm run test:e2e -- --runInBand test/integrations.e2e-spec.ts`
    - Passed.
  - `cd frontend && npm test -- --runInBand --runTestsByPath 'src/app/(app)/lanes/new/page.test.tsx'`
    - Passed.
  - `npm run lint`
    - Passed.
  - `npm run typecheck`
    - Passed.
  - `npm run build`
    - Passed.
  - `cd frontend && npm run lint`
    - Passed.
  - `cd frontend && npm run typecheck`
    - Passed.
  - `cd frontend && npm run build`
    - Passed.
- Wiring verification evidence:
  - `src/app.module.ts` now imports `PartnerIntegrationsModule`, which makes the new controller reachable in the Nest app.
  - `src/integrations/integrations.module.ts` registers `PartnerIntegrationsController` and `PartnerIntegrationsService`.
  - `src/integrations/integrations.controller.ts` exposes:
    - `GET /integrations/certifications/acfs/:certificateNumber`
    - `POST /lanes/:id/integrations/lab-results/:provider/import`
    - `POST /lanes/:id/integrations/temperature/:provider/import`
    - `POST /lanes/:id/integrations/certifications/acfs/import`
  - `src/modules/evidence/evidence.module.ts` now imports `ColdChainModule` and passes `ColdChainService` into `EvidenceService`, which is the runtime handoff for imported telemetry.
  - `frontend/src/app/(app)/lanes/new/page.tsx` now calls the ACFS lookup endpoint before lane creation and the ACFS import endpoint after lane creation when a GAP certificate number is present.
- Behavior changes and risk notes:
  - ACFS lookups fail closed before lane creation when the certificate is invalid.
  - Post-create GAP import is now best-effort in the wizard: if lane creation succeeds but the import fails, the user is redirected to the created lane to avoid duplicate lane creation on retry.
  - Provider payload normalization is assumption-based around env-configured JSON REST endpoints; real vendor contract drift will surface as `400`/`502` failures rather than silent bad imports.
- Follow-ups / known gaps:
  - Top-level Task Master is now complete, but some older subtask records outside Task 20 still remain stale and could be reconciled separately if you want the subtask percentage to also read 100%.

## Review (2026-04-02 17:57 ICT) - working-tree

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status --short`, `git diff --stat`, `git diff -- src/app.module.ts src/integrations/integrations.controller.ts src/integrations/integrations.module.ts src/integrations/integrations.service.ts src/integrations/integrations.types.ts src/modules/evidence/evidence.module.ts src/modules/evidence/evidence.service.ts frontend/src/app/'(app)'/lanes/new/page.tsx`, focused test/lint/typecheck/build commands listed above

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

- The external partner adapters assume env-configured JSON REST surfaces with the normalized fields exercised in the new tests.
- ACFS lookup caching is process-local, which matches the repo’s current single-process pattern but is not cross-instance shared.

### Recommended Tests / Validation

- Re-run the focused Task 20 suites against any real vendor sandbox payloads once credentials/specs exist.
- Smoke the new integration routes against a booted backend with real env vars before production use.

### Rollout Notes

- No migration is required.
- New behavior is effectively gated by provider env vars; unconfigured providers fail fast instead of silently no-oping.

## Review (2026-04-02 18:08 +07) - working-tree

### Reviewed

- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status -sb`, `git diff --name-only`, `git diff --check`, `git diff --stat`, `git diff -- src/app.module.ts src/modules/evidence/evidence.module.ts src/modules/evidence/evidence.service.ts src/modules/evidence/evidence.service.spec.ts test/integrations.e2e-spec.ts frontend/src/app/'(app)'/lanes/new/page.tsx frontend/src/app/'(app)'/lanes/new/page.test.tsx docs/PROGRESS.md`, `git diff -- frontend/AGENTS.md prisma/AGENTS.md src/AGENTS.md test/AGENTS.md`, `nl -ba src/integrations/integrations.types.ts`, `nl -ba src/integrations/integrations.service.ts`, `nl -ba src/integrations/integrations.controller.ts`, `nl -ba src/integrations/integrations.module.ts`, `nl -ba src/integrations/integrations.service.spec.ts`, `nl -ba test/integrations.e2e-spec.ts`, `gt ls`, `gt status`, `gh auth status`

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

- The `AGENTS.md` edits are repo-managed state refreshes and are acceptable to land with the Task 20 batch.
- The current Graphite CLI is an older build, so submit/merge commands need its supported flag set rather than the newer examples in the skill docs.

### Recommended Tests / Validation

- Local focused backend/frontend tests and repo lint/typecheck/build already passed for this batch.
- After PR creation, monitor GitHub checks before merging to `main`.

### Rollout Notes

- No code findings remain from the review pass.
- The unrelated untracked `Task Note` file should stay out of the PR.
