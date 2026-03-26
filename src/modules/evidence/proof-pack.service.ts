import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import Handlebars from 'handlebars';
import { AuditService } from '../../common/audit/audit.service';
import { AuditAction, AuditEntityType } from '../../common/audit/audit.types';
import { HashingService } from '../../common/hashing/hashing.service';
import {
  PROOF_PACK_STORE,
  type ProofPackGenerationInput,
  type ProofPackRecord,
  type ProofPackStore,
  type ProofPackTemplateData,
  type ProofPackType,
} from './proof-pack.types';

@Injectable()
export class ProofPackService {
  private readonly logger = new Logger(ProofPackService.name);
  private readonly templatesDir: string;

  constructor(
    @Inject(PROOF_PACK_STORE)
    private readonly store: ProofPackStore,
    private readonly hashingService: HashingService,
    private readonly auditService: AuditService,
  ) {
    this.templatesDir = resolve(process.cwd(), 'templates');
  }

  async generatePack(
    input: ProofPackGenerationInput,
    templateData: ProofPackTemplateData,
  ): Promise<ProofPackRecord> {
    const version =
      (await this.store.getLatestVersion(input.laneId, input.packType)) + 1;

    // C2 fix: Two-pass rendering — first pass generates PDF to get hash,
    // second pass re-renders with actual hash in QR code
    const firstPassHtml = this.renderTemplate(input.packType, templateData);
    const firstPassPdf = await this.htmlToPdf(firstPassHtml);
    const contentHash = this.hashingService.hashBuffer(firstPassPdf);

    // Re-render with actual hash embedded in template data
    const finalTemplateData: ProofPackTemplateData = {
      ...templateData,
      contentHash,
    };
    const finalHtml = this.renderTemplate(input.packType, finalTemplateData);
    const pdfBuffer = await this.htmlToPdf(finalHtml);

    const filePath = `packs/${input.laneId}/${input.packType}-v${version}.pdf`;

    const absolutePath = resolve(process.cwd(), filePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, pdfBuffer);

    const generatedAt = new Date();

    const record = await this.store.createPack({
      laneId: input.laneId,
      packType: input.packType,
      version,
      contentHash,
      filePath,
      generatedAt,
      generatedBy: input.generatedBy,
      recipient: null,
    });

    const payloadHash = await this.hashingService.hashString(
      JSON.stringify({
        packId: record.id,
        laneId: record.laneId,
        packType: record.packType,
        version: record.version,
        contentHash: record.contentHash,
      }),
    );

    await this.auditService.createEntry({
      actor: input.generatedBy,
      action: AuditAction.GENERATE,
      entityType: AuditEntityType.PROOF_PACK,
      entityId: record.id,
      payloadHash,
    });

    this.logger.log(
      `Generated ${input.packType} pack v${version} for lane ${input.laneId}`,
    );

    return record;
  }

  async listPacks(laneId: string): Promise<ProofPackRecord[]> {
    return await this.store.findPacksForLane(laneId);
  }

  renderTemplate(packType: ProofPackType, data: ProofPackTemplateData): string {
    const templateFileName = `${packType.toLowerCase()}.hbs`;
    const templatePath = join(this.templatesDir, templateFileName);
    const templateSource = readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);
    return template(data);
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
