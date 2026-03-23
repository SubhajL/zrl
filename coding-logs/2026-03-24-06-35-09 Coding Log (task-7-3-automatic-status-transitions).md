## Plan Draft A

### Overview
Implement Task 7.3 by extending the lane lifecycle logic with a lane-owned automatic transition method and calling it from evidence upload after completeness is recomputed. Keep the change additive: no schema changes, no new public endpoint, and no notification/workflow expansion beyond automatic lane status reevaluation.

### Files To Change
- `src/modules/lane/lane.service.ts`
  - add automatic transition reconciliation logic driven by current lane status and completeness score.
- `src/modules/lane/lane.service.spec.ts`
  - add RED/GREEN coverage for automatic transitions from `EVIDENCE_COLLECTING` and `INCOMPLETE`.
- `src/modules/evidence/evidence.module.ts`
  - import `LaneModule` and inject `LaneService` into `EvidenceService`.
- `src/modules/evidence/evidence.service.ts`
  - invoke lane automatic-transition reconciliation after completeness score sync on upload.
- `src/modules/evidence/evidence.service.spec.ts`
  - add RED/GREEN coverage proving upload triggers automatic lifecycle reconciliation only after completeness sync.
- `docs/PROGRESS.md`
  - append a terse Task 7.3 progress note.

### Function Names And Behavior
- `LaneService.reconcileAutomaticTransitions(laneId, actorId)`
  - load the lane, evaluate whether an automatic lifecycle move is warranted, and apply one or more safe transitions with audit entries.
- `LaneService.getAutomaticTransitionTarget(lane)`
  - return the next automatic target for the current lane state, or `null` if none applies.
- `LaneService.applyAutomaticTransition(previousLane, targetStatus, actorId)`
  - persist the lane status change and append the same transition audit shape used by manual transitions.
- `EvidenceService.persistArtifact(...)`
  - after the lane completeness score is recomputed and written, call the lane automatic-transition reconciler for the same lane and actor.

### Test Coverage
- `src/modules/lane/lane.service.spec.ts`
  - `reconcileAutomaticTransitions validates evidence-collecting lanes once completeness reaches threshold`
    - auto-promotes lanes already ready for validation.
  - `reconcileAutomaticTransitions moves incomplete lanes back into collecting before validation`
    - remediation path is automatic and ordered.
  - `reconcileAutomaticTransitions is a no-op when no automatic transition applies`
    - stable states are unchanged.
- `src/modules/evidence/evidence.service.spec.ts`
  - `uploadArtifact triggers automatic lane lifecycle reconciliation after completeness sync`
    - evidence upload drives lane reevaluation through the new lane hook.
  - `uploadArtifact does not call automatic transition reconciliation when the lane has no rules`
    - keeps the existing fail-closed completeness-sync boundary.

### Success Criteria
- Evidence upload can automatically move a lane from `EVIDENCE_COLLECTING` to `VALIDATED` once completeness reaches `95`.
- Remediated `INCOMPLETE` lanes automatically return to `EVIDENCE_COLLECTING`, and if still complete, continue to `VALIDATED`.
- Each automatic transition creates the same audit semantics as manual transitions.
- No schema change or new endpoint is introduced.

### Risks / Failure Modes
- Cross-module wiring could break if `EvidenceModule` does not import `LaneModule`.
- Automatic transitions could skip too far if reconciliation loops are not bounded.
- Partner uploads must still be allowed to trigger automatic transitions without lane-ownership rejection in the internal lifecycle path.

### Validation
- `npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `LaneService.reconcileAutomaticTransitions()` | `EvidenceService.persistArtifact()` after completeness sync | `src/modules/evidence/evidence.module.ts` injects `LaneService`; `src/modules/lane/lane.module.ts` exports it | `lanes.status`, `lanes.status_changed_at` |
| automatic lane transition audit path | `LaneService.reconcileAutomaticTransitions()` | existing `LaneService` + `AuditService` provider wiring in `LaneModule` | `audit_entries` |

## Plan Draft B

### Overview
Implement Task 7.3 with a smaller seam by extracting a lane-lifecycle helper service dedicated to automatic transitions and injecting that helper into `EvidenceService`. Keep manual and automatic transition entry points separate while reusing the same guard and audit helpers underneath.

### Files To Change
- `src/modules/lane/lane.service.ts`
- `src/modules/lane/lane.module.ts`
- `src/modules/evidence/evidence.module.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/lane/lane.service.spec.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `docs/PROGRESS.md`

### Tradeoffs
- Better separation between manual and automatic orchestration.
- More wiring overhead for a repo that currently keeps lifecycle logic directly in `LaneService`.
- Higher risk of introducing extra provider/factory complexity without much product benefit.

## Unified Execution Plan

### Overview
Finish Task 7.3 by keeping lifecycle logic in `LaneService` and adding one explicit automatic-transition reconciler that `EvidenceService` calls after it recomputes lane completeness. This keeps the implementation aligned with current module scale, avoids a new helper service, and gives the product the automatic state movement that Task 7.3 actually needs now.

### Files To Change
- `src/modules/lane/lane.service.ts`
- `src/modules/lane/lane.service.spec.ts`
- `src/modules/evidence/evidence.module.ts`
- `src/modules/evidence/evidence.service.ts`
- `src/modules/evidence/evidence.service.spec.ts`
- `docs/PROGRESS.md`

### Non-Goals
- No notification delivery or alert scheduling.
- No proof-pack-triggered automatic `PACKED` transition yet.
- No schema migration unless implementation proves one is unavoidable.
- No new HTTP endpoint.

### Concrete Design Decisions
- Treat “auto-move `CREATED -> EVIDENCE_COLLECTING` on creation” as already satisfied by current lane creation, which persists new lanes directly as `EVIDENCE_COLLECTING`.
- Add `LaneService.reconcileAutomaticTransitions(laneId, actorId)` as the lane-owned internal lifecycle hook.
- Allow the automatic reconciler to apply at most the safe chain implied by current state:
  - `INCOMPLETE -> EVIDENCE_COLLECTING`
  - `EVIDENCE_COLLECTING -> VALIDATED` when completeness `>= 95`
- Reuse the existing transition graph, guard checks, and audit payload semantics.
- Call the reconciler only after `EvidenceService` has persisted the artifact and updated `lanes.completeness_score`.

### Function / Test Outline
- `LaneService.reconcileAutomaticTransitions(laneId, actorId)`
  - fetch lane, compute automatic target, transition, refetch, and continue until no further automatic target remains.
- `LaneService.getAutomaticTransitionTarget(lane)`
  - return `EVIDENCE_COLLECTING` for `INCOMPLETE` lanes whose completeness is now sufficient; return `VALIDATED` for `EVIDENCE_COLLECTING` lanes whose completeness is sufficient; otherwise return `null`.
- `LaneService.transitionInternally(previousLane, targetStatus, actorId)`
  - shared internal path that persists status and writes transition audit without exporter-ownership checks.
- `EvidenceService.persistArtifact(...)`
  - after `updateLaneCompletenessScore(...)`, call `laneService.reconcileAutomaticTransitions(lane.id, actor.id)`.

### TDD Sequence
1. Add failing lane-service tests for automatic `EVIDENCE_COLLECTING -> VALIDATED`, `INCOMPLETE -> EVIDENCE_COLLECTING -> VALIDATED`, and no-op behavior.
2. Add failing evidence-service tests proving upload invokes the lane reconciler after completeness sync.
3. Implement the lane reconciler and evidence wiring.
4. Run focused RED/GREEN suites.
5. Run lint, typecheck, full tests, and build.
6. Run formal `g-check` before commit.

### Validation
- `npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `LaneService.reconcileAutomaticTransitions()` | `EvidenceService.persistArtifact()` after completeness sync | `src/modules/lane/lane.module.ts` exports `LaneService`; `src/modules/evidence/evidence.module.ts` imports `LaneModule` and injects `LaneService` | `lanes.status`, `lanes.status_changed_at` |
| automatic lifecycle audit path | `LaneService.reconcileAutomaticTransitions()` | existing `AuditService` injection in `LaneModule` | `audit_entries` |
| evidence-triggered lifecycle reevaluation | `POST /lanes/:id/evidence`, partner artifact uploads | existing `EvidenceController` routes through `EvidenceService` in `EvidenceModule` | `evidence_artifacts`, `lanes` |

## Implementation Summary (2026-03-24 06:41 +07)

### Goal
Finish Task 7.3 by making lane lifecycle progression react automatically to evidence uploads once Task 9's completeness score is refreshed, while preserving Task 7's guard and audit semantics.

### What Changed
- `src/modules/lane/lane.service.ts`
  - Added `reconcileAutomaticTransitions(laneId, actorId)` to loop through safe automatic lifecycle moves using the existing transition graph, guards, and audit append path.
  - Added `getAutomaticTransitionTarget(lane)` to drive `INCOMPLETE -> EVIDENCE_COLLECTING -> VALIDATED` when completeness is already at or above the validation threshold.
- `src/modules/lane/lane.service.spec.ts`
  - Added RED/GREEN coverage for automatic validation, automatic remediation back into collecting, and no-op behavior for stable states.
- `src/modules/evidence/evidence.module.ts`
  - Imported `LaneModule` and injected `LaneService` into `EvidenceService` so the evidence upload runtime path can trigger lifecycle reconciliation.
- `src/modules/evidence/evidence.service.ts`
  - Called lane automatic-transition reconciliation after the artifact transaction updates `lanes.completeness_score`.
  - During skeptical review, tightened the upload path so post-commit reconciliation failures are logged and do not enter the object-store cleanup path.
- `src/modules/evidence/evidence.service.spec.ts`
  - Added RED/GREEN coverage proving uploads trigger automatic reconciliation only when rule snapshots exist.
  - Added regression coverage proving a post-commit reconciliation failure does not delete the already-committed evidence object or fail the upload response.
- `docs/PROGRESS.md`
  - Added the Task 7.3 progress entry.

### TDD Evidence
- RED
  - `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
    - Failed with `service.reconcileAutomaticTransitions is not a function`.
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
    - Failed because `laneService.reconcileAutomaticTransitions` was never called after completeness sync.
- GREEN
  - `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/lane/lane.service.spec.ts`
  - `for i in 1 2 3; do npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts; done`
- Review-driven regression
  - No separate RED command was recorded for the post-commit cleanup bug. The issue was found during skeptical diff review, then locked in with `uploadArtifact preserves the committed artifact when automatic lane reconciliation fails`.

### Tests Run
- `npm install`
- `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`
- `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`
- `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/lane/lane.service.spec.ts`
- `for i in 1 2 3; do npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts; done`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Wiring Verification Evidence
- `EvidenceService.persistArtifact()` now calls `reconcileLaneTransitionsAfterUpload()` after completeness sync, which delegates to `LaneService.reconcileAutomaticTransitions()` when the lane has a rule snapshot.
- `EvidenceModule` imports `LaneModule` and injects `LaneService` into the `EvidenceService` factory, so the new hook is on the real Nest runtime path rather than test-only wiring.
- `LaneService.reconcileAutomaticTransitions()` reuses `transitionLaneStatus()` plus `appendTransitionAuditEntry()`, so automatic moves keep the same persistence and audit semantics as manual transitions.

### Behavior Changes / Risks
- Evidence uploads now auto-promote complete lanes instead of waiting for a separate manual transition call.
- Remediated `INCOMPLETE` lanes can return to `EVIDENCE_COLLECTING` and continue directly into `VALIDATED` within the same reconciliation loop.
- Automatic reconciliation is intentionally fail-open after the artifact transaction commits. If reconciliation fails, the upload still succeeds, the object stays in storage, and the lane remains in its prior state until a later upload or manual lifecycle action retries the transition.

### Follow-ups / Known Gaps
- This does not add proof-pack-triggered automatic `PACKED` transitions; that still belongs with proof-pack generation work.
- There is still no dedicated end-to-end test that exercises real evidence upload plus real lane persistence without service overrides; build and full-suite coverage verify wiring, but the runtime transition path is still unit-tested at the service boundary.

## Review (2026-03-24 06:41 +07) - working-tree

### Reviewed
- Repo: `/Users/subhajlimanond/dev/zrl-task-7-3`
- Branch: `feature/task-7-3-automatic-status-transitions`
- Scope: working-tree
- Commits Reviewed: working tree on base `d57d0f8`
- Commands Run: `git status --porcelain=v1`; `git diff --staged --name-only`; `git diff --staged`; `npm test -- --runInBand src/modules/lane/lane.service.spec.ts`; `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts`; `npm test -- --runInBand src/modules/evidence/evidence.service.spec.ts src/modules/lane/lane.service.spec.ts`; `for i in 1 2 3; do npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts; done`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`

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
- Assumed Task 7.3's `CREATED -> EVIDENCE_COLLECTING` requirement is already satisfied because lane creation persists new lanes directly as `EVIDENCE_COLLECTING`.
- Assumed post-commit automatic reconciliation should fail open for uploads; if reconciliation fails, the lane can be retried on a later upload or via an explicit lifecycle action.

### Recommended Tests / Validation
- `npm test -- --runInBand src/modules/lane/lane.service.spec.ts src/modules/evidence/evidence.service.spec.ts`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Rollout Notes
- No schema or env changes.
- Automatic lifecycle movement is now triggered by evidence upload after completeness recomputation.
- Reconciliation failures are logged and do not roll back or delete already-committed evidence objects.
