Create branch and submit PR with quality gates, conventional commits, and CI-aware submission.

Arguments: $ARGUMENTS (optional: branch name or PR title)

## Purpose

Automate the full lifecycle from branch creation to PR submission:

1. Create properly named branch
2. Run all quality gates
3. Commit with conventional commit format
4. Push and create PR with structured description

## Workflow

### 1. Assess Current State

```bash
git status -sb
git diff --name-only
git diff --staged --name-only
git log --oneline -3
```

If no changes exist, say so and stop.

### 2. Determine Branch Name

If $ARGUMENTS provides a name, use it. Otherwise infer from the changes:

- `feature/<module>-<description>` for new features
- `fix/<description>` for bug fixes
- `refactor/<description>` for restructuring
- `docs/<description>` for documentation

### 3. Run Quality Gates (MUST pass)

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If ANY gate fails:

- Fix the issue
- Do NOT skip with `--no-verify`
- Re-run the failing gate
- Only proceed when all green

### 4. Create Branch and Commit

```bash
# Create branch from current position (if not already on a feature branch)
git checkout -b <branch-name>

# Stage specific files (NOT git add -A)
git add <file1> <file2> ...

# Commit with conventional format
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body - what changed and why>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 5. Push and Create PR

```bash
git push -u origin HEAD

gh pr create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary
- <bullet 1>
- <bullet 2>
- <bullet 3>

## Changes
- `<file1>`: <what changed>
- `<file2>`: <what changed>

## Test plan
- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm test` passes
- [x] `npm run build` passes

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 6. Report Result

Show:

- Branch name
- Commit SHA
- PR URL
- Quality gate results
- Any warnings or follow-ups

## Guardrails

- **NEVER** commit secrets, .env files, or credentials
- **NEVER** use `git add -A` or `git add .` — stage specific files
- **NEVER** skip quality gates
- **NEVER** force push to main
- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Module prefix: `feat(m1):`, `fix(m2):`, `refactor(lane):`
- One PR per logical change — if changes span multiple concerns, suggest splitting
- Confirm with user before creating PR

## Commit Message Examples

```
feat(m1): add Japan MRL validation with 400+ substances
fix(m3): correct mango chilling threshold from 8°C to 10°C
refactor(evidence): extract DAG integrity verification into service
test(audit): add hash chain tampering detection tests
docs: update CLAUDE.md with cold-chain temperature profiles
```
