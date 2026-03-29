# Coding Log: Evidence Tab File Upload Wiring

## 2026-03-29 14:30 ICT

- Goal: Wire file upload functionality to the Evidence tab upload zones in `tab-evidence.tsx`
- What changed:
  - `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.tsx` — Added `'use client'` directive, new `onUpload` optional prop, hidden file inputs per missing artifact type, click-to-upload handlers, loading state (Loader2 spinner), error display scoped per artifact type, keyboard accessibility (Enter/Space), hover styling for interactive zones
  - `frontend/src/app/(app)/lanes/[laneId]/_components/tab-evidence.test.tsx` — New test file with 13 tests covering: non-interactive mode (no onUpload), interactive mode (with onUpload), file input rendering, file selection triggering onUpload callback, loading state during upload, error display on failure, generic error for non-Error exceptions, file type accept attribute, error clearing on retry, existing evidence display preserved
- TDD evidence:
  - RED: 10 tests failed before implementation (3 passed — tests for existing behavior). Failures: `onUpload` prop not recognized, no file inputs rendered, no `cursor-pointer` class, no `data-artifact-type` attributes
  - GREEN: All 13 tests passed after implementation
- Tests run and results:
  - `npx jest --testPathPatterns='tab-evidence.test'` — 13/13 passed (3 consecutive full suite runs: 127/127 each)
- Wiring verification evidence:
  - `npx tsc --noEmit` — 0 errors
  - `npm run lint` — 0 errors, 0 warnings
  - `npm run build` — successful production build, all routes generated
  - Component remains backward-compatible: existing usage in `lane-detail-tabs.tsx` without `onUpload` prop continues to work (upload zones render as non-interactive)
- Behavior changes and risk notes:
  - Component changed from server component to `'use client'` — necessary for useState/useRef/event handlers. This is safe because it was already rendered inside a client component (`lane-detail-tabs.tsx` which has `'use client'`)
  - No existing tests broken (127/127 pass across full suite)
- Follow-ups / known gaps:
  - The `onUpload` prop is not yet wired in `lane-detail-tabs.tsx` — parent needs to provide the actual upload implementation
  - No drag-and-drop support yet
  - No file size validation on the client side
