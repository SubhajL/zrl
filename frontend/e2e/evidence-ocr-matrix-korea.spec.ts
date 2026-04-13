import { test } from './fixtures';
import {
  executeBrowserOcrScenario,
  OCR_BROWSER_SCENARIOS_BY_MARKET,
} from './evidence-ocr-matrix.shared';

for (const scenario of OCR_BROWSER_SCENARIOS_BY_MARKET.KOREA) {
  test(`browser OCR matrix proof for ${scenario.name}`, async ({
    page,
    backendHelper,
  }) => {
    await executeBrowserOcrScenario(page, backendHelper, scenario);
  });
}
