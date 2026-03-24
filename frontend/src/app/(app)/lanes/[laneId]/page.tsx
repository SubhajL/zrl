import { headers } from 'next/headers';

import { LaneDetailTabs } from './_components/lane-detail-tabs';
import { loadLaneDetailPageData } from '@/lib/lane-detail-data';

interface LaneDetailPageProps {
  readonly params: Promise<{
    readonly laneId: string;
  }>;
}

export default async function LaneDetailPage({
  params,
}: LaneDetailPageProps) {
  const { laneId } = await params;
  const requestHeaders = await headers();
  const data = await loadLaneDetailPageData(laneId, {
    requestHeaders,
  });

  return <LaneDetailTabs data={data} />;
}
