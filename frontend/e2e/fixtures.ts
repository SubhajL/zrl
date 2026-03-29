import { expect, request, test as base } from '@playwright/test';
import {
  createAuthenticatedBackendHelper,
  type AuthenticatedBackendHelper,
} from './helpers/backend';

interface ZrlFixtures {
  readonly backendHelper: AuthenticatedBackendHelper;
}

export const test = base.extend<ZrlFixtures>({
  backendHelper: async ({ baseURL }, runFixture) => {
    if (!baseURL) {
      throw new Error('Playwright baseURL is required.');
    }

    const api = await request.newContext({
      baseURL,
    });
    const helper = await createAuthenticatedBackendHelper(api);
    await runFixture(helper);
    await helper.dispose();
  },
});

export { expect };
