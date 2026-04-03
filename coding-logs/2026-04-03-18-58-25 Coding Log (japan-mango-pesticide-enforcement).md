# Japan Mango Pesticide Enforcement

## 2026-04-03 18:58 ICT

- Goal: Add FULL_PESTICIDE enforcement to Japan/Mango — same treatment as Korea/Mango PR #66
- What changed:
  - `rules/japan/mango.yaml` — added `labPolicy` block with `FULL_PESTICIDE` enforcement, `MRL_TEST` required artifact, `mg/kg`+`ppm` accepted units, `0.01 mg/kg` PLS default fallback
  - `rules/japan/mango-substances.csv` — upgraded from old 4-column format (`name,cas,thaiMrl,destinationMrl`) to enriched 7-column format (`name,aliases,cas,thaiMrl,destinationMrl,sourceRef,note`); added Japanese name aliases for all 12 substances; added JFCRF source references; added source comment headers; preserved all existing Thai MRL values and CAS numbers
  - `src/modules/rules-engine/rule-loader.service.spec.ts` — updated existing Japan test to verify `labPolicy`, `aliases`, and `sourceRef` fields
- TDD evidence:
  - RED: `loads csv-backed substances from the repository rule files` failed — `labPolicy` undefined, `aliases` missing
  - GREEN: all 6 rule-loader tests pass after YAML + CSV changes
- Tests run and results:
  - `npm test`: 338 passed, 9 skipped, 0 failed (3x consistent)
  - `npm run typecheck`: 0 errors
  - `npm run lint`: 0 errors
  - `npm run build`: success
- g-check: No CRITICAL/HIGH/MEDIUM findings. Clean diff — data + config only, no new code paths.
- Behavior changes and risk notes:
  - Japan mango lanes now get `FULL_PESTICIDE` enforcement — missing MRL_TEST artifacts block validation
  - Unmapped pesticides evaluated against official Japan PLS fallback `0.01 mg/kg`
  - Existing Japan lanes unaffected (snapshots are immutable)
  - No migration needed — nullable columns already exist from Korea PR #66
- Research notes:
  - Japan MRL authority: Consumer Affairs Agency (CAA), formerly MHLW
  - Official databases: JFCRF (db.ffcr.or.jp) and government DB (jpn-pesticides-database.go.jp)
  - Neither database has a programmatic API — manual curation required
  - Japan PLS default MRL is 0.01 mg/kg (same as Korea)
  - Mango is individually classified (not grouped) under "tropical fruit (inedible peel)"
- Follow-ups / known gaps:
  - 12 substances are the highest-risk Thai mango export pesticides — not the full Japan mango MRL list
  - Expansion to ~50-200 rows possible via manual JFCRF lookup (separate data-quality task)
  - Chlorpyrifos Japan MRL may have been revised in 2021 — verify against current JFCRF data
