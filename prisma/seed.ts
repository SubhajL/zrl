import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hash } from 'bcrypt';
import {
  computeHashChainEntry,
  getGenesisHash,
  hashUtf8String,
} from '../src/common/hashing/hashing.utils.js';

const databaseUrl = process.env['DATABASE_URL'] ?? '';
if (!databaseUrl.includes('localhost')) {
  throw new Error(
    'Seed only runs against localhost. Set DATABASE_URL to a local database.',
  );
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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

function buildJapanMangoRuleDefinition() {
  const effectiveDate = new Date('2026-03-01');

  return {
    market: 'JAPAN',
    product: 'MANGO',
    version: 1,
    effectiveDate,
    sourcePath: 'rules/japan/mango.yaml',
    substances: [
      {
        name: 'Chlorpyrifos',
        cas: '2921-88-2',
        thaiMrl: 0.5,
        destinationMrl: 0.01,
        stringencyRatio: 50,
        riskLevel: 'CRITICAL',
      },
      {
        name: 'Dithiocarbamates',
        cas: '111-54-6',
        thaiMrl: 2.0,
        destinationMrl: 0.1,
        stringencyRatio: 20,
        riskLevel: 'CRITICAL',
      },
      {
        name: 'Carbendazim',
        cas: '10605-21-7',
        thaiMrl: 5.0,
        destinationMrl: 0.5,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Cypermethrin',
        cas: '52315-07-8',
        thaiMrl: 2.0,
        destinationMrl: 0.2,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Profenofos',
        cas: '41198-08-7',
        thaiMrl: 0.5,
        destinationMrl: 0.05,
        stringencyRatio: 10,
        riskLevel: 'HIGH',
      },
      {
        name: 'Imidacloprid',
        cas: '138261-41-3',
        thaiMrl: 1.0,
        destinationMrl: 0.2,
        stringencyRatio: 5,
        riskLevel: 'HIGH',
      },
      {
        name: 'Metalaxyl',
        cas: '57837-19-1',
        thaiMrl: 1.0,
        destinationMrl: 0.2,
        stringencyRatio: 5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Difenoconazole',
        cas: '119446-68-3',
        thaiMrl: 0.5,
        destinationMrl: 0.1,
        stringencyRatio: 5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Thiabendazole',
        cas: '148-79-8',
        thaiMrl: 10.0,
        destinationMrl: 3.0,
        stringencyRatio: 3.3,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Prochloraz',
        cas: '67747-09-5',
        thaiMrl: 5.0,
        destinationMrl: 2.0,
        stringencyRatio: 2.5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Lambda-cyhalothrin',
        cas: '91465-08-6',
        thaiMrl: 0.5,
        destinationMrl: 0.2,
        stringencyRatio: 2.5,
        riskLevel: 'MEDIUM',
      },
      {
        name: 'Acetamiprid',
        cas: '135410-20-7',
        thaiMrl: 0.5,
        destinationMrl: 0.3,
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

function buildRulePayload(
  definition: ReturnType<typeof buildJapanMangoRuleDefinition>,
) {
  return {
    market: definition.market,
    product: definition.product,
    version: definition.version,
    sourcePath: definition.sourcePath,
    effectiveDate: definition.effectiveDate.toISOString().slice(0, 10),
    requiredDocuments: definition.requiredDocuments,
    completenessWeights: definition.completenessWeights,
    substances: definition.substances,
  };
}

async function seedRuleStore() {
  const definition = buildJapanMangoRuleDefinition();
  const payload = buildRulePayload(definition);

  const ruleSet = await prisma.ruleSet.upsert({
    where: {
      market_product: {
        market: definition.market,
        product: definition.product,
      },
    },
    update: {
      version: definition.version,
      effectiveDate: definition.effectiveDate,
      sourcePath: definition.sourcePath,
      rules: payload,
    },
    create: {
      market: definition.market,
      product: definition.product,
      version: definition.version,
      effectiveDate: definition.effectiveDate,
      sourcePath: definition.sourcePath,
      rules: payload,
    },
  });

  await prisma.ruleVersion.upsert({
    where: {
      ruleSetId_version: {
        ruleSetId: ruleSet.id,
        version: definition.version,
      },
    },
    update: {
      market: definition.market,
      product: definition.product,
      changesSummary: 'Initial rules import',
      rules: payload,
    },
    create: {
      ruleSetId: ruleSet.id,
      market: definition.market,
      product: definition.product,
      version: definition.version,
      changesSummary: 'Initial rules import',
      rules: payload,
    },
  });

  for (const substance of definition.substances) {
    await prisma.substance.upsert({
      where: {
        market_name: {
          market: definition.market,
          name: substance.name,
        },
      },
      update: {
        cas: substance.cas,
        thaiMrl: substance.thaiMrl,
        destinationMrl: substance.destinationMrl,
        stringencyRatio: substance.stringencyRatio,
        riskLevel: substance.riskLevel,
      },
      create: {
        market: definition.market,
        name: substance.name,
        cas: substance.cas,
        thaiMrl: substance.thaiMrl,
        destinationMrl: substance.destinationMrl,
        stringencyRatio: substance.stringencyRatio,
        riskLevel: substance.riskLevel,
      },
    });
  }

  return definition;
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

  const ruleDefinition = buildJapanMangoRuleDefinition();
  const ruleSnapshot = buildRulePayload(ruleDefinition);
  await prisma.ruleSnapshot.create({
    data: {
      laneId: lane.id,
      market: ruleDefinition.market,
      product: ruleDefinition.product,
      version: ruleDefinition.version,
      rules: ruleSnapshot,
      effectiveDate: ruleDefinition.effectiveDate,
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
              signatureHash: hashUtf8String('checkpoint-1-signature'),
            }
          : {}),
      },
    });
  }

  return lane;
}

async function seedAuditChain(laneId: string, actor: string) {
  const genesisHash = getGenesisHash();
  const entry1PayloadHash = hashUtf8String('lane-created');
  const entry1Hash = computeHashChainEntry({
    timestamp: '2026-03-16T07:00:00.000Z',
    actor,
    action: 'CREATE',
    entityType: 'LANE',
    entityId: laneId,
    payloadHash: entry1PayloadHash,
    prevHash: genesisHash,
  });

  await prisma.auditEntry.create({
    data: {
      timestamp: new Date('2026-03-16T07:00:00Z'),
      actor,
      action: 'CREATE',
      entityType: 'LANE',
      entityId: laneId,
      payloadHash: entry1PayloadHash,
      prevHash: genesisHash,
      entryHash: entry1Hash,
    },
  });

  const entry2PayloadHash = hashUtf8String('checkpoint-signed');
  const entry2Hash = computeHashChainEntry({
    timestamp: '2026-03-16T08:00:00.000Z',
    actor,
    action: 'SIGN',
    entityType: 'CHECKPOINT',
    entityId: laneId,
    payloadHash: entry2PayloadHash,
    prevHash: entry1Hash,
  });

  await prisma.auditEntry.create({
    data: {
      timestamp: new Date('2026-03-16T08:00:00Z'),
      actor,
      action: 'SIGN',
      entityType: 'CHECKPOINT',
      entityId: laneId,
      payloadHash: entry2PayloadHash,
      prevHash: entry1Hash,
      entryHash: entry2Hash,
    },
  });
}

async function main() {
  console.log('Seeding ZRL database...');

  const users = await seedUsers();
  console.log(`  ✓ Created ${Object.keys(users).length} users`);

  const definition = await seedRuleStore();
  console.log(
    `  ✓ Seeded rules store: ${definition.market} ${definition.product} v${definition.version}`,
  );

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
