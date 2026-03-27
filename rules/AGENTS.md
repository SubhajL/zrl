# Rules Agent Guide

## Scope
- This file applies to everything under `rules/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing market rule definitions.

## Current State
<!-- BEGIN AUTO-GENERATED:RULES_CURRENT_STATE -->
- This directory now exists and should hold market-specific compliance data, not generic business logic.
- Current market subdirectories: `japan/`.
- Current rule files include: `rules/AGENTS.md`, `rules/japan/mango.yaml`, `rules/japan/mango-substances.csv`.
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
- Find rule files: `find rules -type f | sort`
- Find YAML rule keys: `rg -n "^[a-zA-Z0-9_-]+:" rules`
- Find market directories: `find rules -maxdepth 2 -type d | sort`
<!-- END AUTO-GENERATED:RULES_QUICK_FIND -->

## Done Criteria
- Rule changes are explicit, reviewable, and traceable to the correct market/product scope.
- If the directory structure changes materially, the root `AGENTS.md` stays aligned.
