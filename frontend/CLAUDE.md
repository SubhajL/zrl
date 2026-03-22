# Frontend (Next.js 16 + Tailwind v4)

## Stack
- **Framework:** Next.js 16 with App Router (NOT Pages Router), React 19
- **Components:** shadcn/ui (new-york style) + Radix UI primitives
- **Styling:** Tailwind CSS v4 (CSS-based config via `@theme inline`, NOT tailwind.config.ts)
- **Charts:** Recharts (for temperature curves, analytics)
- **Icons:** Lucide React (`lucide-react`) — NOT Material Symbols
- **Fonts:** Inter variable (body), JetBrains Mono (hashes/IDs/stats), Noto Sans Thai (Thai text)
- **Dark Mode:** CSS `light-dark()` function + `color-scheme: light dark` (no JS toggle)
- **TypeScript:** strict mode enabled

## Key Rules
- Read `node_modules/next/dist/docs/` before writing Next.js code — this version has breaking changes from training data
- Design tokens are in `src/app/globals.css` as CSS custom properties (`--zrl-*`)
- Use `@theme inline` block in globals.css for Tailwind v4 theme extension — no tailwind.config file
- Dark mode: pure CSS via `light-dark()` function — no client-side theme provider needed
- Responsive breakpoints: Desktop ≥1024px, Tablet 768–1023px, Mobile <768px
- Touch targets: minimum 44px on all interactive elements for mobile
- All components must be accessible (WCAG 2.2 AA — ARIA labels, keyboard navigation, focus-visible, target sizes)
- Prefer server components by default; add `'use client'` only when browser interactivity is required

## Component Library

### Primitives (`src/components/ui/`)
shadcn/ui-based components. Customize via Tailwind classes + CVA variants.

| Component | File | Client? | Notes |
|-----------|------|---------|-------|
| Button | `button.tsx` | No | CVA: default, destructive, outline, secondary, ghost, link |
| Card | `card.tsx` | No | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| Badge | `badge.tsx` | No | + ZRL semantic: success, warning, info |
| Input | `input.tsx` | No | aria-invalid support, 16px font (no iOS zoom) |
| Label | `label.tsx` | No | Peer-disabled styling |
| Table | `table.tsx` | No | Table, TableHeader, TableBody, TableRow, TableHead, TableCell |
| Dialog | `dialog.tsx` | Yes | Radix Dialog with focus trap |
| Progress | `progress.tsx` | Yes | Radix Progress, value clamped 0-100 |
| Sheet | `sheet.tsx` | Yes | Side drawer (top/right/bottom/left) |

### ZRL Composites (`src/components/zrl/`)
Domain-specific components built on primitives.

| Component | File | Client? | Notes |
|-----------|------|---------|-------|
| StatusDot | `status-dot.tsx` | No | 5 statuses, sr-only label, optional pulse |
| ProgressBar | `progress-bar.tsx` | Yes | Labeled progress with tint |
| KPITile | `kpi-tile.tsx` | No | Stat card with mono value, trend delta |
| Stepper | `stepper.tsx` | No | Wizard indicator, aria-current="step" |
| BentoGrid | `bento-grid.tsx` | No | 12-col responsive grid |
| DataTable | `data-table.tsx` | Yes | Generic sortable table with empty state |
| Modal | `modal.tsx` | Yes | Opinionated Dialog wrapper |
| Sidebar | `sidebar.tsx` | Yes | Desktop rail + mobile Sheet |
| TopBar | `top-bar.tsx` | No | Sticky header with backdrop blur |

### Utility
- `src/lib/utils.ts` — `cn()` Tailwind class merge helper

## ZRL Color Palette
- Primary: `--zrl-primary: #6C5CE7`
- Success/Pass: `--zrl-success: #22C55E`
- Warning/Attention: `--zrl-warning: #F59E0B`
- Error/Fail: `--zrl-error: #EF4444`
- Info: `--zrl-info: #3B82F6`
- Cold-chain OK: `--zrl-cold-chain: #14B8A6`
- Completeness: `--zrl-completeness: #6C5CE7`

## Frontend Routes (App Router)
Key routes — all under `src/app/`:
- `/dashboard` — Main exporter dashboard
- `/lanes/new` — Lane creation wizard (4 steps)
- `/lanes/[laneId]` — Lane detail with 6 tabs
- `/checkpoint/capture` — Mobile PWA checkpoint capture
- `/admin/rules` — Rules engine management (Admin only)
- `/partner` — Partner portal (Lab/Logistics)
- `/analytics` — Analytics dashboard
- `/settings` — User settings

## Testing
- Unit: component rendering, interaction handlers (Jest + React Testing Library)
- Accessibility: jest-axe automated checks
- E2E: Playwright for critical flows
- Run: `npm test` (Jest), `npm run test:cov` (coverage), `npm run typecheck` (tsc)
