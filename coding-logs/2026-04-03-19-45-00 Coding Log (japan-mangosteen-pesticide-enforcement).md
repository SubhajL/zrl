# Japan Mangosteen Pesticide Enforcement

## 2026-04-03 19:45 ICT

- Goal: Create Japan/Mangosteen rule files with FULL_PESTICIDE enforcement
- What changed:
  - `rules/japan/mangosteen.yaml` (NEW) — FULL_PESTICIDE, 0.01 PLS default, NO VHT (Japan exempted Thai mangosteen 2023 via JTEPA, nonhost for B. dorsalis)
  - `rules/japan/mangosteen-substances.csv` (NEW) — 11 substances from Phopin 2017 study (8 pesticides in 100% of Thai mangosteen samples) + Thai MoPH No.393 registrations
  - `src/modules/rules-engine/rule-loader.service.spec.ts` — added test for mangosteen rule loading
- TDD evidence:
  - RED: `loads the repository japan mangosteen rule file` failed — file not found
  - GREEN: all 8 rule-loader tests pass
- Tests: 340 passed, 3x stable. Typecheck, lint, build clean.
- Research: VHT exemption from FreshPlaza/JTEPA gazette, nonhost from J. Econ. Entomol. 2014, residues from Phopin 2017 JSFA
