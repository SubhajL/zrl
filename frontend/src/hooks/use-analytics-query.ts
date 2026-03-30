'use client';

import { useQuery } from '@tanstack/react-query';
import {
  loadAnalyticsPageData,
  type AnalyticsPageData,
} from '@/lib/analytics-data';

export const ANALYTICS_QUERY_KEY = ['analytics'] as const;

export function useAnalyticsQuery() {
  return useQuery<AnalyticsPageData>({
    queryKey: ANALYTICS_QUERY_KEY,
    queryFn: loadAnalyticsPageData,
  });
}
