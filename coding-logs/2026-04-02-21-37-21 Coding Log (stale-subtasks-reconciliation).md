## Plan Draft A

### Overview

Close the five codebase-backed gaps behind the stale Task Master subtasks by extending the existing lane, evidence, dispute, and MRV-lite modules rather than introducing parallel systems. The implementation will add automatic post-pack transitions, make the dispute defense pack actually satisfy the module contract, and persist MRV emission factors plus richer waste metrics in the database.

### Files to Change

- `prisma/schema.prisma`
  - Add persistent MRV emission-factor and ESG metric storage.
- `prisma/seed.ts`
  - Seed emission-factor rows and baseline ESG fixture data.
- `src/modules/mrv-lite/mrv-lite.types.ts`
  - Extend MRV store/report types for persistent factors and waste metrics.
- `src/modules/mrv-lite/mrv-lite.constants.ts`
  - Keep only defaults/helpers that still belong in code after persistence.
- `src/modules/mrv-lite/mrv-lite.pg-store.ts`
  - Load emission factors and richer ESG aggregates from Postgres.
- `src/modules/mrv-lite/mrv-lite.service.ts`
  - Use stored factors and compute richer waste reporting outputs.
- `src/modules/mrv-lite/mrv-lite.service.spec.ts`
  - Cover persistent-factor lookup and richer waste/report behavior.
- `src/modules/mrv-lite/mrv-lite.controller.ts`
  - Keep API surface stable while returning richer ESG data.
- `test/mrv-lite.e2e-spec.ts`
  - Prove public ESG endpoints still work with richer payloads.
- `src/modules/evidence/proof-pack.service.ts`
  - Trigger automatic lane reconciliation after pack generation.
- `src/modules/evidence/proof-pack.service.spec.ts`
  - Cover post-pack auto-transition handoff.
- `src/modules/dispute/dispute.types.ts`
  - Add explicit dispute timeline/forensics/view-model shapes if needed.
- `src/modules/dispute/dispute.service.ts`
  - Add canonical timeline reconstruction and richer defense-pack assembly.
- `src/modules/dispute/dispute.service.spec.ts`
  - Prove reconstructed timeline ordering and six-section assembly inputs.
- `templates/defense.hbs`
  - Render temperature forensics and visual evidence sections fully.
- `test/dispute.e2e-spec.ts`
  - Keep defense-pack route behavior proven end-to-end.
- `docs/PROGRESS.md`
  - Record the reconciliation/implementation pass.

### Implementation Steps

#### TDD sequence
1. Add/stub failing MRV-lite tests for persistent emission factors and richer waste metrics.
2. Run focused MRV tests and confirm failure for missing schema/store behavior.
3. Implement schema/store/service changes to make MRV tests pass.
4. Add/stub failing proof-pack/dispute tests for post-pack auto-transition and richer defense-pack assembly.
5. Run focused evidence/dispute tests and confirm failure for missing handoff/forensics behavior.
6. Implement the smallest backend/template changes to pass.
7. Run focused e2e coverage for dispute and MRV endpoints.
8. Run lint/typecheck/build plus focused test suites.

#### Function / symbol work

- `ProofPackService.completeLeasedJob()`
  - After a pack reaches `READY`, trigger lane reconciliation so validated lanes can auto-move to `PACKED` when proof-pack count guards are satisfied.
  - Fail closed on reconciliation errors by logging without rolling back an already-generated pack.

- `DisputeService.reconstructDefenseTimeline()` (new)
  - Build one canonical chronological feed from audit entries, checkpoints, evidence artifacts, and cold-chain excursion/reading summaries.
  - This becomes the single source for defense-pack timeline rendering.

- `DisputeService.buildDefensePackTemplateData()` (new/refactor)
  - Assemble all six required sections explicitly: executive summary, timeline, compliance, temperature forensics, visual evidence, audit trail.
  - Ensure missing optional evidence degrades gracefully while mandatory section containers still render.

- `PrismaMrvLiteStore.listEmissionFactors()/getEmissionFactor()`
  - Read route/product/mode factors from a real table instead of hardcoded constants.

- `PrismaMrvLiteStore.getLaneEsgData()/getExporterLaneCarbonRows()/getPlatformLaneCarbonRows()`
  - Return richer waste metrics such as rejection, downgrade, and damage-oriented proxies grounded in lane/dispute data now on disk.

- `MrvLiteService`
  - Compute carbon from persisted factors and expose richer environmental/waste sections without changing endpoint URLs.

### Test Coverage

- `src/modules/mrv-lite/mrv-lite.service.spec.ts`
  - `getLaneEsgCard uses persisted emission factors`
  - `getLaneEsgCard reports richer waste metrics`
  - `getExporterReport aggregates waste and governance totals`
  - `getEmissionFactors returns database-backed factors`

- `src/modules/evidence/proof-pack.service.spec.ts`
  - `completeLeasedJob reconciles lane transitions after pack readiness`
  - `completeLeasedJob logs reconciliation failures without losing pack`

- `src/modules/dispute/dispute.service.spec.ts`
  - `generateDefensePack assembles canonical mixed-source timeline`
  - `generateDefensePack includes temperature forensics and visual evidence`
  - `generateDefensePack tolerates missing optional evidence sections`

- `test/dispute.e2e-spec.ts`
  - `POST /disputes/:id/defense-pack returns updated defense submission`

- `test/mrv-lite.e2e-spec.ts`
  - `GET /lanes/:id/esg exposes richer waste metrics`
  - `GET /esg/carbon/factors returns seeded persistent factors`

### Decision Completeness

- Goal
  - Implement the five codebase-backed gaps so the remaining partial subtasks can be marked done honestly.
- Non-goals
  - No new frontend screens, no broad redesign of dispute UX, no new public endpoint families.
- Success criteria
  - Validated lanes auto-pack after proof-pack generation.
  - Defense packs include explicit timeline, temperature-forensics, and visual-evidence sections backed by data.
  - Emission factors are stored in Postgres and seeded.
  - ESG payloads expose richer waste metrics than the current boolean placeholder.
- Public interfaces
  - Additive Prisma models/columns only.
  - Existing MRV and dispute/proof-pack endpoints remain stable.
- Edge cases / failure modes
  - Pack generation succeeds but reconciliation fails: fail closed for transition, keep pack ready, log error.
  - Missing photo/EXIF data in defense packs: render “no evidence available” section rather than crashing.
  - No emission factor row found: fall back to default helper and surface deterministic output.
- Rollout & monitoring
  - Additive migration, no destructive backfill.
  - Watch proof-pack generation logs and MRV queries after deploy.
- Acceptance checks
  - Focused unit/e2e commands plus repo lint/typecheck/build.

### Dependencies

- Prisma migration and client generation.
- Existing proof-pack, lane, audit, and cold-chain modules.

### Validation

- Focused backend unit tests for MRV, dispute, and proof-pack logic.
- Focused e2e tests for MRV/dispute routes.
- `npm run lint`, `npm run typecheck`, `npm run build`.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Proof-pack auto-pack reconciliation | `ProofPackService.completeLeasedJob()` after pack ready | `EvidenceModule` provider wiring for `ProofPackService` and `ProofPackWorkerService` | `proof_packs`, `proof_pack_jobs`, `lanes` |
| Canonical defense timeline builder | `DisputeService.generateDefensePack()` | `DisputeModule` provider wiring | `disputes`, `audit_entries`, `checkpoints`, `evidence_artifacts`, cold-chain tables |
| Defense template section expansion | `ProofPackService.renderTemplate('DEFENSE', ...)` | `templates/defense.hbs` loaded by `ProofPackService` | none |
| Persistent emission factors | `MrvLiteService` ESG calculations | `MrvLiteModule` store/service wiring | new `emission_factors` table |
| Richer waste metrics | MRV ESG service/store path | `MrvLiteModule` store/service/controller wiring | lane/dispute-derived queries and any additive ESG table if needed |

## Plan Draft B

### Overview

Implement the smallest possible changes by keeping MRV persistence additive and dispute reconstruction local to `DisputeService`, while avoiding any new shared timeline abstraction. This version favors low churn and faster delivery over architectural elegance.

### Files to Change

- Same core files as Draft A, but avoid introducing extra shared dispute timeline types unless the tests force them.

### Implementation Steps

#### TDD sequence
1. Add failing tests for exact missing behaviors only.
2. Patch the fewest production files needed to satisfy those tests.
3. Skip broader refactors unless duplicated logic becomes hard to reason about.

#### Meaningful difference from Draft A

- Keep dispute reconstruction logic inside `generateDefensePack()` helpers instead of introducing a reusable service abstraction.
- Store emission factors in Postgres, but derive richer waste metrics from existing lane/dispute state without creating a separate ESG persistence table.

### Test Coverage

- Same user-visible tests as Draft A, but fewer new type-level tests.

### Decision Completeness

- Same goals and acceptance criteria as Draft A.
- Chosen bias: minimize churn and keep all new behavior behind existing endpoints and modules.

### Dependencies

- Same as Draft A.

### Validation

- Same as Draft A.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Proof-pack auto-pack reconciliation | `completeLeasedJob()` | `EvidenceModule` | `proof_packs`, `lanes` |
| Defense-pack reconstruction helpers | `DisputeService.generateDefensePack()` | `DisputeModule` | `disputes`, `audit_entries`, `checkpoints`, `evidence_artifacts`, cold-chain tables |
| Persistent emission factors | `MrvLiteService` | `MrvLiteModule` | `emission_factors` |

## Comparative Analysis

- Draft A strengths
  - Cleaner separation between reconstruction and assembly logic.
  - Easier to extend later if dispute workflows grow.
- Draft A gaps
  - Slightly more moving parts and higher risk of over-abstracting the current repo.
- Draft B strengths
  - Lower churn and easier to land quickly.
  - Better aligned with the repo’s existing “extend current module” pattern.
- Draft B gaps
  - More logic may remain concentrated in one dispute service file.
- Chosen direction
  - Use Draft B as the base implementation, but still extract small private helpers where it materially improves readability.

## Unified Execution Plan

### Overview

Implement the five real gaps with the smallest additive changes that make the subtasks honestly complete. Keep module ownership intact: proof-pack transition handoff stays in evidence/lane, defense-pack completeness stays in dispute/template assembly, and MRV persistence stays in Prisma plus the existing MRV module.

### Files to Change

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/modules/mrv-lite/mrv-lite.types.ts`
- `src/modules/mrv-lite/mrv-lite.constants.ts`
- `src/modules/mrv-lite/mrv-lite.pg-store.ts`
- `src/modules/mrv-lite/mrv-lite.service.ts`
- `src/modules/mrv-lite/mrv-lite.service.spec.ts`
- `test/mrv-lite.e2e-spec.ts`
- `src/modules/evidence/proof-pack.service.ts`
- `src/modules/evidence/proof-pack.service.spec.ts`
- `src/modules/dispute/dispute.service.ts`
- `src/modules/dispute/dispute.service.spec.ts`
- `templates/defense.hbs`
- `test/dispute.e2e-spec.ts`
- `docs/PROGRESS.md`

### Implementation Steps

#### TDD sequence
1. Add MRV unit tests that fail because factors are hardcoded and waste metrics are too thin.
2. Run `npm test -- --runInBand src/modules/mrv-lite/mrv-lite.service.spec.ts` and capture the RED failure.
3. Implement additive Prisma/schema/store/service changes and rerun until GREEN.
4. Add proof-pack unit tests that fail because pack completion does not trigger auto-pack reconciliation.
5. Run `npm test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts` and capture RED.
6. Implement reconciliation handoff in `ProofPackService`.
7. Add dispute unit tests that fail because defense packs lack canonical timeline/temperature/visual-evidence assembly.
8. Run `npm test -- --runInBand src/modules/dispute/dispute.service.spec.ts` and capture RED.
9. Implement dispute assembly helpers plus defense template expansion.
10. Run focused e2e commands for MRV and dispute.
11. Run lint, typecheck, build, then a skeptical review, then Task Master reconciliation.

#### Expected behavior

- A lane that is already `VALIDATED` auto-transitions to `PACKED` once a proof pack becomes ready and the guard sees pack count ≥ 1.
- Defense pack generation produces a six-section dossier with canonical timeline, temperature forensics, visual evidence, and audit extract sections populated from current data sources.
- MRV endpoints read emission factors from the database and report richer waste metrics derived from actual lane/dispute state.

### Test Coverage

- `src/modules/mrv-lite/mrv-lite.service.spec.ts`
  - `getLaneEsgCard prefers persisted factor rows`
  - `getLaneEsgCard reports rejection downgrade damage metrics`
  - `getExporterReport aggregates environmental and waste metrics`
- `src/modules/evidence/proof-pack.service.spec.ts`
  - `completeLeasedJob auto-packs validated lanes after generation`
  - `completeLeasedJob logs reconciliation errors and keeps pack ready`
- `src/modules/dispute/dispute.service.spec.ts`
  - `generateDefensePack builds chronological mixed-source timeline`
  - `generateDefensePack includes temperature forensics section data`
  - `generateDefensePack includes checkpoint visual evidence metadata`
- `test/mrv-lite.e2e-spec.ts`
  - `GET /lanes/:id/esg includes richer waste block`
  - `GET /esg/carbon/factors returns seeded DB factors`
- `test/dispute.e2e-spec.ts`
  - `POST /disputes/:id/defense-pack returns defense submission state`

### Decision Completeness

- Goal
  - Make subtasks `7.3`, `16.2`, `16.3`, `17.1`, and `17.3` genuinely complete in code.
- Non-goals
  - No new UI routes, no broad websocket redesign, no Graphite/PR work.
- Success criteria
  - Focused tests prove each of the five missing behaviors.
  - All touched modules remain wired through existing module paths.
  - Task Master can be updated without overstating implementation.
- Public interfaces
  - Existing route paths remain unchanged.
  - Additive Prisma model for emission factors and any minimal additive fields needed for metrics.
- Edge cases / failure modes
  - Missing emission-factor row uses deterministic fallback value.
  - Missing photo/EXIF or temperature artifacts render explicit empty sections.
  - Pack reconciliation errors are logged and do not corrupt proof-pack completion.
- Rollout & monitoring
  - Additive DB change only.
  - Monitor proof-pack completion logs and MRV endpoint outputs after rollout.
- Acceptance checks
  - `npm test -- --runInBand src/modules/mrv-lite/mrv-lite.service.spec.ts`
  - `npm test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
  - `npm test -- --runInBand src/modules/dispute/dispute.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/mrv-lite.e2e-spec.ts test/dispute.e2e-spec.ts`
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`

### Dependencies

- Existing Postgres-backed Prisma schema.
- Existing proof-pack worker/service runtime.
- Existing dispute, lane, cold-chain, and audit module APIs.

### Validation

- Focused RED/GREEN cycles for MRV, proof-pack, and dispute.
- Focused e2e coverage for unchanged endpoint surfaces.
- Final lint/typecheck/build.

### Wiring Verification

| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| Auto-pack after proof-pack ready | `ProofPackService.completeLeasedJob()` | `EvidenceModule` providers plus worker polling path | `proof_packs`, `proof_pack_jobs`, `lanes` |
| Defense timeline reconstruction helpers | `DisputeService.generateDefensePack()` | `DisputeModule` provider registration | `disputes`, `audit_entries`, `checkpoints`, `evidence_artifacts`, `temperature_readings`, `excursions` |
| Expanded defense template | `ProofPackService.renderTemplate('DEFENSE', ...)` | template resolution in `ProofPackService` | none |
| Persistent emission factors | `MrvLiteService.getLaneEsgCard()/getExporterReport()/getPlatformReport()` | `MrvLiteModule` controller→service→store path | `emission_factors` |
| Richer waste metrics | same MRV service entry points | `MrvLiteModule` store/service/controller path | existing lane/dispute/evidence tables plus additive metric source fields if required |

### Auggie Fallback Note

Auggie semantic search was unavailable (`HTTP 429`), so this plan is based on direct file inspection plus exact-string searches across:

- `src/modules/lane/*`
- `src/modules/evidence/*`
- `src/modules/dispute/*`
- `src/modules/mrv-lite/*`
- `src/modules/notifications/*`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `templates/defense.hbs`
- `test/dispute.e2e-spec.ts`
- `test/mrv-lite.e2e-spec.ts`
- `test/proof-pack.e2e-spec.ts`
- `test/proof-pack-worker.e2e-spec.ts`

## Implementation Summary

- Added a real `EmissionFactor` Prisma model plus seed/migration wiring and switched MRV-Lite from hardcoded route factors to persisted store-backed factors with fallback defaults.
- Expanded MRV waste reporting so lane/exporter/platform ESG outputs now include dispute, grade-downgrade, damage-claim, and estimated waste-event metrics derived from lane/dispute state instead of completeness heuristics.
- Extended lane auto-transitions so proof-pack completion can reconcile `VALIDATED -> PACKED`, and wired `ProofPackService.completeLeasedJob()` to call the existing lane reconciler without failing pack readiness if reconciliation has a follow-on error.
- Added `DisputeTimelineService` to reconstruct a canonical dispute timeline by merging lane/audit/checkpoint events with sampled temperature telemetry and excursion windows.
- Expanded defense-pack template data and rewrote `templates/defense.hbs` so the six required sections now include executive summary, reconstructed chain-of-custody timeline, compliance report, temperature forensics, EXIF-aware visual evidence, and audit trail.
- Reconciled Task Master subtask status for the previously stale-but-implemented subtasks and the five partial subtasks completed in this pass; Task Master now reports 120/120 subtasks done.

## Validation Run

- `npm test -- --runInBand src/modules/mrv-lite/mrv-lite.service.spec.ts`
- `npm test -- --runInBand src/modules/lane/lane.transition-policy.spec.ts src/modules/evidence/proof-pack.service.spec.ts`
- `npm test -- --runInBand src/modules/dispute/dispute-timeline.service.spec.ts src/modules/dispute/dispute.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts`
- `npm run db:generate`
- `npm run typecheck`
- `npm run lint`
- `npm test -- --runInBand src/modules/mrv-lite/mrv-lite.service.spec.ts src/modules/lane/lane.transition-policy.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/dispute/dispute-timeline.service.spec.ts src/modules/dispute/dispute.service.spec.ts`
- `npm run test:e2e -- --runInBand test/mrv-lite.e2e-spec.ts test/dispute.e2e-spec.ts`
- `npm run build`
