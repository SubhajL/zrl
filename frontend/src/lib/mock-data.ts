/* ═══════════════════════════════════════════════════
   ZRL Mock Data — static sample data for all screens
   Replace with real API calls when backend is wired
   Aligned with backend contract types
   ═══════════════════════════════════════════════════ */

import type {
  Lane,
  Checkpoint,
  EvidenceArtifact,
  MrlSubstance,
  AuditEntry,
  User,
} from './types';

// ── Current User ──

export const MOCK_USER: User = {
  id: 'usr-001',
  email: 'somchai@tte.co.th',
  role: 'EXPORTER',
  companyName: 'Thai Tropical Exports Co., Ltd.',
  fullName: 'Somchai Prasert',
  mfaEnabled: false,
};

// ── Lanes (Gap #1: includes coldChainMode) ──

export const MOCK_LANES: Lane[] = [
  {
    id: '1',
    laneId: 'LN-2026-001',
    exporterId: 'usr-001',
    status: 'EVIDENCE_COLLECTING',
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    completenessScore: 80,
    coldChainMode: 'TELEMETRY',
    createdAt: '2026-03-18T08:00:00Z',
    updatedAt: '2026-03-22T10:30:00Z',
  },
  {
    id: '2',
    laneId: 'LN-2026-002',
    exporterId: 'usr-001',
    status: 'VALIDATED',
    productType: 'DURIAN',
    destinationMarket: 'CHINA',
    completenessScore: 95,
    coldChainMode: 'LOGGER',
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-03-22T09:15:00Z',
  },
  {
    id: '3',
    laneId: 'LN-2026-003',
    exporterId: 'usr-001',
    status: 'EVIDENCE_COLLECTING',
    productType: 'MANGOSTEEN',
    destinationMarket: 'KOREA',
    completenessScore: 45,
    coldChainMode: 'MANUAL',
    createdAt: '2026-03-20T07:30:00Z',
    updatedAt: '2026-03-22T05:00:00Z',
  },
  {
    id: '4',
    laneId: 'LN-2026-004',
    exporterId: 'usr-001',
    status: 'PACKED',
    productType: 'MANGO',
    destinationMarket: 'JAPAN',
    completenessScore: 100,
    coldChainMode: 'TELEMETRY',
    createdAt: '2026-03-10T10:00:00Z',
    updatedAt: '2026-03-22T11:45:00Z',
  },
  {
    id: '5',
    laneId: 'LN-2026-005',
    exporterId: 'usr-001',
    status: 'CREATED',
    productType: 'LONGAN',
    destinationMarket: 'EU',
    completenessScore: 10,
    coldChainMode: null,
    createdAt: '2026-03-21T14:00:00Z',
    updatedAt: '2026-03-21T14:00:00Z',
  },
];

// ── Evidence (Gap #2: full contract shape) ──

export const MOCK_EVIDENCE: EvidenceArtifact[] = [
  {
    id: 'ev-001',
    laneId: 'LN-2026-001',
    artifactType: 'PHYTO_CERT',
    fileName: 'phytosanitary-cert-2026.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 245_000,
    contentHash: 'a7f3b2c1e8d94f6a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5',
    contentHashPreview: 'a7f3b2c1',
    storagePath: 's3://zrl-evidence/LN-2026-001/a7f3b2c1.pdf',
    verificationStatus: 'VERIFIED',
    source: 'UPLOAD',
    checkpointId: null,
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-03-20T10:05:00Z',
  },
  {
    id: 'ev-002',
    laneId: 'LN-2026-001',
    artifactType: 'VHT_CERT',
    fileName: 'vht-certificate.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 180_000,
    contentHash: '8c2d4f5e9a1b3c7d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7',
    contentHashPreview: '8c2d4f5e',
    storagePath: 's3://zrl-evidence/LN-2026-001/8c2d4f5e.pdf',
    verificationStatus: 'VERIFIED',
    source: 'PARTNER_API',
    checkpointId: null,
    createdAt: '2026-03-19T14:30:00Z',
    updatedAt: '2026-03-19T14:35:00Z',
  },
  {
    id: 'ev-003',
    laneId: 'LN-2026-001',
    artifactType: 'MRL_TEST',
    fileName: 'mrl-lab-results.json',
    mimeType: 'application/json',
    fileSizeBytes: 0,
    contentHash: '',
    contentHashPreview: '',
    storagePath: '',
    verificationStatus: 'PENDING',
    source: 'PARTNER_API',
    checkpointId: null,
    createdAt: '2026-03-22T08:00:00Z',
    updatedAt: '2026-03-22T08:00:00Z',
  },
  {
    id: 'ev-004',
    laneId: 'LN-2026-001',
    artifactType: 'GAP_CERT',
    fileName: 'gap-certificate-2026.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 120_000,
    contentHash: 'f2e1d3c4b5a697081a2b3c4d5e6f7890abcdef0123456789abcdef0123456789',
    contentHashPreview: 'f2e1d3c4',
    storagePath: 's3://zrl-evidence/LN-2026-001/f2e1d3c4.pdf',
    verificationStatus: 'VERIFIED',
    source: 'UPLOAD',
    checkpointId: null,
    createdAt: '2026-03-18T09:00:00Z',
    updatedAt: '2026-03-18T09:10:00Z',
  },
  {
    id: 'ev-005',
    laneId: 'LN-2026-001',
    artifactType: 'INVOICE',
    fileName: 'commercial-invoice.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 95_000,
    contentHash: '1a2b3c4d5e6f78901234567890abcdef1234567890abcdef1234567890abcdef',
    contentHashPreview: '1a2b3c4d',
    storagePath: 's3://zrl-evidence/LN-2026-001/1a2b3c4d.pdf',
    verificationStatus: 'VERIFIED',
    source: 'UPLOAD',
    checkpointId: null,
    createdAt: '2026-03-21T16:00:00Z',
    updatedAt: '2026-03-21T16:05:00Z',
  },
  {
    id: 'ev-006',
    laneId: 'LN-2026-001',
    artifactType: 'TEMP_DATA',
    fileName: 'temperature-log.csv',
    mimeType: 'text/csv',
    fileSizeBytes: 42_000,
    contentHash: '9f8e7d6c5b4a32101234567890abcdef1234567890abcdef1234567890abcdef',
    contentHashPreview: '9f8e7d6c',
    storagePath: 's3://zrl-evidence/LN-2026-001/9f8e7d6c.csv',
    verificationStatus: 'VERIFIED',
    source: 'UPLOAD',
    checkpointId: 'cp-001',
    metadata: {
      capturedAt: '2026-03-20T06:00:00Z',
    },
    createdAt: '2026-03-22T08:00:00Z',
    updatedAt: '2026-03-22T08:05:00Z',
  },
];

// ── Checkpoints (aligned with backend LaneDetail.checkpoints) ──

export const MOCK_CHECKPOINTS: Checkpoint[] = [
  {
    id: 'cp-001',
    laneId: 'LN-2026-001',
    locationName: 'CP1: Packing House → Truck',
    sequence: 1,
    status: 'COMPLETED',
    timestamp: '2026-03-20T06:00:00Z',
    temperature: 12.5,
    gpsLat: 13.7563,
    gpsLng: 100.5018,
    signatureHash: 'abc123',
    signerName: 'Wichai K.',
    conditionNotes: 'All packages sealed correctly',
  },
  {
    id: 'cp-002',
    laneId: 'LN-2026-001',
    locationName: 'CP2: Truck → Laem Chabang Port',
    sequence: 2,
    status: 'COMPLETED',
    timestamp: '2026-03-20T14:30:00Z',
    temperature: 11.8,
    gpsLat: 13.0827,
    gpsLng: 100.9271,
    signatureHash: 'def456',
    signerName: 'Prasit S.',
    conditionNotes: null,
  },
  {
    id: 'cp-003',
    laneId: 'LN-2026-001',
    locationName: 'CP3: Port → Vessel',
    sequence: 3,
    status: 'PENDING',
    timestamp: null,
    temperature: null,
    gpsLat: null,
    gpsLng: null,
    signatureHash: null,
    signerName: null,
    conditionNotes: null,
  },
  {
    id: 'cp-004',
    laneId: 'LN-2026-001',
    locationName: 'CP4: Vessel → Tokyo Port',
    sequence: 4,
    status: 'PENDING',
    timestamp: null,
    temperature: null,
    gpsLat: null,
    gpsLng: null,
    signatureHash: null,
    signerName: null,
    conditionNotes: null,
  },
];

// ── MRL Substances ──

export const MOCK_SUBSTANCES: MrlSubstance[] = [
  { id: 's-001', name: 'Chlorpyrifos', casNumber: '2921-88-2', thaiMrl: 0.5, destinationMrl: 0.01, stringencyRatio: 50, riskLevel: 'CRITICAL', updatedAt: '2026-03-15T00:00:00Z' },
  { id: 's-002', name: 'Dithiocarbamates', casNumber: null, thaiMrl: 2.0, destinationMrl: 0.1, stringencyRatio: 20, riskLevel: 'CRITICAL', updatedAt: '2026-03-15T00:00:00Z' },
  { id: 's-003', name: 'Carbendazim', casNumber: '10605-21-7', thaiMrl: 5.0, destinationMrl: 0.5, stringencyRatio: 10, riskLevel: 'HIGH', updatedAt: '2026-03-10T00:00:00Z' },
  { id: 's-004', name: 'Cypermethrin', casNumber: '52315-07-8', thaiMrl: 2.0, destinationMrl: 0.2, stringencyRatio: 10, riskLevel: 'HIGH', updatedAt: '2026-03-10T00:00:00Z' },
  { id: 's-005', name: 'Imidacloprid', casNumber: '138261-41-3', thaiMrl: 1.0, destinationMrl: 0.3, stringencyRatio: 3.3, riskLevel: 'MEDIUM', updatedAt: '2026-03-01T00:00:00Z' },
  { id: 's-006', name: 'Metalaxyl', casNumber: '57837-19-1', thaiMrl: 2.0, destinationMrl: 1.0, stringencyRatio: 2, riskLevel: 'LOW', updatedAt: '2026-02-28T00:00:00Z' },
  { id: 's-007', name: 'Thiamethoxam', casNumber: '153719-23-4', thaiMrl: 0.5, destinationMrl: 0.2, stringencyRatio: 2.5, riskLevel: 'MEDIUM', updatedAt: '2026-03-01T00:00:00Z' },
  { id: 's-008', name: 'Acetamiprid', casNumber: '135410-20-7', thaiMrl: 1.0, destinationMrl: 0.5, stringencyRatio: 2, riskLevel: 'LOW', updatedAt: '2026-02-28T00:00:00Z' },
];

// ── Audit Entries (Gap #3 + #4: payloadHash + typed enums) ──

export const MOCK_AUDIT_ENTRIES: AuditEntry[] = [
  { id: 'ae-001', timestamp: '2026-03-18T08:00:00Z', actor: 'somchai@tte.co.th', action: 'CREATE', entityType: 'LANE', entityId: 'LN-2026-001', payloadHash: 'ph-a1b2c3d4', entryHash: 'a1b2c3d4', prevHash: '00000000' },
  { id: 'ae-002', timestamp: '2026-03-18T08:00:01Z', actor: 'system', action: 'UPDATE', entityType: 'LANE', entityId: 'LN-2026-001', payloadHash: 'ph-e5f6g7h8', entryHash: 'e5f6g7h8', prevHash: 'a1b2c3d4' },
  { id: 'ae-003', timestamp: '2026-03-20T10:00:00Z', actor: 'somchai@tte.co.th', action: 'UPLOAD', entityType: 'ARTIFACT', entityId: 'ev-001', payloadHash: 'ph-i9j0k1l2', entryHash: 'i9j0k1l2', prevHash: 'e5f6g7h8' },
  { id: 'ae-004', timestamp: '2026-03-20T10:05:00Z', actor: 'system', action: 'VERIFY', entityType: 'ARTIFACT', entityId: 'ev-001', payloadHash: 'ph-m3n4o5p6', entryHash: 'm3n4o5p6', prevHash: 'i9j0k1l2' },
  { id: 'ae-005', timestamp: '2026-03-20T14:30:00Z', actor: 'prasit@logistics.co.th', action: 'SIGN', entityType: 'CHECKPOINT', entityId: 'cp-002', payloadHash: 'ph-q7r8s9t0', entryHash: 'q7r8s9t0', prevHash: 'm3n4o5p6' },
];

// ── Dashboard KPIs ──

export const MOCK_DASHBOARD_KPIS = {
  activeLanes: 12,
  avgCompleteness: 78,
  readyToShip: 4,
  alerts: 3,
  alertDetails: '2 excursions, 1 missing doc',
} as const;

// ── Analytics KPIs ──

export const MOCK_ANALYTICS_KPIS = {
  totalLanes: 156,
  rejectionRate: 2.3,
  avgCompleteness: 87,
  avgReadinessTime: 4.2,
  buyerQueryRate: 8,
  coldChainSlaPass: 94,
} as const;

// ── Navigation Items ──

export const APP_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', iconName: 'LayoutDashboard' as const },
  { label: 'Lanes', href: '/lanes', iconName: 'Package' as const },
  { label: 'Analytics', href: '/analytics', iconName: 'BarChart3' as const },
  { label: 'Settings', href: '/settings', iconName: 'Settings' as const },
] as const;

export const ADMIN_NAV_ITEMS = [
  { label: 'Rules Engine', href: '/admin/rules', iconName: 'ListChecks' as const },
  { label: 'Partner Portal', href: '/partner', iconName: 'Users' as const },
] as const;
