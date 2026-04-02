import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { writeFile, rm } from 'node:fs/promises';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import Handlebars from 'handlebars';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import QRCode from 'qrcode';
import type { Readable } from 'node:stream';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import { NotificationService } from '../notifications/notification.service';
import { LANE_RECONCILER } from '../lane/lane.constants';
import type { LaneReconciler } from '../lane/lane.types';
import { EVIDENCE_OBJECT_STORE } from './evidence.constants';
import type { EvidenceObjectStore } from './evidence.types';
import {
  PROOF_PACK_STORE,
  type ClaimedProofPackJob,
  type ProofPackGenerationInput,
  type ProofPackRecord,
  type ProofPackStore,
  type ProofPackTemplateData,
  type ProofPackType,
  type ProofPackVerificationResult,
} from './proof-pack.types';

@Injectable()
export class ProofPackService {
  private readonly logger = new Logger(ProofPackService.name);
  private readonly templatesDir: string;
  private readonly handlebars = Handlebars.create();
  private readonly templateCache = new Map<
    string,
    Handlebars.TemplateDelegate<ProofPackTemplateData>
  >();

  constructor(
    @Inject(PROOF_PACK_STORE)
    private readonly store: ProofPackStore,
    @Inject(EVIDENCE_OBJECT_STORE)
    private readonly objectStore: EvidenceObjectStore,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
    private readonly notificationService?: NotificationService,
    @Optional()
    @Inject(LANE_RECONCILER)
    private readonly laneReconciler?: LaneReconciler,
  ) {
    this.templatesDir = resolve(process.cwd(), 'templates');
    this.registerTemplateHelpers();
  }

  async generatePack(
    input: ProofPackGenerationInput,
    templateData: ProofPackTemplateData,
  ): Promise<ProofPackRecord> {
    const version =
      (await this.store.getLatestVersion(input.laneId, input.packType)) + 1;
    const generatedAt = new Date();

    return await this.store.enqueuePack(
      {
        laneId: input.laneId,
        packType: input.packType,
        version,
        status: 'GENERATING',
        contentHash: null,
        filePath: null,
        errorMessage: null,
        generatedAt,
        generatedBy: input.generatedBy,
        recipient: null,
      },
      templateData,
      generatedAt,
    );
  }

  async completeLeasedJob(
    claimedJob: ClaimedProofPackJob,
    getLeaseExpiresAt: () => Date = () =>
      this.requireLeaseExpiresAt(claimedJob),
  ): Promise<void> {
    const verificationReference = this.buildVerificationReference(
      claimedJob.job.payload.laneId,
      claimedJob.pack.packType,
      claimedJob.pack.version,
    );
    const qrCodeDataUrl = await QRCode.toDataURL(verificationReference);
    const finalTemplateData: ProofPackTemplateData = {
      ...claimedJob.job.payload,
      qrCodeDataUrl,
      verificationReference,
    };
    const html = this.renderTemplate(
      claimedJob.pack.packType,
      finalTemplateData,
    );
    const pdfBuffer = await this.htmlToPdf(html);
    const contentHash = this.hashingService.hashBuffer(pdfBuffer);
    const filePath = `packs/${claimedJob.pack.laneId}/${claimedJob.pack.packType.toLowerCase()}-v${claimedJob.pack.version}.pdf`;
    const tempPath = join(tmpdir(), `zrl-pack-${randomUUID()}.pdf`);

    await writeFile(tempPath, pdfBuffer);
    try {
      await this.objectStore.putObjectFromFile({
        key: filePath,
        filePath: tempPath,
        contentType: 'application/pdf',
      });
    } finally {
      await rm(tempPath, { force: true }).catch(() => {});
    }

    const readyPack = await this.store.completePackJob(
      claimedJob.job.id,
      getLeaseExpiresAt(),
      new Date(),
      { contentHash, filePath },
    );
    if (readyPack === null) {
      throw new ConflictException('Proof pack job lease is no longer active.');
    }

    await this.appendPackAuditSafely(
      claimedJob.pack.generatedBy,
      AuditAction.GENERATE,
      readyPack,
    );
    await this.notificationService?.notifyLaneOwner(claimedJob.pack.laneId, {
      type: 'PACK_GENERATED',
      title: 'Proof pack ready',
      message: `${claimedJob.pack.packType} proof pack v${claimedJob.pack.version} is ready for download.`,
      data: {
        packId: readyPack.id,
        packType: readyPack.packType,
        version: readyPack.version,
      },
    });
    await this.reconcileLanePackingSafely(
      readyPack.laneId,
      claimedJob.pack.generatedBy,
    );
    this.logger.log(
      `Generated ${claimedJob.pack.packType} pack v${claimedJob.pack.version} for lane ${claimedJob.pack.laneId}`,
    );
  }

  async failLeasedJob(
    claimedJob: ClaimedProofPackJob,
    error: unknown,
    expectedLeaseExpiresAt: Date = this.requireLeaseExpiresAt(claimedJob),
  ): Promise<void> {
    const lastError = this.normalizeErrorMessage(error);
    const failedPack = await this.store.failPackJob(
      claimedJob.job.id,
      expectedLeaseExpiresAt,
      new Date(),
      this.buildFinalFailureMessage(claimedJob.job.attemptCount, lastError),
      lastError,
    );
    if (failedPack === null) {
      throw new ConflictException('Proof pack job lease is no longer active.');
    }

    await this.appendPackAuditSafely(
      claimedJob.pack.generatedBy,
      AuditAction.UPDATE,
      failedPack,
    );
  }

  async listPacks(laneId: string): Promise<ProofPackRecord[]> {
    return await this.store.findPacksForLane(laneId);
  }

  async getPackById(id: string): Promise<ProofPackRecord> {
    return await this.requirePack(id);
  }

  async verifyPack(id: string): Promise<ProofPackVerificationResult> {
    const pack = await this.requirePack(id);
    this.assertPackReady(pack);
    const stream = await this.objectStore.createReadStream(pack.filePath);
    const computedHash = await this.hashingService.hashFile(stream);

    return {
      valid: computedHash === pack.contentHash,
      hash: pack.contentHash,
      laneId: pack.laneId,
      generatedAt: pack.generatedAt.toISOString(),
      packType: pack.packType,
    };
  }

  async getPackDownload(
    id: string,
  ): Promise<{ pack: ProofPackRecord; stream: Readable }> {
    const pack = await this.requirePack(id);
    this.assertPackReady(pack);
    const stream = await this.objectStore.createReadStream(pack.filePath);

    return { pack, stream };
  }

  renderTemplate(packType: ProofPackType, data: ProofPackTemplateData): string {
    const templateFileName = `${packType.toLowerCase()}.hbs`;

    let template = this.templateCache.get(templateFileName);
    if (template === undefined) {
      const templatePath = join(this.templatesDir, templateFileName);
      const templateSource = readFileSync(templatePath, 'utf-8');
      template = this.handlebars.compile<ProofPackTemplateData>(templateSource);
      this.templateCache.set(templateFileName, template);
    }

    return template(data);
  }

  private registerTemplateHelpers(): void {
    this.handlebars.registerHelper('eq', (left: unknown, right: unknown) => {
      return left === right;
    });
  }

  private buildVerificationReference(
    publicLaneId: string,
    packType: ProofPackType,
    version: number,
  ): string {
    return `zrl:proof-pack:${publicLaneId}:${packType}:v${version}`;
  }

  private requireLeaseExpiresAt(claimedJob: ClaimedProofPackJob): Date {
    const leaseExpiresAt = claimedJob.job.leaseExpiresAt;
    if (leaseExpiresAt === null) {
      throw new ConflictException('Proof pack job lease is missing.');
    }

    return leaseExpiresAt;
  }

  private async reconcileLanePackingSafely(
    laneId: string,
    actorId: string,
  ): Promise<void> {
    if (this.laneReconciler === undefined) {
      return;
    }

    try {
      await this.laneReconciler.reconcileAfterEvidenceChange(laneId, actorId);
    } catch (error) {
      this.logger.warn(
        `Proof pack generated for lane ${laneId}, but automatic packing reconciliation failed: ${this.normalizeErrorMessage(error)}`,
      );
    }
  }

  private async requirePack(id: string): Promise<ProofPackRecord> {
    const pack = await this.store.findPackById(id);
    if (pack === null) {
      throw new NotFoundException('Proof pack not found.');
    }

    return pack;
  }

  private assertPackReady(
    pack: ProofPackRecord,
  ): asserts pack is ProofPackRecord & {
    status: 'READY';
    contentHash: string;
    filePath: string;
  } {
    if (pack.status === 'FAILED') {
      throw new ConflictException(
        pack.errorMessage ?? 'Proof pack generation failed.',
      );
    }

    if (
      pack.status !== 'READY' ||
      pack.contentHash === null ||
      pack.filePath === null
    ) {
      throw new ConflictException('Proof pack is still generating.');
    }
  }

  private async appendPackAudit(
    actorId: string,
    action: AuditAction,
    pack: ProofPackRecord,
  ): Promise<void> {
    const payloadSnapshot = {
      kind: 'proofPack',
      packType: pack.packType,
      version: pack.version,
      status: pack.status,
      contentHash: pack.contentHash,
      generatedAt: pack.generatedAt.toISOString(),
      errorMessage: pack.errorMessage,
    };
    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        packId: pack.id,
        laneId: pack.laneId,
        packType: pack.packType,
        version: pack.version,
        status: pack.status,
        contentHash: pack.contentHash,
      }),
    );

    await this.auditService.createEntry({
      actor: actorId,
      action,
      entityType: AuditEntityType.PROOF_PACK,
      entityId: pack.id,
      payloadHash,
      payloadSnapshot,
    });
  }

  private async appendPackAuditSafely(
    actorId: string,
    action: AuditAction,
    pack: ProofPackRecord,
  ): Promise<void> {
    try {
      await this.appendPackAudit(actorId, action, pack);
    } catch (error: unknown) {
      this.logger.error(
        `Proof pack audit append failed for pack ${pack.id}.`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildFinalFailureMessage(
    attemptCount: number,
    lastError: string,
  ): string {
    return `Proof pack generation failed after ${attemptCount} attempts. Last error: ${lastError}`;
  }

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length > 0) {
      return error.trim();
    }

    return 'Proof pack generation failed.';
  }

  private async htmlToPdf(html: string): Promise<Buffer> {
    try {
      const puppeteer = await import('puppeteer-core');
      const executablePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        process.env['PUPPETEER_EXECUTABLE_PATH'],
      ].filter((p): p is string => p !== undefined && p.length > 0);

      let browser: Awaited<ReturnType<typeof puppeteer.default.launch>> | null =
        null;

      for (const executablePath of executablePaths) {
        try {
          browser = await puppeteer.default.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          });
          break;
        } catch {
          continue;
        }
      }

      if (browser === null) {
        this.logger.warn(
          'No Chrome/Chromium browser found — returning HTML content as fallback PDF buffer.',
        );
        return Buffer.from(html, 'utf-8');
      }

      try {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfUint8 = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        });
        return Buffer.from(pdfUint8);
      } finally {
        await browser.close();
      }
    } catch {
      this.logger.warn(
        'Puppeteer unavailable — returning HTML content as fallback PDF buffer.',
      );
      return Buffer.from(html, 'utf-8');
    }
  }
}
