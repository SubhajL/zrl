Expand a Task Master task into smaller actionable subtasks.

Arguments: $ARGUMENTS (optional task ID — if omitted, expand the next pending task)

## Pre-checks
1. Read `CLAUDE.md` for project guardrails
2. Identify the target task:
   - If a task ID was provided in $ARGUMENTS, call `get_task` with that ID
   - If no ID provided, call `next_task` to get the next actionable task
3. Inspect the current task and note whether subtasks already exist

## Decide: Expand or Skip
4. If subtasks ALREADY exist and user did NOT explicitly ask to replace them:
   - Display the existing subtasks
   - Ask if user wants to keep them or replace with a new breakdown
   - Do NOT call `expand_task` with `force=true` without explicit user approval
5. If no subtasks exist, proceed to expand

## Safe Expansion (default)
6. Call `expand_task` via Task Master MCP with `force=false`
7. After expansion, call `get_task` to re-read and confirm:
   - Subtask count
   - Titles are actionable (not vague)
   - Dependencies still make sense
8. Summarize what was added

## Forced Re-expansion (only when user explicitly requests)
9. BEFORE calling `expand_task` with `force=true`, create a backup:
   ```
   python3 scripts/taskmaster_tasks_guard.py snapshot --project-root . --label force-expand-task-<id>
   ```
10. Capture the backup path from the JSON output
11. Call `expand_task` with `force=true`
12. IMMEDIATELY re-read the task, even if the call timed out or errored
13. If the task is now in a WORSE state (subtasks wiped, count dropped to 0):
    - Restore from backup:
      ```
      python3 scripts/taskmaster_tasks_guard.py restore --project-root . --backup-file <path>
      ```
    - Report the failure explicitly — do NOT present it as a no-op

## Guardrails
- Prefer preserving a usable existing breakdown over churning subtasks for cosmetic reasons
- Do NOT present a timed-out forced expansion as successful
- Keep `TASK_MASTER_TOOLS=core` unless user explicitly requests otherwise
- `force=true` can leave tasks with EMPTY subtasks on timeout — this is a known Task Master behavior, not a harmless retry
- The backup script at `scripts/taskmaster_tasks_guard.py` is the safety net — always use it before force

## Output
Return: task ID, whether subtasks already existed, whether expansion was skipped or executed, the resulting subtask count, and any follow-up needed.
