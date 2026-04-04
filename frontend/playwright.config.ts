import { defineConfig } from '@playwright/test';

function resolveFrontendPort(): string {
  const explicitPort = process.env['FRONTEND_PORT']?.trim();
  if (explicitPort) {
    return explicitPort;
  }

  const configuredBaseUrl = process.env['PLAYWRIGHT_BASE_URL']?.trim();
  if (configuredBaseUrl) {
    try {
      const parsedBaseUrl = new URL(configuredBaseUrl);
      if (parsedBaseUrl.port) {
        return parsedBaseUrl.port;
      }
    } catch {
      return '3400';
    }
  }

  return '3400';
}

const frontendPort = resolveFrontendPort();
const backendPort = process.env['BACKEND_PORT']?.trim() || '3401';
const baseURL =
  process.env['PLAYWRIGHT_BASE_URL']?.trim() ||
  `http://127.0.0.1:${frontendPort}`;
const shouldStartLocalWebServer =
  !process.env['CI'] && process.env['PLAYWRIGHT_SKIP_WEBSERVER'] !== '1';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: shouldStartLocalWebServer
    ? {
        command: 'bash ../scripts/run-local-playwright.sh --serve',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 300_000,
        env: {
          ...process.env,
          FRONTEND_PORT: frontendPort,
          BACKEND_PORT: backendPort,
        },
      }
    : undefined,
});
