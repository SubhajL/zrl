# Templates Agent Guide

## Scope
- This file applies to everything under `templates/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when editing proof-pack or document templates.

## Current State
<!-- BEGIN AUTO-GENERATED:TEMPLATES_CURRENT_STATE -->
- This directory now exists and should hold proof-pack or document templates, not domain decision logic.
- Current template files include: `templates/AGENTS.md`, `templates/buyer.hbs`, `templates/defense.hbs`, `templates/regulator.hbs`.
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
- Find template files: `find templates -type f | sort`
- Find handlebars variables: `rg -n "{{|}}" templates`
- Find template groups: `find templates -maxdepth 2 -type d | sort`
<!-- END AUTO-GENERATED:TEMPLATES_QUICK_FIND -->

## Done Criteria
- Template changes remain readable, scoped, and aligned with the real generation flow.
- Any new template group is reflected in the auto-generated current-state section.
