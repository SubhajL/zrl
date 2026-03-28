'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Minus,
  Plus,
  Thermometer,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';
import { loadCheckpointCaptureContext } from '@/lib/checkpoint-capture-data';
import {
  FRUIT_TEMPERATURE_PROFILES,
  MARKET_LABELS,
  PRODUCT_LABELS,
  type ProductType,
} from '@/lib/types';
import { cn } from '@/lib/utils';

type ConditionAssessment = 'good' | 'minor' | 'major';

const CAPTURE_STEPS = [
  'Lane Info',
  'Photo',
  'Temperature',
  'Condition',
  'Review',
] as const;

const CONDITION_OPTIONS: readonly {
  readonly value: ConditionAssessment;
  readonly label: string;
  readonly activeClass: string;
  readonly inactiveClass: string;
}[] = [
  {
    value: 'good',
    label: 'Good',
    activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    inactiveClass: 'border-emerald-300 text-emerald-600 hover:bg-emerald-50',
  },
  {
    value: 'minor',
    label: 'Minor Issue',
    activeClass: 'border-amber-500 bg-amber-50 text-amber-700',
    inactiveClass: 'border-amber-300 text-amber-600 hover:bg-amber-50',
  },
  {
    value: 'major',
    label: 'Major Issue',
    activeClass: 'border-red-500 bg-red-50 text-red-700',
    inactiveClass: 'border-red-300 text-red-600 hover:bg-red-50',
  },
];

export default function CheckpointCapture() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const laneId = searchParams.get('laneId');
  const checkpointId = searchParams.get('checkpointId');

  const [currentCaptureStep, setCurrentCaptureStep] = React.useState(0);
  const [temperature, setTemperature] = React.useState(0);
  const [condition, setCondition] = React.useState<ConditionAssessment | null>(
    null,
  );
  const [notes, setNotes] = React.useState('');
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<Awaited<
    ReturnType<typeof loadCheckpointCaptureContext>
  > | null>(null);

  React.useEffect(() => {
    if (laneId === null || checkpointId === null) {
      return;
    }

    let active = true;

    void loadCheckpointCaptureContext(laneId, checkpointId)
      .then((result) => {
        if (active) {
          setContext(result);
          const productProfile =
            FRUIT_TEMPERATURE_PROFILES[result.lane.productType as ProductType];
          setTemperature(
            result.checkpoint.temperature ??
              (productProfile.optimalMinC + productProfile.optimalMaxC) / 2,
          );
          setNotes(result.checkpoint.conditionNotes ?? '');
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(getErrorMessage(loadError, 'Unable to load checkpoint context.'));
        }
      });

    return () => {
      active = false;
    };
  }, [checkpointId, laneId]);

  const productProfile =
    context === null
      ? FRUIT_TEMPERATURE_PROFILES.MANGO
      : FRUIT_TEMPERATURE_PROFILES[context.lane.productType];
  const tempInRange =
    temperature >= productProfile.optimalMinC &&
    temperature <= productProfile.optimalMaxC;
  const progressPct = Math.round(
    ((currentCaptureStep + 1) / CAPTURE_STEPS.length) * 100,
  );

  async function handleSubmitCheckpoint() {
    if (laneId === null || checkpointId === null) {
      setError('Checkpoint capture requires laneId and checkpointId.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await requestAppJson(`/api/zrl/lanes/${laneId}/checkpoints/${checkpointId}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'COMPLETED',
          temperature,
          timestamp: new Date().toISOString(),
          conditionNotes: notes.trim().length > 0 ? notes.trim() : undefined,
        }),
      });

      if (photoFile !== null) {
        const formData = new FormData();
        formData.set('artifactType', 'CHECKPOINT_PHOTO');
        formData.set('source', 'CAMERA');
        formData.set('checkpointId', checkpointId);
        formData.set(
          'metadata',
          JSON.stringify({
            capturedAt: new Date().toISOString(),
          }),
        );
        formData.set('file', photoFile);

        await requestAppJson(`/api/zrl/lanes/${laneId}/evidence`, {
          method: 'POST',
          body: formData,
        });
      }

      router.push(`/lanes/${laneId}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Unable to submit checkpoint.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pb-32">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-primary">
              {currentCaptureStep + 1} of {CAPTURE_STEPS.length}
            </span>
            <h2 className="text-sm font-semibold">
              {CAPTURE_STEPS[currentCaptureStep]}
            </h2>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold" data-testid="checkpoint-name">
                {context?.checkpoint.locationName ?? 'Checkpoint not loaded'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Sequence {context?.checkpoint.sequence ?? '--'}
              </p>
            </div>
            <Badge variant="warning">{context?.checkpoint.status ?? 'PENDING'}</Badge>
          </div>
          <div className="mt-3 border-t pt-3">
            <span
              className="text-sm font-medium text-muted-foreground"
              data-testid="lane-info"
            >
              {context === null
                ? 'Add laneId and checkpointId query params'
                : `${context.lane.laneId} | ${PRODUCT_LABELS[context.lane.productType]} -> ${MARKET_LABELS[context.lane.destinationMarket]}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {currentCaptureStep === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Checkpoint Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Lane</dt>
                <dd className="font-mono font-medium">
                  {context?.lane.laneId ?? '--'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Product</dt>
                <dd className="font-medium">
                  {context ? PRODUCT_LABELS[context.lane.productType] : '--'}
                </dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted-foreground">Destination</dt>
                <dd className="font-medium">
                  {context ? MARKET_LABELS[context.lane.destinationMarket] : '--'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {currentCaptureStep === 1 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div
              className={cn(
                'flex aspect-video items-center justify-center rounded-xl border',
                photoFile ? 'border-emerald-200 bg-emerald-50' : 'border-dashed',
              )}
            >
              {photoFile ? (
                <div className="text-center text-emerald-700">
                  <Check className="mx-auto size-10" />
                  <p className="text-sm font-medium">{photoFile.name}</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Camera className="mx-auto size-10" />
                  <p className="text-sm">No photo selected</p>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="checkpoint-photo">Checkpoint Photo</Label>
              <Input
                id="checkpoint-photo"
                data-testid="take-photo-btn"
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setPhotoFile(event.target.files?.[0] ?? null)
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {currentCaptureStep === 2 && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Recorded Temperature</p>
                <p className="text-xs text-muted-foreground">
                  Fruit-specific target {productProfile.optimalMinC} to{' '}
                  {productProfile.optimalMaxC}°C
                </p>
              </div>
              <Badge data-testid="temp-range-badge" variant={tempInRange ? 'success' : 'warning'}>
                {tempInRange ? 'Within range' : 'Outside range'}
              </Badge>
            </div>
            <div className="flex items-center justify-center gap-4">
              <Button
                type="button"
                variant="outline"
                data-testid="temp-decrement"
                onClick={() => setTemperature((value) => Math.round((value - 0.5) * 10) / 10)}
              >
                <Minus />
              </Button>
              <div className="rounded-xl border px-6 py-4 text-center">
                <Thermometer className="mx-auto size-5 text-muted-foreground" />
                <p data-testid="temperature-display" className="font-mono text-2xl font-bold">
                  {temperature.toFixed(1)}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                data-testid="temp-increment"
                onClick={() => setTemperature((value) => Math.round((value + 0.5) * 10) / 10)}
              >
                <Plus />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentCaptureStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condition Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {CONDITION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`condition-${option.value}`}
                  className={cn(
                    'rounded-xl border px-4 py-3 text-left',
                    condition === option.value
                      ? option.activeClass
                      : option.inactiveClass,
                  )}
                  onClick={() => setCondition(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition-notes">Notes</Label>
              <textarea
                id="condition-notes"
                data-testid="condition-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="flex w-full rounded-xl border border-input bg-background px-4 py-2 text-base"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {currentCaptureStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Photo: {photoFile ? photoFile.name : 'No photo attached'}</p>
            <p>Temperature: {temperature.toFixed(1)}°C</p>
            <p>Condition: {condition ?? 'Not specified'}</p>
            <p>Notes: {notes.trim().length > 0 ? notes : 'No notes'}</p>
          </CardContent>
        </Card>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-6 pb-8 pt-4">
          <Button
            variant="ghost"
            className="h-14 flex-1"
            onClick={() => setCurrentCaptureStep((step) => Math.max(0, step - 1))}
            disabled={currentCaptureStep === 0}
            aria-label="Back"
          >
            <ArrowLeft />
            Back
          </Button>

          {currentCaptureStep < CAPTURE_STEPS.length - 1 ? (
            <Button
              className="h-14 flex-[2]"
              onClick={() => setCurrentCaptureStep((step) => step + 1)}
            >
              Next: {CAPTURE_STEPS[currentCaptureStep + 1]}
              <ArrowRight />
            </Button>
          ) : (
            <Button
              className="h-14 flex-[2]"
              onClick={() => void handleSubmitCheckpoint()}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Checkpoint'}
              {!isSubmitting && <Check />}
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}
