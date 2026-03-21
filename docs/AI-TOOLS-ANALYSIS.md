# AI-ASSISTED DEVELOPMENT PLANNING TOOLS — COMPARATIVE ANALYSIS

**Project Context:** Zero-Reject Export Lane (ZRL)
**Stack:** NestJS (TypeScript) + React/Next.js + PostgreSQL + AWS
**Scale:** 5 modules, 11 screens, 65+ person-months, 7–8 FTE team
**Date:** March 21, 2026

---

## 1. MARKET OVERVIEW

The AI-assisted development tool market has matured rapidly. Key data points (Q1 2026):

- **85%** of developers regularly use AI coding tools; **55%** use AI agents
- **78%** of Fortune 500 companies have AI-assisted development in production
- Market projected to reach **$52.62B by 2030** (CAGR 46.3%)
- Claude Code reached **#1 most-loved tool (46%)** in 8 months, surpassing Cursor (19%) and GitHub Copilot (9%)
- AI-generated code now accounts for **~4% of all public GitHub commits** (doubling monthly)

**Implication for ZRL:** AI-assisted development is no longer optional — it is a productivity multiplier that can reduce the 65 person-month estimate by 25–40%, potentially saving 2.5–4.0M THB.

---

## 2. TOOL TAXONOMY

Five functional categories are relevant to ZRL development:

| Category | Function | When Used |
|----------|----------|-----------|
| **A. AI Code Editors / IDE Agents** | Day-to-day coding, refactoring, multi-file edits | Throughout development |
| **B. Autonomous Development Agents** | End-to-end feature implementation from specs | Well-defined tasks |
| **C. Rapid Prototyping / App Builders** | UI screen generation, MVP creation | Early phases, UI exploration |
| **D. AI-Enhanced Project Management** | Task breakdown, sprint planning, progress tracking | Planning & coordination |
| **E. Code Quality / Review Agents** | Test generation, code review, security scanning | QA & review phases |

---

## 3. CATEGORY A: AI CODE EDITORS & IDE AGENTS

### Comparative Matrix

| Criteria | Claude Code | Cursor | GitHub Copilot | Windsurf | Augment Code | Aider |
|----------|:----------:|:------:|:--------------:|:--------:|:------------:|:-----:|
| **Multi-file reasoning** | 10 | 9 | 7 | 8 | 9 | 7 |
| **Large codebase context** | 10 | 8 | 7 | 8 | 10 | 7 |
| **TypeScript/NestJS** | 10 | 9 | 8 | 8 | 8 | 8 |
| **React/Next.js** | 9 | 10 | 8 | 8 | 8 | 7 |
| **Agentic capability** | 10 | 8 | 7 | 8 | 7 | 6 |
| **Enterprise governance** | 7 | 6 | 10 | 6 | 9 | 3 |
| **UX / developer flow** | 7 | 10 | 8 | 8 | 7 | 5 |
| **Cost predictability** | 6 | 6 | 8 | 7 | 6 | 9 |
| **Community / ecosystem** | 9 | 9 | 10 | 7 | 6 | 7 |
| **TOTAL (/90)** | **78** | **75** | **73** | **68** | **70** | **59** |

### Individual Assessments

#### Claude Code (Anthropic) — Score: 78/90

| Aspect | Detail |
|--------|--------|
| **Category** | Terminal-based AI coding agent |
| **Model** | Claude Opus 4.6 / Sonnet 4.6 |
| **Pricing** | Pro $20/mo; Max 5x $100/mo; Max 20x $200/mo; Team $25–$150/user/mo |
| **Key Strength** | Best-in-class multi-step reasoning across large codebases; handles architectural decisions and complex refactors with full codebase awareness |
| **Key Weakness** | Terminal UX has learning curve; usage-based pricing can be unpredictable for heavy users |
| **ZRL Fit** | **STRONG** — Excels at cross-module architectural reasoning critical for a 5-module compliance platform. Ideal for: Rules Engine logic, Evidence Graph DAG design, audit trail hash-chain implementation. The 1M context window handles the full ZRL codebase simultaneously. |

#### Cursor (Anysphere) — Score: 75/90

| Aspect | Detail |
|--------|--------|
| **Category** | AI-native IDE (VS Code fork) |
| **Features** | Tab completion, Supercomplete, Composer (multi-file), Agent mode |
| **Pricing** | Pro $20/mo; Pro+ $60/mo; Ultra $200/mo; Teams $40/user/mo |
| **Key Strength** | Most fluid developer experience; Composer mode handles multi-file NestJS module edits seamlessly; excellent React + TypeScript + Tailwind integration |
| **Key Weakness** | Credit-based pricing (June 2025) caused cost unpredictability; premium model usage drains credits fast; power users report 2–3x cost increase |
| **ZRL Fit** | **STRONG** — Excellent for day-to-day TypeScript/NestJS/React development. Composer mode naturally aligns with editing across NestJS modules (e.g., updating a service + controller + DTO + test simultaneously). Best paired with Task Master MCP for structured planning. |

#### GitHub Copilot (Microsoft) — Score: 73/90

| Aspect | Detail |
|--------|--------|
| **Category** | IDE-integrated assistant + agentic workspace |
| **Features** | Inline suggestions, Agent Mode, Copilot Workspace (issue-to-PR), Knowledge Bases, BYOK |
| **Pricing** | Pro $10/mo; Pro+ $39/mo; Business $19/user/mo; Enterprise $39/user/mo (requires GH Enterprise Cloud $21/user/mo, total ~$60) |
| **Key Strength** | Largest market share (37%); strongest enterprise governance (audit, policies, RBAC); native GitHub integration; 56% adoption at companies >10K employees |
| **Key Weakness** | "Most loved" rating only 9%; base model (GPT-4o) perceived weaker than Claude for complex reasoning; enterprise tier expensive at $60/user/mo |
| **ZRL Fit** | **MODERATE-STRONG** — Best if team is heavily GitHub-centric and values enterprise audit/compliance controls. Copilot Workspace is valuable for converting GitHub Issues to PRs. Less ideal for complex architectural reasoning across 5 modules. |

#### Windsurf (Cognition) — Score: 68/90

| Aspect | Detail |
|--------|--------|
| **Category** | AI-native IDE with agentic capabilities |
| **Features** | Cascade agent, Arena Mode (model comparison), Plan Mode, in-IDE previews |
| **Pricing** | Free tier; credit-based paid plans |
| **Key Strength** | #1 in LogRocket AI Dev Tool Power Rankings (Feb 2026); Cascade agent strong at multi-step reasoning; Arena Mode uniquely compares models side-by-side |
| **Key Weakness** | Cognition acquisition (Dec 2025) creates strategic uncertainty; credit system with multipliers confusing |
| **ZRL Fit** | **MODERATE** — Good IDE, but acquisition by Cognition (Devin makers) may shift focus. Worth evaluating if team values model comparison. |

#### Augment Code — Score: 70/90

| Aspect | Detail |
|--------|--------|
| **Category** | Enterprise AI coding assistant |
| **Features** | Context Engine (live codebase understanding), ISO/IEC 42001 certified, SOC 2 Type II |
| **Pricing** | Indie $20/mo; Standard $60/mo; Max $200/mo; Enterprise custom |
| **Key Strength** | Best context engine for understanding cross-module dependencies; first AI coding assistant with ISO/IEC 42001 AI governance certification; 40% fewer hallucinations |
| **Key Weakness** | Credit-based pricing caused 2–3x cost increases for power users; smaller community |
| **ZRL Fit** | **MODERATE-STRONG** — Context Engine is especially valuable for understanding M1↔M2↔M3 module dependencies in the ZRL platform. ISO 42001 certification relevant for a compliance-focused platform. |

#### Aider (Open Source) — Score: 59/90

| Aspect | Detail |
|--------|--------|
| **Category** | Open-source terminal AI pair programmer |
| **Pricing** | Free; pay only for LLM API usage |
| **Key Strength** | No vendor lock-in; free; excellent git integration; supports any model (Claude, GPT, DeepSeek, local) |
| **Key Weakness** | No enterprise support; requires self-setup; less polished UX |
| **ZRL Fit** | **MODERATE** — Good for cost-conscious phases or individual contributors who want full control. Less suitable for team coordination on a 65+ person-month project. |

---

## 4. CATEGORY B: AUTONOMOUS DEVELOPMENT AGENTS

### Comparative Matrix

| Criteria | Devin 2.0 | OpenAI Codex | Factory AI |
|----------|:---------:|:------------:|:----------:|
| **Autonomous task completion** | 10 | 8 | 7 |
| **Code quality** | 8 | 8 | 7 |
| **Complex architecture** | 6 | 6 | 6 |
| **TypeScript/NestJS support** | 8 | 8 | 8 |
| **Parallel execution** | 7 | 10 | 8 |
| **Enterprise readiness** | 8 | 7 | 7 |
| **Cost efficiency** | 6 | 8 | 7 |
| **Human oversight controls** | 7 | 7 | 8 |
| **TOTAL (/80)** | **60** | **62** | **58** |

### Individual Assessments

#### Devin 2.0 (Cognition) — Score: 60/80

| Aspect | Detail |
|--------|--------|
| **Category** | Autonomous AI software engineer |
| **Pricing** | Starts at $20/mo; enterprise custom |
| **Key Metrics** | 67% PR merge rate (up from 34%); 4x faster than v1; 13.86% autonomous issue resolution (vs 1.96% industry average) |
| **Key Strength** | Most advanced autonomous agent; end-to-end feature implementation; Goldman Sachs adopted as "Employee #1" |
| **Key Weakness** | Struggles with ambiguous requirements and complex architectural decisions; best with clear, well-scoped tasks |
| **ZRL Fit** | **MODERATE** — Useful for well-defined, scoped tasks (e.g., "build CRUD endpoint for checkpoints," "write unit tests for MRL validation"). Not suitable for designing the Evidence Graph DAG architecture or cold-chain ML models. Best as a **supplement to human architects**. |

#### OpenAI Codex — Score: 62/80

| Aspect | Detail |
|--------|--------|
| **Category** | Cloud-based autonomous coding agent |
| **Pricing** | Included in ChatGPT Plus ($20/mo, 30–150 tasks/5hrs); Pro $200/mo (6x usage); API: $2/$10 per M tokens |
| **Key Strength** | Parallel task execution across multiple sandboxes; Automations for routine work (issue triage, CI/CD monitoring); competitive pricing |
| **Key Weakness** | Cloud-only execution (no local codebase awareness without upload); newer entrant in agent space |
| **ZRL Fit** | **MODERATE** — Parallel execution valuable for multi-module project (run bug fixes on M1 and M3 simultaneously). Cloud-only execution may concern teams handling sensitive MRL compliance data. |

#### Factory AI — Score: 58/80

| Aspect | Detail |
|--------|--------|
| **Category** | Agent-native development platform with specialized "Droids" |
| **Pricing** | Starts at $20/mo; token-based billing |
| **Key Strength** | Specialized agents (test generation Droid, documentation Droid, migration Droid); supports all major LLMs; multi-surface operation |
| **Key Weakness** | Less well-known; limited public benchmarks; enterprise pricing opaque |
| **ZRL Fit** | **MODERATE** — Specialized Droid approach aligns with ZRL's modular structure (e.g., Test Droid for M1 MRL validation tests, Doc Droid for API documentation). Worth evaluating for structured task delegation. |

---

## 5. CATEGORY C: RAPID PROTOTYPING & APP BUILDERS

### Comparative Matrix

| Criteria | v0 (Vercel) | Bolt.new | Lovable | Replit Agent |
|----------|:----------:|:--------:|:-------:|:------------:|
| **UI quality** | 10 | 7 | 9 | 6 |
| **React/Tailwind output** | 10 | 8 | 9 | 7 |
| **Full-stack capability** | 3 | 8 | 9 | 9 |
| **Large project suitability** | 4 | 3 | 5 | 4 |
| **NestJS backend support** | 1 | 6 | 3 | 5 |
| **Cost efficiency** | 6 | 7 | 7 | 7 |
| **TOTAL (/60)** | **34** | **39** | **42** | **38** |

### ZRL Suitability Assessment

| Tool | Best For | Limitation for ZRL | Recommendation |
|------|----------|-------------------|----------------|
| **v0** | Generating individual React screen components with Tailwind | Frontend only; no NestJS backend support | Use for **rapid UI prototyping** of 11 screens; export components into main codebase |
| **Bolt.new** | Quick full-stack prototypes | Context loss at 15–20+ components; breaks down at ZRL's scale | **Not recommended** for production; possibly useful for isolated screen prototypes |
| **Lovable** | Complete MVP with auth + DB + hosting | React + shadcn/ui only; not designed for complex enterprise architectures | Use for **demo/pitch MVPs** to show NIA stakeholders; not for production platform |
| **Replit Agent** | Greenfield apps with built-in infrastructure | Cloud-only; NestJS support unclear; not for existing codebases | **Not recommended** for ZRL's structured enterprise architecture |

**Verdict:** These tools are **supplementary** for ZRL — useful for rapid UI exploration and stakeholder demos, but the production platform requires dedicated IDE-based development.

---

## 6. CATEGORY D: AI-ENHANCED PROJECT MANAGEMENT

### Comparative Matrix

| Criteria | Task Master (MCP) | Jira + AI | Linear + AI | ClickUp + Brain |
|----------|:-----------------:|:---------:|:-----------:|:---------------:|
| **PRD-to-tasks breakdown** | 10 | 5 | 5 | 7 |
| **AI task generation** | 10 | 6 | 7 | 8 |
| **Dependency management** | 8 | 10 | 7 | 8 |
| **Sprint planning** | 5 | 10 | 8 | 8 |
| **Developer experience** | 8 | 5 | 10 | 6 |
| **Enterprise reporting** | 3 | 10 | 7 | 8 |
| **AI agent integration** | 10 | 4 | 5 | 5 |
| **Cost** | 10 (free) | 7 | 8 | 8 |
| **TOTAL (/80)** | **64** | **57** | **57** | **58** |

### Individual Assessments

#### Task Master (claude-task-master) — Score: 64/80

| Aspect | Detail |
|--------|--------|
| **Category** | AI-powered task management via MCP (Model Context Protocol) |
| **Pricing** | Free, open source |
| **Key Stats** | 15,500 GitHub stars in 9 weeks; 90% error reduction with Cursor; 70%+ token reduction with 36 MCP tools |
| **Key Strength** | Parses PRDs into structured tasks with dependency graphs and complexity scores; autopilot TDD mode; bridges PM and AI coding; integrates with Cursor, Windsurf, Claude Code |
| **Key Weakness** | Community-supported only; relatively new; not a standalone PM tool (no Gantt, burndown, etc.) |
| **ZRL Fit** | **STRONG** — ZRL's PRD document (Part 1 of the spec) can be directly fed into Task Master to generate a structured task breakdown with dependencies across M1–M5. The autopilot TDD mode aligns with the 80%+ code coverage requirement. **Best paired with Jira or Linear** for enterprise PM features. |

#### Jira + AI (Atlassian) — Score: 57/80

| Aspect | Detail |
|--------|--------|
| **Pricing** | Free (10 users); Standard $7.53/user/mo; Premium $13.53/user/mo |
| **Key Strength** | Industry standard; strongest enterprise features (audit, compliance, advanced reporting); handles complex multi-team workflows; extensive integration ecosystem |
| **Key Weakness** | AI features are incremental, not transformative; steep learning curve; can become bloated |
| **ZRL Fit** | **STRONG** for enterprise tracking. Best for: quarterly milestone reporting to NIA, multi-module dependency tracking, exporter pilot coordination. Overkill for a 7–8 person team unless NIA reporting requires it. |

#### Linear + AI — Score: 57/80

| Aspect | Detail |
|--------|--------|
| **Pricing** | Free (250 issues); Standard $8/user/mo; Plus $14/user/mo |
| **Key Strength** | Fastest, most responsive PM tool; clean keyboard-driven UX; excellent GitHub integration; developer-loved |
| **Key Weakness** | Less portfolio-level reporting than Jira; better for individual teams than org-wide management |
| **ZRL Fit** | **MODERATE-STRONG** — Excellent developer experience for a focused 7–8 person team. May need supplementing with spreadsheets or Notion for NIA quarterly reports. |

#### ClickUp + Brain — Score: 58/80

| Aspect | Detail |
|--------|--------|
| **Pricing** | Free (limited); Unlimited $7/user/mo; Business $12/user/mo |
| **Key Strength** | Autopilot AI Project Manager for autonomous task generation and assignment; all-in-one (PM + docs + wiki) |
| **Key Weakness** | Feature overload; AI is add-on; slower than Linear; less developer-focused |
| **ZRL Fit** | **MODERATE** — Good if team wants PM + documentation + wiki in one platform. Less developer-centric than Linear or Task Master. |

---

## 7. CATEGORY E: CODE QUALITY & REVIEW AGENTS

### Comparative Matrix

| Criteria | Qodo (CodiumAI) | Copilot Code Review | SonarQube + AI | Snyk + AI |
|----------|:---------------:|:-------------------:|:--------------:|:---------:|
| **Test generation** | 10 | 6 | 5 | 3 |
| **Code review accuracy** | 10 | 7 | 8 | 6 |
| **Security scanning** | 7 | 6 | 9 | 10 |
| **TypeScript/NestJS** | 8 | 8 | 8 | 8 |
| **CI/CD integration** | 8 | 9 | 10 | 9 |
| **Cost** | 7 | 7 | 6 | 6 |
| **TOTAL (/60)** | **50** | **43** | **46** | **42** |

#### Qodo 2.0 — Score: 50/60

| Aspect | Detail |
|--------|--------|
| **Key Features** | Multi-agent code review architecture; 15+ agentic workflows; highest recall and F1 score in AI code review benchmarks; PR history analysis |
| **ZRL Fit** | **STRONG as supplementary tool** — For a compliance platform handling audit-grade evidence, automated test generation and rigorous code review are critical. Qodo can auto-generate tests for MRL validation logic (400+ substances) and hash chain integrity checks. |

---

## 8. ZRL-SPECIFIC TOOL RECOMMENDATIONS

### 8.1 Recommended Toolchain

Based on ZRL's specific requirements (multi-module compliance platform, NestJS/React/TypeScript, 7–8 FTE team, NIA-funded with enterprise compliance needs), here is the recommended integrated toolchain:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ZRL DEVELOPMENT TOOLCHAIN                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  PLANNING LAYER                                                     │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │  Task Master    │───►│  Linear / Jira  │                        │
│  │  (PRD → Tasks)  │    │ (Sprint Mgmt)   │                        │
│  └────────┬────────┘    └────────┬────────┘                        │
│           │                      │                                   │
│           ▼                      ▼                                   │
│  DEVELOPMENT LAYER                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │  Claude Code    │    │    Cursor       │                        │
│  │  (Architecture, │    │ (Day-to-day     │                        │
│  │   Complex Logic)│    │  coding, UI)    │                        │
│  └────────┬────────┘    └────────┬────────┘                        │
│           │                      │                                   │
│           ▼                      ▼                                   │
│  QUALITY LAYER                                                      │
│  ┌─────────────────┐    ┌─────────────────┐                        │
│  │  Qodo 2.0      │    │  GitHub Actions  │                        │
│  │  (Test Gen,     │    │  (CI/CD,         │                        │
│  │   Code Review)  │    │   OWASP ZAP)    │                        │
│  └─────────────────┘    └─────────────────┘                        │
│                                                                      │
│  SUPPLEMENTARY (as needed)                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                           │
│  │ v0       │ │ Devin    │ │ Codex    │                           │
│  │(UI proto)│ │(scoped   │ │(parallel │                           │
│  │          │ │ tasks)   │ │ tasks)   │                           │
│  └──────────┘ └──────────┘ └──────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Tool Assignment by Module

| Module | Primary Tool | Secondary Tool | Rationale |
|--------|-------------|---------------|-----------|
| **M1: Rules Engine** | Claude Code | Cursor | Complex validation logic across 400+ MRL substances requires deep reasoning; Claude Code handles rule parser design and multi-market rule architecture |
| **M2: Evidence Graph** | Claude Code | Cursor | DAG data model, SHA-256 hash chain, and graph traversal algorithms require architectural reasoning; Cursor for day-to-day CRUD and template work |
| **M3: Cold-Chain SLA** | Cursor + Claude Code | Devin (for tests) | ML shelf-life model benefits from Claude Code's reasoning; Cursor for Recharts visualization; Devin can generate excursion detection unit tests |
| **M4: Dispute Shield** | Cursor | Claude Code (for forensics) | Mostly CRUD + PDF generation (Cursor excels); forensics engine logic benefits from Claude Code |
| **M5: MRV-Lite** | Cursor | Devin/Codex | Straightforward calculations; can delegate test generation and CRUD to autonomous agents |
| **Frontend (11 screens)** | Cursor | v0 (prototyping) | Cursor is best for React + TypeScript + Tailwind; v0 for rapid screen prototyping before implementation |
| **Infrastructure** | Claude Code | — | Terraform IaC, K8s manifests, CI/CD pipeline configuration benefit from Claude Code's multi-file reasoning |
| **Testing** | Qodo 2.0 | Cursor | Qodo for auto-test generation; Cursor for manual test writing and debugging |

### 8.3 Tool Assignment by Development Phase

| Phase | Months | Primary Tools | Usage Pattern |
|-------|--------|---------------|--------------|
| **Planning** | 0–1 | Task Master + Linear | Feed PRD into Task Master → generate dependency-aware tasks → import to Linear for sprint planning |
| **Architecture** | 1–2 | Claude Code | Design data models, API schemas, module boundaries, hash chain implementation |
| **MVP Development** | 2–4 | Cursor + Claude Code | Cursor for 70% of daily coding; Claude Code for complex logic (MRL validation, DAG engine) |
| **Pilot Development** | 4–8 | Cursor + Devin/Codex | Cursor for feature work; Devin for scoped tasks (endpoint generation, test writing) |
| **QA & Hardening** | 6–10 | Qodo + Cursor | Qodo for automated test generation; Cursor for bug fixes and optimization |
| **Scale Preparation** | 10–12 | Claude Code + Cursor | Claude Code for performance optimization and infrastructure scaling |

---

## 9. COST ANALYSIS

### 9.1 Monthly Tool Cost Per Developer

| Toolchain Option | Tools | Monthly/Dev | Annual (8 devs) |
|-----------------|-------|:-----------:|:---------------:|
| **Option A: Premium** | Claude Code Max 5x ($100) + Cursor Pro ($20) + Linear Standard ($8) + Qodo paid ($15) | **$143** | **$13,728** |
| **Option B: Balanced** | Claude Code Pro ($20) + Cursor Pro ($20) + Linear Standard ($8) + Qodo free | **$48** | **$4,608** |
| **Option C: Enterprise** | GitHub Copilot Enterprise ($60) + Jira Premium ($14) + Qodo paid ($15) | **$89** | **$8,544** |
| **Option D: Budget** | Claude Code Pro ($20) + Aider (free) + Task Master (free) + Linear free | **$20** | **$1,920** |

### 9.2 Annual Cost in THB (at 35 THB/USD)

| Option | Annual THB | % of Dev Budget (5.46M) | Productivity Gain | Net ROI |
|--------|-----------|:-----------------------:|:-----------------:|:-------:|
| **A: Premium** | 480,480 | 8.8% | 35–40% | **Positive** — saves 1.9–2.2M THB in dev time |
| **B: Balanced** | 161,280 | 3.0% | 25–30% | **Strongly Positive** — saves 1.4–1.6M THB |
| **C: Enterprise** | 299,040 | 5.5% | 25–30% | **Positive** — saves 1.4–1.6M THB |
| **D: Budget** | 67,200 | 1.2% | 15–20% | **Positive** — saves 0.8–1.1M THB |

### 9.3 Recommendation

**Option B (Balanced)** offers the best ROI for ZRL's budget constraints:
- Claude Code Pro for architectural decisions and complex logic
- Cursor Pro for day-to-day development (best React/NestJS/TypeScript experience)
- Linear Standard for sprint management (developer-friendly, fast)
- Task Master (free) for PRD-to-task breakdown
- Qodo free tier for test generation

**Total: ~161,280 THB/year (~$4,608 USD) for 8 developers**
**Expected productivity gain: 25–30% → ~1.5M THB saved in development time**

Upgrade to **Option A (Premium)** once seed funding is secured (Month 12–18) for the scaling phase.

---

## 10. PRODUCTIVITY IMPACT ESTIMATION

### 10.1 Impact on ZRL Development Timeline

| Activity | Without AI Tools | With AI Tools (Option B) | Savings |
|----------|:----------------:|:------------------------:|:-------:|
| M1 Rules Engine | 9.0 PM | 6.5 PM | 28% |
| M2 Evidence Graph | 13.65 PM | 9.5 PM | 30% |
| M3 Cold-Chain SLA | 9.6 PM | 7.0 PM | 27% |
| M4 Dispute Shield | 5.5 PM | 3.8 PM | 31% |
| M5 MRV-Lite | 3.4 PM | 2.3 PM | 32% |
| Supporting Services | 6.55 PM | 4.5 PM | 31% |
| Frontend (11 screens) | 13.0 PM | 9.0 PM | 31% |
| Infrastructure | 5.25 PM | 4.0 PM | 24% |
| **TOTAL** | **65.95 PM** | **46.6 PM** | **29%** |

### 10.2 Where AI Tools Add Most Value for ZRL

| Task Type | AI Productivity Multiplier | Example in ZRL |
|-----------|:--------------------------:|---------------|
| **Boilerplate / CRUD** | 3–5x | NestJS module scaffolding, DTOs, controllers, basic services |
| **Test generation** | 3–4x | MRL validation tests (400+ substances), hash chain integrity tests |
| **Documentation** | 4–6x | API docs (OpenAPI), inline code documentation |
| **Data transformation** | 2–3x | MRL database loading, emission factor tables, rule template parsing |
| **UI component creation** | 2–4x | React components with Tailwind, form layouts, table components |
| **Complex algorithms** | 1.3–1.8x | Evidence Graph DAG, excursion detection, shelf-life ML model |
| **Architecture design** | 1.2–1.5x | System design still requires human judgment; AI assists with exploration |
| **Domain logic** | 1.1–1.3x | MRL regulatory rules, VHT protocols — requires domain expert validation |

**Key Insight:** AI tools deliver the highest ROI on high-volume, well-structured tasks (CRUD, tests, UI components). They provide significant but more modest gains on complex algorithmic and domain-specific work. For ZRL, this means:
- **High AI leverage:** Frontend screens, NestJS module scaffolding, test suites, API documentation
- **Moderate AI leverage:** Rules Engine validation logic, Pack Builder templates, alert systems
- **Low AI leverage:** MRL regulatory data entry (domain expert required), Japanese buyer format negotiation, excursion detection algorithm calibration

---

## 11. RISK CONSIDERATIONS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Vendor lock-in** | Medium | Use multiple tools (Claude Code + Cursor); avoid single-vendor dependency; keep Task Master (open source) as planning backbone |
| **Cost escalation** | Medium | Credit-based pricing (Cursor, Augment) can spike unpredictably; set monthly budget caps; monitor usage weekly |
| **Code quality / hallucinations** | High | All AI-generated code must pass: (1) human code review, (2) automated tests (80%+ coverage), (3) OWASP security scan. Never deploy unreviewed AI code. |
| **Compliance data exposure** | High | MRL data and exporter business data must not be sent to AI tools without review. Use local models or enterprise tiers with data retention guarantees for sensitive data. |
| **Over-reliance on AI** | Medium | AI cannot replace domain expertise (MRL regulations, VHT protocols, Japanese buyer requirements). Domain expert (0.5 FTE) remains essential regardless of AI tooling. |
| **Tool discontinuation** | Low | Mitigated by using mainstream tools (Claude Code, Cursor, GitHub Copilot) with large user bases and strong funding |

---

## 12. FINAL VERDICT

### Tier 1 — Essential (Use from Day 1)

| Tool | Role | Monthly Cost (team of 8) | Priority |
|------|------|:------------------------:|:--------:|
| **Claude Code Pro** | Architecture, complex logic, multi-file reasoning | $160 (8×$20) | Critical |
| **Cursor Pro** | Day-to-day IDE coding, React/NestJS/TypeScript | $160 (8×$20) | Critical |
| **Task Master** | PRD → structured task breakdown with dependencies | $0 (open source) | Critical |
| **Linear Standard** | Sprint management, issue tracking | $64 (8×$8) | High |

### Tier 2 — High Value (Add in Month 2–3)

| Tool | Role | Monthly Cost | Priority |
|------|------|:------------:|:--------:|
| **Qodo free** | Automated test generation, code review | $0 | High |
| **v0** | Rapid React UI prototyping for 11 screens | Usage-based (~$50/mo) | Medium |

### Tier 3 — Situational (Evaluate per phase)

| Tool | Role | When to Use |
|------|------|------------|
| **Devin 2.0** | Autonomous implementation of well-scoped tasks | Phase 2–3 for parallel task execution |
| **OpenAI Codex** | Parallel bug fixes and test generation | When team needs to parallelize across modules |
| **GitHub Copilot Enterprise** | If NIA requires enterprise governance audit | Only if regulatory compliance demands it |

### Total Recommended Budget

| Period | Tool Cost (THB) | % of Dev Budget |
|--------|:--------------:|:---------------:|
| **Year 1 (NIA Phase)** | ~161,000 | 2.9% |
| **Year 2 (Scale Phase)** | ~350,000 | 4.5% |

**Expected Return:** 25–30% reduction in person-months → **~1.4–1.6M THB saved** in Year 1, yielding **~9:1 ROI** on tool investment.

---

*Analysis based on publicly available data as of March 2026.*
*All pricing subject to change. Verify current rates before procurement.*
