Holistic system/architecture review with evidence-backed findings.

Arguments: $ARGUMENTS (optional: subsystem name like "evidence", "cold-chain", "frontend", or "system" for full review)

## Purpose

Provide a **holistic system review** covering:

- Architecture: boundaries, contracts, data flow, failure modes
- Correctness: traps, config drift, test gaps, operability
- Improvements: tactical fixes + strategic refactors
- Big changes: only when justified, with migration path

This skill is **review-only**. Implementation belongs in `/next-task` or direct coding.

## 1. Clarify Scope

If $ARGUMENTS is provided, use it. Otherwise default to "system" (entire repo).
Subsystems: lane, rules-engine, evidence, cold-chain, dispute, mrv-lite, auth, frontend, infra

## 2. Establish Intended Architecture

Read these files to understand what the system SHOULD be:

- `CLAUDE.md` (root) — rules, structure, domain knowledge
- `docs/PRD.md` — functional requirements (read relevant sections)
- Module-specific `CLAUDE.md` files for the subsystem under review
- `AGENTS.md` files for conventions

Extract intended:

- Service responsibilities + boundaries
- Lane-centric data model relationships
- Hash chain and audit integrity requirements
- RBAC scoping per role
- Temperature thresholds (fruit-specific)

## 3. Map "As-Is" Implementation

Use Auggie MCP to locate:

- Runtime entrypoints (`src/main.ts`, `src/app.module.ts`)
- Module boundaries and cross-module imports
- Database schema (`prisma/schema.prisma`) vs what modules expect
- Test coverage patterns
- Missing implementations vs PRD requirements

Produce a brief "As-Is" description of what exists today.

## 4. Analyze Drift

Create a drift matrix comparing intended vs implemented:

| Area | Intended (PRD/CLAUDE.md) | Implemented | Impact | Fix Direction |
| ---- | ------------------------ | ----------- | ------ | ------------- |

Focus on the top 5 most impactful drifts.

## 5. Output Report

```markdown
## System Review (<timestamp>)

### As-Is Pipeline

<Brief textual diagram of current data/control flow>

### Drift Matrix

| Area | Intended | Implemented | Impact | Fix |
| ---- | -------- | ----------- | ------ | --- |

### Critical Findings

- <finding with file reference>

### Nit-Picks / Nitty Gritty

- <sharp edges, naming drift, test fragility, config footguns>

### Tactical Improvements (1-3 days)

1. ...

### Strategic Improvements (1-6 weeks)

1. ...

### Big Architectural Changes (only if justified)

- Proposal: ...
  - Pros / Cons / Migration Plan / Tests

### Open Questions

- ...
```

## 6. Append to Coding Log

Find the most recent file in `coding-logs/` and append the review report.

## Quality Bar

- For each CRITICAL/HIGH item: cite at least one file reference
- Recommendations must be actionable (named files/modules)
- Include migration path for any structural change
- If "no major issues": explicitly say so and list residual risks
