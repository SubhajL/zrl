import { test } from './fixtures';
import {
  assertLaneReviewStep,
  completeLaneCreationFlow,
  completeLaneWizardToReview,
  loginAsExporter,
  submitLaneCreationExpectError,
} from './helpers/lane-wizard';
import {
  LIVE_LANE_CREATION_SCENARIOS,
  UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS,
} from '../src/lib/testing/lane-creation-scenarios';

for (const scenario of LIVE_LANE_CREATION_SCENARIOS) {
  test(`creates lane for ${scenario.name}`, async ({ page }) => {
    await completeLaneCreationFlow(page, scenario);
  });
}

for (const scenario of UNSUPPORTED_LIVE_LANE_CREATION_SCENARIOS) {
  test(`shows missing-rule error for ${scenario.name}`, async ({ page }) => {
    await loginAsExporter(page);
    await completeLaneWizardToReview(page, scenario);
    await assertLaneReviewStep(page, scenario);
    await submitLaneCreationExpectError(
      page,
      'No rules are available for the selected market/product.',
    );
  });
}
