import type {
  DestinationMarket,
  Lane,
  ProductType,
} from './types';
import { requestAppJson } from './app-api';

interface LaneListResponse {
  readonly data: Lane[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export interface LoadLanesOptions {
  readonly limit?: number;
  readonly page?: number;
  readonly status?: string;
  readonly product?: ProductType;
  readonly market?: DestinationMarket;
}

export async function loadLanesPage(
  options: LoadLanesOptions = {},
): Promise<LaneListResponse> {
  const searchParams = new URLSearchParams();
  if (options.limit !== undefined) {
    searchParams.set('limit', `${options.limit}`);
  }
  if (options.page !== undefined) {
    searchParams.set('page', `${options.page}`);
  }
  if (options.status !== undefined) {
    searchParams.set('status', options.status);
  }
  if (options.product !== undefined) {
    searchParams.set('product', options.product);
  }
  if (options.market !== undefined) {
    searchParams.set('market', options.market);
  }

  const suffix = searchParams.toString();
  return await requestAppJson<LaneListResponse>(
    `/api/zrl/lanes${suffix.length > 0 ? `?${suffix}` : ''}`,
  );
}

export async function loadAllLanes(): Promise<Lane[]> {
  const firstPage = await loadLanesPage({ page: 1, limit: 100 });
  const items = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const response = await loadLanesPage({ page, limit: 100 });
    items.push(...response.data);
  }

  return items;
}
