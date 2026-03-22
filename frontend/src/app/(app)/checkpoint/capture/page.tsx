'use client';

import * as React from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  Thermometer,
  Check,
  Minus,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FRUIT_TEMPERATURE_PROFILES, type ProductType } from '@/lib/types';

// ── Constants ──
// Gap #7 fix: use fruit-specific profiles instead of hardcoded mango range
const CURRENT_PRODUCT: ProductType = 'MANGO'; // TODO: derive from lane data when API is wired
const TEMP_PROFILE = FRUIT_TEMPERATURE_PROFILES[CURRENT_PRODUCT];
const TEMP_STEP = 0.5;
const DEFAULT_TEMP = (TEMP_PROFILE.optimalMinC + TEMP_PROFILE.optimalMaxC) / 2;

type ConditionAssessment = 'good' | 'minor' | 'major';

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

// ── Steps ──

const CAPTURE_STEPS = [
  'Lane Info',
  'Photo',
  'Temperature',
  'Condition',
  'Review',
] as const;

// ── Component ──

export default function CheckpointCapture() {
  const [currentCaptureStep, setCurrentCaptureStep] = React.useState(0);
  const [temperature, setTemperature] = React.useState(DEFAULT_TEMP);
  const [condition, setCondition] = React.useState<ConditionAssessment | null>(
    null,
  );
  const [notes, setNotes] = React.useState('');
  const [photoTaken, setPhotoTaken] = React.useState(false);

  const tempInRange =
    temperature >= TEMP_PROFILE.optimalMinC && temperature <= TEMP_PROFILE.optimalMaxC;

  const handleTempDecrement = () => {
    setTemperature((t) => Math.round((t - TEMP_STEP) * 10) / 10);
  };

  const handleTempIncrement = () => {
    setTemperature((t) => Math.round((t + TEMP_STEP) * 10) / 10);
  };

  const totalSteps = CAPTURE_STEPS.length;
  const progressPct = Math.round(((currentCaptureStep + 1) / totalSteps) * 100);

  return (
    <div className="mx-auto max-w-md space-y-6 pb-32">
      {/* Step Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-primary">
              {currentCaptureStep + 1} of {totalSteps}
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

      {/* Lane Info — always visible at top */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold" data-testid="checkpoint-name">
                CP2: Truck &rarr; Port
              </h3>
              <p className="text-sm text-muted-foreground">Laem Chabang Port</p>
            </div>
            <Badge variant="warning">In Progress</Badge>
          </div>
          <div className="mt-3 border-t pt-3">
            <span
              className="text-sm font-medium text-muted-foreground"
              data-testid="lane-info"
            >
              LN-2026-001 | Mango &rarr; Japan
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Step-specific content */}
      {currentCaptureStep === 0 && <StepLaneInfo />}
      {currentCaptureStep === 1 && (
        <StepPhoto
          photoTaken={photoTaken}
          onTakePhoto={() => setPhotoTaken(true)}
        />
      )}
      {currentCaptureStep === 2 && (
        <StepTemperature
          temperature={temperature}
          tempInRange={tempInRange}
          onIncrement={handleTempIncrement}
          onDecrement={handleTempDecrement}
        />
      )}
      {currentCaptureStep === 3 && (
        <StepCondition
          condition={condition}
          onConditionChange={setCondition}
          notes={notes}
          onNotesChange={setNotes}
        />
      )}
      {currentCaptureStep === 4 && (
        <StepReview
          photoTaken={photoTaken}
          temperature={temperature}
          tempInRange={tempInRange}
          condition={condition}
          notes={notes}
        />
      )}

      {/* Fixed Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-6 pb-8 pt-4">
          <Button
            variant="ghost"
            className="h-14 flex-1"
            onClick={() => setCurrentCaptureStep((s) => Math.max(0, s - 1))}
            disabled={currentCaptureStep === 0}
            aria-label="Back"
          >
            <ArrowLeft />
            Back
          </Button>

          {currentCaptureStep < totalSteps - 1 ? (
            <Button
              className="h-14 flex-[2]"
              onClick={() => setCurrentCaptureStep((s) => s + 1)}
            >
              Next: {CAPTURE_STEPS[currentCaptureStep + 1]}
              <ArrowRight />
            </Button>
          ) : (
            <Button className="h-14 flex-[2]">
              Submit Checkpoint
              <Check />
            </Button>
          )}
        </div>
      </nav>
    </div>
  );
}

// ── Step 0: Lane Info ──

function StepLaneInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checkpoint Details</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Lane</dt>
            <dd className="font-mono font-medium">LN-2026-001</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Product</dt>
            <dd className="font-medium">Mango</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Destination</dt>
            <dd className="font-medium">Japan</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Checkpoint</dt>
            <dd className="font-medium">CP2: Truck to Port</dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Location</dt>
            <dd className="font-medium">Laem Chabang Port</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ── Step 1: Photo Capture ──

interface StepPhotoProps {
  readonly photoTaken: boolean;
  readonly onTakePhoto: () => void;
}

function StepPhoto({ photoTaken, onTakePhoto }: StepPhotoProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        {/* Photo preview area */}
        <div
          className={cn(
            'flex aspect-video items-center justify-center rounded-xl',
            photoTaken ? 'bg-emerald-50' : 'bg-muted',
          )}
        >
          {photoTaken ? (
            <div className="flex flex-col items-center gap-2 text-emerald-600">
              <Check className="size-12" />
              <span className="text-sm font-medium">Photo captured</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Camera className="size-12" />
              <span className="text-sm">No photo yet</span>
            </div>
          )}
        </div>

        {/* Take Photo button */}
        <Button
          className="h-14 w-full text-lg"
          onClick={onTakePhoto}
          data-testid="take-photo-btn"
        >
          <Camera />
          Take Photo
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Step 2: Temperature Input ──

interface StepTemperatureProps {
  readonly temperature: number;
  readonly tempInRange: boolean;
  readonly onIncrement: () => void;
  readonly onDecrement: () => void;
}

function StepTemperature({
  temperature,
  tempInRange,
  onIncrement,
  onDecrement,
}: StepTemperatureProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
          <Thermometer className="size-4" />
          Temperature Reading
        </div>

        {/* Temperature controls */}
        <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-4">
          <Button
            variant="outline"
            className="h-14 w-14"
            onClick={onDecrement}
            aria-label="Decrease temperature"
            data-testid="temp-decrement"
          >
            <Minus />
          </Button>
          <div className="text-center">
            <span
              className="font-mono text-4xl font-bold"
              data-testid="temperature-display"
            >
              {temperature.toFixed(1)}&deg;C
            </span>
          </div>
          <Button
            variant="outline"
            className="h-14 w-14"
            onClick={onIncrement}
            aria-label="Increase temperature"
            data-testid="temp-increment"
          >
            <Plus />
          </Button>
        </div>

        {/* Range badge */}
        <Badge
          variant={tempInRange ? 'success' : 'destructive'}
          className="w-full justify-center py-2"
          data-testid="temp-range-badge"
        >
          {tempInRange
            ? `Within range (${TEMP_PROFILE.optimalMinC}-${TEMP_PROFILE.optimalMaxC}\u00B0C)`
            : `Out of range (${TEMP_PROFILE.optimalMinC}-${TEMP_PROFILE.optimalMaxC}\u00B0C)`}
        </Badge>
      </CardContent>
    </Card>
  );
}

// ── Step 3: Condition Assessment ──

interface StepConditionProps {
  readonly condition: ConditionAssessment | null;
  readonly onConditionChange: (c: ConditionAssessment) => void;
  readonly notes: string;
  readonly onNotesChange: (v: string) => void;
}

function StepCondition({
  condition,
  onConditionChange,
  notes,
  onNotesChange,
}: StepConditionProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <span className="text-sm font-bold text-muted-foreground">
          Condition Assessment
        </span>

        {/* Condition buttons */}
        <div className="grid grid-cols-3 gap-3">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onConditionChange(opt.value)}
              data-testid={`condition-${opt.value}`}
              className={cn(
                'flex h-14 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all',
                condition === opt.value ? opt.activeClass : opt.inactiveClass,
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Notes */}
        <textarea
          className="w-full rounded-xl border bg-muted/50 p-4 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Add condition notes..."
          aria-label="Condition notes"
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          data-testid="condition-notes"
        />
      </CardContent>
    </Card>
  );
}

// ── Step 4: Review & Submit ──

interface StepReviewProps {
  readonly photoTaken: boolean;
  readonly temperature: number;
  readonly tempInRange: boolean;
  readonly condition: ConditionAssessment | null;
  readonly notes: string;
}

function StepReview({
  photoTaken,
  temperature,
  tempInRange,
  condition,
  notes,
}: StepReviewProps) {
  const conditionLabel = condition
    ? (CONDITION_OPTIONS.find((o) => o.value === condition)?.label ?? '—')
    : '—';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Checkpoint Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y text-sm">
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Photo</dt>
            <dd className="font-medium">
              {photoTaken ? (
                <Badge variant="success">Captured</Badge>
              ) : (
                <Badge variant="destructive">Missing</Badge>
              )}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Temperature</dt>
            <dd className="font-mono font-medium">
              {temperature.toFixed(1)}&deg;C{' '}
              <Badge
                variant={tempInRange ? 'success' : 'destructive'}
                className="ml-1"
              >
                {tempInRange ? 'OK' : 'Out of range'}
              </Badge>
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-muted-foreground">Condition</dt>
            <dd className="font-medium">{conditionLabel}</dd>
          </div>
          {notes && (
            <div className="py-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="mt-1 font-medium">{notes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
