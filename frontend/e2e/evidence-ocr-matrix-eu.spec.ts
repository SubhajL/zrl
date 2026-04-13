import { test } from './fixtures';
import {
  assertFullBrowserOcrMatrixShape,
  executeBrowserOcrScenario,
  OCR_BROWSER_SCENARIOS_BY_MARKET,
} from './evidence-ocr-matrix.shared';

test('browser OCR matrix enumerates every current required slot', () => {
  assertFullBrowserOcrMatrixShape();
});

for (const scenario of OCR_BROWSER_SCENARIOS_BY_MARKET.EU) {
  test(`browser OCR matrix proof for ${scenario.name}`, async ({
    page,
    backendHelper,
  }) => {
    await executeBrowserOcrScenario(page, backendHelper, scenario);
  });
}
