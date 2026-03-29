import { test, expect } from './fixtures';

test('exporter can create a lane from the real UI', async ({ page }) => {
  await page.goto('/login');

  await page.locator('input#email').fill('exporter@zrl-dev.test');
  await page.locator('input#password').fill('ZrlDev2026!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/lanes/new');

  await page.getByTestId('product-card-MANGO').click();
  await page.getByLabel('Variety').fill('Nam Doc Mai');
  await page.getByLabel('Quantity').fill('5000');
  await page.getByLabel('Harvest Date').fill('2026-03-29');
  await page.getByLabel('Origin Province').fill('Chachoengsao');
  await page.getByRole('button', { name: /next: destination/i }).click();
  await page.getByTestId('market-card-JAPAN').click();
  await page.getByRole('button', { name: /next: route/i }).click();
  await page.getByRole('button', { name: /next: review/i }).click();
  await page.getByRole('button', { name: /create lane/i }).click();
  await expect(page).not.toHaveURL(/\/lanes\/new$/);
  await expect(page).toHaveURL(/\/lanes\/[^/]+$/);
});

test('critical exporter journey reaches ready proof-pack actions', async ({
  page,
  backendHelper,
}) => {
  await page.goto('/login');

  await page.locator('input#email').fill('exporter@zrl-dev.test');
  await page.locator('input#password').fill('ZrlDev2026!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/lanes/new');
  await page.getByTestId('product-card-MANGO').click();
  await page.getByLabel('Variety').fill('Nam Doc Mai');
  await page.getByLabel('Quantity').fill('5000');
  await page.getByLabel('Harvest Date').fill('2026-03-29');
  await page.getByLabel('Origin Province').fill('Chachoengsao');
  await page.getByRole('button', { name: /next: destination/i }).click();
  await page.getByTestId('market-card-JAPAN').click();
  await page.getByRole('button', { name: /next: route/i }).click();
  await page.getByRole('button', { name: /next: review/i }).click();
  await page.getByRole('button', { name: /create lane/i }).click();
  await expect(page).not.toHaveURL(/\/lanes\/new$/);
  await expect(page).toHaveURL(/\/lanes\/[^/]+$/);

  const laneId = new URL(page.url()).pathname.split('/').at(-1);
  if (!laneId || laneId === 'new') {
    throw new Error('Lane ID was not present in the lane detail URL.');
  }

  await backendHelper.seedRequiredEvidenceForLane(laneId);
  const readyPack = await backendHelper.generateAndWaitForReadyPack(
    laneId,
    'REGULATOR',
  );

  await page.reload();
  await page.getByRole('tab', { name: 'Proof Packs' }).click();

  await expect(
    page.getByRole('link', { name: 'Download' }).first(),
  ).toHaveAttribute(
    'href',
    `/api/zrl/packs/${encodeURIComponent(readyPack.packId)}/download`,
  );
  await expect(
    page.getByRole('link', { name: 'Verify' }).first(),
  ).toHaveAttribute(
    'href',
    `/api/zrl/packs/${encodeURIComponent(readyPack.packId)}/verify`,
  );
});
