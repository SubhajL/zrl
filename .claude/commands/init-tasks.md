Initialize Task Master tasks from the PRD document.

## Pre-checks
1. Read `CLAUDE.md` and `AGENTS.md` for project context and guardrails
2. Confirm `docs/PRD.md` and `.taskmaster/config.json` exist
3. Check whether `.taskmaster/tasks/tasks.json` already has tasks
   - If tasks exist and user did NOT explicitly ask to rebuild/overwrite, inspect current state first and skip re-parsing
   - Only re-parse when explicitly requested or when tasks.json is empty

## Parse
4. Call `parse_prd` via Task Master MCP with input `docs/PRD.md` and projectRoot set to the repo root
5. If `parse_prd` fails (API key issues, timeout), fall back to manually reading the PRD and creating tasks.json directly
6. Wait for parsing to complete (may take 2-3 minutes)

## Verify
7. Call `get_tasks` to verify tasks were created
8. If task count is unexpectedly low or zero, report the anomaly clearly — do not silently accept an empty result

## Summarize
9. Display: total tasks, counts by priority (critical/high/medium), dependency clusters, and module groupings (M1-M5) when visible from titles
10. Append a one-line summary to `docs/PROGRESS.md`

## Guardrails
- Keep `TASK_MASTER_TOOLS=core` (env var) — do NOT switch to `all` mode
- Treat Task Master as execution state, not architectural truth — rely on repo docs for design intent
- Do not re-parse the PRD repeatedly when focused task execution is the better path
- Do not invent scaffolding, scripts, or code structure just to satisfy a task workflow
