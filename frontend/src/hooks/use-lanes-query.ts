'use client';

import { useQuery } from '@tanstack/react-query';
import { loadLanesPage, type LoadLanesOptions } from '@/lib/lanes-data';
import type { Lane } from '@/lib/types';

interface LaneQueryResult {
  readonly data: Lane[];
  readonly meta: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export function useLanesQuery(options: LoadLanesOptions = {}) {
  return useQuery<LaneQueryResult>({
    queryKey: ['lanes', options],
    queryFn: () => loadLanesPage(options),
  });
}
