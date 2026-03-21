import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import { hash } from 'bcrypt';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
if (!databaseUrl.includes('localhost')) {
  throw new Error(
    'Seed only runs against localhost. Set DATABASE_URL to a local database.',
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function seedUsers() {
  const passwordHash = await hash('ZrlDev2026!', 10);

  const exporter = await prisma.user.upsert({
    where: { email: 'exporter@zrl-dev.test' },
    update: {},
    create: {
      email: 'exporter@zrl-dev.test',
      passwordHash,
      role: 'EXPORTER',
      companyName: 'Chachoengsao Mango Export Co.',
      mfaEnabled: false,
    },
  });

  const partner = await prisma.user.upsert({
    where: { email: 'lab@centrallabthai.test' },
    update: {},
    create: {
      email: 'lab@centrallabthai.test',
      passwordHash,
      role: 'PARTNER',
      companyName: 'Central Lab Thai',
      mfaEnabled: false,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@zrl.test' },
    update: {},
    create: {
      email: 'admin@zrl.test',
      passwordHash,
      role: 'ADMIN',
      companyName: 'ZRL Platform',
      mfaEnabled: true,
      totpSecret: 'JBSWY3DPEHPK3PXP', // test-only TOTP secret
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: 'auditor@acfs.test' },
    update: {},
    create: {
      email: 'auditor@acfs.test',
      passwordHash,
      role: 'AUDITOR',
      companyName: 'ACFS Thailand',
      mfaEnabled: true,
      totpSecret: 'JBSWY3DPEHPK3PXQ', // test-only TOTP secret
    },
  });

  return { exporter, partner, admin, auditor };
}

function buildJapanMangoRuleSnapshot() {
  return {
    market: 'JAPAN',
    product: 'MANGO',
    version: 1,
    substances: [
      {
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        japanMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
      },
      {
        name: 'Dithiocarbamates',
        cas: '111-54-6',
        thaiMrl: 2.0,
        japanMrl: 0.1,
        stringencyRatio: 20,
        riskLevel: 'CRITICAL',
      },
      {
        name: 'Carbendazim',
        cas: '10605-21-7',
        thaiMrl: 5.0,
        japanMrl: 0.5,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Cypermethrin',
        cas: '52315-07-8',
        thaiMrl: 2.0,
        japanMrl: 0.2,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Profenofos',
        cas: '41198-08-7',
        thaiMrl: 0.5,
        japanMrl: 0.05,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Imidacloprid',
        cas: '138261-41-3',
        thaiMrl: 1.0,
        japanMrl: 0.2,
        stringencyRatio: 5,
        riskLevel: 'HIGH',
      },
      {
        name: 'Metalaxyl',
        cas: '57837-19-1',
        thaiMrl: 1.0,
        japanMrl: 0.2,
        stringencyRatio: 5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Difenoconazole',
        cas: '119446-68-3',
        thaiMrl: 0.5,
        japanMrl: 0.1,
        stringencyRatio: 5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Thiabendazole',
        cas: '148-79-8',
        thaiMrl: 10.0,
        japanMrl: 3.0,
        stringencyRatio: 3.3,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Prochloraz',
        cas: '67747-09-5',
        thaiMrl: 5.0,
        japanMrl: 2.0,
        stringencyRatio: 2.5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Lambda-cyhalothrin',
        cas: '91465-08-6',
        thaiMrl: 0.5,
        japanMrl: 0.2,
        stringencyRatio: 2.5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Acetamiprid',
        cas: '135410-20-7',
        thaiMrl: 0.5,
        japanMrl: 0.3,
        stringencyRatio: 1.7,
        riskLevel: 'LOW',
      },
    ],
    requiredDocuments: [
      'Phytosanitary Certificate',
      'VHT Certificate',
      'MRL Test Results',
      'Export License',
      'Commercial Invoice',
      'Grading Report',
      'Product Photos',
      'GAP Certificate',
      'Packing List',
      'Temperature Log',
      'SLA Summary',
      'Excursion Report',
      'Handoff Signatures',
      'Transport Document',
      'Delivery Note',
    ],
    completenessWeights: {
      regulatory: 0.4,
      quality: 0.25,
      coldChain: 0.2,
      chainOfCustody: 0.15,
    },
  };
}

async function seedSampleLane(exporterId: string) {
  const lane = await prisma.lane.create({
    data: {
      laneId: 'LN-2026-001',
      exporterId,
      status: 'EVIDENCE_COLLECTING',
      productType: 'MANGO',
      destinationMarket: 'JAPAN',
      completenessScore: 0,
      coldChainMode: 'LOGGER',
    },
  });

  await prisma.batch.create({
    data: {
      laneId: lane.id,
      batchId: 'MNG-JPN-20260315-001',
      product: 'MANGO',
      variety: 'Nam Doc Mai',
      quantityKg: 5000,
      originProvince: 'Chachoengsao',
      harvestDate: new Date('2026-03-15'),
      grade: 'A',
    },
  });

  await prisma.route.create({
    data: {
      laneId: lane.id,
      transportMode: 'AIR',
      carrier: 'Thai Airways Cargo',
      originGps: { lat: 13.6904, lng: 101.0779 },
      destinationGps: { lat: 35.772, lng: 140.3929 },
      estimatedTransitHours: 8,
    },
  });

  const ruleSnapshot = buildJapanMangoRuleSnapshot();
  await prisma.ruleSnapshot.create({
    data: {
      laneId: lane.id,
      market: 'JAPAN',
      product: 'MANGO',
      version: 1,
      rules: ruleSnapshot,
      effectiveDate: new Date('2026-03-01'),
    },
  });

  const checkpointNames = [
    'Packing House (Chachoengsao)',
    'Truck → Suvarnabhumi Airport',
    'Suvarnabhumi Cargo Terminal',
    'Narita Airport Arrival',
  ];

  for (let i = 0; i < checkpointNames.length; i++) {
    await prisma.checkpoint.create({
      data: {
        laneId: lane.id,
        sequence: i + 1,
        locationName: checkpointNames[i],
        status: i === 0 ? 'COMPLETED' : 'PENDING',
        ...(i === 0
          ? {
              gpsLat: 13.6904,
              gpsLng: 101.0779,
              timestamp: new Date('2026-03-16T08:00:00Z'),
              temperature: 12.5,
              signerName: 'Somchai K.',
              signatureHash: sha256Hex('checkpoint-1-signature'),
            }
          : {}),
      },
    });
  }

  return lane;
}

async function seedAuditChain(laneId: string, actor: string) {
  const genesisHash = sha256Hex('ZRL_GENESIS_HASH_V1');

  const entry1Hash = sha256Hex(
    `2026-03-16T07:00:00.000Z${actor}CREATELANE${laneId}${sha256Hex('lane-created')}${genesisHash}`,
  );

  await prisma.auditEntry.create({
    data: {
      timestamp: new Date('2026-03-16T07:00:00Z'),
      actor,
      action: 'CREATE',
      entityType: 'LANE',
      entityId: laneId,
      payloadHash: sha256Hex('lane-created'),
      prevHash: genesisHash,
      entryHash: entry1Hash,
    },
  });

  const entry2Hash = sha256Hex(
    `2026-03-16T08:00:00.000Z${actor}SIGNCHECKPOINT${laneId}${sha256Hex('checkpoint-signed')}${entry1Hash}`,
  );

  await prisma.auditEntry.create({
    data: {
      timestamp: new Date('2026-03-16T08:00:00Z'),
      actor,
      action: 'SIGN',
      entityType: 'CHECKPOINT',
      entityId: laneId,
      payloadHash: sha256Hex('checkpoint-signed'),
      prevHash: entry1Hash,
      entryHash: entry2Hash,
    },
  });
}

async function main() {
  console.log('Seeding ZRL database...');

  const users = await seedUsers();
  console.log(`  ✓ Created ${Object.keys(users).length} users`);

  const lane = await seedSampleLane(users.exporter.id);
  console.log(`  ✓ Created sample lane: ${lane.laneId}`);

  await seedAuditChain(lane.id, users.exporter.id);
  console.log('  ✓ Created audit chain (2 entries)');

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
