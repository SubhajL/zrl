# Rules Engine Module (M1)

## What This Module Does
Translates destination country regulations into machine-readable checklists. Validates evidence (especially MRL lab results) against destination-specific limits. Manages rule lifecycle with versioning and hot-reload.

## Key Rules
- MRL values are **always in mg/kg** — never mix units
- Stringency ratio = `thai_mrl / destination_mrl` (auto-calculated)
- Risk levels: ≥10x = Critical, ≥5x = High, ≥2x = Medium, <2x = Low
- **Zero false negatives** — every MRL exceedance MUST be flagged
- Rule definitions live in `rules/` directory as YAML files
- Rules are **snapshotted** at lane creation time — updates don't affect in-flight lanes
- Rule updates require versioning with changelog and audit trail
- **MUST NOT** hardcode MRL values in code — all data through the Rule Store

## Key Entities
- `Market` — destination country (Japan, China, Korea, EU)
- `RuleSet` — versioned rule definitions per market×product
- `Substance` — MRL data (name, CAS number, Thai MRL, dest MRL, stringency, risk)
- `Checklist` — required evidence list per market×product combination

## Critical Substances (Japan — memorize these)
| Substance | Thai MRL | Japan MRL | Ratio |
|-----------|---------|----------|-------|
| Chlorpyrifos | 0.5 | 0.01 | 50x |
| Dithiocarbamates | 2.0 | 0.1 | 20x |
| Carbendazim | 5.0 | 0.5 | 10x |
| Cypermethrin | 2.0 | 0.2 | 10x |

## Testing
- All 12 critical Japan substances must load correctly with exact values
- MRL comparison: value < limit = pass, value = limit = pass, value > limit = FAIL
- Checklist generation for Mango→Japan: 15 required items across 4 categories
- Weighted completeness: Regulatory 40%, Quality 25%, Cold-Chain 20%, Chain-of-Custody 15%
