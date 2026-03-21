#!/usr/bin/env python3
"""
Synchronize root and local AGENTS.md files with deterministic repo state.

This script updates only explicitly marked auto-generated sections. It is meant
to run safely from hooks, so it is idempotent and does not depend on git state.

Update situations covered:
- Root AGENTS.md:
  - scaffold directory presence/absence changes (`src/`, `frontend/`, `prisma/`,
    `test/`, `rules/`, `templates/`)
  - local AGENTS.md files appear or disappear
  - root or frontend package scripts change install/build/test/lint commands
- `frontend/AGENTS.md`:
  - `frontend/package.json` dependency/script changes
  - app source layout changes under `frontend/src/`
- `src/AGENTS.md`:
  - `src/main.ts`, `src/app.module.ts`, `src/common/`, `src/modules/`, or
    module-local `CLAUDE.md` / `AGENTS.md` files change
- `prisma/AGENTS.md`:
  - schema provider/output changes
  - migration directory appears or changes materially
- `test/AGENTS.md`:
  - e2e harness files or unit/e2e test layout changes
- future local guides:
  - create `rules/AGENTS.md` when `rules/` exists with real files
  - create `templates/AGENTS.md` when `templates/` exists with real files
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable


AUTO_BLOCK_RE = re.compile(
    r"<!-- BEGIN AUTO-GENERATED:(?P<name>[A-Z0-9_]+) -->\n(?P<body>.*?)<!-- END AUTO-GENERATED:(?P=name) -->",
    re.DOTALL,
)

ROOT_TARGETS = ("src", "frontend", "prisma", "test", "rules", "templates")


@dataclass
class RepoState:
    root: Path
    root_scripts: dict[str, str]
    frontend_scripts: dict[str, str]
    frontend_deps: dict[str, str]
    frontend_app_files: list[str]
    frontend_extra_dirs: list[str]
    src_modules: list[str]
    src_common_dirs: list[str]
    src_local_guides: list[str]
    prisma_provider: str | None
    prisma_output: str | None
    prisma_has_migrations: bool
    prisma_migration_count: int
    test_files: list[str]
    unit_test_count: int
    local_guides: list[str]
    present_root_targets: list[str]
    rules_markets: list[str]
    templates_groups: list[str]


@dataclass
class GuideSpec:
    relative_path: str
    should_exist: Callable[[RepoState], bool]
    template: Callable[[RepoState], str]
    blocks: dict[str, Callable[[RepoState], str]]


def read_json(path: Path) -> dict:
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def list_real_files(directory: Path) -> list[Path]:
    if not directory.is_dir():
        return []
    ignored_dirs = {".git", "node_modules", ".next", "dist", "build", "coverage", ".taskmaster"}
    files: list[Path] = []
    for path in directory.rglob("*"):
        if any(part in ignored_dirs for part in path.parts):
            continue
        if path.is_file():
            files.append(path)
    return sorted(files)


def collect_repo_state(root: Path) -> RepoState:
    package_json = read_json(root / "package.json")
    frontend_package = read_json(root / "frontend" / "package.json")
    prisma_schema = (root / "prisma" / "schema.prisma").read_text(encoding="utf-8") if (root / "prisma" / "schema.prisma").is_file() else ""

    provider_match = re.search(r'datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"', prisma_schema, re.DOTALL)
    output_match = re.search(r'output\s*=\s*"([^"]+)"', prisma_schema)

    frontend_app_files = [
        str(path.relative_to(root / "frontend")).replace("\\", "/")
        for path in list_real_files(root / "frontend" / "src" / "app")
    ]
    frontend_extra_dirs = sorted(
        path.name
        for path in (root / "frontend" / "src").iterdir()
        if path.is_dir() and path.name != "app"
    ) if (root / "frontend" / "src").is_dir() else []

    src_modules = sorted(path.name for path in (root / "src" / "modules").iterdir() if path.is_dir()) if (root / "src" / "modules").is_dir() else []
    src_common_dirs = sorted(path.name for path in (root / "src" / "common").iterdir() if path.is_dir()) if (root / "src" / "common").is_dir() else []
    src_local_guides = sorted(
        str(path.relative_to(root / "src")).replace("\\", "/")
        for path in list_real_files(root / "src")
        if path.name in {"CLAUDE.md", "AGENTS.md"} and path.parent != (root / "src")
    )

    prisma_migrations_dir = root / "prisma" / "migrations"
    prisma_migration_files = list_real_files(prisma_migrations_dir)

    test_files = []
    for path in list_real_files(root / "test"):
        if path.name == "AGENTS.md":
            continue
        if "__pycache__" in path.parts or path.suffix == ".pyc":
            continue
        test_files.append(str(path.relative_to(root / "test")).replace("\\", "/"))
    unit_test_count = len(list((root / "src").rglob("*.spec.ts"))) if (root / "src").is_dir() else 0

    local_guides = sorted(
        str(path.relative_to(root)).replace("\\", "/")
        for path in list_real_files(root)
        if path.name == "AGENTS.md" and path.relative_to(root) != Path("AGENTS.md")
    )
    present_root_targets = sorted(name for name in ROOT_TARGETS if (root / name).is_dir())

    rules_markets = sorted(path.name for path in (root / "rules").iterdir() if path.is_dir()) if (root / "rules").is_dir() else []
    templates_groups = sorted(path.name for path in (root / "templates").iterdir() if path.is_dir()) if (root / "templates").is_dir() else []

    return RepoState(
        root=root,
        root_scripts=package_json.get("scripts", {}),
        frontend_scripts=frontend_package.get("scripts", {}),
        frontend_deps={**frontend_package.get("dependencies", {}), **frontend_package.get("devDependencies", {})},
        frontend_app_files=frontend_app_files,
        frontend_extra_dirs=frontend_extra_dirs,
        src_modules=src_modules,
        src_common_dirs=src_common_dirs,
        src_local_guides=src_local_guides,
        prisma_provider=provider_match.group(1) if provider_match else None,
        prisma_output=output_match.group(1) if output_match else None,
        prisma_has_migrations=prisma_migrations_dir.is_dir(),
        prisma_migration_count=len(prisma_migration_files),
        test_files=test_files,
        unit_test_count=unit_test_count,
        local_guides=local_guides,
        present_root_targets=present_root_targets,
        rules_markets=rules_markets,
        templates_groups=templates_groups,
    )


def format_bullets(lines: list[str]) -> str:
    return "\n".join(f"- {line}" for line in lines)


def replace_blocks(content: str, blocks: dict[str, str]) -> str:
    for name, rendered in blocks.items():
        begin = f"<!-- BEGIN AUTO-GENERATED:{name} -->"
        end = f"<!-- END AUTO-GENERATED:{name} -->"
        replacement = f"{begin}\n{rendered.rstrip()}\n{end}"
        pattern = re.compile(
            rf"{re.escape(begin)}\n.*?{re.escape(end)}",
            re.DOTALL,
        )
        if not pattern.search(content):
            raise ValueError(f"Missing auto-generated block {name}")
        content = pattern.sub(replacement, content)
    return content


def build_root_project_snapshot(state: RepoState) -> str:
    active_guides = [f"`{guide}`" for guide in state.local_guides if not guide.startswith(("rules/", "templates/"))]
    extra_guides = [f"`{guide}`" for guide in state.local_guides if guide.startswith(("rules/", "templates/"))]
    guide_list = active_guides + extra_guides
    guide_sentence = ", ".join(guide_list) if guide_list else "no subdirectory `AGENTS.md` files"
    return format_bullets(
        [
            "Repo type: single-project repo with an initial scaffold in place.",
            "Primary stack target: NestJS + TypeScript backend, Next.js frontend, PostgreSQL, AWS S3, Kafka, Redis.",
            "Core domain: Thai fresh-fruit export compliance, evidence integrity, cold-chain monitoring, and dispute-defense workflows.",
            f"This root file contains repo-wide guidance. Nearer `AGENTS.md` files currently exist for {guide_sentence}; prefer them when working in those areas."
            if guide_list
            else "This root file contains repo-wide guidance. Add nearer `AGENTS.md` files only when sub-areas have real, stable code and conventions.",
        ]
    )


def build_root_current_repo_state(state: RepoState) -> str:
    scaffold_parts = []
    if "src" in state.present_root_targets:
        scaffold_parts.append("NestJS app wiring under `src/`")
    if "frontend" in state.present_root_targets:
        scaffold_parts.append("a Next.js app under `frontend/`")
    if "prisma" in state.present_root_targets:
        scaffold_parts.append("a Prisma schema under `prisma/`")
    if "test" in state.present_root_targets:
        scaffold_parts.append("Jest test wiring under `test/`")
    first_line = "The repo now has a real scaffold: " + ", ".join(scaffold_parts) + "." if scaffold_parts else "The repo is still mostly docs-first with no stable app scaffold."

    state_lines = [
        first_line,
        "The scaffold is still early-stage. Prefer extending what exists over introducing new top-level architecture prematurely.",
    ]
    if "rules" in state.present_root_targets:
        state_lines.append("`rules/` is now on disk. Keep rule definitions explicit and data-driven, and keep a local guide there aligned with the actual market-file structure.")
    else:
        state_lines.append("`rules/` and other planned directories are still not on disk; do not create local guidance files for absent areas just to fill the map.")
    if "templates" in state.present_root_targets:
        state_lines.append("`templates/` is now on disk. Keep proof-pack template guidance close to the actual template groups and generation flow.")
    state_lines.extend(
        [
            "Task Master is installed in project scope and intentionally limited to `core` tools to reduce token usage.",
            "Global Claude hooks enforce protected-file checks, LEVER warnings, dangerous-command blocking, formatting, task-context injection, and Coding Log reminders.",
            "Root guidance should stay stable; implementation details belong in the nearer local `AGENTS.md` files and existing module-level `CLAUDE.md` files.",
        ]
    )
    return format_bullets(state_lines)


def build_root_setup_commands(state: RepoState) -> str:
    lines = [
        "- Inspect current repo files:",
        "```bash",
        "find . -maxdepth 3 \\( -path '*/.git' -o -path '*/node_modules' \\) -prune -o -type f | sort",
        "```",
        "- Verify project MCP connectivity:",
        "```bash",
        "claude mcp list",
        "```",
        "- Inspect Task Master config:",
        "```bash",
        "sed -n '1,220p' .taskmaster/config.json",
        "```",
    ]

    install_cmds = []
    if state.root_scripts is not None:
        install_cmds.append("npm install")
    if (state.root / "frontend" / "package.json").is_file():
        install_cmds.append("test -f frontend/package.json && (cd frontend && npm install)")
    if install_cmds:
        lines.extend(["- Install dependencies:", "```bash", *install_cmds, "```"])

    run_cmds = []
    for script in ("build", "typecheck", "test"):
        if script in state.root_scripts:
            run_cmds.append(f"npm run {script}")
    if "lint" in state.frontend_scripts:
        run_cmds.append("test -f frontend/package.json && (cd frontend && npm run lint)")
    if run_cmds:
        lines.extend(["- Build/typecheck/test:", "```bash", *run_cmds, "```"])

    return "\n".join(lines)


def build_root_jit_index(state: RepoState) -> str:
    lines = [
        "### Key Files",
        "- Root agent rules: `AGENTS.md`",
        "- Claude-specific rules: `CLAUDE.md`",
        "- Repo-local Codex hook launcher: `scripts/codex-with-hooks.sh`",
        "- Product requirements: `docs/PRD.md`",
        "- Architecture reference: `docs/ARCHITECTURE-DIAGRAMS.md`",
        "- Resource estimates: `docs/RESOURCE-ESTIMATION.md`",
        "- Progress log: `docs/PROGRESS.md`",
        "- Task Master config: `.taskmaster/config.json`",
        "- Claude project config: `.claude/settings.json`",
        "- Project MCP registration: `.mcp.json`",
        "",
        "### Managed Local Guides",
    ]
    if state.local_guides:
        lines.extend(f"- `{guide}`" for guide in state.local_guides)
    else:
        lines.append("- No subdirectory `AGENTS.md` files are present yet.")

    lines.extend(
        [
            "",
            "### Planned High-Value Directories",
            "- Backend application: `src/`" + ("" if "src" in state.present_root_targets else " (planned, not yet present)"),
            "- Frontend application: `frontend/`" + ("" if "frontend" in state.present_root_targets else " (planned, not yet present)"),
            "- Database schema and migrations: `prisma/`" + ("" if "prisma" in state.present_root_targets else " (planned, not yet present)"),
            "- Market rule definitions: `rules/`" + ("" if "rules" in state.present_root_targets else " (planned, not yet present)"),
            "- Templates for proof packs: `templates/`" + ("" if "templates" in state.present_root_targets else " (planned, not yet present)"),
            "- Test infrastructure: `test/`" + ("" if "test" in state.present_root_targets else " (planned, not yet present)"),
            "",
            "### Quick Find Commands",
            "- Show repo guidance and planning files:",
            "```bash",
            "find . -maxdepth 2 -type f \\( -name 'AGENTS.md' -o -name 'CLAUDE.md' -o -path './docs/*' \\) | sort",
            "```",
            "- Find Task Master and Claude config:",
            "```bash",
            "find . -maxdepth 3 -type f \\( -path './.taskmaster/*' -o -path './.claude/*' -o -name '.mcp.json' \\) | sort",
            "```",
            "- Find NestJS services and controllers:",
            "```bash",
            "rg -n \"export class .*Service|@Controller|@(Get|Post|Patch|Delete)\" src",
            "```",
            "- Find frontend components and hooks:",
            "```bash",
            "rg -n \"export (function|const) |export function use[A-Z]\" frontend/src",
            "```",
            "- Find Prisma models and migrations:",
            "```bash",
            "rg -n \"^model \" prisma && find prisma/migrations -maxdepth 2 -type f",
            "```",
        ]
    )
    return "\n".join(lines)


def build_frontend_current_state(state: RepoState) -> str:
    next_version = state.frontend_deps.get("next", "unknown")
    react_version = state.frontend_deps.get("react", "unknown")
    lines = [
        f"Stack: Next.js {next_version.split('.')[0]} App Router, React {react_version.split('.')[0]}, TypeScript, Tailwind CSS v4.",
        (
            "Current app files: " + ", ".join(f"`{path}`" for path in state.frontend_app_files)
            if state.frontend_app_files
            else "The frontend has no committed `src/app/` files yet."
        ),
    ]
    if state.frontend_extra_dirs:
        lines.append("Additional frontend source directories currently on disk: " + ", ".join(f"`{name}/`" for name in state.frontend_extra_dirs) + ".")
    else:
        lines.append("There is no established component library, hook layer, API client, or route-handler structure yet. Add those deliberately, not by habit.")
    return format_bullets(lines)


def build_frontend_core_commands(state: RepoState) -> str:
    lines = []
    if state.frontend_scripts:
        lines.append("- Install deps: `npm install`")
        for script in ("dev", "build", "start", "lint"):
            if script in state.frontend_scripts:
                label = {
                    "dev": "Dev server",
                    "build": "Production build",
                    "start": "Production server",
                    "lint": "Lint",
                }[script]
                lines.append(f"- {label}: `npm run {script}`")
    return "\n".join(lines)


def build_frontend_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find app routes: `find frontend/src/app -maxdepth 3 -type f | sort`",
            "- Find exported components: `rg -n \"export (function|const)\" frontend/src`",
            "- Find client components: `rg -n \"^['\\\"]use client['\\\"]\" frontend/src`",
            "- Find CSS variables: `rg -n \"^\\\\s*--\" frontend/src/app/globals.css`",
        ]
    )


def build_src_current_shape(state: RepoState) -> str:
    guide_names = [Path(path).parts[1] if len(Path(path).parts) > 1 else path for path in state.src_local_guides if path.endswith("CLAUDE.md")]
    unique_guides = sorted(dict.fromkeys(guide_names))
    lines = [
        "Entry point: [`src/main.ts`](/Users/subhajlimanond/dev/zrl/src/main.ts)" if (state.root / "src" / "main.ts").is_file() else "Entry point has not been scaffolded yet.",
        "Root wiring: [`src/app.module.ts`](/Users/subhajlimanond/dev/zrl/src/app.module.ts)" if (state.root / "src" / "app.module.ts").is_file() else "Root NestJS module wiring has not been scaffolded yet.",
    ]
    if state.src_common_dirs:
        lines.append("Shared capabilities currently live under `src/common/`: " + ", ".join(f"`{name}`" for name in state.src_common_dirs) + ".")
    if state.src_modules:
        lines.append("Domain modules currently live under `src/modules/`: " + ", ".join(f"`{name}`" for name in state.src_modules) + ".")
    if unique_guides:
        lines.append("Existing module-specific guidance already exists for " + ", ".join(f"`{name}`" for name in unique_guides) + ".")
    return format_bullets(lines)


def build_src_core_commands(state: RepoState) -> str:
    labels = {
        "start:dev": "Dev server",
        "build": "Build",
        "typecheck": "Typecheck",
        "lint": "Lint",
        "test": "Unit tests",
        "test:e2e": "E2E tests",
    }
    return "\n".join(
        f"- {labels[script]}: `npm run {script}`"
        for script in ("start:dev", "build", "typecheck", "lint", "test", "test:e2e")
        if script in state.root_scripts
    )


def build_src_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find module declarations: `rg -n \"@Module\" src`",
            "- Find controllers: `rg -n \"@Controller|@(Get|Post|Patch|Delete)\" src`",
            "- Find providers/services: `rg -n \"export class .*Service|providers:\" src`",
            "- Find module-specific guidance: `find src -name 'CLAUDE.md' -o -name 'AGENTS.md' | sort`",
        ]
    )


def build_prisma_current_state(state: RepoState) -> str:
    lines = []
    if (state.root / "prisma" / "schema.prisma").is_file():
        lines.append("The primary schema file is [`prisma/schema.prisma`](/Users/subhajlimanond/dev/zrl/prisma/schema.prisma).")
    if state.prisma_provider:
        lines.append(f"The datasource provider is `{state.prisma_provider}`.")
    if state.prisma_output:
        lines.append(f"Prisma Client currently generates into `{state.prisma_output}`.")
    if state.prisma_has_migrations:
        lines.append(f"`prisma/migrations/` exists with {state.prisma_migration_count} committed file(s).")
    else:
        lines.append("There is no committed migration history yet.")
    return format_bullets(lines)


def build_prisma_core_commands(state: RepoState) -> str:
    labels = {
        "db:generate": "Generate client",
        "db:migrate": "Create/apply dev migration",
        "db:reset": "Reset dev database",
        "db:seed": "Seed database",
    }
    return "\n".join(
        f"- {labels[script]}: `npm run {script}`"
        for script in ("db:generate", "db:migrate", "db:reset", "db:seed")
        if script in state.root_scripts
    )


def build_prisma_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find models: `rg -n \"^model |^enum \" prisma/schema.prisma`",
            "- Find relation fields: `rg -n \"@relation|\\\\[.*Id\\\\]\" prisma/schema.prisma`",
            "- Find generated client references: `rg -n \"generated/prisma|@prisma/client\" src prisma test`",
        ]
    )


def build_test_current_state(state: RepoState) -> str:
    lines = []
    if state.test_files:
        entry = state.test_files[0]
        lines.append(f"E2E entry point(s) currently on disk: " + ", ".join(f"`test/{path}`" for path in state.test_files) + ".")
    if (state.root / "test" / "jest-e2e.json").is_file():
        lines.append("E2E Jest config: [`test/jest-e2e.json`](/Users/subhajlimanond/dev/zrl/test/jest-e2e.json).")
    lines.append(f"Root Jest config currently covers {state.unit_test_count} unit test file(s) under `src/` via `*.spec.ts`.")
    return format_bullets(lines)


def build_test_core_commands(state: RepoState) -> str:
    labels = {
        "test": "Unit tests",
        "test:unit": "Focused unit tests",
        "test:e2e": "E2E tests",
        "test:cov": "Coverage",
    }
    return "\n".join(
        f"- {labels[script]}: `npm run {script}`"
        for script in ("test", "test:unit", "test:e2e", "test:cov")
        if script in state.root_scripts
    )


def build_test_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find e2e tests: `find test -type f | sort`",
            "- Find unit tests: `find src -name '*.spec.ts' | sort`",
            "- Find app bootstrap references: `rg -n \"AppModule|createNestApplication\" src test`",
        ]
    )


def build_rules_current_state(state: RepoState) -> str:
    lines = [
        "This directory now exists and should hold market-specific compliance data, not generic business logic."
    ]
    if state.rules_markets:
        lines.append("Current market subdirectories: " + ", ".join(f"`{market}/`" for market in state.rules_markets) + ".")
    rule_files = [str(path.relative_to(state.root / "rules")).replace("\\", "/") for path in list_real_files(state.root / "rules")[:8]]
    if rule_files:
        lines.append("Current rule files include: " + ", ".join(f"`rules/{path}`" for path in rule_files) + ".")
    return format_bullets(lines)


def build_rules_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find rule files: `find rules -type f | sort`",
            "- Find YAML rule keys: `rg -n \"^[a-zA-Z0-9_-]+:\" rules`",
            "- Find market directories: `find rules -maxdepth 2 -type d | sort`",
        ]
    )


def build_templates_current_state(state: RepoState) -> str:
    lines = ["This directory now exists and should hold proof-pack or document templates, not domain decision logic."]
    if state.templates_groups:
        lines.append("Current template groups: " + ", ".join(f"`{group}/`" for group in state.templates_groups) + ".")
    template_files = [str(path.relative_to(state.root / "templates")).replace("\\", "/") for path in list_real_files(state.root / "templates")[:8]]
    if template_files:
        lines.append("Current template files include: " + ", ".join(f"`templates/{path}`" for path in template_files) + ".")
    return format_bullets(lines)


def build_templates_quick_find(state: RepoState) -> str:
    return "\n".join(
        [
            "- Find template files: `find templates -type f | sort`",
            "- Find handlebars variables: `rg -n \"{{|}}\" templates`",
            "- Find template groups: `find templates -maxdepth 2 -type d | sort`",
        ]
    )


def rules_template(state: RepoState) -> str:
    return f"""# Rules Agent Guide

## Scope
- This file applies to everything under `rules/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing market rule definitions.

## Current State
<!-- BEGIN AUTO-GENERATED:RULES_CURRENT_STATE -->
{build_rules_current_state(state)}
<!-- END AUTO-GENERATED:RULES_CURRENT_STATE -->

## Working Rules
- Keep rule definitions market-specific and explicit; Japan, China, and Korea requirements must not collapse into generic thresholds.
- Prefer data files and schema-like structure over embedding regulatory values in application code.
- Treat changes here as compliance-sensitive and reflect any real structure changes back into root guidance.

## Anti-Patterns
- Do not hardcode MRL or document-requirement values elsewhere when they belong here.
- Do not use this directory for runtime business logic or service code.

## Quick Find
<!-- BEGIN AUTO-GENERATED:RULES_QUICK_FIND -->
{build_rules_quick_find(state)}
<!-- END AUTO-GENERATED:RULES_QUICK_FIND -->

## Done Criteria
- Rule changes are explicit, reviewable, and traceable to the correct market/product scope.
- If the directory structure changes materially, the root `AGENTS.md` stays aligned.
"""


def templates_template(state: RepoState) -> str:
    return f"""# Templates Agent Guide

## Scope
- This file applies to everything under `templates/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing proof-pack or document templates.

## Current State
<!-- BEGIN AUTO-GENERATED:TEMPLATES_CURRENT_STATE -->
{build_templates_current_state(state)}
<!-- END AUTO-GENERATED:TEMPLATES_CURRENT_STATE -->

## Working Rules
- Keep templates view-only; domain decisions should stay in app code or rule data.
- Reuse shared placeholders and structure where possible instead of duplicating near-identical templates.
- Keep template naming aligned with the proof-pack or document type it renders.

## Anti-Patterns
- Do not embed hidden business logic in templates.
- Do not fork templates into nearly identical copies without a real rendering need.

## Quick Find
<!-- BEGIN AUTO-GENERATED:TEMPLATES_QUICK_FIND -->
{build_templates_quick_find(state)}
<!-- END AUTO-GENERATED:TEMPLATES_QUICK_FIND -->

## Done Criteria
- Template changes remain readable, scoped, and aligned with the real generation flow.
- Any new template group is reflected in the auto-generated current-state section.
"""


def guide_specs() -> list[GuideSpec]:
    return [
        GuideSpec(
            relative_path="AGENTS.md",
            should_exist=lambda state: True,
            template=lambda state: "",  # root is expected to exist already
            blocks={
                "ROOT_PROJECT_SNAPSHOT": build_root_project_snapshot,
                "ROOT_CURRENT_REPO_STATE": build_root_current_repo_state,
                "ROOT_SETUP_COMMANDS": build_root_setup_commands,
                "ROOT_JIT_INDEX": build_root_jit_index,
            },
        ),
        GuideSpec(
            relative_path="frontend/AGENTS.md",
            should_exist=lambda state: (state.root / "frontend").is_dir(),
            template=lambda state: "",
            blocks={
                "FRONTEND_CURRENT_STATE": build_frontend_current_state,
                "FRONTEND_CORE_COMMANDS": build_frontend_core_commands,
                "FRONTEND_QUICK_FIND": build_frontend_quick_find,
            },
        ),
        GuideSpec(
            relative_path="src/AGENTS.md",
            should_exist=lambda state: (state.root / "src").is_dir(),
            template=lambda state: "",
            blocks={
                "SRC_CURRENT_SHAPE": build_src_current_shape,
                "SRC_CORE_COMMANDS": build_src_core_commands,
                "SRC_QUICK_FIND": build_src_quick_find,
            },
        ),
        GuideSpec(
            relative_path="prisma/AGENTS.md",
            should_exist=lambda state: (state.root / "prisma").is_dir(),
            template=lambda state: "",
            blocks={
                "PRISMA_CURRENT_STATE": build_prisma_current_state,
                "PRISMA_CORE_COMMANDS": build_prisma_core_commands,
                "PRISMA_QUICK_FIND": build_prisma_quick_find,
            },
        ),
        GuideSpec(
            relative_path="test/AGENTS.md",
            should_exist=lambda state: (state.root / "test").is_dir(),
            template=lambda state: "",
            blocks={
                "TEST_CURRENT_STATE": build_test_current_state,
                "TEST_CORE_COMMANDS": build_test_core_commands,
                "TEST_QUICK_FIND": build_test_quick_find,
            },
        ),
        GuideSpec(
            relative_path="rules/AGENTS.md",
            should_exist=lambda state: bool(list_real_files(state.root / "rules")),
            template=rules_template,
            blocks={
                "RULES_CURRENT_STATE": build_rules_current_state,
                "RULES_QUICK_FIND": build_rules_quick_find,
            },
        ),
        GuideSpec(
            relative_path="templates/AGENTS.md",
            should_exist=lambda state: bool(list_real_files(state.root / "templates")),
            template=templates_template,
            blocks={
                "TEMPLATES_CURRENT_STATE": build_templates_current_state,
                "TEMPLATES_QUICK_FIND": build_templates_quick_find,
            },
        ),
    ]


def sync_repo_agents(root: Path) -> list[str]:
    state = collect_repo_state(root)
    changed: list[str] = []

    for spec in guide_specs():
        target = root / spec.relative_path
        should_exist = spec.should_exist(state)

        if not should_exist:
            continue

        if not target.exists():
            template = spec.template(state)
            if not template:
                raise FileNotFoundError(f"Expected existing guide at {spec.relative_path}")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(template, encoding="utf-8")
            changed.append(spec.relative_path)
            continue

        content = target.read_text(encoding="utf-8")
        rendered_blocks = {name: render(state) for name, render in spec.blocks.items()}
        updated = replace_blocks(content, rendered_blocks)
        if updated != content:
            target.write_text(updated, encoding="utf-8")
            changed.append(spec.relative_path)

    return changed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", default=".", help="Repo root containing AGENTS.md files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.project_root).expanduser().resolve()
    try:
        changed = sync_repo_agents(root)
    except Exception as exc:  # pragma: no cover - CLI failure path
        print(f"sync_agents.py failed: {exc}", file=sys.stderr)
        return 1

    if changed:
        print("\n".join(changed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
