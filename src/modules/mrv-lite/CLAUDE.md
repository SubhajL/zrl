# MRV-Lite Module (M5 — Optional)

## What This Module Does
Calculates carbon footprint per lane, tracks waste reduction, and generates ESG reports. Uses existing lane data — no additional exporter input required.

## Key Rules
- CO₂e accuracy target: ±15% of benchmark values
- Three report levels: per-lane card, per-exporter quarterly, platform annual
- This module is **optional** (medium priority) — do not let it block core modules

## Carbon Benchmarks
| Route | Mode | CO₂e/kg |
|-------|------|---------|
| Mango Thailand → Japan | Air | 2.3 |
| Mango Thailand → Japan | Sea | 1.1 |
| Durian Thailand → China | Truck | 0.8 |
| Durian Thailand → China | Sea | 0.5 |
| Mangosteen Thailand → Japan | Air | 2.1 |

## Key Entities
- `EmissionFactor` — CO₂e per kg for route × transport mode
- `CarbonFootprint` — calculated footprint per lane
- `ESGReport` — generated report at 3 levels

## Dependencies
- Imports: `LaneModule` (route data)

## Testing
- Carbon calculation matches benchmarks within ±15%
- Multi-segment route handling
- ESG report includes environmental, social, governance sections
