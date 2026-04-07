import { access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { BadRequestException } from '@nestjs/common';
import type {
  EvidenceDocumentAnalysisAvailability,
  EvidenceDocumentAnalysisProvider,
  EvidenceDocumentTextExtractionOptions,
  EvidenceDocumentTextExtractionResult,
} from './evidence.types';

type ExecuteCommandResult = {
  stdout: string;
  stderr: string;
};

interface TesseractProviderDependencies {
  resolveBinary?: (binaryName: string) => Promise<string | null>;
  executeCommand?: (
    command: string,
    args: string[],
  ) => Promise<ExecuteCommandResult>;
}

async function resolveBinaryOnPath(binaryName: string): Promise<string | null> {
  const pathValue = process.env['PATH'] ?? '';
  for (const segment of pathValue.split(':')) {
    const directory = segment.trim();
    if (directory.length === 0) {
      continue;
    }
    const candidate = join(directory, binaryName);
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  return null;
}

function runCommand(
  command: string,
  args: string[],
): Promise<ExecuteCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const chunkText = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : String(chunk);
      stdout += chunkText;
    });
    child.stderr.on('data', (chunk) => {
      const chunkText = Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : String(chunk);
      stderr += chunkText;
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(
        new Error(
          `Command failed (${command} ${args.join(' ')}): ${stderr.trim() || `exit ${code}`}`,
        ),
      );
    });
  });
}

export class TesseractEvidenceDocumentAnalysisProvider implements EvidenceDocumentAnalysisProvider {
  constructor(
    private readonly dependencies: TesseractProviderDependencies = {},
  ) {}

  private async resolveBinary(binaryName: string): Promise<string | null> {
    return await (this.dependencies.resolveBinary ?? resolveBinaryOnPath)(
      binaryName,
    );
  }

  private async executeCommand(
    command: string,
    args: string[],
  ): Promise<ExecuteCommandResult> {
    return await (this.dependencies.executeCommand ?? runCommand)(
      command,
      args,
    );
  }

  async getAvailability(): Promise<EvidenceDocumentAnalysisAvailability> {
    const [tesseractPath, ocrmypdfPath] = await Promise.all([
      this.resolveBinary('tesseract'),
      this.resolveBinary('ocrmypdf'),
    ]);

    return {
      available: tesseractPath !== null,
      engine: 'tesseract',
      binaryPath: tesseractPath,
      preprocessingAvailable: ocrmypdfPath !== null,
      preprocessingEngine: 'ocrmypdf',
      preprocessingBinaryPath: ocrmypdfPath,
    };
  }

  async extractText(
    filePath: string,
    options: EvidenceDocumentTextExtractionOptions = {},
  ): Promise<EvidenceDocumentTextExtractionResult> {
    const availability = await this.getAvailability();
    if (availability.binaryPath === null) {
      throw new BadRequestException('Tesseract OCR is not available.');
    }

    const languages =
      options.languages !== undefined && options.languages.length > 0
        ? options.languages
        : ['eng'];
    const normalizedLanguages = [
      ...new Set(languages.map((value) => value.trim())),
    ]
      .filter((value) => value.length > 0)
      .join('+');

    let extractionInputPath = filePath;
    let preprocessingDirectory: string | null = null;

    if (
      availability.preprocessingBinaryPath !== null &&
      filePath.endsWith('.pdf')
    ) {
      preprocessingDirectory = await mkdtemp(
        join(tmpdir(), 'zrl-evidence-ocrmypdf-'),
      );
      const outputPath = join(preprocessingDirectory, basename(filePath));
      await this.executeCommand(availability.preprocessingBinaryPath, [
        '--skip-text',
        '--quiet',
        filePath,
        outputPath,
      ]);
      extractionInputPath = outputPath;
    }

    try {
      const result = await this.executeCommand(availability.binaryPath, [
        extractionInputPath,
        'stdout',
        '-l',
        normalizedLanguages,
        '--psm',
        '6',
      ]);

      return {
        engine: 'tesseract',
        text: result.stdout.trim(),
        preprocessingApplied: preprocessingDirectory !== null,
      };
    } finally {
      if (preprocessingDirectory !== null) {
        await rm(preprocessingDirectory, {
          recursive: true,
          force: true,
        }).catch(() => undefined);
      }
    }
  }
}
