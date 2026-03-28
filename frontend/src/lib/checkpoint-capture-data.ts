import { requestAppJson } from './app-api';
import type { Checkpoint, LaneDetail } from './types';

export interface CheckpointCaptureContext {
  readonly lane: LaneDetail;
  readonly checkpoint: Checkpoint;
}

export async function loadCheckpointCaptureContext(
  laneId: string,
  checkpointId: string,
): Promise<CheckpointCaptureContext> {
  const [laneResponse, checkpointsResponse] = await Promise.all([
    requestAppJson<{ lane: LaneDetail }>(`/api/zrl/lanes/${laneId}`),
    requestAppJson<{ checkpoints: Checkpoint[] }>(
      `/api/zrl/lanes/${laneId}/checkpoints`,
    ),
  ]);

  const checkpoint = checkpointsResponse.checkpoints.find(
    (entry) => entry.id === checkpointId,
  );

  if (checkpoint === undefined) {
    throw new Error('Checkpoint not found.');
  }

  return {
    lane: laneResponse.lane,
    checkpoint,
  };
}
