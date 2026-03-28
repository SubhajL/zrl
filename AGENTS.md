# ZRL Agent Guide

## Project Snapshot
<!-- BEGIN AUTO-GENERATED:ROOT_PROJECT_SNAPSHOT -->
- Repo type: single-project repo with an initial scaffold in place.
- Primary stack target: NestJS + TypeScript backend, Next.js frontend, PostgreSQL, AWS S3, Kafka, Redis.
- Core domain: Thai fresh-fruit export compliance, evidence integrity, cold-chain monitoring, and dispute-defense workflows.
- This root file contains repo-wide guidance. Nearer `AGENTS.md` files currently exist for `frontend/AGENTS.md`, `prisma/AGENTS.md`, `src/AGENTS.md`, `test/AGENTS.md`, `rules/AGENTS.md`, `templates/AGENTS.md`; prefer them when working in those areas.
<!-- END AUTO-GENERATED:ROOT_PROJECT_SNAPSHOT -->

## Working Model
- Prefer the nearest `AGENTS.md` when one exists for the file you are editing.
- Treat this file as lightweight navigation and execution guidance.
- Use [CLAUDE.md](/Users/subhajlimanond/dev/zrl/CLAUDE.md) for deeper project context, domain constraints, and Claude-specific workflow rules.
- Use `docs/PRD.md`, `docs/ARCHITECTURE-DIAGRAMS.md`, and `docs/RESOURCE-ESTIMATION.md` as the canonical planning inputs.

## Current Repo State
<!-- BEGIN AUTO-GENERATED:ROOT_CURRENT_REPO_STATE -->
- The repo now has a real scaffold: NestJS app wiring under `src/`, a Next.js app under `frontend/`, a Prisma schema under `prisma/`, Jest test wiring under `test/`.
- The scaffold is still early-stage. Prefer extending what exists over introducing new top-level architecture prematurely.
- `rules/` is now on disk. Keep rule definitions explicit and data-driven, and keep a local guide there aligned with the actual market-file structure.
- `templates/` is now on disk. Keep proof-pack template guidance close to the actual template groups and generation flow.
- Task Master is installed in project scope and intentionally limited to `core` tools to reduce token usage.
- Global Claude hooks enforce protected-file checks, LEVER warnings, dangerous-command blocking, formatting, task-context injection, and Coding Log reminders.
- Root guidance should stay stable; implementation details belong in the nearer local `AGENTS.md` files and existing module-level `CLAUDE.md` files.
<!-- END AUTO-GENERATED:ROOT_CURRENT_REPO_STATE -->

## Root Setup Commands
<!-- BEGIN AUTO-GENERATED:ROOT_SETUP_COMMANDS -->
- Inspect current repo files:
```bash
find . -maxdepth 3 \( -path '*/.git' -o -path '*/node_modules' \) -prune -o -type f | sort
```
- Verify project MCP connectivity:
```bash
claude mcp list
```
- Inspect Task Master config:
```bash
sed -n '1,220p' .taskmaster/config.json
```
- Install dependencies:
```bash
npm install
test -f frontend/package.json && (cd frontend && npm install)
```
- Build/typecheck/test:
```bash
npm run build
npm run typecheck
npm run test
test -f frontend/package.json && (cd frontend && npm run lint)
```
<!-- END AUTO-GENERATED:ROOT_SETUP_COMMANDS -->

## Universal Conventions
- Keep repo guidance aligned with the real scaffold on disk; do not leave docs describing a pre-scaffold state once code exists.
- Follow LEVER: leverage existing patterns, extend before creating, verify through tests, eliminate duplication, reduce complexity.
- Prefer strict TypeScript, DTO-based APIs, explicit validation, and append-only audit behavior once implementation begins.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`.
- Branch from `main` using descriptive names such as `feature/m1-rules-engine`.
- Do not duplicate high-level rules between this file and future subdirectory `AGENTS.md` files.

## Security And Secrets
- Never commit credentials, tokens, `.env*` secrets, or exported regulatory/private datasets.
- Treat audit-log integrity as critical: append-only, hash-chained, never silently mutate.
- Redact personally identifiable or commercially sensitive exporter data in notes, logs, and examples.
- Store local secrets in ignored env files only after the app scaffold exists.

## Task Master Guidance
- Keep `TASK_MASTER_TOOLS=core`; do not switch to the full tool set unless there is a specific gap.
- Parse the PRD once, then work from focused tasks and subtasks rather than re-explaining the whole plan.
- Use Task Master for execution state, not as the main source of architectural truth.
- Use `docs/PROGRESS.md` for terse human-readable progress and the Coding Log for implementation evidence.
- When plans change, update the relevant task or subtask instead of re-parsing the full PRD.

## JIT Index
<!-- BEGIN AUTO-GENERATED:ROOT_JIT_INDEX -->
### Key Files
- Root agent rules: `AGENTS.md`
- Claude-specific rules: `CLAUDE.md`
- Repo-local Codex hook launcher: `scripts/codex-with-hooks.sh`
- Product requirements: `docs/PRD.md`
- Architecture reference: `docs/ARCHITECTURE-DIAGRAMS.md`
- Resource estimates: `docs/RESOURCE-ESTIMATION.md`
- Progress log: `docs/PROGRESS.md`
- Task Master config: `.taskmaster/config.json`
- Claude project config: `.claude/settings.json`
- Project MCP registration: `.mcp.json`

### Managed Local Guides
- `frontend/AGENTS.md`
- `prisma/AGENTS.md`
- `rules/AGENTS.md`
- `src/AGENTS.md`
- `templates/AGENTS.md`
- `test/AGENTS.md`

### Planned High-Value Directories
- Backend application: `src/`
- Frontend application: `frontend/`
- Database schema and migrations: `prisma/`
- Market rule definitions: `rules/`
- Templates for proof packs: `templates/`
- Test infrastructure: `test/`

### Quick Find Commands
- Show repo guidance and planning files:
```bash
find . -maxdepth 2 -type f \( -name 'AGENTS.md' -o -name 'CLAUDE.md' -o -path './docs/*' \) | sort
```
- Find Task Master and Claude config:
```bash
find . -maxdepth 3 -type f \( -path './.taskmaster/*' -o -path './.claude/*' -o -name '.mcp.json' \) | sort
```
- Find NestJS services and controllers:
```bash
rg -n "export class .*Service|@Controller|@(Get|Post|Patch|Delete)" src
```
- Find frontend components and hooks:
```bash
rg -n "export (function|const) |export function use[A-Z]" frontend/src
```
- Find Prisma models and migrations:
```bash
rg -n "^model " prisma && find prisma/migrations -maxdepth 2 -type f
```
<!-- END AUTO-GENERATED:ROOT_JIT_INDEX -->

## Patterns To Preserve
- Lane-centric modeling: evidence, rules, route, and SLA data should hang off a Lane, not drift as orphan records.
- Evidence integrity first: hashes, audit events, proof-pack lineage, and source traceability matter more than convenience.
- Domain rules must stay explicit and market-specific; do not collapse them into generic thresholds or generic compliance states.
- Prefer extending docs and existing configs over creating parallel planning artifacts.

## Anti-Patterns
- Do not scaffold fake application code just to satisfy a tooling workflow.
- Do not hardcode MRL values, cold-chain ranges, or buyer/regulator document requirements outside the proper rules/template layers.
- Do not create new top-level planning files when the needed context already exists in `docs/`, `CLAUDE.md`, or Task Master.
- Do not let root guidance become encyclopedic; keep detailed code patterns in the nearer `AGENTS.md` files and module-specific `CLAUDE.md` files.

## Definition Of Done
- The change matches the current repo stage: docs, harness, or real code, without inventing missing structure.
- Relevant validation has been run for the files that actually exist.
- `docs/PROGRESS.md` and the current Coding Log are updated when implementation work was performed.
- If a new sub-area becomes stable enough to have its own conventions, consider whether a nearer `AGENTS.md` should now be added.
