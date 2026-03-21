Show current Task Master progress summary.

## Gather State
1. Call `get_tasks` via Task Master MCP for the current repo
2. If the task set is empty or missing, say "Task Master has not been initialized — run `/init-tasks` first" and stop

## Count & Display
3. Count tasks by status and display a concise table:
   - `done` | `in_progress` | `pending` | `blocked` | total
   - Include completion percentage
4. List ALL `in_progress` tasks with their IDs and titles
5. Show the next 3 pending tasks (dependency-respecting order from Task Master)

## Detect Blockers
6. Identify blocked work:
   - Tasks with explicit `blocked` status
   - Pending tasks whose dependencies are still incomplete (infer from dependency graph)
7. For each blocked task, explain WHY it's blocked (which dependency is incomplete)

## Anomaly Detection
8. Call out anomalies briefly:
   - Too many simultaneous `in_progress` tasks (>3 is suspicious for solo dev)
   - No pending tasks left but completion < 100%
   - Tasks present but no recent entries in `docs/PROGRESS.md`
   - Tasks marked done with no corresponding code changes

## Presentation
- Prefer a concise table for counts — keep the narrative short and operational
- Lead with the headline (e.g., "12/32 done (38%), 2 in progress, 1 blocked")
- Mention blockers only when there is a concrete reason, not vague speculation
- Do NOT recommend re-parsing the PRD when the repo already has a usable task set
