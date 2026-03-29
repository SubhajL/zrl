'use client';

import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';

export interface LaneEventHandlers {
  readonly onStatusChanged?: (event: {
    laneId: string;
    oldStatus: string;
    newStatus: string;
  }) => void;
  readonly onEvidenceUploaded?: (event: {
    laneId: string;
    artifactId: string;
    type: string;
    completeness: number;
  }) => void;
  readonly onCheckpointRecorded?: (event: {
    laneId: string;
    checkpointId: string;
    sequence: number;
  }) => void;
  readonly onTemperatureExcursion?: (event: {
    laneId: string;
    excursionCount: number;
    highestSeverity: string;
    slaBreached: boolean;
  }) => void;
  readonly onPackGenerated?: (event: {
    laneId: string;
    packId: string;
    packType: string;
  }) => void;
}

export function useLaneEvents(
  socket: Socket | null,
  connected: boolean,
  laneId: string | null,
  handlers: LaneEventHandlers,
): void {
  useEffect(() => {
    if (socket === null || laneId === null || !connected) return;

    socket.emit('lane.subscribe', { laneId });

    if (handlers.onStatusChanged) {
      socket.on('lane.status.changed', handlers.onStatusChanged);
    }
    if (handlers.onEvidenceUploaded) {
      socket.on('evidence.uploaded', handlers.onEvidenceUploaded);
    }
    if (handlers.onCheckpointRecorded) {
      socket.on('checkpoint.recorded', handlers.onCheckpointRecorded);
    }
    if (handlers.onTemperatureExcursion) {
      socket.on('temperature.excursion', handlers.onTemperatureExcursion);
    }
    if (handlers.onPackGenerated) {
      socket.on('pack.generated', handlers.onPackGenerated);
    }

    return () => {
      socket.emit('lane.unsubscribe', { laneId });
      socket.off('lane.status.changed');
      socket.off('evidence.uploaded');
      socket.off('checkpoint.recorded');
      socket.off('temperature.excursion');
      socket.off('pack.generated');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers intentionally excluded to avoid re-subscribing on every render
  }, [socket, connected, laneId]);
}
