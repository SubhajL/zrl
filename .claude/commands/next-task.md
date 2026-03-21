Get the next actionable Task Master task and begin working on it.

## Pre-checks
1. Read `CLAUDE.md` and `AGENTS.md` for project rules before touching code or task state
2. Call `next_task` via Task Master MCP to get the highest-priority pending task (respects dependency order)
3. If no pending task is available, say so and stop

## Assess Actionability
4. Read the returned task carefully: ID, title, dependencies, details, testStrategy
5. If the task is NOT actually actionable (unresolved dependencies, missing repo state, blocked by another task), explain the block clearly
   - Prefer leaving the task pending with a blocker note over forcing progress
   - Do NOT mark it in-progress if it truly can't be started

## Execute
6. Call `set_task_status` to move the task to `in_progress` once work truly begins
7. Identify which files need to be created or modified
8. Implement the task following CLAUDE.md guidelines (LEVER check, strict TypeScript, SHA-256 hashing, Lane-centric design)
9. Write tests for the implementation (≥80% coverage target)
10. Run tests and validation: `npm run typecheck && npm run lint && npm test`

## Complete
11. Call `set_task_status` to `done` ONLY after:
    - The requested work is actually complete
    - Relevant checks passed (or limitations were explicitly reported)
    - No known blocker remains
12. Append a one-line summary to `docs/PROGRESS.md`

## Guardrails
- Do NOT mark a task `done` just because investigation started — only after real implementation and verification
- Do NOT invent build scripts, package structure, or framework files that are not on disk
- Prefer leaving the task `in_progress` with a clear blocker note when work cannot be completed in one pass
- Keep Task Master status synchronized with reality — status is execution state, not optimism
- Do NOT skip subtasks — work through them in order if the task has subtasks
