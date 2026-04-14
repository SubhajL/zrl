import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OCR_BROWSER_READINESS_SLOTS } from '../../../frontend/src/lib/testing/ocr-browser-readiness-slots';
import { buildOcr34_10TraceabilityAudit } from './ocr-34-10-traceability-audit';

describe('OCR 34.10 traceability audit', () => {
  it('proves grading report traceability from research through readiness', async () => {
    const audit = await buildOcr34_10TraceabilityAudit();

    expect(audit.documentLabel).toBe('Grading Report');

    expect(audit.externalResearch.mentionsDocumentLabel).toBe(true);
    expect(audit.externalResearch.mentionsReconciliationLedger).toBe(true);

    expect(audit.reconciliation.identifiesStandaloneCandidate).toBe(true);
    expect(audit.reconciliation.mentionsDecisionLedger).toBe(true);

    expect(audit.decision.approvedCombos).toHaveLength(9);
    expect(audit.decision.approvedCombos).toEqual(
      expect.arrayContaining([
        'EU/MANGO',
        'EU/MANGOSTEEN',
        'EU/DURIAN',
        'JAPAN/MANGO',
        'JAPAN/MANGOSTEEN',
        'JAPAN/DURIAN',
        'KOREA/MANGO',
        'KOREA/MANGOSTEEN',
        'KOREA/DURIAN',
      ]),
    );

    expect(audit.matrix.artifactType).toBe('INVOICE');
    expect(audit.matrix.applicableCombos).toEqual(
      audit.decision.approvedCombos,
    );
    expect(audit.matrix.sourceUrls).toEqual(expect.any(Array));

    expect(audit.fixture.assetExists).toBe(true);
    expect(audit.fixture.applicableCombos).toEqual(
      audit.matrix.applicableCombos,
    );

    expect(audit.classifier.documentLabel).toBe('Grading Report');
    expect(audit.classifier.documentRole).toBe('QUALITY_GRADING_REPORT');
    expect(audit.classifier.supported).toBe(true);
    expect(audit.classifier.presentFieldKeys).toEqual(
      expect.arrayContaining([
        'gradingReportNumber',
        'inspectionDate',
        'exporterName',
        'commodityName',
        'lotOrConsignmentId',
        'gradeClass',
        'packhouseName',
        'inspectorName',
      ]),
    );

    expect(audit.readiness.totalSlots).toBe(9);
    expect(audit.readiness.readyCombos).toEqual(audit.matrix.applicableCombos);
  });

  it('keeps browser slot coverage in exact parity with audited grading combos', async () => {
    const audit = await buildOcr34_10TraceabilityAudit();

    const browserCombos = OCR_BROWSER_READINESS_SLOTS.filter(
      (slot) => slot.documentLabel === 'Grading Report',
    )
      .map((slot) => slot.combo)
      .sort();

    expect(browserCombos).toEqual(audit.matrix.applicableCombos);
  });

  it('has a final 34.10.8 audit doc that references the full traceability chain', async () => {
    const source = await readFile(
      resolve(process.cwd(), 'docs/OCR-34-10-8-TRACEABILITY-AUDIT.md'),
      'utf8',
    );

    expect(source).toContain('34.10.1');
    expect(source).toContain('34.10.2');
    expect(source).toContain('34.10.3');
    expect(source).toContain('34.10.4');
    expect(source).toContain('34.10.5');
    expect(source).toContain('34.10.6');
    expect(source).toContain('34.10.7');
    expect(source).toContain('34.10.8');
    expect(source).toContain('Grading Report');
  });
});
