# OPTION G: ZERO-REJECT EXPORT LANE — ARCHITECTURE DIAGRAMS

**Document Version:** 1.0  
**Date:** January 28, 2026

---

## 1. CORE DATA MODEL DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        SHIPMENT LANE                            │
│  lane_id, exporter_id, product, batch, destination, status      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   BATCH     │    │  LOGISTICS  │    │ DESTINATION │         │
│  │  batch_id   │    │   ROUTE     │    │   RULES     │         │
│  │  product    │    │  segments[] │    │  market     │         │
│  │  quantity   │    │  carriers[] │    │  product    │         │
│  │  origin     │    │  checkpoints│    │  standards  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     EVIDENCE ARTIFACTS                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   COA    │ │ Lab Test │ │  Photo   │ │ Temp Log │          │
│  │  + hash  │ │  + hash  │ │  + hash  │ │  + hash  │          │
│  │  + issuer│ │  + issuer│ │  + issuer│ │  + device│          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                       CHECKPOINTS                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ CP1: Packhouse → Truck (signature, photo, temp, time)   │   │
│  │ CP2: Truck → Port (signature, photo, temp, time)        │   │
│  │ CP3: Port → Vessel (signature, photo, temp, time)       │   │
│  │ CP4: Vessel → Destination (signature, photo, temp, time)│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                       PROOF PACKS                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Regulator    │ │ Buyer Pack   │ │ Claim Defense│            │
│  │ Pack (PDF)   │ │ (PDF)        │ │ Pack (PDF)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      AUDIT LOG                                  │
│  (append-only, hash-chained, tamper-evident)                   │
│  [entry_id, timestamp, actor, action, entity, hash, prev_hash] │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USERS / INTERFACES                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Exporter   │  │  Logistics  │  │   Auditor   │  │   Insurer   │        │
│  │   Portal    │  │   Portal    │  │   Portal    │  │   Portal    │        │
│  │  (Web/App)  │  │  (Web/App)  │  │    (Web)    │  │    (API)    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                    (Authentication, Rate Limiting, Routing)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Lane Service   │      │  Evidence Svc   │      │  Pack Builder   │
│                 │      │                 │      │    Service      │
│ - Create Lane   │      │ - Upload/Link   │      │                 │
│ - Orchestration │      │ - Validation    │      │ - Regulator     │
│ - Status Track  │      │ - Graph Build   │      │ - Buyer Pack    │
│ - Checkpoint    │      │ - Hash/Verify   │      │ - Defense Pack  │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CORE DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │  S3/GCS     │  │   Kafka/    │  │  Audit Log  │        │
│  │  Metadata   │  │  Evidence   │  │    SQS      │  │  (Hash-     │        │
│  │     DB      │  │   Storage   │  │   Events    │  │   Chained)  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Rules Engine   │      │  Analytics/ML   │      │   Integration   │
│                 │      │                 │      │     Layer       │
│ - Market Rules  │      │ - Excursion     │      │                 │
│ - Validation    │      │   Detection     │      │ - Lab APIs      │
│ - Checklists    │      │ - Shelf-Life    │      │ - Logistics     │
│ - Templates     │      │ - Anomalies     │      │ - Cold Room     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```


---

## 3. EVIDENCE GRAPH STRUCTURE

```
                    ┌─────────────────────────────────────┐
                    │           SHIPMENT LANE             │
                    │  lane_id: LN-2026-001               │
                    │  exporter: ABC Packhouse            │
                    │  product: Fresh Mango               │
                    │  destination: Japan                 │
                    └───────────────┬─────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│    BATCH      │          │   LOGISTICS   │          │  DESTINATION  │
│  BTH-001      │          │    ROUTE      │          │    RULES      │
│               │          │               │          │               │
│ product: mango│          │ origin: CTB   │          │ market: JP    │
│ qty: 5000 kg  │          │ dest: NRT     │          │ standards:    │
│ harvest: 1/15 │          │ mode: air     │          │  - JAS        │
│ grade: A      │          │ carrier: TG   │          │  - HACCP      │
└───────┬───────┘          └───────┬───────┘          └───────────────┘
        │                          │
        │                          │
        ▼                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EVIDENCE ARTIFACTS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ Phytosanitary  │  │ Pesticide Test │  │ HACCP Cert     │        │
│  │ Certificate    │  │ (Lab Result)   │  │                │        │
│  │                │  │                │  │                │        │
│  │ issuer: DOA    │  │ issuer: SGS    │  │ issuer: BSI    │        │
│  │ hash: a1b2c3.. │  │ hash: d4e5f6.. │  │ hash: g7h8i9.. │        │
│  │ batch: BTH-001 │  │ batch: BTH-001 │  │ scope: facility│        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │ Temperature    │  │ Traceability   │  │ Photo Evidence │        │
│  │ Log            │  │ Record         │  │                │        │
│  │                │  │                │  │                │        │
│  │ device: TL-001 │  │ farm: CTB-F01  │  │ type: packing  │        │
│  │ hash: j1k2l3.. │  │ hash: m4n5o6.. │  │ hash: p7q8r9.. │        │
│  │ checkpoints: 4 │  │ batch: BTH-001 │  │ timestamp: ... │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         CHECKPOINTS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CP1 ──────────► CP2 ──────────► CP3 ──────────► CP4               │
│  Packhouse      Truck           Port            Destination         │
│  → Truck        → Port          → Aircraft      → Importer          │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │
│  │ time: T1 │   │ time: T2 │   │ time: T3 │   │ time: T4 │        │
│  │ temp: 10°│   │ temp: 11°│   │ temp: 9° │   │ temp: 10°│        │
│  │ sig: ABC │   │ sig: XYZ │   │ sig: TG  │   │ sig: IMP │        │
│  │ photo: Y │   │ photo: Y │   │ photo: Y │   │ photo: Y │        │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         PROOF PACKS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  REGULATOR PACK  │  │   BUYER PACK     │  │  CLAIM DEFENSE   │  │
│  │                  │  │                  │  │      PACK        │  │
│  │ - Phytosanitary  │  │ - Quality Summary│  │ - Full Timeline  │  │
│  │ - Lab Results    │  │ - COA Appendix   │  │ - All Evidence   │  │
│  │ - Traceability   │  │ - Certifications │  │ - Excursion Log  │  │
│  │ - Import Forms   │  │ - Temp SLA Report│  │ - Signatures     │  │
│  │                  │  │                  │  │ - Audit Trail    │  │
│  │ Format: PDF+JSON │  │ Format: PDF      │  │ Format: PDF      │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```


---

## 4. COLD-CHAIN FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COLD-CHAIN MONITORING FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

   PACKHOUSE                TRANSPORT              PORT                DESTINATION
   ┌───────┐               ┌───────┐             ┌───────┐            ┌───────┐
   │ 8-12°C│──────────────►│ 8-12°C│────────────►│ 8-12°C│───────────►│ 8-12°C│
   │       │               │       │             │       │            │       │
   │  ▼▼▼  │               │  ▼▼▼  │             │  ▼▼▼  │            │  ▼▼▼  │
   └───┬───┘               └───┬───┘             └───┬───┘            └───┬───┘
       │                       │                     │                    │
       │ CP1                   │ CP2                 │ CP3                │ CP4
       │                       │                     │                    │
       ▼                       ▼                     ▼                    ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                    TEMPERATURE CURVE (Time-Series)                     │
   │                                                                        │
   │  12°C ─────────────────────────────────────────────────────────────   │
   │                                                                        │
   │  10°C ────────────────────╲╱──────────────────────────────────────    │
   │                     EXCURSION                                          │
   │   8°C ─────────────────────────────────────────────────────────────   │
   │                                                                        │
   │        T1        T2        T3        T4        T5        T6           │
   │      (Day 0)  (Day 0.5)  (Day 1)   (Day 1.5)  (Day 2)   (Day 2.5)    │
   └───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                      EXCURSION DETECTION                               │
   │                                                                        │
   │  ┌─────────────────────────────────────────────────────────────┐      │
   │  │ EXCURSION DETECTED                                          │      │
   │  │                                                             │      │
   │  │ Start: T2 (Day 0.5)    Duration: 45 minutes                │      │
   │  │ End: T2.75             Max Deviation: +2.5°C               │      │
   │  │ Segment: Truck → Port  Severity: MODERATE                  │      │
   │  │                                                             │      │
   │  │ Root Cause Hint: HANDOFF_DELAY                             │      │
   │  │ (Loading dock wait time exceeded threshold)                │      │
   │  └─────────────────────────────────────────────────────────────┘      │
   │                                                                        │
   └───────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │                        SLA REPORT                                      │
   │                                                                        │
   │  Lane: LN-2026-001              Product: Fresh Mango                  │
   │  Destination: Japan             SLA: 8-12°C, max 30 min excursion     │
   │                                                                        │
   │  ┌────────────────────────────────────────────────────────────┐       │
   │  │                                                            │       │
   │  │  Result: ██████████ CONDITIONAL PASS ██████████           │       │
   │  │                                                            │       │
   │  │  Total Excursion: 45 minutes (threshold: 30 min)          │       │
   │  │  Excursion Count: 1                                        │       │
   │  │  Max Deviation: +2.5°C                                     │       │
   │  │  Defensibility Score: 75%                                  │       │
   │  │                                                            │       │
   │  │  Recommendation: Document handoff delay; notify buyer      │       │
   │  │                                                            │       │
   │  └────────────────────────────────────────────────────────────┘       │
   │                                                                        │
   └───────────────────────────────────────────────────────────────────────┘
```


---

## 5. LANE WORKFLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LANE LIFECYCLE WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐
     │  START   │
     └────┬─────┘
          │
          ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                      1. LANE CREATION                           │
     │                                                                 │
     │  Inputs: Exporter, Product, Batch, Destination, Route          │
     │  System: Auto-load destination rules + required evidence list  │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                  2. EVIDENCE COLLECTION                         │
     │                                                                 │
     │  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
     │  │   Upload   │  │    API     │  │  Manual    │                │
     │  │   Files    │  │ Integration│  │   Entry    │                │
     │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘                │
     │        │               │               │                        │
     │        └───────────────┴───────────────┘                        │
     │                        │                                        │
     │                        ▼                                        │
     │               ┌─────────────────┐                               │
     │               │ Evidence Graph  │                               │
     │               │   + Hashing     │                               │
     │               │   + Validation  │                               │
     │               └─────────────────┘                               │
     │                                                                 │
     │  Completeness Score: ████████░░ 80%                            │
     │  Missing: [Phytosanitary Certificate]                          │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                3. CHECKPOINT CAPTURE                            │
     │                                                                 │
     │    CP1: Packhouse ──► CP2: Port ──► CP3: Vessel ──► CP4: Dest  │
     │                                                                 │
     │  At each checkpoint:                                            │
     │  - Timestamp                                                    │
     │  - Temperature reading                                          │
     │  - Photo capture                                                │
     │  - Digital signature                                            │
     │  - Condition notes                                              │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │               4. PACK GENERATION                                │
     │                                                                 │
     │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
     │  │  Regulator   │  │    Buyer     │  │   Claim      │          │
     │  │    Pack      │  │    Pack      │  │  Defense     │          │
     │  │              │  │              │  │    Pack      │          │
     │  │ Auto-generate│  │ Auto-generate│  │  On-demand   │          │
     │  └──────────────┘  └──────────────┘  └──────────────┘          │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
     ┌─────────────────────────────────────────────────────────────────┐
     │                5. DELIVERY & MONITORING                         │
     │                                                                 │
     │  Lane Status: █████████████████████ DELIVERED                  │
     │                                                                 │
     │  ┌─────────────┐         ┌─────────────┐                       │
     │  │  ACCEPTED   │   OR    │  REJECTED   │                       │
     │  │             │         │             │                       │
     │  │ → Archive   │         │ → Trigger   │                       │
     │  │ → KPI Update│         │   Claim     │                       │
     │  │             │         │   Defense   │                       │
     │  └─────────────┘         └─────────────┘                       │
     │                                                                 │
     └───────────────────────────┬─────────────────────────────────────┘
                                 │
                                 ▼
                          ┌──────────┐
                          │   END    │
                          └──────────┘
```

---

## 6. MODULE INTEGRATION MAP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FIVE MODULES INTEGRATION                                │
└─────────────────────────────────────────────────────────────────────────────┘

          ┌─────────────────────────────────────────────────┐
          │               M1: RULES ENGINE                   │
          │                                                  │
          │  Destination Templates ─► Checklists ─► Schema  │
          └──────────────────────┬──────────────────────────┘
                                 │
                                 │ feeds requirements
                                 ▼
          ┌─────────────────────────────────────────────────┐
          │            M2: EVIDENCE GRAPH                    │
          │                                                  │
          │  Artifacts ─► Hashing ─► Linkages ─► Validation │
          └──────────────────────┬──────────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          │ cold-chain data      │ evidence artifacts   │
          ▼                      │                      ▼
┌───────────────────────┐        │        ┌───────────────────────┐
│  M3: COLD-CHAIN SLA   │        │        │   M4: DISPUTE SHIELD  │
│                       │        │        │                       │
│ Telemetry ─► SLA Eval │        │        │ Timeline ─► Defense   │
│ Excursion Detection   │        │        │ Dossier Generation    │
└───────────┬───────────┘        │        └───────────┬───────────┘
            │                    │                    │
            │ temp curves        │                    │ claim evidence
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │
                                 │ combines all
                                 ▼
          ┌─────────────────────────────────────────────────┐
          │           PROOF PACK GENERATOR                   │
          │                                                  │
          │  Regulator Pack │ Buyer Pack │ Defense Pack     │
          └──────────────────────┬──────────────────────────┘
                                 │
                                 │ optional add-on
                                 ▼
          ┌─────────────────────────────────────────────────┐
          │             M5: MRV-LITE                         │
          │                                                  │
          │  Carbon Footprint ─► Waste Tracking ─► ESG Pack │
          └─────────────────────────────────────────────────┘
```

---

*Architecture diagrams for Option G: Zero-Reject Export Lane*  
*NIA Thailand Mandatory Innovation Business Platform Round 2 (FY 2569/2026)*
