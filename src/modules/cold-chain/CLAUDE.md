# Cold-Chain Module (M3)

## What This Module Does
Monitors temperature compliance across the logistics chain. Detects excursions based on **fruit-specific** thresholds (NOT generic 2–8°C). Calculates shelf-life impact and SLA compliance.

## Key Rules
- **MUST NOT** use generic 2–8°C thresholds — each fruit has specific dual-directional ranges
- Tropical fruits have BOTH chilling injury AND heat damage — two-sided thresholds
- Three operating modes: Manual (summary), Logger (5–15 min intervals), Telemetry (real-time 1 min)
- Excursion detection latency target: <5 minutes for Mode 3 (telemetry)

## Fruit Temperature Profiles (Critical — memorize these)
| Fruit | Optimal | Chilling (<) | Heat (>) | Shelf Life |
|-------|---------|-------------|----------|-----------|
| Mango | 10–13°C | <10°C skin damage | >15°C ripening | 14–21 days |
| Durian | 12–15°C | <10°C firmness | >18°C fermentation | 7–14 days |
| Mangosteen | 10–13°C | <8°C transparency | >15°C rapid rot | 14–21 days |
| Longan | 2–5°C | N/A (no chilling) | >8°C browning | 21–30 days |

## Excursion Severity Matrix
| Severity | Condition | Shelf-Life Impact |
|----------|-----------|-------------------|
| Minor | ±1°C ≤30 min | 0–5% |
| Moderate | ±2°C or ≤2 hours | 5–15% |
| Severe | ±3°C or >2 hours | 15–30% |
| Critical | Chilling threshold crossed | Up to 100% |

## Key Entities
- `FruitProfile` — temperature thresholds per species
- `TemperatureReading` — timestamped temp value with device ID
- `Excursion` — detected violation with severity, duration, impact
- `SLAReport` — Pass/Conditional/Fail assessment per lane

## Testing
- Mango at 9°C → chilling injury detected
- Mango at 16°C → heat damage detected
- Longan has NO chilling threshold (null)
- Shelf-life calculation within ±10% accuracy
- SLA classification: no excursions → PASS, moderate → CONDITIONAL, severe → FAIL
