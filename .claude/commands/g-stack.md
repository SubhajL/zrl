Git branch and PR workflow concierge — keeps branches organized, runs quality gates, and submits PRs safely.

Arguments: $ARGUMENTS (action: "status", "create <name>", "submit", "sync", "rebase", or free-form description)

## Purpose

Manage git branches and PRs with quality gates. This project uses standard git (not Graphite), so all operations use `git` and `gh` CLI.

## 1. Detect Context

Always start by gathering state:

```bash
git rev-parse --show-toplevel      # Repo root
git status -sb                     # Working tree status
git branch -vv                     # All branches with tracking
git log --oneline -5               # Recent commits
```

## 2. Actions

### status

Show current branch, uncommitted changes, recent commits, and any open PRs:

```bash
git status -sb
git log --oneline -10
gh pr list --author @me 2>/dev/null || echo "No gh CLI or no PRs"
```

### create <name>

Create a new feature branch from main:

```bash
git checkout main
git pull origin main
git checkout -b <name>
```

Branch naming: `feature/<name>`, `fix/<name>`, `refactor/<name>`, `docs/<name>`

### submit

Submit current branch as a PR. Pre-flight checks first:

**Quality Gates (MUST pass before submit):**

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

If any gate fails: fix the issue, do NOT submit with `--no-verify`.

**Create PR:**

```bash
git push -u origin HEAD
gh pr create --title "<type>: <description>" --body "$(cat <<'EOF'
## Summary
<1-3 bullet points>

## Test plan
- [ ] Tests pass
- [ ] Typecheck passes
- [ ] Lint passes

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### sync

Sync current branch with main:

```bash
git fetch origin main
git rebase origin/main
```

If conflicts: resolve, `git add`, `git rebase --continue`.

### rebase

Interactive rebase to clean up commits before PR:

```bash
git rebase -i origin/main
```

## 3. Guardrails

- **NEVER** force push to main/master
- **NEVER** use `--no-verify` to skip hooks
- Run quality gates before every submit
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Module prefix recommended: `feat(m1): add Japan MRL validation`
- One logical change per branch — split if doing multiple things
- Always confirm with user before destructive operations (reset, force push)

## 4. PR Conventions

- Title: short, under 70 chars, conventional commit format
- Body: summary bullets + test plan checklist
- Labels: add module label if applicable (m1, m2, m3, m4, m5, frontend, infra)
- Request review when CI passes

## 5. Common Workflows

**Start new feature from task:**

```bash
git checkout main && git pull
git checkout -b feature/m1-rules-engine
# ... implement ...
npm run typecheck && npm run lint && npm test
git add <specific files>
git commit -m "feat(m1): add Japan MRL validation"
git push -u origin HEAD
gh pr create --title "feat(m1): add Japan MRL validation" --body "..."
```

**Fix failing CI on existing PR:**

```bash
git fetch origin main
git rebase origin/main
# fix issues
git add <files>
git commit -m "fix: resolve typecheck errors"
git push
```
