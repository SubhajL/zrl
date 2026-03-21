# Coding Log

## Plan Draft A

### Overview
Implement a shared NestJS `HashingService` inside `src/common/hashing` that provides deterministic SHA-256 hashing for strings, buffers, streams, and audit-entry hash chains. Keep the service wired through `HashingModule`, align the canonical audit-chain algorithm with `prisma/seed.ts`, and cover the critical behavior with colocated unit tests.

### Files To Change
- `src/common/hashing/hashing.module.ts`: register and export the shared provider.
- `src/common/hashing/hashing.service.ts`: implement hashing APIs and audit-chain verification.
- `src/common/hashing/hashing.constants.ts`: centralize the genesis-hash seed and shared constants.
- `src/common/hashing/hashing.types.ts`: define the audit-entry input/output contracts used by the service and tests.
- `src/common/hashing/hashing.service.spec.ts`: unit tests for deterministic hashing, stream parity, and chain verification.
- `prisma/seed.ts`: reuse the canonical chain helpers/constants instead of open-coded hash concatenation.

### Implementation Steps
1. TDD sequence:
   1) Add `hashing.service.spec.ts` with tests for `hashBuffer`, `hashString`, `hashFile`, `computeEntryHash`, and `verifyChain`.
   2) Run the focused unit test command and confirm failure because the service/files do not exist yet.
   3) Add the service/types/constants and wire the provider through `HashingModule`.
   4) Update `prisma/seed.ts` to import the canonical helpers so seed data and runtime code share the same algorithm.
   5) Run focused tests, then relevant format/lint/typecheck/full-test gates.
2. `hashBuffer(buffer: Buffer): string`
   Return the lowercase hex SHA-256 digest for a buffer using Node `crypto`.
3. `hashString(content: string): Promise<string>`
   Hash UTF-8 string input using the same digest path as `hashBuffer`.
4. `hashFile(stream: NodeJS.ReadableStream): Promise<string>`
   Stream file content into the digest without buffering the whole payload in memory; reject on stream errors.
5. `computeEntryHash(entry: HashChainEntryInput): string`
   Canonically concatenate `timestamp + actor + action + entityType + entityId + payloadHash + prevHash`, then hash it.
6. `verifyChain(entries: HashChainEntry[]): { valid: boolean; firstInvalidIndex?: number }`
   Walk the chain in order, recompute each entry hash, verify `prevHash` continuity, and stop at the first broken entry.
7. `verifyArtifactHash(...)`
   Implement a minimal generic verifier that accepts a stream factory callback and stored hash. This keeps the method usable now without inventing S3 integration before Task 10.

### Test Coverage
- `hashBuffer returns deterministic lowercase sha256 digest`
  Same input yields stable lowercase hex.
- `hashString hashes unicode content consistently`
  Thai and mixed unicode content stay deterministic.
- `hashFile matches hashBuffer for streamed content`
  Streaming and in-memory digests match.
- `hashFile rejects when the stream errors`
  Stream failures fail closed.
- `computeEntryHash matches canonical audit concatenation`
  Seed/runtime chain algorithm stays identical.
- `verifyChain succeeds for a valid multi-entry chain`
  Valid chains report success.
- `verifyChain reports first invalid entry hash`
  Tampered entry is identified precisely.
- `verifyChain reports first broken prevHash linkage`
  Broken linkage is identified precisely.

### Decision Completeness
- Goal:
  Ship the foundational SHA-256 hashing service required by evidence and audit flows, with canonical audit-chain logic shared by runtime and seed data.
- Non-goals:
  No S3 adapter, no evidence upload endpoint, no audit persistence service, no new HTTP surface.
- Success criteria:
  `HashingModule` exports a working provider, focused unit tests cover the core APIs, `prisma/seed.ts` uses the same canonical chain algorithm, and backend gates pass.
- Public interfaces:
  New service API under `src/common/hashing`: `hashBuffer`, `hashString`, `hashFile`, `computeEntryHash`, `verifyArtifactHash`, `verifyChain`.
- Edge cases / failure modes:
  Empty input hashes normally; unicode input uses UTF-8; stream errors reject; malformed chain data fails closed by returning `valid: false`.
- Rollout & monitoring:
  No feature flag or migration required. Risk is limited to common hashing consumers and seed determinism; watch for seed drift and failing unit tests.
- Acceptance checks:
  `npm run test -- --runInBand hashing.service.spec.ts`
  `npm run typecheck`
  `npm run lint`
  `npm run test`

### Dependencies
- Node `crypto` and `stream`, already available.
- Existing NestJS DI wiring through `AppModule`.

### Validation
- Focused hashing tests pass.
- Full backend unit test suite still passes.
- `prisma/seed.ts` compiles and uses the same shared hashing helpers.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `HashingService` | direct DI into future evidence/audit services and immediate use from `prisma/seed.ts` helper imports | `src/common/hashing/hashing.module.ts`, already imported by `src/app.module.ts` | N/A |
| hash constants/types | imported by `HashingService` and `prisma/seed.ts` | local file imports under `src/common/hashing/*` | N/A |
| canonical seed usage | `prisma db seed` | `prisma/seed.ts` imports from hashing module files | `audit_entries`, `evidence_artifacts`, `proof_packs` hash columns already exist |

### Cross-Language Schema Verification
Not a multi-language schema change. Existing relevant tables are `audit_entries`, `evidence_artifacts`, and `proof_packs` in Prisma only.

### Decision-Complete Checklist
- No open API decisions remain.
- No new endpoint/env/migration is introduced.
- Every behavior change has a direct unit test target.
- Validation commands are concrete and repo-valid.
- Wiring coverage includes DI module wiring and seed usage.
- No rollout/backout work is needed beyond reverting the service files.

## Plan Draft B

### Overview
Implement the hashing logic as pure utility functions plus a thin injectable NestJS facade, minimizing provider state and making `prisma/seed.ts` consume the utilities directly. This reduces framework coupling inside the hashing logic but adds one extra layer of files.

### Files To Change
- `src/common/hashing/hashing.module.ts`: register/export the facade service.
- `src/common/hashing/hashing.service.ts`: thin facade around pure helpers.
- `src/common/hashing/hashing.utils.ts`: all crypto and chain logic.
- `src/common/hashing/hashing.constants.ts`: genesis-hash seed and separators.
- `src/common/hashing/hashing.types.ts`: audit-chain contracts.
- `src/common/hashing/hashing.service.spec.ts`: tests focused on public service behavior.
- `prisma/seed.ts`: import pure helper(s) for canonical chain generation.

### Implementation Steps
1. Write failing service-level tests first.
2. Add pure helpers for buffer/string/stream hashing and chain verification.
3. Add the injectable facade that delegates to the helpers.
4. Repoint `prisma/seed.ts` to pure helpers.
5. Run focused and full quality gates.

### Test Coverage
- `service delegates buffer hashing correctly`
  Public API stays stable.
- `utility stream hash matches utility buffer hash`
  Helper parity is proven.
- `canonical chain helper matches seed expectations`
  Shared chain format stays consistent.
- `verifyChain fails on tampered payload hash`
  Payload tampering is caught.

### Decision Completeness
- Goal:
  Provide framework-safe hashing plus framework-agnostic reusable crypto helpers.
- Non-goals:
  No storage adapter or transport layer.
- Success criteria:
  Public service works, pure helpers are reused by seed logic, tests pass.
- Public interfaces:
  Same service API as Draft A, plus internal utility exports.
- Edge cases / failure modes:
  Same as Draft A, with utilities keeping failures synchronous except stream handling.
- Rollout & monitoring:
  Same as Draft A.
- Acceptance checks:
  Same as Draft A.

### Dependencies
- Same as Draft A.

### Validation
- Same as Draft A.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `HashingService` facade | future DI consumers | `src/common/hashing/hashing.module.ts`, imported by `src/app.module.ts` | N/A |
| pure hashing utils | `HashingService` and `prisma/seed.ts` | direct TypeScript imports | N/A |
| canonical seed usage | `prisma db seed` | `prisma/seed.ts` imports utility helpers | `audit_entries`, `evidence_artifacts`, `proof_packs` |

### Cross-Language Schema Verification
No schema change.

### Decision-Complete Checklist
- Service API decisions are locked.
- Extra utility layer is internal-only.
- Tests cover the behavior that can regress.
- Validation/wiring steps are concrete.

## Comparative Analysis & Synthesis

- Draft A strengths:
  Keeps the design minimal and aligned with the current small scaffold; easier to adopt now.
- Draft A gaps:
  Slightly more framework coupling if non-Nest callers want the same logic.
- Draft B strengths:
  Better separation between Nest DI and pure crypto helpers.
- Draft B gaps:
  Adds file count and indirection before the repo has real consumers.
- Trade-off:
  The repo is early-stage, and the shared logic is still simple. Extra layering now would be premature unless a second runtime consumer already exists.

## Unified Execution Plan

### Overview
Use Draft A’s minimal structure, but keep the crypto logic internally stateless and export a small set of pure helper-friendly types/constants so `prisma/seed.ts` can reuse the canonical chain computation without depending on Nest DI. This preserves simplicity while eliminating the seed/runtime drift risk.

### Files To Change
- `src/common/hashing/hashing.module.ts`: register/export `HashingService`.
- `src/common/hashing/hashing.service.ts`: implement the SHA-256 service with stream and chain verification methods.
- `src/common/hashing/hashing.constants.ts`: define the genesis hash seed constant.
- `src/common/hashing/hashing.types.ts`: define `HashChainEntryInput`, `HashChainEntry`, and verification result types.
- `src/common/hashing/hashing.service.spec.ts`: colocated unit tests for core hashing behavior.
- `prisma/seed.ts`: replace open-coded chain hashing with the shared canonical helper/constants.

### Implementation Steps
1. TDD sequence:
   1) Add/stub `src/common/hashing/hashing.service.spec.ts`.
   2) Run `npm run test -- --runInBand hashing.service.spec.ts` and confirm failure because the service file/provider do not exist.
   3) Implement `HashingService`, types, constants, and provider wiring.
   4) Refactor `prisma/seed.ts` to import and use the canonical chain helper/constants.
   5) Run `npm run format -- src/common/hashing/hashing.module.ts src/common/hashing/hashing.service.ts src/common/hashing/hashing.types.ts src/common/hashing/hashing.constants.ts src/common/hashing/hashing.service.spec.ts prisma/seed.ts`, then `npm run lint`, `npm run typecheck`, focused tests, and full tests.
2. Functions:
   - `hashBuffer(buffer)`
     Deterministic lowercase SHA-256 for in-memory content.
   - `hashString(content)`
     UTF-8 string hashing that reuses the buffer path.
   - `hashFile(stream)`
     Promise-based streaming hash with proper error handling.
   - `computeEntryHash(entry)`
     Canonical audit-entry hashing matching `src/common/audit/CLAUDE.md` and seed data.
   - `verifyArtifactHash(streamFactory, storedHash)`
     Re-hash an artifact from a supplied stream source and compare to the stored digest.
   - `verifyChain(entries)`
     Validate both recomputed entry hashes and `prevHash` linkage, returning the first broken index.
3. Expected behavior / edge cases:
   - All digests are lowercase hex.
   - Empty strings/files hash successfully.
   - Unicode input is stable.
   - Stream errors reject.
   - Invalid chain data fails closed with `valid: false`.

### Test Coverage
- `hashBuffer returns deterministic lowercase sha256 digest`
  Stable digest for repeated buffer input.
- `hashString hashes unicode content consistently`
  Unicode input stays deterministic.
- `hashFile matches hashBuffer for the same content`
  Stream and buffer parity.
- `hashFile rejects when the source stream errors`
  Stream failures reject.
- `computeEntryHash matches the canonical audit concatenation`
  Runtime and seed logic align.
- `verifyArtifactHash returns true for a matching stream digest`
  Positive artifact verification path.
- `verifyArtifactHash returns false for a mismatched stream digest`
  Negative artifact verification path.
- `verifyChain succeeds for a valid chain`
  Valid chain passes.
- `verifyChain reports the first invalid entry hash`
  Tampered entry is located.
- `verifyChain reports the first broken prevHash linkage`
  Broken linkage is located.

### Decision Completeness
- Goal:
  Deliver Task 3’s foundational hashing service with canonical audit-chain computation shared across runtime and seed logic.
- Non-goals:
  No S3 integration, no audit service, no evidence upload endpoint, no schema changes.
- Success criteria:
  `HashingModule` exports an injectable provider, `prisma/seed.ts` uses the shared canonical helper, hashing tests pass with high coverage, and backend quality gates pass.
- Public interfaces:
  Injectable `HashingService` plus exported hashing types/constants used internally by seed/runtime code. No HTTP/API surface changes.
- Edge cases / failure modes:
  Empty content is valid; unicode hashes deterministically; stream failures reject; mismatched digests return `false`; malformed/tampered chains return `{ valid: false, firstInvalidIndex }`. All verification is fail-closed.
- Rollout & monitoring:
  No rollout flag. Main regression vector is seed/runtime drift, mitigated by shared helper imports and unit tests. No backout beyond reverting the touched files.
- Acceptance checks:
  - `npm run test -- --runInBand hashing.service.spec.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test`

### Dependencies
- Existing `HashingModule` import in `src/app.module.ts`.
- Node `crypto` and stream primitives.
- Existing Prisma seed and schema hash fields.

### Validation
- Focused hashing tests pass.
- Full unit suite passes.
- TypeScript and ESLint pass for touched files.
- `prisma/seed.ts` compiles using the shared canonical helpers.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| `HashingService` | future common DI consumers; immediate direct import usage in tests | `src/common/hashing/hashing.module.ts`; module already imported in `src/app.module.ts` | N/A |
| canonical chain helper/constants | `HashingService.computeEntryHash()` and `prisma/seed.ts` | local imports in `src/common/hashing/*` and `prisma/seed.ts` | `audit_entries.prev_hash`, `audit_entries.entry_hash`, `audit_entries.payload_hash` |
| artifact verification helper | future evidence-service S3 stream source | `HashingService` public method | `evidence_artifacts.content_hash`, `proof_packs.content_hash` |

### Cross-Language Schema Verification
Not applicable. Existing Prisma tables only:
- `audit_entries`
- `evidence_artifacts`
- `proof_packs`

### Decision-Complete Checklist
- No open decisions remain for the implementer.
- All public surface changes are listed.
- Every behavior change has a named test.
- Validation commands are concrete and repo-valid.
- Wiring verification covers every new component.
- No deployment-visible rollout work is required.

## 2026-03-21 19:57 ICT

- Goal: Implement Task 3 by adding the shared SHA-256 hashing service, canonical audit-chain helpers, and unit coverage, while eliminating seed/runtime drift in audit hash computation.
- What changed:
  - `src/common/hashing/hashing.module.ts`: registered and exported `HashingService` so the existing `AppModule` import now provides a real injectable provider.
  - `src/common/hashing/hashing.service.ts`: added the injectable service API for buffer, string, stream, artifact, and audit-chain hashing behavior.
  - `src/common/hashing/hashing.utils.ts`: added pure SHA-256 helpers plus canonical chain verification logic reused outside Nest.
  - `src/common/hashing/hashing.constants.ts`: centralized the genesis-hash seed and hash algorithm constant.
  - `src/common/hashing/hashing.types.ts`: defined the shared hash-chain and artifact verification contracts.
  - `src/common/hashing/hashing.service.spec.ts`: added 10 unit tests covering deterministic hashing, unicode, stream parity, stream failure, artifact verification, and chain validation.
  - `prisma/seed.ts`: replaced open-coded hash concatenation with shared helpers so seed-generated audit entries use the same canonical chain logic as runtime code.
  - `.codex/coding-log.current`: pointed to this task-specific coding log per `g-planning` / `g-coding` workflow.
- TDD evidence:
  - Tests added/changed: `src/common/hashing/hashing.service.spec.ts`
  - RED: `npm run test -- --runInBand common/hashing/hashing.service.spec.ts`
    - Failed with `Cannot find module './hashing.types'` because the hashing service/types/constants did not exist yet.
  - GREEN: `npm run test -- --runInBand common/hashing/hashing.service.spec.ts`
    - Passed with `10 passed, 10 total` after implementing the service and helpers.
- Tests run and results:
  - `npm run test -- --runInBand common/hashing/hashing.service.spec.ts` → passed.
  - `npm run lint` → initially failed on `hashString` having no `await`; passed after returning `Promise.resolve(...)`.
  - `npm run typecheck` → passed.
  - `npm run test` → passed (`2` suites, `11` tests).
  - `npm run build` → passed.
  - `for run in 1 2 3; do npm run test -- --runInBand common/hashing/hashing.service.spec.ts ...; done` → focused hashing spec passed 3 consecutive runs.
  - `npx tsc --noEmit --target ES2023 --module nodenext --moduleResolution nodenext prisma/seed.ts` → failed on an existing `Pool` typing mismatch between `pg` and `@prisma/adapter-pg`; this check is outside the repo’s normal `npm run typecheck` surface and was not introduced by the hashing changes.
- Wiring verification evidence:
  - `src/app.module.ts` already imports `HashingModule`, and `src/common/hashing/hashing.module.ts` now registers/exports `HashingService`.
  - `rg -n "HashingModule|HashingService|computeHashChainEntry|getGenesisHash|hashUtf8String" src prisma/seed.ts` confirmed:
    - `HashingModule` remains wired in `src/app.module.ts`.
    - `prisma/seed.ts` now imports and uses `computeHashChainEntry`, `getGenesisHash`, and `hashUtf8String`.
    - `HashingService` and its helpers are present under `src/common/hashing/`.
- Behavior changes and risk notes:
  - Hash verification is fail-closed: stream errors reject and chain mismatches return `{ valid: false, firstInvalidIndex }`.
  - `verifyArtifactHash` currently accepts a stream factory rather than an artifact ID lookup; this keeps Task 3 usable now without inventing premature S3 access before Task 10.
  - Canonical audit hashing is now shared between runtime helpers and the seed path, reducing drift risk before Task 4 builds the audit service.
- Follow-ups / known gaps:
  - Task 4 should consume the same shared chain helpers in the real audit service.
  - Task 10 should provide the actual artifact stream source (for example S3) behind `verifyArtifactHash`.
  - The standalone `prisma/seed.ts` compile command still exposes the pre-existing `Pool` typing mismatch if we later decide to make seed code part of formal typecheck coverage.


## Review (2026-03-21 20:39 ICT) - working-tree

### Reviewed
- Repo: /Users/subhajlimanond/dev/zrl
- Branch: main
- Scope: working-tree
- Commands Run: git status -sb; git diff; rg -n "prisma.*seed|db seed|tsx prisma/seed|seed.ts" package.json prisma.config.ts prisma .; npm run test -- --runInBand common/hashing/hashing.service.spec.ts; npm run lint; npm run typecheck; npm run test; npm run build

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
- `verifyArtifactHash` now matches the artifact-ID contract by depending on an injected artifact-content reader; a concrete reader will land with the evidence/storage work rather than in Task 3.
- The standalone `prisma/seed.ts` direct compile mismatch between `pg` and `@prisma/adapter-pg` remains outside the repo's normal `npm run typecheck` surface.

### Recommended Tests / Validation
- Run `npx prisma db seed` against a local dev database before or alongside Task 4/Task 10 to exercise the shared hashing helpers through the real Prisma seed path.
- Keep the focused hashing spec in the regular gate path when future evidence/audit work changes the canonical hash-chain logic.

### Rollout Notes
- No feature flags or migrations are involved.
- Future evidence-module work should provide the artifact-content reader binding instead of re-implementing hash verification outside `HashingService`.
