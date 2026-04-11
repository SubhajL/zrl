import { expect, test } from './fixtures';
import {
  completeLaneCreationFlow,
  loginAsExporter,
} from './helpers/lane-wizard';
import type { AuthenticatedBackendHelper } from './helpers/backend';
import { renderOcrSvgFixtureToPng } from './helpers/ocr-assets';
import {
  OCR_BROWSER_READINESS_SLOTS,
  OCR_BROWSER_REQUIRED_SLOT_COUNT,
} from '../src/lib/testing/ocr-browser-readiness-slots';

type BrowserOcrScenario = {
  readonly name: string;
  readonly laneScenario: (typeof OCR_BROWSER_READINESS_SLOTS)[number]['laneScenario'];
  readonly artifactType: (typeof OCR_BROWSER_READINESS_SLOTS)[number]['artifactType'];
  readonly fixturePath: string;
  readonly uploadFileName: string;
  readonly expectedDocumentLabel: string;
  readonly expectedPresentFieldKeys: readonly string[];
};

const OCR_BROWSER_SCENARIOS: readonly BrowserOcrScenario[] =
  OCR_BROWSER_READINESS_SLOTS.map((slot) => ({
    name: `${slot.combo.toLowerCase().replace('/', '-')}-${slot.documentLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}`,
    laneScenario: slot.laneScenario,
    artifactType: slot.artifactType,
    fixturePath: slot.fixturePath,
    uploadFileName: slot.uploadFileName,
    expectedDocumentLabel: slot.documentLabel,
    expectedPresentFieldKeys: slot.expectedPresentFieldKeys,
  }));

test('browser OCR matrix enumerates every fixture-backed required slot', () => {
  expect(OCR_BROWSER_SCENARIOS).toHaveLength(OCR_BROWSER_REQUIRED_SLOT_COUNT);
  expect(OCR_BROWSER_REQUIRED_SLOT_COUNT).toBeGreaterThan(0);
});

for (const scenario of OCR_BROWSER_SCENARIOS) {
  test(`browser OCR matrix proof for ${scenario.name}`, async ({
    page,
    backendHelper,
  }) => {
    await loginAsExporter(page);
    const laneId = await completeLaneCreationFlow(page, scenario.laneScenario);

    await page.getByRole('tab', { name: 'Evidence' }).click();

    const fileInput = page.locator(
      `input[data-artifact-type="${scenario.artifactType}"]`,
    );
    await expect(fileInput).toHaveCount(1);

    const fileName = `${Date.now()}-${scenario.uploadFileName.replace(/\.svg$/, '.png')}`;
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'image/png',
      buffer: await renderOcrSvgFixtureToPng(page, scenario.fixturePath),
    });

    const analysis = await waitForArtifactAnalysisFromUi(
      page,
      laneId,
      fileName,
      backendHelper,
    );

    expect(analysis.documentLabel).toBe(scenario.expectedDocumentLabel);
    expect(analysis.fieldCompleteness.supported).toBe(true);
    expect(analysis.fieldCompleteness.presentFieldKeys).toEqual(
      expect.arrayContaining([...scenario.expectedPresentFieldKeys]),
    );

    await expect(
      page.getByRole('tabpanel', { name: 'Evidence' }).getByText(fileName),
    ).toBeVisible();
    await expect(
      page
        .getByRole('tabpanel', { name: 'Evidence' })
        .getByText(
          `Matched ${scenario.expectedDocumentLabel} using matrix-driven rules.`,
        ),
    ).toBeVisible();
  });
}

async function waitForArtifactAnalysisFromUi(
  page: import('@playwright/test').Page,
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
