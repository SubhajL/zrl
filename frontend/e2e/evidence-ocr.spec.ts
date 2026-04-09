import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { loginAsExporter } from './helpers/lane-wizard';
import type { AuthenticatedBackendHelper } from './helpers/backend';
import { renderOcrSvgFixtureToPng } from './helpers/ocr-assets';

const SEEDED_LANE_ID = 'LN-2026-001';

test('evidence tab renders OCR field completeness after uploading a formal document', async ({
  page,
  backendHelper,
}) => {
  await loginAsExporter(page);
  const fileName = `phyto-certificate-${Date.now()}.png`;

  await page.goto(`/lanes/${encodeURIComponent(SEEDED_LANE_ID)}`);

  await page.getByRole('tab', { name: 'Evidence' }).click();

  const fileInput = page.locator('input[data-artifact-type="PHYTO_CERT"]');
  await expect(fileInput).toHaveCount(1);

  await fileInput.setInputFiles({
    name: fileName,
    mimeType: 'image/png',
    buffer: await renderOcrSvgFixtureToPng(
      page,
      'official/phytosanitary-certificate-japan-mango.svg',
    ),
  });

  const analysis = await waitForArtifactAnalysisFromUi(
    page,
    SEEDED_LANE_ID,
    fileName,
    backendHelper,
  );

  expect(analysis.fieldCompleteness.supported).toBe(true);
  expect(analysis.fieldCompleteness.presentFieldKeys).toEqual(
    expect.arrayContaining([
      'certificateNumber',
      'exporterName',
      'consigneeName',
      'placeOfOrigin',
      'meansOfConveyance',
      'botanicalName',
      'additionalDeclarations',
      'issueDate',
      'issuingAuthority',
      'mustStateFruitFlyFree',
      'treatmentReference',
    ]),
  );
  expect(analysis.fieldCompleteness.missingFieldKeys).toEqual(
    expect.arrayContaining(['declaredPointOfEntry', 'officialSealOrSignature']),
  );

  await page.reload();
  await page.getByRole('tab', { name: 'Evidence' }).click();

  await expect(page.getByText('Document analysis')).toBeVisible();
  await expect(
    page.getByRole('tabpanel', { name: 'Evidence' }).getByText(fileName),
  ).toBeVisible();
  await expect(
    page
      .getByRole('tabpanel', { name: 'Evidence' })
      .getByText(
        'Matched Phytosanitary Certificate using matrix-driven rules.',
      ),
  ).toBeVisible();
  await expect(
    page.getByText(
      `Present ${analysis.fieldCompleteness.presentFieldKeys.length}/${analysis.fieldCompleteness.expectedFieldKeys.length}`,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      `Missing: ${analysis.fieldCompleteness.missingFieldKeys.join(', ')}`,
    ),
  ).toBeVisible();
});

async function waitForArtifactAnalysisFromUi(
  page: Page,
  laneId: string,
  fileName: string,
  backendHelper: AuthenticatedBackendHelper,
) {
  await expect(page.getByText(fileName)).toBeVisible();

  const artifactId = await backendHelper.waitForArtifactIdByFileName(
    laneId,
    fileName,
  );
  return await backendHelper.waitForArtifactAnalysisReady(artifactId);
}
