# ZERO-REJECT EXPORT LANE (ZRL) — COMPREHENSIVE SYSTEM DEVELOPMENT SPECIFICATION

**Version:** 1.0
**Date:** March 21, 2026
**Source Integration:** NIA Proposal Chapters 1–13, Appendices ก–ค, Architecture Diagrams, Option-G v2
**UX/UI Standards Applied:** COMPREHENSIVE_STYLE_GUIDELINES, COMPREHENSIVE_UX_UI_GUIDELINES, Visualization Design Specifications

---

# PART 1: PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1.1 EXECUTIVE SUMMARY

### Product Vision
Zero-Reject Export Lane (ZRL) is a **shipment-level, audit-grade evidence orchestration platform** that eliminates the documentation gap causing Thai SME fruit exporters to suffer 15–30% rejection rates (vs. 3–5% for large exporters) at destination customs. The platform treats every export shipment as an atomic **"Lane"** — combining batch details, destination rules, logistics route, chain-of-custody checkpoints, evidence artifacts, and cold-chain SLA into a single auditable unit.

### Problem Statement
Thai SME fresh fruit exporters lose **1,500–3,000 million THB annually** due to:
- **45%** incomplete/incorrect documentation at destination
- **35%** pesticide residue exceeding destination MRL (Maximum Residue Limits)
- **20%** pest interception at customs
- **3–8%** claims/chargebacks with no defense evidence
- **5–15%** cold-chain compromises undetected

**Root Cause:** The problem is NOT fruit quality — SMEs source from the same farms as large exporters. The gap is entirely in **evidence management capability**.

### Success Metrics (Primary KPIs)

| KPI | Baseline (SME) | Target (Month 12) | Measurement |
|-----|----------------|-------------------|-------------|
| Mango→Japan Rejection Rate | 15–30% | <5% | System + downstream feedback |
| Document Completeness Score | 60–70% | 95%+ | Completeness score per lane |
| Proof-of-Readiness Time | 5–10 days | <24 hours | Lane creation → pack ready |
| Buyer Query Rate | 3–5/shipment | <1/shipment | Exporter + buyer reports |
| Claim/Chargeback Rate | 3–8% | <1% | Exporter financial records |
| Cold-Chain SLA Pass Rate | Unknown | 95%+ | System calculation from M3 |

---

## 1.2 USER PERSONAS AND ROLES

### 1.2.1 Primary Users

| Role | Profile | Key Pain Points | Primary Actions |
|------|---------|----------------|-----------------|
| **Exporter (SME)** | Owner/manager of sorting house (ล้ง), 100–500 tons/year, 0–1 compliance staff, uses Excel/paper/LINE | Missing docs, wrong MRL, rejected at Japan customs, pays claims without defense | Create lanes, upload evidence, view completeness, generate proof packs |
| **Farmer Cooperative** | 50+ member farmers, collective export, paper-based | Quality inconsistency across members, no traceability to individual farms | View member farm data, track batch origins, manage GAP certifications |
| **Independent Exporter** | Solo operator, phone/LINE coordination, 25–30% rejection | Highest rejection rate, some quit Japan market entirely | Simplified lane creation, guided evidence upload, pre-filled templates |

### 1.2.2 Secondary Users

| Role | Profile | Key Needs | Primary Actions |
|------|---------|-----------|-----------------|
| **Japanese Importer** | AEON/Isetan supplier, quality-first | Standardized proof packs, pre-arrival verification, temperature SLA | Receive/review buyer packs, verify compliance, provide acceptance feedback |
| **Logistics Partner** | Thai Airways Cargo, Kerry Cold Chain | Temperature data integration, handoff documentation | Submit cold-chain telemetry, sign checkpoint handoffs |
| **Testing Laboratory** | Central Lab Thai, SGS Thailand | Automated result delivery, digital certificates | Push MRL test results via API, issue digital certificates |
| **Government/Auditor** | DOA, ACFS, customs officials | Regulatory pack verification, audit trail access | View regulator packs, verify audit logs, read-only lane access |
| **Insurance Partner** | Cargo insurers | Claim evidence, SLA compliance proof | Access claim defense packs, review chain-of-custody |
| **Platform Admin** | System administrator | User management, rules configuration, system health | Configure rules, manage accounts, monitor dashboards |

### 1.2.3 RBAC (Role-Based Access Control)

| Role | Scope | Data Access | Functions | MFA |
|------|-------|-------------|-----------|-----|
| **Exporter** | Own lanes only | Own batches, evidence, packs | Create/view/edit lanes; upload evidence; generate packs | Optional |
| **Partner** | Assigned lane data only | Relevant checkpoint/test data | Update test results; submit telemetry; sign handoffs | API Key |
| **Admin** | All lanes (partially anonymized) | Full system access | Account management; rule configuration; dashboard | **Mandatory** |
| **Auditor** | Read-only all lanes | Complete audit trail | View trails; generate reports; verify hashes | **Mandatory** |

---

## 1.3 CORE CONCEPT: SHIPMENT LANE

### Definition
A **Shipment Lane** is the atomic unit of the platform — a single export transaction combining ALL dimensions:

```
LANE = {
  Exporter + Product Batch + Destination Market +
  Logistics Route + Chain-of-Custody Timeline +
  Evidence Artifacts + SLA Parameters
}
```

### Lane Components

| Component | Description | Example (Mango→Japan) |
|-----------|-------------|----------------------|
| **Lane ID** | Unique identifier | LN-2026-001 |
| **Batch** | Product type, variety, quantity, origin, harvest date | MNG-JPN-20690215-001, Nam Doc Mai, Grade A, 5,000 kg |
| **Destination Market** | Country + regulatory requirements | Japan (MAFF MRL 400+ substances + VHT) |
| **Route** | Origin → checkpoints → destination | Chachoengsao → Suvarnabhumi → Narita |
| **Checkpoints** | 4+ control points with evidence at each | Packing → VHT → Warehouse → Airport → Destination |
| **Evidence Artifacts** | All documentation with SHA-256 hashes | Phyto cert, lab results, temp log, photos, signatures |
| **Rules** | Market-specific regulations applied | Japan MRL 400+ substances, VHT 46.5°C/20min |
| **Status** | Lifecycle position | CREATED → COLLECTING → VALIDATED → PACKED → CLOSED |

### Lane Lifecycle (State Machine)

```
CREATED ──────► EVIDENCE_COLLECTING ──────► VALIDATED ──────► PACKED ──────► CLOSED
                      │                         │                              │
                      │                    [FAILS]                        [ACCEPTED]
                      │                         │                              │
                      │                    INCOMPLETE                     ARCHIVED
                      │                         │
                      │                    REMEDIATE
                      │                         │
                      └─────────────────────────┘
                                                                      [REJECTED]
                                                                          │
                                                                   CLAIM_DEFENSE
                                                                          │
                                                                   DISPUTE_RESOLVED
```

---

## 1.4 FUNCTIONAL REQUIREMENTS BY MODULE

### MODULE 1: MARKET-SPECIFIC RULES ENGINE

**Purpose:** Translate destination country regulations into machine-readable checklists that auto-validate shipment documentation.

#### FR-M1-001: Rule Set Management

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M1-001a | System shall maintain Japan MAFF MRL database for 400+ pesticide substances | Critical | All 400+ substances loaded with Thai vs. Japan comparison |
| FR-M1-001b | System shall maintain China GACC/GB standards for 200+ substances | Critical | GB 2763 standards loaded for durian, mangosteen, longan |
| FR-M1-001c | System shall maintain Korea KFDA PLS for 350+ substances | High | Korean MRL values loaded with 0.01 mg/kg default |
| FR-M1-001d | Each substance entry shall include: name, CAS number, Thai MRL, destination MRL, stringency ratio, risk level | Critical | All fields populated; stringency ratio auto-calculated |
| FR-M1-001e | Rules shall be updatable without code redeployment | Critical | YAML/JSON rule configuration; hot-reload capability |

#### FR-M1-002: Destination Rule Templates

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M1-002a | Japan template: MRL (400+), Phytosanitary (50+ criteria), VHT protocol, Customs docs (15+ templates), Buyer quality specs, Packaging (20+ criteria) | Critical | Complete template validated by domain expert |
| FR-M1-002b | China template: GACC registration (30+ criteria), GB standards (200+), Plant health (40+), Sulfur residue (5+) | High | Template operational by Q3 |
| FR-M1-002c | Korea template: PLS (350+), Phytosanitary, Korean labeling requirements | High | Template operational by Q3-Q4 |
| FR-M1-002d | EU template: 600+ MRL, TRACES NT, Deforestation regulation | Medium | Year 2 roadmap |

#### FR-M1-003: Auto-Validation Engine

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M1-003a | On lane creation, system shall auto-load all applicable rules for the selected destination market + product combination | Critical | Rules loaded within <2 seconds |
| FR-M1-003b | System shall validate uploaded lab results against destination MRL values and flag any substance exceeding the limit | Critical | Zero false negatives; all exceedances flagged |
| FR-M1-003c | System shall generate a real-time completeness checklist showing required vs. provided evidence | Critical | Completeness score updated on every evidence upload |
| FR-M1-003d | System shall alert exporters when required certifications (GAP, VHT, Phyto) are expired or missing | High | Alerts generated within 1 minute of detection |

#### FR-M1-004: Rule Update Mechanism

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M1-004a | System shall support rule updates within defined SLAs: Japan (30 days), China (45 days), Korea (30 days), EU (60 days) | High | Update published within SLA of regulatory change |
| FR-M1-004b | Rule updates shall not affect in-flight lanes (only new lanes) | Critical | Existing lanes use rules at creation time; optional re-validation |
| FR-M1-004c | All rule changes shall be versioned with changelog | High | Full audit trail of rule modifications |
| FR-M1-004d | System shall notify affected exporters when rules change | High | Push notification + email + in-app alert |

#### FR-M1-005: Critical Substance Monitoring (Japan)

The following 12 substances require special attention due to 5–50x stringency difference:

| Substance | Thai MRL (mg/kg) | Japan MRL (mg/kg) | Stringency | Risk |
|-----------|-----------------|-------------------|-----------|------|
| Chlorpyrifos | 0.5 | 0.01 | **50x** | Critical |
| Dithiocarbamates | 2.0 | 0.1 | **20x** | Critical |
| Carbendazim | 5.0 | 0.5 | **10x** | High |
| Cypermethrin | 2.0 | 0.2 | **10x** | High |
| Profenofos | 0.5 | 0.05 | **10x** | High |
| Imidacloprid | 1.0 | 0.2 | **5x** | High |
| Metalaxyl | 1.0 | 0.2 | **5x** | Medium |
| Difenoconazole | 0.5 | 0.1 | **5x** | Medium |
| Thiabendazole | 10.0 | 3.0 | **3.3x** | Medium |
| Prochloraz | 5.0 | 2.0 | **2.5x** | Medium |
| Lambda-cyhalothrin | 0.5 | 0.2 | **2.5x** | Medium |
| Acetamiprid | 0.5 | 0.3 | **1.7x** | Low |

---

### MODULE 2: EVIDENCE GRAPH + PROOF PACK GENERATOR

**Purpose:** Collect, hash-link, validate, and assemble all shipment evidence into a tamper-evident Directed Acyclic Graph (DAG), then generate market-specific proof packs.

#### FR-M2-001: Evidence Graph (DAG)

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M2-001a | Every evidence artifact shall receive a SHA-256 content hash upon upload | Critical | Hash computed within <1 second; stored immutably |
| FR-M2-001b | Every artifact shall be cryptographically linked to its parent lane, batch, and checkpoint | Critical | Graph traversal verifiable from any node |
| FR-M2-001c | Evidence graph shall be tamper-evident: modifying any artifact invalidates downstream hashes | Critical | Hash chain verification passes 100% in integrity tests |
| FR-M2-001d | System shall support the following artifact types with specific verification methods: | Critical | All types supported with appropriate verification |

**Artifact Types:**

| Type | Source | Input Method | Verification |
|------|--------|--------------|--------------|
| MRL Test Results | Lab (Central Lab, SGS) | API or PDF+OCR | Hash vs. Lab API |
| VHT Certificate | Plant Protection Station | Upload + manual | Certificate number verification |
| Phytosanitary Certificate | DOA | Upload + manual | Certificate number verification |
| Checkpoint Photos | Exporter/Logistics | In-app capture (GPS+timestamp) | EXIF + GPS + timestamp |
| Temperature Data | Logger/Telemetry | API or BLE download | Hash vs. device ID |
| Handoff Signatures | Recipient at checkpoint | Digital signature in app | Signature + timestamp |
| Invoice/Bill of Lading | Exporter | Upload | Content hash |
| GAP Certificate | Agricultural ministry | Upload + verify | Certificate number |

#### FR-M2-002: Completeness Scoring

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M2-002a | System shall compute: `Completeness = (artifacts_present / artifacts_required) × 100%` | Critical | Real-time calculation per lane |
| FR-M2-002b | Required artifacts shall be weighted by category: Regulatory (40%), Quality (25%), Cold-Chain (20%), Chain-of-Custody (15%) | High | Weighted score visible on dashboard |
| FR-M2-002c | System shall display missing evidence items with visual indicators | Critical | Traffic-light indicator per artifact |
| FR-M2-002d | Lane cannot transition to VALIDATED until completeness ≥ 95% | Critical | State machine enforced |

**Mango→Japan Completeness Example (15 required items):**

| Category | # Required | Weight | Examples |
|----------|-----------|--------|----------|
| Regulatory | 5 | 40% | Phyto cert, VHT cert, MRL test, license, invoice |
| Quality | 4 | 25% | Grading report, product photos, GAP cert, packing list |
| Cold-Chain | 3 | 20% | Temp log, SLA summary, excursion report |
| Chain-of-Custody | 3 | 15% | Handoff signatures, transport doc, delivery note |

#### FR-M2-003: Proof Pack Generator

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M2-003a | System shall generate 3 proof pack types from the same evidence graph | Critical | Each type contains correct subset of evidence |
| FR-M2-003b | Proof packs shall be PDF format with embedded metadata (JSON) | Critical | PDF readable; JSON machine-parseable |
| FR-M2-003c | Each generated pack shall include a verification hash and QR code linking to online verification | High | QR resolves to verification endpoint |

**Three Proof Pack Types:**

| Pack | Audience | Purpose | Contents | Language |
|------|----------|---------|----------|----------|
| **Regulator Pack** | Customs officers, quarantine | Customs clearance | All MRL results (every substance), phyto cert, VHT cert, import forms | Thai + English |
| **Buyer Pack** | Importers, retailers | Quality verification | MRL summary (pass/fail), phyto, VHT, temp SLA summary, checkpoint photos | English + Japanese/Chinese |
| **Claim Defense Pack** | Lawyers, insurance, disputes | Dispute resolution | All of above + chain-of-custody (every handoff signature), temp graphs, excursion analysis, forensics, full audit trail | English |

**Market-Specific Pack Matrix:**

| Fruit × Market | Pack ID | Doc Count | Key Emphasis | Timeline |
|---------------|---------|-----------|--------------|----------|
| Mango → Japan | Pack A | 10 | MRL + VHT + quality grading | Q1–Q2 |
| Mango → China | Pack B | 9 | GACC + GB quality | Q3 |
| Mango → Korea | Pack C | 8 | KFDA PLS + phytosanitary | Q3 |
| Durian → China | Pack E | 11 | GB quality + sulfur test + grade | Q3 |
| Mangosteen → Japan | Pack F | 9 | Pest focus + cold-chain | Q4 |
| Mangosteen → China | Pack G | 10 | Sulfur test + GACC | Q4 |

---

### MODULE 3: COLD-CHAIN SLA & EXCURSION FORENSICS

**Purpose:** Monitor, evaluate, and prove temperature compliance across the entire logistics chain, calibrated specifically for tropical fruits (which have unique dual-directional damage profiles).

#### FR-M3-001: Tropical Fruit Temperature Profiles

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M3-001a | System shall maintain fruit-specific temperature thresholds (not generic 2–8°C) | Critical | All 4 fruit profiles configured |

**Fruit Temperature Profiles:**

| Fruit | Optimal Range | Chilling Injury (<) | Heat Damage (>) | Shelf Life |
|-------|---------------|---------------------|-----------------|-----------|
| **Mango** | 10–13°C | <10°C (skin damage, flesh discoloration) | >15°C (premature ripening) | 14–21 days |
| **Durian** | 12–15°C | <10°C (unusual flesh firmness) | >18°C (fermentation, rot) | 7–14 days |
| **Mangosteen** | 10–13°C | <8°C (flesh transparency) | >15°C (rapid rot, rind hardening) | 14–21 days |
| **Longan** | 2–5°C | N/A | >8°C (browning) | 21–30 days |

#### FR-M3-002: Three Operating Modes

| Mode | Equipment | Data Frequency | Cost | Suitable For |
|------|-----------|----------------|------|-------------|
| **Mode 1: Manual** | None | Summary after shipment | Free | Large exporters with existing systems |
| **Mode 2: Logger** | USB logger ($20–50) | Every 5–15 minutes | Low | SME pilots |
| **Mode 3: Telemetry** | IoT sensor (partner) | Real-time (every 1 min) | Moderate | Large operations |

#### FR-M3-003: Excursion Detection & Response

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M3-003a | System shall detect temperature excursions automatically based on fruit-specific thresholds | Critical | All excursion types detected with <5 minute latency (Mode 3) |
| FR-M3-003b | Each excursion shall be classified by severity | Critical | Correct classification per severity matrix |
| FR-M3-003c | System shall calculate remaining shelf-life impact after excursion | High | Shelf-life adjustment within ±10% accuracy |

**Excursion Severity Matrix:**

| Type | Condition | System Response | Shelf-Life Impact |
|------|-----------|-----------------|-------------------|
| Minor | ±1°C overage ≤30 min | Log, info alert | -0–5% |
| Moderate | ±2°C or ≤2 hours | Urgent alert, SLA flag | -5–15% |
| Severe | ±3°C or >2 hours | Critical alert, SLA breach | -15–30% |
| Critical | Chilling injury threshold crossed | Immediate alert, potential total loss | Up to 100% |

#### FR-M3-004: SLA Evaluation & Reporting

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M3-004a | System shall generate SLA compliance report per lane | High | Report includes pass/conditional/fail status |
| FR-M3-004b | Report shall include: total excursion time, count, max deviation, defensibility score | High | All fields populated from telemetry data |
| FR-M3-004c | System shall generate temperature curve visualization with checkpoint markers | High | Interactive chart with zoom capability |

---

### MODULE 4: DISPUTE SHIELD (CLAIM DEFENSE)

**Purpose:** Auto-generate defense-grade dossiers when shipments face rejection, quality claims, or chargebacks — protecting SMEs who currently lose 3–8% of value with no evidence to counter.

#### FR-M4-001: Claim Defense Pack Generation

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M4-001a | System shall auto-generate Claim Defense Pack on demand when a dispute is triggered | Critical | Pack generated within <5 minutes |
| FR-M4-001b | Pack shall contain 6 mandatory sections | Critical | All sections populated with available data |

**Claim Defense Pack Structure:**

| Section | Content | Format |
|---------|---------|--------|
| 1. Executive Summary | Lane summary, key facts, timeline overview | 1-page PDF |
| 2. Chain-of-Custody Timeline | Every handoff with timestamp, location, signer | Table + graphic |
| 3. Compliance Report | All rule checks (pass/fail per substance) | Table with RAG status |
| 4. Temperature Forensics | Temperature graphs + excursion analysis + root cause | Graphs + narrative |
| 5. Visual Evidence | Handoff photos at every checkpoint with EXIF metadata | Photo gallery + metadata |
| 6. Audit Trail | Complete tamper-evident log of all system actions | Hash-chained log extract |

#### FR-M4-002: Dispute Scenarios

| Scenario | Claimant | Key Defense Evidence | Value Protected |
|----------|----------|---------------------|-----------------|
| Rejection at Japan Customs | Japan Customs | Lab results (MRL) + VHT cert + phyto | 100% of shipment |
| Buyer Quality Claim | Importer | Checkpoint photos + cold log + grading | 30–100% |
| Insurance Claim | Insurance co. | Cold-chain SLA + excursion analysis | Indemnity value |
| Durian Grade Dispute | China importer | Grading photos + ripeness tracker + handoff | 20–50% |
| Cargo Damage | Logistics provider | Handoff signatures + cold log | Damage value |

---

### MODULE 5: MRV-LITE CARBON/WASTE ADD-ON (OPTIONAL)

**Purpose:** Address ESG trends from premium buyers (AEON, Isetan) requiring sustainability reporting, using existing lane data without additional exporter input.

#### FR-M5-001: Carbon Footprint Calculation

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M5-001a | System shall calculate CO₂e per kg for each lane based on route, transport mode, and volume | Medium | Calculation within ±15% of benchmark values |
| FR-M5-001b | System shall maintain emission factor database for Thai export routes | Medium | All primary routes covered |

**Carbon Benchmarks:**

| Route | Mode | CO₂e/kg |
|-------|------|---------|
| Mango Thailand → Japan | Air | 2.3 |
| Mango Thailand → Japan | Sea | 1.1 |
| Durian Thailand → China | Truck | 0.8 |
| Durian Thailand → China | Sea | 0.5 |
| Mangosteen Thailand → Japan | Air | 2.1 |

#### FR-M5-002: Waste Tracking & ESG Reporting

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-M5-002a | System shall track waste reduction: rejection rate, shipping damage, grade downgrade | Medium | Metrics calculated from lane status data |
| FR-M5-002b | System shall generate 3-level ESG reports: per-lane card, per-exporter quarterly, platform annual | Medium | All 3 levels generated on schedule |

---

## 1.5 CROSS-CUTTING FUNCTIONAL REQUIREMENTS

### FR-CC-001: Tamper-Evident Audit Log

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-CC-001a | Every system action shall create an append-only audit entry | Critical | Zero gaps in audit chain |
| FR-CC-001b | Each entry shall be hash-chained (SHA-256) referencing previous entry's hash | Critical | Any retroactive edit detectable |
| FR-CC-001c | Audit log shall be retained for 10 years | Critical | Retention policy enforced |

**Audit Entry Schema:**

| Field | Type | Description |
|-------|------|-------------|
| `entry_id` | UUID | Unique identifier |
| `timestamp` | ISO 8601 (UTC) | Event time |
| `actor` | String | User ID or "system" |
| `action` | Enum | UPLOAD, SIGN, GENERATE, VERIFY, CREATE, UPDATE |
| `entity_type` | Enum | LANE, ARTIFACT, CHECKPOINT, PROOF_PACK |
| `entity_id` | UUID | Associated entity |
| `payload_hash` | SHA-256 | Hash of associated content |
| `prev_hash` | SHA-256 | Hash of previous entry |
| `entry_hash` | SHA-256 | This entry's computed hash |

### FR-CC-002: Authentication & Authorization

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-CC-002a | JWT-based stateless authentication | Critical | Token expiry ≤ 1 hour; refresh token support |
| FR-CC-002b | MFA (TOTP) mandatory for Admin and Auditor roles | Critical | MFA enforced at login |
| FR-CC-002c | Session timeout after 30 minutes of inactivity | High | Auto-logout with warning |
| FR-CC-002d | API partner authentication via API keys with IP whitelisting | High | Keys rotatable; IP restricted |

### FR-CC-003: Data Classification & Retention

| Data Type | Level | Encryption | Retention | Destruction |
|-----------|-------|-----------|-----------|------------|
| Exporter business data | L3 Confidential | AES-256 + field-level | Lifetime + 7 years | Permanent deletion + certificate |
| Shipment/lane data | L2 Internal | AES-256 at rest; TLS 1.3 | 7 years | Automated archival → deletion |
| MRL test results | L3 Confidential | AES-256 at rest; TLS 1.3 | 7 years | Permanent deletion |
| Temperature telemetry | L2 Internal | AES-256 at rest; TLS 1.3 | 3 years | Automated deletion |
| Checkpoint images | L2 Internal | AES-256 at rest; TLS 1.3 | 5 years | Automated deletion |
| Audit logs | L3 Confidential | AES-256 at rest; TLS 1.3 | 10 years | Read-only archive |
| Proof packs (PDF) | L2 Internal | AES-256 at rest; TLS 1.3 | 7 years | Automated archival |

### FR-CC-004: PDPA Compliance

| ID | Requirement | Priority | Acceptance Criteria |
|----|-------------|----------|-------------------|
| FR-CC-004a | Consent management for marketing communications | Critical | Opt-in/opt-out UI available |
| FR-CC-004b | Data subject rights: Access, Correction, Deletion, Objection, Portability, Withdraw Consent | Critical | All rights exercisable within 30-day PDPA SLA |
| FR-CC-004c | Data export in JSON/CSV for portability requests | High | Export covers all user-provided data |
| FR-CC-004d | Data breach notification within 72 hours to PDPA Office | Critical | Incident response plan documented |

### FR-CC-005: Partner API Integrations

| Partner | Integration Type | Data Flow | Priority | Timeline |
|---------|-----------------|-----------|----------|----------|
| Central Lab Thai | REST API | MRL test results → Platform | Critical | Q1 |
| SGS Thailand | REST API | Multi-residue analysis → Platform | High | Q2 |
| Thai Airways Cargo | REST API / SFTP | Cold-chain data → Platform | High | Q2 |
| Kerry Express Cold Chain | REST API | Temperature telemetry → Platform | High | Q3 |
| DOA (e-Phyto) | REST API | Phytosanitary status → Platform | Medium | Year 2 |
| ACFS (มกอช.) | Public DB query | GAP certification status → Platform | Medium | Q2 |

---

## 1.6 NON-FUNCTIONAL REQUIREMENTS

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| API response time (p95) | <2 seconds | Load testing with k6 |
| Concurrent lane processing | 100+ lanes/month | Capacity testing |
| Proof pack generation time | <30 seconds per pack | Automated benchmark |
| Evidence upload (10 MB file) | <5 seconds | Network + processing |
| Dashboard load time | <3 seconds | Lighthouse audit |

### Availability & Disaster Recovery

| Service Level | Services | Uptime | RTO | RPO |
|---------------|----------|--------|-----|-----|
| Critical | Lane orchestration, proof pack generation | 99.9% | 1 hour | 15 min |
| High | Evidence upload, cold-chain logging | 99.5% | 4 hours | 1 hour |
| Medium | Dashboard, analytics, reporting | 99.0% | 8 hours | 4 hours |
| Low | Marketing site, documentation | 95.0% | 24 hours | 24 hours |

### Security (Defense-in-Depth)

| Layer | Controls | Technology |
|-------|----------|-----------|
| Network | Firewall, WAF, DDoS protection | AWS WAF, CloudFront |
| Application | Input validation, OWASP Top 10 | SAST/DAST scanning |
| Authentication | MFA, session management, API keys | OAuth 2.0, TOTP |
| Data | Encryption at rest/transit, field-level | AES-256, TLS 1.3 |
| Integrity | Content hashing, tamper-evident log | SHA-256, hash chain |

### Quality Standards

| Aspect | Standard |
|--------|----------|
| Code Coverage | ≥80% unit tests |
| Code Review | All PRs need ≥1 review |
| Testing Levels | Unit (Jest), Integration (Supertest), E2E (Playwright) |
| Security Testing | OWASP ZAP per sprint; zero critical/high |
| Performance Testing | k6 load testing; <2s p95 response |
| API Documentation | Auto-generated OpenAPI/Swagger |

---

# PART 2: SYSTEM ARCHITECTURE AND MODULE DESCRIPTIONS

## 2.1 ARCHITECTURAL PHILOSOPHY

### Design Principles

| Principle | Description | Rationale |
|-----------|-------------|-----------|
| **Lane-Centric** | Everything revolves around Lane as atomic unit | Prevents evidence fragmentation |
| **Tamper-Evident** | Every artifact hash-verified | Creates audit-grade credibility |
| **Market-Specific** | Rules separated by destination country | Japan ≠ China ≠ Korea requirements |
| **Progressive** | Start simple, add complexity gradually | Reduces SME adoption barrier |
| **Evidence-First** | Prioritize verifiable evidence over documents | Documents ≠ acceptance proof |

### Architecture Strategy: Modular Monolith → Microservices

| Phase | Architecture | Rationale |
|-------|-------------|-----------|
| **Q1–Q2** | Modular Monolith | Fast development velocity; single deploy; small team (5.5 FTE) |
| **Q3–Q4** | Begin Service Extraction | Module boundaries proven; extract hot paths |
| **Year 2+** | Full Microservices | Team scaling; independent deployment; horizontal scaling |

**Key Decision: Hash Chain over Blockchain**

| Factor | Hash Chain (Selected) | Blockchain |
|--------|---------------------|-----------|
| Complexity | Low (PostgreSQL-based) | High (separate nodes) |
| Cost | Low (no gas fees) | High (transaction costs) |
| Performance | High (immediate write) | Low (consensus delay) |
| Tamper-evident | Yes | Yes |
| Suitability | **High** (users trust operator) | Low (over-engineered) |

---

## 2.2 FOUR-LAYER SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: PRESENTATION / INTERFACES                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Exporter     │ │ Logistics    │ │ Auditor      │ │ Insurer      │       │
│  │ Portal       │ │ Portal       │ │ Portal       │ │ Portal       │       │
│  │ (Web + PWA)  │ │ (Web + PWA)  │ │ (Web)        │ │ (API)        │       │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘       │
│         │                │                │                │                │
│  React/Next.js (TypeScript) + Tailwind CSS + Recharts                      │
│  PWA: Service Workers for offline checkpoint capture                        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          └────────────────┴────────────────┴────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 2: API GATEWAY                                  │
│                Authentication · Rate Limiting · Routing · CORS              │
│                Kong / AWS API Gateway                                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 3: CORE SERVICES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Lane Service    │  │ Evidence Service │  │ Pack Builder    │             │
│  │                  │  │                  │  │   Service       │             │
│  │ • Create Lane    │  │ • Upload/Link    │  │                 │             │
│  │ • Orchestration  │  │ • Validation     │  │ • Regulator     │             │
│  │ • Status Track   │  │ • Graph Build    │  │ • Buyer Pack    │             │
│  │ • Checkpoint     │  │ • Hash/Verify    │  │ • Defense Pack  │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Rules Engine     │  │ Cold-Chain       │  │ Dispute Engine   │             │
│  │                  │  │   Engine         │  │                  │             │
│  │ • Market Rules   │  │ • SLA Calc       │  │ • Timeline       │             │
│  │ • MRL Validation │  │ • Excursion Det. │  │ • Forensics      │             │
│  │ • Checklists     │  │ • Shelf-Life     │  │ • Defense Pack   │             │
│  │ • Templates      │  │ • Fruit Profiles │  │ • Claim Analysis │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Auth Service     │  │ Notification     │  │ MRV-Lite         │             │
│  │                  │  │   Service        │  │   Service        │             │
│  │ • JWT + MFA      │  │ • Email          │  │ • Carbon Calc    │             │
│  │ • RBAC           │  │ • Push/In-App    │  │ • Waste Track    │             │
│  │ • API Keys       │  │ • LINE           │  │ • ESG Report     │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│                                                                              │
│  NestJS (Node.js/TypeScript) + Python FastAPI (ML/Analytics)                │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LAYER 4: DATA / PERSISTENCE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ PostgreSQL   │ │ AWS S3 / GCS │ │ Kafka / SQS  │ │ Redis        │       │
│  │              │ │              │ │              │ │              │       │
│  │ • Lane meta  │ │ • Evidence   │ │ • Events     │ │ • Sessions   │       │
│  │ • Rules DB   │ │ • Photos     │ │ • Checkpoint │ │ • Cache      │       │
│  │ • Users      │ │ • Temp logs  │ │ • Telemetry  │ │ • Rate limit │       │
│  │ • Audit log  │ │ • Proof PDFs │ │ • Alerts     │ │ • Dashboard  │       │
│  │ (hash-chain) │ │ (versioned)  │ │ (ordered)    │ │ (real-time)  │       │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    INTEGRATION LAYER                              │       │
│  │  Lab APIs (Central Lab, SGS) · Logistics (Thai Airways, Kerry)  │       │
│  │  IoT Telemetry · DOA e-Phyto · ACFS GAP DB                     │       │
│  └──────────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2.3 MODULE DESCRIPTIONS

### Module M1: Market-Specific Rules Engine

**Responsibility:** Convert destination country regulations into machine-readable rules; auto-validate evidence against rules; manage rule lifecycle.

**Core Components:**
1. **Rule Store** — YAML/JSON rule definitions per market×product combination, versioned in PostgreSQL
2. **Rule Loader** — Hot-reloadable rule loading without service restart
3. **Validation Engine** — Compares evidence data (lab results, certificates) against loaded rules
4. **Checklist Generator** — Produces required-evidence checklist for a given lane configuration
5. **Template Manager** — Market-specific document templates (customs forms, packaging labels)
6. **Rule Update Pipeline** — Detect → Analyze → Translate → Test → Publish → Notify

**Key Data Entities:** `Market`, `RuleSet`, `Rule`, `Substance` (MRL), `Template`, `Checklist`, `RuleVersion`

**Reusability for new markets:** Template structure 100%, MRL validation 90%, Checklist engine 85%, Pack generator 80%, MRL data values 0% (new per market), Document templates 30%

---

### Module M2: Evidence Graph + Proof Pack Generator

**Responsibility:** Manage evidence lifecycle (upload, hash, link, validate); build DAG structure; generate proof packs.

**Core Components:**
1. **Artifact Ingestion** — Multi-source upload (file, API, camera capture) with immediate SHA-256 hashing
2. **Graph Engine** — DAG construction linking artifacts to lanes, batches, checkpoints
3. **Integrity Verifier** — On-demand hash chain verification for any artifact or subgraph
4. **Completeness Calculator** — Real-time weighted completeness scoring
5. **Pack Builder** — Template-based PDF generator (Puppeteer + Handlebars) producing 3 pack types
6. **OCR Pipeline** — PDF lab result → structured data extraction (for non-API sources)

**Key Data Entities:** `EvidenceArtifact`, `ArtifactLink`, `EvidenceGraph`, `ProofPack`, `PackTemplate`

---

### Module M3: Cold-Chain SLA Engine

**Responsibility:** Ingest temperature data; evaluate against fruit-specific SLAs; detect excursions; calculate shelf-life impact.

**Core Components:**
1. **Telemetry Ingestion** — Multi-protocol support (REST API, BLE download, CSV upload, MQTT)
2. **Fruit Profile Manager** — Temperature thresholds per fruit species (mango 10–13°C, durian 12–15°C, etc.)
3. **Excursion Detector** — Real-time threshold monitoring with severity classification
4. **Shelf-Life Calculator** — Remaining shelf-life estimation based on cumulative excursion impact
5. **SLA Evaluator** — Pass/Conditional/Fail assessment per lane
6. **Visualization Engine** — Temperature curve generation with checkpoint markers and excursion highlights

**Key Data Entities:** `TemperatureReading`, `FruitProfile`, `Excursion`, `SLAReport`, `ColdChainDevice`

---

### Module M4: Dispute Shield

**Responsibility:** Generate defense-grade dossiers; reconstruct chain-of-custody timelines; provide forensic evidence for claims.

**Core Components:**
1. **Claim Trigger Manager** — Detect or manually trigger claim defense workflow
2. **Timeline Reconstructor** — Build chronological chain-of-custody from all checkpoints and handoffs
3. **Forensics Engine** — Analyze excursion root causes, identify liability segments
4. **Defense Pack Assembler** — Generate 6-section PDF dossier from evidence graph
5. **Claim Tracker** — Track claim status, outcomes, and financial impact

**Key Data Entities:** `Claim`, `DefensePack`, `TimelineEvent`, `ForensicsReport`, `ClaimOutcome`

---

### Module M5: MRV-Lite (Carbon/Waste/ESG)

**Responsibility:** Calculate environmental footprint; track waste reduction; generate ESG reports for buyer compliance.

**Core Components:**
1. **Carbon Calculator** — Route-based CO₂e computation using emission factor database
2. **Waste Tracker** — Compare baseline rejection rates vs. actual to quantify waste avoided
3. **ESG Report Generator** — 3-level reports (per-lane card, quarterly exporter, annual platform)
4. **Benchmark Database** — Emission factors for all primary Thai export routes

**Key Data Entities:** `CarbonFootprint`, `WasteMetric`, `ESGReport`, `EmissionFactor`

---

### Supporting Services

| Service | Responsibility | Key Features |
|---------|---------------|--------------|
| **Auth Service** | Identity, access control | JWT issuance, MFA enrollment, RBAC enforcement, API key management |
| **Notification Service** | Multi-channel alerting | Email, push, in-app, LINE integration; rule-change alerts, excursion alerts |
| **Analytics Service** | ML/insights | Anomaly detection, rejection prediction, trend analysis |
| **Integration Gateway** | External system connectivity | Lab API adapters, logistics API adapters, IoT protocol translation |

---

## 2.4 CORE DATA MODEL

```
┌───────────────────────────────────────────────────────────────────┐
│                           LANE                                     │
│  lane_id (PK), exporter_id (FK), status, created_at, updated_at  │
│  product_type, destination_market, completeness_score              │
├───────────────────────────────────────────────────────────────────┤
│         │                    │                    │                │
│    ┌────┴────┐         ┌────┴────┐         ┌────┴────┐          │
│    │  BATCH  │         │  ROUTE  │         │  RULES  │          │
│    │         │         │         │         │(snapshot)│          │
│    │ batch_id│         │ route_id│         │ rule_set │          │
│    │ product │         │segments │         │ market   │          │
│    │quantity │         │carriers │         │standards │          │
│    │ origin  │         │checkpts │         │ version  │          │
│    │ harvest │         │         │         │          │          │
│    │ grade   │         │         │         │          │          │
│    └────┬────┘         └────┬────┘         └─────────┘          │
│         │                   │                                     │
│    ┌────┴──────────────────┴────┐                                │
│    │     EVIDENCE ARTIFACT       │                                │
│    │                             │                                │
│    │ artifact_id (PK)            │                                │
│    │ lane_id (FK)                │                                │
│    │ artifact_type (enum)        │                                │
│    │ file_path (S3 key)          │                                │
│    │ content_hash (SHA-256)      │                                │
│    │ issuer                      │                                │
│    │ issued_at                   │                                │
│    │ uploaded_by                 │                                │
│    │ uploaded_at                 │                                │
│    │ verification_status         │                                │
│    │ metadata (JSONB)            │                                │
│    └─────────────────────────────┘                                │
│                                                                    │
│    ┌─────────────────────────────┐                                │
│    │       CHECKPOINT            │                                │
│    │                             │                                │
│    │ checkpoint_id (PK)          │                                │
│    │ lane_id (FK)                │                                │
│    │ sequence (1-4+)             │                                │
│    │ location_name               │                                │
│    │ gps_lat, gps_lng            │                                │
│    │ timestamp                   │                                │
│    │ temperature                 │                                │
│    │ photo_artifact_id (FK)      │                                │
│    │ signature_hash              │                                │
│    │ signer_name                 │                                │
│    │ condition_notes             │                                │
│    └─────────────────────────────┘                                │
│                                                                    │
│    ┌─────────────────────────────┐                                │
│    │       PROOF PACK            │                                │
│    │                             │                                │
│    │ pack_id (PK)                │                                │
│    │ lane_id (FK)                │                                │
│    │ pack_type (enum)            │                                │
│    │ version                     │                                │
│    │ content_hash (SHA-256)      │                                │
│    │ file_path (S3 key)          │                                │
│    │ generated_at                │                                │
│    │ generated_by                │                                │
│    │ recipient                   │                                │
│    └─────────────────────────────┘                                │
│                                                                    │
│    ┌─────────────────────────────┐                                │
│    │      AUDIT ENTRY            │                                │
│    │                             │                                │
│    │ entry_id (PK, UUID)         │                                │
│    │ timestamp (ISO 8601 UTC)    │                                │
│    │ actor                       │                                │
│    │ action (enum)               │                                │
│    │ entity_type (enum)          │                                │
│    │ entity_id (UUID)            │                                │
│    │ payload_hash (SHA-256)      │                                │
│    │ prev_hash (SHA-256)         │                                │
│    │ entry_hash (SHA-256)        │                                │
│    └─────────────────────────────┘                                │
└───────────────────────────────────────────────────────────────────┘
```

---

# PART 3: DETAILED TECH STACK PER MODULE

## 3.1 TECH STACK OVERVIEW

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Language** | TypeScript | 5.x | End-to-end type safety; large Thai developer pool |
| **Frontend** | React + Next.js | 14+ (App Router) | SSR/SSG for SEO; API routes; large ecosystem |
| **Styling** | Tailwind CSS | 3.x | Utility-first; design token integration; rapid iteration |
| **Charts** | Recharts | 2.x | React-native charting; temperature curves, analytics |
| **Icons** | Material Symbols Outlined | Latest | Consistent icon family; outlined style |
| **Backend** | NestJS (Node.js) | 10+ | TypeScript; modular architecture; ideal for monolith→microservices |
| **ML/Analytics** | Python FastAPI | 0.100+ | Excursion detection ML; shelf-life prediction |
| **Database** | PostgreSQL | 15+ | ACID; JSONB for flexible metadata; audit trail integrity |
| **Object Storage** | AWS S3 | — | Versioning + immutability for evidence files |
| **Message Queue** | Apache Kafka / AWS SQS | — | Event-driven checkpoint processing; telemetry streaming |
| **Cache** | Redis | 7.x | Session management; real-time dashboard; rate limiting |
| **PDF Generation** | Puppeteer + Handlebars | — | Dynamic proof pack templates; multi-language support |
| **Hashing** | SHA-256 (Node.js crypto) | — | Industry standard; tamper-evident verification |
| **Authentication** | JWT + TOTP (speakeasy) | — | Stateless auth; MFA for critical roles |
| **Deployment** | Docker + Kubernetes | — | Cloud-native; auto-scaling; multi-cloud capable |
| **CI/CD** | GitHub Actions | — | Automated testing, linting, deployment pipeline |
| **Monitoring** | Prometheus + Grafana | — | Real-time health; custom dashboards; alerting |
| **WAF/CDN** | AWS WAF + CloudFront | — | DDoS protection; edge caching; TLS termination |
| **Secrets** | AWS KMS | — | Encryption key management; HSM-backed |

---

## 3.2 MODULE-SPECIFIC TECH STACKS

### M1: Market Rules Engine

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Rule Storage | PostgreSQL (JSONB) + YAML files in Git | Versioned rule definitions |
| Rule Parser | Custom NestJS service | Parse YAML → validation logic |
| MRL Database | PostgreSQL tables | 400+ substance records per market |
| Validation Engine | NestJS guards + custom validators | Real-time evidence validation |
| Template Rendering | Handlebars | Market-specific document templates |
| Rule Versioning | PostgreSQL temporal tables | Track rule changes over time |
| Notification | AWS SES + LINE Messaging API | Alert exporters of rule changes |
| **Testing** | Jest + custom MRL test fixtures | Validate all 400+ substances |

### M2: Evidence Graph + Proof Pack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Graph Engine | PostgreSQL (adjacency list) + Redis graph cache | DAG traversal and integrity checks |
| File Ingestion | Multer (Node.js) + AWS S3 SDK | Multi-part upload with streaming |
| Hashing | Node.js `crypto.createHash('sha256')` | Content hashing on upload |
| OCR | Tesseract.js / AWS Textract | Lab result PDF → structured data |
| PDF Generation | Puppeteer + Handlebars templates | Multi-language proof packs |
| QR Codes | `qrcode` npm package | Verification QR embedded in packs |
| Image Processing | Sharp (Node.js) | EXIF extraction, photo compression |
| **Testing** | Jest + Supertest + hash integrity scripts | Graph verification tests |

### M3: Cold-Chain SLA Engine

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Telemetry Ingestion | Kafka consumer + REST API endpoints | Multi-protocol temperature data |
| BLE Gateway | React Native BLE library (mobile app) | Download from USB loggers |
| Stream Processing | Kafka Streams / Node.js stream | Real-time excursion detection |
| Fruit Profiles | PostgreSQL configuration tables | Threshold parameters per species |
| Shelf-Life Model | Python FastAPI + scikit-learn | ML-based remaining life prediction |
| Visualization | Recharts (frontend) | Interactive temperature curves |
| Alert Engine | Redis Pub/Sub + WebSocket | Real-time excursion notifications |
| **Testing** | k6 + custom telemetry simulators | Load testing with simulated sensors |

### M4: Dispute Shield

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Timeline Engine | PostgreSQL queries + NestJS service | Reconstruct chronological chain-of-custody |
| Forensics | Python FastAPI | Root cause analysis of excursions |
| PDF Assembler | Puppeteer + Handlebars | 6-section defense dossier |
| Photo Gallery | Sharp + S3 presigned URLs | EXIF-annotated photo evidence |
| Claim Tracker | PostgreSQL + NestJS CRUD | Track claim lifecycle and outcomes |
| **Testing** | Jest + 10+ claim scenario fixtures | Validated against real dispute patterns |

### M5: MRV-Lite

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Carbon Calculator | NestJS service + emission factor DB | Route-based CO₂e calculation |
| Emission Factors | PostgreSQL lookup tables | Transport mode × distance factors |
| Waste Metrics | PostgreSQL aggregate queries | Baseline vs. actual rejection comparison |
| ESG Reports | Puppeteer + Handlebars | 3-level ESG report generation |
| **Testing** | Jest + benchmark validation | ±15% accuracy against published factors |

### Infrastructure & Cross-Cutting

| Component | Technology | Purpose |
|-----------|-----------|---------|
| API Gateway | Kong / AWS API Gateway | Auth, rate limiting, routing, CORS |
| Service Mesh | (Year 2) Istio on K8s | Service-to-service communication |
| Logging | Winston (Node.js) → CloudWatch / ELK | Structured logging; searchable |
| Tracing | OpenTelemetry + Jaeger | Distributed tracing across services |
| Error Tracking | Sentry | Real-time error detection and alerting |
| Feature Flags | LaunchDarkly / Unleash | Progressive rollout of features |
| Database Migration | Prisma / TypeORM migrations | Version-controlled schema changes |
| Backup | AWS RDS automated + S3 cross-region | Multi-AZ + cross-region replication |
| IaC | Terraform | Infrastructure as code; reproducible |

---

# PART 4: UX/UI DESCRIPTIONS FOR ALL SCREENS

## 4.1 DESIGN SYSTEM FOUNDATION (Adapted from Guidelines)

### Color Palette (ZRL-Specific)

```css
/* Primary Brand */
--zrl-primary: #6C5CE7;          /* Primary buttons, active states */
--zrl-primary-hover: #5936E0;    /* Hover/pressed */
--zrl-primary-light: #A29BFE;    /* Backgrounds, badges */
--zrl-primary-bg: rgba(108, 92, 231, 0.1);

/* Semantic */
--zrl-success: #22C55E;          /* Pass, complete, accepted */
--zrl-warning: #F59E0B;          /* Conditional, attention needed */
--zrl-error: #EF4444;            /* Fail, rejected, excursion critical */
--zrl-info: #3B82F6;             /* Informational */

/* Domain-Specific */
--zrl-cold-chain: #14B8A6;       /* Temperature OK, cold-chain accent */
--zrl-excursion: #EF4444;        /* Temperature excursion */
--zrl-completeness: #6C5CE7;     /* Completeness progress */
--zrl-checkpoint: #F59E0B;       /* Checkpoint marker */

/* Surfaces (Light Mode) */
--zrl-bg-page: #FAFBFC;
--zrl-bg-surface: #FFFFFF;
--zrl-bg-surface-secondary: #F8FAFC;

/* Surfaces (Dark Mode) */
--zrl-bg-page-dark: #101022;
--zrl-bg-surface-dark: #1a1a2e;

/* Text */
--zrl-text-primary: #0F172A;
--zrl-text-secondary: #475569;
--zrl-text-muted: #64748B;
```

### Typography

```css
--font-sans: 'Inter', -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', monospace;  /* For hash values, IDs, MRL numbers */
--font-thai: 'Noto Sans Thai', 'Inter', sans-serif;  /* Thai language support */
```

| Element | Size | Weight | Class |
|---------|------|--------|-------|
| Page Title | 24px | Bold | `text-2xl font-bold tracking-tight` |
| Card Title | 18px | Bold | `text-lg font-bold` |
| Section Label | 12px | Semibold, uppercase | `text-xs font-semibold uppercase tracking-wider` |
| Body | 14px | Normal | `text-sm` |
| Stat Value | 30px | Bold | `text-3xl font-bold font-mono tabular-nums` |
| Hash/ID | 12px | Medium, mono | `text-xs font-mono` |

### Component Patterns

| Component | Tailwind Classes |
|-----------|-----------------|
| Card | `bg-white dark:bg-surface-dark rounded-2xl shadow-soft p-6` |
| Button Primary | `bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 px-4 rounded-xl transition-all` |
| Button Secondary | `bg-white border border-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl hover:bg-slate-50` |
| Input | `h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary/50 focus:ring-0` |
| Badge Success | `px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200` |
| Badge Warning | `px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200` |
| Badge Error | `px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200` |
| Status Dot | `size-2 rounded-full` (color by status) |
| Table Header | `bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider` |

---

## 4.2 SCREEN-BY-SCREEN UX/UI SPECIFICATIONS

### SCREEN 1: LOGIN / AUTHENTICATION

**Layout:** Centered card on gradient background
**Grid:** Single column, max-width 400px

**Components:**
- Logo + "Zero-Reject Export Lane" branding
- Email/username input field
- Password input field with show/hide toggle
- "Remember me" checkbox
- Primary button: "Sign In" (full-width)
- MFA step: 6-digit TOTP code input (triggered for Admin/Auditor roles)
- "Forgot password?" text link
- Language switcher (TH/EN/JP/ZH) in top-right corner

**Interaction:**
- Client-side validation (email format, password length)
- Loading spinner on button during auth
- Error shake animation on failed login
- Redirect to dashboard on success

---

### SCREEN 2: MAIN DASHBOARD (Exporter Portal)

**Layout:** Bento grid, 12-column responsive
**Purpose:** At-a-glance operational status for the exporter

**Row 1 — KPI Tiles (4 tiles, `col-span-3` each):**

| Tile | Content | Color Accent | Icon |
|------|---------|-------------|------|
| Active Lanes | Count of lanes in COLLECTING/VALIDATED status | Primary blue | `local_shipping` |
| Avg Completeness | Weighted completeness across all active lanes | Dynamic (green >90%, amber 70–90%, red <70%) | `task_alt` |
| Ready to Ship | Lanes in PACKED status | Success green | `verified` |
| Alerts | Count of excursions + missing docs | Error red if >0, neutral gray if 0 | `notifications_active` |

**Row 2 — Active Lanes Table (`col-span-8`) + Quick Actions Panel (`col-span-4`):**

**Active Lanes Table:**
- Columns: Lane ID (mono font), Product, Destination (flag emoji + name), Status (badge), Completeness (progress bar), Temperature (status dot), Last Updated
- Row hover: `hover:bg-slate-50`
- Click row → navigate to Lane Detail
- Sort: by status (default), by date, by completeness
- Filter: by product, destination, status

**Quick Actions Panel:**
- "Create New Lane" primary button (prominent)
- Recent activity feed (last 5 events with timestamps)
- Upcoming checkpoints (next 3 due)
- Quick links: Generate Pack, Upload Evidence

**Row 3 — Temperature Overview (`col-span-6`) + Seasonal Calendar (`col-span-6`):**

**Temperature Overview:**
- Mini temperature sparklines for each active lane
- Red highlight for any excursion
- Click → full temperature chart in Lane Detail

**Seasonal Calendar:**
- Visual representation of current fruit seasons
- Highlight active products in season
- Upcoming season starts marked

**Responsive Behavior:**
- Desktop (≥1024px): Full bento grid as described
- Tablet (768–1023px): 2-column layout; KPI tiles stack 2×2
- Mobile (<768px): Single column; KPI tiles horizontal scroll; table becomes card list

---

### SCREEN 3: LANE CREATION WIZARD

**Layout:** Multi-step wizard with progress indicator
**Purpose:** Guide exporter through lane setup with pre-populated templates

**Step Indicator:**
- Horizontal stepper: `Product → Destination → Route → Review`
- Active step: primary color circle + label
- Completed step: green checkmark
- Future step: gray outline

**Step 1 — Product & Batch:**
- Product type selector (visual cards with fruit icons: mango, durian, mangosteen, longan)
- Variety dropdown (e.g., Nam Doc Mai for mango)
- Quantity input (kg) with unit selector
- Harvest date picker
- Origin province selector (Chachoengsao, Ratchaburi, Chumphon...)
- Grade selector (Premium, A, B)
- GAP certificate number input (with auto-verify indicator)
- Batch ID auto-generated: `MNG-JPN-YYYYMMDD-NNN`

**Step 2 — Destination Market:**
- Market selector (large cards with flag, name, stringency badge):
  - 🇯🇵 Japan — `Strictness: 10/10` (red badge)
  - 🇨🇳 China — `Strictness: 7/10` (amber badge)
  - 🇰🇷 Korea — `Strictness: 8/10` (amber badge)
- On selection: system auto-loads rules and displays summary:
  - "Japan requires: 400+ MRL substances, VHT certificate, Phytosanitary, 15 documents total"
  - Required evidence checklist appears (read-only preview)
- Buyer selector (optional): specific importer if known

**Step 3 — Logistics Route:**
- Route builder with visual map:
  - Origin point (packing house GPS)
  - Transport mode selector (Air/Sea/Truck)
  - Carrier selector (Thai Airways, Kerry, etc.)
  - Checkpoints: auto-suggest 4 standard points; editable
  - Estimated transit time displayed
- Cold-chain mode selector: Mode 1 (Manual) / Mode 2 (Logger) / Mode 3 (Telemetry)
- Temperature SLA displayed based on fruit + mode selection

**Step 4 — Review & Create:**
- Summary card showing all selections
- Estimated completeness: "0% — 15 items required"
- Required evidence checklist with action buttons
- Cost estimate (per-lane fee)
- "Create Lane" primary button + "Save as Draft" secondary
- On creation: lane enters CREATED → immediately transitions to EVIDENCE_COLLECTING

**Interaction Patterns:**
- Progressive disclosure: each step reveals only relevant fields
- Smart defaults: pre-fill from exporter's previous lanes
- Inline validation: real-time field checking
- Back button preserved at each step (no data loss)
- Draft auto-save every 30 seconds

---

### SCREEN 4: LANE DETAIL / EVIDENCE MANAGEMENT

**Layout:** Full-page detail view with tabbed sections
**Purpose:** Central hub for managing all aspects of a single lane

**Header:**
- Lane ID (large, mono font): `LN-2026-001`
- Status badge (e.g., `EVIDENCE_COLLECTING` amber badge)
- Completeness progress bar: `████████░░ 80%` with percentage
- Product + Destination: "Mango (Nam Doc Mai) → 🇯🇵 Japan"
- Quick actions: "Generate Pack" (disabled until ≥95%), "View Audit Trail"

**Tab Navigation:**
- Evidence (default) | Checkpoints | Temperature | Proof Packs | Audit Trail | Dispute

**Tab: Evidence**
- Two-column layout:
  - Left (`col-span-8`): Evidence checklist with upload areas
  - Right (`col-span-4`): Evidence graph visualization (mini DAG view)

- Checklist items grouped by category (Regulatory, Quality, Cold-Chain, Chain-of-Custody):
  - Each item shows: document name, status icon (✅ uploaded / ⚠️ missing / 🔄 pending verification), upload date, hash preview (first 8 chars of SHA-256)
  - Upload button per item (drag-and-drop zone)
  - "Verify" button for manually uploaded items
  - Lab results: if API-connected, show "Auto-received" badge with green check

- Evidence Graph Mini View:
  - Interactive DAG showing nodes (artifacts) and edges (relationships)
  - Click node → modal with artifact detail (issuer, date, full hash, verification status)
  - Color coding: green = verified, amber = pending, red = failed/missing

**Tab: Checkpoints**
- Timeline visualization (vertical timeline with checkpoint cards):
  - CP1: Packing House → Truck
  - CP2: Truck → Port/Airport
  - CP3: Port → Vessel/Aircraft
  - CP4: Vessel → Destination

- Each checkpoint card:
  - Status: `Completed` / `Pending` / `Overdue`
  - Timestamp
  - Temperature reading
  - Photo thumbnail (click → lightbox)
  - Signer name + digital signature status
  - GPS coordinates (small map pin)
  - Condition notes

- "Record Checkpoint" button for pending checkpoints:
  - Camera capture (with GPS + timestamp overlay)
  - Temperature input
  - Digital signature pad
  - Condition notes textarea
  - Submit button

**Tab: Temperature**
- Full-width temperature curve chart (Recharts):
  - X-axis: time (hours/days)
  - Y-axis: temperature (°C)
  - Optimal range highlighted as green band
  - Checkpoint markers (vertical lines with labels)
  - Excursion zones highlighted in red
  - Hover tooltip: exact temp, time, location
- Below chart:
  - SLA Summary card: Pass/Conditional/Fail status
  - Excursion log table: start, end, duration, max deviation, severity, root cause hint
  - Shelf-life impact: estimated remaining days

**Tab: Proof Packs**
- Three pack cards side by side:
  - Regulator Pack: icon + description + "Generate" / "Download" button
  - Buyer Pack: icon + description + "Generate" / "Download" button
  - Claim Defense Pack: icon + description + "Generate" (on-demand) button
- Each card shows: last generated timestamp, version, hash, file size
- History: table of all previously generated packs with version numbers

**Tab: Audit Trail**
- Filterable table of all audit entries for this lane:
  - Columns: Timestamp, Actor, Action, Entity, Hash (truncated, copy-to-clipboard)
  - Color-coded by action type
  - "Verify Chain Integrity" button → runs hash chain verification → shows pass/fail
- Export: "Download Audit Trail (JSON)" button

**Tab: Dispute**
- Only visible when lane has a claim/dispute
- Claim status card
- "Generate Claim Defense Pack" primary action
- Defense pack preview
- Claim resolution timeline

---

### SCREEN 5: RULES ENGINE MANAGEMENT (Admin)

**Layout:** Sidebar (market selector) + main content area
**Purpose:** Admin interface for managing market-specific rules

**Sidebar:**
- Market list with flag icons: 🇯🇵 Japan, 🇨🇳 China, 🇰🇷 Korea, 🇪🇺 EU
- Each shows: substance count, last updated, active version
- Click → loads market detail

**Main Content (selected market):**

**Section 1: MRL Table**
- Searchable/filterable table of all substances:
  - Columns: Substance Name, CAS Number, Thai MRL, Destination MRL, Stringency Ratio, Risk Level (color badge), Last Updated
  - Sort by any column
  - Filter by risk level (Critical, High, Medium, Low)
  - Search by substance name or CAS number
- "Add Substance" button (modal form)
- "Import CSV" button for bulk updates
- "Export" button for backup

**Section 2: Document Templates**
- Template list with preview thumbnails
- "Edit Template" → opens Handlebars template editor
- "Preview" → renders sample PDF

**Section 3: Rule Version History**
- Timeline of all rule changes
- Each entry: date, changed by, summary of changes, affected substance count
- "Compare Versions" button

---

### SCREEN 6: ANALYTICS DASHBOARD

**Layout:** Bento grid with KPI tiles + charts
**Purpose:** Platform-wide insights and trend analysis

**Row 1 — 6 KPI Tiles:**
- Total Lanes Processed | Average Rejection Rate | Avg Completeness | Avg Readiness Time | Buyer Query Rate | Cold-Chain SLA Pass Rate
- Each tile: stat value (large), trend indicator (↑ green / ↓ red with %), sparkline

**Row 2 — Charts:**
- Left (`col-span-8`): Rejection Rate Trend (line chart, by month, by product)
- Right (`col-span-4`): Completeness Distribution (donut chart showing % in each bracket)

**Row 3 — Charts:**
- Left (`col-span-6`): Lanes by Destination Market (bar chart)
- Right (`col-span-6`): Excursion Frequency by Segment (heatmap: checkpoint×severity)

**Row 4 — Performance Table:**
- Exporter leaderboard: Exporter Name, Lanes, Avg Completeness, Rejection Rate, SLA Compliance
- Sortable by any metric

**Filters (top bar):**
- Date range picker
- Product filter (multi-select)
- Market filter (multi-select)
- "Export Report" button → PDF or CSV

---

### SCREEN 7: CHECKPOINT CAPTURE (Mobile PWA)

**Layout:** Mobile-first, single-column, camera-focused
**Purpose:** Field workers capture checkpoint data at each handoff point

**Screen Flow:**
1. **Lane Selector** — scan QR code on shipment or select from list of pending checkpoints
2. **Checkpoint Confirmation** — shows which checkpoint (e.g., "CP2: Truck → Port")
3. **Photo Capture** — full-screen camera with auto-GPS + timestamp overlay
4. **Temperature Input** — large numeric keypad for temperature entry
5. **Condition Assessment** — quick-select buttons: "Good", "Minor Issue", "Major Issue" + notes textarea
6. **Digital Signature** — finger/stylus signature pad
7. **Review & Submit** — summary of captured data; "Submit Checkpoint" button

**Design:**
- Large touch targets (≥48px)
- High-contrast text for outdoor visibility
- Offline-capable: data saved locally, synced when connected
- Camera: auto-detect orientation, compress to <2MB
- GPS: auto-capture, display on mini-map
- Success: green checkmark animation + vibration feedback

---

### SCREEN 8: PROOF PACK VIEWER

**Layout:** Document viewer with navigation panel
**Purpose:** View, verify, and download generated proof packs

**Left Panel (sidebar):**
- Pack type tabs: Regulator | Buyer | Defense
- Table of contents (clickable sections)
- Verification badge: "Integrity Verified ✅" with hash and QR code
- Download buttons: PDF, JSON metadata

**Main Viewer:**
- Embedded PDF viewer (responsive, zoomable)
- Highlights for key sections
- Annotation capability (for internal review)

---

### SCREEN 9: PARTNER PORTAL (Lab / Logistics)

**Layout:** Simplified dashboard focused on partner's specific data contribution
**Purpose:** Partners (labs, logistics) submit data relevant to their role

**Lab Partner View:**
- Pending test requests (lanes awaiting results)
- Result submission form: substance-by-substance entry or CSV upload
- Auto-validation against MRL thresholds
- Digital certificate issuance
- History of submitted results

**Logistics Partner View:**
- Active shipments assigned to this carrier
- Temperature data upload / telemetry sync status
- Checkpoint signing queue
- SLA compliance summary for their segments

---

### SCREEN 10: SETTINGS & ACCOUNT MANAGEMENT

**Layout:** Sidebar navigation + content area
**Purpose:** User preferences, account settings, notification configuration

**Sidebar Sections:**
- Profile (company info, contact)
- Security (password, MFA setup)
- API Keys (for integration partners)
- Notifications (email, push, LINE preferences)
- Preferences (language, timezone, units)
- Appearance (light/dark mode toggle)
- Data Export (PDPA data portability)
- Billing (subscription tier, usage, invoices)

**Each Section:**
- Form cards with edit/save functionality
- Confirmation modals for destructive actions (delete account)
- Active state on sidebar: `bg-primary/10 text-primary border-l-4 border-primary`

---

### SCREEN 11: ESG/SUSTAINABILITY REPORT VIEWER

**Layout:** Report card + data visualization
**Purpose:** View and export ESG metrics per lane, per exporter, or platform-wide

**Per-Lane ESG Card:**
- Environmental: CO₂e breakdown chart (donut), waste avoided metric
- Social: Farm families impacted, cooperative info, GAP status
- Governance: Traceability score, evidence count, audit entries, tamper-evident verification

**Per-Exporter Quarterly Report:**
- Aggregated metrics across all lanes
- Trend charts (CO₂e over time, waste reduction trend)
- Export: PDF download for buyer submission

---

## 4.3 RESPONSIVE DESIGN SPECIFICATIONS

| Breakpoint | Layout Behavior |
|-----------|----------------|
| **Desktop (≥1024px)** | Full bento grid (12-col); sidebar visible; all panels expanded |
| **Tablet (768–1023px)** | 8-column grid; collapsible sidebar; stacked panels where needed |
| **Mobile (<768px)** | Single column; bottom navigation; tables → card lists; camera-first checkpoint capture |

**Touch Targets:** Minimum 44px on all interactive elements for mobile.

**Offline Support (PWA):**
- Checkpoint capture works offline (Service Worker caches app shell)
- Evidence upload queues data locally; syncs on reconnect
- Dashboard shows "Offline" banner with last-synced timestamp

---

# PART 5: BACKEND-TO-FRONTEND ROUTING DEFINITION

## 5.1 API ARCHITECTURE

**Base URL:** `https://api.zrl.app/v1`
**Authentication:** Bearer JWT token in `Authorization` header
**Content Type:** `application/json` (unless file upload: `multipart/form-data`)
**Rate Limiting:** 100 req/min (standard), 30 req/min (pack generation), 10 req/min (auth)

## 5.2 FRONTEND ROUTES (Next.js App Router)

```
/                              → Redirect to /dashboard
/login                         → Login page
/login/mfa                     → MFA verification step
/forgot-password               → Password reset flow
/dashboard                     → Main dashboard (Screen 2)
/lanes                         → Lane list with filters
/lanes/new                     → Lane creation wizard (Screen 3)
/lanes/[laneId]                → Lane detail (Screen 4)
/lanes/[laneId]/evidence       → Evidence tab (default)
/lanes/[laneId]/checkpoints    → Checkpoints tab
/lanes/[laneId]/temperature    → Temperature tab
/lanes/[laneId]/packs          → Proof packs tab
/lanes/[laneId]/audit          → Audit trail tab
/lanes/[laneId]/dispute        → Dispute tab
/lanes/[laneId]/esg            → ESG card for this lane
/checkpoint/capture            → Mobile checkpoint capture (Screen 7)
/checkpoint/capture/[laneId]   → Checkpoint capture for specific lane
/packs/[packId]                → Proof pack viewer (Screen 8)
/packs/[packId]/verify         → Pack verification (public, no auth)
/analytics                     → Analytics dashboard (Screen 6)
/analytics/exporters           → Exporter performance
/analytics/products            → Product-level metrics
/analytics/markets             → Market-level metrics
/esg                           → ESG reports (Screen 11)
/esg/lane/[laneId]             → Per-lane ESG card
/esg/exporter                  → Exporter quarterly
/esg/platform                  → Platform annual
/admin/rules                   → Rules engine management (Screen 5)
/admin/rules/[marketId]        → Market-specific rules
/admin/users                   → User management
/admin/system                  → System health dashboard
/partner                       → Partner portal home (Screen 9)
/partner/lab                   → Lab result submission
/partner/logistics             → Logistics data management
/settings                      → Settings (Screen 10)
/settings/profile              → Profile
/settings/security             → Security + MFA
/settings/api-keys             → API key management
/settings/notifications        → Notification preferences
/settings/appearance           → Theme toggle
/settings/billing              → Subscription & billing
/settings/data-export          → PDPA data export
```

## 5.3 BACKEND API ENDPOINTS

### Authentication (`/auth`)

| Method | Endpoint | Purpose | Auth | Request Body | Response |
|--------|----------|---------|------|-------------|----------|
| POST | `/auth/login` | User login | None | `{email, password}` | `{accessToken, refreshToken, user, requireMfa}` |
| POST | `/auth/mfa/verify` | MFA verification | Partial JWT | `{code}` | `{accessToken, refreshToken}` |
| POST | `/auth/refresh` | Refresh token | Refresh token | `{refreshToken}` | `{accessToken}` |
| POST | `/auth/logout` | Invalidate session | JWT | — | `{success}` |
| POST | `/auth/forgot-password` | Initiate reset | None | `{email}` | `{message}` |
| POST | `/auth/reset-password` | Complete reset | Reset token | `{token, newPassword}` | `{success}` |

### Lanes (`/lanes`)

| Method | Endpoint | Purpose | Auth | Request/Query | Response |
|--------|----------|---------|------|--------------|----------|
| GET | `/lanes` | List lanes (filtered) | JWT | `?status=&product=&market=&page=&limit=` | `{data: Lane[], meta: Pagination}` |
| POST | `/lanes` | Create new lane | JWT | `{product, batch, destination, route, checkpoints}` | `{lane: Lane}` |
| GET | `/lanes/:id` | Get lane detail | JWT | — | `{lane: LaneDetail}` |
| PATCH | `/lanes/:id` | Update lane | JWT | `{fields to update}` | `{lane: Lane}` |
| GET | `/lanes/:id/completeness` | Get completeness score | JWT | — | `{score, required, present, missing[]}` |
| POST | `/lanes/:id/validate` | Trigger validation | JWT | — | `{valid, issues[]}` |
| GET | `/lanes/:id/timeline` | Get full timeline | JWT | — | `{events: TimelineEvent[]}` |
| GET | `/lanes/:id/stats` | Get lane statistics | JWT | — | `{stats: LaneStats}` |

### Evidence (`/evidence`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/lanes/:id/evidence` | List evidence for lane | JWT | `?type=&status=` | `{artifacts: Artifact[]}` |
| POST | `/lanes/:id/evidence` | Upload evidence artifact | JWT | `multipart: {file, type, metadata}` | `{artifact: {id, hash, status}}` |
| GET | `/evidence/:artifactId` | Get artifact detail | JWT | — | `{artifact: ArtifactDetail}` |
| GET | `/evidence/:artifactId/verify` | Verify artifact hash | JWT | — | `{valid, hash, verified_at}` |
| DELETE | `/evidence/:artifactId` | Remove artifact | JWT | — | `{success}` (soft delete + audit) |
| GET | `/lanes/:id/evidence/graph` | Get evidence graph (DAG) | JWT | — | `{nodes: Node[], edges: Edge[]}` |

### Checkpoints (`/checkpoints`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/lanes/:id/checkpoints` | List checkpoints | JWT | — | `{checkpoints: Checkpoint[]}` |
| POST | `/lanes/:id/checkpoints` | Record checkpoint | JWT | `multipart: {sequence, photo, temperature, signature, gps, notes}` | `{checkpoint: Checkpoint}` |
| GET | `/checkpoints/:cpId` | Get checkpoint detail | JWT | — | `{checkpoint: CheckpointDetail}` |

### Cold-Chain / Temperature (`/temperature`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/lanes/:id/temperature` | Get temperature data | JWT | `?from=&to=&resolution=` | `{readings: TempReading[], sla: SLAStatus}` |
| POST | `/lanes/:id/temperature` | Upload temp readings | JWT/API Key | `{readings: [{timestamp, value, device_id}]}` | `{count, excursions_detected}` |
| GET | `/lanes/:id/temperature/sla` | Get SLA report | JWT | — | `{status, excursions[], shelf_life_impact}` |
| GET | `/lanes/:id/temperature/excursions` | Get excursion log | JWT | — | `{excursions: Excursion[]}` |

### Proof Packs (`/packs`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| POST | `/lanes/:id/packs/generate` | Generate proof pack | JWT | `{type: 'regulator'|'buyer'|'defense'}` | `{pack: {id, status: 'generating'}}` |
| GET | `/packs/:packId` | Get pack metadata | JWT | — | `{pack: PackDetail}` |
| GET | `/packs/:packId/download` | Download pack PDF | JWT | — | PDF binary stream |
| GET | `/packs/:packId/verify` | Verify pack integrity (PUBLIC) | None | — | `{valid, hash, lane_id, generated_at}` |
| GET | `/lanes/:id/packs` | List packs for lane | JWT | — | `{packs: Pack[]}` |

### Rules Engine (`/rules`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/rules/markets` | List available markets | JWT | — | `{markets: Market[]}` |
| GET | `/rules/markets/:marketId` | Get market rules detail | JWT | — | `{market, substances[], templates[]}` |
| GET | `/rules/markets/:marketId/substances` | List substances | JWT | `?search=&risk=&page=` | `{substances: Substance[], meta}` |
| POST | `/rules/markets/:marketId/substances` | Add substance | Admin JWT | `{name, cas, thai_mrl, dest_mrl}` | `{substance: Substance}` |
| PATCH | `/rules/substances/:subId` | Update substance | Admin JWT | `{fields}` | `{substance: Substance}` |
| GET | `/rules/markets/:marketId/checklist` | Get checklist for market+product | JWT | `?product=` | `{checklist: ChecklistItem[]}` |
| GET | `/rules/versions` | Rule version history | JWT | `?market=` | `{versions: RuleVersion[]}` |

### Audit Trail (`/audit`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/lanes/:id/audit` | Get audit trail for lane | JWT | `?action=&actor=&from=&to=` | `{entries: AuditEntry[]}` |
| POST | `/lanes/:id/audit/verify` | Verify hash chain integrity | JWT | — | `{valid, entries_checked, first_invalid}` |
| GET | `/audit/export/:laneId` | Export audit trail (JSON) | JWT | — | JSON file download |

### Disputes (`/disputes`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| POST | `/lanes/:id/disputes` | Create dispute/claim | JWT | `{type, description, claimant}` | `{dispute: Dispute}` |
| GET | `/disputes/:disputeId` | Get dispute detail | JWT | — | `{dispute: DisputeDetail}` |
| POST | `/disputes/:disputeId/defense-pack` | Generate defense pack | JWT | — | `{pack: DefensePack}` |
| PATCH | `/disputes/:disputeId` | Update dispute status | JWT | `{status, resolution_notes}` | `{dispute: Dispute}` |

### ESG / MRV-Lite (`/esg`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/lanes/:id/esg` | Get ESG card for lane | JWT | — | `{carbon, waste, social, governance}` |
| GET | `/esg/exporter/:exporterId` | Exporter quarterly report | JWT | `?quarter=&year=` | `{report: ESGReport}` |
| GET | `/esg/platform` | Platform annual impact | Admin JWT | `?year=` | `{report: PlatformESGReport}` |
| GET | `/esg/carbon/factors` | Get emission factor database | JWT | — | `{factors: EmissionFactor[]}` |

### Analytics (`/analytics`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/analytics/overview` | Dashboard KPIs | JWT | `?from=&to=` | `{kpis: KPISet}` |
| GET | `/analytics/rejection-trend` | Rejection rate over time | JWT | `?product=&market=&granularity=` | `{datapoints: TimeSeriesPoint[]}` |
| GET | `/analytics/completeness-distribution` | Completeness breakdown | JWT | — | `{brackets: {label, count, percentage}[]}` |
| GET | `/analytics/excursion-heatmap` | Excursion frequency map | JWT | — | `{matrix: {segment, severity, count}[]}` |
| GET | `/analytics/exporter-leaderboard` | Exporter performance ranking | JWT | `?sort=&limit=` | `{exporters: ExporterScore[]}` |

### Partner APIs (`/partner`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| POST | `/partner/lab/results` | Submit lab test results | API Key | `{lane_id, results: [{substance, value, unit}]}` | `{received, validated, flags[]}` |
| POST | `/partner/logistics/temperature` | Submit temperature batch | API Key | `{lane_id, readings[]}` | `{received, excursions_detected}` |
| GET | `/partner/pending` | Get pending tasks | API Key | — | `{tasks: PartnerTask[]}` |

### Notifications (`/notifications`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/notifications` | List notifications | JWT | `?read=&type=&page=` | `{notifications: Notification[]}` |
| PATCH | `/notifications/:id/read` | Mark as read | JWT | — | `{success}` |
| GET | `/notifications/unread-count` | Get unread count | JWT | — | `{count}` |

### User/Settings (`/users`)

| Method | Endpoint | Purpose | Auth | Request | Response |
|--------|----------|---------|------|---------|----------|
| GET | `/users/me` | Get current user profile | JWT | — | `{user: UserProfile}` |
| PATCH | `/users/me` | Update profile | JWT | `{fields}` | `{user: UserProfile}` |
| POST | `/users/me/mfa/enable` | Enable MFA | JWT | — | `{secret, qr_uri}` |
| POST | `/users/me/mfa/confirm` | Confirm MFA setup | JWT | `{code}` | `{success}` |
| GET | `/users/me/api-keys` | List API keys | JWT | — | `{keys: APIKey[]}` |
| POST | `/users/me/api-keys` | Create API key | JWT | `{name, scopes[]}` | `{key: APIKey}` (key shown once) |
| DELETE | `/users/me/api-keys/:keyId` | Revoke API key | JWT | — | `{success}` |
| POST | `/users/me/data-export` | PDPA data export request | JWT | — | `{request_id, estimated_ready}` |
| GET | `/users/me/data-export/:requestId` | Download exported data | JWT | — | ZIP file (JSON/CSV) |

---

## 5.4 ROUTE-TO-SCREEN MAPPING

| Frontend Route | Backend Endpoints Used | Screen |
|---------------|----------------------|--------|
| `/login` | `POST /auth/login`, `POST /auth/mfa/verify` | Login |
| `/dashboard` | `GET /lanes?status=active`, `GET /analytics/overview`, `GET /notifications/unread-count` | Dashboard |
| `/lanes/new` | `GET /rules/markets`, `GET /rules/markets/:id/checklist`, `POST /lanes` | Lane Wizard |
| `/lanes/[id]` | `GET /lanes/:id`, `GET /lanes/:id/completeness`, `GET /lanes/:id/evidence`, `GET /lanes/:id/checkpoints`, `GET /lanes/:id/temperature`, `GET /lanes/:id/packs`, `GET /lanes/:id/audit` | Lane Detail |
| `/lanes/[id]/evidence` | `GET /lanes/:id/evidence`, `POST /lanes/:id/evidence`, `GET /lanes/:id/evidence/graph` | Evidence Tab |
| `/lanes/[id]/temperature` | `GET /lanes/:id/temperature`, `GET /lanes/:id/temperature/sla`, `GET /lanes/:id/temperature/excursions` | Temperature Tab |
| `/lanes/[id]/packs` | `GET /lanes/:id/packs`, `POST /lanes/:id/packs/generate`, `GET /packs/:id/download` | Packs Tab |
| `/checkpoint/capture/[id]` | `GET /lanes/:id/checkpoints`, `POST /lanes/:id/checkpoints` | Checkpoint Capture (Mobile) |
| `/packs/[id]` | `GET /packs/:id`, `GET /packs/:id/download` | Pack Viewer |
| `/packs/[id]/verify` | `GET /packs/:id/verify` (public) | Pack Verification |
| `/analytics` | `GET /analytics/overview`, `GET /analytics/rejection-trend`, `GET /analytics/completeness-distribution`, `GET /analytics/excursion-heatmap`, `GET /analytics/exporter-leaderboard` | Analytics |
| `/admin/rules` | `GET /rules/markets`, `GET /rules/markets/:id/substances`, `POST/PATCH /rules/substances` | Rules Admin |
| `/partner/lab` | `GET /partner/pending`, `POST /partner/lab/results` | Lab Portal |
| `/partner/logistics` | `GET /partner/pending`, `POST /partner/logistics/temperature` | Logistics Portal |
| `/esg` | `GET /esg/exporter/:id`, `GET /esg/platform` | ESG Reports |
| `/settings/*` | `GET/PATCH /users/me`, MFA endpoints, API key endpoints | Settings |

---

## 5.5 WEBSOCKET EVENTS (Real-Time)

**Connection:** `wss://api.zrl.app/ws` (authenticated via JWT in connection params)

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `lane.status.changed` | Server → Client | `{laneId, oldStatus, newStatus}` | Real-time lane status updates |
| `evidence.uploaded` | Server → Client | `{laneId, artifactId, type, completeness}` | Evidence graph update |
| `checkpoint.recorded` | Server → Client | `{laneId, checkpointId, sequence}` | Checkpoint completion |
| `temperature.excursion` | Server → Client | `{laneId, severity, temp, threshold}` | **Critical: excursion alert** |
| `pack.generated` | Server → Client | `{laneId, packId, packType}` | Pack ready notification |
| `rule.updated` | Server → Client | `{marketId, changedSubstances[]}` | Rule change alert |
| `notification.new` | Server → Client | `{notification}` | In-app notification |

---

## 5.6 ERROR RESPONSE FORMAT

All API errors follow a consistent format:

```json
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "MRL test result for Chlorpyrifos (0.03 mg/kg) exceeds Japan limit (0.01 mg/kg)",
  "details": {
    "field": "substances[0].value",
    "substance": "Chlorpyrifos",
    "value": 0.03,
    "limit": 0.01,
    "market": "JP"
  },
  "timestamp": "2026-03-21T10:30:00Z",
  "requestId": "req_abc123"
}
```

**HTTP Status Codes:**

| Code | Usage |
|------|-------|
| 200 | Success |
| 201 | Created (new lane, evidence, checkpoint) |
| 400 | Validation error (bad input) |
| 401 | Unauthorized (missing/invalid JWT) |
| 403 | Forbidden (insufficient role/scope) |
| 404 | Not found (lane, artifact, pack) |
| 409 | Conflict (duplicate evidence, invalid state transition) |
| 422 | Unprocessable (business logic failure, e.g., cannot generate pack at <95% completeness) |
| 429 | Rate limited |
| 500 | Internal server error |

---

*END OF DOCUMENT*

*Zero-Reject Export Lane — Comprehensive System Development Specification*
*NIA Thailand Mandatory Innovation Business Platform Round 2 (FY 2569/2026)*
*Generated from 18 source documents + 3 UX/UI guideline documents*
