# Zero-Reject Export Lane (ZRL)

## Overview

- **Type:** Modular monolith (NestJS) → microservices migration Year 2
- **Stack:** NestJS (TypeScript) + React/Next.js + PostgreSQL + AWS S3 + Kafka + Redis
- **Architecture:** 5 core modules (M1–M5) + supporting services, lane-centric evidence orchestration
- **Domain:** Thai fresh fruit export compliance — audit-grade evidence platform for SME exporters
- **Team:** 7–8 FTE, NIA-funded Year 1 (5M THB grant)

This CLAUDE.md is the authoritative source for development guidelines.
Subdirectory CLAUDE.md files extend these rules as modules are built.

---

## Universal Development Rules

### Code Quality (MUST)

- **MUST** write TypeScript in strict mode (`"strict": true` in tsconfig)
- **MUST** include tests for all new features (≥80% coverage target)
- **MUST** hash all evidence artifacts with SHA-256 on upload — this is core to the product
- **MUST** use the Lane as the atomic unit — never store evidence disconnected from a Lane ID
- **MUST NOT** commit secrets, API keys, or MRL database exports
- **MUST NOT** bypass TypeScript errors with `@ts-ignore` or `any` without explicit justification
- **MUST NOT** modify the audit log schema — it is append-only and hash-chained by design

### LEVER Framework (MUST)

Before creating any new file, apply the LEVER check:

- **L**everage existing patterns — check if similar code exists
- **E**xtend before creating — add to existing service/component, don't duplicate
- **V**erify through testing — write test first or immediately after
- **E**liminate duplication — one source of truth per concept
- **R**educe complexity — prefer simple over clever

### Best Practices (SHOULD)

- **SHOULD** use NestJS module boundaries to keep services decoupled
- **SHOULD** keep functions under 50 lines; extract complex logic
- **SHOULD** use DTOs (Data Transfer Objects) for all API request/response types
- **SHOULD** prefer composition over inheritance
- **SHOULD** use `readonly` for properties that should not change after initialization

### Anti-Patterns (MUST NOT)

- **MUST NOT** store evidence files in the database — use S3 with hash references
- **MUST NOT** create new database tables without checking if existing tables can be extended
- **MUST NOT** hardcode MRL values — all regulatory data goes through the Rules Engine (M1)
- **MUST NOT** use generic 2–8°C cold-chain thresholds — each fruit has specific ranges

### Coding Log Requirement (MUST)

Any session that produces implementation or debugging work **MUST** append an entry to the current coding log in `coding-logs/` before the session ends. The stop hook will remind you, but **you are responsible for writing the entry** — hooks cannot reliably author meaningful log content.

**When to write:** After completing a task, fixing a bug, or making any non-trivial code changes. Do not batch — write as you complete work.

**What to include in each entry:**

```markdown
## YYYY-MM-DD HH:MM ICT

- Goal: what you set out to do
- What changed: list files created/modified with brief descriptions
- TDD evidence: RED/GREEN commands run and their outcomes
- Tests run and results: which tests passed/failed
- Wiring verification evidence: how you confirmed the change works end-to-end
- Behavior changes and risk notes: anything that could affect other modules
- Follow-ups / known gaps: what remains incomplete
```

**Rules:**

- **MUST** write the log entry yourself in the conversation — do not delegate to a hook or script
- **MUST** include concrete evidence (actual commands, actual outputs) not vague claims
- **MUST NOT** write the entry before the work is done — the log records what happened, not what you plan to do
- If the stop hook warns that the coding log was not updated and the repo is dirty, treat it as a blocker — write the entry before finishing

**Finding the current coding log:** Look for the most recent file in `coding-logs/` by name (files are timestamped). If none exists for this session, create one with format: `YYYY-MM-DD-HH-MM-SS Coding Log (<topic>).md`

---

## Core Commands

### Development

- `npm run dev` — Start development server
- `npm run build` — Build all modules
- `npm test` — Run all tests
- `npm run test:unit` — Unit tests only (Jest)
- `npm run test:e2e` — E2E tests (Playwright)
- `npm run lint` — ESLint all code
- `npm run lint:fix` — Auto-fix linting issues
- `npm run typecheck` — TypeScript validation

### Database

- `npm run db:migrate` — Run pending migrations
- `npm run db:seed` — Seed MRL data + test fixtures
- `npm run db:reset` — Reset dev database (NEVER in production)

### Persistence Strategy (Explicit Decision)

- **Prisma** is used for **schema definition and migrations only** — `prisma/schema.prisma` defines all models, `prisma/migrations/` tracks schema changes
- **Raw SQL via `pg.Pool`** is used for **all runtime queries** — every module has a `*.pg-store.ts` using parameterized SQL (`$1, $2`) via the shared `DATABASE_POOL` token
- **Prisma Client is NOT used at runtime** — only in `prisma/seed.ts` for seeding
- This is intentional: raw SQL gives full control over query optimization, transaction-bound clones, and aggregation queries (analytics, cold-chain range queries)
- **MUST** follow when adding new modules: define models in `schema.prisma`, implement queries in `*.pg-store.ts`

### Quality Gates (run before PR)

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

---

## Project Structure

```
zrl/
├── CLAUDE.md                    # This file — root project rules
├── docs/
│   ├── PRD.md                   # Full product requirements (94K)
│   ├── RESOURCE-ESTIMATION.md   # Budget, timeline, team estimates
│   ├── AI-TOOLS-ANALYSIS.md     # AI tool comparison for development
│   ├── ARCHITECTURE-DIAGRAMS.md # System architecture diagrams
│   └── PROGRESS.md              # Session-by-session progress log
├── src/
│   ├── modules/                 # NestJS feature modules
│   │   ├── lane/                # Lane orchestration (core)
│   │   ├── rules-engine/        # M1: Market-specific MRL rules
│   │   ├── evidence/            # M2: Evidence graph + proof packs
│   │   ├── cold-chain/          # M3: Temperature SLA + excursion
│   │   ├── dispute/             # M4: Claim defense dossiers
│   │   └── mrv-lite/            # M5: Carbon/waste/ESG (optional)
│   ├── common/                  # Shared utilities, guards, decorators
│   │   ├── auth/                # JWT + MFA (TOTP) + RBAC
│   │   ├── hashing/             # SHA-256 content hashing service
│   │   ├── audit/               # Tamper-evident hash-chained log
│   │   └── dto/                 # Shared DTOs and validation pipes
│   ├── integrations/            # External API adapters
│   │   ├── lab-api/             # Central Lab Thai, SGS adapters
│   │   ├── logistics/           # Thai Airways, Kerry cold-chain
│   │   └── telemetry/           # IoT temperature data ingestion
│   ├── config/                  # App configuration, env validation
│   └── main.ts                  # NestJS bootstrap
├── frontend/                    # React/Next.js 16 application
│   ├── src/app/                 # Next.js App Router pages
│   ├── src/components/          # React components (to be created)
│   ├── src/hooks/               # Custom React hooks (to be created)
│   └── src/lib/                 # Utilities, API client (to be created)
├── prisma/                      # Prisma schema + migrations
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Migration files
├── rules/                       # Market rule definitions (YAML)
│   ├── japan/                   # Japan MAFF MRL (400+ substances)
│   ├── china/                   # China GACC/GB standards
│   └── korea/                   # Korea KFDA PLS
├── templates/                   # Proof pack Handlebars templates
│   ├── regulator/               # Customs/regulatory pack
│   ├── buyer/                   # Importer/retailer pack
│   └── defense/                 # Claim defense dossier
├── test/                        # Test infrastructure
│   ├── fixtures/                # MRL test data, sample artifacts
│   ├── integration/             # API integration tests
│   └── e2e/                     # Playwright E2E tests
├── coding-logs/                 # Session coding logs (Claude-authored)
├── scripts/                     # Dev utility scripts
│   └── taskmaster_tasks_guard.py # Task Master backup/restore
├── .taskmaster/                 # Task Master configuration
│   └── config.json              # Model settings (core mode)
├── .claude/                     # Claude Code project config
│   ├── settings.json            # Permissions + env (TASK_MASTER_TOOLS=core)
│   └── commands/                # Custom slash commands
├── .claudeignore                # Files excluded from Claude context
└── .gitignore
```

---

## Domain Knowledge (Critical)

### The Lane Concept

A **Lane** is the atomic unit: `{Exporter + Batch + Destination + Route + Evidence + Rules + SLA}`.
All operations, queries, and UI screens revolve around Lane ID. Never create orphaned evidence.

### Five Modules

| Module                 | Purpose                                             | Key Entities                               |
| ---------------------- | --------------------------------------------------- | ------------------------------------------ |
| **M1: Rules Engine**   | MRL validation, market-specific checklists          | `Market`, `RuleSet`, `Substance`           |
| **M2: Evidence Graph** | DAG of hash-linked artifacts, proof pack generation | `Artifact`, `EvidenceGraph`, `ProofPack`   |
| **M3: Cold-Chain SLA** | Fruit-specific temp monitoring, excursion detection | `TempReading`, `FruitProfile`, `Excursion` |
| **M4: Dispute Shield** | Claim defense dossier generation                    | `Claim`, `DefensePack`, `TimelineEvent`    |
| **M5: MRV-Lite**       | Carbon footprint, waste tracking, ESG reports       | `CarbonFootprint`, `ESGReport`             |

### Fruit Temperature Ranges (NOT generic 2–8°C)

| Fruit      | Optimal | Too Cold (<)          | Too Hot (>)              |
| ---------- | ------- | --------------------- | ------------------------ |
| Mango      | 10–13°C | <10°C chilling injury | >15°C premature ripening |
| Durian     | 12–15°C | <10°C flesh firmness  | >18°C fermentation       |
| Mangosteen | 10–13°C | <8°C transparency     | >15°C rapid rot          |
| Longan     | 2–5°C   | N/A                   | >8°C browning            |

### MRL Critical Substances (Japan vs Thai — up to 50x stricter)

| Substance        | Thai MRL | Japan MRL | Ratio |
| ---------------- | -------- | --------- | ----- |
| Chlorpyrifos     | 0.5      | 0.01      | 50x   |
| Dithiocarbamates | 2.0      | 0.1       | 20x   |
| Carbendazim      | 5.0      | 0.5       | 10x   |
| Cypermethrin     | 2.0      | 0.2       | 10x   |

### Four User Roles (RBAC)

| Role                        | Access                   | MFA       |
| --------------------------- | ------------------------ | --------- |
| **Exporter**                | Own lanes only           | Optional  |
| **Partner** (lab/logistics) | Assigned data only       | API Key   |
| **Admin**                   | All lanes (partial anon) | Mandatory |
| **Auditor**                 | Read-only all lanes      | Mandatory |

---

## Quick Find Commands

### Code Navigation

```bash
# Find a NestJS service
rg -n "export class.*Service" src/modules

# Find a controller endpoint
rg -n "@(Get|Post|Patch|Delete)" src/modules

# Find a DTO
rg -n "export class.*Dto" src/

# Find evidence hash usage
rg -n "sha256|createHash" src/

# Find rules YAML for a market
ls rules/japan/*.yaml
```

### Database

```bash
# Find Prisma model
rg -n "^model " prisma/schema.prisma

# Find migration
ls prisma/migrations/
```

### Frontend

```bash
# Find React component
rg -n "export (function|const) " frontend/components

# Find API route handler
rg -n "export async function (GET|POST)" frontend/app

# Find hook
rg -n "export function use[A-Z]" frontend/hooks
```

---

## Security Guidelines

### Secrets Management

- **NEVER** commit tokens, API keys, MRL database exports, or credentials
- Use `.env.local` for local secrets (in .gitignore)
- Use AWS KMS for production encryption keys
- PII must be redacted in logs — exporter names, contact info

### Audit Trail Integrity

- Audit log is **append-only** and **hash-chained** (SHA-256)
- Each entry references previous entry's hash — tampering invalidates chain
- Never delete, modify, or skip entries
- Retention: 10 years

### Data Classification

| Level                  | Examples                            | Encryption               |
| ---------------------- | ----------------------------------- | ------------------------ |
| L4 Highly Confidential | Production formulas, secret pricing | AES-256 + field-level    |
| L3 Confidential        | MRL test results, exporter accounts | AES-256 at rest, TLS 1.3 |
| L2 Internal            | Shipment data, checkpoint logs      | AES-256 at rest, TLS 1.3 |
| L1 Public              | Market regulations, platform info   | TLS 1.3                  |

---

## Git Workflow

- Branch from `main` for features: `feature/m1-rules-engine`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Module prefix recommended: `feat(m1): add Japan MRL validation`
- PRs require: passing tests, typecheck, lint, and 1 approval
- Squash commits on merge
- Delete branches after merge

---

## Testing Requirements

- **Unit tests:** All business logic, especially MRL validation and hash verification (≥80% coverage)
- **Integration tests:** API endpoints, database operations, lab API adapter
- **E2E tests:** Critical flows — lane creation → evidence upload → pack generation
- **Hash integrity tests:** Audit log chain verification — must pass 100% on every deploy
- **Performance tests:** 100 concurrent lanes, <2s p95 response (k6)
- **Security tests:** OWASP ZAP per sprint, zero critical/high

### Running Tests

```bash
npm test                           # All tests
npm run test:unit                  # Unit only
npx jest src/modules/rules-engine  # Single module
npm run test:e2e                   # Playwright E2E
npm run test:perf                  # k6 load test
```

---

## Available Tools

### Standard

- `rg`, `git`, `node`, `npm`, `npx` — standard dev tools
- `gh` — GitHub CLI for issues, PRs, releases
- `jq` — JSON processing (used by hooks)

### MCP Servers

- **Task Master** (`core` mode, 7 tools) — task management from PRD
- **Gemini** — supplementary AI for research

### Custom Slash Commands

- `/init-tasks` — Parse PRD into Task Master tasks (with overwrite guards)
- `/next-task` — Get and start next pending task (with actionability checks)
- `/task-status` — Show task progress summary (with anomaly detection)
- `/expand-task [id]` — Break a task into subtasks (with backup/restore safety)
- `/g-coding [task]` — Full TDD workflow: implement → test → wire → QCHECK → g-check → commit
- `/g-check [scope]` — QCHECK-style code review (working-tree, last-commit, pr N)
- `/g-review [subsystem]` — Holistic system/architecture review with drift analysis
- `/g-stack [action]` — Git branch and PR workflow (status, create, submit, sync)
- `/g-submit [name]` — Create branch + run gates + commit + push + create PR
- `/g-merge-train [PRs]` — Land multiple PRs: verify CI, merge sequentially

### Tool Permissions

- Read any file
- Write/edit code files
- Run tests, linters, type checkers
- **Ask first:** Edit `.env`, force push, delete databases, modify `.taskmaster/config.json`

---

## Task Master Integration

This project uses Task Master via MCP (`core` mode for token efficiency).

### Daily Workflow

1. `/task-status` — see what's active and what's next
2. `/next-task` — pick up and start next task
3. Work on implementation following this CLAUDE.md
4. Mark task done when complete
5. Append one-line to `docs/PROGRESS.md`

### After `/compact`

The `inject-task-context.sh` hook automatically re-injects active tasks and progress — no need to re-explain context.

### Task Master Rules

- **MUST** use `core` tool mode (env: `TASK_MASTER_TOOLS=core`) — 7 tools, ~5K tokens
- **MUST NOT** use `all` mode — 36+ tools wastes ~45K tokens
- PRD source: `docs/PRD.md`
- Progress log: `docs/PROGRESS.md`

---

## Specialized Context

When working in specific directories, refer to their CLAUDE.md for module-specific rules:

**Core Modules:**

- Lane (core): `src/modules/lane/CLAUDE.md`
- Rules Engine (M1): `src/modules/rules-engine/CLAUDE.md`
- Evidence Graph (M2): `src/modules/evidence/CLAUDE.md`
- Cold-Chain (M3): `src/modules/cold-chain/CLAUDE.md`
- Dispute Shield (M4): `src/modules/dispute/CLAUDE.md`
- MRV-Lite (M5): `src/modules/mrv-lite/CLAUDE.md`

**Common Services:**

- Hashing: `src/common/hashing/CLAUDE.md`
- Audit Trail: `src/common/audit/CLAUDE.md`
- Auth/RBAC: `src/common/auth/CLAUDE.md`

**Frontend:**

- Next.js app: `frontend/CLAUDE.md`

---

## Common Gotchas

- **MRL units:** Always mg/kg — never mix units
- **Temperature:** Tropical fruits have BOTH chilling injury AND heat damage — two-sided thresholds
- **Hash chain:** If you skip an audit entry, ALL subsequent hashes become invalid
- **Lane status:** State machine is enforced — cannot jump from CREATED to PACKED (must go through COLLECTING → VALIDATED)
- **Proof packs:** Three types (Regulator, Buyer, Defense) generated from the SAME evidence graph — different views, not different data
- **Seasonal alignment:** Mango peaks Feb–May, Durian May–Aug, Mangosteen May–Sep — development milestones must align with harvest seasons
- **PDPA:** Thai data protection law — 30-day SLA for data subject requests; breach notification within 72 hours
