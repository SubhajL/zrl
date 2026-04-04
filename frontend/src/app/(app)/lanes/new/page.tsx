'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Save, Check } from 'lucide-react';
import { Stepper } from '@/components/zrl/stepper';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage, requestAppJson } from '@/lib/app-api';
import { cn } from '@/lib/utils';
import {
  type ProductType,
  type DestinationMarket,
  PRODUCT_LABELS,
  PRODUCT_EMOJI,
  MARKET_FLAGS,
  MARKET_LABELS,
} from '@/lib/types';

// ── Constants ──

const WIZARD_STEPS = [
  { label: 'Product' },
  { label: 'Destination' },
  { label: 'Route' },
  { label: 'Review' },
] as const;

const PRODUCTS: readonly ProductType[] = [
  'MANGO',
  'DURIAN',
  'MANGOSTEEN',
  'LONGAN',
];

const MARKETS: readonly DestinationMarket[] = ['JAPAN', 'CHINA', 'KOREA', 'EU'];

const MARKET_STRICTNESS: Record<
  DestinationMarket,
  { score: number; variant: 'destructive' | 'warning' | 'info' }
> = {
  JAPAN: { score: 10, variant: 'destructive' },
  CHINA: { score: 7, variant: 'warning' },
  KOREA: { score: 8, variant: 'warning' },
  EU: { score: 6, variant: 'info' },
};

const EVIDENCE_CHECKLIST: Record<DestinationMarket, readonly string[]> = {
  JAPAN: [
    'MRL Test (MAFF)',
    'VHT Certificate',
    'Phytosanitary Certificate',
    'GAP Certificate',
    'Cold-chain Log',
  ],
  CHINA: [
    'MRL Test (GACC)',
    'Phytosanitary Certificate',
    'GAP Certificate',
    'Cold-chain Log',
  ],
  KOREA: [
    'MRL Test (KFDA)',
    'Phytosanitary Certificate',
    'GAP Certificate',
    'Cold-chain Log',
    'Irradiation Certificate',
  ],
  EU: [
    'MRL Test (EU MRL)',
    'Phytosanitary Certificate',
    'GAP Certificate',
    'Cold-chain Log',
  ],
};

const GRADES = ['Premium', 'A', 'B'] as const;
type Grade = (typeof GRADES)[number];

const TRANSPORT_MODES = ['Air', 'Sea', 'Truck'] as const;
type TransportModeOption = (typeof TRANSPORT_MODES)[number];

const COLD_CHAIN_MODES = ['Manual', 'Logger', 'Telemetry'] as const;
type ColdChainMode = (typeof COLD_CHAIN_MODES)[number];

const DEFAULT_CHECKPOINTS = [
  { seq: 1, name: 'Farm / Packing House' },
  { seq: 2, name: 'Truck Pickup' },
  { seq: 3, name: 'Port / Airport' },
  { seq: 4, name: 'Destination Arrival' },
] as const;

function getColdChainConfigError(
  mode: ColdChainMode,
  deviceId: string,
  dataFrequencySeconds: string,
): string | null {
  if (mode === 'Manual') {
    return null;
  }

  if (deviceId.trim().length === 0) {
    return 'Device ID is required for logger and telemetry modes.';
  }

  if (dataFrequencySeconds.trim().length === 0) {
    return 'Data frequency is required for logger and telemetry modes.';
  }

  const parsedFrequency = Number.parseInt(dataFrequencySeconds, 10);
  if (
    !Number.isInteger(parsedFrequency) ||
    parsedFrequency <= 0 ||
    parsedFrequency.toString() !== dataFrequencySeconds.trim()
  ) {
    return 'Data frequency must be a positive integer in seconds.';
  }

  if (mode === 'Logger' && (parsedFrequency < 300 || parsedFrequency > 900)) {
    return 'Logger mode frequency must be between 300 and 900 seconds.';
  }

  if (mode === 'Telemetry' && parsedFrequency > 60) {
    return 'Telemetry mode frequency must be 60 seconds or less.';
  }

  return null;
}

// ── Component ──

export default function LaneCreationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);

  // Step 0 state
  const [selectedProduct, setSelectedProduct] =
    React.useState<ProductType | null>(null);
  const [variety, setVariety] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [harvestDate, setHarvestDate] = React.useState('');
  const [originProvince, setOriginProvince] = React.useState('');
  const [grade, setGrade] = React.useState<Grade>('Premium');
  const [gapCertificate, setGapCertificate] = React.useState('');

  // Step 1 state
  const [selectedMarket, setSelectedMarket] =
    React.useState<DestinationMarket | null>(null);

  // Step 2 state
  const [transportMode, setTransportMode] =
    React.useState<TransportModeOption>('Air');
  const [carrier, setCarrier] = React.useState('');
  const [coldChainMode, setColdChainMode] =
    React.useState<ColdChainMode>('Manual');
  const [coldChainDeviceId, setColdChainDeviceId] = React.useState('');
  const [coldChainDataFrequencySeconds, setColdChainDataFrequencySeconds] =
    React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const productPrefix = selectedProduct
    ? PRODUCT_LABELS[selectedProduct].substring(0, 3).toUpperCase()
    : 'XXX';
  const marketPrefix = selectedMarket
    ? MARKET_LABELS[selectedMarket].substring(0, 3).toUpperCase()
    : 'XXX';
  const dateStr = (harvestDate || today).replace(/-/g, '');
  const batchId = `${productPrefix}-${marketPrefix}-${dateStr}-001`;

  const nextStepLabel =
    currentStep < WIZARD_STEPS.length - 1
      ? WIZARD_STEPS[currentStep + 1].label
      : null;
  const coldChainConfigError = getColdChainConfigError(
    coldChainMode,
    coldChainDeviceId,
    coldChainDataFrequencySeconds,
  );

  async function handleCreateLane() {
    if (selectedProduct === null || selectedMarket === null) {
      return;
    }

    if (coldChainConfigError !== null) {
      setSubmitError(coldChainConfigError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const gapCertificateNumber = gapCertificate.trim();
      if (gapCertificateNumber.length > 0) {
        const lookup = await requestAppJson<{
          lookup: {
            valid: boolean;
          };
        }>(
          `/api/zrl/integrations/certifications/acfs/${encodeURIComponent(
            gapCertificateNumber,
          )}`,
        );

        if (!lookup.lookup.valid) {
          throw new Error('ACFS GAP certificate is invalid or expired.');
        }
      }

      const response = await requestAppJson<{ lane: { id: string } }>(
        '/api/zrl/lanes',
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            product: selectedProduct,
            batch: {
              variety: variety.trim().length > 0 ? variety.trim() : undefined,
              quantityKg: Number.parseFloat(quantity),
              originProvince: originProvince.trim(),
              harvestDate: harvestDate,
              grade,
            },
            destination: {
              market: selectedMarket,
            },
            route: {
              transportMode: transportMode.toUpperCase(),
              carrier: carrier.trim().length > 0 ? carrier.trim() : undefined,
            },
            coldChainMode: coldChainMode.toUpperCase(),
            coldChainConfig:
              coldChainMode === 'Manual'
                ? {
                    mode: coldChainMode.toUpperCase(),
                  }
                : {
                    mode: coldChainMode.toUpperCase(),
                    deviceId: coldChainDeviceId.trim(),
                    dataFrequencySeconds: Number.parseInt(
                      coldChainDataFrequencySeconds,
                      10,
                    ),
                  },
          }),
        },
      );

      if (gapCertificateNumber.length > 0) {
        try {
          await requestAppJson(
            `/api/zrl/lanes/${response.lane.id}/integrations/certifications/acfs/import`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                certificateNumber: gapCertificateNumber,
              }),
            },
          );
        } catch {
          router.push(`/lanes/${response.lane.id}`);
          return;
        }
      }

      router.push(`/lanes/${response.lane.id}`);
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, 'Unable to create lane with the provided data.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[800px] space-y-8">
      {/* Stepper */}
      <Stepper steps={[...WIZARD_STEPS]} currentStep={currentStep} />

      {/* Step Content */}
      {currentStep === 0 && (
        <StepProductBatch
          selectedProduct={selectedProduct}
          onSelectProduct={setSelectedProduct}
          variety={variety}
          onVarietyChange={setVariety}
          quantity={quantity}
          onQuantityChange={setQuantity}
          harvestDate={harvestDate}
          onHarvestDateChange={setHarvestDate}
          originProvince={originProvince}
          onOriginProvinceChange={setOriginProvince}
          grade={grade}
          onGradeChange={setGrade}
          gapCertificate={gapCertificate}
          onGapCertificateChange={setGapCertificate}
          batchId={batchId}
        />
      )}

      {currentStep === 1 && (
        <StepDestination
          selectedMarket={selectedMarket}
          onSelectMarket={setSelectedMarket}
        />
      )}

      {currentStep === 2 && (
        <StepRoute
          transportMode={transportMode}
          onTransportModeChange={setTransportMode}
          carrier={carrier}
          onCarrierChange={setCarrier}
          coldChainMode={coldChainMode}
          onColdChainModeChange={setColdChainMode}
          coldChainDeviceId={coldChainDeviceId}
          onColdChainDeviceIdChange={setColdChainDeviceId}
          coldChainDataFrequencySeconds={coldChainDataFrequencySeconds}
          onColdChainDataFrequencySecondsChange={
            setColdChainDataFrequencySeconds
          }
          coldChainConfigError={coldChainConfigError}
        />
      )}

      {currentStep === 3 && (
        <StepReview
          selectedProduct={selectedProduct}
          variety={variety}
          quantity={quantity}
          harvestDate={harvestDate}
          originProvince={originProvince}
          grade={grade}
          gapCertificate={gapCertificate}
          batchId={batchId}
          selectedMarket={selectedMarket}
          transportMode={transportMode}
          carrier={carrier}
          coldChainMode={coldChainMode}
          coldChainDeviceId={coldChainDeviceId}
          coldChainDataFrequencySeconds={coldChainDataFrequencySeconds}
        />
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pb-8">
        {currentStep > 0 ? (
          <Button
            variant="ghost"
            onClick={() => setCurrentStep((s) => s - 1)}
            aria-label="Back"
          >
            <ArrowLeft />
            Back
          </Button>
        ) : (
          <div />
        )}

        {currentStep < WIZARD_STEPS.length - 1 ? (
          <Button
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={
              (currentStep === 0 && !selectedProduct) ||
              (currentStep === 1 && !selectedMarket) ||
              (currentStep === 2 && coldChainConfigError !== null)
            }
          >
            Next: {nextStepLabel}
            <ArrowRight />
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <Button variant="ghost" disabled>
              <Save />
              Drafts unavailable
            </Button>
            <Button
              onClick={() => {
                void handleCreateLane();
              }}
              disabled={
                !selectedProduct ||
                !selectedMarket ||
                coldChainConfigError !== null
              }
            >
              {isSubmitting ? 'Creating...' : 'Create Lane'}
              {!isSubmitting && <Check />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 0: Product & Batch ──

interface StepProductBatchProps {
  readonly selectedProduct: ProductType | null;
  readonly onSelectProduct: (p: ProductType) => void;
  readonly variety: string;
  readonly onVarietyChange: (v: string) => void;
  readonly quantity: string;
  readonly onQuantityChange: (v: string) => void;
  readonly harvestDate: string;
  readonly onHarvestDateChange: (v: string) => void;
  readonly originProvince: string;
  readonly onOriginProvinceChange: (v: string) => void;
  readonly grade: Grade;
  readonly onGradeChange: (g: Grade) => void;
  readonly gapCertificate: string;
  readonly onGapCertificateChange: (v: string) => void;
  readonly batchId: string;
}

function StepProductBatch({
  selectedProduct,
  onSelectProduct,
  variety,
  onVarietyChange,
  quantity,
  onQuantityChange,
  harvestDate,
  onHarvestDateChange,
  originProvince,
  onOriginProvinceChange,
  grade,
  onGradeChange,
  gapCertificate,
  onGapCertificateChange,
  batchId,
}: StepProductBatchProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Select Product &amp; Batch</h1>
        <p className="text-muted-foreground">
          Choose the fruit type and provide batch details for this export lane
        </p>
      </div>

      {/* Product Type Selector */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Product Category
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {PRODUCTS.map((product) => (
            <button
              key={product}
              type="button"
              onClick={() => onSelectProduct(product)}
              data-testid={`product-card-${product}`}
              className={cn(
                'flex h-[120px] flex-col items-center justify-center gap-2 rounded-xl border-2 transition-all hover:shadow-md',
                selectedProduct === product
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/50 hover:bg-muted',
              )}
            >
              <span className="text-3xl">{PRODUCT_EMOJI[product]}</span>
              <span
                className={cn(
                  'text-sm font-semibold',
                  selectedProduct === product
                    ? 'text-primary'
                    : 'text-muted-foreground',
                )}
              >
                {PRODUCT_LABELS[product]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Form Fields */}
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Variety */}
            <div className="space-y-2">
              <Label htmlFor="variety">Variety</Label>
              <Input
                id="variety"
                placeholder="e.g., Nam Doc Mai"
                value={variety}
                onChange={(e) => onVarietyChange(e.target.value)}
              />
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <div className="relative">
                <Input
                  id="quantity"
                  type="number"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  className="pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  kg
                </span>
              </div>
            </div>

            {/* Harvest Date */}
            <div className="space-y-2">
              <Label htmlFor="harvestDate">Harvest Date</Label>
              <Input
                id="harvestDate"
                type="date"
                value={harvestDate}
                onChange={(e) => onHarvestDateChange(e.target.value)}
              />
            </div>

            {/* Origin Province */}
            <div className="space-y-2">
              <Label htmlFor="originProvince">Origin Province</Label>
              <Input
                id="originProvince"
                placeholder="e.g., Chachoengsao"
                value={originProvince}
                onChange={(e) => onOriginProvinceChange(e.target.value)}
              />
            </div>
          </div>

          {/* Grade */}
          <div className="space-y-2">
            <Label>Grade</Label>
            <div className="flex gap-3">
              {GRADES.map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={grade === g ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => onGradeChange(g)}
                  aria-pressed={grade === g}
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          {/* GAP Certificate */}
          <div className="space-y-2">
            <Label htmlFor="gapCertificate">GAP Certificate</Label>
            <Input
              id="gapCertificate"
              placeholder="e.g., TH-GAP-990-2024-X"
              value={gapCertificate}
              onChange={(e) => onGapCertificateChange(e.target.value)}
            />
          </div>

          {/* Batch ID (read-only) */}
          <div className="space-y-2">
            <Label>Batch ID</Label>
            <div
              className="rounded-xl bg-muted p-3 font-mono text-sm"
              data-testid="batch-id"
            >
              {batchId}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Step 1: Destination Market ──

interface StepDestinationProps {
  readonly selectedMarket: DestinationMarket | null;
  readonly onSelectMarket: (m: DestinationMarket) => void;
}

function StepDestination({
  selectedMarket,
  onSelectMarket,
}: StepDestinationProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Select Destination Market</h1>
        <p className="text-muted-foreground">
          Choose the target market for this export lane
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {MARKETS.map((market) => {
          const { score, variant } = MARKET_STRICTNESS[market];
          return (
            <button
              key={market}
              type="button"
              onClick={() => onSelectMarket(market)}
              data-testid={`market-card-${market}`}
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all hover:shadow-md',
                selectedMarket === market
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent bg-muted/50 hover:bg-muted',
              )}
            >
              <span className="text-4xl">{MARKET_FLAGS[market]}</span>
              <span
                className={cn(
                  'text-lg font-semibold',
                  selectedMarket === market
                    ? 'text-primary'
                    : 'text-foreground',
                )}
              >
                {MARKET_LABELS[market]}
              </span>
              <Badge variant={variant}>Strictness: {score}/10</Badge>
            </button>
          );
        })}
      </div>

      {/* Evidence summary */}
      {selectedMarket && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Required Evidence Summary
            </CardTitle>
            <CardDescription>
              Evidence checklist for {MARKET_LABELS[selectedMarket]}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {EVIDENCE_CHECKLIST[selectedMarket].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-muted-foreground" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Step 2: Logistics Route ──

interface StepRouteProps {
  readonly transportMode: TransportModeOption;
  readonly onTransportModeChange: (m: TransportModeOption) => void;
  readonly carrier: string;
  readonly onCarrierChange: (v: string) => void;
  readonly coldChainMode: ColdChainMode;
  readonly onColdChainModeChange: (m: ColdChainMode) => void;
  readonly coldChainDeviceId: string;
  readonly onColdChainDeviceIdChange: (v: string) => void;
  readonly coldChainDataFrequencySeconds: string;
  readonly onColdChainDataFrequencySecondsChange: (v: string) => void;
  readonly coldChainConfigError: string | null;
}

function StepRoute({
  transportMode,
  onTransportModeChange,
  carrier,
  onCarrierChange,
  coldChainMode,
  onColdChainModeChange,
  coldChainDeviceId,
  onColdChainDeviceIdChange,
  coldChainDataFrequencySeconds,
  onColdChainDataFrequencySecondsChange,
  coldChainConfigError,
}: StepRouteProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Logistics Route</h1>
        <p className="text-muted-foreground">
          Configure transport and cold-chain monitoring for this lane
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {/* Transport Mode */}
          <div className="space-y-2">
            <Label>Transport Mode</Label>
            <div className="flex gap-3">
              {TRANSPORT_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={transportMode === mode ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => onTransportModeChange(mode)}
                  aria-pressed={transportMode === mode}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {/* Carrier */}
          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Input
              id="carrier"
              placeholder="e.g., Thai Airways Cargo"
              value={carrier}
              onChange={(e) => onCarrierChange(e.target.value)}
            />
          </div>

          {/* Cold-chain Mode */}
          <div className="space-y-2">
            <Label>Cold-chain Mode</Label>
            <div className="flex gap-3">
              {COLD_CHAIN_MODES.map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={coldChainMode === mode ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => onColdChainModeChange(mode)}
                  aria-pressed={coldChainMode === mode}
                >
                  {mode}
                </Button>
              ))}
            </div>
          </div>

          {coldChainMode !== 'Manual' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="coldChainDeviceId">Device ID</Label>
                <Input
                  id="coldChainDeviceId"
                  placeholder="e.g., logger-mango-jp-01"
                  value={coldChainDeviceId}
                  onChange={(e) => onColdChainDeviceIdChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coldChainDataFrequencySeconds">
                  Data Frequency (seconds)
                </Label>
                <Input
                  id="coldChainDataFrequencySeconds"
                  type="number"
                  min={coldChainMode === 'Logger' ? 300 : 1}
                  max={coldChainMode === 'Logger' ? 900 : 60}
                  placeholder={coldChainMode === 'Logger' ? '600' : '30'}
                  value={coldChainDataFrequencySeconds}
                  onChange={(e) =>
                    onColdChainDataFrequencySecondsChange(e.target.value)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {coldChainMode === 'Logger'
                    ? 'Logger mode requires readings every 300 to 900 seconds.'
                    : 'Telemetry mode requires readings every 60 seconds or less.'}
                </p>
              </div>
            </>
          )}

          {coldChainConfigError && (
            <p className="text-sm font-medium text-destructive">
              {coldChainConfigError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Default Checkpoints */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Default Checkpoints</CardTitle>
          <CardDescription>
            These checkpoints will be created for the lane
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {DEFAULT_CHECKPOINTS.map((cp) => (
              <li
                key={cp.seq}
                className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3 text-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {cp.seq}
                </span>
                {cp.name}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Step 3: Review & Create ──

interface StepReviewProps {
  readonly selectedProduct: ProductType | null;
  readonly variety: string;
  readonly quantity: string;
  readonly harvestDate: string;
  readonly originProvince: string;
  readonly grade: Grade;
  readonly gapCertificate: string;
  readonly batchId: string;
  readonly selectedMarket: DestinationMarket | null;
  readonly transportMode: TransportModeOption;
  readonly carrier: string;
  readonly coldChainMode: ColdChainMode;
  readonly coldChainDeviceId: string;
  readonly coldChainDataFrequencySeconds: string;
}

function StepReview({
  selectedProduct,
  variety,
  quantity,
  harvestDate,
  originProvince,
  grade,
  gapCertificate,
  batchId,
  selectedMarket,
  transportMode,
  carrier,
  coldChainMode,
  coldChainDeviceId,
  coldChainDataFrequencySeconds,
}: StepReviewProps) {
  // Compute completeness from filled fields
  const filledFields = [
    selectedProduct,
    variety,
    quantity,
    harvestDate,
    originProvince,
    grade,
    gapCertificate,
    selectedMarket,
    transportMode,
    carrier,
    coldChainMode,
  ].filter(Boolean).length;
  const totalItems = 15;
  const completeness = Math.round((filledFields / totalItems) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review &amp; Create</h1>
        <p className="text-muted-foreground">
          Review all selections before creating the lane
        </p>
      </div>

      {/* Completeness Preview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              {completeness}% &mdash; {totalItems} items required
            </span>
            <Badge variant="secondary">Draft</Badge>
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${completeness}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lane Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            <ReviewRow
              label="Product"
              testId="lane-review-field-product"
              value={
                selectedProduct
                  ? `${PRODUCT_EMOJI[selectedProduct]} ${PRODUCT_LABELS[selectedProduct]}`
                  : '—'
              }
            />
            <ReviewRow
              label="Variety"
              value={variety || '—'}
              testId="lane-review-field-variety"
            />
            <ReviewRow
              label="Quantity"
              value={quantity ? `${quantity} kg` : '—'}
              testId="lane-review-field-quantity"
            />
            <ReviewRow label="Harvest Date" value={harvestDate || '—'} />
            <ReviewRow
              label="Origin Province"
              value={originProvince || '—'}
              testId="lane-review-field-origin-province"
            />
            <ReviewRow label="Grade" value={grade} />
            <ReviewRow label="GAP Certificate" value={gapCertificate || '—'} />
            <ReviewRow label="Batch ID" value={batchId} mono />
            <ReviewRow
              label="Destination"
              testId="lane-review-field-destination"
              value={
                selectedMarket
                  ? `${MARKET_FLAGS[selectedMarket]} ${MARKET_LABELS[selectedMarket]}`
                  : '—'
              }
            />
            <ReviewRow
              label="Transport Mode"
              value={transportMode}
              testId="lane-review-field-transport-mode"
            />
            <ReviewRow
              label="Carrier"
              value={carrier || '—'}
              testId="lane-review-field-carrier"
            />
            <ReviewRow
              label="Cold-chain Mode"
              value={coldChainMode}
              testId="lane-review-field-cold-chain-mode"
            />
            {coldChainMode !== 'Manual' && (
              <>
                <ReviewRow
                  label="Device ID"
                  value={coldChainDeviceId || '—'}
                  testId="lane-review-field-device-id"
                />
                <ReviewRow
                  label="Data Frequency"
                  value={
                    coldChainDataFrequencySeconds
                      ? `${coldChainDataFrequencySeconds} sec`
                      : '—'
                  }
                  testId="lane-review-field-data-frequency-seconds"
                />
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewRow({
  label,
  value,
  mono = false,
  testId,
}: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly testId?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn('font-medium', mono && 'font-mono')}
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}
