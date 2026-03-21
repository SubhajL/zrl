Land multiple PRs safely: verify CI, fix issues, merge sequentially, and log progress.

Arguments: $ARGUMENTS (optional: comma-separated PR numbers, e.g. "123,124,125")

## Purpose

When you have multiple open PRs that need to be merged into `main`, this command handles the "check gates → merge → sync" loop safely.

## Guardrails (non-negotiable)

- **Merge in dependency order.** If PR B depends on PR A, merge A first.
- **Required CI is source-of-truth.** Each PR must have CI green before merge.
- **Do NOT use `--no-verify`** or skip quality gates.
- **No history rewrite** unless explicitly approved.
- **Confirm with user** before each merge.

## Workflow

### 1. Snapshot the Queue

If $ARGUMENTS provides PR numbers, use them. Otherwise find open PRs:

```bash
gh pr list --author @me --state open --json number,title,baseRefName,headRefName,isDraft,mergeable,statusCheckRollup
```

### 2. Determine Merge Order

Sort PRs by dependency:

- PRs targeting `main` directly come first
- PRs targeting other PRs come after their base
- If unclear, ask the user

### 3. Pre-merge Check for Each PR

For each PR in order:

```bash
# Check PR status
gh pr view <N> --json title,number,mergeable,reviewDecision,statusCheckRollup

# Check CI
gh pr checks <N>
```

Requirements before merge:

- [ ] Not a draft
- [ ] CI checks passing
- [ ] No merge conflicts
- [ ] Review approved (if required by branch protection)

### 4. Fix Issues If Needed

If CI is failing:

```bash
git checkout <branch>
git fetch origin main
git rebase origin/main
# fix the issue
npm run typecheck && npm run lint && npm test
git add <files>
git commit -m "fix: resolve CI failure"
git push
```

Wait for CI to re-run:

```bash
gh pr checks <N> --watch
```

### 5. Merge

```bash
# Squash merge (default for this project)
gh pr merge <N> --squash --delete-branch

# After each merge, sync
git checkout main
git pull origin main
```

### 6. Post-merge Verification

After all PRs merged:

```bash
git checkout main
git pull
npm run typecheck && npm run lint && npm test && npm run build
```

### 7. Report

```markdown
## Merge Train Complete

| PR  | Title   | Status   |
| --- | ------- | -------- |
| #N  | <title> | Merged ✓ |
| #M  | <title> | Merged ✓ |

All quality gates pass on main after merge.
```

## Error Handling

- **"Branch has conflicts"**: Rebase on main, resolve, push
- **"CI failing"**: Fix the issue, push, wait for re-run
- **"Review required"**: Ask user to get approval or skip if not required
- **"Not mergeable"**: Check branch protection rules, report to user
