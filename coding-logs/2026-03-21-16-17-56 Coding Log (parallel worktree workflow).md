# Parallel Worktree Workflow

## Planning Context
- Date: 2026-03-21 16:17 ICT
- User request: explain how to start tasks in parallel using worktrees.
- Scope: operational workflow only; no branch/worktree creation executed in this step.

## Unified Execution Plan

### Overview
Parallel execution should use separate git worktrees plus separate Claude/Codex sessions, one per isolated write scope. A worktree by itself does not create parallelism; it only gives each stream its own branch and filesystem checkout so concurrent sessions do not fight over the same files.

### Files To Change
- No repo product files need to change for the explanation-only workflow.
- Future optional setup could touch shell aliases or helper scripts, but that is out of scope here.

### Implementation Steps
1. Create one worktree per independent stream.
2. Create one feature branch per worktree.
3. Run one terminal/Claude session inside each worktree.
4. Keep write scopes disjoint.
5. Merge bottom-up by dependency order.

### Test Coverage
- N/A for explanation-only planning.

### Decision Completeness
- Goal: enable safe parallel task execution without cross-branch collisions.
- Non-goals: actual worktree creation or Task Master mutation in this step.
- Success criteria:
  - each stream has an isolated checkout
  - each stream edits different files or modules
  - merge order respects dependencies
- Public interfaces:
  - git worktree layout
  - branch naming
  - Task Master task/subtask ownership
- Edge cases / failure modes:
  - shared-file collisions across worktrees still cause merge conflicts
  - `.codex/coding-log.current` may diverge across branches
  - Task Master statuses can become noisy if multiple sessions all mutate top-level tasks
- Rollout & monitoring:
  - start with three streams only
  - use subtask-level ownership where possible
- Acceptance checks:
  - `git worktree list`
  - `git status -sb` in each worktree
  - local quality gates per stream before merge

### Dependencies
- Git worktree support
- Separate terminals or agent sessions

### Validation
- Confirm each worktree is on the intended branch.
- Confirm each stream has a disjoint file ownership map.
- Confirm merge order is dependency-safe.

### Wiring Verification
| Component | Entry Point | Registration Location | Schema/Table |
|-----------|-------------|----------------------|--------------|
| frontend stream | worktree session for task 21 | separate branch/worktree | N/A |
| schema stream | worktree session for task 2 | separate branch/worktree | Prisma schema |
| hashing stream | worktree session for task 3 | separate branch/worktree | N/A |

## 2026-03-21 16:41 ICT
- Goal: Add a repo-local Claude auto-format hook and wire it into the project-scoped hook chain so this repo matches the updated formatter matrix.
- What changed:
  - `.claude/hooks/auto-format.sh`: added a non-blocking formatter hook that detects the nearest `package.json` root, runs Prettier for `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css`, `.md`, `.yaml`, `.yml`, and runs `prisma format --schema` for `.prisma`.
  - `.claude/settings.json`: added a `PostToolUse` hook for `Edit|Write` that invokes the new repo-local formatter before the existing repo-local CLAUDE/AGENTS advisory hooks.
  - `docs/PROGRESS.md`: appended the human-readable progress entry for this hook change.
- TDD evidence:
  - RED: no meaningful RED test was produced because this was a missing hook registration/configuration path, not a broken runtime behavior with an existing test harness. The pre-change inspection showed `.claude/settings.json` had no `auto-format.sh` command in its `PostToolUse` hooks.
  - GREEN: `chmod +x .claude/hooks/auto-format.sh && jq empty .claude/settings.json && jq -r '.hooks.PostToolUse[] | .hooks[].command' .claude/settings.json | rg 'auto-format\\.sh'` succeeded and printed `cd "$CLAUDE_PROJECT_DIR" && bash .claude/hooks/auto-format.sh`.
- Tests run and results:
  - `printf '{"tool_input":{"file_path":"/Users/subhajlimanond/dev/zrl/frontend/package.json"}}' | CLAUDE_PROJECT_DIR=/Users/subhajlimanond/dev/zrl bash .claude/hooks/auto-format.sh; echo EXIT:$?` → `EXIT:0`
  - `printf '{"tool_input":{"file_path":"/Users/subhajlimanond/dev/zrl/prisma/schema.prisma"}}' | CLAUDE_PROJECT_DIR=/Users/subhajlimanond/dev/zrl bash .claude/hooks/auto-format.sh; echo EXIT:$?` → `Formatted prisma/schema.prisma in 16ms` then `EXIT:0`
- Wiring verification evidence:
  - Project-scoped registration now lives in `.claude/settings.json` under `hooks.PostToolUse` with matcher `Edit|Write`.
  - The invoked command is `cd "$CLAUDE_PROJECT_DIR" && bash .claude/hooks/auto-format.sh`, so the hook resolves paths relative to the active repo checkout.
  - The hook chooses the nearest `package.json`, which means frontend files use `frontend/node_modules/.bin/prettier` while root Prisma files use the root `node_modules/.bin/prisma`.
- Behavior changes and risk notes:
  - Auto-formatting is now repo-local and deterministic for this project, even if global Claude hook configuration changes later.
  - The hook stays fail-open by design: formatter stderr is suppressed and failures do not block Claude.
- Follow-ups / known gaps:
  - If you want exact parity with future global hook changes, we should keep the local script in sync intentionally rather than assuming the global harness remains the source of truth.

## 2026-03-21 16:45 ICT
- Goal: Add Codex-side hook behavior for this repo even though the installed Codex CLI does not expose native Claude-style lifecycle hooks in `~/.codex/config.toml`.
- What changed:
  - `.codex/hooks/codex_hooks.py`: added a repo-local watcher/dispatcher with two modes: `dispatch` for one changed file and `watch` for polling the repo during a Codex session. It reuses `.claude/hooks/auto-format.sh`, `.claude/hooks/claudemd-staleness.sh`, and `.claude/hooks/sync-agents.sh`.
  - `scripts/codex-with-hooks.sh`: added a launcher that starts the watcher in the background, runs `codex`, and tears the watcher down on exit.
  - `scripts/sync_agents.py`: updated the root AGENTS auto-generated JIT index so the Codex launcher is preserved across AGENTS sync runs.
  - `test/test_sync_agents.py`: added a regression assertion for the Codex launcher entry in the generated root guide.
  - `AGENTS.md`: refreshed via `scripts/sync_agents.py` so the root guide now lists `scripts/codex-with-hooks.sh`.
  - `docs/PROGRESS.md`: appended the progress entry for this tooling change.
- TDD evidence:
  - RED: no meaningful RED test was produced because Codex native hook support is absent rather than broken; the pre-change verification was `codex --help` plus inspection of `~/.codex/config.toml`, which showed no native lifecycle-hook configuration surface analogous to Claude’s `hooks` block.
  - GREEN:
    - `python3 -m unittest discover -s test -p 'test_sync_agents.py'` → `Ran 3 tests ... OK`
    - `python3 scripts/sync_agents.py --project-root . >/dev/null && rg -n "Repo-local Codex hook launcher" AGENTS.md` → showed the launcher entry at line 81
    - `python3 .codex/hooks/codex_hooks.py dispatch --project-root . --file /Users/subhajlimanond/dev/zrl/prisma/schema.prisma` → emitted formatted Prisma output plus the CLAUDE staleness advisory
    - `bash scripts/codex-with-hooks.sh --help` → printed `CODEX HOOKS: watching /Users/subhajlimanond/dev/zrl ...` and then the normal Codex CLI help text
- Tests run and results:
  - `python3 -m py_compile .codex/hooks/codex_hooks.py` passed.
  - `python3 -m unittest discover -s test -p 'test_sync_agents.py'` passed.
  - `python3 .codex/hooks/codex_hooks.py dispatch --project-root . --file /Users/subhajlimanond/dev/zrl/frontend/package.json` exited cleanly with no warnings.
  - `python3 .codex/hooks/codex_hooks.py dispatch --project-root . --file /Users/subhajlimanond/dev/zrl/prisma/schema.prisma` emitted the expected hook outputs and exited cleanly.
  - `bash scripts/codex-with-hooks.sh --help` started the watcher and returned Codex help successfully.
- Wiring verification evidence:
  - Runtime entry point for Codex hook behavior is `scripts/codex-with-hooks.sh`.
  - That launcher starts `.codex/hooks/codex_hooks.py watch --project-root <repo>`.
  - File-change dispatch reuses the existing repo-local hook implementations at `.claude/hooks/auto-format.sh`, `.claude/hooks/claudemd-staleness.sh`, and `.claude/hooks/sync-agents.sh`, so hook logic stays single-sourced rather than duplicated.
  - `scripts/sync_agents.py` now owns the AGENTS mention of the launcher, preventing future sync runs from deleting it.
- Behavior changes and risk notes:
  - This is hook emulation, not native Codex lifecycle integration. It reacts to filesystem changes during a wrapped Codex session.
  - The watcher is fail-open; if a hook script is missing, it skips that step.
  - Background watching can only observe file changes, not higher-level Codex tool events like “Bash without file write”.
- Follow-ups / known gaps:
  - If you want plain `codex` to always use this wrapper, add a shell alias or PATH shim.
  - If you want Bash-command policing for Codex comparable to Claude’s pre-tool guard, that needs a shell wrapper strategy rather than file watching.

## 2026-03-21 16:52 ICT
- Goal: Make plain `codex` automatically use the ZRL repo-local Codex hook wrapper without changing behavior in other directories.
- What changed:
  - `/Users/subhajlimanond/.zshrc`: added a global `codex()` zsh function that inspects the effective working directory, including `-C` / `--cd` arguments. It routes to `/Users/subhajlimanond/dev/zrl/scripts/codex-with-hooks.sh` only when the target directory is `/Users/subhajlimanond/dev/zrl` or a subdirectory; otherwise it falls back to the real `/opt/homebrew/bin/codex`.
  - `docs/PROGRESS.md`: appended the human-readable progress note for the shell shim.
- TDD evidence:
  - RED: the first implementation incorrectly consumed the positional arguments while parsing `-C` / `--cd`, which would have dropped user-supplied Codex flags. I fixed that by preserving `original_args` in an array and parsing from the array by index.
  - GREEN:
    - `zsh -ic 'cd /Users/subhajlimanond/dev/zrl && codex --help >/tmp/zrl-codex-help.out 2>/tmp/zrl-codex-help.err; rc=$?; echo RC:$rc; sed -n "1,3p" /tmp/zrl-codex-help.err; sed -n "1,2p" /tmp/zrl-codex-help.out'` → `RC:0`, stderr began with `CODEX HOOKS: watching /Users/subhajlimanond/dev/zrl ...`, stdout began with `Codex CLI`
    - `zsh -ic 'cd /tmp && codex --help >/tmp/plain-codex-help.out 2>/tmp/plain-codex-help.err; rc=$?; echo RC:$rc; sed -n "1,3p" /tmp/plain-codex-help.err; sed -n "1,2p" /tmp/plain-codex-help.out'` → `RC:0`, no hook-watcher stderr, stdout began with `Codex CLI`
    - `zsh -ic 'cd /tmp && codex -C /Users/subhajlimanond/dev/zrl --help >/tmp/codex-cd-help.out 2>/tmp/codex-cd-help.err; rc=$?; echo RC:$rc; sed -n "1,3p" /tmp/codex-cd-help.err; sed -n "1,2p" /tmp/codex-cd-help.out'` → `RC:0`, stderr began with `CODEX HOOKS: watching /Users/subhajlimanond/dev/zrl ...`, stdout began with `Codex CLI`
- Tests run and results:
  - The three interactive `zsh -ic` resolution tests above all passed.
- Wiring verification evidence:
  - Shell entry point is now the global zsh function in `/Users/subhajlimanond/.zshrc`.
  - Repo-local runtime hook behavior still comes from `/Users/subhajlimanond/dev/zrl/scripts/codex-with-hooks.sh` and `.codex/hooks/codex_hooks.py`.
  - The shim is selective: it only activates for the ZRL repo path or an explicit `-C` / `--cd` targeting that path.
- Behavior changes and risk notes:
  - This is global shell configuration, but the routing logic is repo-specific.
  - Other repos keep the original Homebrew `codex` binary behavior.
- Follow-ups / known gaps:
  - Open a new shell or run `source ~/.zshrc` in existing shells to pick up the new function.

## 2026-03-21 18:39 ICT
- Goal: Generalize the global zsh `codex()` shim so the same auto-wrapper pattern works in any repo, not just ZRL.
- What changed:
  - `/Users/subhajlimanond/.zshrc`: replaced the ZRL-specific path check with generic git-root discovery. The shim now resolves the effective working directory, runs `git rev-parse --show-toplevel`, and if that repo root contains an executable `scripts/codex-with-hooks.sh`, it routes `codex` through that wrapper. Otherwise it falls back to `/opt/homebrew/bin/codex`.
  - `docs/PROGRESS.md`: appended the human-readable progress note for the genericization.
- TDD evidence:
  - RED: no separate RED test run was captured because the previous implementation was intentionally repo-specific rather than accidentally broken. The motivating defect was functional scope: other repos could not opt in to the same behavior without editing `~/.zshrc` again.
  - GREEN:
    - `zsh -ic 'cd /Users/subhajlimanond/dev/zrl && codex --help >/tmp/zrl-generic-help.out 2>/tmp/zrl-generic-help.err; rc=$?; echo RC:$rc; sed -n "1,3p" /tmp/zrl-generic-help.err; sed -n "1,2p" /tmp/zrl-generic-help.out'` → `RC:0`, stderr began with `CODEX HOOKS: watching /Users/subhajlimanond/dev/zrl ...`, stdout began with `Codex CLI`
    - `zsh -ic 'cd /tmp && codex --help >/tmp/nonrepo-generic-help.out 2>/tmp/nonrepo-generic-help.err; rc=$?; echo RC:$rc; sed -n "1,3p" /tmp/nonrepo-generic-help.err; sed -n "1,2p" /tmp/nonrepo-generic-help.out'` → `RC:0`, no wrapper stderr, stdout began with `Codex CLI`
    - `tmpdir=$(mktemp -d /tmp/codex-hooks-test.XXXXXX) && mkdir -p "$tmpdir/scripts" && cd "$tmpdir" && git init -q && cat > "$tmpdir/scripts/codex-with-hooks.sh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "TEMP WRAPPER: $PWD" >&2
exec /opt/homebrew/bin/codex "$@"
EOF
chmod +x "$tmpdir/scripts/codex-with-hooks.sh"
zsh -ic 'cd '"$tmpdir"' && codex --help >/'"$tmpdir"'/out 2>/'"$tmpdir"'/err; rc=$?; echo RC:$rc; sed -n "1,3p" /'"$tmpdir"'/err; sed -n "1,2p" /'"$tmpdir"'/out'
rm -rf "$tmpdir"` → `RC:0`, stderr began with `TEMP WRAPPER: /tmp/codex-hooks-test...`, stdout began with `Codex CLI`
- Tests run and results:
  - The three interactive resolution tests above all passed.
- Wiring verification evidence:
  - Global shell entry point remains the `codex()` zsh function in `/Users/subhajlimanond/.zshrc`.
  - Repo opt-in contract is now simple: a git repo only needs an executable `scripts/codex-with-hooks.sh`.
  - ZRL still satisfies that contract through `/Users/subhajlimanond/dev/zrl/scripts/codex-with-hooks.sh`.
- Behavior changes and risk notes:
  - This remains global shell configuration, but now the routing logic is convention-based rather than hardcoded to one repo path.
  - A repo with a broken `scripts/codex-with-hooks.sh` can now break its own Codex launch path, which is the right failure boundary.
- Follow-ups / known gaps:
  - Existing shells still need `source ~/.zshrc` or a new terminal session.
