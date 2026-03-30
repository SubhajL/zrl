# Coding Log: Domain Errors + CI Enforcement + Session Summary

## 2026-03-30 15:00 ICT

- Goal: Implement team lead follow-up PRs (domain errors in transition policy, CI enforcement for Prisma, pg-store conventions) and close out the session.

- What changed:
  - `src/modules/lane/lane.transition-policy.ts` — Removed NestJS exceptions. Functions now return `TransitionViolation | null` (typed result with code + message) instead of throwing. Zero `@nestjs/common` imports — the policy is framework-independent.
  - `src/modules/lane/lane.transition-policy.spec.ts` — Updated 12 tests for new return-value API (was throw-based).
  - `src/modules/lane/lane.service.ts` — Added `throwIfViolation()` private method that translates `TransitionViolation` to HTTP exceptions (INVALID_TRANSITION → 409, GUARD_FAILED → 422). HTTP responses unchanged.
  - `scripts/check-prisma-runtime.sh` — New CI enforcement script: fails if `PrismaClient` imported in `src/` (enforces ADR-0001).
  - `CLAUDE.md` — Added pg-store conventions section documenting the standard store pattern.
  - `test/rules-engine.e2e-spec.ts` — Fixed pre-existing CI bug: added `CERTIFICATION_EXPIRY_WORKER_ENABLED=false` to prevent worker crash in mocked e2e tests.

## Session Summary (2026-03-30)

### PRs Merged This Session

| #   | Title                                                     | Type                |
| --- | --------------------------------------------------------- | ------------------- |
| 47  | Backend analytics module (5 PRD endpoints)                | Feature             |
| 48  | WS disconnect on auth failure + dead param removal + CORS | Fix                 |
| 50  | WS Redis adapter + validation + logging + metrics         | Refactor            |
| 51  | Frontend WebSocket client (hooks, context, live events)   | Feature             |
| 52  | Coding log update                                         | Docs                |
| 53  | TanStack Query integration (caching, auto-refetch)        | Feature             |
| 54  | Break Lane↔Evidence forwardRef cycle                      | Refactor (A1)       |
| 55  | Extract LaneTransitionPolicy + persistence docs           | Refactor (A2+A3)    |
| 56  | M4 Dispute Shield (claim CRUD, defense pack generation)   | Feature (Task 16)   |
| 59  | M5 MRV-Lite (carbon footprint, ESG reporting)             | Feature (Task 17)   |
| 60  | Domain errors + CI enforcement + pg-store docs            | Refactor (PR 2+4+5) |

### Architectural Health Completed

- A1: Lane↔Evidence cycle broken (LaneReconciler + CheckpointEvidenceController)
- A2: LaneTransitionPolicy extracted (pure functions, framework-independent)
- A3: Persistence strategy documented (CLAUDE.md + ADR-0001)

### Test Count Progression

- Session start: 264 backend + 139 frontend
- Session end: 307 backend + 172 frontend = 479 total tests
