# Japan Longan Pesticide Enforcement

## 2026-04-03 20:05 ICT

- Goal: Create Japan/Longan rule files — completes Japan 4/4 products
- What changed:
  - `rules/japan/longan.yaml` (NEW) — FULL_PESTICIDE, 0.01 PLS default, WITH VHT Certificate (longan is B. dorsalis host)
  - `rules/japan/longan-substances.csv` (NEW) — 10 substances from Chiang Mai 2026 longan study (Sci. Rep.) + Thai MoPH
  - `src/modules/rules-engine/rule-loader.service.spec.ts` — added test verifying VHT present, labPolicy, substance shape
- TDD: RED (file not found) → GREEN (9/9 pass)
- Tests: 341 passed, 3x stable. Typecheck, lint, build clean.
- Key difference: longan requires VHT (fruit-fly host) unlike durian/mangosteen (nonhosts)
- Unique substances: hexaconazole, carbosulfan, formothion, ethion from Chiang Mai longan orchard study
