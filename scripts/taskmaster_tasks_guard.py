#!/usr/bin/env python3
"""
Snapshot and restore Task Master task state around risky overwrite operations.

Typical use:
  python3 taskmaster_tasks_guard.py snapshot --project-root /path/to/repo --label force-expand-task-1
  python3 taskmaster_tasks_guard.py restore --project-root /path/to/repo --backup-file /path/to/backup.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path


def tasks_path(project_root: Path) -> Path:
    return project_root / ".taskmaster" / "tasks" / "tasks.json"


def backups_dir(project_root: Path) -> Path:
    return project_root / ".taskmaster" / "backups"


def latest_manifest_path(project_root: Path) -> Path:
    return backups_dir(project_root) / "latest-force-expand-backup.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def ensure_tasks_file(project_root: Path) -> Path:
    path = tasks_path(project_root)
    if not path.is_file():
        raise FileNotFoundError(f"Task Master tasks file not found: {path}")
    load_json(path)
    return path


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=True)
        handle.write("\n")


def utc_now_compact() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")


def snapshot(project_root: Path, label: str) -> int:
    source = ensure_tasks_file(project_root)
    backup_root = backups_dir(project_root)
    backup_root.mkdir(parents=True, exist_ok=True)

    safe_label = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in label).strip("-_")
    if not safe_label:
        safe_label = "backup"

    backup_file = backup_root / f"tasks-{safe_label}-{utc_now_compact()}.json"
    shutil.copy2(source, backup_file)

    metadata = {
        "action": "snapshot",
        "project_root": str(project_root),
        "tasks_file": str(source),
        "backup_file": str(backup_file),
        "label": safe_label,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": sha256_file(backup_file),
    }
    write_json(latest_manifest_path(project_root), metadata)
    print(json.dumps(metadata, indent=2))
    return 0


def resolve_backup_file(project_root: Path, backup_file: str | None) -> Path:
    if backup_file:
        path = Path(backup_file).expanduser().resolve()
    else:
        manifest = latest_manifest_path(project_root)
        if not manifest.is_file():
            raise FileNotFoundError(
                "No backup file provided and no latest manifest found at "
                f"{manifest}"
            )
        data = load_json(manifest)
        if not isinstance(data, dict) or "backup_file" not in data:
            raise ValueError(f"Invalid manifest format: {manifest}")
        path = Path(str(data["backup_file"])).expanduser().resolve()

    if not path.is_file():
        raise FileNotFoundError(f"Backup file not found: {path}")
    load_json(path)
    return path


def restore(project_root: Path, backup_file: str | None) -> int:
    destination = ensure_tasks_file(project_root)
    source = resolve_backup_file(project_root, backup_file)
    shutil.copy2(source, destination)

    metadata = {
        "action": "restore",
        "project_root": str(project_root),
        "tasks_file": str(destination),
        "backup_file": str(source),
        "restored_at_utc": datetime.now(timezone.utc).isoformat(),
        "sha256": sha256_file(destination),
    }
    print(json.dumps(metadata, indent=2))
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    snapshot_parser = subparsers.add_parser(
        "snapshot", help="Create a timestamped backup of .taskmaster/tasks/tasks.json"
    )
    snapshot_parser.add_argument("--project-root", required=True, help="Repo root containing .taskmaster/")
    snapshot_parser.add_argument(
        "--label",
        default="force-expand",
        help="Label included in the backup filename",
    )

    restore_parser = subparsers.add_parser(
        "restore", help="Restore .taskmaster/tasks/tasks.json from a backup"
    )
    restore_parser.add_argument("--project-root", required=True, help="Repo root containing .taskmaster/")
    restore_parser.add_argument(
        "--backup-file",
        help="Specific backup file to restore. If omitted, restore from the latest manifest.",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_root = Path(args.project_root).expanduser().resolve()

    try:
        if args.command == "snapshot":
            return snapshot(project_root, args.label)
        if args.command == "restore":
            return restore(project_root, args.backup_file)
        raise ValueError(f"Unsupported command: {args.command}")
    except Exception as exc:  # pragma: no cover - CLI failure path
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
