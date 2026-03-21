QCHECK-style code review for diffs, commits, or PRs.

Arguments: $ARGUMENTS (optional: "working-tree", "last-commit", "pr <N>", or commit range)

## Purpose

Perform a skeptical senior-engineer review focused on:

- Correctness bugs
- Safety/regression risks
- Missing tests and weak assertions
- Edge cases and rollout hazards

This skill is **review-only**. Do NOT change code unless the user explicitly asks.

## 1. Clarify Review Target

If $ARGUMENTS is provided, use it. Otherwise default to `working-tree`.

| Scope                       | Commands to Run                                                                |
| --------------------------- | ------------------------------------------------------------------------------ |
| `working-tree`              | `git status --porcelain=v1`, `git diff`, `git diff --staged`                   |
| `last-commit`               | `git show --name-status --stat HEAD`, `git show HEAD`                          |
| `commit-range` (base..head) | `git log --oneline base..head`, `git diff base..head`                          |
| `pr <N>`                    | `gh pr view <N> --json title,number,baseRefName,headRefName`, `gh pr diff <N>` |

## 2. Gather Context

- Read touched files from the diff
- Read `CLAUDE.md` and relevant module `CLAUDE.md` files for rules being changed
- Use Auggie MCP (`mcp__auggie-mcp__codebase-retrieval`) to find related tests and invariants
- Read related test files for the changed code
- Check wiring: are new exports imported? Are new endpoints registered?

## 3. Perform Review

For each changed file, evaluate against:

- **CLAUDE.md rules**: SHA-256 hashing, Lane-centric design, strict TypeScript, audit integrity
- **Domain correctness**: MRL units (mg/kg), temperature thresholds (fruit-specific, NOT 2-8°C), state machine validity
- **Test coverage**: Are changes tested? Are edge cases covered? Are assertions meaningful?
- **Security**: No secrets committed, no @ts-ignore without justification, RBAC enforcement
- **Wiring**: Is new code called from somewhere? Are new modules imported in app.module.ts?

## 4. Classify Findings

Severity levels:

- **CRITICAL**: Bugs, data loss, security holes, audit chain corruption
- **HIGH**: Missing tests for business logic, incorrect MRL comparison, orphaned evidence
- **MEDIUM**: Missing edge cases, weak assertions, naming inconsistencies
- **LOW**: Style nits, minor improvements, documentation gaps

## 5. Output Report

```markdown
## Review (<timestamp>) - <scope>

### Reviewed

- Branch: <branch>
- Scope: <working-tree|sha|range|pr>
- Commands Run: <list>

### Findings

CRITICAL

- <finding with file:line citation>

HIGH

- <finding with file:line citation>

MEDIUM

- <finding>

LOW

- <finding>

### Open Questions / Assumptions

- ...

### Recommended Tests / Validation

- ...

### Rollout Notes

- ...
```

## 6. Append to Coding Log

Find the most recent file in `coding-logs/` and append the review report.
If no coding log exists for this session, create one: `coding-logs/YYYY-MM-DD-HH-MM-SS Coding Log (review).md`

## Evidence Bar

- At least one concrete diff citation (file + line) for each CRITICAL/HIGH issue
- For behavioral changes: identify the test that should fail if the bug exists
- If no issues found: explicitly state "No findings" and list residual risks/gaps
