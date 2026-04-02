import { Injectable } from '@nestjs/common';
import { ColdChainService } from '../cold-chain/cold-chain.service';
import { LaneService } from '../lane/lane.service';
import type { LaneTimelineEvent } from '../lane/lane.types';
import type {
  DefenseTemperatureForensics,
  DefenseVisualEvidenceItem,
  DisputeTimelineEvent,
} from './dispute.types';

const MAX_TIMELINE_CHART_POINTS = 12;

@Injectable()
export class DisputeTimelineService {
  constructor(
    private readonly laneService: LaneService,
    private readonly coldChainService: ColdChainService,
  ) {}

  async buildDefenseEvidence(laneId: string): Promise<{
    timeline: DisputeTimelineEvent[];
    temperatureForensics: DefenseTemperatureForensics;
    visualEvidence: DefenseVisualEvidenceItem[];
  }> {
    const [laneTimeline, temperatureForensics] = await Promise.all([
      this.laneService.getTimeline(laneId),
      this.buildTemperatureForensics(laneId),
    ]);

    return {
      timeline: this.reconstructTimelineFromLaneTimeline(
        laneTimeline,
        temperatureForensics,
      ),
      temperatureForensics,
      visualEvidence: this.buildVisualEvidence(laneTimeline),
    };
  }

  async reconstructTimeline(laneId: string): Promise<DisputeTimelineEvent[]> {
    const { timeline } = await this.buildDefenseEvidence(laneId);
    return timeline;
  }

  private reconstructTimelineFromLaneTimeline(
    laneTimeline: readonly LaneTimelineEvent[],
    temperatureForensics: DefenseTemperatureForensics,
  ): DisputeTimelineEvent[] {
    const auditAndLaneEvents = laneTimeline.map((event) =>
      this.mapLaneTimelineEvent(event),
    );
    const temperatureEvents = temperatureForensics.chartPoints.map((point) => ({
      timestamp: point.label,
      category: 'TEMPERATURE' as const,
      title: 'Temperature reading',
      details: `${point.temperatureC.toFixed(1)}°C recorded in the cold-chain trace.`,
      actor: null,
      location: null,
      signer: null,
      temperatureC: point.temperatureC,
    }));
    const excursionEvents = temperatureForensics.excursions.map(
      (excursion) => ({
        timestamp: excursion.startedAt,
        category: 'EXCURSION' as const,
        title: `${excursion.severity} ${excursion.type.toLowerCase()} excursion`,
        details: `${excursion.direction.toLowerCase()} deviation lasted ${excursion.durationMinutes} minutes with max deviation ${excursion.maxDeviationC.toFixed(1)}°C.`,
        actor: null,
        location: null,
        signer: null,
        temperatureC: null,
      }),
    );

    return [...auditAndLaneEvents, ...temperatureEvents, ...excursionEvents]
      .sort(
        (left, right) =>
          new Date(left.timestamp).getTime() -
          new Date(right.timestamp).getTime(),
      )
      .map((event) => ({
        ...event,
        timestamp: new Date(event.timestamp).toISOString(),
      }));
  }

  async buildTemperatureForensics(
    laneId: string,
  ): Promise<DefenseTemperatureForensics> {
    const report = await this.coldChainService.getLaneTemperatureSlaReport(
      laneId,
      { resolution: '1h' },
    );
    const chartReadings = this.sampleChartPoints(report.chartData.readings);
    const [minObserved, maxObserved] = this.resolveChartBounds(
      report.chartData.readings.map((reading) => reading.temperatureC),
      report.chartData.optimalBand.minC,
      report.chartData.optimalBand.maxC,
    );

    return {
      slaStatus: report.status,
      defensibilityScore: report.defensibilityScore,
      remainingShelfLifeDays: report.remainingShelfLifeDays,
      totalExcursionMinutes: report.totalExcursionMinutes,
      maxDeviationC: report.maxDeviationC,
      readingCount: report.meta.totalReadings,
      chartPoints: chartReadings.map((reading) => ({
        label: reading.timestamp.toISOString(),
        temperatureC: reading.temperatureC,
        heightPercent: this.toHeightPercent(
          reading.temperatureC,
          minObserved,
          maxObserved,
        ),
      })),
      checkpointMarkers: report.chartData.checkpoints.map((checkpoint) => ({
        label: checkpoint.label,
        timestamp: checkpoint.timestamp?.toISOString() ?? null,
      })),
      excursions: report.excursions.map((excursion) => ({
        severity: excursion.severity,
        type: excursion.type,
        direction: excursion.direction,
        startedAt: excursion.startedAt.toISOString(),
        endedAt: excursion.endedAt?.toISOString() ?? null,
        durationMinutes: excursion.durationMinutes,
        maxDeviationC: excursion.maxDeviationC,
      })),
      narrative: this.buildTemperatureNarrative(report.status, report),
    };
  }

  buildVisualEvidence(
    laneTimeline: readonly LaneTimelineEvent[],
  ): DefenseVisualEvidenceItem[] {
    return laneTimeline
      .filter(
        (event) =>
          event.metadata?.kind === 'artifact' &&
          event.metadata.artifactType === 'CHECKPOINT_PHOTO',
      )
      .map((event) => {
        const metadata =
          event.metadata?.kind === 'artifact' ? event.metadata.metadata : null;
        const gpsLat =
          typeof metadata?.['gpsLat'] === 'number' ? metadata['gpsLat'] : null;
        const gpsLng =
          typeof metadata?.['gpsLng'] === 'number' ? metadata['gpsLng'] : null;

        return {
          fileName:
            event.metadata?.kind === 'artifact' ? event.metadata.fileName : '',
          checkpointLabel: null,
          capturedAt:
            typeof metadata?.['capturedAt'] === 'string'
              ? metadata['capturedAt']
              : event.timestamp.toISOString(),
          gps:
            gpsLat !== null && gpsLng !== null
              ? `${gpsLat.toFixed(5)}, ${gpsLng.toFixed(5)}`
              : null,
          cameraModel:
            typeof metadata?.['cameraModel'] === 'string'
              ? metadata['cameraModel']
              : null,
          source:
            typeof metadata?.['source'] === 'string'
              ? metadata['source']
              : 'EXIF',
          exifStatus:
            typeof metadata?.['capturedAt'] === 'string' &&
            gpsLat !== null &&
            gpsLng !== null
              ? 'VERIFIED'
              : 'PARTIAL',
        };
      });
  }

  private mapLaneTimelineEvent(event: LaneTimelineEvent): DisputeTimelineEvent {
    if (event.metadata?.kind === 'lane') {
      return {
        timestamp: event.timestamp.toISOString(),
        category: 'LANE_STATUS',
        title: `Lane status changed to ${event.metadata.status}`,
        details: `Completeness ${event.metadata.completenessScore}% for ${event.metadata.productType} to ${event.metadata.destinationMarket}.`,
        actor: event.actor,
        location: null,
        signer: null,
        temperatureC: null,
      };
    }

    if (event.metadata?.kind === 'checkpoint') {
      return {
        timestamp:
          event.metadata.timestamp?.toISOString() ??
          event.timestamp.toISOString(),
        category: 'CHECKPOINT',
        title: `Checkpoint ${event.metadata.sequence}: ${event.metadata.locationName}`,
        details: `Status ${event.metadata.status}.${event.metadata.conditionNotes ? ` ${event.metadata.conditionNotes}` : ''}`,
        actor: event.actor,
        location: event.metadata.locationName,
        signer: event.metadata.signerName,
        temperatureC: event.metadata.temperature,
      };
    }

    if (event.metadata?.kind === 'artifact') {
      return {
        timestamp: event.timestamp.toISOString(),
        category: 'ARTIFACT',
        title: `${event.metadata.artifactType} evidence recorded`,
        details: event.metadata.fileName,
        actor: event.actor,
        location: null,
        signer: null,
        temperatureC: null,
      };
    }

    return {
      timestamp: event.timestamp.toISOString(),
      category: 'AUDIT',
      title: event.description,
      details: `${event.entityType} ${event.entityId}`,
      actor: event.actor,
      location: null,
      signer: null,
      temperatureC: null,
    };
  }

  private sampleChartPoints(
    readings: ReadonlyArray<{ timestamp: Date; temperatureC: number }>,
  ) {
    if (readings.length <= MAX_TIMELINE_CHART_POINTS) {
      return readings;
    }

    const step = (readings.length - 1) / (MAX_TIMELINE_CHART_POINTS - 1);
    const sampled: Array<{ timestamp: Date; temperatureC: number }> = [];

    for (let index = 0; index < MAX_TIMELINE_CHART_POINTS; index += 1) {
      sampled.push(readings[Math.round(index * step)]);
    }

    return sampled;
  }

  private resolveChartBounds(
    values: readonly number[],
    optimalMin: number,
    optimalMax: number,
  ): [number, number] {
    const floor = Math.min(optimalMin, ...values);
    const ceiling = Math.max(optimalMax, ...values);

    if (floor === ceiling) {
      return [floor - 1, ceiling + 1];
    }

    return [floor, ceiling];
  }

  private toHeightPercent(
    value: number,
    minObserved: number,
    maxObserved: number,
  ): number {
    return Math.round(
      ((value - minObserved) / (maxObserved - minObserved)) * 100,
    );
  }

  private buildTemperatureNarrative(
    status: DefenseTemperatureForensics['slaStatus'],
    report: Awaited<
      ReturnType<ColdChainService['getLaneTemperatureSlaReport']>
    >,
  ): string {
    if (report.meta.totalReadings === 0) {
      return 'No telemetry readings were available for this lane.';
    }

    if (report.excursions.length === 0) {
      return `Telemetry remained within the product-specific operating band. ${report.meta.totalReadings} readings support a ${status} SLA outcome.`;
    }

    return `${report.meta.totalReadings} readings produced ${report.excursions.length} excursion event(s), for ${report.totalExcursionMinutes} total excursion minutes and a worst deviation of ${report.maxDeviationC.toFixed(1)}°C.`;
  }
}
