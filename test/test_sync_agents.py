from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT))

from scripts.sync_agents import sync_repo_agents  # type: ignore


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class SyncAgentsTests(unittest.TestCase):
    def make_repo(self) -> Path:
        tempdir = Path(tempfile.mkdtemp(prefix="zrl-sync-agents."))

        write(
            tempdir / "package.json",
            json.dumps(
                {
                    "scripts": {
                        "build": "nest build",
                        "typecheck": "tsc --noEmit -p tsconfig.build.json",
                        "test": "jest",
                    }
                }
            ),
        )
        write(
            tempdir / "frontend" / "package.json",
            json.dumps(
                {
                    "dependencies": {"next": "16.2.1", "react": "19.2.4"},
                    "scripts": {"dev": "next dev", "build": "next build", "lint": "eslint"},
                }
            ),
        )
        write(tempdir / "frontend" / "src" / "app" / "page.tsx", "export default function Page() { return null }\n")
        write(tempdir / "frontend" / "CLAUDE.md", "@AGENTS.md\n")
        write(tempdir / "src" / "main.ts", "void 0;\n")
        write(tempdir / "src" / "app.module.ts", "export class AppModule {}\n")
        write(tempdir / "src" / "modules" / "lane" / "CLAUDE.md", "# Lane\n")
        write(tempdir / "prisma" / "schema.prisma", 'generator client {\n  provider = "prisma-client"\n  output = "../generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n')
        write(tempdir / "test" / "app.e2e-spec.ts", "describe('e2e', () => {});\n")
        write(tempdir / ".claude" / "settings.json", '{"env":{"TASK_MASTER_TOOLS":"core"}}\n')
        write(tempdir / ".mcp.json", '{"mcpServers":{}}\n')
        write(tempdir / "docs" / "PRD.md", "# PRD\n")
        write(tempdir / "docs" / "ARCHITECTURE-DIAGRAMS.md", "# diagrams\n")
        write(tempdir / "docs" / "RESOURCE-ESTIMATION.md", "# resources\n")

        write(
            tempdir / "AGENTS.md",
            "# Root Guide\n\nManual root note.\n\n## Project Snapshot\n<!-- BEGIN AUTO-GENERATED:ROOT_PROJECT_SNAPSHOT -->\nold\n<!-- END AUTO-GENERATED:ROOT_PROJECT_SNAPSHOT -->\n\n## Current Repo State\n<!-- BEGIN AUTO-GENERATED:ROOT_CURRENT_REPO_STATE -->\nold\n<!-- END AUTO-GENERATED:ROOT_CURRENT_REPO_STATE -->\n\n## Root Setup Commands\n<!-- BEGIN AUTO-GENERATED:ROOT_SETUP_COMMANDS -->\nold\n<!-- END AUTO-GENERATED:ROOT_SETUP_COMMANDS -->\n\n## JIT Index\n<!-- BEGIN AUTO-GENERATED:ROOT_JIT_INDEX -->\nold\n<!-- END AUTO-GENERATED:ROOT_JIT_INDEX -->\n",
        )
        write(
            tempdir / "frontend" / "AGENTS.md",
            "# Frontend Agent Guide\n\nManual frontend note.\n\n## Current State\n<!-- BEGIN AUTO-GENERATED:FRONTEND_CURRENT_STATE -->\nold\n<!-- END AUTO-GENERATED:FRONTEND_CURRENT_STATE -->\n\n## Core Commands\n<!-- BEGIN AUTO-GENERATED:FRONTEND_CORE_COMMANDS -->\nold\n<!-- END AUTO-GENERATED:FRONTEND_CORE_COMMANDS -->\n\n## Quick Find\n<!-- BEGIN AUTO-GENERATED:FRONTEND_QUICK_FIND -->\nold\n<!-- END AUTO-GENERATED:FRONTEND_QUICK_FIND -->\n",
        )
        write(
            tempdir / "src" / "AGENTS.md",
            "# Backend Agent Guide\n\n## Current Shape\n<!-- BEGIN AUTO-GENERATED:SRC_CURRENT_SHAPE -->\nold\n<!-- END AUTO-GENERATED:SRC_CURRENT_SHAPE -->\n\n## Core Commands\n<!-- BEGIN AUTO-GENERATED:SRC_CORE_COMMANDS -->\nold\n<!-- END AUTO-GENERATED:SRC_CORE_COMMANDS -->\n\n## Quick Find\n<!-- BEGIN AUTO-GENERATED:SRC_QUICK_FIND -->\nold\n<!-- END AUTO-GENERATED:SRC_QUICK_FIND -->\n",
        )
        write(
            tempdir / "prisma" / "AGENTS.md",
            "# Prisma Agent Guide\n\n## Current State\n<!-- BEGIN AUTO-GENERATED:PRISMA_CURRENT_STATE -->\nold\n<!-- END AUTO-GENERATED:PRISMA_CURRENT_STATE -->\n\n## Core Commands\n<!-- BEGIN AUTO-GENERATED:PRISMA_CORE_COMMANDS -->\nold\n<!-- END AUTO-GENERATED:PRISMA_CORE_COMMANDS -->\n\n## Quick Find\n<!-- BEGIN AUTO-GENERATED:PRISMA_QUICK_FIND -->\nold\n<!-- END AUTO-GENERATED:PRISMA_QUICK_FIND -->\n",
        )
        write(
            tempdir / "test" / "AGENTS.md",
            "# Test Agent Guide\n\n## Current State\n<!-- BEGIN AUTO-GENERATED:TEST_CURRENT_STATE -->\nold\n<!-- END AUTO-GENERATED:TEST_CURRENT_STATE -->\n\n## Core Commands\n<!-- BEGIN AUTO-GENERATED:TEST_CORE_COMMANDS -->\nold\n<!-- END AUTO-GENERATED:TEST_CORE_COMMANDS -->\n\n## Quick Find\n<!-- BEGIN AUTO-GENERATED:TEST_QUICK_FIND -->\nold\n<!-- END AUTO-GENERATED:TEST_QUICK_FIND -->\n",
        )

        return tempdir

    def test_sync_updates_existing_guides_and_preserves_manual_text(self) -> None:
        repo = self.make_repo()

        changed = sync_repo_agents(repo)

        self.assertIn("AGENTS.md", changed)
        self.assertIn("frontend/AGENTS.md", changed)
        self.assertIn("src/AGENTS.md", changed)
        self.assertIn("prisma/AGENTS.md", changed)
        self.assertIn("test/AGENTS.md", changed)

        root = (repo / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("Manual root note.", root)
        self.assertIn("single-project repo with an initial scaffold in place", root)
        self.assertIn("`rules/` and other planned directories are still not on disk", root)
        self.assertIn("Repo-local Codex hook launcher: `scripts/codex-with-hooks.sh`", root)

        frontend = (repo / "frontend" / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("Manual frontend note.", frontend)
        self.assertIn("Next.js 16 App Router, React 19, TypeScript", frontend)

        src = (repo / "src" / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("Existing module-specific guidance already exists for `lane`", src)

        prisma = (repo / "prisma" / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("The datasource provider is `postgresql`.", prisma)

    def test_sync_is_idempotent_when_repo_state_is_unchanged(self) -> None:
        repo = self.make_repo()

        first = sync_repo_agents(repo)
        second = sync_repo_agents(repo)

        self.assertTrue(first)
        self.assertEqual([], second)

    def test_sync_creates_rules_guide_when_rules_directory_becomes_real(self) -> None:
        repo = self.make_repo()
        sync_repo_agents(repo)

        write(repo / "rules" / "japan" / "mango.yaml", "name: mango\n")

        changed = sync_repo_agents(repo)

        self.assertIn("rules/AGENTS.md", changed)
        rules_guide = (repo / "rules" / "AGENTS.md").read_text(encoding="utf-8")
        self.assertIn("This file applies to everything under `rules/`.", rules_guide)
        self.assertIn("Find rule files", rules_guide)


if __name__ == "__main__":
    unittest.main()
