import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request, { type Response as SupertestResponse } from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AuditService } from './../src/common/audit/audit.service';

describe('AuditController (e2e)', () => {
  let app: INestApplication<App>;
  const auditServiceMock = {
    createEntry: jest.fn().mockResolvedValue(undefined),
    getEntriesForLane: jest.fn().mockResolvedValue([
      {
        id: 'audit-1',
        actor: 'actor-1',
      },
    ]),
    verifyChainForLane: jest.fn().mockResolvedValue({
      valid: true,
      entriesChecked: 1,
    }),
    exportForLane: jest.fn().mockResolvedValue({
      laneId: 'lane-1',
      exportedAt: '2026-03-21T00:00:00.000Z',
      entriesCount: 1,
      entries: [
        {
          id: 'audit-1',
          timestamp: '2026-03-21T00:00:00.000Z',
          actor: 'system',
          action: 'VERIFY',
          entityType: 'LANE',
          entityId: 'lane-1',
          payloadHash:
            '1111111111111111111111111111111111111111111111111111111111111111',
          prevHash:
            '2222222222222222222222222222222222222222222222222222222222222222',
          entryHash:
            '3333333333333333333333333333333333333333333333333333333333333333',
        },
      ],
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuditService)
      .useValue(auditServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app !== undefined) {
      await app.close();
    }
  });

  it('GET /lanes/:id/audit returns entries', async () => {
    await request(app.getHttpServer())
      .get('/lanes/lane-1/audit')
      .expect(200)
      .expect({
        entries: [
          {
            id: 'audit-1',
            actor: 'actor-1',
          },
        ],
      });

    expect(auditServiceMock.getEntriesForLane).toHaveBeenCalledWith(
      'lane-1',
      {},
    );
  });

  it('POST /lanes/:id/audit/verify returns verification', async () => {
    await request(app.getHttpServer())
      .post('/lanes/lane-1/audit/verify')
      .expect(201)
      .expect({
        valid: true,
        entriesChecked: 1,
      });

    expect(auditServiceMock.verifyChainForLane).toHaveBeenCalledWith('lane-1');
  });

  it('GET /audit/export/:laneId returns export JSON', async () => {
    await request(app.getHttpServer())
      .get('/audit/export/lane-1')
      .expect(200)
      .expect('content-type', /application\/json/)
      .expect((response: SupertestResponse) => {
        const body = response.body as { entriesCount: number; laneId: string };

        expect(body.laneId).toBe('lane-1');
        expect(body.entriesCount).toBe(1);
      });

    expect(auditServiceMock.exportForLane).toHaveBeenCalledWith('lane-1');
  });
});
