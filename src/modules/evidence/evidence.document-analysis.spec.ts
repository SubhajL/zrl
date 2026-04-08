import { TesseractEvidenceDocumentAnalysisProvider } from './evidence.document-analysis';

describe('TesseractEvidenceDocumentAnalysisProvider', () => {
  it('reports availability when the tesseract binary can be resolved', async () => {
    const provider = new TesseractEvidenceDocumentAnalysisProvider({
      resolveBinary: jest
        .fn()
        .mockImplementation((binary: string) =>
          Promise.resolve(
            binary === 'tesseract' ? '/opt/homebrew/bin/tesseract' : null,
          ),
        ),
      executeCommand: jest.fn(),
    });

    await expect(provider.getAvailability()).resolves.toEqual({
      available: true,
      engine: 'tesseract',
      binaryPath: '/opt/homebrew/bin/tesseract',
      preprocessingAvailable: false,
      preprocessingEngine: 'ocrmypdf',
      preprocessingBinaryPath: null,
    });
  });

  it('extracts text through tesseract with explicit language selection', async () => {
    const executeCommand = jest.fn().mockResolvedValue({
      stdout: 'Phytosanitary Certificate\nCertificate No. PC-2026-0001\n',
      stderr: '',
    });
    const provider = new TesseractEvidenceDocumentAnalysisProvider({
      resolveBinary: jest
        .fn()
        .mockImplementation((binary: string) =>
          Promise.resolve(
            binary === 'tesseract' ? '/usr/local/bin/tesseract' : null,
          ),
        ),
      executeCommand,
    });

    const result = await provider.extractText('/tmp/phyto.pdf', {
      languages: ['eng', 'tha'],
    });

    expect(executeCommand).toHaveBeenCalledWith('/usr/local/bin/tesseract', [
      '/tmp/phyto.pdf',
      'stdout',
      '-l',
      'eng+tha',
      '--psm',
      '6',
    ]);
    expect(result).toEqual({
      engine: 'tesseract',
      text: 'Phytosanitary Certificate\nCertificate No. PC-2026-0001',
      preprocessingApplied: false,
    });
  });

  it('fails cleanly when the tesseract binary is unavailable', async () => {
    const provider = new TesseractEvidenceDocumentAnalysisProvider({
      resolveBinary: jest.fn().mockResolvedValue(null),
      executeCommand: jest.fn(),
    });

    await expect(provider.extractText('/tmp/phyto.pdf')).rejects.toThrow(
      'Tesseract OCR is not available.',
    );
  });
});
