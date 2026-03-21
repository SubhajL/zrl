#!/usr/bin/env python3
"""Repo-local Codex hook emulation for ZRL.

Codex CLI in this environment exposes no native Claude-style lifecycle hooks in
`~/.codex/config.toml`, so this module provides a small watcher/dispatcher that
can be launched alongside `codex` sessions.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "dist",
    "coverage",
    ".turbo",
    ".taskmaster",
}

IGNORED_REL_PREFIXES = (
    ".taskmaster/logs/",
    ".codex/logs/",
)


def rel_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def should_track(path: Path, root: Path) -> bool:
    if not path.is_file():
        return False

    relative = rel_path(path, root)
    if any(relative.startswith(prefix) for prefix in IGNORED_REL_PREFIXES):
        return False

    parts = Path(relative).parts
    return not any(part in IGNORED_DIRS for part in parts)


def file_signature(path: Path) -> tuple[int, int]:
    stat = path.stat()
    return (stat.st_mtime_ns, stat.st_size)


def iter_tracked_files(root: Path) -> list[Path]:
    tracked: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [name for name in dirnames if name not in IGNORED_DIRS]
        base = Path(dirpath)
        for filename in filenames:
            path = base / filename
            if should_track(path, root):
                tracked.append(path)
    return tracked


def emit_output(prefix: str, output: str) -> None:
    cleaned = output.strip()
    if cleaned:
        for line in cleaned.splitlines():
            print(f"{prefix}{line}", file=sys.stderr)


def run_hook(script: Path, project_root: Path, file_path: Path | None = None, tool_name: str = "Write") -> None:
    if not script.is_file():
        return

    env = os.environ.copy()
    env["CLAUDE_PROJECT_DIR"] = str(project_root)
    env["CLAUDE_TOOL_NAME"] = tool_name

    payload = ""
    if file_path is not None:
        payload = json.dumps({"tool_input": {"file_path": str(file_path)}})

    proc = subprocess.run(
        ["bash", str(script)],
        input=payload,
        text=True,
        capture_output=True,
        env=env,
        cwd=project_root,
        check=False,
    )
    emit_output("CODEX HOOKS: ", proc.stdout)
    emit_output("CODEX HOOKS: ", proc.stderr)


def dispatch_file(project_root: Path, file_path: Path) -> None:
    auto_format = project_root / ".claude" / "hooks" / "auto-format.sh"
    claudemd_staleness = project_root / ".claude" / "hooks" / "claudemd-staleness.sh"
    sync_agents = project_root / ".claude" / "hooks" / "sync-agents.sh"

    run_hook(auto_format, project_root, file_path=file_path, tool_name="Write")
    run_hook(claudemd_staleness, project_root, file_path=file_path, tool_name="Write")
    run_hook(sync_agents, project_root)


def watch(project_root: Path, interval: float) -> int:
    keep_running = True

    def handle_signal(_signum: int, _frame: object) -> None:
        nonlocal keep_running
        keep_running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    run_hook(project_root / ".claude" / "hooks" / "sync-agents.sh", project_root)

    known = {path: file_signature(path) for path in iter_tracked_files(project_root)}

    while keep_running:
        time.sleep(interval)
        current_paths = iter_tracked_files(project_root)
        current = {path: file_signature(path) for path in current_paths}

        changed = [path for path, signature in current.items() if known.get(path) != signature]
        for path in sorted(changed):
            dispatch_file(project_root, path)
            if path.exists():
                current[path] = file_signature(path)

        known = current

    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    dispatch_parser = subparsers.add_parser("dispatch", help="Dispatch hook actions for one changed file")
    dispatch_parser.add_argument("--project-root", default=".")
    dispatch_parser.add_argument("--file", required=True)

    watch_parser = subparsers.add_parser("watch", help="Watch the repo and dispatch hook actions on file changes")
    watch_parser.add_argument("--project-root", default=".")
    watch_parser.add_argument("--interval", type=float, default=1.0)

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).expanduser().resolve()

    if args.command == "dispatch":
        dispatch_file(project_root, Path(args.file).expanduser().resolve())
        return 0

    if args.command == "watch":
        return watch(project_root, args.interval)

    raise ValueError(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())
