import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { LaneCreationScenario } from '../../src/lib/testing/lane-creation-scenarios';
import { MARKET_LABELS, PRODUCT_LABELS } from '../../src/lib/types';

const EXPORTER_EMAIL =
  process.env['PLAYWRIGHT_EXPORTER_EMAIL']?.trim() || 'exporter@zrl-dev.test';
const EXPORTER_PASSWORD =
  process.env['PLAYWRIGHT_EXPORTER_PASSWORD']?.trim() || 'ZrlDev2026!';

export async function loginAsExporter(page: Page): Promise<void> {
  await page.goto('/login');

  await page.locator('input#email').fill(EXPORTER_EMAIL);
  await page.locator('input#password').fill(EXPORTER_PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function completeLaneWizardToReview(
  page: Page,
  scenario: LaneCreationScenario,
): Promise<void> {
  await page.goto('/lanes/new');

  await page.getByTestId(`product-card-${scenario.product}`).click();
  await page.getByLabel('Variety').fill(scenario.variety);
  await page.getByLabel('Quantity').fill(scenario.quantityKg);
  await page.getByLabel('Harvest Date').fill(scenario.harvestDate);
  await page.getByLabel('Origin Province').fill(scenario.originProvince);
  await page.getByRole('button', { name: /next: destination/i }).click();
  await page.getByTestId(`market-card-${scenario.market}`).click();
  await page.getByRole('button', { name: /next: route/i }).click();
  await page.getByRole('button', { name: scenario.transportMode }).click();
  await page.getByRole('button', { name: scenario.coldChainMode }).click();
  await page.getByLabel('Carrier').fill(scenario.carrier);
  if (scenario.deviceId) {
    await page.getByLabel('Device ID').fill(scenario.deviceId);
  }
  if (scenario.dataFrequencySeconds) {
    await page
      .getByLabel('Data Frequency (seconds)')
      .fill(scenario.dataFrequencySeconds);
  }
  await page.getByRole('button', { name: /next: review/i }).click();
}

export async function assertLaneReviewStep(
  page: Page,
  scenario: LaneCreationScenario,
): Promise<void> {
  await expect(page.getByText('Review & Create')).toBeVisible();
  await expect(page.getByTestId('lane-review-field-product')).toContainText(
    PRODUCT_LABELS[scenario.product],
  );
  await expect(page.getByTestId('lane-review-field-destination')).toContainText(
    MARKET_LABELS[scenario.market],
  );
  await expect(page.getByTestId('lane-review-field-variety')).toHaveText(
    scenario.variety,
  );
  await expect(page.getByTestId('lane-review-field-quantity')).toHaveText(
    `${scenario.quantityKg} kg`,
  );
  await expect(
    page.getByTestId('lane-review-field-origin-province'),
  ).toHaveText(scenario.originProvince);
  await expect(page.getByTestId('lane-review-field-transport-mode')).toHaveText(
    scenario.transportMode,
  );
  await expect(page.getByTestId('lane-review-field-carrier')).toHaveText(
    scenario.carrier,
  );
  await expect(
    page.getByTestId('lane-review-field-cold-chain-mode'),
  ).toHaveText(scenario.coldChainMode);
  if (scenario.deviceId) {
    await expect(page.getByTestId('lane-review-field-device-id')).toHaveText(
      scenario.deviceId,
    );
  }
  if (scenario.dataFrequencySeconds) {
    await expect(
      page.getByTestId('lane-review-field-data-frequency-seconds'),
    ).toHaveText(`${scenario.dataFrequencySeconds} sec`);
  }
}

export async function submitLaneCreation(page: Page): Promise<string> {
  await page.getByRole('button', { name: /create lane/i }).click();
  await expect(page).not.toHaveURL(/\/lanes\/new$/);
  await expect(page).toHaveURL(/\/lanes\/[^/]+$/);

  const laneId = new URL(page.url()).pathname.split('/').at(-1);
  if (!laneId || laneId === 'new') {
    throw new Error('Lane ID was not present in the lane detail URL.');
  }

  return laneId;
}

export async function submitLaneCreationExpectError(
  page: Page,
  message: string,
): Promise<void> {
  await page.getByRole('button', { name: /create lane/i }).click();
  await expect(
    page.getByRole('main').getByRole('alert').first(),
  ).toContainText(message);
  await expect(page).toHaveURL(/\/lanes\/new$/);
}

export async function assertLaneDetailMatchesScenario(
  page: Page,
  scenario: LaneCreationScenario,
): Promise<void> {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(
        `${PRODUCT_LABELS[scenario.product]}.*${MARKET_LABELS[scenario.market]}`,
      ),
    ),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Evidence' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Proof Packs' })).toBeVisible();
}

export async function completeLaneCreationFlow(
  page: Page,
  scenario: LaneCreationScenario,
): Promise<string> {
  await loginAsExporter(page);
  await completeLaneWizardToReview(page, scenario);
  await assertLaneReviewStep(page, scenario);
  const laneId = await submitLaneCreation(page);
  await assertLaneDetailMatchesScenario(page, scenario);
  return laneId;
}
