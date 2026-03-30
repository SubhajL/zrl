'use client';

import { useQuery } from '@tanstack/react-query';
import {
  loadDashboardPageData,
  type DashboardPageData,
} from '@/lib/dashboard-data';

export const DASHBOARD_QUERY_KEY = ['dashboard'] as const;

export function useDashboardQuery() {
  return useQuery<DashboardPageData>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: loadDashboardPageData,
  });
}
