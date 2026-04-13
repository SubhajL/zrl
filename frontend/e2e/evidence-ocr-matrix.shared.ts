import { expect, type Page } from '@playwright/test';
import type { AuthenticatedBackendHelper } from './helpers/backend';
import {
  completeLaneCreationFlow,
  loginAsExporter,
} from './helpers/lane-wizard';
import { renderOcrSvgFixtureToPng } from './helpers/ocr-assets';
import {
  OCR_BROWSER_READINESS_SLOTS,
  OCR_BROWSER_REQUIRED_SLOT_COUNT,
} from '../src/lib/testing/ocr-browser-readiness-slots';

export type BrowserOcrScenario = {
  readonly name: string;
  readonly laneScenario: (typeof OCR_BROWSER_READINESS_SLOTS)[number]['laneScenario'];
  readonly artifactType: (typeof OCR_BROWSER_READINESS_SLOTS)[number]['artifactType'];
  readonly fixturePath: string;
  readonly uploadFileName: string;
  readonly expectedDocumentLabel: string;
  readonly expectedPresentFieldKeys: readonly string[];
};

export const OCR_BROWSER_SCENARIOS: readonly BrowserOcrScenario[] =
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

export const OCR_BROWSER_SCENARIOS_BY_MARKET = {
  EU: OCR_BROWSER_SCENARIOS.filter((scenario) =>
    scenario.laneScenario.market.startsWith('EU'),
  ),
  JAPAN: OCR_BROWSER_SCENARIOS.filter((scenario) =>
    scenario.laneScenario.market.startsWith('JAPAN'),
  ),
  KOREA: OCR_BROWSER_SCENARIOS.filter((scenario) =>
    scenario.laneScenario.market.startsWith('KOREA'),
  ),
} as const;

export async function executeBrowserOcrScenario(
  page: Page,
  backendHelper: AuthenticatedBackendHelper,
  scenario: BrowserOcrScenario,
): Promise<void> {
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
}

export function assertFullBrowserOcrMatrixShape(): void {
  expect(OCR_BROWSER_SCENARIOS).toHaveLength(OCR_BROWSER_REQUIRED_SLOT_COUNT);
  expect(OCR_BROWSER_REQUIRED_SLOT_COUNT).toBe(75);
  expect(OCR_BROWSER_SCENARIOS_BY_MARKET.EU).toHaveLength(24);
  expect(OCR_BROWSER_SCENARIOS_BY_MARKET.JAPAN).toHaveLength(26);
  expect(OCR_BROWSER_SCENARIOS_BY_MARKET.KOREA).toHaveLength(25);
}

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
