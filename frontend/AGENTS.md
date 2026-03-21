# Frontend Agent Guide

## Scope
- This file applies to everything under `frontend/`.
- Prefer this file over the repo root [`AGENTS.md`](/Users/subhajlimanond/dev/zrl/AGENTS.md) when working in the frontend.
- [`frontend/CLAUDE.md`](/Users/subhajlimanond/dev/zrl/frontend/CLAUDE.md) delegates here for Claude-specific context.

## Current State
<!-- BEGIN AUTO-GENERATED:FRONTEND_CURRENT_STATE -->
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4.
- Current app files: `src/app/favicon.ico`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- There is no established component library, hook layer, API client, or route-handler structure yet. Add those deliberately, not by habit.
<!-- END AUTO-GENERATED:FRONTEND_CURRENT_STATE -->

## Core Commands
<!-- BEGIN AUTO-GENERATED:FRONTEND_CORE_COMMANDS -->
- Install deps: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Production server: `npm run start`
- Lint: `npm run lint`
<!-- END AUTO-GENERATED:FRONTEND_CORE_COMMANDS -->

## Structure To Preserve
- Keep App Router code under `frontend/src/app/`.
- Put shared UI only in `frontend/src/components/` once at least two call sites justify it.
- Put reusable hooks in `frontend/src/hooks/` only after a second real use case appears.
- Keep design tokens and global visual primitives in `frontend/src/app/globals.css` until a dedicated token module is clearly needed.

## Working Rules
- Read the existing page, layout, and global styles before changing visual direction.
- Preserve the ZRL domain framing from the root docs; do not turn the UI into a generic SaaS admin shell.
- Prefer server components by default; add client components only when browser-only behavior is actually required.
- Keep routing and data boundaries explicit; do not introduce ad hoc client-side fetching layers without a real backend integration need.
- Use real Next.js 16 conventions from the installed version on disk, not memory from older Next releases.

## Anti-Patterns
- Do not add Pages Router files or mix routing models.
- Do not create placeholder dashboards, fake charts, or stub API clients just to make the tree look complete.
- Do not scatter theme values across multiple files when `globals.css` is still the single source of truth.
- Do not introduce generic component abstractions before concrete repetition exists.

## Quick Find
<!-- BEGIN AUTO-GENERATED:FRONTEND_QUICK_FIND -->
- Find app routes: `find frontend/src/app -maxdepth 3 -type f | sort`
- Find exported components: `rg -n "export (function|const)" frontend/src`
- Find client components: `rg -n "^['\"]use client['\"]" frontend/src`
- Find CSS variables: `rg -n "^\s*--" frontend/src/app/globals.css`
<!-- END AUTO-GENERATED:FRONTEND_QUICK_FIND -->

## Done Criteria
- The change fits the current minimal frontend stage and does not invent architecture that is not on disk.
- `npm run lint` or another relevant frontend check was run when frontend files changed.
- If a new frontend sub-area becomes real and stable, consider adding a nearer `AGENTS.md`.
