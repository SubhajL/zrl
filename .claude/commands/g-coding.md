Strict TDD implementation workflow: Auggie search, tests-first, wiring verification, quality gates, formal g-check review before commit, and coding log entries.

Arguments: $ARGUMENTS (task description or plan reference)

## Scope

End-to-end TDD coding workflow:
(a) Codebase exploration via Auggie MCP
(b) Context analysis from CLAUDE.md + module CLAUDE.md files
(c) TDD implementation with continuous quality gates
(d) Wiring verification (prevents "library code syndrome")
(e) QCHECK-style skeptical self-review
(f) Formal `/g-check` review on working tree before commit
(g) Fix issues, re-run gates
(h) Commit with Graphite (`gt create`)

## Coding Log Discipline (REQUIRED)

All implementation work MUST append a summary to the current coding log in `coding-logs/`.

**Find the current log:** Most recent file in `coding-logs/` by name (timestamped).
**If none exists:** Create `coding-logs/YYYY-MM-DD-HH-MM-SS Coding Log (<topic>).md`

**Required content per entry:**

```markdown
## YYYY-MM-DD HH:MM ICT

- Goal: what you set out to do
- What changed: list files with brief descriptions
- TDD evidence: RED command + failure reason, GREEN command + pass
- Tests run and results
- Wiring verification evidence
- Behavior changes and risk notes
- Follow-ups / known gaps
```

## Phase 1: Context Gathering

1. Read `CLAUDE.md` and relevant module `CLAUDE.md` files
2. Explore codebase with Auggie MCP (`mcp__auggie-mcp__codebase-retrieval`)
   - Ask for ALL symbols involved in the task at specific detail level
   - If Auggie times out or is unavailable, fall back to direct file reads + grep
3. Review plan from conversation (especially Wiring Verification table)

## Phase 2: TDD Implementation (iterative)

For each feature/function:

1. Think hard — simplest solution? Existing patterns?
2. Scaffold stub (throws `Not implemented`)
3. Write failing test
4. Run test — should FAIL (RED)
5. Implement
6. Run test — should PASS (GREEN)
7. Quality gates:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```
8. Verify wiring — is new code called from somewhere?
9. Repeat for next feature

## Phase 3: Wiring Verification (CRITICAL)

For EVERY new file/component, verify it's connected:

**NestJS endpoints:**

```bash
grep -rn "@Get\|@Post\|@Controller" src/**/*.ts | grep "<endpoint>"
```

**New functions/modules:**

```bash
grep -rn "function_name" --include="*.ts" | grep -v ".spec."
# If no results: THE FUNCTION IS NOT WIRED
```

**New modules in AppModule:**

```bash
grep -n "Module" src/app.module.ts
```

**DB migrations:**

```bash
# Verify table names match Prisma schema
grep -rn "table_name" prisma/ src/
```

Fill out verification table:
| Component | Call Site (non-test) | Registration | Schema Match |
|-----------|---------------------|--------------|--------------|

**If ANY cell is empty: FIX BEFORE PROCEEDING**

## Phase 4: Test Reliability

Run tests 3 times to detect flakiness:

```bash
for i in {1..3}; do echo "=== Run $i ==="; npm test; done
```

If ANY run fails, fix the flaky test before proceeding.

## Phase 5: QCHECK (Skeptical Self-Review)

Review your own diff as a skeptical senior engineer:

1. Writing Functions: readability, complexity, testability
2. Writing Tests: meaningful assertions, edge cases, parameterized inputs
3. Implementation: TDD compliance, naming, minimal complexity
4. Integration: every handler registered, every function called, table names match

## Phase 6: Formal `/g-check` Review

**After QCHECK and before commit:**

1. Stage the intended change set: `git add <files>`
2. Run `/g-check` on the working tree
3. Scope includes:
   - Tracked staged changes
   - Tracked unstaged changes
   - New files only if staged
4. Append the review artifact to the current coding log
5. If findings exist, fix them and re-run gates
6. If fixes are substantial, re-run `/g-check`

## Phase 7: Fix & Improve

1. Read review feedback, prioritize fixes
2. Fix critical issues (especially wiring gaps)
3. Improve quality
4. Re-run quality gates
5. Re-verify wiring if needed
6. Re-run `/g-check` if surface changed materially

## Phase 8: Commit with Graphite

```bash
gt create -am "<type>(<scope>): <description>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

Branch naming: `feature/<desc>`, `fix/<desc>`, `refactor/<desc>`
Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
Module prefix: `feat(m1):`, `fix(lane):`, `refactor(evidence):`

## Quality Gate Sequence

Before marking complete:

1. All tests pass
2. Typecheck passes
3. Lint passes
4. Build succeeds
5. Wiring verification completed
6. Tests pass 3 consecutive runs
7. QCHECK completed (self-review)
8. `/g-check` run on working tree
9. Review issues addressed
10. Coding log entry written
11. Committed with `gt create`

## Guardrails

**MUST:**

- Follow strict TDD: stub → test → implement
- Run quality gates after every code block
- Verify wiring for every new component
- Run `/g-check` before commit
- Write coding log entry before finishing

**MUST NOT:**

- Use `any` without justification
- Use `@ts-ignore`
- Skip tests for new code
- Commit unwired code
- Use `--no-verify` to skip pre-commit hook
- Mark task done before verification passes
