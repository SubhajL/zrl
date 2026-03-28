import { cookies, headers } from 'next/headers';

import { LaneDetailTabs } from './_components/lane-detail-tabs';
import {
  readAccessTokenCookie,
  readRefreshTokenCookie,
} from '@/lib/auth-session';
import { loadLaneDetailPageData } from '@/lib/lane-detail-data';
import { resolveServerAccessToken } from '@/lib/server-access-token';

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
  const cookieStore = await cookies();
  const accessToken = await resolveServerAccessToken({
    accessToken: readAccessTokenCookie(cookieStore),
    refreshToken: readRefreshTokenCookie(cookieStore),
  });
  const data = await loadLaneDetailPageData(laneId, {
    accessToken,
    requestHeaders,
  });

  return <LaneDetailTabs data={data} />;
}
