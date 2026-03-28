# Test Agent Guide

## Scope
- This file applies to everything under `test/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing e2e or test harness files.

## Current State
<!-- BEGIN AUTO-GENERATED:TEST_CURRENT_STATE -->
- E2E entry point(s) currently on disk: `test/app.e2e-spec.ts`, `test/audit.e2e-spec.ts`, `test/auth.e2e-spec.ts`, `test/cold-chain.e2e-spec.ts`, `test/evidence.e2e-spec.ts`, `test/jest-e2e.json`, `test/lane.e2e-spec.ts`, `test/notifications.e2e-spec.ts`, `test/proof-pack-worker.e2e-spec.ts`, `test/proof-pack.e2e-spec.ts`, `test/rules-engine.e2e-spec.ts`, `test/test_sync_agents.py`.
- E2E Jest config: [`test/jest-e2e.json`](/Users/subhajlimanond/dev/zrl/test/jest-e2e.json).
- Root Jest config currently covers 23 unit test file(s) under `src/` via `*.spec.ts`.
<!-- END AUTO-GENERATED:TEST_CURRENT_STATE -->

## Core Commands
<!-- BEGIN AUTO-GENERATED:TEST_CORE_COMMANDS -->
- Unit tests: `npm run test`
- Focused unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`
- Coverage: `npm run test:cov`
<!-- END AUTO-GENERATED:TEST_CORE_COMMANDS -->

## Test Split
- Keep backend unit tests colocated under `src/` when they target one module or service.
- Keep cross-module app boot or HTTP-flow tests under `test/`.
- Add fixtures here only when they are reused by more than one test target.

## Working Rules
- Prefer tests that prove actual wiring over tests that only assert mocks were called.
- Keep the e2e harness close to real app bootstrap via `AppModule`.
- When behavior is domain-critical, include explicit assertions for audit, hashing, or lane lifecycle side effects where relevant.
- Expand fixtures deliberately; avoid dumping large synthetic datasets into `test/` without an actual reuse case.

## Anti-Patterns
- Do not move all tests into `test/` and lose source-level locality.
- Do not write snapshot-heavy tests for unstable payloads unless snapshotting is the point of the feature.
- Do not mock away the behavior that the test is supposed to prove.
- Do not keep placeholder e2e cases once real routes and modules exist.

## Quick Find
<!-- BEGIN AUTO-GENERATED:TEST_QUICK_FIND -->
- Find e2e tests: `find test -type f | sort`
- Find unit tests: `find src -name '*.spec.ts' | sort`
- Find app bootstrap references: `rg -n "AppModule|createNestApplication" src test`
<!-- END AUTO-GENERATED:TEST_QUICK_FIND -->

## Done Criteria
- The right test layer was used for the change.
- Relevant unit or e2e commands were run.
- Test names and assertions reflect real behavior, not placeholder scaffolding.
