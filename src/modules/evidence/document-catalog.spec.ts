import { loadDocumentCatalog } from './document-catalog';

describe('document catalog', () => {
  it('composes canonical entries from the matrix and fixture manifest', async () => {
    const catalog = await loadDocumentCatalog();

    expect(catalog.version).toBe(1);
    expect(catalog.entries).toHaveLength(catalog.entriesByLabel.size);

    const gradingReport = catalog.entriesByLabel.get('Grading Report');

    expect(gradingReport).toMatchObject({
      documentLabel: 'Grading Report',
      artifactType: 'INVOICE',
      checklistCategory: 'QUALITY',
      checklistMatchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
      matrixBacked: true,
      fixtureBacked: true,
    });
    expect(gradingReport?.documentRole).toBe('QUALITY_GRADING_REPORT');
    expect(gradingReport?.applicableCombos).toHaveLength(9);
    expect(gradingReport?.fixture?.assetPath).toContain(
      'grading-report-base.svg',
    );
  });

  it('enumerates fixture-backed required slots from the shared catalog', async () => {
    const catalog = await loadDocumentCatalog();
    const gradingSlots = catalog.fixtureBackedRequiredSlots.filter(
      (slot) => slot.documentLabel === 'Grading Report',
    );

    expect(catalog.fixtureBackedRequiredSlots).toHaveLength(
      catalog.supportedCombos.reduce(
        (total, combo) =>
          total +
          combo.requiredDocuments.filter(
            (documentLabel) =>
              catalog.entriesByLabel.get(documentLabel)?.fixtureBacked,
          ).length,
        0,
      ),
    );
    expect(gradingSlots).toHaveLength(9);
    expect(gradingSlots.map((slot) => slot.combo).sort()).toEqual(
      gradingReportCombos(catalog),
    );
  });

  it('captures checklist identity semantics for invoice-family and operational labels', async () => {
    const catalog = await loadDocumentCatalog();

    expect(catalog.entriesByLabel.get('Commercial Invoice')).toMatchObject({
      checklistCategory: 'CHAIN_OF_CUSTODY',
      checklistMatchMode: 'ARTIFACT_TYPE_WITH_FILE_NAME_FALLBACK',
      artifactType: 'INVOICE',
    });
    expect(catalog.entriesByLabel.get('Product Photos')).toMatchObject({
      checklistCategory: 'QUALITY',
      checklistMatchMode: 'ARTIFACT_TYPE_ONLY',
      artifactType: 'CHECKPOINT_PHOTO',
      matrixBacked: false,
      fixtureBacked: false,
    });
  });

  it('exposes variant-specific completeness for override-backed slots', async () => {
    const catalog = await loadDocumentCatalog();
    const japanMangoPhyto = catalog.fixtureBackedRequiredSlots.find(
      (slot) =>
        slot.combo === 'JAPAN/MANGO' &&
        slot.documentLabel === 'Phytosanitary Certificate',
    );

    expect(japanMangoPhyto?.hasVariantFixture).toBe(true);
    expect(japanMangoPhyto?.expectedPresentFieldKeys).toEqual(
      expect.arrayContaining([
        'certificateNumber',
        'declaredPointOfEntry',
        'officialSealOrSignature',
      ]),
    );
  });
});

function gradingReportCombos(
  catalog: Awaited<ReturnType<typeof loadDocumentCatalog>>,
): string[] {
  return [
    ...(catalog.entriesByLabel.get('Grading Report')?.applicableCombos ?? []),
  ].sort();
}
