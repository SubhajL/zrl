import path from 'node:path';

import { test, expect } from './fixtures';

test('checkpoint capture uploads a checkpoint photo through the browser', async ({
  page,
  backendHelper,
}) => {
  await page.goto('/login');

  await page.locator('input#email').fill('exporter@zrl-dev.test');
  await page.locator('input#password').fill('ZrlDev2026!');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const laneId = 'LN-2026-001';
  const checkpointId = await backendHelper.resolveFirstCheckpointId(laneId);
  await page.goto(
    `/checkpoint/capture?laneId=${encodeURIComponent(laneId)}&checkpointId=${encodeURIComponent(checkpointId)}`,
  );

  await expect(page.getByTestId('checkpoint-name')).toBeVisible();
  await page.getByRole('button', { name: /next: photo/i }).click();
  await page
    .getByLabel('Checkpoint Photo')
    .setInputFiles(path.resolve(__dirname, './test-assets/checkpoint-photo.jpg'));
  await page.getByRole('button', { name: /next: temperature/i }).click();
  await page.getByRole('button', { name: /next: condition/i }).click();
  await page.getByTestId('condition-good').click();
  await page.getByRole('button', { name: /next: review/i }).click();
  await page.getByRole('button', { name: /submit checkpoint/i }).click();

  await expect(page).toHaveURL(new RegExp(`/lanes/${laneId}$`));
});
