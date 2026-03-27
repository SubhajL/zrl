# Coding Log

## Plan Draft A

### Overview
Fix the two critical proof-pack integrity defects in the Evidence module. Keep the public API stable, but make real templates render in production and make `proof_packs.content_hash` match the exact uploaded bytes.

### Files To Change
- `src/modules/evidence/proof-pack.service.ts` - register Handlebars helpers, simplify rendering flow to one pass, and hash the exact uploaded bytes.
- `src/modules/evidence/proof-pack.types.ts` - adjust template-data fields so render-time data no longer depends on a self-referential file hash.
- `src/modules/evidence/evidence.controller.ts` - stop constructing placeholder QR/hash fields and pass only base pack data.
- `src/modules/evidence/proof-pack.service.spec.ts` - add RED coverage for real-template rendering and hash/write consistency.
- `templates/regulator.hbs` - remove self-referential content-hash display and use a non-self-referential verification footer.
- `templates/buyer.hbs` - same footer and conditional-helper compatibility.
- `templates/defense.hbs` - same footer and conditional-helper compatibility.

### Implementation Steps
1. TDD sequence:
   1) Add a test that renders each real template and fails on missing `eq` helper.
   2) Add a test that proves the hashed buffer and written/uploaded buffer must be the same bytes.
   3) Run the focused proof-pack unit test command and confirm RED failures.
   4) Implement the smallest service/type/template/controller changes to pass.
   5) Run focused tests, then typecheck/lint/build for touched backend code.
2. `ProofPackService.registerTemplateHelpers()`
   Register the `eq` helper on a local Handlebars instance so real templates compile at runtime without polluting global state.
3. `ProofPackService.buildVerificationReference(...)`
   Produce a stable, non-self-referential verification identifier from lane ID, pack type, and version. This becomes render-time data instead of embedding the final PDF file hash into the PDF itself.
4. `ProofPackService.generatePack(...)`
   Render once with stable verification data, convert to PDF once, hash that exact buffer, write/upload that same buffer, and store the resulting digest.
5. `EvidenceController.generatePack(...)`
   Keep completeness and evidence/rules assembly logic, but stop generating placeholder QR/hash values in the controller.

### Test Coverage
- `src/modules/evidence/proof-pack.service.spec.ts`
  - `renders each real proof-pack template with registered helpers`
    Proves production templates compile successfully.
  - `stores the hash of the exact bytes written for upload`
    Proves stored digest matches uploaded buffer.
  - Existing generation/audit/version/list tests remain green.

### Decision Completeness
- Goal:
  - Real proof-pack generation works with shipped templates.
  - Stored `content_hash` corresponds to the exact uploaded proof-pack bytes.
- Non-goals:
  - Public verification/download endpoints.
  - Checkpoint CRUD or timeline work.
  - Shared DB pool refactor.
- Success criteria:
  - Real template render test passes for regulator, buyer, and defense templates.
  - Hash/write consistency test passes.
  - Focused proof-pack unit and e2e tests pass.
  - `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Public interfaces:
  - No route changes.
  - No schema changes.
  - Internal `ProofPackTemplateData` may shift from `contentHash`-at-render-time toward a stable verification reference.
- Edge cases / failure modes:
  - Missing template file: fail closed with thrown error.
  - Missing helper: fail closed in tests before runtime.
  - Missing browser binary: existing HTML-buffer fallback remains unchanged for this slice.
- Rollout & monitoring:
  - No flag needed; pure backend/template fix.
  - Watch proof-pack generation logs and any object-store upload errors.
- Acceptance checks:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies
- Existing `HashingService`, `EvidenceObjectStore`, and proof-pack storage schema.
- Existing `qrcode` package if QR generation stays in the service layer.

### Validation
- Unit tests prove helper registration and byte/hash integrity.
- Existing e2e route wiring still proves the lane pack endpoints are reachable.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ProofPackService.generatePack()` | `POST /lanes/:id/packs` | `src/modules/evidence/evidence.module.ts` provider; called from `src/modules/evidence/evidence.controller.ts` | `proof_packs` |
| local Handlebars helper registration | `ProofPackService.renderTemplate()` | `src/modules/evidence/proof-pack.service.ts` constructor/local field setup | N/A |
| template footer changes | `ProofPackService.renderTemplate()` loading `templates/*.hbs` | `templates/` runtime files on disk | N/A |

### Cross-Language Schema Verification
Not applicable beyond TypeScript in this repo. `proof_packs.content_hash` remains the canonical stored digest field in `prisma/schema.prisma`.

### Decision-Complete Checklist
- No open API/schema decisions remain for the critical fix slice.
- Every behavior change has a corresponding RED/ GREEN test.
- Validation commands are scoped and concrete.
- Wiring is covered for service, controller entry point, and runtime templates.

## Plan Draft B

### Overview
Fix the same critical defects with even fewer moving parts by keeping QR generation in the controller, removing self-referential footer content from the templates, and changing the service only enough to render once and hash the final buffer.

### Files To Change
- `src/modules/evidence/proof-pack.service.ts`
- `src/modules/evidence/evidence.controller.ts`
- `src/modules/evidence/proof-pack.service.spec.ts`
- `templates/regulator.hbs`
- `templates/buyer.hbs`
- `templates/defense.hbs`

### Implementation Steps
1. TDD sequence follows the same RED → GREEN order as Draft A.
2. Register `eq` helper in `ProofPackService`.
3. Delete two-pass rendering and hash the single final PDF buffer.
4. Keep controller-owned QR generation, but stop passing a placeholder content hash.
5. Update template footers so they no longer render a self-referential file hash.

### Test Coverage
- Same two new proof-pack service tests as Draft A.

### Decision Completeness
- Goal, non-goals, success criteria, edge cases, rollout, and acceptance checks are the same as Draft A.
- Public interfaces remain unchanged.

### Dependencies
- Same as Draft A.

### Validation
- Same as Draft A.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ProofPackService.generatePack()` | `POST /lanes/:id/packs` | `src/modules/evidence/evidence.module.ts`; called from controller | `proof_packs` |
| template footer changes | `ProofPackService.renderTemplate()` | runtime `templates/*.hbs` files | N/A |

### Cross-Language Schema Verification
Not applicable.

### Decision-Complete Checklist
- Critical-fix decisions are complete for the narrower slice.

## Comparative Analysis & Synthesis

### Strengths
- Draft A improves separation of concerns by moving verification-render data closer to the rendering service.
- Draft B changes fewer files and keeps the controller/service boundary closer to the current shape.

### Gaps
- Draft B leaves QR generation split across layers and keeps the controller responsible for proof-pack render details.
- Draft A is slightly larger but removes more placeholder logic and is easier to reason about.

### Trade-Offs
- Draft A touches one extra type surface and moves QR/render concerns into the service where version-aware rendering already belongs.
- Draft B is smaller, but it preserves the controller’s current overreach into pack-render internals.

### Compliance
- Both drafts preserve the module boundary and keep proof-pack logic inside the Evidence module.
- Draft A better fits the existing service-owned rendering/storage responsibilities.

## Unified Execution Plan

### Overview
Implement the critical proof-pack fixes by making `ProofPackService` the single owner of render-time helper setup and verification-render data, then hash the exact PDF bytes that are written and uploaded. Keep the HTTP contract stable and postpone non-critical API additions until the critical integrity path is green.

### Files To Change
- `src/modules/evidence/proof-pack.service.ts` - local Handlebars environment, helper registration, one-pass render/hash/upload, stable verification reference and QR generation.
- `src/modules/evidence/proof-pack.types.ts` - make render-time verification fields explicit and remove any need for a final file hash at template-construction time.
- `src/modules/evidence/evidence.controller.ts` - remove placeholder QR/hash assembly and pass only base pack data.
- `src/modules/evidence/proof-pack.service.spec.ts` - add real-template render coverage and hash/write consistency coverage.
- `templates/regulator.hbs` - footer uses verification reference instead of self-embedded content hash.
- `templates/buyer.hbs` - same.
- `templates/defense.hbs` - same.

### Implementation Steps
1. TDD sequence:
   1) Add RED tests for real-template rendering and byte/hash consistency.
   2) Run focused proof-pack unit tests and confirm failures for the right reasons.
   3) Implement the smallest evidence-module changes to pass.
   4) Refactor minimally by localizing helper/QR/render logic inside `ProofPackService`.
   5) Run focused tests, e2e smoke, typecheck, lint, and build.
2. `ProofPackService`
   - Replace global `Handlebars.compile` use with a local Handlebars instance plus registered `eq` helper.
   - Generate a stable verification reference from lane ID, pack type, and version, plus a QR code derived from that stable reference.
   - Render exactly once, convert to PDF once, hash the exact resulting buffer, then write/upload that same buffer and persist its digest.
3. `ProofPackTemplateData`
   - Add `verificationReference`.
   - Make `qrCodeDataUrl` and `contentHash` no longer required at controller assembly time.
4. `EvidenceController.generatePack()`
   - Keep completeness/rules/audit data assembly.
   - Stop building placeholder QR/hash fields.
5. Template footers
   - Remove self-referential content-hash display.
   - Show verification reference plus QR.

### Test Coverage
- `src/modules/evidence/proof-pack.service.spec.ts`
  - `renders each real proof-pack template with registered helpers`
    Shipped templates compile in production path.
  - `hashes the same proof-pack bytes it writes for upload`
    Stored digest matches written/uploaded bytes.
  - `creates audit entry on generation`
    Existing audit side effect preserved.
  - `increments version for same lane and pack type`
    Existing versioning preserved.
  - `stores pack record with correct fields`
    Persistence contract preserved.
- `test/proof-pack.e2e-spec.ts`
  - Existing invalid-type and list wiring tests remain green.

### Decision Completeness
- Goal:
  - Critical proof-pack generation path is trustworthy again.
- Non-goals:
  - Public verify/download endpoints, async generation contract, and QR public URL semantics.
- Success criteria:
  - Real templates render successfully in unit tests.
  - Stored hash equals the exact bytes written for upload.
  - Focused proof-pack unit/e2e tests pass.
  - Typecheck/lint/build pass.
- Public interfaces:
  - No endpoint or schema changes.
  - Internal template-data contract changes only.
- Edge cases / failure modes:
  - Missing template/helper fails closed.
  - Browser fallback continues returning HTML buffer, but the stored hash must still match those exact bytes.
  - Object-store upload failure aborts pack generation before DB record creation.
- Rollout & monitoring:
  - No migration or backout complexity.
  - Monitor proof-pack generation errors and object-store failures.
- Acceptance checks:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### Dependencies
- `HashingService`
- `EvidenceObjectStore`
- proof-pack templates in `templates/`

### Validation
- Focused unit tests prove the critical invariants directly.
- Focused e2e tests prove the route still boots through `AppModule`.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `ProofPackService.generatePack()` | `POST /lanes/:id/packs` in `EvidenceController.generatePack()` | `src/modules/evidence/evidence.module.ts` providers | `proof_packs` |
| Handlebars helper setup | `ProofPackService.renderTemplate()` | local `ProofPackService` constructor/field initialization | N/A |
| verification footer/QR data | consumed by `templates/*.hbs` during `renderTemplate()` | `ProofPackService.generatePack()` data assembly | N/A |

### Cross-Language Schema Verification
Not applicable. `prisma/schema.prisma` still defines `ProofPack.contentHash -> proof_packs.content_hash` as the stored digest for the generated pack bytes.

### Decision-Complete Checklist
- No open decisions remain for the critical slice.
- Each critical behavior change has direct proof in tests.
- Commands and verification steps are explicit.
- Wiring is accounted for end-to-end from controller to service to object store and DB record.

## 2026-03-27 05:46 ICT

- Goal: Fix the two critical proof-pack defects by making the shipped templates render at runtime and making `proof_packs.content_hash` match the exact bytes written for upload.
- What changed:
  - `src/modules/evidence/proof-pack.service.ts`
    - Switched to a local helper-aware Handlebars instance and registered the `eq` helper used by the shipped templates.
    - Removed the two-pass render/hash flow and now render once, hash the exact PDF buffer, and write/upload that same buffer.
    - Added a stable verification reference plus QR generation inside the service so render-time verification data no longer depends on the final file hash.
  - `src/modules/evidence/proof-pack.types.ts`
    - Made render-time QR/hash fields optional and added `verificationReference` so controller-side template assembly no longer depends on placeholder values.
  - `src/modules/evidence/evidence.controller.ts`
    - Removed placeholder QR/hash generation and now passes only the base template data into `ProofPackService.generatePack()`.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Added coverage that renders the real `templates/*.hbs` files and verifies the hashed buffer is the same buffer written for upload.
  - `templates/regulator.hbs`
    - Replaced the self-referential content-hash footer with a verification-reference footer.
  - `templates/buyer.hbs`
    - Replaced the self-referential content-hash footer with a verification-reference footer.
  - `templates/defense.hbs`
    - Replaced the self-referential content-hash footer with a verification-reference footer.
  - `docs/PROGRESS.md`
    - Added the terse progress note for this critical proof-pack fix session.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
    - Failed with `Missing helper: "eq"` for all three shipped templates.
    - Failed the new hash/write invariant because the buffer hashed in `ProofPackService.generatePack()` was not the same buffer written for upload.
  - GREEN: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
    - Passed with `11 passed, 11 total`.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts` -> passed (`11 passed, 11 total`).
  - `for i in 1 2 3; do npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts >/tmp/proof-pack-unit-$i.log || { cat /tmp/proof-pack-unit-$i.log; exit 1; }; done; tail -n 20 /tmp/proof-pack-unit-3.log` -> proof-pack unit slice passed 3 consecutive runs.
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts` -> passed (`2 passed, 2 total`).
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `POST /lanes/:id/packs` still enters through `src/modules/evidence/evidence.controller.ts` and calls `ProofPackService.generatePack()` with the lane-derived template data.
  - `ProofPackService` remains registered through `src/modules/evidence/evidence.module.ts`, so the helper-aware renderer runs on the real Nest runtime path.
  - Runtime template loading still comes from `templates/regulator.hbs`, `templates/buyer.hbs`, and `templates/defense.hbs`; the new real-template unit test proves those files compile through the production render path.
- Behavior changes and risk notes:
  - Proof packs now render once and the stored `content_hash` now reflects the exact uploaded bytes instead of an earlier render pass.
  - The PDF footer now shows a stable verification reference rather than a self-embedded file hash, avoiding the self-referential hash paradox.
  - QR generation moved into the service and now encodes a stable verification reference instead of a placeholder string.
  - Browser fallback remains fail-closed for integrity in the sense that whatever bytes are produced and uploaded are the same bytes that are hashed and stored.
- Follow-ups / known gaps:
  - Public proof-pack verification, metadata, and download endpoints are still missing.
  - The QR code currently encodes a stable internal verification reference, not the eventual public verify URL.
  - The proof-pack store still owns its own `pg.Pool`; the shared DB pool refactor remains separate work.

## 2026-03-27 05:50 ICT

- Goal: Close the next proof-pack gap by adding metadata, download, and public verification endpoints on top of the repaired proof-pack integrity path.
- What changed:
  - `src/modules/evidence/proof-pack.types.ts`
    - Added `ProofPackVerificationResult` and extended `ProofPackStore` with `findPackById(id)` so the service can retrieve persisted pack records by identifier.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Implemented `findPackById(id)` against `proof_packs` so the service can serve metadata, verification, and download requests without lane-scoped list scans.
  - `src/modules/evidence/proof-pack.service.ts`
    - Added `getPackById(id)`, `verifyPack(id)`, and `getPackDownload(id)`.
    - Added `requirePack(id)` to centralize 404 behavior.
    - `verifyPack(id)` now re-hashes the stored object stream and returns both the stored digest and the freshly computed digest so callers can determine verification status from the exact object bytes.
  - `src/modules/evidence/evidence.controller.ts`
    - Added `GET /packs/:id` under JWT auth for pack metadata.
    - Added public `GET /packs/:id/verify`.
    - Added `GET /packs/:id/download` under JWT auth with PDF content headers and streaming response behavior.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Added service-level coverage for metadata lookup, 404 behavior, object-store re-hash verification, and download stream retrieval.
  - `test/proof-pack.e2e-spec.ts`
    - Added e2e coverage for metadata lookup, public verification, and PDF download headers.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
    - Failed with `service.getPackById is not a function`, `service.verifyPack is not a function`, and `service.getPackDownload is not a function`.
  - RED: `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts`
    - Failed with 404 responses for `/packs/:id`, `/packs/:id/verify`, and `/packs/:id/download`.
  - GREEN: both focused suites passed after the service/store/controller wiring was added.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts` -> passed (`15 passed, 15 total`).
  - `for i in 1 2 3; do npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts >/tmp/proof-pack-unit-$i.log || { cat /tmp/proof-pack-unit-$i.log; exit 1; }; done; tail -n 20 /tmp/proof-pack-unit-3.log` -> proof-pack unit slice passed 3 consecutive runs.
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts` -> passed (`5 passed, 5 total`).
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed after formatting the touched files with Prettier.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `GET /packs/:id`, `GET /packs/:id/verify`, and `GET /packs/:id/download` are now wired in `src/modules/evidence/evidence.controller.ts`.
  - `ProofPackService` remains registered in `src/modules/evidence/evidence.module.ts` and now mediates pack lookup, stream retrieval, and verification hashing.
  - `PrismaProofPackStore.findPackById()` provides direct proof-pack persistence lookup.
  - Download streaming uses `EvidenceObjectStore.createReadStream(...)`, and public verification uses the same stored object bytes for digest comparison.
- Behavior changes and risk notes:
  - The repo now exposes the missing pack metadata/download/public verification API surface called for in Task 12.
  - Verification is based on re-hashing the stored object payload rather than trusting the DB row alone.
  - Auth scope is still JWT-only for metadata/download routes; there is not yet lane-owner or role-specific authorization narrowing on those endpoints.
- Follow-ups / known gaps:
  - Pack generation is still synchronous; the PRD still describes generate-status semantics for asynchronous generation.
  - The new public verify response is byte-integrity focused and does not yet expose richer lineage metadata beyond the stored pack record.
  - Task 6.3 checkpoint creation and Task 6.5 richer lane timeline metadata remain open.

## 2026-03-27 06:09 ICT

- Goal: Close the Task 6.3 checkpoint-recording gap by adding the missing `POST /lanes/:id/checkpoints` route with multipart photo/signature capture and real evidence-artifact creation.
- What changed:
  - `src/modules/lane/lane.types.ts`
    - Added `CreateCheckpointInput`.
    - Extended `LaneStore` with `createCheckpoint(...)`.
  - `src/modules/lane/lane.pg-store.ts`
    - Implemented `createCheckpoint(...)` for the `checkpoints` table.
    - Consolidated checkpoint row mapping into `mapCheckpointRow(...)` so create/list/update return the same shape.
  - `src/modules/lane/lane.service.ts`
    - Added `createCheckpoint(...)` with lane existence enforcement and `CHECKPOINT` `CREATE` audit entries.
  - `src/modules/lane/lane.controller.ts`
    - Added `POST /lanes/:id/checkpoints` as a multipart route using `photo` and `signature` uploads.
    - The route now resolves a checkpoint by `sequence`, creates a new pending checkpoint when needed, uploads `CHECKPOINT_PHOTO` and `HANDOFF_SIGNATURE` artifacts through `EvidenceService.uploadArtifact(...)`, then finalizes the checkpoint with `COMPLETED` status, signature hash, timestamp, temperature, and GPS metadata.
    - The route requires `locationName` only when the requested sequence is not already preconfigured on the lane.
    - Temp upload files are cleaned up in the controller even if the flow fails.
  - `src/modules/lane/lane.module.ts`
    - Imported `EvidenceModule` via `forwardRef(...)` so the lane controller can use the exported `EvidenceService`.
  - `src/modules/evidence/evidence.module.ts`
    - Switched the `LaneModule` import to `forwardRef(...)` to preserve module boot under the new cross-module route composition.
  - `src/modules/lane/lane.service.spec.ts`
    - Added RED/GREEN coverage for `createCheckpoint(...)` and its audit side effect.
  - `test/lane.e2e-spec.ts`
    - Added multipart route coverage for `POST /lanes/:id/checkpoints`.
    - Overrode `EvidenceService` in the e2e harness and asserted the route returns the finalized completed checkpoint payload.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts`
    - Failed with `TypeError: service.createCheckpoint is not a function`.
  - RED: `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts`
    - Failed with 404 for `POST /lanes/:id/checkpoints`.
  - GREEN: both focused suites passed after the store/service/controller/module wiring landed.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts` -> passed (`29 passed, 29 total`).
  - `for i in 1 2 3; do npm run test -- --runInBand src/modules/lane/lane.service.spec.ts >/tmp/lane-unit-$i.log || { cat /tmp/lane-unit-$i.log; exit 1; }; done; tail -n 20 /tmp/lane-unit-3.log` -> lane unit slice passed 3 consecutive runs.
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts` -> passed (`13 passed, 13 total`).
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed after formatting `src/modules/lane/lane.controller.ts` with Prettier.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `POST /lanes/:id/checkpoints` now enters through `src/modules/lane/lane.controller.ts`.
  - The route uses `LaneService.getCheckpoints(...)` / `LaneService.createCheckpoint(...)` / `LaneService.updateCheckpoint(...)` for checkpoint persistence and `EvidenceService.uploadArtifact(...)` for the real evidence path.
  - `EvidenceService` remains exported from `src/modules/evidence/evidence.module.ts`; `LaneModule` now imports `EvidenceModule` through `forwardRef(...)` so the route is wired in the Nest runtime without duplicating evidence logic.
  - Photo uploads continue to flow through the existing evidence hashing/object-store/audit pipeline, including EXIF/GPS validation for `CHECKPOINT_PHOTO`.
- Behavior changes and risk notes:
  - The repo now has the missing checkpoint capture route with actual multipart handling and artifact creation, rather than only checkpoint list/update endpoints.
  - For existing configured checkpoint sequences, callers only need the PRD fields (`sequence`, `photo`, `temperature`, `signature`, plus optional GPS/notes/timestamp). For brand-new sequences, callers must also provide `locationName`.
  - The route composes lane persistence and evidence uploads across module boundaries; if artifact upload fails after a new placeholder checkpoint row is created, the request fails but the checkpoint row may remain pending for retry rather than being hard-deleted.
- Follow-ups / known gaps:
  - `GET /checkpoints/:cpId` is still not implemented.
  - The medium-severity checkpoint audit payload gap remains: `updateCheckpoint(...)` still hashes only lane/checkpoint/status rather than the full checkpoint snapshot.
  - Task 6.5 richer lane timeline metadata is still open.

## 2026-03-27 06:23 ICT

- Goal: Close the remaining medium lane-observability gaps by hashing the full checkpoint snapshot in audits and enriching lane timeline events with typed metadata.
- What changed:
  - `src/modules/lane/lane.service.ts`
    - Replaced the checkpoint-update audit hash payload with a full checkpoint snapshot payload so temperature/GPS/signature-only changes produce distinct audit hashes.
    - Added timeline metadata enrichment for `LANE`, `CHECKPOINT`, `ARTIFACT`, and `PROOF_PACK` events.
    - `getTimeline(...)` now joins lane checkpoints, lane artifacts, and proof-pack detail lookups onto the existing audit stream instead of returning only a thin audit projection.
  - `src/modules/lane/lane.types.ts`
    - Added `LaneTimelineEventMetadata` and attached optional typed `metadata` to `LaneTimelineEvent`.
  - `src/modules/lane/lane.module.ts`
    - Injects `ProofPackService` into `LaneService` so proof-pack timeline events can expose pack type/version/hash/generated-at metadata.
  - `src/modules/lane/lane.service.spec.ts`
    - Added RED/GREEN coverage proving `updateCheckpoint(...)` hashes the full checkpoint snapshot.
  - `src/modules/lane/lane-timeline.spec.ts`
    - Expanded timeline coverage to mixed lane/checkpoint/artifact/proof-pack events and asserted the new metadata payloads.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts`
    - Failed because `updateCheckpoint(...)` was still hashing only `{"laneId","checkpointId","status"}`.
  - GREEN: the same unit slice passed after switching to full checkpoint snapshot hashing.
  - GREEN: `src/modules/lane/lane-timeline.spec.ts` passed with the new mixed-event metadata coverage after the timeline enrichment landed.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts` -> passed (`30 passed, 30 total`).
  - `npm run test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts` -> passed (`33 passed, 33 total`).
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed after formatting `src/modules/lane/lane-timeline.spec.ts` with Prettier.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `GET /lanes/:id/timeline` still enters through `src/modules/lane/lane.controller.ts` and calls `LaneService.getTimeline(...)`.
  - `LaneService.getTimeline(...)` now enriches the audit stream from `LaneStore.listEvidenceArtifactsForLane(...)`, in-memory lane checkpoint state, and `ProofPackService.getPackById(...)`.
  - The lane module already imports the evidence module via `forwardRef(...)`, so the proof-pack lookup remains on a real Nest provider path rather than an ad-hoc query shortcut.
- Behavior changes and risk notes:
  - Checkpoint audit entries now differentiate materially different checkpoint updates even when the checkpoint status string stays the same.
  - Timeline consumers now receive structured metadata for lane, checkpoint, artifact, and proof-pack events, making the endpoint useful for richer UI rendering instead of only text descriptions.
  - Timeline metadata is current-state enrichment layered onto the audit stream, not a historical snapshot of each entity at audit-entry time; if an entity changes later, the timeline metadata reflects the latest persisted record for that entity.
- Follow-ups / known gaps:
  - The proof-pack generate path is still synchronous and does not yet match the PRD’s async `status: "generating"` contract.
  - `GET /checkpoints/:cpId` is still absent.

## 2026-03-27 06:47 ICT

- Goal: Close the remaining implementation gaps from the earlier review by shipping the async proof-pack contract, checkpoint-by-id access, owner-scoped pack auth, and historical timeline snapshots.
- What changed:
  - `prisma/schema.prisma`
    - Added `PackStatus` (`GENERATING`/`READY`/`FAILED`) to proof packs.
    - Made `proof_packs.content_hash` and `proof_packs.file_path` nullable and added `proof_packs.error_message`.
    - Added `AuditEntrySnapshot` as an additive companion table so historical payload snapshots are stored without changing the canonical hash-chain inputs on `audit_entries`.
  - `prisma/migrations/20260327123000_async_proof_pack_and_audit_snapshots/migration.sql`
    - Adds the new proof-pack status/error columns, backfills existing packs to `READY`, and creates `audit_entry_snapshots`.
  - `src/common/audit/audit.types.ts`
    - Extended audit entry inputs/records/export payloads with optional `payloadSnapshot`.
  - `src/common/audit/audit.service.ts`
    - Threads `payloadSnapshot` through the append-only audit write path without changing entry-hash computation.
  - `src/common/audit/audit.prisma-store.ts`
    - Persists snapshots into the companion table and rehydrates them on lane/entity reads via `LEFT JOIN audit_entry_snapshots`.
  - `src/common/auth/auth.types.ts`
    - Added auth-store resolution methods for proof-pack and checkpoint ownership.
  - `src/common/auth/auth.service.ts`
    - Exposed `resolveProofPackOwnerId(...)` and `resolveCheckpointOwnerId(...)` alongside the existing lane ownership lookup.
  - `src/common/auth/auth.pg-store.ts`
    - Resolves pack/checkpoint owners by joining through `lanes.exporter_id`.
  - `src/common/auth/auth.guards.ts`
    - Refactored owner-check logic into a reusable base helper and added `PackOwnerGuard` plus `CheckpointOwnerGuard`.
  - `src/common/auth/auth.module.ts`
    - Registered/exported the new owner guards.
  - `src/modules/evidence/proof-pack.types.ts`
    - Added `ProofPackStatus`, nullable final-artifact fields, and store support for pack updates.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Persists the new status/error fields and updates existing pack rows as background generation completes or fails.
  - `src/modules/evidence/proof-pack.service.ts`
    - `generatePack(...)` now creates a `GENERATING` row immediately, schedules background rendering/upload work, then marks the row `READY` or `FAILED`.
    - `verifyPack(...)` and `getPackDownload(...)` now reject non-ready packs instead of assuming the artifact already exists.
    - Emits proof-pack audit snapshots on both successful generation and failed background completion.
  - `src/modules/evidence/evidence.controller.ts`
    - Added `POST /lanes/:id/packs/generate` for the PRD async contract.
    - Kept `POST /lanes/:id/packs` as a compatibility alias.
    - Tightened `GET /packs/:id` and `GET /packs/:id/download` with `PackOwnerGuard`.
  - `src/modules/evidence/evidence.service.ts`
    - Upload/verify/delete artifact audit writes now include historical artifact snapshots so timeline enrichment does not need to reconstruct newer artifact state for new entries.
  - `src/modules/lane/lane.types.ts`
    - Added `LaneStore.findCheckpointById(...)` and enriched proof-pack timeline metadata with status/error fields.
  - `src/modules/lane/lane.pg-store.ts`
    - Implemented checkpoint lookup by id.
    - Tightened proof-pack counting to `status = 'READY'` so async in-flight packs do not satisfy the lane `PACKED` transition guard.
  - `src/modules/lane/lane.service.ts`
    - Added `getCheckpointById(...)`.
    - Checkpoint create/update audits now store full checkpoint snapshots.
    - Timeline metadata now prefers stored audit snapshots for lane/checkpoint/artifact/proof-pack events, with current-state fallback for older pre-snapshot audit rows.
  - `src/modules/lane/lane.controller.ts`
    - Added `CheckpointController` with `GET /checkpoints/:cpId`.
  - `src/modules/lane/lane.module.ts`
    - Registered the new checkpoint controller.
  - `src/common/audit/audit.service.spec.ts`
    - Added coverage that payload snapshots persist without affecting canonical hash computation.
  - `src/common/auth/auth.guards.spec.ts`
    - Added coverage for the new pack/checkpoint owner guards.
  - `src/common/auth/auth.service.spec.ts`
    - Updated the auth-store test double for the expanded owner-resolution contract.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Shifted proof-pack tests to the new async contract, including `GENERATING -> READY/FAILED` behavior and non-ready verification rejection.
  - `src/modules/lane/lane.service.spec.ts`
    - Added checkpoint-by-id coverage.
  - `src/modules/lane/lane-timeline.spec.ts`
    - Added historical snapshot assertions so timeline events now prove they use audit snapshots instead of current entity state.
  - `test/proof-pack.e2e-spec.ts`
    - Added async generate-route coverage and mocked the controller’s lane/evidence/audit dependencies so the e2e harness exercises the new route shape.
  - `test/lane.e2e-spec.ts`
    - Added `GET /checkpoints/:cpId` coverage.
- TDD evidence:
  - RED: `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts test/proof-pack.e2e-spec.ts`
    - Failed on the new proof-pack generate route because the controller still depended on real lane persistence in the e2e harness.
  - GREEN: overriding `LaneService`/`EvidenceService`/`AuditService` in the proof-pack e2e harness made the new route contract test pass without reintroducing real persistence.
  - GREEN: focused unit coverage for audit/auth/proof-pack/lane slices passed after the async status flow and snapshot plumbing landed.
- Tests run and results:
  - `npm run test -- --runInBand src/common/audit/audit.service.spec.ts src/common/auth/auth.guards.spec.ts src/common/auth/auth.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts` -> passed (`74 passed, 74 total`).
  - `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts test/proof-pack.e2e-spec.ts` -> passed (`20 passed, 20 total`).
  - `npm run db:generate` -> passed.
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed after fixing formatting and two stricter lint assertions around mock calls / snapshot date parsing.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `POST /lanes/:id/packs/generate` and compatibility `POST /lanes/:id/packs` both enter through `EvidenceController.enqueuePackGeneration(...)`.
  - `EvidenceController` still assembles real template data from `LaneService`, `EvidenceService`, `RulesEngineService`, and `AuditService`, then hands the request to `ProofPackService.generatePack(...)`.
  - `ProofPackService.generatePack(...)` now writes the initial `GENERATING` row before background rendering/upload, then updates the same row through `ProofPackStore.updatePack(...)`.
  - `GET /packs/:id` and `GET /packs/:id/download` now pass through `PackOwnerGuard`, which resolves ownership through `AuthService -> AuthStore -> proof_packs -> lanes`.
  - `GET /checkpoints/:cpId` enters through the new `CheckpointController` and is protected by `CheckpointOwnerGuard`, which resolves ownership through `checkpoints -> lanes`.
  - `GET /lanes/:id/timeline` still flows through `LaneService.getTimeline(...)`, but the service now consumes snapshot-hydrated audit entries from `AuditService` before falling back to current entity reads.
- Behavior changes and risk notes:
  - Proof-pack generation is now asynchronous from the API perspective: clients receive a `GENERATING` row immediately and must poll `GET /packs/:id` / lane pack lists for readiness.
  - Download/verify calls against in-flight or failed packs now return conflicts instead of attempting to read a non-existent file path.
  - Existing proof-pack rows are migrated to `READY` so older generated packs continue to behave as ready artifacts after the migration is applied.
  - Historical timeline snapshots are forward-looking: new audit entries carry exact event-time snapshots, while older pre-migration audit rows still fall back to current-state enrichment when no snapshot exists.
  - The async background generation is still in-process Nest runtime work. It survives normal request completion but is not yet durable across process crashes or worker restarts.
- Follow-ups / known gaps:
  - The PRD’s async contract is now implemented at the HTTP surface, but it is still backed by in-process background work rather than a durable queue/worker.
  - Shared environments must apply `prisma/migrations/20260327123000_async_proof_pack_and_audit_snapshots/migration.sql` before these new status/snapshot behaviors can be relied on outside local code/test execution.

## Review (2026-03-27 07:34:08 +07) - working-tree (async proof-pack/checkpoint access/timeline snapshot slice)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status -sb`; `git diff --name-only -- <implementation-file-set>`; `git diff --stat -- <implementation-file-set>`; `nl -ba src/modules/evidence/proof-pack.service.ts | sed -n '48,110p;160,236p;260,296p'`; `nl -ba src/common/audit/audit.prisma-store.ts | sed -n '140,230p;248,318p;448,472p'`; `nl -ba src/modules/lane/lane.service.ts | sed -n '372,456p;640,724p;784,848p'`; `nl -ba src/common/auth/auth.guards.ts | sed -n '136,230p'`; `nl -ba prisma/migrations/20260327123000_async_proof_pack_and_audit_snapshots/migration.sql`; `npm run test -- --runInBand src/common/audit/audit.service.spec.ts src/common/auth/auth.guards.spec.ts src/common/auth/auth.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts`; `npm run test:e2e -- --runInBand test/lane.e2e-spec.ts test/proof-pack.e2e-spec.ts`; `npm run db:generate`; `npm run typecheck`; `npm run lint`; `npm run build`

### Findings
CRITICAL
- No findings.

HIGH
- The new async proof-pack contract can strand packs in `GENERATING` forever on process crash or restart because the service writes the row first and then relies on `setImmediate(...)` in the same Nest process to complete the work, with no retry, lease, or stale-row reconciliation path. See [`src/modules/evidence/proof-pack.service.ts:61`](/Users/subhajlimanond/dev/zrl/src/modules/evidence/proof-pack.service.ts#L61) and [`src/modules/evidence/proof-pack.service.ts:73`](/Users/subhajlimanond/dev/zrl/src/modules/evidence/proof-pack.service.ts#L73). This matters because `GET /packs/:id` will keep reporting `GENERATING`, while verify/download correctly refuse non-ready packs, leaving the pack unusable indefinitely after a mid-flight process failure. Fix direction: move generation onto a durable queue/worker or add startup/cron reconciliation that marks stale `GENERATING` rows `FAILED` (or retries them) based on age/heartbeat. Tests needed: an integration path that simulates interrupted background execution and proves stale rows are eventually recoverable.

MEDIUM
- No findings.

LOW
- No findings.

### Open Questions / Assumptions
- Assumed the current PR intent is to ship the HTTP-level async contract now and defer durable background execution to a follow-up.
- Assumed keeping `POST /lanes/:id/packs` as a compatibility alias is intentional and not a temporary migration shim.

### Recommended Tests / Validation
- Add an integration test around stale `GENERATING` pack reconciliation once a retry/failure-reaper path exists.
- Add a concurrency test for same-lane/same-pack-type generation if pack version uniqueness is hardened later.

### Rollout Notes
- Apply `prisma/migrations/20260327123000_async_proof_pack_and_audit_snapshots/migration.sql` before rolling out the code.
- Treat the current async implementation as best-effort background work only; it is not yet crash-resilient.

## 2026-03-27 07:55 ICT

- Goal: Clear the failing PR CI jobs before merge.
- What changed:
  - `prisma/migrations/20260327123000_async_proof_pack_and_audit_snapshots/migration.sql`
    - Changed `audit_entry_snapshots.audit_entry_id` from `UUID` to `TEXT` so it matches the existing `audit_entries.id` column type created by the initial schema migration.
- CI/debug evidence:
  - `gh run view 23625103693 --job 68812547403 --log-failed`
  - `gh run view 23625103693 --job 68812547413 --log-failed`
  - Both failing jobs showed the same Prisma `P3018` migration error with Postgres detail: `Key columns "audit_entry_id" and "id" are of incompatible types: uuid and text.`
- Validation:
  - `npm run test -- --runInBand src/common/audit/audit.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/lane/lane.service.spec.ts src/modules/lane/lane-timeline.spec.ts` -> passed.
  - `npx prisma migrate reset --force` could not be completed locally because the configured local Postgres at `localhost:5433` was not running in this shell environment.
- Follow-up:
  - Push the amended branch and let GitHub rerun the migration jobs against CI’s clean Postgres service before merging.

## 2026-03-27 09:38 ICT

- Goal: Remove the known async proof-pack recovery gap so crashed or restarted workers do not leave packs stuck in `GENERATING` forever.
- What changed:
  - `src/modules/evidence/proof-pack.types.ts`
    - Extended `ProofPackStore` with `findStaleGeneratingPacks(olderThan)` so the service can reconcile orphaned in-flight rows without changing the pack schema.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Implemented `findStaleGeneratingPacks(...)` as a `status = 'GENERATING' AND generated_at <= cutoff` query ordered oldest-first.
  - `src/modules/evidence/proof-pack.service.ts`
    - `ProofPackService` now implements Nest lifecycle hooks and starts a recovery timer on module init.
    - Added startup + periodic reconciliation that marks stale `GENERATING` packs `FAILED`, writes a system audit entry, and logs a warning.
    - Added env-tunable defaults for the stale timeout (`PROOF_PACK_GENERATING_TIMEOUT_MS`, default 5 minutes) and recovery sweep interval (`PROOF_PACK_RECOVERY_INTERVAL_MS`, default 60 seconds).
    - Clears the recovery timer on module destroy so boot/shutdown stays clean.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Added RED/GREEN coverage for startup reconciliation and interval-based stale-pack cleanup.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
    - Failed because `service.onModuleInit` did not exist, so stale `GENERATING` packs had no recovery path.
  - GREEN: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`
    - Passed after the lifecycle-based stale-pack sweeper was implemented.
  - GREEN: `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts`
    - Proof-pack route wiring still passed with the new module-init behavior active.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts` -> passed (`18 passed, 18 total`).
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts` -> passed (`6 passed, 6 total`).
  - `npm run typecheck` -> passed.
  - `npm run lint` -> passed.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `ProofPackService` remains provided directly by `EvidenceModule`, so Nest now runs the new `onModuleInit`/`onModuleDestroy` hooks at app boot/shutdown.
  - `EvidenceController.enqueuePackGeneration(...)` still routes pack creation through `ProofPackService.generatePack(...)`; the recovery path only touches previously orphaned `GENERATING` rows.
  - `GET /packs/:id`, `GET /packs/:id/download`, and `GET /packs/:id/verify` continue to rely on the same `READY`/`FAILED` gating, but stale rows now transition out of `GENERATING` automatically.
- Behavior changes and risk notes:
  - A process crash/restart no longer leaves stale proof packs permanently in `GENERATING`; after the timeout window, the next reconciliation pass marks them `FAILED` with an explicit regeneration message.
  - This is recovery, not durable retry. The original template payload is still not persisted, so stale packs fail closed and must be regenerated by a caller.
  - Multi-instance deployments still need a durable queue/lease design if proof-pack work starts running concurrently across workers; the current timeout-based sweeper is aimed at single-worker crash recovery.
- Follow-ups / known gaps:
  - A durable queue/worker remains the stronger long-term design if proof-pack generation throughput or multi-instance scaling becomes a requirement.
  - Add an integration test against a real Postgres-backed store if you want to prove the stale cutoff query and reconciliation loop together outside the mocked service layer.

## Review (2026-03-27 09:39:00 +07) - working-tree (stale proof-pack recovery slice)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git diff -- src/modules/evidence/proof-pack.types.ts src/modules/evidence/proof-pack.pg-store.ts src/modules/evidence/proof-pack.service.ts src/modules/evidence/proof-pack.service.spec.ts docs/PROGRESS.md 'coding-logs/2026-03-27-05-36-00 Coding Log (proof-pack-critical-fixes).md'`; `nl -ba src/modules/evidence/proof-pack.service.ts | sed -n '1,260p'`; `nl -ba src/modules/evidence/proof-pack.pg-store.ts | sed -n '1,240p'`; `nl -ba src/modules/evidence/proof-pack.service.spec.ts | sed -n '500,570p'`; `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts`; `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts`; `npm run typecheck`; `npm run lint`; `npm run build`

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
- Assumed timeout-based failure recovery is acceptable for now because proof-pack template inputs are still not persisted for durable retry.
- Assumed the current deployment model does not yet require cross-worker leasing for proof-pack generation ownership.

### Recommended Tests / Validation
- Add a Postgres-backed integration test for `findStaleGeneratingPacks(...)` plus reconciliation if this path starts carrying more operational weight.
- Add a multi-worker concurrency test if proof-pack generation is later deployed on more than one active backend instance.

### Rollout Notes
- The new recovery path is fail-closed: stale packs become `FAILED` and require explicit regeneration rather than silent retry.
- Tune `PROOF_PACK_GENERATING_TIMEOUT_MS` and `PROOF_PACK_RECOVERY_INTERVAL_MS` if real pack rendering latency or deployment topology changes.

## 2026-03-27 11:41 ICT

- Goal: Replace the stopgap stale-pack sweeper with a durable proof-pack job system that survives restart, retries safely, exposes basic operational metrics, and proves restart recovery against real Postgres + Nest boot.
- What changed:
  - `prisma/schema.prisma`
    - Added `ProofPackJobStatus` and the `ProofPackJob` model with persisted payload, lease fields, retry state, and completion timestamps.
  - `prisma/migrations/20260327155000_proof_pack_job_queue/migration.sql`
    - Created `proof_pack_job_status`, created `proof_pack_jobs`, indexed queue/lease lookups, and failed legacy `GENERATING` packs during migration so pre-queue rows do not stay orphaned.
  - `src/modules/evidence/proof-pack.types.ts`
    - Extended the proof-pack contracts with durable job records, claimed-job shape, metrics DTO, and queue/store operations.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Replaced the old fire-and-forget pack persistence path with transactional `enqueuePack(...)`, DB-backed leasing, heartbeat renewal, retry requeue, completion/failure transitions, and aggregate metrics queries.
  - `src/modules/evidence/proof-pack.service.ts`
    - `generatePack(...)` now persists the pack row and job payload only.
    - Added `completeLeasedJob(...)` and `failLeasedJob(...)` so worker-owned execution drives rendering/upload/finalization.
    - Added `appendPackAuditSafely(...)` so post-commit audit write failures do not incorrectly requeue already-generated artifacts.
  - `src/modules/evidence/proof-pack.worker.ts`
    - Added the in-process worker provider that polls, leases, heartbeats, retries expired work, permanently fails exhausted jobs, and emits metrics/alert logs.
  - `src/modules/evidence/evidence.module.ts`
    - Registered `ProofPackWorkerService` so the worker boots with the evidence module.
  - `src/modules/evidence/evidence.controller.ts`
    - Added `GET /packs/jobs/metrics` guarded to `ADMIN` and `AUDITOR`.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Reworked service coverage around queue enqueue, leased completion, retryable failures, and terminal failures instead of `setImmediate(...)` background work.
  - `src/modules/evidence/proof-pack.worker.spec.ts`
    - Added worker-level tests for lease/complete, backoff/requeue, retry exhaustion, heartbeat renewal, and metrics alerts.
  - `test/proof-pack.e2e-spec.ts`
    - Added the worker provider override and coverage for the new metrics route.
  - `test/proof-pack-worker.e2e-spec.ts`
    - Added a real Postgres-backed Nest restart test proving an expired `PROCESSING` job is reclaimed and completed after reboot.
  - `src/common/audit/audit.prisma-store.ts`
    - Fixed a surfaced raw-store bug by explicitly inserting `audit_entries.id`; the restart integration test uncovered that the DB schema did not supply a default at SQL level.
  - `docs/PROGRESS.md`
    - Recorded the durable-queue milestone and current residual hardening notes.
- TDD evidence:
  - RED: `npm run test -- --runInBand src/modules/evidence/proof-pack.worker.spec.ts`
    - Failed before the worker existed because the new queue/lease/retry expectations had no implementation.
  - RED: `npm run test:e2e -- --runInBand test/proof-pack-worker.e2e-spec.ts`
    - Failed after the first worker pass because raw audit insertion omitted `audit_entries.id`, which caused pack completion to error after the pack/job transaction and prevented clean restart recovery.
  - GREEN: `npm run test -- --runInBand src/common/audit/audit.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts`
    - Passed after the queue worker/store/service contracts and the audit-store fix were in place.
  - GREEN: `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts test/proof-pack-worker.e2e-spec.ts`
    - Passed after wiring the worker provider, metrics route, and real restart recovery path.
- Tests run and results:
  - `npm run db:generate` -> passed.
  - `docker compose up -d postgres` -> local Postgres container started for the real restart test.
  - `npx prisma migrate deploy` -> passed.
  - `npm run test -- --runInBand src/common/audit/audit.service.spec.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts` -> passed.
  - `npm run test:e2e -- --runInBand test/proof-pack.e2e-spec.ts test/proof-pack-worker.e2e-spec.ts` -> passed.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `EvidenceModule` now provides `ProofPackWorkerService`, so Nest starts polling on module init when `PROOF_PACK_WORKER_ENABLED` is not `false`.
  - `EvidenceController.getPackJobMetrics(...)` routes through `ProofPackWorkerService.getJobMetrics()` and is protected by `JwtAuthGuard`, `RolesGuard`, and `@Roles('ADMIN', 'AUDITOR')`.
  - `ProofPackService.generatePack(...)` now writes durable queue state only; runtime completion flows through `ProofPackWorkerService -> ProofPackService.completeLeasedJob(...) -> PrismaProofPackStore.completePackJob(...)`.
  - Recovery on restart is now driven by `leaseNextJob(...)` reclaiming expired `PROCESSING` rows rather than by age-based failure sweeping.
- Behavior changes and risk notes:
  - Proof-pack generation is now retry-safe within the app process model: queue payloads survive restart, expired leases are reclaimed, and retry exhaustion fails closed with an explicit pack error.
  - Metrics and alerts are intentionally minimal today: they are app-level aggregates/log warnings, not external monitoring integrations.
  - This is durable queueing in Postgres, but it is still an in-process worker. There is no separate worker deployment, dead-letter transport, or out-of-band alert sink yet.
  - The integration work exposed a real schema/runtime mismatch in the audit raw store; fixing it here also hardens other real Postgres audit writes.
- Follow-ups / known gaps:
  - If proof-pack volume grows, split worker execution into a dedicated deployment or queue consumer instead of sharing the web process.
  - Add richer alert delivery and dashboards if operations need paging rather than log-based visibility.
  - Consider lane-level dedupe or uniqueness constraints if concurrent same-pack generation becomes a real race.

## 2026-03-27 11:45 ICT

- Goal: Close the lease-fencing gap found during skeptical review so a stale worker cannot complete, fail, or requeue a proof-pack job after another worker has reclaimed the lease.
- What changed:
  - `src/modules/evidence/proof-pack.types.ts`
    - Extended the lease-sensitive store methods to require the caller’s expected `leaseExpiresAt` token.
  - `src/modules/evidence/proof-pack.pg-store.ts`
    - Added compare-and-swap guards on `renewJobLease(...)`, `completePackJob(...)`, `requeueJob(...)`, and `failPackJob(...)` so they only mutate rows when the worker still owns the active lease.
  - `src/modules/evidence/proof-pack.service.ts`
    - `completeLeasedJob(...)` and `failLeasedJob(...)` now surface lost-lease conflicts instead of silently finalizing work against a reclaimed job.
  - `src/modules/evidence/proof-pack.worker.ts`
    - Tracks the current lease token across heartbeats and skips stale completion/requeue/failure paths when lease ownership changes.
  - `src/modules/evidence/proof-pack.service.spec.ts`
    - Added regression coverage for lost-lease completion/failure behavior and updated expectations for the new CAS token arguments.
  - `src/modules/evidence/proof-pack.worker.spec.ts`
    - Added regression coverage proving a stale worker does not requeue or fail a job after losing lease ownership.
- TDD evidence:
  - RED: not captured as a standalone failing run. The issue surfaced in `g-check` review because the initial queue implementation keyed completion/requeue/failure by `jobId` only, which allows stale workers to mutate reclaimed jobs under lease-expiry races.
  - GREEN: `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts`
    - Passed with the new lease-fencing regression coverage in place.
  - GREEN: `npm run test:e2e -- --runInBand test/proof-pack-worker.e2e-spec.ts`
    - Restart recovery still passes with the CAS lease checks enabled.
- Tests run and results:
  - `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts` -> passed.
  - `npm run test:e2e -- --runInBand test/proof-pack-worker.e2e-spec.ts` -> passed.
  - `npm run lint` -> passed.
  - `npm run typecheck` -> passed.
  - `npm run build` -> passed.
- Wiring verification evidence:
  - `ProofPackWorkerService` now passes the active lease token into heartbeat renewal and retry/failure paths, so the runtime worker loop enforces lease ownership all the way through completion.
  - `PrismaProofPackStore` now guards every lease-owned mutation with `status = 'PROCESSING' AND lease_expires_at = <expected-token>`, which is the effective fence against stale workers.
- Behavior changes and risk notes:
  - A reclaimed job can no longer be finalized or requeued by the prior worker after lease loss; stale workers now log and exit that path.
  - This is fencing via the persisted lease-expiry token. It prevents stale updates without adding another migration, but a dedicated lease version/token column would still be a cleaner long-term primitive if the queue grows more complex.
- Follow-ups / known gaps:
  - The worker still runs in-process with the API server; durable queueing is fixed, but operational isolation is still a future scaling step.

## Review (2026-03-27 11:46:00 +07) - working-tree (durable proof-pack queue slice)

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl`
- Branch: `main`
- Scope: `working-tree`
- Commands Run: `git status --short`; `git diff -- src/modules/evidence/proof-pack.types.ts src/modules/evidence/proof-pack.pg-store.ts src/modules/evidence/proof-pack.service.ts src/modules/evidence/proof-pack.worker.ts src/modules/evidence/evidence.controller.ts src/modules/evidence/evidence.module.ts src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts test/proof-pack.e2e-spec.ts test/proof-pack-worker.e2e-spec.ts prisma/schema.prisma prisma/migrations/20260327155000_proof_pack_job_queue/migration.sql src/common/audit/audit.prisma-store.ts docs/PROGRESS.md`; `nl -ba src/modules/evidence/proof-pack.worker.ts | sed -n '96,250p'`; `nl -ba src/modules/evidence/proof-pack.pg-store.ts | sed -n '368,520p'`; `nl -ba src/modules/evidence/proof-pack.service.spec.ts | sed -n '286,390p'`; `nl -ba src/modules/evidence/proof-pack.worker.spec.ts | sed -n '116,240p'`; `npm run test -- --runInBand src/modules/evidence/proof-pack.service.spec.ts src/modules/evidence/proof-pack.worker.spec.ts`; `npm run test:e2e -- --runInBand test/proof-pack-worker.e2e-spec.ts`; `npm run lint`; `npm run typecheck`; `npm run build`

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
- Assumed the current queue remains intentionally in-process and that a separate worker deployment is a follow-up, not a blocker for this slice.
- Assumed log-based alerting is sufficient for now because the task asked for metrics and alerts, not external paging integration.

### Recommended Tests / Validation
- Add a focused multi-worker concurrency test if proof-pack processing is deployed on more than one active backend instance.
- Add a failure-path integration test that proves retry exhaustion transitions both the job and pack to terminal `FAILED` state under real Postgres wiring.

### Rollout Notes
- Apply `prisma/migrations/20260327155000_proof_pack_job_queue/migration.sql` before enabling the durable worker in shared environments.
- The queue is now restart-safe and lease-fenced, but it still relies on the web process to execute jobs; monitor render latency before increasing queue volume.
