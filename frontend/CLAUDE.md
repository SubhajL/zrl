# Frontend (Next.js 16 + Tailwind v4)

## Stack
- **Framework:** Next.js 16 with App Router (NOT Pages Router)
- **Styling:** Tailwind CSS v4 (CSS-based config via `@theme`, NOT tailwind.config.ts)
- **Charts:** Recharts (for temperature curves, analytics)
- **Icons:** Material Symbols Outlined
- **Fonts:** Inter (body), JetBrains Mono (hashes/IDs/stats), Noto Sans Thai (Thai text)
- **TypeScript:** strict mode enabled

## Key Rules
- Read `node_modules/next/dist/docs/` before writing Next.js code — this version has breaking changes from training data
- Design tokens are in `src/app/globals.css` as CSS custom properties (`--zrl-*`)
- Use `@theme inline` block in globals.css for Tailwind v4 theme extension — no tailwind.config file
- Dark mode: `prefers-color-scheme` media query (can switch to class-based later)
- Responsive breakpoints: Desktop ≥1024px, Tablet 768–1023px, Mobile <768px
- Touch targets: minimum 44px on all interactive elements for mobile
- All components must be accessible (ARIA labels, keyboard navigation)

## ZRL Color Palette
- Primary: `--zrl-primary: #6C5CE7`
- Success/Pass: `--zrl-success: #22C55E`
- Warning/Attention: `--zrl-warning: #F59E0B`
- Error/Fail: `--zrl-error: #EF4444`
- Cold-chain OK: `--zrl-cold-chain: #14B8A6`
- Completeness: `--zrl-completeness: #6C5CE7`

## Component Patterns (from PRD)
| Component | Classes |
|-----------|---------|
| Card | `bg-white dark:bg-surface-dark rounded-2xl shadow-soft p-6` |
| Button Primary | `bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-xl` |
| Badge Success | `px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700` |
| Badge Error | `px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700` |
| Hash/ID text | `text-xs font-mono` |
| Stat Value | `text-3xl font-bold font-mono tabular-nums` |

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
- E2E: Playwright for critical flows
- Accessibility: axe-core automated checks
