# ZERO-REJECT EXPORT LANE (ZRL) — RESOURCE ESTIMATION

**Version:** 1.0
**Date:** March 21, 2026
**Reference:** ZRL-PRD-Architecture-TechStack-UXUI-Routing.md

---

## EXECUTIVE SUMMARY

| Metric | MVP (Phase 1) | Production (Phase 2) | Full Platform (Phase 3) | TOTAL |
|--------|--------------|---------------------|------------------------|-------|
| **Calendar Time** | 4 months | 4 months | 4 months | **12 months** |
| **Total Person-Months** | 28.5 | 34.5 | 32.0 | **95 person-months** |
| **Team Size (avg FTE)** | 7.1 | 8.6 | 8.0 | **7.9 avg** |
| **Development Cost** | 3.42M THB | 4.14M THB | 3.84M THB | **11.40M THB** |
| **Infrastructure Cost** | 0.18M THB | 0.27M THB | 0.36M THB | **0.81M THB** |
| **Operations & Field** | 0.30M THB | 0.60M THB | 0.80M THB | **1.70M THB** |
| **Contingency (15%)** | 0.59M THB | 0.75M THB | 0.75M THB | **2.09M THB** |
| **PHASE TOTAL** | **4.49M THB** | **5.76M THB** | **5.75M THB** | **16.00M THB** |

> **Note:** NIA grant covers 5.00M THB (Year 1). Company co-investment + seed funding covers the remainder.
> At current exchange (~35 THB/USD): Total ≈ **$457,000 USD**

---

## 1. RATE CARD (Thai Market, 2026)

### 1.1 Monthly Fully-Loaded Rates

| Role | Monthly Rate (THB) | Monthly Rate (USD) | Basis |
|------|-------------------|-------------------|-------|
| **Tech Lead / Architect** | 150,000 | $4,286 | Senior 8+ years, NestJS/React/Cloud |
| **Senior Full-Stack Developer** | 100,000 | $2,857 | 5+ years, TypeScript, NestJS, React |
| **Mid-Level Developer** | 70,000 | $2,000 | 3–5 years |
| **Junior Developer** | 45,000 | $1,286 | 1–3 years |
| **ML / Data Engineer** | 120,000 | $3,429 | Python, FastAPI, scikit-learn |
| **UI/UX Designer** | 80,000 | $2,286 | Figma, design systems, PWA |
| **DevOps / SRE** | 100,000 | $2,857 | Docker, K8s, Terraform, AWS |
| **QA Engineer** | 65,000 | $1,857 | Jest, Playwright, k6, security |
| **Product Owner / PM** | 120,000 | $3,429 | Agile, domain knowledge |
| **Domain Expert (Fruit Export)** | 80,000 | $2,286 | Former DOA, MRL expertise (0.5 FTE) |
| **Business Development** | 80,000 | $2,286 | Partner management, field ops |

### 1.2 Hourly Rates (for estimation)

| Role | Hourly Rate (THB) | Working Hours/Month |
|------|-------------------|-------------------|
| Tech Lead | 938 | 160 |
| Senior Developer | 625 | 160 |
| Mid Developer | 438 | 160 |
| Designer | 500 | 160 |
| DevOps | 625 | 160 |
| QA | 406 | 160 |

---

## 2. MODULE-BY-MODULE RESOURCE ESTIMATION

### 2.1 MODULE M1: MARKET-SPECIFIC RULES ENGINE

**Scope:** MRL database (400+ substances × 4 markets), rule parser & validation engine, template management, rule versioning & update pipeline, notification system for rule changes, admin UI for rule management.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **M1-WP1: MRL Database** | Design schema; load Japan 400+ substances; load China 200+; load Korea 350+; data validation scripts | Senior Dev + Domain Expert | 25 + 15 | 1.25 + 0.75 |
| **M1-WP2: Rule Parser** | YAML/JSON rule format design; parser implementation; hot-reload mechanism; rule versioning (temporal tables) | Senior Dev | 20 | 1.0 |
| **M1-WP3: Validation Engine** | MRL comparison logic; multi-substance batch validation; threshold alerting; pass/fail/flag classification | Senior Dev | 25 | 1.25 |
| **M1-WP4: Checklist Generator** | Market×product checklist configuration; dynamic checklist rendering; completeness integration | Mid Dev | 15 | 0.75 |
| **M1-WP5: Template Manager** | Handlebars document templates (customs forms, labels); multi-language (TH/EN/JP/ZH); template preview | Mid Dev + Designer | 15 + 10 | 0.75 + 0.5 |
| **M1-WP6: Rule Update Pipeline** | Monitoring integration; impact assessment tool; change notification to exporters; version diff viewer | Senior Dev | 15 | 0.75 |
| **M1-WP7: Admin UI** | Substance CRUD table; CSV import/export; template editor; version history timeline | Mid Dev + Designer | 20 + 5 | 1.0 + 0.25 |
| **M1-WP8: Testing** | Unit tests (400+ substance validation), integration tests, rule versioning tests | QA | 15 | 0.75 |

#### M1 Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **9.0** |
| **Calendar Time** | **3.5 months** (with 2.5 dev parallelism) |
| **Team Required** | 1 Senior Dev, 1 Mid Dev, 0.5 Domain Expert, 0.25 Designer, 0.5 QA |
| **Cost (Development)** | **720,000 THB** ($20,571 USD) |
| **Phase** | Phase 1 (Q1: Japan) + Phase 2 (Q3: China, Korea) |

---

### 2.2 MODULE M2: EVIDENCE GRAPH + PROOF PACK GENERATOR

**Scope:** DAG engine with SHA-256 hashing, multi-source artifact ingestion (file/API/camera), graph integrity verification, completeness scoring, PDF proof pack generation (3 types × multiple markets), OCR for lab results, QR verification codes.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **M2-WP1: Evidence Schema & DAG** | PostgreSQL adjacency list design; artifact entity model; graph traversal APIs; batch-artifact-lane linkage | Tech Lead + Senior Dev | 10 + 15 | 0.5 + 0.75 |
| **M2-WP2: Hashing Pipeline** | SHA-256 on upload; hash chain linking; integrity verification endpoint; hash storage | Senior Dev | 12 | 0.6 |
| **M2-WP3: Artifact Ingestion** | Multer file upload; S3 storage with versioning; EXIF extraction (Sharp); multi-format support (PDF, JPG, PNG, CSV) | Senior Dev | 15 | 0.75 |
| **M2-WP4: OCR Pipeline** | Tesseract.js / AWS Textract integration; lab result PDF → structured data; MRL value extraction; error handling | Senior Dev | 20 | 1.0 |
| **M2-WP5: Completeness Engine** | Weighted scoring algorithm; real-time recalculation on upload; category weights (40/25/20/15); visual indicators | Mid Dev | 12 | 0.6 |
| **M2-WP6: Pack Builder — Regulator** | Handlebars template (Japan customs format); MRL result table rendering; certificate embedding; multi-language | Senior Dev + Designer | 15 + 8 | 0.75 + 0.4 |
| **M2-WP7: Pack Builder — Buyer** | Buyer-focused template; quality summary; temp SLA chart embedding; photo gallery; Japanese/Chinese localization | Senior Dev + Designer | 15 + 8 | 0.75 + 0.4 |
| **M2-WP8: Pack Builder — Defense** | 6-section defense dossier; timeline reconstruction; forensics embedding; audit trail inclusion; photo+EXIF gallery | Senior Dev | 20 | 1.0 |
| **M2-WP9: QR Verification** | QR code generation; public verification endpoint; pack integrity check | Mid Dev | 5 | 0.25 |
| **M2-WP10: Frontend — Evidence UI** | Evidence checklist UI; drag-drop upload; graph visualization (D3.js/React Flow); completeness dashboard | Senior Frontend + Designer | 20 + 10 | 1.0 + 0.5 |
| **M2-WP11: Testing** | Hash integrity tests; graph traversal tests; PDF output validation; OCR accuracy testing; E2E pack generation | QA | 18 | 0.9 |

#### M2 Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **13.65** |
| **Calendar Time** | **4.5 months** (with 3 dev parallelism) |
| **Team Required** | 1 Tech Lead (partial), 2 Senior Devs, 1 Mid Dev, 1 Designer (partial), 1 QA |
| **Cost (Development)** | **1,133,000 THB** ($32,371 USD) |
| **Phase** | Phase 1 (Q1–Q2: core engine + Japan packs) + Phase 2 (Q3: China/Korea packs) |

---

### 2.3 MODULE M3: COLD-CHAIN SLA ENGINE

**Scope:** Multi-protocol telemetry ingestion (REST/BLE/CSV/MQTT), fruit-specific temperature profiles (4 species), real-time excursion detection with severity classification, shelf-life impact calculation (ML), SLA evaluation & reporting, temperature visualization.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **M3-WP1: Telemetry Ingestion** | REST API endpoint; CSV upload parser; Kafka consumer for streaming; device authentication; data normalization | Senior Dev | 18 | 0.9 |
| **M3-WP2: BLE Gateway** | React Native BLE module for USB logger download; data parsing for Testo/TempCorder formats; local caching | Mid Dev | 15 | 0.75 |
| **M3-WP3: Fruit Profiles** | Configuration tables for 4 fruit species; threshold parameters; bi-directional damage ranges; profile CRUD API | Mid Dev | 8 | 0.4 |
| **M3-WP4: Excursion Detector** | Real-time threshold comparison; severity classification (Minor/Moderate/Severe/Critical); rolling window analysis; Kafka Streams or Node.js stream processing | Senior Dev | 20 | 1.0 |
| **M3-WP5: Shelf-Life Model** | Python FastAPI service; cumulative excursion impact model; scikit-learn regression; fruit-specific decay curves; API endpoint | ML Engineer | 20 | 1.0 |
| **M3-WP6: SLA Evaluator** | Pass/Conditional/Fail logic; total excursion time calculation; defensibility scoring; SLA report generation | Senior Dev | 12 | 0.6 |
| **M3-WP7: Alert Engine** | Redis Pub/Sub for real-time alerts; WebSocket push; severity-based routing; LINE notification integration | Mid Dev | 10 | 0.5 |
| **M3-WP8: Temperature Visualization** | Recharts interactive chart; checkpoint markers; excursion highlighting; zoom/pan; responsive | Senior Frontend | 12 | 0.6 |
| **M3-WP9: Testing** | Simulated telemetry test suites; excursion detection accuracy; ML model validation; load testing (1000 concurrent readings) | QA + ML Engineer | 12 + 5 | 0.6 + 0.25 |

#### M3 Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **9.6** |
| **Calendar Time** | **3.5 months** (with 2–3 dev parallelism) |
| **Team Required** | 2 Senior Devs, 1 Mid Dev, 1 ML Engineer (partial), 1 Frontend Dev (partial), 1 QA (partial) |
| **Cost (Development)** | **834,000 THB** ($23,829 USD) |
| **Phase** | Phase 1 (Q1–Q2: Mode 1+2, mango profile) + Phase 2 (Q3: Mode 3, durian/mangosteen profiles, ML) |

---

### 2.4 MODULE M4: DISPUTE SHIELD

**Scope:** Claim trigger management, chain-of-custody timeline reconstruction, excursion root cause forensics, 6-section defense dossier assembly, claim lifecycle tracking.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **M4-WP1: Claim Manager** | Claim entity CRUD; trigger workflow (manual + automatic on rejection); status state machine; notification | Mid Dev | 10 | 0.5 |
| **M4-WP2: Timeline Reconstructor** | Query all checkpoints, handoffs, evidence uploads for lane; chronological ordering; gap detection; timeline rendering | Senior Dev | 15 | 0.75 |
| **M4-WP3: Forensics Engine** | Excursion root cause analysis; segment-by-segment liability assessment; handoff delay detection; Python FastAPI analytics | ML Engineer | 15 | 0.75 |
| **M4-WP4: Defense Pack Assembler** | 6-section PDF template; auto-populate from evidence graph + timeline + forensics; Puppeteer rendering | Senior Dev | 15 | 0.75 |
| **M4-WP5: Claim Tracker UI** | Claim dashboard; status timeline; defense pack preview; resolution form | Mid Dev + Designer | 10 + 5 | 0.5 + 0.25 |
| **M4-WP6: Testing** | 10+ claim scenario fixtures; defense pack validation; timeline accuracy tests | QA | 10 | 0.5 |

#### M4 Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **5.5** |
| **Calendar Time** | **2.5 months** (with 2 dev parallelism) |
| **Team Required** | 1 Senior Dev, 1 Mid Dev, 0.5 ML Engineer, 0.25 Designer, 0.5 QA |
| **Cost (Development)** | **440,000 THB** ($12,571 USD) |
| **Phase** | Phase 2 (Q3: v1 with simulated claims) + Phase 3 (Q4: real dispute validation) |

---

### 2.5 MODULE M5: MRV-LITE (Carbon/Waste/ESG)

**Scope:** Route-based CO₂e calculator, emission factor database, waste reduction tracking (baseline vs. actual), 3-level ESG report generator (per-lane card, exporter quarterly, platform annual).

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **M5-WP1: Carbon Calculator** | Emission factor DB (routes × modes); CO₂e per kg computation; component breakdown (transport, cold storage, packaging) | Mid Dev | 10 | 0.5 |
| **M5-WP2: Waste Tracker** | Baseline rejection rate storage; actual vs. baseline comparison; waste tonnage calculation; value retained calculation | Mid Dev | 8 | 0.4 |
| **M5-WP3: ESG Report Generator** | 3 report templates (lane card, quarterly, annual); Puppeteer rendering; chart embedding; SDG alignment indicators | Senior Dev + Designer | 12 + 5 | 0.6 + 0.25 |
| **M5-WP4: ESG Dashboard UI** | ESG overview page; per-lane card view; exporter aggregation; export/download | Mid Dev | 8 | 0.4 |
| **M5-WP5: Testing** | Carbon calculation accuracy (±15% benchmark); report rendering; data aggregation | QA | 5 | 0.25 |

#### M5 Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **3.4** |
| **Calendar Time** | **2.0 months** (with 1.5 dev parallelism) |
| **Team Required** | 1 Senior Dev (partial), 1 Mid Dev, 0.25 Designer, 0.25 QA |
| **Cost (Development)** | **248,000 THB** ($7,086 USD) |
| **Phase** | Phase 3 (Q4: v1) |

---

### 2.6 SUPPORTING SERVICES & CROSS-CUTTING

**Scope:** Auth service (JWT + MFA + RBAC), API Gateway, notification service (email/push/LINE), integration gateway (lab APIs, logistics APIs, IoT protocols), audit log service, WebSocket real-time updates.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **SS-WP1: Auth Service** | JWT issuance/refresh; TOTP MFA enrollment + verification; RBAC middleware; password reset flow; session management | Senior Dev | 15 | 0.75 |
| **SS-WP2: API Gateway** | Kong/AWS API Gateway setup; route configuration; rate limiting; CORS; request/response logging | DevOps + Senior Dev | 8 + 5 | 0.4 + 0.25 |
| **SS-WP3: Notification Service** | Email (AWS SES); push notifications; in-app notification system; LINE Messaging API integration; notification preferences | Mid Dev | 15 | 0.75 |
| **SS-WP4: Integration Gateway** | Central Lab Thai API adapter; SGS API adapter; logistics API adapters; IoT protocol translation (MQTT → Kafka); error handling + retry | Senior Dev | 20 | 1.0 |
| **SS-WP5: Audit Log Service** | Append-only hash-chain implementation; PostgreSQL audit table; verification endpoint; export endpoint | Senior Dev | 10 | 0.5 |
| **SS-WP6: WebSocket Server** | Socket.IO / native WS; JWT authentication for WS; event broadcasting (excursion, pack ready, status change); reconnection handling | Mid Dev | 8 | 0.4 |
| **SS-WP7: Testing** | Auth flow tests; API gateway integration tests; notification delivery tests; audit chain verification | QA | 10 | 0.5 |

#### Supporting Services Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **6.55** |
| **Calendar Time** | **3.0 months** (with 2 dev parallelism) |
| **Team Required** | 2 Senior Devs, 1 Mid Dev, 1 DevOps (partial), 0.5 QA |
| **Cost (Development)** | **537,000 THB** ($15,343 USD) |
| **Phase** | Phase 1 (Q1: Auth, Audit, API Gateway) + Phase 2 (Q2–Q3: Integrations, Notifications) |

---

### 2.7 FRONTEND APPLICATION

**Scope:** 11 screens (Login, Dashboard, Lane Wizard, Lane Detail with 6 tabs, Rules Admin, Analytics, Checkpoint Capture PWA, Pack Viewer, Partner Portal, Settings, ESG Reports), responsive design (desktop/tablet/mobile), dark mode, PWA with offline support.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **FE-WP1: Design System Setup** | Tailwind config with ZRL tokens; component library (buttons, cards, badges, tables, forms, modals); Storybook documentation | Designer + Senior Frontend | 15 + 10 | 0.75 + 0.5 |
| **FE-WP2: Login & Auth Flows** | Login page; MFA step; forgot password; language switcher; auth state management | Mid Frontend | 5 | 0.25 |
| **FE-WP3: Dashboard** | Bento grid layout; 4 KPI tiles; active lanes table; quick actions panel; temperature sparklines; responsive | Senior Frontend | 12 | 0.6 |
| **FE-WP4: Lane Creation Wizard** | 4-step wizard; product cards; market selector; route builder; review & create; draft auto-save; smart defaults | Senior Frontend | 18 | 0.9 |
| **FE-WP5: Lane Detail — Evidence Tab** | Evidence checklist with upload; drag-drop zones; evidence graph visualization (React Flow/D3); completeness bar | Senior Frontend | 15 | 0.75 |
| **FE-WP6: Lane Detail — Checkpoints Tab** | Vertical timeline; checkpoint cards; photo lightbox; "Record Checkpoint" form with signature pad | Senior Frontend | 10 | 0.5 |
| **FE-WP7: Lane Detail — Temperature Tab** | Recharts interactive chart; excursion highlighting; SLA summary card; shelf-life display | Senior Frontend | 12 | 0.6 |
| **FE-WP8: Lane Detail — Packs + Audit** | Pack cards with generate/download; PDF viewer embed; audit trail table with hash verification; dispute tab | Mid Frontend | 12 | 0.6 |
| **FE-WP9: Analytics Dashboard** | 6 KPI tiles; rejection trend line chart; completeness donut; lanes bar chart; excursion heatmap; leaderboard table | Senior Frontend | 15 | 0.75 |
| **FE-WP10: Rules Admin** | Substance CRUD table with search/filter/sort; CSV import; template editor; version history timeline | Mid Frontend | 12 | 0.6 |
| **FE-WP11: Checkpoint Capture PWA** | Camera integration; GPS capture; signature pad; offline support (Service Worker); sync queue; mobile-optimized | Senior Frontend | 18 | 0.9 |
| **FE-WP12: Partner Portal** | Lab result submission; logistics data view; simplified dashboard | Mid Frontend | 10 | 0.5 |
| **FE-WP13: Settings** | 8-section settings; profile forms; MFA setup; API key management; notification prefs; theme toggle; data export | Mid Frontend | 10 | 0.5 |
| **FE-WP14: ESG Reports** | Per-lane ESG card; exporter quarterly; platform annual; chart visualizations; PDF download | Mid Frontend | 8 | 0.4 |
| **FE-WP15: Dark Mode & Responsive** | Dark mode token mapping; responsive testing at all breakpoints; touch target optimization | Designer + Mid Frontend | 5 + 8 | 0.25 + 0.4 |
| **FE-WP16: Testing** | Component tests (React Testing Library); E2E tests (Playwright); visual regression; accessibility audit | QA | 15 | 0.75 |

#### Frontend Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **13.0** |
| **Calendar Time** | **5.0 months** (with 2–3 frontend dev parallelism) |
| **Team Required** | 1 Senior Frontend, 1 Mid Frontend, 1 Designer, 1 QA (partial) |
| **Cost (Development)** | **1,020,000 THB** ($29,143 USD) |
| **Phase** | Continuous across Phase 1–3 (screens delivered per module readiness) |

---

### 2.8 INFRASTRUCTURE & DEVOPS

**Scope:** Cloud infrastructure setup (AWS), CI/CD pipeline, containerization, monitoring & alerting, database setup & migration, backup & DR configuration, security hardening.

#### Effort Breakdown

| Work Package | Tasks | Role | Person-Days | Person-Months |
|-------------|-------|------|-------------|---------------|
| **IN-WP1: Cloud Architecture** | AWS account structure; VPC, subnets, security groups; multi-AZ setup; Terraform IaC foundation | DevOps | 12 | 0.6 |
| **IN-WP2: Containerization** | Dockerfile per service; docker-compose for local dev; K8s manifests (deployment, service, ingress); Helm charts | DevOps | 10 | 0.5 |
| **IN-WP3: CI/CD Pipeline** | GitHub Actions workflows; build → test → lint → staging → production; blue-green deployment; rollback capability | DevOps | 10 | 0.5 |
| **IN-WP4: Database Setup** | RDS PostgreSQL provisioning; schema migrations (Prisma); read replica; connection pooling; automated backups | DevOps + Senior Dev | 8 + 5 | 0.4 + 0.25 |
| **IN-WP5: Object Storage** | S3 bucket configuration; versioning; lifecycle policies; cross-region replication; presigned URL generation | DevOps | 5 | 0.25 |
| **IN-WP6: Message Queue** | Kafka/SQS setup; topic configuration; consumer group management; dead letter queue; monitoring | DevOps | 8 | 0.4 |
| **IN-WP7: Monitoring & Alerting** | Prometheus + Grafana dashboards; CloudWatch integration; Sentry error tracking; PagerDuty/OpsGenie alerting; custom KPI dashboards | DevOps | 12 | 0.6 |
| **IN-WP8: Security Hardening** | WAF rules; TLS certificates; secrets management (KMS); OWASP ZAP scanning; penetration test coordination | DevOps | 10 | 0.5 |
| **IN-WP9: CDN & Edge** | CloudFront distribution; cache policies; geo-restriction (if needed); DDoS protection | DevOps | 5 | 0.25 |

#### Infrastructure Summary

| Metric | Value |
|--------|-------|
| **Total Person-Months** | **5.25** |
| **Calendar Time** | Continuous (Q1 foundation + ongoing maintenance) |
| **Team Required** | 1 DevOps Engineer (full-time) |
| **Cost (Development)** | **525,000 THB** ($15,000 USD) |
| **Phase** | Phase 1 (Q1: foundation) + ongoing |

---

## 3. CONSOLIDATED MODULE COMPARISON

### 3.1 Effort by Module

| Module | Person-Months | Calendar Months | Dev Cost (THB) | Dev Cost (USD) | Complexity |
|--------|--------------|----------------|----------------|---------------|-----------|
| **M1: Rules Engine** | 9.0 | 3.5 | 720,000 | $20,571 | High |
| **M2: Evidence Graph + Packs** | 13.65 | 4.5 | 1,133,000 | $32,371 | **Very High** |
| **M3: Cold-Chain SLA** | 9.6 | 3.5 | 834,000 | $23,829 | High |
| **M4: Dispute Shield** | 5.5 | 2.5 | 440,000 | $12,571 | Medium |
| **M5: MRV-Lite** | 3.4 | 2.0 | 248,000 | $7,086 | Low |
| **Supporting Services** | 6.55 | 3.0 | 537,000 | $15,343 | Medium |
| **Frontend (All Screens)** | 13.0 | 5.0 | 1,020,000 | $29,143 | High |
| **Infrastructure / DevOps** | 5.25 | Continuous | 525,000 | $15,000 | Medium |
| **SUBTOTAL (Dev)** | **65.95** | — | **5,457,000** | **$155,914** | — |

### 3.2 Effort by Role (Across All Modules)

| Role | Total Person-Months | % of Total | Total Cost (THB) |
|------|-------------------|-----------|-----------------|
| **Tech Lead / Architect** | 4.0 | 6% | 600,000 |
| **Senior Backend Developer** | 18.0 | 27% | 1,800,000 |
| **Senior Frontend Developer** | 8.0 | 12% | 800,000 |
| **Mid-Level Developer** | 12.0 | 18% | 840,000 |
| **ML / Data Engineer** | 3.0 | 5% | 360,000 |
| **UI/UX Designer** | 5.0 | 8% | 400,000 |
| **DevOps / SRE** | 5.25 | 8% | 525,000 |
| **QA Engineer** | 5.5 | 8% | 357,500 |
| **Product Owner / PM** | 5.2 | 8% | 624,000 |
| **TOTAL** | **65.95** | **100%** | **6,306,500** |

> **Note:** Rates include PM/PO allocation (8%) for coordination. Domain expert cost included in operations budget.

---

## 4. NON-DEVELOPMENT COSTS

### 4.1 Infrastructure & Cloud (Monthly)

| Service | Monthly Cost (THB) | Annual Cost (THB) | Notes |
|---------|-------------------|-------------------|-------|
| AWS RDS PostgreSQL (db.t3.medium, multi-AZ) | 12,000 | 144,000 | Primary database |
| AWS S3 (evidence storage, 500 GB Year 1) | 1,500 | 18,000 | Versioned, lifecycle policies |
| AWS EKS / ECS (2 nodes) | 15,000 | 180,000 | Container orchestration |
| AWS CloudFront + WAF | 3,000 | 36,000 | CDN + security |
| AWS SES (email) | 500 | 6,000 | Notifications |
| Redis (ElastiCache, t3.small) | 3,000 | 36,000 | Cache + sessions |
| Kafka (MSK, small) OR SQS | 5,000 | 60,000 | Event streaming |
| Monitoring (CloudWatch, Sentry) | 2,000 | 24,000 | Logs + error tracking |
| SSL certificates + DNS | 500 | 6,000 | Route 53 + ACM |
| Miscellaneous (data transfer, etc.) | 3,000 | 36,000 | Buffer |
| **TOTAL INFRASTRUCTURE** | **45,500** | **546,000** | |

**Scaling Notes:**
- Year 1 (pilot, 200 lanes): ~45,500 THB/month
- Year 2 (3,000 lanes): ~90,000 THB/month (scale up DB, add nodes)
- Year 3 (15,000 lanes): ~180,000 THB/month (horizontal scaling)

### 4.2 Third-Party Services & Tools

| Service | Annual Cost (THB) | Purpose |
|---------|-------------------|---------|
| GitHub (Team plan, 8 seats) | 36,000 | Code repo + CI/CD |
| Figma (Professional, 2 seats) | 18,000 | UI/UX design |
| Sentry (Team plan) | 12,000 | Error tracking |
| LINE Official Account (messaging) | 6,000 | Exporter notifications |
| Domain + SSL | 3,000 | zrl.app domain |
| Tesseract / AWS Textract | 24,000 | OCR for lab results |
| **TOTAL TOOLS** | **99,000** | |

### 4.3 Operations & Field Costs (Year 1)

| Item | Quarterly (THB) | Annual (THB) | Notes |
|------|----------------|-------------|-------|
| Domain Expert (0.5 FTE, contractor) | 120,000 | 480,000 | Former DOA official |
| Business Development (0.5 FTE) | 100,000 | 400,000 | Partner management |
| Field Operations (travel, training) | 75,000 | 300,000 | Chachoengsao, Ratchaburi, Chumphon |
| Exporter Onboarding Materials | 25,000 | 100,000 | Printed guides, demo accounts |
| Partner Engagement (labs, logistics) | 25,000 | 100,000 | Meetings, integration support |
| Legal (PDPA compliance, contracts) | 25,000 | 100,000 | Lawyer consultation |
| Cold-Chain Devices (20 USB loggers) | 30,000 (one-time) | 30,000 | $20–50 each for pilot |
| **TOTAL OPERATIONS** | **400,000** | **1,510,000** | |

---

## 5. PHASED BUDGET BREAKDOWN

### Phase 1: MVP + Japan Rules (Months 1–4)

| Category | Cost (THB) | Details |
|----------|-----------|---------|
| **M1 Rules Engine (Japan)** | 400,000 | Japan 400+ substances, validation, checklist |
| **M2 Evidence Graph (Core)** | 550,000 | DAG engine, hashing, upload, Japan regulator pack |
| **M3 Cold-Chain (Mode 1+2)** | 350,000 | Manual + USB logger, mango profile, basic excursion |
| **Supporting Services** | 350,000 | Auth, API gateway, audit log |
| **Frontend (Core Screens)** | 400,000 | Login, dashboard, lane wizard, lane detail, checkpoint PWA |
| **Infrastructure** | 200,000 | AWS setup, CI/CD, containerization |
| **Design** | 150,000 | Design system, component library, 5 core screens |
| **QA** | 120,000 | Unit + integration tests |
| **Operations** | 300,000 | Domain expert, field visits, LOI follow-up |
| **Contingency (15%)** | 432,000 | — |
| **PHASE 1 TOTAL** | **3,252,000** | ~$92,914 USD |

### Phase 2: Pilot Expansion + Multi-Market (Months 5–8)

| Category | Cost (THB) | Details |
|----------|-----------|---------|
| **M1 Rules Engine (China, Korea)** | 320,000 | China GACC/GB, Korea PLS |
| **M2 Proof Packs (China, Korea)** | 350,000 | Buyer + regulator packs for 2 new markets |
| **M3 Cold-Chain (Mode 3 + ML)** | 350,000 | Telemetry integration, durian/mangosteen profiles, shelf-life ML |
| **M4 Dispute Shield (v1)** | 440,000 | Full module development |
| **Supporting Services** | 200,000 | Integrations (Central Lab API, logistics) |
| **Frontend (Remaining Screens)** | 350,000 | Analytics, rules admin, partner portal, pack viewer |
| **QA** | 150,000 | E2E tests, security testing, performance testing |
| **Operations** | 600,000 | Pilot operations, travel, partner management |
| **Infrastructure** | 180,000 | Scale adjustments, monitoring expansion |
| **Contingency (15%)** | 444,000 | — |
| **PHASE 2 TOTAL** | **3,384,000** | ~$96,686 USD |

### Phase 3: Scale Readiness + ESG (Months 9–12)

| Category | Cost (THB) | Details |
|----------|-----------|---------|
| **M5 MRV-Lite** | 248,000 | Full module development |
| **M2 Proof Packs (Mangosteen)** | 150,000 | Additional fruit × market packs |
| **M3 Cold-Chain (Optimization)** | 150,000 | Multi-logger support, analytics refinement |
| **M4 Dispute Shield (v2)** | 100,000 | Real dispute testing, refinement |
| **Frontend (ESG + Polish)** | 250,000 | ESG reports, settings, dark mode, responsive polish |
| **Infrastructure** | 150,000 | Load testing, scaling prep, DR testing |
| **QA** | 100,000 | Performance testing (100+ lanes/month), security audit |
| **Operations** | 800,000 | 20+ exporter onboarding, impact report, year 2 planning |
| **Impact Report + Documentation** | 100,000 | NIA final report, investor pitch deck |
| **Contingency (15%)** | 306,000 | — |
| **PHASE 3 TOTAL** | **2,354,000** | ~$67,257 USD |

---

## 6. TOTAL PROJECT BUDGET SUMMARY

### 6.1 By Cost Category

| Category | Phase 1 | Phase 2 | Phase 3 | TOTAL (THB) | TOTAL (USD) | % |
|----------|---------|---------|---------|------------|-------------|---|
| **Backend Development** | 1,650,000 | 1,660,000 | 648,000 | 3,958,000 | $113,086 | 25% |
| **Frontend Development** | 400,000 | 350,000 | 250,000 | 1,000,000 | $28,571 | 6% |
| **Design (UI/UX)** | 150,000 | 80,000 | 50,000 | 280,000 | $8,000 | 2% |
| **QA & Testing** | 120,000 | 150,000 | 100,000 | 370,000 | $10,571 | 2% |
| **Infrastructure** | 200,000 | 180,000 | 150,000 | 530,000 | $15,143 | 3% |
| **Cloud (12 months)** | — | — | — | 546,000 | $15,600 | 3% |
| **Tools & Services** | — | — | — | 99,000 | $2,829 | 1% |
| **Operations & Field** | 300,000 | 600,000 | 800,000 | 1,700,000 | $48,571 | 11% |
| **Contingency (15%)** | 432,000 | 444,000 | 306,000 | 1,182,000 | $33,771 | 7% |
| **TOTAL** | **3,252,000** | **3,384,000** | **2,354,000** | **8,990,000** | **$256,857** | — |

> **Conservative total with full contingency: ~9.0M THB ($257K USD)**

### 6.2 By Funding Source

| Source | Amount (THB) | Timing | Coverage |
|--------|-------------|--------|----------|
| **NIA Grant** | 5,000,000 | Year 1 (Q1–Q4) | Phase 1 + partial Phase 2 |
| **Company Co-Investment** | 1,670,000 | Year 1 | Remaining Phase 2 + Phase 3 core |
| **Seed Round** | 5,000,000–10,000,000 | Month 12–18 | Phase 3 completion + Year 2 scaling |
| **Revenue (Q3–Q4)** | 300,000–500,000 | Month 7–12 | Early adopter per-lane fees |

### 6.3 NIA Budget Alignment (5.0M THB)

| NIA Category | Allocation | % | Justification |
|-------------|-----------|---|---------------|
| Platform Development | 2,400,000 | 48% | M1 + M2 core + M3 basic + supporting services |
| Pilot Operations | 1,000,000 | 20% | Field ops, exporter onboarding, travel |
| Rules & Compliance | 600,000 | 12% | Domain expert, MRL database, regulatory research |
| Team & Contractors | 500,000 | 10% | Additional dev resources, design |
| Infrastructure | 300,000 | 6% | Cloud, tools, devices |
| Contingency | 200,000 | 4% | Risk buffer |
| **TOTAL NIA** | **5,000,000** | **100%** | |

---

## 7. TEAM COMPOSITION & HIRING TIMELINE

### 7.1 Core Team (Month 1 Start)

| # | Role | FTE | Monthly Cost | Start | End |
|---|------|-----|-------------|-------|-----|
| 1 | **Product Owner / PM** | 0.8 | 96,000 | Month 1 | Month 12 |
| 2 | **Tech Lead / Architect** | 1.0 | 150,000 | Month 1 | Month 12 |
| 3 | **Senior Backend Developer** | 1.0 | 100,000 | Month 1 | Month 12 |
| 4 | **Senior Frontend Developer** | 1.0 | 100,000 | Month 1 | Month 12 |
| 5 | **Mid-Level Developer** | 1.0 | 70,000 | Month 1 | Month 12 |
| 6 | **Domain Expert (Contractor)** | 0.5 | 40,000 | Month 1 | Month 10 |
| — | **Month 1 Total** | **5.3** | **556,000** | — | — |

### 7.2 Phase 2 Additions (Month 4)

| # | Role | FTE | Monthly Cost | Start | End |
|---|------|-----|-------------|-------|-----|
| 7 | **DevOps / SRE** | 1.0 | 100,000 | Month 2 | Month 12 |
| 8 | **UI/UX Designer** | 0.5 | 40,000 | Month 1 | Month 8 |
| 9 | **QA Engineer** | 0.5 | 32,500 | Month 2 | Month 12 |
| 10 | **ML Engineer (Contractor)** | 0.5 | 60,000 | Month 5 | Month 9 |
| 11 | **Business Development** | 0.5 | 40,000 | Month 3 | Month 12 |
| — | **Peak Team (Month 5–8)** | **8.3** | **828,500** | — | — |

### 7.3 Team Size Over Time

```
Month:  1    2    3    4    5    6    7    8    9    10   11   12
FTE:   5.3  6.3  6.8  7.3  8.3  8.3  8.3  8.3  7.8  7.3  6.8  6.3
        ▓▓   ▓▓▓  ▓▓▓  ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓▓ ▓▓▓  ▓▓▓  ▓▓▓
        ████████████████████████████████████████████████████████████
```

Average: **7.2 FTE** over 12 months

---

## 8. TIMELINE — GANTT VIEW

```
Month:           1     2     3     4     5     6     7     8     9    10    11    12
                 ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤

INFRASTRUCTURE   ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                 Setup              Ongoing maintenance & scaling

M1 RULES ENGINE  ████████████████████░░░░░░░░░░░░░░░████████████████░░░░░░░░░░░░░
                 Japan (400+ MRL)                    China + Korea

M2 EVIDENCE+PACK ██████████████████████████████████░░████████████████░░░░░░░░░░░░░
                 Core DAG + Hashing + Japan Packs    China/KR Packs + Mangosteen

M3 COLD-CHAIN    ░░░░░░░░██████████████████████████░░████████████████████████░░░░░
                         Mode 1+2 + Mango            Mode 3 + ML + Durian/Mangosteen

M4 DISPUTE       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████████████████░░
                                                     v1 Development      v2 + Real Testing

M5 MRV-LITE      ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████░
                                                                     v1 Development

SUPPORTING SVCS  ██████████████████░░░░░░░░░░░░░░░░██████████░░░░░░░░░░░░░░░░░░░░
                 Auth + Audit + GW                  Integrations + Notifications

FRONTEND         ░░░░████████████████████████████████████████████████████████████░░
                     Core Screens    Lane Detail     Analytics  Partner  ESG  Polish

QA & TESTING     ░░░░░░░░████████░░████████████████████████████████████████████████
                         Unit+Int   E2E              Perf    Security    Final

PILOT OPS        ░░░░░░░░░░░░░░░░████████████████████████████████████████████████░░
                                  Mango→JP Pilot    Durian→CN     Scale to 20+

                 ├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
MILESTONES       ★M1                ★M2                ★M3                ★M4
                 MVP Ready          First Acceptance   Pilot Success      Scale Ready
```

---

## 9. RISK-ADJUSTED ESTIMATES

### 9.1 Estimation Confidence by Module

| Module | Base Estimate | Optimistic (-20%) | Pessimistic (+40%) | Confidence |
|--------|-------------|-------------------|-------------------|-----------|
| M1 Rules Engine | 9.0 PM | 7.2 PM | 12.6 PM | **High** (well-defined scope) |
| M2 Evidence+Packs | 13.65 PM | 10.9 PM | 19.1 PM | **Medium** (OCR & multi-market packs add uncertainty) |
| M3 Cold-Chain | 9.6 PM | 7.7 PM | 13.4 PM | **Medium** (ML model & multi-device integration) |
| M4 Dispute Shield | 5.5 PM | 4.4 PM | 7.7 PM | **High** (well-scoped, builds on M2+M3) |
| M5 MRV-Lite | 3.4 PM | 2.7 PM | 4.8 PM | **High** (simple calculations, low risk) |
| Supporting Services | 6.55 PM | 5.2 PM | 9.2 PM | **High** (standard patterns) |
| Frontend | 13.0 PM | 10.4 PM | 18.2 PM | **Medium** (11 screens, PWA complexity) |
| Infrastructure | 5.25 PM | 4.2 PM | 7.4 PM | **High** (standard AWS setup) |

### 9.2 Monte Carlo Summary

| Scenario | Total Person-Months | Total Cost (THB) | Total Cost (USD) | Probability |
|----------|-------------------|-----------------|-----------------|------------|
| **Optimistic** | 52.7 | 7,200,000 | $205,714 | 15% |
| **Base Case** | 65.95 | 8,990,000 | $256,857 | 55% |
| **Pessimistic** | 92.4 | 12,600,000 | $360,000 | 25% |
| **Worst Case** | 105.0 | 14,300,000 | $408,571 | 5% |

### 9.3 Critical Path Items (Schedule Risk)

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **M2 OCR accuracy for Thai lab PDFs** | +2–4 weeks if accuracy <90% | Fallback: manual structured data entry + API integration with Central Lab Thai |
| **M3 multi-device BLE integration** | +2–3 weeks per device type | Start Mode 1 (no hardware); add devices incrementally |
| **Proof Pack format rejection by Japanese buyer** | +2–4 weeks for template iteration | Pre-negotiate format via JETRO before development |
| **Key developer departure** | +4–6 weeks for replacement + ramp-up | Pair programming on critical modules; documentation |
| **Mango season miss (MVP not ready by Feb)** | +12 months wait for next season | Scope MVP to minimum viable: Rules + Upload + Basic Pack |

---

## 10. COMPARISON: BUILD vs. BUY vs. HYBRID

| Approach | Total Cost (Year 1) | Time to Market | Fit to Requirements | Maintenance |
|----------|-------------------|---------------|-------------------|------------|
| **Full Custom Build** (this estimate) | 9.0M THB | 4 months (MVP) | **100%** | Team owns |
| **Low-Code + Custom** (Retool/Appsmith + NestJS backend) | 6.5M THB | 3 months (MVP) | 85% (UI limitations) | Vendor dependency |
| **SaaS + Customization** (e.g., FoodLogiQ + extensions) | 12.0M THB/year | 6 months | 60% (no tropical fruit specifics) | Vendor dependency |
| **Outsource Development** (agency) | 7.0–15.0M THB | 5–8 months | 90% (communication overhead) | Handoff risk |

**Recommendation:** Full Custom Build is optimal because:
1. No existing SaaS covers tropical fruit MRL + cold-chain + dispute defense
2. Core IP (evidence graph, fruit-specific algorithms) must be owned
3. Thai developer market has strong React/NestJS/TypeScript talent at competitive rates
4. Modular monolith allows fast iteration; migrate to microservices as needed

---

*END OF RESOURCE ESTIMATION*
*Zero-Reject Export Lane — NIA Thailand*
