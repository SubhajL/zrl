# Coding Log: Error Boundary Pages (Retroactive)

## 2026-03-29 19:32 ICT

> Reconstructed retroactively from commit `3956a7e` (PR #42).

- Goal: Add Next.js error boundary pages for the app and auth route groups to catch runtime errors gracefully.

- What changed:
  - `frontend/src/app/(app)/error.tsx` — New file. Client component error boundary for the main app layout. Shows AlertTriangle icon, error message, and "Try Again" button using shadcn Button + lucide-react icons.
  - `frontend/src/app/(auth)/error.tsx` — New file. Simpler error boundary variant for login/auth routes. Uses a plain styled button instead of shadcn Button for the lighter auth layout.

- TDD evidence:
  - Not recorded — session predates coding log enforcement for this work.

- Tests run and results:
  - Not recorded in detail. Commit message does not reference test counts.

- Wiring verification evidence:
  - Next.js App Router auto-discovers `error.tsx` files in route groups — no manual wiring needed. `(app)/error.tsx` catches errors in all `/dashboard`, `/lanes`, `/analytics`, etc. routes. `(auth)/error.tsx` catches errors in `/login` and related auth routes.

- Behavior changes and risk notes:
  - Previously, runtime errors in the app or auth routes would show the default Next.js error page. Now they show branded error UIs with retry capability.
  - Both files use `'use client'` as required by the Next.js error boundary contract.

- Follow-ups / known gaps:
  - No error boundary tests — could add tests that verify the components render with a mock error and call `reset()` on button click.
