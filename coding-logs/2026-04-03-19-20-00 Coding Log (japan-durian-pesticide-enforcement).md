# Japan Durian Pesticide Enforcement

## 2026-04-03 19:20 ICT

- Goal: Create Japan/Durian rule files with FULL_PESTICIDE enforcement — first durian product in the rules engine
- What changed:
  - `rules/japan/durian.yaml` (NEW) — rule definition with FULL_PESTICIDE enforcement, 0.01 mg/kg PLS default, NO VHT Certificate (durian is not a Bactrocera host — thick husk)
  - `rules/japan/durian-substances.csv` (NEW) — 10 key Thai durian pesticides sourced from Thai FDA monitoring data and Krungching agrochemical usage study; Japanese aliases, CAS, Thai MRL comparators
  - `src/modules/rules-engine/rule-loader.service.spec.ts` — added test for Japan durian rule loading: verifies labPolicy, substance count, no VHT in required documents
- TDD evidence:
  - RED: `loads the repository japan durian rule file` failed — file not found
  - GREEN: all 7 rule-loader tests pass after file creation
- Tests run and results:
  - `npm test`: 339 passed, 9 skipped, 0 failed (3x consistent)
  - `npm run typecheck`: 0 errors
  - `npm run lint`: 0 errors
  - `npm run build`: success
- g-check: No CRITICAL/HIGH findings. Data-only change with one test.
- Research notes:
  - MAFF Annexed Table 2-2 does NOT list durian — no VHT/quarantine treatment required
  - Japan MHLW issued 2021 warning on Thai durian pesticide residues (carbendazim, dimethoate)
  - Carbendazim is highest-volume pesticide in Thai durian production (4,691 kg/yr in Krungching)
  - JFCRF has no API — Japan MRLs use mango proxy where durian-specific values are unverifiable
  - Japan PLS default 0.01 mg/kg covers all unlisted pesticides
- Follow-ups / known gaps:
  - Durian-specific Japan MRLs should be verified via manual JFCRF lookup when available
  - Other durian markets (Korea, China, EU) not yet implemented
